import type { DomainEvent, HasDomainEvents, TrackedEntity } from './runtime-types.js';

/**
 * Extracts domain events of a specific type.
 * @template E - The domain event type
 * @template TType - The specific event type
 */
type EventOfType<E extends DomainEvent, TType extends E['type']> =
  Extract<E, { type: TType }>;

/**
 * Domain event handler function.
 * @template E - The domain event type
 * @template Context - The context type
 * @param event - The domain event
 * @param ctx - The context
 */
export type DomainEventHandler<E extends DomainEvent, Context> =
  (event: E, ctx: Context) => Promise<void> | void;

/**
 * Initial handlers for domain events.
 * @template E - The domain event type
 * @template Context - The context type
 */
export type InitialHandlers<E extends DomainEvent, Context> = {
  [K in E['type']]?: DomainEventHandler<EventOfType<E, K>, Context>[];
};

/**
 * Domain event bus for managing and dispatching domain events.
 * @template E - The domain event type
 * @template Context - The context type
 */
export class DomainEventBus<E extends DomainEvent, Context> {
  private readonly handlers = new Map<E['type'], DomainEventHandler<E, Context>[]>();

  /**
   * Creates a new DomainEventBus instance.
   * @param initialHandlers - Optional initial event handlers
   */
  constructor(initialHandlers?: InitialHandlers<E, Context>) {
    if (initialHandlers) {
      for (const key in initialHandlers) {
        const type = key as E['type'];
        const list = initialHandlers[type] ?? [];
        this.handlers.set(type, [...(list as DomainEventHandler<E, Context>[])]);
      }
    }
  }

  /**
   * Registers an event handler for a specific event type.
   * @template TType - The event type
   * @param type - The event type
   * @param handler - The event handler
   */
  on<TType extends E['type']>(
    type: TType,
    handler: DomainEventHandler<EventOfType<E, TType>, Context>
  ): void {
    const key = type as E['type'];
    const existing = this.handlers.get(key) ?? [];
    existing.push(handler as unknown as DomainEventHandler<E, Context>);
    this.handlers.set(key, existing);
  }

  /**
   * Registers an event handler for a specific event type (alias for on).
   * @template TType - The event type
   * @param type - The event type
   * @param handler - The event handler
   */
  register<TType extends E['type']>(
    type: TType,
    handler: DomainEventHandler<EventOfType<E, TType>, Context>
  ): void {
    this.on(type, handler);
  }

  /**
   * Dispatches domain events for tracked entities.
   * @param trackedEntities - Iterable of tracked entities
   * @param ctx - The context to pass to handlers
   */
  async dispatch(trackedEntities: Iterable<TrackedEntity>, ctx: Context): Promise<void> {
    for (const tracked of trackedEntities) {
      const entity = tracked.entity as HasDomainEvents<E>;
      if (!entity.domainEvents?.length) continue;

      for (const event of entity.domainEvents) {
        const handlers = this.handlers.get(event.type as E['type']);
        if (!handlers?.length) continue;

        for (const handler of handlers) {
          await handler(event, ctx);
        }
      }

      entity.domainEvents = [];
    }
  }
}

/**
 * Adds a domain event to an entity.
 * @template E - The domain event type
 * @param entity - The entity to add the event to
 * @param event - The domain event to add
 */
export const addDomainEvent = <E extends DomainEvent>(
  entity: HasDomainEvents<E>,
  event: E
): void => {
  if (!entity.domainEvents) {
    entity.domainEvents = [];
  }
  entity.domainEvents.push(event);
};
