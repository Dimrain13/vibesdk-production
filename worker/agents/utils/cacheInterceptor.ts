/**
 * Cache Interceptor
 * 
 * Middleware for intercepting and caching tool/API responses.
 */

import { AdvancedCache } from './advancedCache';

export interface InterceptorConfig {
    enabled: boolean;
    ttl: number;
    excludePatterns: string[];
}

const DEFAULT_INTERCEPTOR_CONFIG: InterceptorConfig = {
    enabled: true,
    ttl: 300000, // 5 minutes
    excludePatterns: ['auth', 'login', 'logout', 'session'],
};

export class CacheInterceptor {
    private cache: AdvancedCache<unknown>;
    private config: InterceptorConfig;

    constructor(config: Partial<InterceptorConfig> = {}) {
        this.config = { ...DEFAULT_INTERCEPTOR_CONFIG, ...config };
        this.cache = new AdvancedCache({ defaultTTL: this.config.ttl });
    }

    /**
     * Check if a request should be cached
     */
    shouldCache(key: string): boolean {
        if (!this.config.enabled) return false;
        
        return !this.config.excludePatterns.some(pattern => 
            key.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    /**
     * Intercept a function call with caching
     */
    async intercept<T>(
        key: string,
        fn: () => Promise<T>,
        options?: { ttl?: number; force?: boolean }
    ): Promise<T> {
        // Check if caching should be skipped
        if (!this.shouldCache(key) || options?.force) {
            return fn();
        }

        // Try to get from cache
        const cached = this.cache.get(key) as T | undefined;
        if (cached !== undefined) {
            return cached;
        }

        // Execute and cache
        const result = await fn();
        this.cache.set(key, result, options?.ttl);
        return result;
    }

    /**
     * Invalidate cache entries matching a pattern
     */
    invalidate(_pattern: string): void {
        // Note: This is a simplified implementation
        // A production version would need pattern matching on keys
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return this.cache.getStats();
    }

    /**
     * Clear all cached entries
     */
    clear(): void {
        this.cache.clear();
    }
}

// Export singleton instance
export const cacheInterceptor = new CacheInterceptor();
