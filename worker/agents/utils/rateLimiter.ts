/**
 * Rate Limiter
 * 
 * Controls request rates to prevent API abuse and manage costs.
 */

export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    retryAfterMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
    default: { maxRequests: 100, windowMs: 60000, retryAfterMs: 1000 },
    llm: { maxRequests: 20, windowMs: 60000, retryAfterMs: 3000 },
    search: { maxRequests: 30, windowMs: 60000, retryAfterMs: 2000 },
    deploy: { maxRequests: 5, windowMs: 300000, retryAfterMs: 60000 },
};

interface WindowState {
    count: number;
    windowStart: number;
}

export class RateLimiter {
    private windows: Map<string, WindowState> = new Map();
    private limits: Record<string, RateLimitConfig>;

    constructor(customLimits: Partial<Record<string, RateLimitConfig>> = {}) {
        this.limits = { ...DEFAULT_LIMITS } as Record<string, RateLimitConfig>;
        for (const [key, value] of Object.entries(customLimits)) {
            if (value) {
                this.limits[key] = value;
            }
        }
    }

    /**
     * Check if a request is allowed
     */
    check(key: string, category: string = 'default'): RateLimitResult {
        const config = this.limits[category] ?? this.limits.default;
        const now = Date.now();
        const windowKey = `${category}:${key}`;
        
        let state = this.windows.get(windowKey);

        // Reset window if expired
        if (!state || now - state.windowStart >= config.windowMs) {
            state = { count: 0, windowStart: now };
            this.windows.set(windowKey, state);
        }

        const remaining = Math.max(0, config.maxRequests - state.count);
        const resetAt = state.windowStart + config.windowMs;

        if (state.count >= config.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetAt,
                retryAfter: config.retryAfterMs,
            };
        }

        return {
            allowed: true,
            remaining: remaining - 1, // Account for this request
            resetAt,
        };
    }

    /**
     * Record a request (call after check passes)
     */
    record(key: string, category: string = 'default'): void {
        const windowKey = `${category}:${key}`;
        const state = this.windows.get(windowKey);
        
        if (state) {
            state.count++;
        }
    }

    /**
     * Check and record in one call
     */
    acquire(key: string, category: string = 'default'): RateLimitResult {
        const result = this.check(key, category);
        if (result.allowed) {
            this.record(key, category);
        }
        return result;
    }

    /**
     * Reset limits for a key
     */
    reset(key: string, category?: string): void {
        if (category) {
            this.windows.delete(`${category}:${key}`);
        } else {
            // Reset all categories for this key
            for (const windowKey of this.windows.keys()) {
                if (windowKey.endsWith(`:${key}`)) {
                    this.windows.delete(windowKey);
                }
            }
        }
    }

    /**
     * Get current state for a key
     */
    getState(key: string, category: string = 'default'): RateLimitResult {
        return this.check(key, category);
    }

    /**
     * Clear all rate limit data
     */
    clear(): void {
        this.windows.clear();
    }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Decorator for rate limiting methods
 */
export function rateLimit(category: string = 'default') {
    return function (
        _target: unknown,
        _propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: unknown[]) {
            const key = 'method_call';
            const result = rateLimiter.acquire(key, category);

            if (!result.allowed) {
                throw new Error(
                    `Rate limit exceeded. Retry after ${result.retryAfter}ms`
                );
            }

            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}
