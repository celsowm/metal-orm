import type { TableDef } from '../schema/table.js';
import {
  isOperandNode,
  type ExpressionNode,
  type OperandNode,
  type ColumnNode,
  type FunctionNode,
  type JsonPathNode,
  type CaseExpressionNode,
  type CastExpressionNode,
  type WindowFunctionNode,
  type ArithmeticExpressionNode,
  type BitwiseExpressionNode,
  type CollateExpressionNode
} from '../core/ast/expression.js';
import type { TableSourceNode, OrderByNode, OrderingTerm } from '../core/ast/query.js';
import type { ColumnSchemaOptions, JsonSchemaProperty, OpenApiParameter } from './schema-types.js';
import { mapColumnType } from './type-mappers.js';

const FILTER_PARAM_NAME = 'filter';

const buildRootTableNames = (table: TableDef, from?: TableSourceNode): Set<string> => {
  const names = new Set<string>([table.name]);
  if (from?.type === 'Table') {
    names.add(from.name);
    if (from.alias) names.add(from.alias);
  }
  return names;
};

const collectFilterColumns = (
  expr: ExpressionNode,
  table: TableDef,
  rootTables: Set<string>
): Set<string> => {
  const columns = new Set<string>();

  const recordColumn = (node: ColumnNode): void => {
    if (!rootTables.has(node.table)) return;
    if (node.name in table.columns) {
      columns.add(node.name);
    }
  };

  const visitOrderingTerm = (term: OrderingTerm): void => {
    if (!term || typeof term !== 'object') return;
    if (isOperandNode(term)) {
      visitOperand(term as OperandNode);
      return;
    }
    if ('type' in term) {
      visitExpression(term as ExpressionNode);
    }
  };

  const visitOrderBy = (orderBy: OrderByNode[] | undefined): void => {
    if (!orderBy) return;
    orderBy.forEach(node => visitOrderingTerm(node.term));
  };

  const visitOperand = (node: OperandNode): void => {
    switch (node.type) {
      case 'Column':
        recordColumn(node as ColumnNode);
        return;
      case 'Function': {
        const fn = node as FunctionNode;
        fn.args?.forEach(visitOperand);
        visitOrderBy(fn.orderBy);
        if (fn.separator) visitOperand(fn.separator);
        return;
      }
      case 'JsonPath': {
        const jp = node as JsonPathNode;
        recordColumn(jp.column);
        return;
      }
      case 'ScalarSubquery':
        return;
      case 'CaseExpression': {
        const cs = node as CaseExpressionNode;
        cs.conditions.forEach(condition => {
          visitExpression(condition.when);
          visitOperand(condition.then);
        });
        if (cs.else) visitOperand(cs.else);
        return;
      }
      case 'Cast': {
        const cast = node as CastExpressionNode;
        visitOperand(cast.expression);
        return;
      }
      case 'WindowFunction': {
        const windowFn = node as WindowFunctionNode;
        windowFn.args?.forEach(visitOperand);
        windowFn.partitionBy?.forEach(recordColumn);
        visitOrderBy(windowFn.orderBy);
        return;
      }
      case 'ArithmeticExpression': {
        const arith = node as ArithmeticExpressionNode;
        visitOperand(arith.left);
        visitOperand(arith.right);
        return;
      }
      case 'BitwiseExpression': {
        const bitwise = node as BitwiseExpressionNode;
        visitOperand(bitwise.left);
        visitOperand(bitwise.right);
        return;
      }
      case 'Collate': {
        const collate = node as CollateExpressionNode;
        visitOperand(collate.expression);
        return;
      }
      case 'AliasRef':
      case 'Literal':
      case 'Param':
        return;
      default:
        return;
    }
  };

  const visitExpression = (node: ExpressionNode): void => {
    switch (node.type) {
      case 'BinaryExpression':
        visitOperand(node.left);
        visitOperand(node.right);
        if (node.escape) visitOperand(node.escape);
        return;
      case 'LogicalExpression':
        node.operands.forEach(visitExpression);
        return;
      case 'NullExpression':
        visitOperand(node.left);
        return;
      case 'InExpression':
        visitOperand(node.left);
        if (Array.isArray(node.right)) {
          node.right.forEach(visitOperand);
        }
        return;
      case 'ExistsExpression':
        return;
      case 'BetweenExpression':
        visitOperand(node.left);
        visitOperand(node.lower);
        visitOperand(node.upper);
        return;
      case 'ArithmeticExpression':
        visitOperand(node.left);
        visitOperand(node.right);
        return;
      case 'BitwiseExpression':
        visitOperand(node.left);
        visitOperand(node.right);
        return;
      default:
        return;
    }
  };

  visitExpression(expr);
  return columns;
};

export const buildFilterParameters = (
  table: TableDef,
  where: ExpressionNode | undefined,
  from: TableSourceNode | undefined,
  options: ColumnSchemaOptions = {}
): OpenApiParameter[] => {
  if (!where) return [];

  const rootTables = buildRootTableNames(table, from);
  const columnNames = collectFilterColumns(where, table, rootTables);

  let schema: JsonSchemaProperty;
  if (columnNames.size) {
    const properties: Record<string, JsonSchemaProperty> = {};
    for (const name of columnNames) {
      const column = table.columns[name];
      if (!column) continue;
      properties[name] = mapColumnType(column, options);
    }
    schema = {
      type: 'object',
      properties
    };
  } else {
    schema = {
      type: 'object',
      additionalProperties: true
    };
  }

  return [{
    name: FILTER_PARAM_NAME,
    in: 'query',
    style: 'deepObject',
    explode: true,
    schema
  }];
};
