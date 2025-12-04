import type { HasDomainEvents, TrackedEntity } from './runtime-types';

export type DomainEventHandler<Context> = (event: any, ctx: Context) => Promise<void> | void;

export class DomainEventBus<Context> {
  private readonly handlers = new Map<string, DomainEventHandler<Context>[]>();

  constructor(initialHandlers?: Record<string, DomainEventHandler<Context>[]>) {
    const handlers = initialHandlers ?? {};
    Object.entries(handlers).forEach(([name, list]) => {
      this.handlers.set(name, [...list]);
    });
  }

  register(name: string, handler: DomainEventHandler<Context>): void {
    const existing = this.handlers.get(name) ?? [];
    existing.push(handler);
    this.handlers.set(name, existing);
  }

  async dispatch(trackedEntities: Iterable<TrackedEntity>, ctx: Context): Promise<void> {
    for (const tracked of trackedEntities) {
      const entity = tracked.entity as HasDomainEvents;
      if (!entity.domainEvents || !entity.domainEvents.length) continue;

      for (const event of entity.domainEvents) {
        const eventName = this.getEventName(event);
        const handlers = this.handlers.get(eventName);
        if (!handlers) continue;

        for (const handler of handlers) {
          await handler(event, ctx);
        }
      }

      entity.domainEvents = [];
    }
  }

  private getEventName(event: any): string {
    if (!event) return 'Unknown';
    if (typeof event === 'string') return event;
    return event.constructor?.name ?? 'Unknown';
  }
}

export const addDomainEvent = (entity: HasDomainEvents, event: any): void => {
  if (!entity.domainEvents) {
    entity.domainEvents = [];
  }
  entity.domainEvents.push(event);
};
