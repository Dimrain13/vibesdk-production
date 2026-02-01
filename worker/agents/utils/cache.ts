/**
 * Simple Cache Utility
 * 
 * Basic in-memory cache with TTL support.
 */

export interface SimpleCacheOptions {
    ttl?: number;
    maxSize?: number;
}

export class SimpleCache<T = unknown> {
    private store: Map<string, { value: T; expires: number }> = new Map();
    private maxSize: number;
    private defaultTTL: number;

    constructor(options: SimpleCacheOptions = {}) {
        this.maxSize = options.maxSize ?? 500;
        this.defaultTTL = options.ttl ?? 60000; // 1 minute default
    }

    get(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        
        if (Date.now() > entry.expires) {
            this.store.delete(key);
            return undefined;
        }
        
        return entry.value;
    }

    set(key: string, value: T, ttl?: number): void {
        // Enforce max size
        if (this.store.size >= this.maxSize) {
            const firstKey = this.store.keys().next().value;
            if (firstKey) this.store.delete(firstKey);
        }

        this.store.set(key, {
            value,
            expires: Date.now() + (ttl ?? this.defaultTTL),
        });
    }

    has(key: string): boolean {
        const entry = this.store.get(key);
        if (!entry) return false;
        if (Date.now() > entry.expires) {
            this.store.delete(key);
            return false;
        }
        return true;
    }

    delete(key: string): boolean {
        return this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }

    size(): number {
        return this.store.size;
    }
}

// Export a default instance
export const cache = new SimpleCache();
