import { SelectQueryNode } from '../ast/query';
import {
  ExpressionNode,
  OperandNode,
  BinaryExpressionNode,
  LogicalExpressionNode,
  InExpressionNode,
  NullExpressionNode,
  JsonPathNode,
  ExistsExpressionNode,
  BetweenExpressionNode,
  ScalarSubqueryNode,
  CaseExpressionNode,
  WindowFunctionNode,
  ColumnNode,
  LiteralNode,
  FunctionNode,
  ExpressionVisitor,
  OperandVisitor,
  visitExpression,
  visitOperand
} from '../ast/expression';
import { SQL_OPERATOR_REGISTRY } from '../constants/sql-operator-config';
import { SqlOperator } from '../constants/sql';
import { isRelationAlias } from '../utils/relation-alias';

/**
 * Capitalizes the first letter of a string
 * @param s - String to capitalize
 * @returns Capitalized string
 */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const assertNever = (value: never): never => {
  throw new Error(`Unhandled SQL operator: ${value}`);
};

/**
 * Generates TypeScript code from query AST nodes
 */
export class TypeScriptGenerator implements ExpressionVisitor<string>, OperandVisitor<string> {

  /**
   * Generates TypeScript code from a query AST
   * @param ast - Query AST to generate code from
   * @returns Generated TypeScript code
   */
  generate(ast: SelectQueryNode): string {
    const chainLines = this.buildSelectLines(ast);
    const lines = chainLines.map((line, index) => (index === 0 ? `const query = ${line}` : line));
    lines.push(';', '', 'await query.execute();');
    return lines.join('\n');
  }

  /**
   * Builds TypeScript method chain lines from query AST
   * @param ast - Query AST
   * @returns Array of TypeScript method chain lines
   */
  private buildSelectLines(ast: SelectQueryNode): string[] {
    const lines: string[] = [];
    const hydration = ast.meta?.hydration;
    const hydratedRelations = new Set(hydration?.relations?.map(r => r.name) ?? []);

    const selections = ast.columns
      .filter(col => !(hydration && isRelationAlias((col as any).alias)))
      .map(col => {
        const key = (col as any).alias || (col as any).name;
        const operand = col as OperandNode;
        return `${key}: ${this.printOperand(operand)}`;
      });

    lines.push(`db.select({`);
    selections.forEach((sel, index) => {
      lines.push(`  ${sel}${index < selections.length - 1 ? ',' : ''}`);
    });
    lines.push(`})`);
    lines.push(`.from(${capitalize(ast.from.name)})`);

    if (ast.distinct && ast.distinct.length) {
      const cols = ast.distinct.map(c => `${capitalize(c.table)}.${c.name}`).join(', ');
      lines.push(`.distinct(${cols})`);
    }

    ast.joins.forEach(join => {
      if (join.relationName && hydratedRelations.has(join.relationName)) {
        return;
      }

      if (join.relationName) {
        if (join.kind === 'INNER') {
          lines.push(`.joinRelation('${join.relationName}')`);
        } else {
          lines.push(`.joinRelation('${join.relationName}', '${join.kind}')`);
        }
      } else {
        const table = capitalize(join.table.name);
        const cond = this.printExpression(join.condition);
        let method = 'innerJoin';
        if (join.kind === 'LEFT') method = 'leftJoin';
        if (join.kind === 'RIGHT') method = 'rightJoin';
        lines.push(`.${method}(${table}, ${cond})`);
      }
    });

    if (hydration?.relations?.length) {
      hydration.relations.forEach(rel => {
        const options: string[] = [];
        if (rel.columns.length) options.push(`columns: [${rel.columns.map(c => `'${c}'`).join(', ')}]`);
        if (rel.aliasPrefix !== rel.name) options.push(`aliasPrefix: '${rel.aliasPrefix}'`);
        const opts = options.length ? `, { ${options.join(', ')} }` : '';
        lines.push(`.include('${rel.name}'${opts})`);
      });
    }

    if (ast.where) {
      lines.push(`.where(${this.printExpression(ast.where)})`);
    }

    if (ast.groupBy && ast.groupBy.length) {
      const cols = ast.groupBy.map(c => `${capitalize(c.table)}.${c.name}`).join(', ');
      lines.push(`.groupBy(${cols})`);
    }

    if (ast.having) {
      lines.push(`.having(${this.printExpression(ast.having)})`);
    }

    if (ast.orderBy && ast.orderBy.length) {
      ast.orderBy.forEach(o => {
        lines.push(`.orderBy(${capitalize(o.column.table)}.${o.column.name}, '${o.direction}')`);
      });
    }

    if (ast.limit) lines.push(`.limit(${ast.limit})`);
    if (ast.offset) lines.push(`.offset(${ast.offset})`);

    return lines;
  }

  /**
   * Prints an expression node to TypeScript code
   * @param expr - Expression node to print
   * @returns TypeScript code representation
   */
  private printExpression(expr: ExpressionNode): string {
    return visitExpression(expr, this);
  }

  /**
   * Prints an operand node to TypeScript code
   * @param node - Operand node to print
   * @returns TypeScript code representation
   */
  private printOperand(node: OperandNode): string {
    return visitOperand(node, this);
  }

  public visitBinaryExpression(binary: BinaryExpressionNode): string {
    return this.printBinaryExpression(binary);
  }

  public visitLogicalExpression(logical: LogicalExpressionNode): string {
    return this.printLogicalExpression(logical);
  }

  public visitNullExpression(nullExpr: NullExpressionNode): string {
    return this.printNullExpression(nullExpr);
  }

  public visitInExpression(inExpr: InExpressionNode): string {
    return this.printInExpression(inExpr);
  }

  public visitExistsExpression(existsExpr: ExistsExpressionNode): string {
    return this.printExistsExpression(existsExpr);
  }

  public visitBetweenExpression(betweenExpr: BetweenExpressionNode): string {
    return this.printBetweenExpression(betweenExpr);
  }

  public visitColumn(node: ColumnNode): string {
    return this.printColumnOperand(node);
  }

  public visitLiteral(node: LiteralNode): string {
    return this.printLiteralOperand(node);
  }

  public visitFunction(node: FunctionNode): string {
    return this.printFunctionOperand(node);
  }

  public visitJsonPath(node: JsonPathNode): string {
    return this.printJsonPathOperand(node);
  }

  public visitScalarSubquery(node: ScalarSubqueryNode): string {
    return this.printScalarSubqueryOperand(node);
  }

  public visitCaseExpression(node: CaseExpressionNode): string {
    return this.printCaseExpressionOperand(node);
  }

  public visitWindowFunction(node: WindowFunctionNode): string {
    return this.printWindowFunctionOperand(node);
  }

  /**
   * Prints a binary expression to TypeScript code
   * @param binary - Binary expression node
   * @returns TypeScript code representation
   */
  private printBinaryExpression(binary: BinaryExpressionNode): string {
    const left = this.printOperand(binary.left);
    const right = this.printOperand(binary.right);
    const fn = this.mapOp(binary.operator);
    const args = [left, right];
    if (binary.escape) {
      args.push(this.printOperand(binary.escape));
    }
    return `${fn}(${args.join(', ')})`;
  }

  /**
   * Prints a logical expression to TypeScript code
   * @param logical - Logical expression node
   * @returns TypeScript code representation
   */
  private printLogicalExpression(logical: LogicalExpressionNode): string {
    if (logical.operands.length === 0) return '';
    const parts = logical.operands.map(op => {
      const compiled = this.printExpression(op);
      return op.type === 'LogicalExpression' ? `(${compiled})` : compiled;
    });
    return `${this.mapOp(logical.operator)}(\n    ${parts.join(',\n    ')}\n  )`;
  }

  /**
   * Prints an IN expression to TypeScript code
   * @param inExpr - IN expression node
   * @returns TypeScript code representation
   */
  private printInExpression(inExpr: InExpressionNode): string {
    const left = this.printOperand(inExpr.left);
    const values = inExpr.right.map(v => this.printOperand(v)).join(', ');
    const fn = this.mapOp(inExpr.operator);
    return `${fn}(${left}, [${values}])`;
  }

  /**
   * Prints a null expression to TypeScript code
   * @param nullExpr - Null expression node
   * @returns TypeScript code representation
   */
  private printNullExpression(nullExpr: NullExpressionNode): string {
    const left = this.printOperand(nullExpr.left);
    const fn = this.mapOp(nullExpr.operator);
    return `${fn}(${left})`;
  }

  /**
   * Prints a BETWEEN expression to TypeScript code
   * @param betweenExpr - BETWEEN expression node
   * @returns TypeScript code representation
   */
  private printBetweenExpression(betweenExpr: BetweenExpressionNode): string {
    const left = this.printOperand(betweenExpr.left);
    const lower = this.printOperand(betweenExpr.lower);
    const upper = this.printOperand(betweenExpr.upper);
    return `${this.mapOp(betweenExpr.operator)}(${left}, ${lower}, ${upper})`;
  }

  /**
   * Prints an EXISTS expression to TypeScript code
   * @param existsExpr - EXISTS expression node
   * @returns TypeScript code representation
   */
  private printExistsExpression(existsExpr: ExistsExpressionNode): string {
    const subquery = this.inlineChain(this.buildSelectLines(existsExpr.subquery));
    return `${this.mapOp(existsExpr.operator)}(${subquery})`;
  }

  /**
   * Prints a column operand to TypeScript code
   * @param column - Column node
   * @returns TypeScript code representation
   */
  private printColumnOperand(column: ColumnNode): string {
    return `${capitalize(column.table)}.${column.name}`;
  }

  /**
   * Prints a literal operand to TypeScript code
   * @param literal - Literal node
   * @returns TypeScript code representation
   */
  private printLiteralOperand(literal: LiteralNode): string {
    if (literal.value === null) return 'null';
    return typeof literal.value === 'string' ? `'${literal.value}'` : String(literal.value);
  }

  /**
   * Prints a function operand to TypeScript code
   * @param fn - Function node
   * @returns TypeScript code representation
   */
  private printFunctionOperand(fn: FunctionNode): string {
    const args = fn.args.map(a => this.printOperand(a)).join(', ');
    return `${fn.name.toLowerCase()}(${args})`;
  }

  /**
   * Prints a JSON path operand to TypeScript code
   * @param json - JSON path node
   * @returns TypeScript code representation
   */
  private printJsonPathOperand(json: JsonPathNode): string {
    return `jsonPath(${capitalize(json.column.table)}.${json.column.name}, '${json.path}')`;
  }

  /**
   * Prints a scalar subquery operand to TypeScript code
   * @param node - Scalar subquery node
   * @returns TypeScript code representation
   */
  private printScalarSubqueryOperand(node: ScalarSubqueryNode): string {
    const subquery = this.inlineChain(this.buildSelectLines(node.query));
    return `(${subquery})`;
  }

  /**
   * Prints a CASE expression operand to TypeScript code
   * @param node - CASE expression node
   * @returns TypeScript code representation
   */
  private printCaseExpressionOperand(node: CaseExpressionNode): string {
    const clauses = node.conditions.map(
      condition =>
        `{ when: ${this.printExpression(condition.when)}, then: ${this.printOperand(condition.then)} }`
    );
    const elseValue = node.else ? `, ${this.printOperand(node.else)}` : '';
    return `caseWhen([${clauses.join(', ')}]${elseValue})`;
  }

  /**
   * Prints a window function operand to TypeScript code
   * @param node - Window function node
   * @returns TypeScript code representation
   */
  private printWindowFunctionOperand(node: WindowFunctionNode): string {
    let result = `${node.name}(`;
    if (node.args.length > 0) {
      result += node.args.map(arg => this.printOperand(arg)).join(', ');
    }
    result += ') OVER (';

    const parts: string[] = [];

    if (node.partitionBy && node.partitionBy.length > 0) {
      const partitionClause =
        'PARTITION BY ' + node.partitionBy.map(col => `${capitalize(col.table)}.${col.name}`).join(', ');
      parts.push(partitionClause);
    }

    if (node.orderBy && node.orderBy.length > 0) {
      const orderClause =
        'ORDER BY ' +
        node.orderBy.map(o => `${capitalize(o.column.table)}.${o.column.name} ${o.direction}`).join(', ');
      parts.push(orderClause);
    }

    result += parts.join(' ');
    result += ')';

    return result;
  }

  /**
   * Converts method chain lines to inline format
   * @param lines - Method chain lines
   * @returns Inline method chain string
   */
  private inlineChain(lines: string[]): string {
    return lines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(' ');
  }

  /**
   * Maps SQL operators to TypeScript function names
   * @param op - SQL operator
   * @returns TypeScript function name
   */
  private mapOp(op: SqlOperator): string {
    const config = SQL_OPERATOR_REGISTRY[op];
    if (!config) {
      return assertNever(op as never);
    }
    return config.tsName;
  }
}
