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
import { SelectQueryState } from '../select-query-state.js';
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
  valueKey: string;
  direction: 'ASC' | 'DESC';
}

interface EncodedCursor {
  v: 2;
  values: unknown[];
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
    (parsed as EncodedCursor).v !== 2 ||
    !Array.isArray((parsed as EncodedCursor).values) ||
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
    if (ob.nulls) {
      throw new Error('executeCursor: NULLS FIRST/LAST is not supported for cursor pagination');
    }
    const term = ob.term;
    if (!term || (term as ColumnNode).type !== 'Column') {
      throw new Error(
        'executeCursor: only column references are supported in ORDER BY for cursor pagination'
      );
    }
    const col = term as ColumnNode;
    return {
      table: col.table,
      column: col.name,
      valueKey: resolveOrderValueKey(ast, col),
      direction: ob.direction
    };
  });
}

function resolveOrderValueKey(ast: SelectQueryNode, col: ColumnNode): string {
  const projectedColumn = ast.columns.find((candidate): candidate is ColumnNode =>
    candidate.type === 'Column' &&
    candidate.table === col.table &&
    candidate.name === col.name
  );

  return projectedColumn?.alias ?? projectedColumn?.name ?? col.alias ?? col.name;
}

export function buildKeysetPredicate(
  specs: CursorOrderSpec[],
  values: unknown[],
  mode: 'after' | 'before'
): ExpressionNode {
  if (values.length !== specs.length) {
    throw new Error('executeCursor: invalid cursor payload');
  }

  // For a multi-column keyset (c1 DESC, c2 DESC) with mode='after':
  //   (c1 < v1) OR (c1 = v1 AND c2 < v2)
  // 'after' on DESC → use '<'; 'after' on ASC → use '>'
  // 'before' inverts the operators.

  const branches: ExpressionNode[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const colNode: ColumnNode = { type: 'Column', table: spec.table, name: spec.column };
    const value = values[i];
    if (value === null || value === undefined) {
      throw new Error('executeCursor: invalid cursor payload');
    }
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
      const prevValue = values[j];
      if (prevValue === null || prevValue === undefined) {
        throw new Error('executeCursor: invalid cursor payload');
      }
      const prevVal: LiteralNode = { type: 'Literal', value: prevValue as LiteralNode['value'] };
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
  const values = specs.map(spec => {
    const value = row[spec.valueKey];
    if (value === null || value === undefined) {
      throw new Error('executeCursor: cursor pagination requires non-null ORDER BY values');
    }
    return value;
  });
  return encodeCursor({ v: 2, values, orderSig: buildOrderSignature(specs) });
}

function reverseDirection(direction: 'ASC' | 'DESC'): 'ASC' | 'DESC' {
  return direction === 'ASC' ? 'DESC' : 'ASC';
}

function createExecutionBuilder<T, TTable extends TableDef>(
  builder: SelectQueryBuilder<T, TTable>,
  options: {
    predicate?: ExpressionNode;
    limit: number;
    reverseOrder: boolean;
  }
): SelectQueryBuilder<T, TTable> {
  const internals = builder.getInternals();
  const baseAst = internals.context.state.ast;

  const orderBy = options.reverseOrder && baseAst.orderBy
    ? baseAst.orderBy.map(order => ({
      ...order,
      direction: reverseDirection(order.direction)
    }))
    : baseAst.orderBy;

  const nextAst: SelectQueryNode = {
    ...baseAst,
    where: options.predicate
      ? (baseAst.where ? and(baseAst.where, options.predicate) : options.predicate)
      : baseAst.where,
    orderBy,
    limit: options.limit
  };

  const nextContext = {
    ...internals.context,
    state: new SelectQueryState(builder.getTable(), nextAst)
  };

  return internals.clone(nextContext, internals.includeTree);
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
  const limit = first ?? last!;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`executeCursor: "${first != null ? 'first' : 'last'}" must be an integer >= 1`);
  }
  const isBackward = last != null;
  const cursor = after ?? before;

  // --- Extract order specs from builder AST ---
  const ast = builder.getInternals().context.state.ast;
  const specs = extractOrderSpecs(ast);

  // --- Apply cursor predicate if present ---
  let predicate: ExpressionNode | undefined;
  if (cursor) {
    const decoded = decodeCursor(cursor);
    const expectedSig = buildOrderSignature(specs);
    if (decoded.orderSig !== expectedSig) {
      throw new Error(
        'executeCursor: cursor ORDER BY signature does not match the current query. ' +
        'The ORDER BY clause must remain the same between paginated requests.'
      );
    }
    predicate = buildKeysetPredicate(specs, decoded.values, isBackward ? 'before' : 'after');
  }

  // --- Fetch limit + 1 to detect hasNextPage ---
  const executionBuilder = createExecutionBuilder(builder, {
    predicate,
    limit: limit + 1,
    reverseOrder: isBackward
  });
  const rows = await executionBuilder.execute(session);

  const hasExtraItem = rows.length > limit;
  if (hasExtraItem) {
    rows.pop();
  }

  const orderedRows = isBackward ? rows.reverse() : rows;
  const items = orderedRows as (T & Record<string, unknown>)[];
  const hasItems = items.length > 0;
  const hasNextPage = hasItems
    ? (isBackward ? before != null : hasExtraItem)
    : false;
  const hasPreviousPage = hasItems
    ? (isBackward ? hasExtraItem : after != null)
    : false;

  const startCursor = hasItems
    ? buildCursorFromRow(items[0] as Record<string, unknown>, specs)
    : null;
  const endCursor = hasItems
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
