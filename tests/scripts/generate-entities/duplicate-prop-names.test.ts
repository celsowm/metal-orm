import { describe, expect, it } from 'vitest';
import { renderEntityFile } from '../../../scripts/generate-entities/render.mjs';

describe('generate-entities – duplicate property name prevention', () => {
  it('does not emit the same property name for a column AND a BelongsTo relation (no _id suffix FK)', () => {
    // Mirrors dbo.orgao_julgador where the FK column "instancia" (char(4)) has no _id suffix.
    // Without the fix the generator emitted `instancia` twice: once as @Column and once as
    // @BelongsTo, which produces invalid TypeScript.
    const schema = {
      tables: [
        {
          name: 'tipo_orgao_julgador',
          columns: [{ name: 'id', type: 'char(4)', notNull: true }],
          primaryKey: ['id']
        },
        {
          name: 'orgao_julgador',
          columns: [
            { name: 'id', type: 'int', notNull: true, autoIncrement: true },
            {
              name: 'instancia',
              type: 'char(4)',
              references: {
                table: 'tipo_orgao_julgador',
                column: 'id',
                onDelete: 'NO ACTION',
                onUpdate: 'NO ACTION'
              }
            }
          ],
          primaryKey: ['id']
        }
      ]
    };

    const output = renderEntityFile(schema, {});

    // The column property must be present
    expect(output).toContain('instancia?:');

    // The BelongsTo relation must be present and reference the correct FK
    expect(output).toContain("foreignKey: 'instancia'");

    // Count occurrences of the property name declaration – should appear exactly once as a column
    const columnDeclarations = (output.match(/\binstancia[?!]:/g) ?? []).length;
    expect(columnDeclarations).toBe(1);

    // The BelongsTo relation property must use a non-conflicting name (the target class name)
    expect(output).toContain('tipoOrgaoJulgador!: BelongsToReference<TipoOrgaoJulgador>');
  });

  it('does not emit the same property name for a column AND a BelongsTo relation (FK named after person role)', () => {
    // Mirrors dbo.processo_administrativo where "criador" int FK references usuario.id.
    // The column is named "criador" (no _id suffix) so the naming strategy would derive
    // "criador" as both the column prop and the BelongsTo prop.
    const schema = {
      tables: [
        {
          name: 'usuario',
          columns: [{ name: 'id', type: 'int', notNull: true, autoIncrement: true }],
          primaryKey: ['id']
        },
        {
          name: 'processo_administrativo',
          columns: [
            { name: 'id', type: 'int', notNull: true, autoIncrement: true },
            {
              name: 'criador',
              type: 'int',
              references: {
                table: 'usuario',
                column: 'id',
                onDelete: 'NO ACTION',
                onUpdate: 'NO ACTION'
              }
            },
            {
              name: 'responsavel_judicial',
              type: 'int',
              references: {
                table: 'usuario',
                column: 'id',
                onDelete: 'NO ACTION',
                onUpdate: 'NO ACTION'
              }
            }
          ],
          primaryKey: ['id']
        }
      ]
    };

    const output = renderEntityFile(schema, {});

    // Column properties must exist
    expect(output).toContain('criador?:');
    expect(output).toContain('responsavel_judicial?:');

    // Each FK column name must appear exactly once as a property declaration
    const criadorDeclarations = (output.match(/\bcriador[?!]:/g) ?? []).length;
    expect(criadorDeclarations).toBe(1);

    const responsavelDeclarations = (output.match(/\bresponsavel_judicial[?!]:/g) ?? []).length;
    expect(responsavelDeclarations).toBe(1);

    // BelongsTo decorators must still reference the correct FK column names
    expect(output).toContain("foreignKey: 'criador'");
    expect(output).toContain("foreignKey: 'responsavel_judicial'");
  });
});
