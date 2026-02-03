import { describe, it, expect } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { belongsToMany } from '../../src/schema/relation.js';
import { hydrateRows } from '../../src/orm/hydration.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { makeRelationAlias } from '../../src/query-builder/relation-alias.js';

/**
 * This test verifies that pivot table extra columns (like `distribuicao_automatica`)
 * can be accessed via `_pivot` on the BelongsToMany relation WITHOUT needing
 * a separate HasMany relation to the pivot table entity.
 */
describe('BelongsToMany pivot column access (no HasMany needed)', () => {
  // Simulates the acervo_classificacao scenario from SQL Server
  const Acervo = defineTable('acervo', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    nome: col.notNull(col.varchar(125))
  });

  const Classificacao = defineTable('classificacao', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    nome: col.notNull(col.varchar(63)),
    peso: col.int()
  });

  // Pivot table with extra column `distribuicao_automatica`
  const AcervoClassificacao = defineTable('acervo_classificacao', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    acervo_id: col.notNull(col.int()),
    classificacao_id: col.notNull(col.int()),
    distribuicao_automatica: col.boolean() // Extra pivot column
  });

  // Only BelongsToMany - no HasMany to AcervoClassificacao needed
  Acervo.relations = {
    classificacoes: belongsToMany(Classificacao, AcervoClassificacao, {
      pivotForeignKeyToRoot: 'acervo_id',
      pivotForeignKeyToTarget: 'classificacao_id'
    })
  };

  it('can access extra pivot columns via _pivot without HasMany', () => {
    const builder = new SelectQueryBuilder(Acervo).include('classificacoes', {
      columns: ['id', 'nome', 'peso'],
      pivot: { columns: ['distribuicao_automatica'] }
    });

    const compiled = builder.compile(new SqliteDialect());
    
    // Verify the query joins the pivot table
    expect(compiled.sql).toContain('JOIN "acervo_classificacao"');
    expect(compiled.sql).toContain('JOIN "classificacao"');

    const plan = builder.getHydrationPlan();
    expect(plan).toBeDefined();

    const relationPlan = plan!.relations.find(rel => rel.name === 'classificacoes');
    expect(relationPlan).toBeDefined();
    expect(relationPlan!.pivot).toBeDefined();
    expect(relationPlan!.pivot!.columns).toEqual(['distribuicao_automatica']);

    // Build a mock row with pivot data
    const row: Record<string, any> = {};
    plan!.rootColumns.forEach(col => {
      row[col] = col === plan!.rootPrimaryKey ? 1 : `root-${col}`;
    });

    row[makeRelationAlias(relationPlan!.aliasPrefix, relationPlan!.targetPrimaryKey)] = 100;
    relationPlan!.columns.forEach(col => {
      const alias = makeRelationAlias(relationPlan!.aliasPrefix, col);
      if (col === relationPlan!.targetPrimaryKey) {
        row[alias] = 100;
      } else if (col === 'nome') {
        row[alias] = 'Classificação A';
      } else if (col === 'peso') {
        row[alias] = 5;
      }
    });

    // Set the pivot column value
    const pivotAlias = makeRelationAlias(relationPlan!.pivot!.aliasPrefix, 'distribuicao_automatica');
    row[pivotAlias] = true;

    const hydrated = hydrateRows([row], plan);
    
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0].classificacoes).toHaveLength(1);
    
    // Access the pivot data via _pivot - no HasMany needed!
    const classificacao = hydrated[0].classificacoes[0];
    expect(classificacao.id).toBe(100);
    expect(classificacao.nome).toBe('Classificação A');
    expect(classificacao.peso).toBe(5);
    expect(classificacao._pivot).toBeDefined();
    expect(classificacao._pivot!.distribuicao_automatica).toBe(true);
  });

  it('hydrates multiple rows with different pivot values', () => {
    const builder = new SelectQueryBuilder(Acervo).include('classificacoes', {
      columns: ['id', 'nome'],
      pivot: { columns: ['distribuicao_automatica'] }
    });

    const plan = builder.getHydrationPlan();
    expect(plan).toBeDefined();

    const relationPlan = plan!.relations.find(rel => rel.name === 'classificacoes');

    // Acervo 1 with two classificacoes having different pivot values
    const rows: Record<string, any>[] = [
      {
        id: 1,
        nome: 'Acervo 1',
        [makeRelationAlias(relationPlan!.aliasPrefix, 'id')]: 10,
        [makeRelationAlias(relationPlan!.aliasPrefix, 'nome')]: 'Class A',
        [makeRelationAlias(relationPlan!.pivot!.aliasPrefix, 'distribuicao_automatica')]: true
      },
      {
        id: 1,
        nome: 'Acervo 1',
        [makeRelationAlias(relationPlan!.aliasPrefix, 'id')]: 20,
        [makeRelationAlias(relationPlan!.aliasPrefix, 'nome')]: 'Class B',
        [makeRelationAlias(relationPlan!.pivot!.aliasPrefix, 'distribuicao_automatica')]: false
      }
    ];

    const hydrated = hydrateRows(rows, plan);

    expect(hydrated).toHaveLength(1);
    expect(hydrated[0].classificacoes).toHaveLength(2);
    
    expect(hydrated[0].classificacoes[0]._pivot!.distribuicao_automatica).toBe(true);
    expect(hydrated[0].classificacoes[1]._pivot!.distribuicao_automatica).toBe(false);
  });
});

describe('BelongsToMany pivot merge (opt-in)', () => {
  const Users = defineTable('users', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    nome: col.notNull(col.varchar(100))
  });

  const Projects = defineTable('projects', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    nome: col.notNull(col.varchar(100))
  });

  const UserProject = defineTable('user_projects', {
    id: col.primaryKey(col.autoIncrement(col.int())),
    user_id: col.notNull(col.int()),
    project_id: col.notNull(col.int()),
    nome: col.varchar(100), // Intentionally collides with target column
    assigned_at: col.varchar(25)
  });

  Users.relations = {
    projects: belongsToMany(Projects, UserProject, {
      pivotForeignKeyToRoot: 'user_id',
      pivotForeignKeyToTarget: 'project_id'
    })
  };

  it('merges pivot columns onto child without overwriting existing fields', () => {
    const builder = new SelectQueryBuilder(Users).include('projects', {
      columns: ['id', 'nome'],
      pivot: { columns: ['assigned_at', 'nome'], merge: true }
    });

    const plan = builder.getHydrationPlan();
    expect(plan).toBeDefined();

    const relationPlan = plan!.relations.find(rel => rel.name === 'projects');
    expect(relationPlan).toBeDefined();

    const row: Record<string, any> = {
      id: 1,
      nome: 'User A',
      [makeRelationAlias(relationPlan!.aliasPrefix, 'id')]: 10,
      [makeRelationAlias(relationPlan!.aliasPrefix, 'nome')]: 'Project X',
      [makeRelationAlias(relationPlan!.pivot!.aliasPrefix, 'assigned_at')]: '2024-01-10',
      [makeRelationAlias(relationPlan!.pivot!.aliasPrefix, 'nome')]: 'Pivot Name'
    };

    const hydrated = hydrateRows([row], plan);
    const project = hydrated[0].projects[0];

    expect(project.nome).toBe('Project X'); // target wins
    expect(project.assigned_at).toBe('2024-01-10'); // merged from pivot
    expect(project._pivot).toMatchObject({
      assigned_at: '2024-01-10',
      nome: 'Pivot Name'
    });
  });
});
