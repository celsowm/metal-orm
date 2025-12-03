import { TableDef } from '../schema/table';
import { Entity } from '../schema/types';
import { hydrateRows } from './hydration';
import { OrmContext } from './orm-context';
import { SelectQueryBuilder } from '../builder/select';
import { createEntityFromRow } from './entity';

type Row = Record<string, any>;

const flattenResults = (results: { columns: string[]; values: unknown[][] }[]): Row[] => {
  const rows: Row[] = [];
  for (const result of results) {
    const { columns, values } = result;
    for (const valueRow of values) {
      const row: Row = {};
      columns.forEach((column, idx) => {
        row[column] = valueRow[idx];
      });
      rows.push(row);
    }
  }
  return rows;
};

export async function executeHydrated<TTable extends TableDef>(
  ctx: OrmContext,
  qb: SelectQueryBuilder<any, TTable>
): Promise<Entity<TTable>[]> {
  const compiled = ctx.dialect.compileSelect(qb.getAST());
  const executed = await ctx.executor.executeSql(compiled.sql, compiled.params);
  const rows = flattenResults(executed);
  const hydrated = hydrateRows(rows, qb.getHydrationPlan());
  return hydrated.map(row =>
    createEntityFromRow(ctx, qb.getTable(), row, qb.getLazyRelations())
  );
}
