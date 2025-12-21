import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { col } from '../../src/schema/column-types.js';
import type {
  HasManyCollection,
  HasOneReference,
  ManyToManyCollection
} from '../../src/schema/types.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  HasMany,
  HasOne,
  BelongsTo,
  BelongsToMany,
  PrimaryKey,
  getTableDefFromEntity
} from '../../src/decorators/index.js';
import { createEntityFromRow } from '../../src/orm/entity.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import {
  closeDb,
  createSqliteSessionFromDb
} from './sqlite-helpers.ts';

@Entity()
class Project {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;

  @HasMany({ target: () => Task, foreignKey: 'projectId' })
  tasks!: HasManyCollection<Task>;
}

@Entity()
class Task {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  title!: string;

  @Column(col.notNull(col.varchar(50)))
  status!: string;

  @Column(col.notNull(col.int()))
  priority!: number;

  @Column(col.notNull(col.int()))
  projectId!: number;

  @BelongsTo({ target: () => Project, foreignKey: 'projectId' })
  project?: Project;

  @HasOne({ target: () => TaskDetail, foreignKey: 'taskId' })
  detail!: HasOneReference<TaskDetail>;

  @BelongsToMany({
    target: () => Tag,
    pivotTable: () => TaskTag,
    pivotForeignKeyToRoot: 'taskId',
    pivotForeignKeyToTarget: 'tagId'
  })
  tags!: ManyToManyCollection<Tag>;
}

@Entity()
class TaskDetail {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  taskId!: number;

  @Column(col.notNull(col.varchar(1024)))
  notes!: string;

  @BelongsTo({ target: () => Task, foreignKey: 'taskId' })
  task?: Task;
}

@Entity()
class Tag {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(64)))
  label!: string;

  @BelongsToMany({
    target: () => Task,
    pivotTable: () => TaskTag,
    pivotForeignKeyToRoot: 'tagId',
    pivotForeignKeyToTarget: 'taskId'
  })
  tasks!: ManyToManyCollection<Task>;
}

@Entity()
class TaskTag {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  taskId!: number;

  @Column(col.notNull(col.int()))
  tagId!: number;
}

describe('decorators CRUD-style relations e2e (sqlite)', () => {
  it('creates, updates, and detaches related data while syncing hasMany, hasOne, and many-to-many relations', async () => {
    const db = new sqlite3.Database(':memory:');
    try {
      const tables = bootstrapEntities();
      const projectTable = getTableDefFromEntity(Project)!;
      const taskTable = getTableDefFromEntity(Task)!;
      const detailTable = getTableDefFromEntity(TaskDetail)!;
      const tagTable = getTableDefFromEntity(Tag)!;
      const pivotTable = getTableDefFromEntity(TaskTag)!;

      expect(projectTable.name).toBe('projects');
      expect(taskTable.name).toBe('tasks');
      expect(detailTable.name).toBe('task_details');
      expect(tagTable.name).toBe('tags');
      expect(pivotTable.name).toBe('task_tags');
      expect(tables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'projects' }),
          expect.objectContaining({ name: 'tasks' }),
          expect.objectContaining({ name: 'task_details' }),
          expect.objectContaining({ name: 'tags' }),
          expect.objectContaining({ name: 'task_tags' })
        ])
      );

      const session = createSqliteSessionFromDb(db);
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        projectTable,
        taskTable,
        detailTable,
        tagTable,
        pivotTable
      );

      const project = createEntityFromRow(session, projectTable, {
        name: 'Mission Control'
      }) as unknown as Project;

      const bugTag = createEntityFromRow(session, tagTable, {
        label: 'bug'
      }) as unknown as Tag;

      const choreTag = createEntityFromRow(session, tagTable, {
        label: 'chore'
      }) as unknown as Tag;

      const researchTag = createEntityFromRow(session, tagTable, {
        label: 'research'
      }) as unknown as Tag;

      await session.commit();

      const designTask = project.tasks.add({
        title: 'Define architecture',
        status: 'draft',
        priority: 1
      });

      const launchTask = project.tasks.add({
        title: 'Run integration',
        status: 'planned',
        priority: 2
      });

      await session.commit();

      designTask.detail.set({ notes: 'Map out architecture' });
      launchTask.detail.set({ notes: 'Coordinate integration smoke tests' });
      designTask.tags.attach(bugTag);
      designTask.tags.attach(researchTag);
      launchTask.tags.attach(choreTag);

      await session.commit();

      const verificationSession = createSqliteSessionFromDb(db);
      const persistedProject = (await verificationSession.find(Project, project.id)) as unknown as Project;
      expect(persistedProject).toBeDefined();
      expect(persistedProject!.name).toBe('Mission Control');

      const persistedTasks = await persistedProject.tasks.load();
      expect(persistedTasks).toHaveLength(2);

      const loadedDesign = persistedTasks.find(task => task.title === 'Define architecture');
      expect(loadedDesign).toBeDefined();
      expect((await loadedDesign!.detail.load())?.notes).toBe('Map out architecture');
      expect((await loadedDesign!.tags.load()).map(tag => tag.label).sort()).toEqual(
        ['bug', 'research'].sort()
      );

      const loadedIntegration = persistedTasks.find(task => task.title === 'Run integration');
      expect(loadedIntegration).toBeDefined();
      expect((await loadedIntegration!.tags.load()).map(tag => tag.label)).toEqual(['chore']);

      const followUpTag = createEntityFromRow(session, tagTable, {
        label: 'follow-up'
      }) as unknown as Tag;
      await session.flush();
      await session.relationChanges.process();
      await session.flush();

      project.name = 'Mission Control LP';
      designTask.title = 'Define module contracts';
      const designDetail = await designTask.detail.load();
      expect(designDetail).toBeDefined();
      designDetail!.notes = 'Refined architecture notes';
      designTask.tags.detach(researchTag);
      designTask.tags.attach(followUpTag);

      launchTask.tags.detach(choreTag);
      session.remove(choreTag);

      await session.commit();

      const finalSession = createSqliteSessionFromDb(db);
      const finalProject = (await finalSession.find(Project, project.id)) as unknown as Project;
      expect(finalProject).toBeDefined();
      expect(finalProject!.name).toBe('Mission Control LP');

      const finalTasks = await finalProject.tasks.load();
      const finalDesign = finalTasks.find(task => task.priority === 1);
      expect(finalDesign).toBeDefined();

      const finalDetail = await finalDesign!.detail.load();
      expect(finalDetail?.notes).toBe('Refined architecture notes');

      const finalDesignTags = (await finalDesign!.tags.load()).map(tag => tag.label).sort();
      expect(finalDesignTags).toEqual(['bug', 'follow-up'].sort());

      const finalIntegration = finalTasks.find(task => task.priority === 2);
      expect(finalIntegration).toBeDefined();
      expect((await finalIntegration!.tags.load())).toHaveLength(0);

      expect(await finalSession.find(Tag, choreTag.id)).toBeNull();
      expect(await finalSession.find(Tag, followUpTag.id)).toBeDefined();
    } finally {
      await closeDb(db);
    }
  });
});


