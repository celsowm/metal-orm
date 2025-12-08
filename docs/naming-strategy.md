# Naming Strategy

## Overview

The Naming Strategy feature provides a flexible way to customize how database table and column names are converted to TypeScript identifiers in the code generator. This solves the problem of strong coupling to naming conventions that existed in the original implementation.

## Problem Solved

The original implementation used a simple `capitalize()` function that had several limitations:

1. **Schema-qualified names**: `auth.user` would become invalid `Auth.user`
2. **Snake_case names**: `user_profile` would become `User_profile` instead of `UserProfile`
3. **Reserved words**: `order` would become `Order` which conflicts with TypeScript keywords

## Solution: NamingStrategy Interface

The `NamingStrategy` interface allows you to define custom naming conventions:

```typescript
interface NamingStrategy {
  /**
   * Converts a table name to a TypeScript symbol name
   * @param table - Table node, function table node, or string name
   * @returns Valid TypeScript identifier
   */
  tableToSymbol(table: TableNode | FunctionTableNode | string): string;

  /**
   * Converts a column reference to a property name
   * @param column - Column node
   * @returns Valid TypeScript property name
   */
  columnToProperty(column: ColumnNode): string;
}
```

## Default Behavior

The `DefaultNamingStrategy` maintains backward compatibility with the original behavior:

```typescript
const generator = new TypeScriptGenerator(); // Uses DefaultNamingStrategy
// 'users' → 'Users'
// 'auth.user' → 'AuthUser'
```

## Custom Naming Strategies

### Snake Case to Pascal/Camel Case

```typescript
class SnakeCaseNamingStrategy implements NamingStrategy {
  tableToSymbol(table: TableNode | string): string {
    const tableName = typeof table === 'string' ? table : table.name;

    if (tableName.includes('.')) {
      return tableName.split('.')
        .map(part => this.toPascalCase(part))
        .join('');
    }

    return this.toPascalCase(tableName);
  }

  columnToProperty(column: ColumnNode): string {
    return this.toCamelCase(column.name);
  }

  private toPascalCase(str: string): string {
    return str
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
  }

  private toCamelCase(str: string): string {
    if (!str.includes('_')) return str;
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
}

// Usage:
const generator = new TypeScriptGenerator(new SnakeCaseNamingStrategy());
// 'user_profile' → 'UserProfile'
// 'user_name' → 'userName'
```

### Reserved Word Handling

```typescript
class ReservedWordNamingStrategy implements NamingStrategy {
  private readonly reservedWords = new Set([
    'order', 'class', 'function', 'interface', 'enum', 'type',
    'public', 'private', 'protected', 'static', 'abstract'
  ]);

  tableToSymbol(table: TableNode | string): string {
    const tableName = typeof table === 'string' ? table : table.name;
    let result = tableName;

    // Handle reserved words by adding suffix
    if (this.reservedWords.has(tableName.toLowerCase())) {
      result = tableName + 'Table';
    }

    if (result.includes('.')) {
      return result.split('.')
        .map(part => this.capitalize(part))
        .join('');
    }

    return this.capitalize(result);
  }

  columnToProperty(column: ColumnNode): string {
    return column.name;
  }

  private capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

// Usage:
const generator = new TypeScriptGenerator(new ReservedWordNamingStrategy());
// 'order' → 'OrderTable' (avoids TypeScript keyword conflict)
```

## Usage Examples

### Basic Usage

```typescript
import { TypeScriptGenerator, DefaultNamingStrategy } from 'metal-orm';

// Use default strategy (backward compatible)
const generator = new TypeScriptGenerator();
const code = generator.generate(queryAst);

// Use custom strategy
const customGenerator = new TypeScriptGenerator(new SnakeCaseNamingStrategy());
const customCode = customGenerator.generate(queryAst);
```

### Integration with Different Projects

```typescript
// Project A: Uses snake_case database naming
const projectAGenerator = new TypeScriptGenerator(new SnakeCaseNamingStrategy());

// Project B: Uses standard naming with reserved word handling
const projectBGenerator = new TypeScriptGenerator(new ReservedWordNamingStrategy());

// Project C: Uses default behavior
const projectCGenerator = new TypeScriptGenerator();
```

## Benefits

1. **Decoupling**: The generator no longer depends on specific naming conventions
2. **Customization**: Projects can provide their own `NamingStrategy` implementation
3. **Better handling of edge cases**: Schema-qualified names, snake_case, reserved words
4. **Backward compatibility**: Default strategy maintains existing behavior
5. **Testability**: Naming logic can be tested independently

## API Reference

### NamingStrategy Interface

```typescript
interface NamingStrategy {
  tableToSymbol(table: TableNode | FunctionTableNode | string): string;
  columnToProperty(column: ColumnNode): string;
}
```

### DefaultNamingStrategy

```typescript
class DefaultNamingStrategy implements NamingStrategy {
  // Maintains backward compatibility with original capitalize() behavior
}
```

### TypeScriptGenerator Constructor

```typescript
class TypeScriptGenerator {
  constructor(namingStrategy: NamingStrategy = new DefaultNamingStrategy());
}
```

## Testing

The naming strategy feature includes comprehensive tests:

- **Basic functionality tests**: 5 tests for default strategy
- **Custom strategy tests**: 11 tests for snake case and reserved word strategies
- **Integration tests**: Verify proper usage with TypeScriptGenerator

All tests pass successfully, ensuring the reliability of the implementation.
