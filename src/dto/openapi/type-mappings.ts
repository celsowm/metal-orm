import type { ColumnDef } from '../../schema/column-types.js';
import type { OpenApiType } from './types.js';

export interface TypeMappingStrategy {
  supports(columnType: string): boolean;
  getOpenApiType(): OpenApiType;
  getFormat(columnType: string): string | undefined;
}

export class IntegerTypeStrategy implements TypeMappingStrategy {
  private readonly types = ['INT', 'INTEGER'];

  supports(type: string): boolean {
    return this.types.includes(type.toUpperCase());
  }

  getOpenApiType(): OpenApiType {
    return 'integer';
  }

  getFormat(): string | undefined {
    return 'int32';
  }
}

export class BigIntTypeStrategy implements TypeMappingStrategy {
  private readonly types = ['BIGINT'];

  supports(type: string): boolean {
    return this.types.includes(type.toUpperCase());
  }

  getOpenApiType(): OpenApiType {
    return 'integer';
  }

  getFormat(): string | undefined {
    return 'int64';
  }
}

export class DecimalTypeStrategy implements TypeMappingStrategy {
  private readonly types = ['DECIMAL', 'FLOAT', 'DOUBLE'];

  supports(type: string): boolean {
    return this.types.includes(type.toUpperCase());
  }

  getOpenApiType(): OpenApiType {
    return 'number';
  }

  getFormat(): string | undefined {
    return 'double';
  }
}

export class BooleanTypeStrategy implements TypeMappingStrategy {
  private readonly types = ['BOOLEAN'];

  supports(type: string): boolean {
    return this.types.includes(type.toUpperCase());
  }

  getOpenApiType(): OpenApiType {
    return 'boolean';
  }

  getFormat(): undefined {
    return undefined;
  }
}

export class UuidTypeStrategy implements TypeMappingStrategy {
  private readonly types = ['UUID'];

  supports(type: string): boolean {
    return this.types.includes(type.toUpperCase());
  }

  getOpenApiType(): OpenApiType {
    return 'string';
  }

  getFormat(): string {
    return 'uuid';
  }
}

export class BinaryTypeStrategy implements TypeMappingStrategy {
  private readonly types = ['BLOB', 'BINARY', 'VARBINARY', 'BYTEA'];

  supports(type: string): boolean {
    return this.types.includes(type.toUpperCase());
  }

  getOpenApiType(): OpenApiType {
    return 'string';
  }

  getFormat(): string {
    return 'byte';
  }
}

export class DateTimeTypeStrategy implements TypeMappingStrategy {
  private readonly types = ['DATE', 'DATETIME', 'TIMESTAMP', 'TIMESTAMPTZ'];

  supports(type: string): boolean {
    return this.types.includes(type.toUpperCase());
  }

  getOpenApiType(): OpenApiType {
    return 'string';
  }

  getFormat(columnType: string = 'DATETIME'): string {
    return columnType.toUpperCase() === 'DATE' ? 'date' : 'date-time';
  }
}

export class StringTypeStrategy implements TypeMappingStrategy {
  private readonly types = [
    'JSON', 'TEXT', 'VARCHAR', 'CHAR', 'ENUM'
  ];

  supports(type: string): boolean {
    return this.types.includes(type.toUpperCase());
  }

  getOpenApiType(): OpenApiType {
    return 'string';
  }

  getFormat(): undefined {
    return undefined;
  }
}

export class DefaultTypeStrategy implements TypeMappingStrategy {
  supports(): boolean {
    return true;
  }

  getOpenApiType(): OpenApiType {
    return 'string';
  }

  getFormat(): undefined {
    return undefined;
  }
}

export class TypeMappingService {
  private readonly strategies: TypeMappingStrategy[];

  constructor() {
    this.strategies = [
      new IntegerTypeStrategy(),
      new BigIntTypeStrategy(),
      new DecimalTypeStrategy(),
      new BooleanTypeStrategy(),
      new DateTimeTypeStrategy(),
      new UuidTypeStrategy(),
      new BinaryTypeStrategy(),
      new StringTypeStrategy(),
      new DefaultTypeStrategy(),
    ];
  }

  getOpenApiType(column: ColumnDef): OpenApiType {
    const strategy = this.findStrategy(column.type);
    return strategy.getOpenApiType();
  }

  getFormat(column: ColumnDef): string | undefined {
    const strategy = this.findStrategy(column.type);
    return strategy.getFormat(column.type);
  }

  private findStrategy(columnType: string): TypeMappingStrategy {
    for (const strategy of this.strategies) {
      if (strategy.supports(columnType)) {
        return strategy;
      }
    }
    return this.strategies[this.strategies.length - 1];
  }

  registerStrategy(strategy: TypeMappingStrategy, index?: number): void {
    if (index !== undefined) {
      this.strategies.splice(index, 0, strategy);
    } else {
      this.strategies.push(strategy);
    }
  }
}

export const typeMappingService = new TypeMappingService();

export function columnTypeToOpenApiType(col: ColumnDef): OpenApiType {
  return typeMappingService.getOpenApiType(col);
}

export function columnTypeToOpenApiFormat(col: ColumnDef): string | undefined {
  return typeMappingService.getFormat(col);
}
