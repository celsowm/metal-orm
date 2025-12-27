import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { concat } from '../../src/core/functions/text.js';
import { asType, eq, sum } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import type { HasManyCollection } from '../../src/schema/types.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  HasMany,
  BelongsTo,
  PrimaryKey,
  getTableDefFromEntity,
  selectFromEntity
} from '../../src/decorators/index.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import {
  closeDb,
  createSqliteSessionFromDb,
  runSql
} from './sqlite-helpers.ts';

describe('Level 3 - Decorators with calculated fields (SQLite Memory)', () => {
  it('includes concat and sum projections with relation includes', async () => {
    clearEntityMetadata();

    @Entity()
    class Customer {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.notNull(col.varchar(255)))
      firstName!: string;

      @Column(col.notNull(col.varchar(255)))
      lastName!: string;

      @Column(col.notNull(col.varchar(50)))
      tier!: string;

      @HasMany({
        target: () => Order,
        foreignKey: 'customerId'
      })
      orders!: HasManyCollection<Order>;
    }

    @Entity()
    class Order {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.notNull(col.varchar(255)))
      description!: string;

      @Column(col.notNull(col.int()))
      total!: number;

      @Column(col.notNull(col.int()))
      customerId!: number;

      @BelongsTo({
        target: () => Customer,
        foreignKey: 'customerId'
      })
      customer?: Customer;
    }

    const db = new sqlite3.Database(':memory:');

    try {
      bootstrapEntities();
      const customerTable = getTableDefFromEntity(Customer);
      const orderTable = getTableDefFromEntity(Order);

      expect(customerTable).toBeDefined();
      expect(orderTable).toBeDefined();

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        customerTable!,
        orderTable!
      );

      await runSql(
        db,
        'INSERT INTO customers (id, firstName, lastName, tier) VALUES (?, ?, ?, ?);',
        [1, 'Ada', 'Lovelace', 'gold']
      );
      await runSql(
        db,
        'INSERT INTO customers (id, firstName, lastName, tier) VALUES (?, ?, ?, ?);',
        [2, 'Grace', 'Hopper', 'silver']
      );

      await runSql(
        db,
        'INSERT INTO orders (id, description, total, customerId) VALUES (?, ?, ?, ?);',
        [1, 'Analytical Engine', 120, 1]
      );
      await runSql(
        db,
        'INSERT INTO orders (id, description, total, customerId) VALUES (?, ?, ?, ?);',
        [2, 'Computation Notes', 80, 1]
      );
      await runSql(
        db,
        'INSERT INTO orders (id, description, total, customerId) VALUES (?, ?, ?, ?);',
        [3, 'Compiler Manual', 150, 2]
      );

      const customerColumns = customerTable!.columns;
      const orderColumns = orderTable!.columns;

      const totalSpentSubquery = new SelectQueryBuilder(orderTable!)
        .select({ total: sum(orderColumns.total) })
        .where(eq(orderColumns.customerId, customerColumns.id));

      const customers = await selectFromEntity(Customer)
        .select({
          id: customerColumns.id,
          fullName: asType<string>(concat(
            customerColumns.firstName,
            ' ',
            customerColumns.lastName
          )),
          tier: customerColumns.tier
        })
        .selectSubquery<number>('totalSpent', totalSpentSubquery)
        .include('orders', { columns: ['id', 'description', 'total'] })
        .orderBy(customerColumns.id)
        .execute(session);

      expect(customers).toHaveLength(2);
      const [ada, grace] = customers;

      expect(ada.fullName).toBe('Ada Lovelace');
      expect(ada.tier).toBe('gold');
      expect(ada.totalSpent).toBe(200);
      expect(ada.orders).toHaveLength(2);
      expect(ada.orders.map(order => order.description).sort()).toEqual([
        'Analytical Engine',
        'Computation Notes'
      ]);

      expect(grace.fullName).toBe('Grace Hopper');
      expect(grace.tier).toBe('silver');
      expect(grace.totalSpent).toBe(150);
      expect(grace.orders).toHaveLength(1);
      expect(grace.orders[0].description).toBe('Compiler Manual');
      expect(grace.orders[0].total).toBe(150);
    } finally {
      await closeDb(db);
      clearEntityMetadata();
    }
  });
});
