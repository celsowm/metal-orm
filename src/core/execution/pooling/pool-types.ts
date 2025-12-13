export type PoolOptions = {
    /** Maximum number of live resources (idle + leased). */
    max: number;
    /** Minimum number of idle resources to keep warm (best-effort). */
    min?: number;

    /** How long an idle resource can sit before being destroyed. */
    idleTimeoutMillis?: number;
    /** How often to reap idle resources. Defaults to idleTimeoutMillis / 2 (min 1s). */
    reapIntervalMillis?: number;

    /** How long callers wait for a resource before acquire() rejects. */
    acquireTimeoutMillis?: number;
};

export interface PoolAdapter<TResource> {
    create(): Promise<TResource>;
    destroy(resource: TResource): Promise<void>;
    validate?(resource: TResource): Promise<boolean>;
}

export interface PoolLease<TResource> {
    readonly resource: TResource;

    /** Returns the resource to the pool. Idempotent. */
    release(): Promise<void>;
    /** Permanently removes the resource from the pool. Idempotent. */
    destroy(): Promise<void>;
}

