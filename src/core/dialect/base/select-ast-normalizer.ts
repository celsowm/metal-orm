import type {
  CommonTableExpressionNode,
  SelectQueryNode,
  SetOperationKind
} from '../../ast/query.js';

export type SetOperationSupport = (kind: SetOperationKind) => boolean;

/**
 * Normalizes compound SELECT ASTs independently from SQL rendering.
 *
 * Responsibilities are intentionally limited to set-operation validation and
 * CTE hoisting, so dialect SQL compilers consume one stable normalized shape.
 */
export class SelectAstNormalizer {
  constructor(private readonly supportsSetOperation: SetOperationSupport) {}

  normalize(ast: SelectQueryNode): SelectQueryNode {
    this.validateSetOperations(ast, true);
    const { normalized, hoistedCtes } = this.hoistCtes(ast);
    const combinedCtes = [...(normalized.ctes ?? []), ...hoistedCtes];
    return combinedCtes.length ? { ...normalized, ctes: combinedCtes } : normalized;
  }

  private validateSetOperations(ast: SelectQueryNode, isOutermost: boolean): void {
    const hasSetOps = !!(ast.setOps && ast.setOps.length);
    if (!isOutermost && (ast.orderBy || ast.limit !== undefined || ast.offset !== undefined)) {
      throw new Error('ORDER BY / LIMIT / OFFSET are only allowed on the outermost compound query.');
    }

    if (!hasSetOps) return;

    for (const op of ast.setOps!) {
      if (!this.supportsSetOperation(op.operator)) {
        throw new Error(`Set operation ${op.operator} is not supported by this dialect.`);
      }
      this.validateSetOperations(op.query, false);
    }
  }

  private hoistCtes(ast: SelectQueryNode): {
    normalized: SelectQueryNode;
    hoistedCtes: CommonTableExpressionNode[];
  } {
    let hoisted: CommonTableExpressionNode[] = [];

    const normalizedSetOps = ast.setOps?.map(op => {
      const { normalized: child, hoistedCtes: childHoisted } = this.hoistCtes(op.query);
      const childCtes = child.ctes ?? [];
      if (childCtes.length) hoisted = hoisted.concat(childCtes);
      hoisted = hoisted.concat(childHoisted);
      const queryWithoutCtes = childCtes.length ? { ...child, ctes: undefined } : child;
      return { ...op, query: queryWithoutCtes };
    });

    const normalized: SelectQueryNode = normalizedSetOps
      ? { ...ast, setOps: normalizedSetOps }
      : ast;
    return { normalized, hoistedCtes: hoisted };
  }
}
