import { ColumnDef } from './column.js';
import type { TableDef } from './table.js';

const isColumnsRecord = (columns: unknown): columns is Record<string, ColumnDef> => {
    return typeof columns === 'object' && columns !== null;
};

const isRelationsRecord = (relations: unknown): relations is Record<string, unknown> => {
    return typeof relations === 'object' && relations !== null;
};

export const isTableDef = (value: unknown): value is TableDef => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as Partial<TableDef>;
    if (typeof candidate.name !== 'string') {
        return false;
    }

    if (!isColumnsRecord(candidate.columns)) {
        return false;
    }

    if (!isRelationsRecord(candidate.relations)) {
        return false;
    }

    return true;
};
