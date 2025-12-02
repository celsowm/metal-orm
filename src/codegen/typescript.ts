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
  FunctionNode
} from '../ast/expression';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const isRelationAlias = (alias?: string) => alias ? alias.includes('__') : false;

type ExpressionPrinter = (expr: ExpressionNode) => string;
type OperandPrinter = (node: OperandNode) => string;

export class TypeScriptGenerator {
  private readonly expressionPrinters: Partial<Record<ExpressionNode['type'], ExpressionPrinter>>;
  private readonly operandPrinters: Partial<Record<OperandNode['type'], OperandPrinter>>;

  constructor() {
    this.expressionPrinters = {
      BinaryExpression: expr => this.printBinaryExpression(expr as BinaryExpressionNode),
      LogicalExpression: expr => this.printLogicalExpression(expr as LogicalExpressionNode),
      InExpression: expr => this.printInExpression(expr as InExpressionNode),
      NullExpression: expr => this.printNullExpression(expr as NullExpressionNode),
      BetweenExpression: expr => this.printBetweenExpression(expr as BetweenExpressionNode),
      ExistsExpression: expr => this.printExistsExpression(expr as ExistsExpressionNode)
    };

    this.operandPrinters = {
      Column: node => this.printColumnOperand(node as ColumnNode),
      Literal: node => this.printLiteralOperand(node as LiteralNode),
      Function: node => this.printFunctionOperand(node as FunctionNode),
      JsonPath: node => this.printJsonPathOperand(node as JsonPathNode),
      ScalarSubquery: node => this.printScalarSubqueryOperand(node as ScalarSubqueryNode),
      CaseExpression: node => this.printCaseExpressionOperand(node as CaseExpressionNode),
      WindowFunction: node => this.printWindowFunctionOperand(node as WindowFunctionNode)
    };
  }

  generate(ast: SelectQueryNode): string {
    const chainLines = this.buildSelectLines(ast);
    const lines = chainLines.map((line, index) => (index === 0 ? `const query = ${line}` : line));
    lines.push(';', '', 'await query.execute();');
    return lines.join('\n');
  }

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

  private printExpression(expr: ExpressionNode): string {
    const printer = this.expressionPrinters[expr.type];
    return printer ? printer(expr) : '';
  }

  private printOperand(node: OperandNode): string {
    const printer = this.operandPrinters[node.type];
    return printer ? printer(node) : '';
  }

  private printBinaryExpression(binary: BinaryExpressionNode): string {
    const left = this.printOperand(binary.left);
    const right = this.printOperand(binary.right);
    const base = `${left} ${binary.operator} ${right}`;
    if (binary.escape) {
      const escapeOperand = this.printOperand(binary.escape);
      return `${base} ESCAPE ${escapeOperand}`;
    }
    return base;
  }

  private printLogicalExpression(logical: LogicalExpressionNode): string {
    if (logical.operands.length === 0) return '';
    const parts = logical.operands.map(op => {
      const compiled = this.printExpression(op);
      return op.type === 'LogicalExpression' ? `(${compiled})` : compiled;
    });
    return `${this.mapOp(logical.operator)}(\n    ${parts.join(',\n    ')}\n  )`;
  }

  private printInExpression(inExpr: InExpressionNode): string {
    const left = this.printOperand(inExpr.left);
    const values = inExpr.right.map(v => this.printOperand(v)).join(', ');
    return `${left} ${inExpr.operator} (${values})`;
  }

  private printNullExpression(nullExpr: NullExpressionNode): string {
    const left = this.printOperand(nullExpr.left);
    return `${left} ${nullExpr.operator}`;
  }

  private printBetweenExpression(betweenExpr: BetweenExpressionNode): string {
    const left = this.printOperand(betweenExpr.left);
    const lower = this.printOperand(betweenExpr.lower);
    const upper = this.printOperand(betweenExpr.upper);
    return `${this.mapOp(betweenExpr.operator)}(${left}, ${lower}, ${upper})`;
  }

  private printExistsExpression(existsExpr: ExistsExpressionNode): string {
    const subquery = this.inlineChain(this.buildSelectLines(existsExpr.subquery));
    return `${this.mapOp(existsExpr.operator)}(${subquery})`;
  }

  private printColumnOperand(column: ColumnNode): string {
    return `${capitalize(column.table)}.${column.name}`;
  }

  private printLiteralOperand(literal: LiteralNode): string {
    if (literal.value === null) return 'null';
    return typeof literal.value === 'string' ? `'${literal.value}'` : String(literal.value);
  }

  private printFunctionOperand(fn: FunctionNode): string {
    const args = fn.args.map(a => this.printOperand(a)).join(', ');
    return `${fn.name.toLowerCase()}(${args})`;
  }

  private printJsonPathOperand(json: JsonPathNode): string {
    return `jsonPath(${capitalize(json.column.table)}.${json.column.name}, '${json.path}')`;
  }

  private printScalarSubqueryOperand(node: ScalarSubqueryNode): string {
    const subquery = this.inlineChain(this.buildSelectLines(node.query));
    return `(${subquery})`;
  }

  private printCaseExpressionOperand(node: CaseExpressionNode): string {
    const clauses = node.conditions.map(
      condition =>
        `{ when: ${this.printExpression(condition.when)}, then: ${this.printOperand(condition.then)} }`
    );
    const elseValue = node.else ? `, ${this.printOperand(node.else)}` : '';
    return `caseWhen([${clauses.join(', ')}]${elseValue})`;
  }

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

  private inlineChain(lines: string[]): string {
    return lines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(' ');
  }

  private mapOp(op: string): string {
    switch (op) {
      case '=':
        return 'eq';
      case '>':
        return 'gt';
      case '<':
        return 'lt';
      case 'LIKE':
        return 'like';
      case 'NOT LIKE':
        return 'notLike';
      case 'IN':
        return 'inList';
      case 'NOT IN':
        return 'notInList';
      case 'IS NULL':
        return 'isNull';
      case 'IS NOT NULL':
        return 'isNotNull';
      case 'AND':
        return 'and';
      case 'OR':
        return 'or';
      case 'BETWEEN':
        return 'between';
      case 'NOT BETWEEN':
        return 'notBetween';
      case 'EXISTS':
        return 'exists';
      case 'NOT EXISTS':
        return 'notExists';
      default:
        return 'eq';
    }
  }
}
