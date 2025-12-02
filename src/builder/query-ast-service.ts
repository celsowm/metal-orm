import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { SelectQueryNode, CommonTableExpressionNode } from '../ast/query';
import {
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  CaseExpressionNode,
  WindowFunctionNode,
  ScalarSubqueryNode,
  and
} from '../ast/expression';
import { JoinNode } from '../ast/join';
import { SelectQueryState, ProjectionNode } from './select-query-state';

export const buildColumnNode = (table: TableDef, col: ColumnDef | ColumnNode): ColumnNode => {
  if ((col as ColumnNode).type === 'Column') {
    return col as ColumnNode;
  }

  const def = col as ColumnDef;
  return {
    type: 'Column',
    table: def.table || table.name,
    name: def.name
  };
};

export interface ColumnSelectionResult {
  state: SelectQueryState;
  addedColumns: ProjectionNode[];
}

export class QueryAstService {
  constructor(private readonly table: TableDef, private readonly state: SelectQueryState) {}

  select(
    columns: Record<string, ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode>
  ): ColumnSelectionResult {
    const existingAliases = new Set(
      this.state.ast.columns.map(c => (c as ColumnNode).alias || (c as ColumnNode).name)
    );

    const newCols = Object.entries(columns).reduce<ProjectionNode[]>((acc, [alias, val]) => {
      if (existingAliases.has(alias)) return acc;

      if (
        (val as any).type === 'Function' ||
        (val as any).type === 'CaseExpression' ||
        (val as any).type === 'WindowFunction'
      ) {
        acc.push({ ...(val as FunctionNode | CaseExpressionNode | WindowFunctionNode), alias } as ProjectionNode);
        return acc;
      }

      const colDef = val as ColumnDef;
      acc.push({
        type: 'Column',
        table: colDef.table || this.table.name,
        name: colDef.name,
        alias
      } as ColumnNode);
      return acc;
    }, []);

    const nextState = this.state.withColumns(newCols);
    return { state: nextState, addedColumns: newCols };
  }

  selectRaw(cols: string[]): ColumnSelectionResult {
    const newCols = cols.map(c => this.parseRawColumn(c));
    const nextState = this.state.withColumns(newCols);
    return { state: nextState, addedColumns: newCols };
  }

  withCte(name: string, query: SelectQueryNode, columns?: string[], recursive = false): SelectQueryState {
    const cte: CommonTableExpressionNode = {
      type: 'CommonTableExpression',
      name,
      query,
      columns,
      recursive
    };

    return this.state.withCte(cte);
  }

  selectSubquery(alias: string, query: SelectQueryNode): SelectQueryState {
    const node: ScalarSubqueryNode = { type: 'ScalarSubquery', query, alias };
    return this.state.withColumns([node]);
  }

  withJoin(join: JoinNode): SelectQueryState {
    return this.state.withJoin(join);
  }

  withWhere(expr: ExpressionNode): SelectQueryState {
    const combined = this.combineExpressions(this.state.ast.where, expr);
    return this.state.withWhere(combined);
  }

  withGroupBy(col: ColumnDef | ColumnNode): SelectQueryState {
    const node = buildColumnNode(this.table, col);
    return this.state.withGroupBy([node]);
  }

  withHaving(expr: ExpressionNode): SelectQueryState {
    const combined = this.combineExpressions(this.state.ast.having, expr);
    return this.state.withHaving(combined);
  }

  withOrderBy(col: ColumnDef | ColumnNode, direction: 'ASC' | 'DESC'): SelectQueryState {
    const node = buildColumnNode(this.table, col);
    return this.state.withOrderBy([{ type: 'OrderBy', column: node, direction }]);
  }

  withDistinct(cols: ColumnNode[]): SelectQueryState {
    return this.state.withDistinct(cols);
  }

  withLimit(limit: number): SelectQueryState {
    return this.state.withLimit(limit);
  }

  withOffset(offset: number): SelectQueryState {
    return this.state.withOffset(offset);
  }

  private combineExpressions(existing: ExpressionNode | undefined, next: ExpressionNode): ExpressionNode {
    return existing ? and(existing, next) : next;
  }

  private parseRawColumn(col: string): ColumnNode {
    if (col.includes('(')) {
      const [fn, rest] = col.split('(');
      const colName = rest.replace(')', '');
      const [table, name] = colName.includes('.') ? colName.split('.') : [this.table.name, colName];
      return { type: 'Column', table, name, alias: col };
    }

    if (col.includes('.')) {
      const [potentialCteName, columnName] = col.split('.');
      const hasCte = this.state.ast.ctes && this.state.ast.ctes.some(cte => cte.name === potentialCteName);

      if (hasCte) {
        return { type: 'Column', table: this.table.name, name: col };
      }

      return { type: 'Column', table: potentialCteName, name: columnName };
    }

    return { type: 'Column', table: this.table.name, name: col };
  }
}
