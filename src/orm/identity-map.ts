import type { TableDef } from '../schema/table.js';
import type { TrackedEntity } from './runtime-types.js';

export class IdentityMap {
  private readonly buckets = new Map<string, Map<string, TrackedEntity>>();

  get bucketsMap(): Map<string, Map<string, TrackedEntity>> {
    return this.buckets;
  }

  getEntity(table: TableDef, pk: string | number): any | undefined {
    const bucket = this.buckets.get(table.name);
    return bucket?.get(this.toIdentityKey(pk))?.entity;
  }

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

  getEntitiesForTable(table: TableDef): TrackedEntity[] {
    const bucket = this.buckets.get(table.name);
    return bucket ? Array.from(bucket.values()) : [];
  }

  clear(): void {
    this.buckets.clear();
  }

  private toIdentityKey(pk: string | number): string {
    return String(pk);
  }
}
