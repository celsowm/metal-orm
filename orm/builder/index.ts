import { TableDef } from '../schema';
import { SelectQueryNode, ColumnNode, BinaryExpressionNode, LogicalExpressionNode } from '../ast';
import { Dialect } from '../dialect';

// Tipos Avançados para o Query Builder

type ColumnName<T extends TableDef<any>> = keyof T['columns'];
type QualifiedColumnName<T extends TableDef<any>> = `${T['name']}.${ColumnName<T> & string}`;

type InferColumnTypeFromQualifiedName<
    T extends TableDef<any>,
    K extends QualifiedColumnName<T>
> = K extends `${T['name']}.${infer CName}`
    ? CName extends keyof T['$'] ? T['$'][CName] : never
    : never;

type InferReturnType<T extends TableDef<any>, TCols extends ReadonlyArray<QualifiedColumnName<T>>> = {
    [K in TCols[number] as K extends `${T['name']}.${infer CName}` ? CName : never]: InferColumnTypeFromQualifiedName<T, K>;
};

// Tipos de Operadores Condicionais
type CommonOps = '=' | '!='; // Corrigido de '!= F' para '!='
type NumericOps = '<' | '<=' | '>' | '>=';
type TextOps = 'LIKE' | 'NOT LIKE';
type ArrayOps = 'IN' | 'NOT IN';

type ComparisonOperatorFor<T> =
    T extends number | null ? CommonOps | NumericOps | ArrayOps :
    T extends string | null ? CommonOps | TextOps | ArrayOps :
    CommonOps | ArrayOps;

type WhereValue<TCol, TOp> =
    TOp extends ArrayOps
    ? readonly TCol[]
    : TCol;

export class QueryBuilder<TTable extends TableDef<any>, TReturn = TTable['$']> {
    #tableDef: TTable;
    #ast: SelectQueryNode;

    constructor(table: TTable, ast?: SelectQueryNode) {
        this.#tableDef = table;
        this.#ast = ast || {
            type: 'SelectQuery',
            from: { type: 'Table', name: table.name },
            columns: [],
            joins: [],
        };
    }

    select<TCols extends ReadonlyArray<QualifiedColumnName<TTable>>>(
        ...cols: TCols
    ): QueryBuilder<TTable, InferReturnType<TTable, TCols>> {
        const newCols = cols.map(c => {
            const [table, name] = c.split('.');
            return { type: 'Column', table, name } as ColumnNode;
        });

        return new QueryBuilder(this.#tableDef, {
            ...this.#ast,
            columns: newCols,
        });
    }

    where<
        TCol extends ColumnName<TTable> & string,
        TOp extends ComparisonOperatorFor<TTable['$'][TCol]>,
        TVal extends WhereValue<TTable['$'][TCol], TOp>
    >(
        column: TCol,
        op: TOp,
        value: TVal
    ): QueryBuilder<TTable, TReturn> { // Retorna nova instância
        const expr: BinaryExpressionNode = {
            type: 'BinaryExpression',
            left: { type: 'Column', table: this.#tableDef.name, name: column },
            operator: op,
            right: { type: 'Literal', value: value as any },
        };

        const newAst = { ...this.#ast };
        if (newAst.where) {
            newAst.where = {
                type: 'LogicalExpression',
                operator: 'AND',
                left: newAst.where,
                right: expr,
            } as LogicalExpressionNode;
        } else {
            newAst.where = expr;
        }

        return new QueryBuilder(this.#tableDef, newAst);
    }

    innerJoin(
        tableDef: TableDef<any>,
        on: BinaryExpressionNode
    ): QueryBuilder<TTable, TReturn> {
        return new QueryBuilder(this.#tableDef, {
            ...this.#ast,
            joins: [
                ...this.#ast.joins,
                {
                    type: 'Join',
                    kind: 'INNER',
                    table: { type: 'Table', name: tableDef.name },
                    condition: on,
                },
            ],
        });
    }

    limit(n: number): QueryBuilder<TTable, TReturn> {
        return new QueryBuilder(this.#tableDef, { ...this.#ast, limit: n });
    }

    offset(n: number): QueryBuilder<TTable, TReturn> {
        return new QueryBuilder(this.#tableDef, { ...this.#ast, offset: n });
    }

    toSql(dialect: Dialect): string {
        if (this.#ast.columns.length === 0) {
            const allColumns = Object.keys(this.#tableDef.columns).map(
                name => ({
                    type: 'Column',
                    table: this.#ast.from.name,
                    name,
                } as ColumnNode)
            );
            return dialect.compile({ ...this.#ast, columns: allColumns });
        }
        return dialect.compile(this.#ast);
    }

    getAST() {
        return this.#ast;
    }

    async *execute(
        _dialect: Dialect
    ): AsyncGenerator<TReturn, void, unknown> {
        const sql = this.toSql(_dialect);
        console.log('Executing:', sql);
        // Mock data
        yield { id: 1, name: 'Alice', role: 'admin' } as any;
        yield { id: 2, name: 'Bob', role: 'user' } as any;
    }
}