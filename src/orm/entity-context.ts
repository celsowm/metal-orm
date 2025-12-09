import { TableDef } from '../schema/table.js';
import { RelationDef } from '../schema/relation.js';
import { ExecutionContext } from './execution-context.js';
import { HydrationContext } from './hydration-context.js';
import { InterceptorPipeline } from './interceptor-pipeline.js';
import { RelationChange, RelationKey, TrackedEntity } from './runtime-types.js';
import { OrmContext } from './orm-context.js';

export interface EntityContext {
    executionContext: ExecutionContext;
    getEntity(table: TableDef, pk: string | number): any | undefined;
    getEntitiesForTable(table: TableDef): TrackedEntity[];
    trackNew(table: TableDef, entity: any, pk?: string | number): void;
    trackManaged(table: TableDef, pk: string | number, entity: any): void;
    markDirty(entity: any): void;
    markRemoved(entity: any): void;
    registerRelationChange(
        root: any,
        relationKey: RelationKey,
        rootTable: TableDef,
        relationName: string,
        relation: RelationDef,
        change: RelationChange<any>
    ): void;
}

const buildExecutionContextFromOrmContext = (ctx: OrmContext): ExecutionContext => ({
    dialect: ctx.dialect,
    executor: ctx.executor,
    interceptors: new InterceptorPipeline()
});

export const createEntityContextFromOrmContext = (ctx: OrmContext): EntityContext => ({
    executionContext: buildExecutionContextFromOrmContext(ctx),
    getEntity: (table, pk) => ctx.getEntity(table, pk),
    getEntitiesForTable: table => ctx.getEntitiesForTable(table),
    trackNew: (table, entity, pk) => ctx.trackNew(table, entity, pk),
    trackManaged: (table, pk, entity) => ctx.trackManaged(table, pk, entity),
    markDirty: entity => ctx.markDirty(entity),
    markRemoved: entity => ctx.markRemoved(entity),
    registerRelationChange: (root, relationKey, rootTable, relationName, relation, change) =>
        ctx.registerRelationChange(root, relationKey, rootTable, relationName, relation, change)
});

export const createEntityContextFromExecutionAndHydration = (
    executionContext: ExecutionContext,
    hydCtx: HydrationContext
): EntityContext => ({
    executionContext,
    getEntity: (table, pk) => hydCtx.unitOfWork.getEntity(table, pk),
    getEntitiesForTable: table => hydCtx.unitOfWork.getEntitiesForTable(table),
    trackNew: (table, entity, pk) => hydCtx.unitOfWork.trackNew(table, entity, pk),
    trackManaged: (table, pk, entity) => hydCtx.unitOfWork.trackManaged(table, pk, entity),
    markDirty: entity => hydCtx.unitOfWork.markDirty(entity),
    markRemoved: entity => hydCtx.unitOfWork.markRemoved(entity),
    registerRelationChange: (root, relationKey, rootTable, relationName, relation, change) =>
        hydCtx.relationChanges.registerChange({
            root,
            relationKey,
            rootTable,
            relationName,
            relation,
            change
        })
});
