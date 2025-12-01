import { TableDef, TableDefInput } from '../schema';
import { SelectQueryNode, ColumnNode, BinaryExpressionNode } from '../ast';
import { Dialect } from '../dialect';

// Tipos Avançados para o Query Builder

// Extrai os nomes das colunas de uma TableDef
type ColumnName<T extends TableDef<any>> = keyof T['columns'];

// Gera os nomes das colunas no formato "tabela.coluna"
type QualifiedColumnName<T extends TableDef<any>> = `${T['name']}.${ColumnName<T> & string}`;

// Mapeia o nome qualificado da coluna de volta para o seu tipo
type InferColumnTypeFromQualifiedName<
    T extends TableDef<any>,
    K extends QualifiedColumnName<T>
> = K extends `${T['name']}.${infer CName}`
    ? CName extends keyof T['$']
        ? T['$'][CName]
        : never
    : never;

// Analisa uma tupla de nomes de colunas qualificadas e retorna um tipo de objeto
type InferReturnType<T extends TableDef<any>, TCols extends ReadonlyArray<QualifiedColumnName<T>>> = {
    [K in TCols[number] as K extends `${T['name']}.${infer CName}` ? CName : never]: InferColumnTypeFromQualifiedName<T, K>;
};

// Helper `eq` totalmente tipado
export const eq = <
    T extends TableDef<any>,
    TCol extends ColumnName<T> & string
>(
    table: T,
    column: TCol,
    value: T['$'][TCol]
): BinaryExpressionNode => {
    return {
        type: 'BinaryExpression',
        left: { type: 'Column', table: table.name, name: column },
        operator: '=',
        right: { type: 'Literal', value: value },
    };
};

export class QueryBuilder<TTable extends TableDef<any>, TReturn = TTable['$']> {
    // Mantém a definição completa da tabela, crucial para `toSql` e outros métodos
    private tableDef: TTable;
    private ast: SelectQueryNode;

    constructor(table: TTable, ast?: SelectQueryNode) {
        this.tableDef = table;

        if (ast) {
            this.ast = ast;
        } else {
            this.ast = {
                type: 'SelectQuery',
                from: { type: 'Table', name: table.name },
                columns: [],
                joins: [],
            };
        }
    }

    select<TCols extends ReadonlyArray<QualifiedColumnName<TTable>>>(
        ...cols: TCols
    ): QueryBuilder<TTable, InferReturnType<TTable, TCols>> {
        const newCols = cols.map(c => {
            const [table, name] = c.split('.');
            return { type: 'Column', table, name } as ColumnNode;
        });

        // Passa o `tableDef` para o novo construtor
        return new QueryBuilder(this.tableDef, {
            ...this.ast,
            columns: newCols,
        });
    }

    // A `where` clause totalmente tipada e ergonômica
    where<TCol extends ColumnName<TTable> & string>(
        column: TCol,
        op: '=', // Expandir para mais operadores no futuro
        value: TTable['$'][TCol]
    ): QueryBuilder<TTable, TReturn> {
        const expr: BinaryExpressionNode = {
            type: 'BinaryExpression',
            left: { type: 'Column', table: this.tableDef.name, name: column },
            operator: op,
            right: { type: 'Literal', value: value },
        };

        return new QueryBuilder(this.tableDef, {
            ...this.ast,
            where: expr,
        });
    }

    innerJoin(
        tableDef: TableDef<any>,
        on: BinaryExpressionNode
    ): QueryBuilder<TTable, TReturn> {
        return new QueryBuilder(this.tableDef, {
            ...this.ast,
            joins: [
                ...this.ast.joins,
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
        return new QueryBuilder(this.tableDef, { ...this.ast, limit: n });
    }

    offset(n: number): QueryBuilder<TTable, TReturn> {
        return new QueryBuilder(this.tableDef, { ...this.ast, offset: n });
    }

    toSql(dialect: Dialect): string {
        if (this.ast.columns.length === 0) {
            // Usa a `tableDef` para obter as colunas
            const allColumns = Object.keys(this.tableDef.columns).map(
                name =>
                ({
                    type: 'Column',
                    table: this.ast.from.name,
                    name,
                } as ColumnNode)
            );
            return dialect.compile({ ...this.ast, columns: allColumns });
        }
        return dialect.compile(this.ast);
    }

    getAST() {
        return this.ast;
    }

    async *execute(
        _dialect: Dialect
    ): AsyncGenerator<TReturn, void, unknown> {
        const sql = this.toSql(_dialect);
        console.log('Executing:', sql);
        yield { id: 1, name: 'Alice', role: 'admin' } as any;
        yield { id: 2, name: 'Bob', role: 'user' } as any;
    }
}