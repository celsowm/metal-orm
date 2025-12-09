import { IdentityMap } from './identity-map.js';
import { UnitOfWork } from './unit-of-work.js';
import { DomainEventBus } from './domain-event-bus.js';
import { RelationChangeProcessor } from './relation-change-processor.js';
import { EntityContext } from './entity-context.js';

export interface HydrationContext {
  identityMap: IdentityMap;
  unitOfWork: UnitOfWork;
  domainEvents: DomainEventBus<any>;
  relationChanges: RelationChangeProcessor;
  entityContext: EntityContext;
  // maybe mapping registry, converters, etc.
}
