import { IdentityMap } from './identity-map.js';
import { UnitOfWork } from './unit-of-work.js';
import type { DomainEventBus } from './domain-event-bus.js';
import { RelationChangeProcessor } from './relation-change-processor.js';
import type { EntityContext } from './entity-context.js';
import type { AnyDomainEvent, DomainEvent } from './runtime-types.js';
import type { OrmSession } from './orm-session.js';

/**
 * Context used during the hydration of entities from database results.
 * It carries necessary services and processors to handle identity management,
 * unit of work registration, and relation changes.
 */
export interface HydrationContext<E extends DomainEvent = AnyDomainEvent> {
  /** The identity map used to track and reuse entity instances. */
  identityMap: IdentityMap;
  /** The unit of work used to track changes in hydrated entities. */
  unitOfWork: UnitOfWork;
  /** The bus used to dispatch domain events during or after hydration. */
  domainEvents: DomainEventBus<E, OrmSession<E>>;
  /** Processor for handling changes in entity relations during hydration. */
  relationChanges: RelationChangeProcessor;
  /** Context providing access to entity-specific metadata and services. */
  entityContext: EntityContext;
  // maybe mapping registry, converters, etc.
}
