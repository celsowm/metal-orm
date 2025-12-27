import { EntityConstructor } from './entity-metadata.js';
import { rebuildRegistry } from './entity-registry.js';
import { hasEntityMeta } from './entity-meta.js';

/**
 * Strategy interface for materializing entity instances (Open/Closed Principle).
 */
export interface EntityMaterializationStrategy {
    /**
     * Creates an instance of the entity class and populates it with data.
     * @param ctor - The entity constructor
     * @param data - The raw data to populate
     * @returns The materialized entity instance
     */
    materialize<T>(ctor: EntityConstructor<T>, data: Record<string, unknown>): T;
}

/**
 * Default strategy: Uses Object.create() to create instance without calling constructor.
 * Safe for classes with required constructor parameters.
 */
export class PrototypeMaterializationStrategy implements EntityMaterializationStrategy {
    materialize<T>(ctor: EntityConstructor<T>, data: Record<string, unknown>): T {
        const instance = Object.create(ctor.prototype) as T;
        Object.assign(instance, data);
        return instance;
    }
}

/**
 * Alternative strategy: Calls default constructor then assigns properties.
 * Use when class constructor initializes important state.
 */
export class ConstructorMaterializationStrategy implements EntityMaterializationStrategy {
    materialize<T>(ctor: EntityConstructor<T>, data: Record<string, unknown>): T {
        const instance = Reflect.construct(ctor, []) as T & Record<string, unknown>;
        Object.assign(instance, data);
        return instance;
    }
}

/**
 * Interface for materializing query results into real entity class instances.
 */
export interface EntityMaterializer {
    /**
     * Materializes a single row into a real entity instance.
     * @param entityClass - The entity constructor
     * @param row - The raw data row
     * @returns The materialized entity instance
     */
    materialize<T>(entityClass: EntityConstructor<T>, row: Record<string, unknown>): T;

    /**
     * Materializes multiple rows into real entity instances.
     * @param entityClass - The entity constructor
     * @param rows - The raw data rows
     * @returns Array of materialized entity instances
     */
    materializeMany<T>(entityClass: EntityConstructor<T>, rows: Record<string, unknown>[]): T[];
}

/**
 * Default implementation of EntityMaterializer.
 * Converts query results into actual class instances with working methods.
 * 
 * @example
 * const materializer = new DefaultEntityMaterializer();
 * const users = materializer.materializeMany(User, queryResults);
 * users[0] instanceof User; // true
 * users[0].getFullName();   // works!
 */
export class DefaultEntityMaterializer implements EntityMaterializer {
    constructor(
        private readonly strategy: EntityMaterializationStrategy = new ConstructorMaterializationStrategy()
    ) { }

    materialize<T>(ctor: EntityConstructor<T>, row: Record<string, unknown>): T {
        if (hasEntityMeta(row)) {
            return this.materializeEntityProxy(ctor, row);
        }

        const instance = this.strategy.materialize(ctor, row);
        this.materializeRelations(instance as Record<string, unknown>);
        return instance;
    }

    materializeMany<T>(ctor: EntityConstructor<T>, rows: Record<string, unknown>[]): T[] {
        return rows.map(row => this.materialize(ctor, row));
    }

    /**
     * Recursively materializes nested relation data.
     */
    private materializeRelations(instance: Record<string, unknown>): void {
        // Rebuild registry to ensure we have latest metadata
        rebuildRegistry();

        for (const value of Object.values(instance)) {
            if (value === null || value === undefined) continue;

            // Handle has-one / belongs-to (single object)
            if (typeof value === 'object' && !Array.isArray(value)) {
                const nested = value as Record<string, unknown>;
                // Check if this looks like an entity (has common entity patterns)
                if (this.isEntityLike(nested)) {
                    // For now, keep as-is since we don't have relation metadata here
                    // Future: use relation metadata to get target constructor
                }
            }

            // Handle has-many / belongs-to-many (array)
            if (Array.isArray(value) && value.length > 0) {
                const first = value[0];
                if (typeof first === 'object' && first !== null && this.isEntityLike(first)) {
                    // For now, keep array as-is
                    // Future: materialize each item if we can resolve the target class
                }
            }
        }
    }

    /**
     * Simple heuristic to check if an object looks like an entity.
     */
    private isEntityLike(obj: Record<string, unknown>): boolean {
        return 'id' in obj || Object.keys(obj).some(k =>
            k.endsWith('Id') || k === 'createdAt' || k === 'updatedAt'
        );
    }

    private materializeEntityProxy<T>(ctor: EntityConstructor<T>, row: Record<string, unknown>): T {
        const proxy = row as Record<string, unknown>;
        const baseline = this.strategy.materialize(ctor, {}) as Record<string, unknown>;
        for (const key of Object.keys(baseline)) {
            if (!Object.prototype.hasOwnProperty.call(proxy, key)) {
                proxy[key] = baseline[key];
            }
        }
        Object.setPrototypeOf(proxy, ctor.prototype);
        return proxy as T;
    }
}

/**
 * Convenience function to materialize query results as real class instances.
 * 
 * @example
 * const results = await selectFromEntity(User).execute(session);
 * const users = materializeAs(User, results);
 * users[0] instanceof User; // true!
 */
export const materializeAs = <TEntity extends object>(
    ctor: EntityConstructor<TEntity>,
    results: Record<string, unknown>[]
): TEntity[] => {
    const materializer = new DefaultEntityMaterializer();
    return materializer.materializeMany(ctor, results);
};
