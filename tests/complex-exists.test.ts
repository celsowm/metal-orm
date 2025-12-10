import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../src/query-builder/select.js';
import { SqliteDialect } from '../src/core/dialect/sqlite/index.js';
import { TableDef, defineTable } from '../src/schema/table.js';
import { col } from '../src/schema/column.js';
import { eq, exists, and, outerRef, correlateBy } from '../src/core/ast/expression.js';

// Define test schema: Clientes, Pedidos and Fidelidade
const Clientes = defineTable('clientes', {
    id: col.primaryKey(col.int()),
    nome: col.varchar(255),
    email: col.varchar(255),
}, {});

const Pedidos = defineTable('pedidos', {
    id: col.primaryKey(col.int()),
    cliente_id: col.int(),
    data_pedido: col.varchar(50), // Usando varchar em vez de date
    status: col.varchar(50),
    total: col.int(),
}, {});

const Fidelidade = defineTable('fidelidade', {
    id: col.primaryKey(col.int()),
    cliente_id: col.int(),
    status: col.varchar(50),
    data_inicio: col.varchar(50), // Usando varchar em vez de date
}, {});

// Define relationships
Clientes.relations = {
    pedidos: {
        type: 'HAS_MANY',
        target: Pedidos,
        foreignKey: 'cliente_id',
        localKey: 'id'
    },
    fidelidade: {
        type: 'HAS_MANY',
        target: Fidelidade,
        foreignKey: 'cliente_id',
        localKey: 'id'
    }
};

Pedidos.relations = {
    cliente: {
        type: 'BELONGS_TO',
        target: Clientes,
        foreignKey: 'cliente_id',
        localKey: 'id'
    }
};

Fidelidade.relations = {
    cliente: {
        type: 'BELONGS_TO',
        target: Clientes,
        foreignKey: 'cliente_id',
        localKey: 'id'
    }
};

const dialect = new SqliteDialect();

describe('Complex EXISTS Query Support', () => {
    it('should support EXISTS with date range AND another EXISTS', () => {
        // Construindo a subquery para pedidos em 2024
        const pedidosEm2024 = new SelectQueryBuilder(Pedidos)
            .select({ dummy: col.int() }) // SELECT 1 (dummy)
            .where(and(
                eq(Pedidos.columns.cliente_id, { type: 'Column', table: 'clientes', name: 'id' }),
                // BETWEEN não é suportado diretamente, então usamos >= e <=
                and(
                    eq(Pedidos.columns.data_pedido, '2024-01-01'),
                    eq(Pedidos.columns.data_pedido, '2024-12-31')
                )
            ));

        // Construindo a subquery para fidelidade ativa
        const fidelidadeAtiva = new SelectQueryBuilder(Fidelidade)
            .select({ dummy: col.int() }) // SELECT 1 (dummy)
            .where(and(
                eq(Fidelidade.columns.cliente_id, { type: 'Column', table: 'clientes', name: 'id' }),
                eq(Fidelidade.columns.status, 'Ativo')
            ));

        // Consulta principal
        const query = new SelectQueryBuilder(Clientes)
            .select({ nome: Clientes.columns.nome })
            .where(and(
                exists(pedidosEm2024.getAST()),
                exists(fidelidadeAtiva.getAST())
            ));

        const compiled = query.compile(dialect);
        const { sql, params } = compiled;

        console.log('Generated SQL:', sql);
        console.log('Parameters:', params);

        expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "pedidos"');
        expect(sql).toContain('"pedidos"."cliente_id" = "clientes"."id"');
        expect(sql).toContain('"pedidos"."data_pedido"');
        expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "fidelidade"');
        expect(sql).toContain('"fidelidade"."cliente_id" = "clientes"."id"');
        expect(sql).toContain('"fidelidade"."status" = ?');
        expect(params).toContain('Ativo');
    });

    it('should support whereHas for both conditions', () => {
        // Usando whereHas para simplificar a construção das subqueries EXISTS
        const query = new SelectQueryBuilder(Clientes)
            .select({ nome: Clientes.columns.nome })
            .whereHas('pedidos', (pedidosQb) =>
                pedidosQb.where(and(
                    eq(Pedidos.columns.data_pedido, '2024-01-01'),
                    eq(Pedidos.columns.data_pedido, '2024-12-31')
                ))
            )
            .whereHas('fidelidade', (fidelidadeQb) =>
                fidelidadeQb.where(eq(Fidelidade.columns.status, 'Ativo'))
            );

        const compiled = query.compile(dialect);
        const { sql, params } = compiled;

        console.log('Generated SQL with whereHas:', sql);
        console.log('Parameters:', params);

        expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "pedidos"');
        expect(sql).toContain('"pedidos"."cliente_id" = "clientes"."id"');
        expect(sql).toContain('"pedidos"."data_pedido"');
        expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "fidelidade"');
        expect(sql).toContain('"fidelidade"."cliente_id" = "clientes"."id"');
        expect(sql).toContain('"fidelidade"."status" = ?');
        expect(params).toContain('Ativo');
    });

    it('should generate correct SQL structure for complex EXISTS query', () => {
        // Teste para verificar se o SQL gerado tem a estrutura correta
        const query = new SelectQueryBuilder(Clientes)
            .select({ nome: Clientes.columns.nome })
            .where(and(
                exists({
                    type: 'SelectQuery',
                    from: { type: 'Table', name: 'pedidos' },
                    columns: [{ type: 'Column', table: 'pedidos', name: 'id' }],
                    joins: [],
                    where: {
                        type: 'LogicalExpression',
                        operator: 'AND',
                        operands: [
                            {
                                type: 'BinaryExpression',
                                left: { type: 'Column', table: 'pedidos', name: 'cliente_id' },
                                operator: '=',
                                right: { type: 'Column', table: 'clientes', name: 'id' }
                            },
                            {
                                type: 'LogicalExpression',
                                operator: 'AND',
                                operands: [
                                    {
                                        type: 'BinaryExpression',
                                        left: { type: 'Column', table: 'pedidos', name: 'data_pedido' },
                                        operator: '>=',
                                        right: { type: 'Literal', value: '2024-01-01' }
                                    },
                                    {
                                        type: 'BinaryExpression',
                                        left: { type: 'Column', table: 'pedidos', name: 'data_pedido' },
                                        operator: '<=',
                                        right: { type: 'Literal', value: '2024-12-31' }
                                    }
                                ]
                            }
                        ]
                    }
                }),
                exists({
                    type: 'SelectQuery',
                    from: { type: 'Table', name: 'fidelidade' },
                    columns: [{ type: 'Column', table: 'fidelidade', name: 'id' }],
                    joins: [],
                    where: {
                        type: 'LogicalExpression',
                        operator: 'AND',
                        operands: [
                            {
                                type: 'BinaryExpression',
                                left: { type: 'Column', table: 'fidelidade', name: 'cliente_id' },
                                operator: '=',
                                right: { type: 'Column', table: 'clientes', name: 'id' }
                            },
                            {
                                type: 'BinaryExpression',
                                left: { type: 'Column', table: 'fidelidade', name: 'status' },
                                operator: '=',
                                right: { type: 'Literal', value: 'Ativo' }
                            }
                        ]
                    }
                })
            ));

        const compiled = query.compile(dialect);
        const { sql, params } = compiled;

        console.log('Generated SQL structure:', sql);
    console.log('Parameters:', params);

    // Verifica a estrutura geral da consulta
    expect(sql).toContain('SELECT "clientes"."nome" AS "nome" FROM "clientes" WHERE');
    expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "pedidos"');
        expect(sql).toContain('"pedidos"."cliente_id" = "clientes"."id"');
        expect(sql).toContain('"pedidos"."data_pedido" >= ?');
        expect(sql).toContain('"pedidos"."data_pedido" <= ?');
        expect(sql).toContain('EXISTS');
        expect(sql).toContain('SELECT 1 FROM "fidelidade"');
        expect(sql).toContain('"fidelidade"."cliente_id" = "clientes"."id"');
        expect(sql).toContain('"fidelidade"."status" = ?');
        expect(params).toEqual(['2024-01-01', '2024-12-31', 'Ativo']);
    });

    it('supports EXISTS with a derived table source', () => {
        const pedidosOpen = new SelectQueryBuilder(Pedidos)
            .select({ cliente_id: Pedidos.columns.cliente_id })
            .where(eq(Pedidos.columns.status, 'Em aberto'));

        const existsFromDerived = new SelectQueryBuilder(Pedidos)
            .fromSubquery(pedidosOpen, 'p_open')
            .select({ cliente_id: Pedidos.columns.cliente_id })
            .where(eq({ type: 'Column', table: 'p_open', name: 'cliente_id' }, { type: 'Column', table: 'clientes', name: 'id' }));

        const query = new SelectQueryBuilder(Clientes)
            .select({ nome: Clientes.columns.nome })
            .whereExists(existsFromDerived);

        const { sql, params } = query.compile(dialect);

        expect(sql).toContain('EXISTS');
        expect(sql).toContain('FROM (SELECT "pedidos"."cliente_id" AS "cliente_id" FROM "pedidos" WHERE "pedidos"."status" = ?)');
        expect(sql).toContain('AS "p_open" WHERE "p_open"."cliente_id" = "clientes"."id"');
        expect(params).toEqual(['Em aberto']);
    });

    it('allows manual correlation injection in whereExists (using outerRef)', () => {
        const pedidosPagos = new SelectQueryBuilder(Pedidos)
            .select({ id: Pedidos.columns.id })
            .where(eq(Pedidos.columns.status, 'Pago'));

        const query = new SelectQueryBuilder(Clientes)
            .select({ nome: Clientes.columns.nome })
            .whereExists(
                pedidosPagos,
                eq(Pedidos.columns.cliente_id, outerRef({ type: 'Column', table: 'clientes', name: 'id' }))
            );

        const { sql, params } = query.compile(dialect);

        expect(sql).toContain('EXISTS');
        expect(sql).toContain('"pedidos"."status" = ?');
        expect(sql).toContain('"pedidos"."cliente_id" = "clientes"."id"');
        expect(params).toEqual(['Pago']);
    });

    it('supports additional correlation inside whereHas options', () => {
        const query = new SelectQueryBuilder(Clientes)
            .select({ nome: Clientes.columns.nome })
            .whereHas('pedidos', {
                correlate: eq(Pedidos.columns.status, 'Enviado')
            });

        const { sql, params } = query.compile(dialect);

        expect(sql).toContain('EXISTS');
        expect(sql).toContain('"pedidos"."cliente_id" = "clientes"."id"');
        expect(sql).toContain('"pedidos"."status" = ?');
        expect(params).toEqual(['Enviado']);
    });

    it('honors root table alias in correlations', () => {
        const query = new SelectQueryBuilder(Clientes)
            .as('c')
            .select({ nome: Clientes.columns.nome })
            .whereHas('pedidos', {
                correlate: eq(Pedidos.columns.status, 'Pago')
            });

        const { sql, params } = query.compile(dialect);

        expect(sql).toContain('FROM "clientes" AS "c"');
        expect(sql).toContain('"pedidos"."cliente_id" = "c"."id"');
        expect(sql).toContain('"pedidos"."status" = ?');
        expect(sql).toContain('"c"."nome" AS "nome"');
        expect(params).toEqual(['Pago']);
    });

    it('uses correlateBy helper for alias-aware outer refs', () => {
        const sub = new SelectQueryBuilder(Pedidos)
            .select({ id: Pedidos.columns.id })
            .where(eq(Pedidos.columns.status, 'Pago'));

        const query = new SelectQueryBuilder(Clientes)
            .as('c')
            .select({ nome: Clientes.columns.nome })
            .whereExists(sub, eq(Pedidos.columns.cliente_id, correlateBy('c', 'id')));

        const { sql, params } = query.compile(dialect);

        expect(sql).toContain('"pedidos"."cliente_id" = "c"."id"');
        expect(params).toEqual(['Pago']);
    });
});
