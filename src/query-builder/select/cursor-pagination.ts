import { TableDef } from '../../schema/table.js';
import { SelectQueryNode, OrderByNode } from '../../core/ast/query.js';
import {
  ColumnNode,
  LiteralNode,
  ExpressionNode,
  and,
  or
} from '../../core/ast/expression.js';
import { OrmSession } from '../../orm/orm-session.js';
import type { SelectQueryBuilder } from '../select.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CursorPageOptions = {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
};

export type CursorPageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

export type CursorPageResult<T> = {
  items: T[];
  pageInfo: CursorPageInfo;
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CursorOrderSpec {
  table: string;
  column: string;
  direction: 'ASC' | 'DESC';
}

interface EncodedCursor {
  v: 1;
  keys: Record<string, unknown>;
  orderSig: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function encodeCursor(payload: EncodedCursor): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor: string): EncodedCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new Error('executeCursor: invalid cursor format');
  }
  if (
    typeof parsed !== 'object' || parsed === null ||
    (parsed as EncodedCursor).v !== 1 ||
    typeof (parsed as EncodedCursor).keys !== 'object' ||
    typeof (parsed as EncodedCursor).orderSig !== 'string'
  ) {
    throw new Error('executeCursor: invalid cursor payload');
  }
  return parsed as EncodedCursor;
}

export function buildOrderSignature(specs: CursorOrderSpec[]): string {
  return specs.map(s => `${s.table}.${s.column}:${s.direction}`).join(',');
}

function extractOrderSpecs(ast: SelectQueryNode): CursorOrderSpec[] {
  if (!ast.orderBy || ast.orderBy.length === 0) {
    throw new Error('executeCursor: ORDER BY is required for cursor pagination');
  }

  return ast.orderBy.map((ob: OrderByNode) => {
    const term = ob.term;
    if (!term || (term as ColumnNode).type !== 'Column') {
      throw new Error(
        'executeCursor: only column references are supported in ORDER BY for cursor pagination'
      );
    }
    const col = term as ColumnNode;
    return { table: col.table, column: col.name, direction: ob.direction };
  });
}

export function buildKeysetPredicate(
  specs: CursorOrderSpec[],
  values: Record<string, unknown>,
  mode: 'after' | 'before'
): ExpressionNode {
  // For a multi-column keyset (c1 DESC, c2 DESC) with mode='after':
  //   (c1 < v1) OR (c1 = v1 AND c2 < v2)
  // 'after' on DESC → use '<'; 'after' on ASC → use '>'
  // 'before' inverts the operators.

  const branches: ExpressionNode[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const colNode: ColumnNode = { type: 'Column', table: spec.table, name: spec.column };
    const value = values[spec.column];
    const literal: LiteralNode = { type: 'Literal', value: value as LiteralNode['value'] };

    // Determine the comparison operator for the "breaking" column
    let operator: '>' | '<';
    if (mode === 'after') {
      operator = spec.direction === 'ASC' ? '>' : '<';
    } else {
      operator = spec.direction === 'ASC' ? '<' : '>';
    }

    // Build equality prefix: c0 = v0 AND c1 = v1 AND ... AND c(i-1) = v(i-1)
    const eqParts: ExpressionNode[] = [];
    for (let j = 0; j < i; j++) {
      const prevSpec = specs[j];
      const prevCol: ColumnNode = { type: 'Column', table: prevSpec.table, name: prevSpec.column };
      const prevVal: LiteralNode = { type: 'Literal', value: values[prevSpec.column] as LiteralNode['value'] };
      eqParts.push({
        type: 'BinaryExpression',
        left: prevCol,
        operator: '=',
        right: prevVal
      });
    }

    // The "breaking" comparison: ci <op> vi
    const breakExpr: ExpressionNode = {
      type: 'BinaryExpression',
      left: colNode,
      operator,
      right: literal
    };

    if (eqParts.length === 0) {
      branches.push(breakExpr);
    } else {
      branches.push(and(...eqParts, breakExpr));
    }
  }

  return branches.length === 1 ? branches[0] : or(...branches);
}

function buildCursorFromRow(row: Record<string, unknown>, specs: CursorOrderSpec[]): string {
  const keys: Record<string, unknown> = {};
  for (const spec of specs) {
    keys[spec.column] = row[spec.column];
  }
  return encodeCursor({ v: 1, keys, orderSig: buildOrderSignature(specs) });
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

export async function executeCursorQuery<T, TTable extends TableDef>(
  builder: SelectQueryBuilder<T, TTable>,
  session: OrmSession,
  options: CursorPageOptions
): Promise<CursorPageResult<T>> {
  const { first, after, last, before } = options;

  // --- Validation ---
  if (first != null && last != null) {
    throw new Error('executeCursor: "first" and "last" cannot be used together');
  }
  if (after != null && before != null) {
    throw new Error('executeCursor: "after" and "before" cannot be used together');
  }
  if (first == null && last == null) {
    throw new Error('executeCursor: either "first" or "last" must be provided');
  }
  if (last != null || before != null) {
    throw new Error('executeCursor: "last"/"before" are not supported yet (v1 supports forward pagination only)');
  }

  const limit = first!;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('executeCursor: "first" must be an integer >= 1');
  }

  // --- Extract order specs from builder AST ---
  const ast = builder.getAST();
  const specs = extractOrderSpecs(ast);

  // --- Apply cursor predicate if present ---
  let cursorBuilder = builder;
  if (after) {
    const decoded = decodeCursor(after);
    const expectedSig = buildOrderSignature(specs);
    if (decoded.orderSig !== expectedSig) {
      throw new Error(
        'executeCursor: cursor ORDER BY signature does not match the current query. ' +
        'The ORDER BY clause must remain the same between paginated requests.'
      );
    }
    const predicate = buildKeysetPredicate(specs, decoded.keys, 'after');
    cursorBuilder = cursorBuilder.where(predicate);
  }

  // --- Fetch limit + 1 to detect hasNextPage ---
  const rows = await cursorBuilder.limit(limit + 1).execute(session);

  const hasNextPage = rows.length > limit;
  if (hasNextPage) {
    rows.pop();
  }

  const hasPreviousPage = after != null;

  const items = rows as (T & Record<string, unknown>)[];

  const startCursor = items.length > 0
    ? buildCursorFromRow(items[0] as Record<string, unknown>, specs)
    : null;
  const endCursor = items.length > 0
    ? buildCursorFromRow(items[items.length - 1] as Record<string, unknown>, specs)
    : null;

  return {
    items,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor,
      endCursor
    }
  };
}
