import { TableDef } from '../schema/table';
import { RelationDef } from '../schema/relation';
import { ColumnNode, FunctionNode } from '../ast/expression';
import { HydrationPlan, HydrationRelationPlan } from '../ast/query';

export const findPrimaryKey = (table: TableDef): string => {
  const pk = Object.values(table.columns).find(c => c.primary);
  return pk?.name || 'id';
};

const buildDefaultHydrationPlan = (table: TableDef): HydrationPlan => ({
  rootTable: table.name,
  rootPrimaryKey: findPrimaryKey(table),
  rootColumns: [],
  relations: []
});

export const isRelationAlias = (alias?: string): boolean => alias ? alias.includes('__') : false;

export class HydrationPlanner {
  constructor(private readonly table: TableDef, private readonly plan?: HydrationPlan) {}

  captureRootColumns(columns: (ColumnNode | FunctionNode)[]): HydrationPlanner {
    const currentPlan = this.getPlanOrDefault();
    const rootCols = new Set(currentPlan.rootColumns);
    let changed = false;

    columns.forEach(node => {
      if (node.type !== 'Column') return;
      if (node.table !== this.table.name) return;

      const alias = node.alias || node.name;
      if (isRelationAlias(alias)) return;
      if (!rootCols.has(alias)) {
        rootCols.add(alias);
        changed = true;
      }
    });

    if (!changed) return this;
    return new HydrationPlanner(this.table, {
      ...currentPlan,
      rootColumns: Array.from(rootCols)
    });
  }

  includeRelation(rel: RelationDef, relationName: string, aliasPrefix: string, columns: string[]): HydrationPlanner {
    const currentPlan = this.getPlanOrDefault();
    const relations = currentPlan.relations.filter(r => r.name !== relationName);
    relations.push(this.buildRelationPlan(rel, relationName, aliasPrefix, columns));
    return new HydrationPlanner(this.table, {
      ...currentPlan,
      relations
    });
  }

  getPlan(): HydrationPlan | undefined {
    return this.plan;
  }

  private getPlanOrDefault(): HydrationPlan {
    return this.plan ?? buildDefaultHydrationPlan(this.table);
  }

  private buildRelationPlan(rel: RelationDef, relationName: string, aliasPrefix: string, columns: string[]): HydrationRelationPlan {
    return {
      name: relationName,
      aliasPrefix,
      type: rel.type,
      targetTable: rel.target.name,
      targetPrimaryKey: findPrimaryKey(rel.target),
      foreignKey: rel.foreignKey,
      localKey: rel.localKey || 'id',
      columns
    };
  }
}
