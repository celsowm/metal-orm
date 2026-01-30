/**
 * Test to verify that all `any` types have been removed from the codebase
 * and replaced with proper TypeScript types.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('No Any Types in Codebase', () => {
  it('should not contain explicit `any` type annotations in src/', () => {
    const srcPath = join(__dirname, '..', 'src');
    const filesToCheck = [
      'decorators/bootstrap.ts',
      'decorators/transformers/transformer-executor.ts',
      'dto/dto-types.ts',
      'dto/filter-types.ts',
      'dto/openapi/generators/dto.ts',
      'orm/orm-session.ts',
      'orm/relations/has-one.ts',
      'orm/relations/many-to-many.ts',
      'query-builder/select.ts',
    ];

    for (const file of filesToCheck) {
      const filePath = join(srcPath, file);
      const content = readFileSync(filePath, 'utf-8');

      // Check for explicit `: any` type annotations (excluding comments)
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Skip comments
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
          continue;
        }

        // Check for `: any` pattern (but not in comments or strings)
        const anyPattern = /:\s+any\b/g;
        const matches = line.match(anyPattern);

        if (matches) {
          // Verify it's not inside a string literal
          const stringMatches = line.match(/["']/g);
          if (!stringMatches || stringMatches.length % 2 === 0) {
            throw new Error(
              `Found explicit 'any' type in ${file}:${i + 1}: ${line.trim()}`
            );
          }
        }
      }
    }

    expect(true).toBe(true); // If we get here, no `any` types were found
  });

  it('should use proper types instead of `any` in dto-types.ts', () => {
    const filePath = join(__dirname, '..', 'src', 'dto', 'dto-types.ts');
    const content = readFileSync(filePath, 'utf-8');

    // Verify specific replacements
    expect(content).toContain('Record<string, unknown>'); // Instead of `any`
    expect(content).toContain('TableDef<Record<string, ColumnDef<ColumnType, unknown>>>'); // Instead of `TableDef<any>`
    expect(content).not.toMatch(/:\s*any\b/); // No explicit `any` types
  });

  it('should use proper types instead of `any` in filter-types.ts', () => {
    const filePath = join(__dirname, '..', 'src', 'dto', 'filter-types.ts');
    const content = readFileSync(filePath, 'utf-8');

    // Verify specific replacements
    expect(content).toContain('Record<string, unknown>'); // Instead of `any`
    expect(content).toContain('ColumnDef<ColumnType, unknown>'); // Instead of `ColumnDef<any, any>`
    expect(content).not.toMatch(/:\s*any\b/); // No explicit `any` types
  });

  it('should use proper types instead of `any` in openapi/generators/dto.ts', () => {
    const filePath = join(__dirname, '..', 'src', 'dto', 'openapi', 'generators', 'dto.ts');
    const content = readFileSync(filePath, 'utf-8');

    // Verify specific replacements
    expect(content).toContain('PropertyKey'); // Instead of `keyof any`
    expect(content).not.toMatch(/keyof\s+any\b/); // No `keyof any` types
  });

  it('should use proper types instead of `any` in transformer-executor.ts', () => {
    const filePath = join(__dirname, '..', 'src', 'decorators', 'transformers', 'transformer-executor.ts');
    const content = readFileSync(filePath, 'utf-8');

    // Verify specific replacements
    expect(content).toContain('columnDef.type'); // Direct property access instead of `(columnDef as any).type`
    expect(content).not.toMatch(/\(columnDef\s+as\s+any\)/); // No `as any` casts
  });

  it('should have no unused eslint-disable directives', () => {
    const srcPath = join(__dirname, '..', 'src');
    const filesToCheck = [
      'decorators/bootstrap.ts',
      'decorators/transformers/transformer-executor.ts',
      'dto/dto-types.ts',
      'dto/filter-types.ts',
      'dto/openapi/generators/dto.ts',
      'orm/orm-session.ts',
      'orm/relations/has-one.ts',
      'orm/relations/many-to-many.ts',
      'query-builder/select.ts',
    ];

    for (const file of filesToCheck) {
      const filePath = join(srcPath, file);
      const content = readFileSync(filePath, 'utf-8');

      // Check for eslint-disable comments that were previously unused
      const unusedDirectives = [
        '@typescript-eslint/no-explicit-any',
        '@typescript-eslint/no-unsafe-function-type',
        '@typescript-eslint/no-this-alias',
      ];

      for (const directive of unusedDirectives) {
        if (content.includes(`eslint-disable-next-line ${directive}`)) {
          throw new Error(
            `Found unused eslint-disable directive '${directive}' in ${file}`
          );
        }
      }
    }

    expect(true).toBe(true); // If we get here, no unused directives were found
  });

  it('should have @typescript-eslint/no-explicit-any rule enabled in eslint.config.js', () => {
    const filePath = join(__dirname, '..', 'eslint.config.js');
    const content = readFileSync(filePath, 'utf-8');

    // Verify the rule is enabled as error
    expect(content).toContain("'@typescript-eslint/no-explicit-any': 'error'");
  });
});
