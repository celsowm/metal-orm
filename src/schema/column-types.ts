/**
 * Canonical, dialect-agnostic column data types.
 * Keep this intentionally small; dialect-specific names should be expressed via `dialectTypes`.
 */
export const STANDARD_COLUMN_TYPES = [
  'INT',
  'INTEGER',
  'BIGINT',
  'VARCHAR',
  'TEXT',
  'JSON',
  'ENUM',
  'DECIMAL',
  'FLOAT',
  'DOUBLE',
  'UUID',
  'BINARY',
  'VARBINARY',
  'BLOB',
  'DATE',
  'DATETIME',
  'TIMESTAMP',
  'TIMESTAMPTZ',
  'BOOLEAN'
] as const;

/** Known logical types the ORM understands. */
export type StandardColumnType = (typeof STANDARD_COLUMN_TYPES)[number];

/**
 * Column type value.
 * We allow arbitrary strings so new/dialect-specific types don't require touching this module.
 */
export type ColumnType = StandardColumnType | (string & {});

const STANDARD_TYPE_SET = new Set<string>(STANDARD_COLUMN_TYPES.map(t => t.toLowerCase()));

/**
 * Normalizes a column type to its canonical lowercase form when it's one of the known logical types.
 * Unknown/custom types are returned untouched to avoid clobbering dialect-specific casing.
 */
export const normalizeColumnType = (type: ColumnType): ColumnType => {
  if (typeof type !== 'string') return type;
  const lower = type.toLowerCase();
  return STANDARD_TYPE_SET.has(lower) ? lower : type;
};

/**
 * Renders a raw SQL type name with optional parameters.
 */
export const renderTypeWithArgs = (sqlType: string, args?: unknown[]): string => {
  if (!args || args.length === 0) return sqlType;
  return `${sqlType}(${args.join(', ')})`;
};

export type ReferentialAction =
  | 'NO ACTION'
  | 'RESTRICT'
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT';

export interface RawDefaultValue {
  raw: string;
}

export type DefaultValue = string | number | boolean | Date | null | RawDefaultValue;

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
export interface ColumnDef<T extends ColumnType = ColumnType, TRuntime = unknown> {
  /** Column name (filled at runtime by defineTable) */
  name: string;
  /** Data type of the column */
  type: T;
  /** Optional explicit SQL type per dialect (e.g., { postgres: 'bytea' }) */
  dialectTypes?: Partial<Record<string, string>>;
  /** Optional override for the inferred TypeScript type */
  tsType?: TRuntime;
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
  args?: (string | number)[];
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
   * Creates a text column definition
   */
  text: (): ColumnDef<'TEXT'> => ({ name: '', type: 'TEXT' }),

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
  bytea: (): ColumnDef<'BYTEA'> => ({
    name: '',
    type: 'BYTEA'
  }),

  /**
   * Creates a timestamp column definition
   */
  timestamp: <TRuntime = string>(): ColumnDef<'TIMESTAMP', TRuntime> => ({ name: '', type: 'TIMESTAMP' }),

  /**
   * Creates a timestamptz column definition
   */
  timestamptz: <TRuntime = string>(): ColumnDef<'TIMESTAMPTZ', TRuntime> => ({ name: '', type: 'TIMESTAMPTZ' }),

  /**
   * Creates a date column definition
   */
  date: <TRuntime = string>(): ColumnDef<'DATE', TRuntime> => ({ name: '', type: 'DATE' }),

  /**
   * Creates a datetime column definition
   */
  datetime: <TRuntime = string>(): ColumnDef<'DATETIME', TRuntime> => ({ name: '', type: 'DATETIME' }),

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
   * Creates a column definition with a custom SQL type.
   * Useful for dialect-specific types without polluting the standard set.
   */
  custom: (type: string, opts: { dialect?: string; args?: (string | number)[]; tsType?: unknown } = {}): ColumnDef => ({
    name: '',
    type,
    args: opts.args,
    tsType: opts.tsType,
    dialectTypes: opts.dialect ? { [opts.dialect]: type } : undefined
  }),

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
  default: <T extends ColumnType>(def: ColumnDef<T>, value: DefaultValue): ColumnDef<T> =>
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
