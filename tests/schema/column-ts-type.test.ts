import { describe, it, expectTypeOf } from 'vitest';
import { col } from '../../src/schema/column.js';
import { defineTable } from '../../src/schema/table.js';
import { InferRow } from '../../src/schema/types.js';

describe('column tsType overrides', () => {
  it('defaults date/datetime columns to string', () => {
    const table = defineTable('events', {
      occurred_at: col.datetime(),
      created_on: col.date()
    });

    type Row = InferRow<typeof table>;

    expectTypeOf<Row['occurred_at']>().toEqualTypeOf<string>();
    expectTypeOf<Row['created_on']>().toEqualTypeOf<string>();
  });

  it('allows overriding date/datetime runtime types to Date', () => {
    const table = defineTable('events', {
      occurred_at: col.datetime<Date>(),
      created_on: col.date<Date>(),
      ts: col.timestamp<Date>(),
      tstz: col.timestamptz<Date>()
    });

    type Row = InferRow<typeof table>;

    expectTypeOf<Row['occurred_at']>().toEqualTypeOf<Date>();
    expectTypeOf<Row['created_on']>().toEqualTypeOf<Date>();
    expectTypeOf<Row['ts']>().toEqualTypeOf<Date>();
    expectTypeOf<Row['tstz']>().toEqualTypeOf<Date>();
  });

  it('respects explicit tsType overrides via generics', () => {
    const table = defineTable('events', {
      custom_date: col.date<number>()
    });

    type Row = InferRow<typeof table>;

    expectTypeOf<Row['custom_date']>().toEqualTypeOf<number>();
  });
});
