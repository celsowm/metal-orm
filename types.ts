// Simulation Types for the ORM Engine

export enum ColumnType {
    INT = 'INT',
    VARCHAR = 'VARCHAR',
    JSON = 'JSON',
    ENUM = 'ENUM'
}

export interface ColumnDef {
    name: string;
    type: ColumnType;
    primary?: boolean;
    args?: any[];
}

export interface TableDef {
    name: string;
    columns: Record<string, ColumnDef>;
}

export interface ASTNode {
    type: string;
}

export interface SelectState {
    table?: string;
    columns: string[];
    where: string[];
    limit?: number;
    offset?: number;
    joins: string[];
}

export enum DialectType {
    MYSQL = 'MySQL',
    MSSQL = 'SQL Server',
    POSTGRES = 'PostgreSQL'
}
