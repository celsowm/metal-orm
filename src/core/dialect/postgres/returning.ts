import { StandardReturningStrategy } from '../base/returning-strategy.js';

/** PostgreSQL uses standard SQL RETURNING with qualified columns. */
export class PostgresReturningStrategy extends StandardReturningStrategy {}
