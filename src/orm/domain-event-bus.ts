import type { DomainEvent, HasDomainEvents, TrackedEntity } from './runtime-types.js';

type EventOfType<E extends DomainEvent, TType extends E['type']> =
  Extract<E, { type: TType }>;

export type DomainEventHandler<E extends DomainEvent, Context> =
  (event: E, ctx: Context) => Promise<void> | void;

export type InitialHandlers<E extends DomainEvent, Context> = {
  [K in E['type']]?: DomainEventHandler<EventOfType<E, K>, Context>[];
};

export class DomainEventBus<E extends DomainEvent, Context> {
  private readonly handlers = new Map<E['type'], DomainEventHandler<E, Context>[]>();

  constructor(initialHandlers?: InitialHandlers<E, Context>) {
    if (initialHandlers) {
      for (const key in initialHandlers) {
        const type = key as E['type'];
        const list = initialHandlers[type] ?? [];
        this.handlers.set(type, [...(list as DomainEventHandler<E, Context>[])]);
      }
    }
  }

  on<TType extends E['type']>(
    type: TType,
    handler: DomainEventHandler<EventOfType<E, TType>, Context>
  ): void {
    const key = type as E['type'];
    const existing = this.handlers.get(key) ?? [];
    existing.push(handler as unknown as DomainEventHandler<E, Context>);
    this.handlers.set(key, existing);
  }

  register<TType extends E['type']>(
    type: TType,
    handler: DomainEventHandler<EventOfType<E, TType>, Context>
  ): void {
    this.on(type, handler);
  }

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

export const addDomainEvent = <E extends DomainEvent>(
  entity: HasDomainEvents<E>,
  event: E
): void => {
  if (!entity.domainEvents) {
    entity.domainEvents = [];
  }
  entity.domainEvents.push(event);
};
