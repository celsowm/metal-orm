import { and, eq } from '../core/ast/expression.js';
import type { Dialect } from '../core/dialect/abstract.js';
import { DeleteQueryBuilder } from '../query-builder/delete.js';
import { InsertQueryBuilder } from '../query-builder/insert.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import type { BelongsToManyRelation, HasManyRelation, HasOneRelation } from '../schema/relation.js';
import { RelationKinds } from '../schema/relation.js';
import type { TableDef } from '../schema/table.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import type { RelationChangeEntry } from './runtime-types.js';
import { UnitOfWork } from './unit-of-work.js';

/**
 * Processes relation changes for entity relationships.
 */
export class RelationChangeProcessor {
  private readonly relationChanges: RelationChangeEntry[] = [];

  /**
   * Creates a new RelationChangeProcessor instance.
   * @param unitOfWork - The unit of work instance
   * @param dialect - The database dialect
   * @param executor - The database executor
   */
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly dialect: Dialect,
    private readonly executor: DbExecutor
  ) { }

  /**
   * Registers a relation change for processing.
   * @param entry - The relation change entry
   */
  registerChange(entry: RelationChangeEntry): void {
    this.relationChanges.push(entry);
  }

  /**
   * Resets the relation change processor by clearing all pending changes.
   */
  reset(): void {
    this.relationChanges.length = 0;
  }

  /**
   * Processes all pending relation changes.
   */
  async process(): Promise<void> {
    if (!this.relationChanges.length) return;
    const entries = [...this.relationChanges];
    this.relationChanges.length = 0;

    for (const entry of entries) {
      switch (entry.relation.type) {
        case RelationKinds.HasMany:
          await this.handleHasManyChange(entry);
          break;
        case RelationKinds.HasOne:
          await this.handleHasOneChange(entry);
          break;
        case RelationKinds.BelongsToMany:
          await this.handleBelongsToManyChange(entry);
          break;
        case RelationKinds.BelongsTo:
          await this.handleBelongsToChange(entry);
          break;
      }
    }
  }

  /**
   * Handles changes for has-many relations.
   * @param entry - The relation change entry
   */
  private async handleHasManyChange(entry: RelationChangeEntry): Promise<void> {
    const relation = entry.relation as HasManyRelation;
    const target = entry.change.entity;
    if (!target) return;

    const tracked = this.unitOfWork.findTracked(target as object);
    if (!tracked) return;

    const localKey = relation.localKey || findPrimaryKey(entry.rootTable);
    const rootValue = entry.root[localKey];
    if (rootValue === undefined || rootValue === null) return;

    if (entry.change.kind === 'add' || entry.change.kind === 'attach') {
      this.assignHasManyForeignKey(tracked.entity as Record<string, unknown>, relation, rootValue);
      this.unitOfWork.markDirty(tracked.entity);
      return;
    }

    if (entry.change.kind === 'remove') {
      this.detachHasManyChild(tracked.entity as Record<string, unknown>, relation);
    }
  }

  /**
   * Handles changes for has-one relations.
   * @param entry - The relation change entry
   */
  private async handleHasOneChange(entry: RelationChangeEntry): Promise<void> {
    const relation = entry.relation as HasOneRelation;
    const target = entry.change.entity;
    if (!target) return;

    const tracked = this.unitOfWork.findTracked(target as object);
    if (!tracked) return;

    const localKey = relation.localKey || findPrimaryKey(entry.rootTable);
    const rootValue = entry.root[localKey];
    if (rootValue === undefined || rootValue === null) return;

    if (entry.change.kind === 'attach' || entry.change.kind === 'add') {
      this.assignHasOneForeignKey(tracked.entity as Record<string, unknown>, relation, rootValue);
      this.unitOfWork.markDirty(tracked.entity);
      return;
    }

    if (entry.change.kind === 'remove') {
      this.detachHasOneChild(tracked.entity as Record<string, unknown>, relation);
    }
  }

  /**
   * Handles changes for belongs-to relations.
   * @param _entry - The relation change entry (reserved for future use)
   */
  private async handleBelongsToChange(_entry: RelationChangeEntry): Promise<void> {
    void _entry;
    // Reserved for future cascade/persist behaviors for belongs-to relations.
  }

  /**
   * Handles changes for belongs-to-many relations.
   * @param entry - The relation change entry
   */
  private async handleBelongsToManyChange(entry: RelationChangeEntry): Promise<void> {
    const relation = entry.relation as BelongsToManyRelation;
    const rootKey = relation.localKey || findPrimaryKey(entry.rootTable);
    const rootId = entry.root[rootKey];
    if (rootId === undefined || rootId === null) return;

    const targetId = this.resolvePrimaryKeyValue(entry.change.entity as Record<string, unknown>, relation.target);
    if (targetId === null) return;

    if (entry.change.kind === 'attach' || entry.change.kind === 'add') {
      await this.insertPivotRow(relation, rootId, targetId);
      return;
    }

    if (entry.change.kind === 'detach' || entry.change.kind === 'remove') {
      await this.deletePivotRow(relation, rootId, targetId);

      if (relation.cascade === 'all' || relation.cascade === 'remove') {
        this.unitOfWork.markRemoved(entry.change.entity as object);
      }
    }
  }

  /**
   * Assigns a foreign key for has-many relations.
   * @param child - The child entity
   * @param relation - The has-many relation
   * @param rootValue - The root entity's primary key value
   */
  private assignHasManyForeignKey(child: Record<string, unknown>, relation: HasManyRelation, rootValue: unknown): void {
    const current = child[relation.foreignKey];
    if (current === rootValue) return;
    child[relation.foreignKey] = rootValue;
  }

  /**
   * Detaches a child entity from has-many relations.
   * @param child - The child entity
   * @param relation - The has-many relation
   */
  private detachHasManyChild(child: Record<string, unknown>, relation: HasManyRelation): void {
    if (relation.cascade === 'all' || relation.cascade === 'remove') {
      this.unitOfWork.markRemoved(child);
      return;
    }
    child[relation.foreignKey] = null;
    this.unitOfWork.markDirty(child);
  }

  /**
   * Assigns a foreign key for has-one relations.
   * @param child - The child entity
   * @param relation - The has-one relation
   * @param rootValue - The root entity's primary key value
   */
  private assignHasOneForeignKey(child: Record<string, unknown>, relation: HasOneRelation, rootValue: unknown): void {
    const current = child[relation.foreignKey];
    if (current === rootValue) return;
    child[relation.foreignKey] = rootValue;
  }

  /**
   * Detaches a child entity from has-one relations.
   * @param child - The child entity
   * @param relation - The has-one relation
   */
  private detachHasOneChild(child: Record<string, unknown>, relation: HasOneRelation): void {
    if (relation.cascade === 'all' || relation.cascade === 'remove') {
      this.unitOfWork.markRemoved(child);
      return;
    }
    child[relation.foreignKey] = null;
    this.unitOfWork.markDirty(child);
  }

  /**
   * Inserts a pivot row for belongs-to-many relations.
   * @param relation - The belongs-to-many relation
   * @param rootId - The root entity's primary key value
   * @param targetId - The target entity's primary key value
   */
  private async insertPivotRow(relation: BelongsToManyRelation, rootId: string | number, targetId: string | number): Promise<void> {
    const payload = {
      [relation.pivotForeignKeyToRoot]: rootId,
      [relation.pivotForeignKeyToTarget]: targetId
    };
    const builder = new InsertQueryBuilder(relation.pivotTable).values(payload);
    const compiled = builder.compile(this.dialect);
    await this.executor.executeSql(compiled.sql, compiled.params);
  }

  /**
   * Deletes a pivot row for belongs-to-many relations.
   * @param relation - The belongs-to-many relation
   * @param rootId - The root entity's primary key value
   * @param targetId - The target entity's primary key value
   */
  private async deletePivotRow(relation: BelongsToManyRelation, rootId: string | number, targetId: string | number): Promise<void> {
    const rootCol = relation.pivotTable.columns[relation.pivotForeignKeyToRoot];
    const targetCol = relation.pivotTable.columns[relation.pivotForeignKeyToTarget];
    if (!rootCol || !targetCol) return;

    const builder = new DeleteQueryBuilder(relation.pivotTable).where(
      and(eq(rootCol, rootId), eq(targetCol, targetId))
    );
    const compiled = builder.compile(this.dialect);
    await this.executor.executeSql(compiled.sql, compiled.params);
  }

  /**
   * Resolves the primary key value from an entity.
   * @param entity - The entity
   * @param table - The table definition
   * @returns The primary key value or null
   */
  private resolvePrimaryKeyValue(entity: Record<string, unknown>, table: TableDef): string | number | null {
    if (!entity) return null;
    const key = findPrimaryKey(table);
    const value = entity[key];
    if (value === undefined || value === null) return null;
    return (value as string | number | null | undefined) ?? null;
  }
}
