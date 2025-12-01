export interface TableNode {
    type: 'Table';
    name: string;
    schema?: string;
}

export interface ColumnNode {
    type: 'Column';
    table: string;
    name: string;
}

export interface LiteralNode {
    type: 'Literal';
    value: string | number | boolean;
}

export interface BinaryExpressionNode {
    type: 'BinaryExpression';
    left: ColumnNode | LiteralNode;
    operator: string;
    right: ColumnNode | LiteralNode;
}

export interface LogicalExpressionNode {
    type: 'LogicalExpression';
    operator: 'AND' | 'OR';
    left: BinaryExpressionNode | LogicalExpressionNode;
    right: BinaryExpressionNode | LogicalExpressionNode;
}

export interface JoinNode {
    type: 'Join';
    table: TableNode;
    condition: BinaryExpressionNode;
    kind: 'INNER' | 'LEFT';
}

export interface SelectQueryNode {
    type: 'SelectQuery';
    from: TableNode;
    columns: ColumnNode[];
    joins: JoinNode[];
    where?: ExpressionNode;
    limit?: number;
    offset?: number;
}

export type ExpressionNode = BinaryExpressionNode | LogicalExpressionNode;
