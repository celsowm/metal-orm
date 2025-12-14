import { describe, expect, it } from 'vitest';
import { BaseSchemaDialect } from './base-schema-dialect.js';
import { PostgresSchemaDialect } from './postgres-schema-dialect.js';
import { TableDef } from '../../../schema/table.js';
import { ForeignKeyReference } from '../../../schema/column.js';
import { createLiteralFormatter } from '../sql-writing.js';

class DummySchemaDialect extends BaseSchemaDialect {
    readonly name = 'sqlite';
    private readonly formatter = createLiteralFormatter({
        booleanTrue: '1',
        booleanFalse: '0',
    });

    get literalFormatter() {
        return this.formatter;
    }

    quoteIdentifier(id: string): string {
        return `"${id}"`;
    }

    renderColumnType(): string {
        return 'INTEGER';
    }

    renderAutoIncrement(): string | undefined {
        return undefined;
    }

    renderIndex(): string {
        return 'CREATE INDEX dummy;';
    }
}

const table: TableDef = {
    name: 'child',
    columns: {},
    relations: {},
};

const deferrableReference: ForeignKeyReference = {
    table: 'parent',
    column: 'id',
    deferrable: true,
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
};

describe('renderReference deferrable handling', () => {
    it('base dialect remains agnostic to deferrable flags', () => {
        const dialect = new DummySchemaDialect();
        const sql = dialect.renderReference(deferrableReference, table);
        expect(sql).toContain('REFERENCES "parent"');
        expect(sql).not.toContain('DEFERRABLE INITIALLY DEFERRED');
    });

    it('Postgres dialect renders the deferrable clause', () => {
        const dialect = new PostgresSchemaDialect();
        const sql = dialect.renderReference(deferrableReference, table);
        expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
    });

    it('Postgres dialect skips the clause when the flag is missing', () => {
        const dialect = new PostgresSchemaDialect();
        const sql = dialect.renderReference({ table: 'parent', column: 'id' }, table);
        expect(sql).not.toContain('DEFERRABLE INITIALLY DEFERRED');
    });
});
