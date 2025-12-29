import type { TableDef } from '../schema/table.js';
import type { TrackedEntity } from './runtime-types.js';
import type { PrimaryKey } from './entity-context.js';

/**
 * Simple identity map for tracking entities within a session.
 * Ensures that the same database record is represented by a single entity instance.
 */
export class IdentityMap {
  private readonly buckets = new Map<string, Map<string, TrackedEntity>>();

  get bucketsMap(): Map<string, Map<string, TrackedEntity>> {
    return this.buckets;
  }

  /**
   * Retrieves an entity from the identity map if it exists.
   * @param table The table definition of the entity.
   * @param pk The primary key value.
   * @returns The entity instance if found, undefined otherwise.
   */
  getEntity(table: TableDef, pk: PrimaryKey): object | undefined {
    const bucket = this.buckets.get(table.name);
    return bucket?.get(this.toIdentityKey(pk))?.entity;
  }

  /**
   * Registers a tracked entity in the identity map.
   * @param tracked The tracked entity metadata and instance.
   */
  register(tracked: TrackedEntity): void {
    if (tracked.pk == null) return;
    const bucket = this.buckets.get(tracked.table.name) ?? new Map<string, TrackedEntity>();
    bucket.set(this.toIdentityKey(tracked.pk), tracked);
    this.buckets.set(tracked.table.name, bucket);
  }

  remove(tracked: TrackedEntity): void {
    if (tracked.pk == null) return;
    const bucket = this.buckets.get(tracked.table.name);
    bucket?.delete(this.toIdentityKey(tracked.pk));
  }

  /**
   * Returns all tracked entities for a specific table.
   * @param table The table definition.
   * @returns Array of tracked entities.
   */
  getEntitiesForTable(table: TableDef): TrackedEntity[] {
    const bucket = this.buckets.get(table.name);
    return bucket ? Array.from(bucket.values()) : [];
  }

  clear(): void {
    this.buckets.clear();
  }

  private toIdentityKey(pk: PrimaryKey): string {
    return String(pk);
  }
}
