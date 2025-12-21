import { describe, expect, it } from 'vitest';

import { defineTable, setRelations } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { belongsToMany } from '../../src/schema/relation.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';

const Users = defineTable('users', {
  id: col.primaryKey(col.int()),
});

const Projects = defineTable('projects', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
});

const ProjectAssignments = defineTable('project_assignments', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  project_id: col.int(),
  assigned_at: col.varchar(50),
});

setRelations(Users, {
  projects: belongsToMany(Projects, ProjectAssignments, {
    pivotForeignKeyToRoot: 'user_id',
    pivotForeignKeyToTarget: 'project_id',
    defaultPivotColumns: ['assigned_at'],
  }),
});

describe('setRelations include typing', () => {
  it('hydrates pivot metadata when include options are typed', () => {
    const builder = new SelectQueryBuilder(Users).include('projects', {
      columns: ['id'],
      pivot: { columns: ['assigned_at'] }
    });

    const plan = builder.getHydrationPlan();
    expect(plan).toBeDefined();
    const relPlan = plan!.relations.find(rel => rel.name === 'projects');
    expect(relPlan).toBeDefined();
    expect(relPlan!.pivot?.columns).toContain('assigned_at');
  });

  it('flags invalid pivot columns at compile time', () => {
    const builder = new SelectQueryBuilder(Users);

    expect(() => {
      // @ts-expect-error Column 'bad_column' not defined on pivot table
      builder.include('projects', { pivot: { columns: ['bad_column'] } });
    }).toThrowError(/Column 'bad_column' not found on pivot table 'project_assignments'/);
  });
});
