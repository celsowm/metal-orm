/**
 * Supported column data types for database schema definitions
 */
export type ColumnType =
  | 'INT'
  | 'INTEGER'
  | 'BIGINT'
  | 'VARCHAR'
  | 'TEXT'
  | 'JSON'
  | 'ENUM'
  | 'DECIMAL'
  | 'FLOAT'
  | 'DOUBLE'
  | 'UUID'
  | 'BINARY'
  | 'VARBINARY'
  | 'BLOB'
  | 'BYTEA'
  | 'DATE'
  | 'DATETIME'
  | 'TIMESTAMP'
  | 'TIMESTAMPTZ'
  | 'BOOLEAN'
  | 'int'
  | 'integer'
  | 'bigint'
  | 'varchar'
  | 'text'
  | 'json'
  | 'enum'
  | 'decimal'
  | 'float'
  | 'double'
  | 'uuid'
  | 'binary'
  | 'varbinary'
  | 'blob'
  | 'bytea'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | 'timestamptz'
  | 'boolean';

export type ReferentialAction =
  | 'NO ACTION'
  | 'RESTRICT'
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT';

export interface RawDefaultValue {
  raw: string;
}

export type DefaultValue = unknown | RawDefaultValue;

export interface ForeignKeyReference {
  /** Target table name */
  table: string;
  /** Target column name */
  column: string;
  /** Optional constraint name */
  name?: string;
  /** ON DELETE action */
  onDelete?: ReferentialAction;
  /** ON UPDATE action */
  onUpdate?: ReferentialAction;
  /** Whether the constraint is deferrable (Postgres) */
  deferrable?: boolean;
}

/**
 * Definition of a database column
 */
export interface ColumnDef<T extends ColumnType = ColumnType> {
  /** Column name (filled at runtime by defineTable) */
  name: string;
  /** Data type of the column */
  type: T;
  /** Whether this column is a primary key */
  primary?: boolean;
  /** Whether this column cannot be null */
  notNull?: boolean;
  /** Whether this column must be unique (or name of the unique constraint) */
  unique?: boolean | string;
  /** Default value for the column */
  default?: DefaultValue;
  /** Whether the column auto-increments / identity */
  autoIncrement?: boolean;
  /** Identity strategy where supported */
  generated?: 'always' | 'byDefault';
  /** Inline check constraint expression */
  check?: string;
  /** Foreign key reference */
  references?: ForeignKeyReference;
  /** Column comment/description */
  comment?: string;
  /** Additional arguments for the column type (e.g., VARCHAR length) */
  args?: any[];
  /** Table name this column belongs to (filled at runtime by defineTable) */
  table?: string;
}

/**
 * Factory for creating column definitions with common data types
 */
export const col = {
  /**
   * Creates an integer column definition
   * @returns ColumnDef with INT type
   */
  int: (): ColumnDef<'INT'> => ({ name: '', type: 'INT' }),

  /**
   * Creates a big integer column definition
   */
  bigint: (): ColumnDef<'BIGINT'> => ({ name: '', type: 'BIGINT' }),

  /**
   * Creates a variable character column definition
   * @param length - Maximum length of the string
   * @returns ColumnDef with VARCHAR type
   */
  varchar: (length: number): ColumnDef<'VARCHAR'> => ({ name: '', type: 'VARCHAR', args: [length] }),

  /**
   * Creates a fixed precision decimal column definition
   */
  decimal: (precision: number, scale = 0): ColumnDef<'DECIMAL'> => ({
    name: '',
    type: 'DECIMAL',
    args: [precision, scale]
  }),

  /**
   * Creates a floating point column definition
   */
  float: (precision?: number): ColumnDef<'FLOAT'> => ({
    name: '',
    type: 'FLOAT',
    args: precision !== undefined ? [precision] : undefined
  }),

  /**
   * Creates a UUID column definition
   */
  uuid: (): ColumnDef<'UUID'> => ({ name: '', type: 'UUID' }),

  /**
   * Creates a binary large object column definition
   */
  blob: (): ColumnDef<'BLOB'> => ({ name: '', type: 'BLOB' }),

  /**
   * Creates a fixed-length binary column definition
   */
  binary: (length?: number): ColumnDef<'BINARY'> => ({
    name: '',
    type: 'BINARY',
    args: length !== undefined ? [length] : undefined
  }),

  /**
   * Creates a variable-length binary column definition
   */
  varbinary: (length?: number): ColumnDef<'VARBINARY'> => ({
    name: '',
    type: 'VARBINARY',
    args: length !== undefined ? [length] : undefined
  }),

  /**
   * Creates a Postgres bytea column definition
   */
  bytea: (): ColumnDef<'BYTEA'> => ({ name: '', type: 'BYTEA' }),

  /**
   * Creates a timestamp column definition
   */
  timestamp: (): ColumnDef<'TIMESTAMP'> => ({ name: '', type: 'TIMESTAMP' }),

  /**
   * Creates a timestamptz column definition
   */
  timestamptz: (): ColumnDef<'TIMESTAMPTZ'> => ({ name: '', type: 'TIMESTAMPTZ' }),

  /**
   * Creates a date column definition
   */
  date: (): ColumnDef<'DATE'> => ({ name: '', type: 'DATE' }),

  /**
   * Creates a datetime column definition
   */
  datetime: (): ColumnDef<'DATETIME'> => ({ name: '', type: 'DATETIME' }),

  /**
   * Creates a JSON column definition
   * @returns ColumnDef with JSON type
   */
  json: (): ColumnDef<'JSON'> => ({ name: '', type: 'JSON' }),

  /**
   * Creates a boolean column definition
   * @returns ColumnDef with BOOLEAN type
   */
  boolean: (): ColumnDef<'BOOLEAN'> => ({ name: '', type: 'BOOLEAN' }),

  /**
   * Creates an enum column definition
   * @param values - Enum values
   */
  enum: (values: string[]): ColumnDef<'ENUM'> => ({ name: '', type: 'ENUM', args: values }),

  /**
   * Marks a column definition as a primary key
   * @param def - Column definition to modify
   * @returns Modified ColumnDef with primary: true
   */
  primaryKey: <T extends ColumnType>(def: ColumnDef<T>): ColumnDef<T> =>
    ({ ...def, primary: true }),

  /**
   * Marks a column as NOT NULL
   */
  notNull: <T extends ColumnType>(def: ColumnDef<T>): ColumnDef<T> =>
    ({ ...def, notNull: true }),

  /**
   * Marks a column as UNIQUE
   */
  unique: <T extends ColumnType>(def: ColumnDef<T>, name?: string): ColumnDef<T> =>
    ({
      ...def,
      unique: name ?? true
    }),

  /**
   * Sets a default value for the column
   */
  default: <T extends ColumnType>(def: ColumnDef<T>, value: unknown): ColumnDef<T> =>
    ({
      ...def,
      default: value
    }),

  /**
   * Sets a raw SQL default value for the column
   */
  defaultRaw: <T extends ColumnType>(def: ColumnDef<T>, expression: string): ColumnDef<T> =>
    ({
      ...def,
      default: { raw: expression }
    }),

  /**
   * Marks a column as auto-increment / identity
   */
  autoIncrement: <T extends ColumnType>(
    def: ColumnDef<T>,
    strategy: ColumnDef['generated'] = 'byDefault'
  ): ColumnDef<T> =>
    ({
      ...def,
      autoIncrement: true,
      generated: strategy
    }),

  /**
   * Adds a foreign key reference
   */
  references: <T extends ColumnType>(def: ColumnDef<T>, ref: ForeignKeyReference): ColumnDef<T> =>
    ({
      ...def,
      references: ref
    }),

  /**
   * Adds a check constraint to the column
   */
  check: <T extends ColumnType>(def: ColumnDef<T>, expression: string): ColumnDef<T> =>
    ({
      ...def,
      check: expression
    })
};
