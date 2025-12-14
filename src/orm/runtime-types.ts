import { RelationDef } from '../schema/relation.js';
import { TableDef } from '../schema/table.js';

/**
 * Entity status enum representing the lifecycle state of an entity
 */
export enum EntityStatus {
  /** Entity is newly created and not yet persisted */
  New = 'new',
  /** Entity is managed by the ORM and synchronized with the database */
  Managed = 'managed',
  /** Entity has been modified but not yet persisted */
  Dirty = 'dirty',
  /** Entity has been marked for removal */
  Removed = 'removed',
  /** Entity is detached from the ORM context */
  Detached = 'detached'
}

/**
 * Represents an entity being tracked by the ORM
 */
export interface TrackedEntity {
  /** The table definition this entity belongs to */
  table: TableDef;
  /** The actual entity instance */
  entity: any;
  /** Primary key value of the entity */
  pk: string | number | null;
  /** Current status of the entity */
  status: EntityStatus;
  /** Original values of the entity when it was loaded */
  original: Record<string, unknown> | null;
}

/**
 * Type representing a key for relation navigation
 */
export type RelationKey = string;

/**
 * Represents a change operation on a relation
 * @typeParam T - Type of the related entity
 */
export type RelationChange<T> =
  | { kind: 'add'; entity: T }
  | { kind: 'attach'; entity: T }
  | { kind: 'remove'; entity: T }
  | { kind: 'detach'; entity: T };

/**
 * Represents a relation change entry in the unit of work
 */
export interface RelationChangeEntry {
  /** Root entity that owns the relation */
  root: unknown;
  /** Key of the relation being changed */
  relationKey: RelationKey;
  /** Table definition of the root entity */
  rootTable: TableDef;
  /** Name of the relation */
  relationName: string;
  /** Relation definition */
  relation: RelationDef;
  /** The change being applied */
  change: RelationChange<unknown>;
}

/**
 * Represents a domain event that can be emitted by entities
 * @typeParam TType - Type of the event (string literal)
 */
export interface DomainEvent<TType extends string = string> {
  /** Type identifier for the event */
  readonly type: TType;
  /** Timestamp when the event occurred */
  readonly occurredAt?: Date;
}

/**
 * Type representing any domain event
 */
export type AnyDomainEvent = DomainEvent<string>;

/**
 * Type representing ORM-specific domain events
 */
export type OrmDomainEvent = AnyDomainEvent;

/**
 * Interface for entities that can emit domain events
 * @typeParam E - Type of domain events this entity can emit
 */
export interface HasDomainEvents<E extends DomainEvent = AnyDomainEvent> {
  /** Array of domain events emitted by this entity */
  domainEvents?: E[];
}
