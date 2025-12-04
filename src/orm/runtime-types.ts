import { RelationDef } from '../schema/relation.js';
import { TableDef } from '../schema/table.js';

export enum EntityStatus {
  New = 'new',
  Managed = 'managed',
  Dirty = 'dirty',
  Removed = 'removed',
  Detached = 'detached'
}

export interface TrackedEntity {
  table: TableDef;
  entity: any;
  pk: string | number | null;
  status: EntityStatus;
  original: Record<string, any> | null;
}

export type RelationKey = string;

export type RelationChange<T> =
  | { kind: 'add'; entity: T }
  | { kind: 'attach'; entity: T }
  | { kind: 'remove'; entity: T }
  | { kind: 'detach'; entity: T };

export interface RelationChangeEntry {
  root: any;
  relationKey: RelationKey;
  rootTable: TableDef;
  relationName: string;
  relation: RelationDef;
  change: RelationChange<any>;
}

export interface HasDomainEvents {
  domainEvents?: any[];
}
