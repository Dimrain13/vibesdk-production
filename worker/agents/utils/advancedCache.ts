/**
 * Advanced Cache System
 * 
 * Provides intelligent caching for LLM responses and tool results.
 */

export interface CacheEntry<T> {
    value: T;
    timestamp: number;
    ttl: number;
    hits: number;
}

export interface CacheConfig {
    defaultTTL: number;
    maxEntries: number;
    enableStats: boolean;
}

const DEFAULT_CONFIG: CacheConfig = {
    defaultTTL: 300000, // 5 minutes
    maxEntries: 1000,
    enableStats: true,
};

export class AdvancedCache<T = unknown> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private config: CacheConfig;
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
    };

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Generate a cache key from input parameters
     */
    static generateKey(params: Record<string, unknown>): string {
        const sorted = Object.keys(params)
            .sort()
            .reduce((acc, key) => {
                acc[key] = params[key];
                return acc;
            }, {} as Record<string, unknown>);
        return JSON.stringify(sorted);
    }

    /**
     * Get a value from cache
     */
    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            return undefined;
        }

        entry.hits++;
        this.stats.hits++;
        return entry.value;
    }

    /**
     * Set a value in cache
     */
    set(key: string, value: T, ttl?: number): void {
        // Evict if at capacity
        if (this.cache.size >= this.config.maxEntries) {
            this.evictOldest();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl: ttl ?? this.config.defaultTTL,
            hits: 0,
        });
    }

    /**
     * Check if key exists and is valid
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;
        
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * Delete a key from cache
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): typeof this.stats & { size: number; hitRate: number } {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: total > 0 ? this.stats.hits / total : 0,
        };
    }

    /**
     * Evict the oldest entry
     */
    private evictOldest(): void {
        let oldestKey: string | undefined;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
        }
    }
}

// Singleton instance for global use
export const globalCache = new AdvancedCache();

/**
 * Decorator for caching function results
 */
export function cached<T>(
    ttl: number = DEFAULT_CONFIG.defaultTTL
) {
    return function (
        _target: unknown,
        _propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const cache = new AdvancedCache<T>();

        descriptor.value = async function (...args: unknown[]) {
            const key = AdvancedCache.generateKey({ args });
            
            const cachedValue = cache.get(key);
            if (cachedValue !== undefined) {
                return cachedValue;
            }

            const result = await originalMethod.apply(this, args);
            cache.set(key, result, ttl);
            return result;
        };

        return descriptor;
    };
}
