import { toPascalCase } from './utils.js';

const getColType = (dbType) => {
    if (/CHAR|TEXT|CLOB/i.test(dbType)) return 'col.string()';
    if (/INT/i.test(dbType)) return 'col.int()';
    if (/REAL|FLOA|DOUB/i.test(dbType)) return 'col.float()';
    if (/BOOL/i.test(dbType)) return 'col.boolean()';
    if (/DATE|TIME/i.test(dbType)) return 'col.datetime()';
    return 'col.string()'; // Default
};

const getTsType = (dbType) => {
    if (/CHAR|TEXT|CLOB/i.test(dbType)) return 'string';
    if (/INT|REAL|FLOA|DOUB/i.test(dbType)) return 'number';
    if (/BOOL/i.test(dbType)) return 'boolean';
    if (/DATE|TIME/i.test(dbType)) return 'Date';
    return 'string'; // Default
};


export const generateCode = (schema, fullSchema) => {
    let code = `import { Entity, Column, PrimaryKey, BelongsTo, HasMany } from 'metal-orm/decorators';\n`;
    code += `import { col } from 'metal-orm';\n\n`;

    for (const table of schema.tables) {
        const className = toPascalCase(table.name);

        // Find relationships
        const belongsTo = table.foreignKeys || [];
        const hasMany = [];
        for (const t of fullSchema.tables) {
            for (const fk of t.foreignKeys || []) {
                if (fk.referencesTable === table.name) {
                    hasMany.push({
                        table: t.name,
                        column: fk.column,
                    });
                }
            }
        }

        const imports = new Set();
        hasMany.forEach(rel => imports.add(toPascalCase(rel.table)));
        belongsTo.forEach(rel => imports.add(toPascalCase(rel.referencesTable)));
        imports.delete(className);

        for(const imp of imports) {
            code += `import { ${imp} } from './${imp}';\n`;
        }
        if(imports.size > 0) code += '\n';


        code += `@Entity({ tableName: '${table.name}' })\n`;
        code += `export class ${className} {\n`;

        table.columns.forEach(column => {
            const decorators = [];
            if (table.primaryKey.includes(column.name)) {
                decorators.push(`@PrimaryKey(${getColType(column.type)})`);
            } else {
                decorators.push(`@Column(${getColType(column.type)})`);
            }

            const tsType = getTsType(column.type);
            code += `  ${decorators.join(' ')}\n`;
            code += `  ${column.name}${column.isNotNull ? '!' : '?'}: ${tsType}${!column.isNotNull ? ' | null' : ''};\n\n`;
        });

        belongsTo.forEach(rel => {
            code += `  @BelongsTo({ target: () => ${toPascalCase(rel.referencesTable)}, foreignKey: '${rel.column}' })\n`;
            code += `  ${rel.referencesTable}!: ${toPascalCase(rel.referencesTable)};\n\n`;
        });

        hasMany.forEach(rel => {
            code += `  @HasMany({ target: () => ${toPascalCase(rel.table)}, foreignKey: '${rel.column}' })\n`;
            code += `  ${rel.table}!: ${toPascalCase(rel.table)}[];\n\n`;
        });

        code += `}\n\n`;
    }

    return code;
};
