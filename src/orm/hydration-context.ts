import { IdentityMap } from './identity-map.js';
import { UnitOfWork } from './unit-of-work.js';
import type { DomainEventBus } from './domain-event-bus.js';
import { RelationChangeProcessor } from './relation-change-processor.js';
import type { EntityContext } from './entity-context.js';
import type { AnyDomainEvent, DomainEvent } from './runtime-types.js';
import type { OrmSession } from './orm-session.js';

export interface HydrationContext<E extends DomainEvent = AnyDomainEvent> {
  identityMap: IdentityMap;
  unitOfWork: UnitOfWork;
  domainEvents: DomainEventBus<E, OrmSession<E>>;
  relationChanges: RelationChangeProcessor;
  entityContext: EntityContext;
  // maybe mapping registry, converters, etc.
}
