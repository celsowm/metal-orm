import { StandardTableFunctionStrategy } from '../../functions/standard-table-strategy.js';

export class PostgresTableFunctionStrategy extends StandardTableFunctionStrategy {
  constructor() {
    super();
    this.registerOverrides();
  }

  private registerOverrides() {
    this.add('ARRAY_UNNEST', ({ node, compiledArgs, quoteIdentifier }) => {
      const lateral = node.lateral ?? true;
      const withOrd = node.withOrdinality ?? false;
      const base = `unnest(${compiledArgs.join(', ')})${withOrd ? ' WITH ORDINALITY' : ''}`;

      if (node.columnAliases?.length && !node.alias) {
        throw new Error('tvf(ARRAY_UNNEST) with columnAliases requires an alias.');
      }

      const alias = node.alias ? ` AS ${quoteIdentifier(node.alias)}` : '';
      const cols = node.columnAliases?.length
        ? `(${node.columnAliases.map(quoteIdentifier).join(', ')})`
        : '';

      return `${lateral ? 'LATERAL ' : ''}${base}${alias}${cols}`;
    });
  }
}
