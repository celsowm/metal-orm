import type { JsonSchemaProperty, JsonSchemaType } from './schema-types.js';

export type FunctionMapper = (includeDescriptions: boolean) => JsonSchemaProperty;

export class AggregateFunctionMapperRegistry {
  private mappers = new Map<string, FunctionMapper>();

  register(functionName: string, mapper: FunctionMapper): void {
    this.mappers.set(functionName.toUpperCase(), mapper);
  }

  has(functionName: string): boolean {
    return this.mappers.has(functionName.toUpperCase());
  }

  get(functionName: string): FunctionMapper | undefined {
    return this.mappers.get(functionName.toUpperCase());
  }

  getOrDefault(functionName: string, defaultMapper: FunctionMapper): FunctionMapper {
    return this.get(functionName) ?? defaultMapper;
  }

  unregister(functionName: string): void {
    this.mappers.delete(functionName.toUpperCase());
  }

  clear(): void {
    this.mappers.clear();
  }
}

export class WindowFunctionMapperRegistry {
  private mappers = new Map<string, FunctionMapper>();

  register(functionName: string, mapper: FunctionMapper): void {
    this.mappers.set(functionName.toUpperCase(), mapper);
  }

  has(functionName: string): boolean {
    return this.mappers.has(functionName.toUpperCase());
  }

  get(functionName: string): FunctionMapper | undefined {
    return this.mappers.get(functionName.toUpperCase());
  }

  getOrDefault(functionName: string, defaultMapper: FunctionMapper): FunctionMapper {
    return this.get(functionName) ?? defaultMapper;
  }

  unregister(functionName: string): void {
    this.mappers.delete(functionName.toUpperCase());
  }

  clear(): void {
    this.mappers.clear();
  }
}

const createNumericAggregateMapper = (functionName: string): FunctionMapper => {
  return (includeDescriptions: boolean): JsonSchemaProperty => ({
    type: 'number' as JsonSchemaType,
    nullable: false,
    ...(includeDescriptions ? { description: `${functionName} aggregate function result` } : {}),
  });
};

const createStringAggregateMapper = (functionName: string): FunctionMapper => {
  return (includeDescriptions: boolean): JsonSchemaProperty => ({
    type: 'string' as JsonSchemaType,
    nullable: true,
    ...(includeDescriptions ? { description: `${functionName} aggregate function result` } : {}),
  });
};

const createObjectAggregateMapper = (functionName: string): FunctionMapper => {
  return (includeDescriptions: boolean): JsonSchemaProperty => ({
    type: 'object' as JsonSchemaType,
    nullable: true,
    ...(includeDescriptions ? { description: `${functionName} aggregate function result` } : {}),
  });
};

const createIntegerWindowMapper = (functionName: string): FunctionMapper => {
  return (includeDescriptions: boolean): JsonSchemaProperty => ({
    type: 'integer' as JsonSchemaType,
    nullable: false,
    ...(includeDescriptions ? { description: `${functionName} window function result` } : {}),
  });
};

const createStringWindowMapper = (functionName: string): FunctionMapper => {
  return (includeDescriptions: boolean): JsonSchemaProperty => ({
    type: 'string' as JsonSchemaType,
    nullable: true,
    ...(includeDescriptions ? { description: `${functionName} window function result` } : {}),
  });
};

export const createDefaultAggregateFunctionMappers = (): Record<string, FunctionMapper> => ({
  COUNT: createNumericAggregateMapper('COUNT'),
  SUM: createNumericAggregateMapper('SUM'),
  AVG: createNumericAggregateMapper('AVG'),
  MIN: createNumericAggregateMapper('MIN'),
  MAX: createNumericAggregateMapper('MAX'),
  GROUP_CONCAT: createStringAggregateMapper('GROUP_CONCAT'),
  STRING_AGG: createStringAggregateMapper('STRING_AGG'),
  ARRAY_AGG: createStringAggregateMapper('ARRAY_AGG'),
  JSON_ARRAYAGG: createObjectAggregateMapper('JSON_ARRAYAGG'),
  JSON_OBJECTAGG: createObjectAggregateMapper('JSON_OBJECTAGG'),
});

export const createDefaultWindowFunctionMappers = (): Record<string, FunctionMapper> => ({
  ROW_NUMBER: createIntegerWindowMapper('ROW_NUMBER'),
  RANK: createIntegerWindowMapper('RANK'),
  DENSE_RANK: createIntegerWindowMapper('DENSE_RANK'),
  NTILE: createIntegerWindowMapper('NTILE'),
  LAG: createStringWindowMapper('LAG'),
  LEAD: createStringWindowMapper('LEAD'),
  FIRST_VALUE: createStringWindowMapper('FIRST_VALUE'),
  LAST_VALUE: createStringWindowMapper('LAST_VALUE'),
});

export const defaultAggregateFunctionMapperRegistry = new AggregateFunctionMapperRegistry();
export const defaultWindowFunctionMapperRegistry = new WindowFunctionMapperRegistry();

Object.entries(createDefaultAggregateFunctionMappers()).forEach(([fnName, mapper]) => {
  defaultAggregateFunctionMapperRegistry.register(fnName, mapper);
});

Object.entries(createDefaultWindowFunctionMappers()).forEach(([fnName, mapper]) => {
  defaultWindowFunctionMapperRegistry.register(fnName, mapper);
});
