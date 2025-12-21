import { describe, expect, it } from 'vitest';

import { BelongsToMany } from '../../src/decorators/relations.js';
import { bootstrapEntities, selectFromEntity } from '../../src/decorators/bootstrap.js';
import { Entity } from '../../src/decorators/entity.js';
import { Column, PrimaryKey } from '../../src/decorators/column-decorator.js';
import { col } from '../../src/schema/column-types.js';
import type { ManyToManyCollection } from '../../src/schema/types.js';

@Entity()
class User {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @BelongsToMany({
    target: () => Project,
    pivotTable: () => ProjectAssignment,
    pivotForeignKeyToRoot: 'user_id',
    pivotForeignKeyToTarget: 'project_id'
  })
  projects!: ManyToManyCollection<Project, ProjectAssignment>;
}

@Entity()
class Project {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;
}

@Entity()
class ProjectAssignment {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.int())
  user_id!: number;

  @Column(col.int())
  project_id!: number;

  @Column(col.varchar(50))
  assigned_at!: string;
}

describe('BelongsToMany pivot include typing', () => {
  it('catches invalid pivot columns when the pivot entity is typed', () => {
    bootstrapEntities();

    const builder = selectFromEntity(User).include('projects', {
      pivot: { columns: ['assigned_at'] }
    });

    expect(() => {
      builder.include('projects', {
        // @ts-expect-error Column 'typo_column' not defined on pivot table 'project_assignments'
        pivot: { columns: ['typo_column'] }
      });
    }).toThrowError(/Column 'typo_column' not found on pivot table 'project_assignments'/);
  });
});
