import { TableDef } from '../schema/table';
import { RelationDef } from '../schema/relation';
import { ColumnNode, FunctionNode, ScalarSubqueryNode, CaseExpressionNode, WindowFunctionNode } from '../ast/expression';
import { HydrationPlan, HydrationRelationPlan } from '../ast/query';
import { isRelationAlias } from '../utils/relation-alias';

/**
 * Finds the primary key column name for a table
 * @param table - Table definition
 * @returns Name of the primary key column, defaults to 'id'
 */
export const findPrimaryKey = (table: TableDef): string => {
  const pk = Object.values(table.columns).find(c => c.primary);
  return pk?.name || 'id';
};

/**
 * Manages hydration planning for query results
 */
export class HydrationPlanner {
  /**
   * Creates a new HydrationPlanner instance
   * @param table - Table definition
   * @param plan - Optional existing hydration plan
   */
  constructor(private readonly table: TableDef, private readonly plan?: HydrationPlan) { }

  /**
   * Captures root table columns for hydration planning
   * @param columns - Columns to capture
   * @returns Updated HydrationPlanner with captured columns
   */
  captureRootColumns(columns: (ColumnNode | FunctionNode | ScalarSubqueryNode | CaseExpressionNode | WindowFunctionNode)[]): HydrationPlanner {
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

  /**
   * Includes a relation in the hydration plan
   * @param rel - Relation definition
   * @param relationName - Name of the relation
   * @param aliasPrefix - Alias prefix for relation columns
   * @param columns - Columns to include from the relation
   * @returns Updated HydrationPlanner with included relation
   */
  includeRelation(rel: RelationDef, relationName: string, aliasPrefix: string, columns: string[]): HydrationPlanner {
    const currentPlan = this.getPlanOrDefault();
    const relations = currentPlan.relations.filter(r => r.name !== relationName);
    relations.push(this.buildRelationPlan(rel, relationName, aliasPrefix, columns));
    return new HydrationPlanner(this.table, {
      ...currentPlan,
      relations
    });
  }

  /**
   * Gets the current hydration plan
   * @returns Current hydration plan or undefined
   */
  getPlan(): HydrationPlan | undefined {
    return this.plan;
  }

  /**
   * Gets the current hydration plan or creates a default one
   * @returns Current hydration plan or default plan
   */
  private getPlanOrDefault(): HydrationPlan {
    return this.plan ?? buildDefaultHydrationPlan(this.table);
  }

  /**
   * Builds a relation plan for hydration
   * @param rel - Relation definition
   * @param relationName - Name of the relation
   * @param aliasPrefix - Alias prefix for relation columns
   * @param columns - Columns to include from the relation
   * @returns Hydration relation plan
   */
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

/**
 * Builds a default hydration plan for a table
 * @param table - Table definition
 * @returns Default hydration plan
 */
const buildDefaultHydrationPlan = (table: TableDef): HydrationPlan => ({
  rootTable: table.name,
  rootPrimaryKey: findPrimaryKey(table),
  rootColumns: [],
  relations: []
});
