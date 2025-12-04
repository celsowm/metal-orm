import { and, eq } from '../core/ast/expression';
import type { Dialect } from '../core/dialect/abstract';
import { DeleteQueryBuilder } from '../query-builder/delete';
import { InsertQueryBuilder } from '../query-builder/insert';
import { findPrimaryKey } from '../query-builder/hydration-planner';
import type { BelongsToManyRelation, HasManyRelation } from '../schema/relation';
import { RelationKinds } from '../schema/relation';
import type { TableDef } from '../schema/table';
import type { DbExecutor } from './db-executor';
import type { RelationChangeEntry } from './runtime-types';
import { UnitOfWork } from './unit-of-work';

export class RelationChangeProcessor {
  private readonly relationChanges: RelationChangeEntry[] = [];

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly dialect: Dialect,
    private readonly executor: DbExecutor
  ) {}

  registerChange(entry: RelationChangeEntry): void {
    this.relationChanges.push(entry);
  }

  async process(): Promise<void> {
    if (!this.relationChanges.length) return;
    const entries = [...this.relationChanges];
    this.relationChanges.length = 0;

    for (const entry of entries) {
      switch (entry.relation.type) {
        case RelationKinds.HasMany:
          await this.handleHasManyChange(entry);
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

  private async handleHasManyChange(entry: RelationChangeEntry): Promise<void> {
    const relation = entry.relation as HasManyRelation;
    const target = entry.change.entity;
    if (!target) return;

    const tracked = this.unitOfWork.findTracked(target);
    if (!tracked) return;

    const localKey = relation.localKey || findPrimaryKey(entry.rootTable);
    const rootValue = entry.root[localKey];
    if (rootValue === undefined || rootValue === null) return;

    if (entry.change.kind === 'add' || entry.change.kind === 'attach') {
      this.assignHasManyForeignKey(tracked.entity, relation, rootValue);
      this.unitOfWork.markDirty(tracked.entity);
      return;
    }

    if (entry.change.kind === 'remove') {
      this.detachHasManyChild(tracked.entity, relation);
    }
  }

  private async handleBelongsToChange(_entry: RelationChangeEntry): Promise<void> {
    // Reserved for future cascade/persist behaviors for belongs-to relations.
  }

  private async handleBelongsToManyChange(entry: RelationChangeEntry): Promise<void> {
    const relation = entry.relation as BelongsToManyRelation;
    const rootKey = relation.localKey || findPrimaryKey(entry.rootTable);
    const rootId = entry.root[rootKey];
    if (rootId === undefined || rootId === null) return;

    const targetId = this.resolvePrimaryKeyValue(entry.change.entity, relation.target);
    if (targetId === null) return;

    if (entry.change.kind === 'attach' || entry.change.kind === 'add') {
      await this.insertPivotRow(relation, rootId, targetId);
      return;
    }

    if (entry.change.kind === 'detach' || entry.change.kind === 'remove') {
      await this.deletePivotRow(relation, rootId, targetId);

      if (relation.cascade === 'all' || relation.cascade === 'remove') {
        this.unitOfWork.markRemoved(entry.change.entity);
      }
    }
  }

  private assignHasManyForeignKey(child: any, relation: HasManyRelation, rootValue: unknown): void {
    const current = child[relation.foreignKey];
    if (current === rootValue) return;
    child[relation.foreignKey] = rootValue;
  }

  private detachHasManyChild(child: any, relation: HasManyRelation): void {
    if (relation.cascade === 'all' || relation.cascade === 'remove') {
      this.unitOfWork.markRemoved(child);
      return;
    }
    child[relation.foreignKey] = null;
    this.unitOfWork.markDirty(child);
  }

  private async insertPivotRow(relation: BelongsToManyRelation, rootId: string | number, targetId: string | number): Promise<void> {
    const payload = {
      [relation.pivotForeignKeyToRoot]: rootId,
      [relation.pivotForeignKeyToTarget]: targetId
    };
    const builder = new InsertQueryBuilder(relation.pivotTable).values(payload);
    const compiled = builder.compile(this.dialect);
    await this.executor.executeSql(compiled.sql, compiled.params);
  }

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

  private resolvePrimaryKeyValue(entity: any, table: TableDef): string | number | null {
    if (!entity) return null;
    const key = findPrimaryKey(table);
    const value = entity[key];
    if (value === undefined || value === null) return null;
    return value;
  }
}
