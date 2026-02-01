/**
 * Tool Result Cache
 * 
 * Caches results from expensive or repetitive tool calls.
 * Reduces API costs and improves response time.
 */

export interface CachedResult<T = unknown> {
    value: T;
    timestamp: number;
    ttl: number;
    hits: number;
    key: string;
}

export interface CacheConfig {
    enabled: boolean;
    defaultTTL: number;
    maxEntries: number;
}

// Tool-specific TTL configurations (in milliseconds)
export const TOOL_CACHE_CONFIG: Record<string, { ttl: number; enabled: boolean }> = {
    // Static tools - cache for 1 hour (content rarely changes)
    'design_agent': { ttl: 3600000, enabled: true },
    'integration_playbook': { ttl: 3600000, enabled: true },
    'support_agent': { ttl: 3600000, enabled: true },
    
    // Web search - cache for 10 minutes (content can change)
    'web_search': { ttl: 600000, enabled: true },
    'crawl_tool': { ttl: 600000, enabled: true },
    
    // File operations - cache for 1 minute (may change frequently)
    'read_files': { ttl: 60000, enabled: true },
    'run_analysis': { ttl: 60000, enabled: true },
    
    // Never cache these (always need fresh data)
    'exec_commands': { ttl: 0, enabled: false },
    'deploy_preview': { ttl: 0, enabled: false },
    'git': { ttl: 0, enabled: false },
    'testing_agent': { ttl: 0, enabled: false },
    'troubleshoot_agent': { ttl: 0, enabled: false },
    'deep_debug': { ttl: 0, enabled: false },
    'ask_human': { ttl: 0, enabled: false },
    'finish': { ttl: 0, enabled: false },
};

class ToolResultCache {
    private cache: Map<string, CachedResult> = new Map();
    private config: CacheConfig = {
        enabled: true,
        defaultTTL: 300000, // 5 minutes default
        maxEntries: 500,
    };
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        savings: 0, // Estimated tokens saved
    };

    /**
     * Generate a cache key from tool name and arguments
     */
    generateKey(toolName: string, args: Record<string, unknown>): string {
        const sortedArgs = Object.keys(args)
            .sort()
            .reduce((acc, key) => {
                acc[key] = args[key];
                return acc;
            }, {} as Record<string, unknown>);
        
        return `${toolName}:${JSON.stringify(sortedArgs)}`;
    }

    /**
     * Check if a tool's results should be cached
     */
    shouldCache(toolName: string): boolean {
        if (!this.config.enabled) return false;
        
        const toolConfig = TOOL_CACHE_CONFIG[toolName];
        return toolConfig?.enabled ?? false;
    }

    /**
     * Get TTL for a specific tool
     */
    getTTL(toolName: string): number {
        return TOOL_CACHE_CONFIG[toolName]?.ttl ?? this.config.defaultTTL;
    }

    /**
     * Get a cached result if valid
     */
    get<T>(toolName: string, args: Record<string, unknown>): T | undefined {
        if (!this.shouldCache(toolName)) {
            return undefined;
        }

        const key = this.generateKey(toolName, args);
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
        this.stats.savings += this.estimateTokens(entry.value);

        return entry.value as T;
    }

    /**
     * Store a result in cache
     */
    set<T>(toolName: string, args: Record<string, unknown>, value: T): void {
        if (!this.shouldCache(toolName)) {
            return;
        }

        // Evict if at capacity
        if (this.cache.size >= this.config.maxEntries) {
            this.evictOldest();
        }

        const key = this.generateKey(toolName, args);
        const ttl = this.getTTL(toolName);

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl,
            hits: 0,
            key,
        });
    }

    /**
     * Wrap a tool execution with caching
     */
    async withCache<T>(
        toolName: string,
        args: Record<string, unknown>,
        executor: () => Promise<T>
    ): Promise<{ result: T; cached: boolean }> {
        // Check cache first
        const cached = this.get<T>(toolName, args);
        if (cached !== undefined) {
            return { result: cached, cached: true };
        }

        // Execute and cache
        const result = await executor();
        this.set(toolName, args, result);
        
        return { result, cached: false };
    }

    /**
     * Invalidate cache for a specific tool
     */
    invalidate(toolName: string): number {
        let count = 0;
        const prefix = `${toolName}:`;
        
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                count++;
            }
        }
        
        return count;
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): typeof this.stats & { 
        size: number; 
        hitRate: number;
        estimatedTokensSaved: number;
    } {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: total > 0 ? this.stats.hits / total : 0,
            estimatedTokensSaved: this.stats.savings,
        };
    }

    /**
     * Estimate tokens in a value (for savings calculation)
     */
    private estimateTokens(value: unknown): number {
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        return Math.ceil(str.length / 4);
    }

    /**
     * Evict oldest entries
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

// Singleton instance
export const toolResultCache = new ToolResultCache();

/**
 * Decorator for caching tool results
 */
export function cacheable(toolName: string) {
    return function <T extends (...args: any[]) => Promise<any>>(
        _target: object,
        _propertyKey: string,
        descriptor: TypedPropertyDescriptor<T>
    ): TypedPropertyDescriptor<T> {
        const originalMethod = descriptor.value!;

        descriptor.value = async function (this: any, ...args: any[]) {
            const cacheArgs = args[0] || {};
            
            const { result, cached } = await toolResultCache.withCache(
                toolName,
                cacheArgs,
                () => originalMethod.apply(this, args)
            );

            if (cached) {
                console.log(`[ToolCache] Cache hit for ${toolName}`);
            }

            return result;
        } as T;

        return descriptor;
    };
}
