import { IdentityMap } from './identity-map.js';
import { UnitOfWork } from './unit-of-work.js';
import { DomainEventBus } from './domain-event-bus.js';
import { RelationChangeProcessor } from './relation-change-processor.js';

export interface HydrationContext {
  identityMap: IdentityMap;
  unitOfWork: UnitOfWork;
  domainEvents: DomainEventBus<any>;
  relationChanges: RelationChangeProcessor;
  // maybe mapping registry, converters, etc.
}
