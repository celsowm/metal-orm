# AST Module Analysis Report

## Overview
This report analyzes all modules in `src/core/ast` for potential anti-patterns and provides actionable suggestions for improvement.

---

## 1. [`adapters.ts`](src/core/ast/adapters.ts)

### Issues Identified

#### 🔴 **Type Casting Anti-Pattern**
**Lines 11, 20**: Using `as` type assertions without proper type guards
```typescript
alias: (col as ColumnRef).alias
alias: (table as TableRef).alias
```

**Problem**: The code assumes the input might be either `ColumnRef` or `ColumnDef`, but uses unsafe type casting. If the input is actually a `ColumnDef` without an `alias` property, this will silently return `undefined`.

**Suggestion**:
```typescript
export const toColumnRef = (col: ColumnRef | ColumnDef): ColumnRef => ({
  name: col.name,
  table: col.table,
  alias: 'alias' in col ? col.alias : undefined
});

export const toTableRef = (table: TableRef | TableDef): TableRef => ({
  name: table.name,
  schema: table.schema,
  alias: 'alias' in table ? table.alias : undefined
});
```

#### 🟡 **Missing Type Guards**
**Problem**: No validation that the input is actually the expected type.

**Suggestion**: Add type guard functions:
```typescript
const isColumnRef = (col: ColumnRef | ColumnDef): col is ColumnRef => 
  'alias' in col;

const isTableRef = (table: TableRef | TableDef): table is TableRef => 
  'alias' in table;
```

---

## 2. [`aggregate-functions.ts`](src/core/ast/aggregate-functions.ts)

### Issues Identified

#### 🟢 **Good Pattern**: Factory function for aggregate builders (line 7)
The `buildAggregate` function is well-designed and follows DRY principles.

#### 🟡 **Inconsistent API Design**
**Problem**: `groupConcat` has a different signature pattern than other aggregate functions. While others take a single column parameter, `groupConcat` takes options.

**Suggestion**: Consider consistency:
```typescript
// Option 1: Make all aggregates support options
export const count = (col: ColumnRef | ColumnNode, options?: AggregateOptions): FunctionNode => {
  // ...
};

// Option 2: Keep groupConcat separate but document why it's different
```

#### 🟡 **Missing Null Safety**
**Line 74-75**: Optional chaining is used, but no validation of the orderBy array content.

**Suggestion**: Add validation:
```typescript
orderBy: options?.orderBy?.length ? options.orderBy.map(toOrderByNode) : undefined,
```

---

## 3. [`builders.ts`](src/core/ast/builders.ts)

### Issues Identified

#### 🔴 **Complex Conditional Logic**
**Lines 16-20**: Nested ternary operators make the code hard to read and maintain.
```typescript
const baseTable = def.table
  ? table.alias && def.table === table.name
    ? table.alias
    : def.table
  : table.alias || table.name;
```

**Suggestion**: Extract to a named function with clear logic:
```typescript
const resolveTableName = (def: ColumnRef, table: TableRef): string => {
  if (!def.table) {
    return table.alias || table.name;
  }
  
  // If column specifies the base table name and table has an alias, use the alias
  if (table.alias && def.table === table.name) {
    return table.alias;
  }
  
  return def.table;
};

const baseTable = resolveTableName(def, table);
```

#### 🟡 **Type Narrowing Anti-Pattern**
**Line 11**: Using property check for type discrimination
```typescript
if ((column as ColumnNode).type === 'Column') {
```

**Suggestion**: Use proper type guard:
```typescript
const isColumnNode = (col: ColumnRef | ColumnNode): col is ColumnNode => 
  'type' in col && col.type === 'Column';

if (isColumnNode(column)) {
  return column;
}
```

#### 🟡 **Optional Parameters Object**
**Line 57**: Using a single optional object with multiple optional properties can be confusing.

**Suggestion**: Consider builder pattern or separate functions:
```typescript
export const fnTable = (name: string, args: OperandNode[] = [], alias?: string): FunctionTableNode => ({
  type: 'FunctionTable',
  name,
  args,
  alias
});

export const lateralFnTable = (base: FunctionTableNode): FunctionTableNode => ({
  ...base,
  lateral: true
});
```

---

## 4. [`expression-builders.ts`](src/core/ast/expression-builders.ts)

### Issues Identified

#### 🔴 **Duplicate Logic**
**Lines 43-47, 60-66**: Multiple functions doing similar type conversions (`toNode`, `toOperand`, `valueToOperand`).

**Suggestion**: Consolidate into a single, well-documented conversion function:
```typescript
/**
 * Converts various input types to an OperandNode
 */
export const toOperandNode = (
  value: OperandNode | ColumnRef | LiteralValue
): OperandNode => {
  if (isOperandNode(value)) {
    return value;
  }
  
  if (isLiteralValue(value)) {
    return { type: 'Literal', value };
  }
  
  // Must be ColumnRef
  const col = value as ColumnRef;
  return { 
    type: 'Column', 
    table: col.table || 'unknown', 
    name: col.name 
  };
};
```

#### 🔴 **Magic String "unknown"**
**Line 46**: Using `'unknown'` as a fallback table name is problematic.
```typescript
return { type: 'Column', table: def.table || 'unknown', name: def.name };
```

**Problem**: This can lead to invalid SQL generation. Better to throw an error or require the table.

**Suggestion**:
```typescript
if (!def.table) {
  throw new Error(`Column "${def.name}" requires a table reference`);
}
return { type: 'Column', table: def.table, name: def.name };
```

#### 🟡 **Repetitive Factory Functions**
**Lines 130-169**: Many similar binary expression builders (`eq`, `neq`, `gt`, etc.) with nearly identical implementations.

**Suggestion**: This is acceptable for API ergonomics, but consider adding JSDoc examples to distinguish usage patterns.

#### 🟡 **Type Predicate Inconsistency**
**Lines 54-58**: `isLiteralValue` and `isValueOperandInput` are defined inline, but `isOperandNode` is imported.

**Suggestion**: Move all type guards to a dedicated `type-guards.ts` file for consistency.

---

## 5. [`expression-nodes.ts`](src/core/ast/expression-nodes.ts)

### Issues Identified

#### 🟢 **Good Pattern**: Comprehensive type definitions with clear documentation.

#### 🟡 **Set-based Type Checking**
**Lines 138-147**: Using a Set for type checking is efficient but requires maintenance.

**Problem**: If a new operand type is added, developers must remember to update the Set.

**Suggestion**: Generate the set from the union type or use a different approach:
```typescript
// Option 1: Use discriminated union exhaustiveness checking
export const isOperandNode = (node: unknown): node is OperandNode => {
  if (!hasTypeProperty(node)) return false;
  
  const type = node.type;
  return (
    type === 'AliasRef' ||
    type === 'Column' ||
    type === 'Literal' ||
    type === 'Function' ||
    type === 'JsonPath' ||
    type === 'ScalarSubquery' ||
    type === 'CaseExpression' ||
    type === 'WindowFunction'
  );
};
```

#### 🟡 **Missing Validation**
**Problem**: Type guards only check the `type` property, not the structure.

**Suggestion**: Add runtime validation for critical paths:
```typescript
export const isColumnNode = (node: unknown): node is ColumnNode => {
  if (!hasTypeProperty(node) || node.type !== 'Column') return false;
  const col = node as Partial<ColumnNode>;
  return typeof col.table === 'string' && typeof col.name === 'string';
};
```

---

## 6. [`expression-visitor.ts`](src/core/ast/expression-visitor.ts)

### Issues Identified

#### 🟢 **Good Pattern**: Visitor pattern implementation with extensibility via registration.

#### 🟡 **Inconsistent Error Handling**
**Lines 81-87**: Error functions throw but don't provide context about what was expected.

**Suggestion**: Enhance error messages:
```typescript
const unsupportedExpression = (node: ExpressionNode): never => {
  const type = getNodeType(node) ?? 'unknown';
  const supportedTypes = Array.from(expressionDispatchers.keys()).join(', ');
  throw new Error(
    `Unsupported expression type "${type}". ` +
    `Supported types: BinaryExpression, LogicalExpression, ..., ${supportedTypes}`
  );
};
```

#### 🟡 **Visitor Method Optional Pattern**
**Lines 99-123**: The pattern of checking `if (visitor.visitX)` before calling is verbose.

**Suggestion**: Consider a default implementation or required methods:
```typescript
// Option 1: Provide default no-op implementations
export abstract class BaseExpressionVisitor<R> implements ExpressionVisitor<R> {
  visitBinaryExpression(node: BinaryExpressionNode): R {
    return this.otherwise(node);
  }
  // ... other methods
  
  abstract otherwise(node: ExpressionNode): R;
}

// Option 2: Use a builder pattern
export const createVisitor = <R>(config: {
  onBinary?: (node: BinaryExpressionNode) => R,
  onLogical?: (node: LogicalExpressionNode) => R,
  // ...
  otherwise: (node: ExpressionNode) => R
}): ExpressionVisitor<R> => ({
  visitBinaryExpression: config.onBinary,
  visitLogicalExpression: config.onLogical,
  // ...
  otherwise: config.otherwise
});
```

#### 🔴 **Mutable Global State**
**Lines 53-54**: Using Maps for dispatchers is global mutable state.

**Problem**: This can cause issues in testing and concurrent scenarios.

**Suggestion**: Use a registry pattern with immutable updates:
```typescript
class DispatcherRegistry<T> {
  private dispatchers: ReadonlyMap<string, T>;
  
  constructor(initial: Map<string, T> = new Map()) {
    this.dispatchers = initial;
  }
  
  register(type: string, dispatcher: T): DispatcherRegistry<T> {
    const newMap = new Map(this.dispatchers);
    newMap.set(type, dispatcher);
    return new DispatcherRegistry(newMap);
  }
  
  get(type: string): T | undefined {
    return this.dispatchers.get(type);
  }
  
  clear(): DispatcherRegistry<T> {
    return new DispatcherRegistry();
  }
}

let expressionRegistry = new DispatcherRegistry<ExpressionDispatch>();

export const registerExpressionDispatcher = (type: string, dispatcher: ExpressionDispatch): void => {
  expressionRegistry = expressionRegistry.register(type, dispatcher);
};
```

---

## 7. [`expression.ts`](src/core/ast/expression.ts)

### Issues Identified

#### 🟢 **Good Pattern**: Barrel export file for clean API surface.

#### 🟡 **Potential Circular Dependency Risk**
**Problem**: Re-exporting everything from multiple files can lead to circular dependencies.

**Suggestion**: Be explicit about what's exported and monitor for circular imports:
```typescript
// Consider using named exports instead of wildcard
export {
  type ColumnNode,
  type FunctionNode,
  // ... specific exports
} from './expression-nodes.js';
```

---

## 8. [`join-metadata.ts`](src/core/ast/join-metadata.ts)

### Issues Identified

#### 🟡 **Loose Type Definition**
**Line 8**: `[key: string]: unknown` allows any property.

**Problem**: This defeats TypeScript's type safety.

**Suggestion**: Use a more specific type or generic:
```typescript
export interface JoinMetadata<T extends Record<string, unknown> = Record<string, unknown>> {
  relationName?: string;
  custom?: T;
}

// Or use a discriminated union for known metadata types
export type JoinMetadata = 
  | { type: 'relation'; relationName: string }
  | { type: 'custom'; data: Record<string, unknown> };
```

#### 🟡 **Unsafe Type Assertion**
**Line 14**: Casting to `JoinMetadata | undefined` without validation.

**Suggestion**: Add type guard:
```typescript
const isJoinMetadata = (meta: unknown): meta is JoinMetadata => {
  return typeof meta === 'object' && meta !== null;
};

export const getJoinRelationName = (join: JoinNode): string | undefined => {
  if (!isJoinMetadata(join.meta)) return undefined;
  return join.meta.relationName;
};
```

---

## 9. [`join-node.ts`](src/core/ast/join-node.ts)

### Issues Identified

#### 🟡 **Type Narrowing with typeof**
**Line 19**: Using `typeof` to discriminate between string and object.

**Suggestion**: Use proper type guard:
```typescript
const isTableSourceNode = (value: string | TableSourceNode): value is TableSourceNode =>
  typeof value === 'object' && 'type' in value;

export const createJoinNode = (
  kind: JoinKind,
  tableName: string | TableSourceNode,
  condition: ExpressionNode,
  relationName?: string
): JoinNode => {
  const table: TableSourceNode = isTableSourceNode(tableName)
    ? tableName
    : { type: 'Table', name: tableName };
    
  return {
    type: 'Join',
    kind,
    table,
    condition,
    meta: relationName ? { relationName } : undefined
  };
};
```

#### 🟡 **Unnecessary Type Assertions**
**Lines 20, 21**: Casting to types that should already be correct.

---

## 10. [`join.ts`](src/core/ast/join.ts)

### Issues Identified

#### 🟢 **Good Pattern**: Clean interface definition.

#### 🟡 **Loose Metadata Type**
**Line 17**: Same issue as `join-metadata.ts` - `Record<string, unknown>` is too permissive.

**Suggestion**: Reference the `JoinMetadata` type from `join-metadata.ts`:
```typescript
import { JoinMetadata } from './join-metadata.js';

export interface JoinNode {
  type: 'Join';
  kind: JoinKind;
  table: TableSourceNode;
  condition: ExpressionNode;
  meta?: JoinMetadata;
}
```

---

## 11. [`query.ts`](src/core/ast/query.ts)

### Issues Identified

#### 🟢 **Good Pattern**: Comprehensive AST node definitions with clear documentation.

#### 🟡 **Large Union Types**
**Line 66**: `OrderingTerm` is a union of many types.

**Problem**: This can make type narrowing difficult.

**Suggestion**: Add helper type guards:
```typescript
export const isAliasRefTerm = (term: OrderingTerm): term is AliasRefNode =>
  'type' in term && term.type === 'AliasRef';

export const isOperandTerm = (term: OrderingTerm): term is OperandNode =>
  isOperandNode(term);

export const isExpressionTerm = (term: OrderingTerm): term is ExpressionNode =>
  !isOperandNode(term) && !isAliasRefTerm(term);
```

#### 🟡 **Optional Array Properties**
**Lines 121, 125, 133, 142**: Many optional array properties (`ctes?`, `joins`, `orderBy?`, etc.).

**Problem**: Consumers must check both `undefined` and empty array.

**Suggestion**: Use empty arrays as defaults:
```typescript
export interface SelectQueryNode {
  type: 'SelectQuery';
  ctes: CommonTableExpressionNode[];  // default to []
  from: TableSourceNode;
  columns: (ColumnNode | FunctionNode | ...)[];
  joins: JoinNode[];  // default to []
  // ...
}
```

#### 🟡 **Missing Interface for UpdateAssignmentNode**
**Line 173**: `UpdateAssignmentNode` doesn't have a `type` discriminator.

**Suggestion**: Add type discriminator for consistency:
```typescript
export interface UpdateAssignmentNode {
  type: 'UpdateAssignment';
  column: ColumnNode;
  value: OperandNode;
}
```

---

## 12. [`types.ts`](src/core/ast/types.ts)

### Issues Identified

#### 🟢 **Good Pattern**: Minimal, focused type definitions.

#### 🟡 **Structural Typing Concern**
**Problem**: `ColumnRef` and `TableRef` are structurally compatible with many objects, which could lead to accidental type matches.

**Suggestion**: Consider nominal typing or branded types:
```typescript
export interface ColumnRef {
  readonly __brand: 'ColumnRef';
  name: string;
  table?: string;
  alias?: string;
}

export const createColumnRef = (
  name: string,
  table?: string,
  alias?: string
): ColumnRef => ({
  __brand: 'ColumnRef',
  name,
  table,
  alias
});
```

---

## 13. [`window-functions.ts`](src/core/ast/window-functions.ts)

### Issues Identified

#### 🟢 **Good Pattern**: Consistent factory functions for window functions.

#### 🟡 **Conditional Property Assignment**
**Lines 19-25**: Conditionally adding properties to an object.

**Suggestion**: Use object spread for cleaner code:
```typescript
const buildWindowFunction = (
  name: string,
  args: (ColumnNode | LiteralNode | JsonPathNode)[] = [],
  partitionBy?: ColumnNode[],
  orderBy?: OrderByNode[]
): WindowFunctionNode => ({
  type: 'WindowFunction',
  name,
  args,
  ...(partitionBy?.length && { partitionBy }),
  ...(orderBy?.length && { orderBy })
});
```

#### 🟡 **Type Discrimination Logic**
**Lines 131-137**: Complex type checking logic in `windowFunction`.

**Suggestion**: Extract to helper functions:
```typescript
const toWindowArg = (
  arg: ColumnRef | ColumnNode | LiteralNode | JsonPathNode
): ColumnNode | LiteralNode | JsonPathNode => {
  if ('value' in arg && typeof (arg as LiteralNode).value !== 'undefined') {
    return arg as LiteralNode;
  }
  if ('path' in arg) {
    return arg as JsonPathNode;
  }
  return columnOperand(arg as ColumnRef | ColumnNode);
};

const nodeArgs = args.map(toWindowArg);
```

---

## Summary of Anti-Patterns by Severity

### 🔴 Critical Issues (Fix Immediately)
1. **Unsafe type casting** in `adapters.ts`
2. **Magic string "unknown"** in `expression-builders.ts`
3. **Duplicate conversion logic** in `expression-builders.ts`
4. **Mutable global state** in `expression-visitor.ts`
5. **Complex nested ternaries** in `builders.ts`

### 🟡 Medium Priority (Should Fix)
1. **Missing type guards** throughout
2. **Loose metadata types** in join-related files
3. **Inconsistent error messages** in visitor
4. **Optional array properties** in `query.ts`
5. **Type discrimination patterns** could be more robust

### 🟢 Good Patterns to Maintain
1. Factory functions for node creation
2. Visitor pattern with extensibility
3. Comprehensive type definitions
4. Clear separation of concerns
5. Barrel exports for clean API

---

## Recommended Action Plan

### Phase 1: Type Safety (Week 1)
1. Add proper type guards across all modules
2. Fix unsafe type assertions in `adapters.ts`
3. Remove magic strings and add validation
4. Consolidate duplicate type conversion logic

### Phase 2: Code Quality (Week 2)
1. Refactor complex conditional logic in `builders.ts`
2. Improve error messages in `expression-visitor.ts`
3. Fix mutable global state issues
4. Add runtime validation for critical paths

### Phase 3: API Consistency (Week 3)
1. Standardize metadata types
2. Add type discriminators where missing
3. Consider builder patterns for complex constructors
4. Document design decisions and patterns

### Phase 4: Testing & Documentation (Week 4)
1. Add unit tests for all type guards
2. Add integration tests for visitor pattern
3. Document extension points
4. Create migration guide for breaking changes

---

## Conclusion

The AST modules are generally well-structured with good separation of concerns. The main issues are:
- **Type safety**: Too many unsafe type assertions and loose types
- **Code duplication**: Similar logic repeated across files
- **Inconsistent patterns**: Some areas use modern patterns while others use older approaches

Addressing these issues will improve maintainability, reduce bugs, and make the codebase more approachable for new contributors.
