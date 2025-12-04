import { describe, it, expect } from 'vitest';
import { hydrateRows } from '../src/orm/hydration.js';
import { SelectQueryBuilder } from '../src/query-builder/select.js';
import { SqliteDialect } from '../src/core/dialect/sqlite/index.js';
import { makeRelationAlias } from '../src/query-builder/relation-alias.js';
import { Users } from '../src/playground/features/playground/data/schema.js';

describe('BelongsToMany hydration', () => {
  it('includes pivot metadata for a projects include', () => {
    const builder = new SelectQueryBuilder(Users).include('projects', {
      columns: ['id', 'name', 'client'],
      pivot: { columns: ['assigned_at', 'role_id'] }
    });

    const compiled = builder.compile(new SqliteDialect());
    expect(compiled.sql).toContain('JOIN "project_assignments"');
    expect(compiled.sql).toContain('JOIN "projects"');

    const plan = builder.getHydrationPlan();
    expect(plan).toBeDefined();

    const relationPlan = plan!.relations.find(rel => rel.name === 'projects');
    expect(relationPlan).toBeDefined();
    expect(relationPlan!.pivot).toBeDefined();
    expect(relationPlan!.pivot!.columns).toEqual(['assigned_at', 'role_id']);
    expect(relationPlan!.pivot!.aliasPrefix).toBe('projects_pivot');

    const row: Record<string, any> = {};
    plan!.rootColumns.forEach(col => {
      row[col] = col === plan!.rootPrimaryKey ? 1 : `root-${col}`;
    });

    row[makeRelationAlias(relationPlan!.aliasPrefix, relationPlan!.targetPrimaryKey)] = 42;
    relationPlan!.columns.forEach(col => {
      const alias = makeRelationAlias(relationPlan!.aliasPrefix, col);
      row[alias] = col === relationPlan!.targetPrimaryKey ? 42 : `project-${col}`;
    });

    relationPlan!.pivot!.columns.forEach((col, idx) => {
      const alias = makeRelationAlias(relationPlan!.pivot!.aliasPrefix, col);
      row[alias] = `pivot-${col}-${idx}`;
    });

    const hydrated = hydrateRows([row], plan);
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0].projects).toHaveLength(1);
    expect(hydrated[0].projects[0]).toEqual({
      id: 42,
      name: 'project-name',
      client: 'project-client',
      _pivot: {
        assigned_at: 'pivot-assigned_at-0',
        role_id: 'pivot-role_id-1'
      }
    });
  });
});
