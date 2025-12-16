import { SelectQueryNode, UpdateQueryNode, DeleteQueryNode, TableSourceNode } from '../core/ast/query.js';
import { TableDef } from '../schema/table.js';
import type { SelectQueryBuilder } from './select.js';
import type { UpdateQueryBuilder } from './update.js';
import type { DeleteQueryBuilder } from './delete.js';

/**
 * Resolves a SelectQueryBuilder or SelectQueryNode to a SelectQueryNode AST
 * @param query - Query builder or AST node
 * @returns SelectQueryNode AST
 */
export function resolveSelectQuery<TSub extends TableDef>(
    query: SelectQueryBuilder<unknown, TSub> | SelectQueryNode
): SelectQueryNode {
    const candidate = query as { getAST?: () => SelectQueryNode };
    return typeof candidate.getAST === 'function' && candidate.getAST
        ? candidate.getAST()
        : (query as SelectQueryNode);
}

/**
 * Resolves a UpdateQueryBuilder or UpdateQueryNode to a UpdateQueryNode AST
 * @param query - Query builder or AST node
 * @returns UpdateQueryNode AST
 */
export function resolveUpdateQuery<T>(
    query: UpdateQueryBuilder<T> | UpdateQueryNode
): UpdateQueryNode {
    const candidate = query as { getAST?: () => UpdateQueryNode };
    return typeof candidate.getAST === 'function' && candidate.getAST
        ? candidate.getAST()
        : (query as UpdateQueryNode);
}

/**
 * Resolves a DeleteQueryBuilder or DeleteQueryNode to a DeleteQueryNode AST
 * @param query - Query builder or AST node
 * @returns DeleteQueryNode AST
 */
export function resolveDeleteQuery<T>(
    query: DeleteQueryBuilder<T> | DeleteQueryNode
): DeleteQueryNode {
    const candidate = query as { getAST?: () => DeleteQueryNode };
    return typeof candidate.getAST === 'function' && candidate.getAST
        ? candidate.getAST()
        : (query as DeleteQueryNode);
}

/**
 * Resolves a TableDef or TableSourceNode to a TableSourceNode
 * @param source - Table definition or source node
 * @returns TableSourceNode
 */
export function resolveTableSource(source: TableDef | TableSourceNode): TableSourceNode {
    if (isTableSourceNode(source)) {
        return source;
    }
    return { type: 'Table', name: source.name, schema: source.schema };
}

/**
 * Resolves a join target (TableDef, TableSourceNode, or string relation name)
 * @param table - Join target
 * @returns TableSourceNode or string
 */
export function resolveJoinTarget(table: TableDef | TableSourceNode | string): TableSourceNode | string {
    if (typeof table === 'string') return table;
    return resolveTableSource(table);
}

/**
 * Type guard to check if a value is a TableSourceNode
 * @param source - Value to check
 * @returns True if value is a TableSourceNode
 */
function isTableSourceNode(source: TableDef | TableSourceNode): source is TableSourceNode {
    return typeof (source as TableSourceNode).type === 'string';
}
