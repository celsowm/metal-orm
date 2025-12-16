import type { PoolAdapter, PoolLease, PoolOptions } from './pool-types.js';

/**
 * Node.js Timer with optional unref method (for preventing event loop from staying alive)
 */
type NodeTimer = ReturnType<typeof setInterval> & {
    unref?: () => void;
};

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (err: unknown) => void;
};

const deferred = <T>(): Deferred<T> => {
    let resolve!: (value: T) => void;
    let reject!: (err: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

type IdleEntry<T> = {
    resource: T;
    lastUsedAt: number;
};

export class Pool<TResource> {
    private readonly adapter: PoolAdapter<TResource>;
    private readonly options: Required<Pick<PoolOptions, 'max'>> & PoolOptions;

    private destroyed = false;
    private creating = 0;
    private leased = 0;
    private readonly idle: IdleEntry<TResource>[] = [];
    private readonly waiters: Array<Deferred<PoolLease<TResource>>> = [];
    private reapTimer: ReturnType<typeof setInterval> | null = null;

    constructor(adapter: PoolAdapter<TResource>, options: PoolOptions) {
        if (!Number.isFinite(options.max) || options.max <= 0) {
            throw new Error('Pool options.max must be a positive number');
        }

        this.adapter = adapter;
        this.options = { max: options.max, ...options };

        const idleTimeout = this.options.idleTimeoutMillis;
        if (idleTimeout && idleTimeout > 0) {
            const interval =
                this.options.reapIntervalMillis ?? Math.max(1_000, Math.floor(idleTimeout / 2));
            this.reapTimer = setInterval(() => {
                void this.reapIdle();
            }, interval);

            // Best-effort: avoid keeping the event loop alive.
            (this.reapTimer as NodeTimer).unref?.();
        }

        // Best-effort warmup.
        const min = this.options.min ?? 0;
        if (min > 0) {
            void this.warm(min);
        }
    }

    /**
     * Acquire a resource lease.
     * The returned lease MUST be released or destroyed.
     */
    async acquire(): Promise<PoolLease<TResource>> {
        if (this.destroyed) {
            throw new Error('Pool is destroyed');
        }

        // 1) Prefer idle.
        const idle = await this.takeIdleValidated();
        if (idle) {
            this.leased++;
            return this.makeLease(idle);
        }

        // 2) Create if capacity allows.
        if (this.totalLive() < this.options.max) {
            this.creating++;
            try {
                const created = await this.adapter.create();
                this.leased++;
                return this.makeLease(created);
            } finally {
                this.creating--;
            }
        }

        // 3) Wait.
        const waiter = deferred<PoolLease<TResource>>();
        this.waiters.push(waiter);

        const timeout = this.options.acquireTimeoutMillis;
        let timer: NodeTimer | null = null;
        if (timeout && timeout > 0) {
            timer = setTimeout(() => {
                // Remove from queue if still waiting.
                const idx = this.waiters.indexOf(waiter);
                if (idx >= 0) this.waiters.splice(idx, 1);
                waiter.reject(new Error('Pool acquire timeout'));
            }, timeout) as NodeTimer;
            // Best-effort: avoid keeping the event loop alive.
            timer.unref?.();
        }

        try {
            return await waiter.promise;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    /** Destroy pool and all idle resources; waits for in-flight creations to settle. */
    async destroy(): Promise<void> {
        if (this.destroyed) return;
        this.destroyed = true;

        if (this.reapTimer) {
            clearInterval(this.reapTimer);
            this.reapTimer = null;
        }

        // Reject all waiters.
        while (this.waiters.length) {
            this.waiters.shift()!.reject(new Error('Pool destroyed'));
        }

        // Destroy idle resources.
        while (this.idle.length) {
            const entry = this.idle.shift()!;
            await this.adapter.destroy(entry.resource);
        }
    }

    private totalLive(): number {
        return this.idle.length + this.leased + this.creating;
    }

    private makeLease(resource: TResource): PoolLease<TResource> {
        let done = false;
        return {
            resource,
            release: async () => {
                if (done) return;
                done = true;
                await this.releaseResource(resource);
            },
            destroy: async () => {
                if (done) return;
                done = true;
                await this.destroyResource(resource);
            },
        };
    }

    private async releaseResource(resource: TResource): Promise<void> {
        this.leased = Math.max(0, this.leased - 1);
        if (this.destroyed) {
            await this.adapter.destroy(resource);
            return;
        }

        // Prefer handing directly to waiters.
        const next = this.waiters.shift();
        if (next) {
            this.leased++;
            next.resolve(this.makeLease(resource));
            return;
        }

        this.idle.push({ resource, lastUsedAt: Date.now() });
        await this.trimToMinMax();
    }

    private async destroyResource(resource: TResource): Promise<void> {
        this.leased = Math.max(0, this.leased - 1);
        await this.adapter.destroy(resource);

        // If there are waiters and we have capacity, create a replacement.
        if (!this.destroyed && this.waiters.length && this.totalLive() < this.options.max) {
            const waiter = this.waiters.shift()!;
            this.creating++;
            try {
                const created = await this.adapter.create();
                this.leased++;
                waiter.resolve(this.makeLease(created));
            } catch (err) {
                waiter.reject(err);
            } finally {
                this.creating--;
            }
        }
    }

    private async takeIdleValidated(): Promise<TResource | null> {
        while (this.idle.length) {
            const entry = this.idle.pop()!;
            if (!this.adapter.validate) {
                return entry.resource;
            }
            const ok = await this.adapter.validate(entry.resource);
            if (ok) {
                return entry.resource;
            }
            await this.adapter.destroy(entry.resource);
        }
        return null;
    }

    private async reapIdle(): Promise<void> {
        if (this.destroyed) return;
        const idleTimeout = this.options.idleTimeoutMillis;
        if (!idleTimeout || idleTimeout <= 0) return;

        const now = Date.now();
        const min = this.options.min ?? 0;

        // Remove expired resources beyond min.
        const keep: IdleEntry<TResource>[] = [];
        const kill: IdleEntry<TResource>[] = [];
        for (const entry of this.idle) {
            const expired = now - entry.lastUsedAt >= idleTimeout;
            if (expired) kill.push(entry);
            else keep.push(entry);
        }

        // Keep at least `min`.
        while (keep.length < min && kill.length) {
            keep.push(kill.pop()!);
        }

        this.idle.length = 0;
        this.idle.push(...keep);

        for (const entry of kill) {
            await this.adapter.destroy(entry.resource);
        }
    }

    private async warm(targetMin: number): Promise<void> {
        const min = Math.max(0, targetMin);
        while (!this.destroyed && this.idle.length < min && this.totalLive() < this.options.max) {
            this.creating++;
            try {
                const created = await this.adapter.create();
                this.idle.push({ resource: created, lastUsedAt: Date.now() });
            } catch {
                // If warmup fails, stop trying.
                break;
            } finally {
                this.creating--;
            }
        }
    }

    private async trimToMinMax(): Promise<void> {
        const max = this.options.max;
        const min = this.options.min ?? 0;

        // Ensure we don't exceed max in idle (best-effort; leased/creating already counted elsewhere).
        while (this.totalLive() > max && this.idle.length > min) {
            const entry = this.idle.shift();
            if (!entry) break;
            await this.adapter.destroy(entry.resource);
        }
    }
}
