import { SelectQueryBuilder } from '../../../../../query-builder/select.js';
import { TableDef } from '../../../../../schema/table.js';

/**
 * Extracts the TypeScript code from a build function
 */
function extractTypeScriptCode<TTable extends TableDef>(
  buildFn: (builder: SelectQueryBuilder<any, TTable>) => SelectQueryBuilder<any, TTable>
): string {
    const fnString = buildFn.toString();

    // Remove the function wrapper and return statement
    const bodyMatch = fnString.match(/=>\s*\{?\s*(.*?)\s*\}?$/s);
    if (bodyMatch) {
        let code = bodyMatch[1].trim();

        // Remove trailing semicolon if present
        code = code.replace(/;$/, '');

        // Clean up indentation (remove common leading spaces)
        const lines = code.split('\n');
        if (lines.length > 1) {
            // Find the minimum indentation of non-empty lines
            const nonEmptyLines = lines.filter(line => line.trim().length > 0);
            const minIndent = Math.min(...nonEmptyLines.map(line => {
                const match = line.match(/^(\s*)/);
                return match ? match[1].length : 0;
            }));

            // Remove the common indentation
            code = lines.map(line => line.slice(minIndent)).join('\n').trim();
        }

        return code;
    }

    return fnString;
}

export interface Scenario {
    id: string;
    title: string;
    description: string;
    category: string;
    build: <TTable extends TableDef>(builder: SelectQueryBuilder<any, TTable>) => SelectQueryBuilder<any, TTable>;

    code?: string;
    typescriptCode?: string;
}

/**
 * Creates a scenario with auto-extracted TypeScript code
 */
export function createScenario(config: {
    id: string;
    title: string;
    description: string;
    category: string;
    build: <TTable extends TableDef>(builder: SelectQueryBuilder<any, TTable>) => SelectQueryBuilder<any, TTable>;
}): Scenario {
    return {
        ...config,
        get code() {
            return extractTypeScriptCode(config.build);
        },
        get typescriptCode() {
            return extractTypeScriptCode(config.build);
        }
    };
}
