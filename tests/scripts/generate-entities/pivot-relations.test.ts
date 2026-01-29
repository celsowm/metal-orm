import { describe, it, expect } from 'vitest';
import { mapRelations } from '../../../scripts/generate-entities/schema.mjs';

const defaultNaming = {
  classNameFromTable: (name: string) => name.charAt(0).toUpperCase() + name.slice(1),
  belongsToProperty: (fkName: string, _target: string) => fkName.replace(/_id$/, ''),
  hasManyProperty: (tableName: string) => tableName + 's',
  hasOneProperty: (tableName: string) => tableName,
  belongsToManyProperty: (tableName: string) => tableName + 's'
};

describe('mapRelations pivot table handling', () => {
  it('does NOT generate HasMany relations TO pivot tables', () => {
    const tables = [
      {
        name: 'acervo',
        columns: [
          { name: 'id', primaryKey: true },
          { name: 'nome' }
        ],
        primaryKey: ['id']
      },
      {
        name: 'classificacao',
        columns: [
          { name: 'id', primaryKey: true },
          { name: 'nome' }
        ],
        primaryKey: ['id']
      },
      {
        name: 'acervo_classificacao',
        columns: [
          { name: 'id', primaryKey: true },
          { name: 'acervo_id', references: { table: 'acervo', column: 'id' } },
          { name: 'classificacao_id', references: { table: 'classificacao', column: 'id' } },
          { name: 'distribuicao_automatica' }
        ],
        primaryKey: ['id']
      }
    ];

    const relations = mapRelations(tables, defaultNaming);

    // Acervo should have BelongsToMany to Classificacao
    const acervoRelations = relations.get('acervo');
    expect(acervoRelations).toBeDefined();
    
    const belongsToMany = acervoRelations.find(
      (r: any) => r.kind === 'belongsToMany' && r.target === 'classificacao'
    );
    expect(belongsToMany).toBeDefined();
    expect(belongsToMany.pivotTable).toBe('acervo_classificacao');

    // Acervo should NOT have HasMany to acervo_classificacao
    const hasMany = acervoRelations.find(
      (r: any) => r.kind === 'hasMany' && r.target === 'acervo_classificacao'
    );
    expect(hasMany).toBeUndefined();

    // Same for Classificacao
    const classificacaoRelations = relations.get('classificacao');
    const hasManyToP = classificacaoRelations.find(
      (r: any) => r.kind === 'hasMany' && r.target === 'acervo_classificacao'
    );
    expect(hasManyToP).toBeUndefined();
  });

  it('still generates HasMany for non-pivot tables', () => {
    const tables = [
      {
        name: 'user',
        columns: [
          { name: 'id', primaryKey: true },
          { name: 'name' }
        ],
        primaryKey: ['id']
      },
      {
        name: 'order',
        columns: [
          { name: 'id', primaryKey: true },
          { name: 'user_id', references: { table: 'user', column: 'id' } },
          { name: 'total' }
        ],
        primaryKey: ['id']
      }
    ];

    const relations = mapRelations(tables, defaultNaming);

    // User should have HasMany to orders
    const userRelations = relations.get('user');
    const hasMany = userRelations.find(
      (r: any) => r.kind === 'hasMany' && r.target === 'order'
    );
    expect(hasMany).toBeDefined();
    expect(hasMany.foreignKey).toBe('user_id');
  });

  it('pivot table entity still has BelongsTo relations', () => {
    const tables = [
      {
        name: 'acervo',
        columns: [{ name: 'id', primaryKey: true }],
        primaryKey: ['id']
      },
      {
        name: 'classificacao',
        columns: [{ name: 'id', primaryKey: true }],
        primaryKey: ['id']
      },
      {
        name: 'acervo_classificacao',
        columns: [
          { name: 'id', primaryKey: true },
          { name: 'acervo_id', references: { table: 'acervo', column: 'id' } },
          { name: 'classificacao_id', references: { table: 'classificacao', column: 'id' } }
        ],
        primaryKey: ['id']
      }
    ];

    const relations = mapRelations(tables, defaultNaming);

    // Pivot table should still have BelongsTo relations for direct querying
    const pivotRelations = relations.get('acervo_classificacao');
    expect(pivotRelations).toBeDefined();

    const belongsToAcervo = pivotRelations.find(
      (r: any) => r.kind === 'belongsTo' && r.target === 'acervo'
    );
    expect(belongsToAcervo).toBeDefined();

    const belongsToClassif = pivotRelations.find(
      (r: any) => r.kind === 'belongsTo' && r.target === 'classificacao'
    );
    expect(belongsToClassif).toBeDefined();
  });
});
