/**
 * Cacheable Responses
 * 
 * Defines which responses can be cached and for how long.
 */

export interface CacheableResponse {
    pattern: string;
    ttl: number;
    description: string;
}

// Response types that can be safely cached
export const CACHEABLE_RESPONSES: CacheableResponse[] = [
    {
        pattern: 'web_search',
        ttl: 600000, // 10 minutes
        description: 'Web search results',
    },
    {
        pattern: 'design_agent',
        ttl: 3600000, // 1 hour
        description: 'Design recommendations (static)',
    },
    {
        pattern: 'integration_playbook',
        ttl: 3600000, // 1 hour
        description: 'Integration guides (static)',
    },
    {
        pattern: 'support_agent',
        ttl: 3600000, // 1 hour
        description: 'Support responses (static)',
    },
    {
        pattern: 'crawl_tool',
        ttl: 300000, // 5 minutes
        description: 'Crawled webpage content',
    },
    {
        pattern: 'static_analysis',
        ttl: 60000, // 1 minute
        description: 'Lint and typecheck results',
    },
];

// Response types that should NEVER be cached
export const NON_CACHEABLE_PATTERNS: string[] = [
    'auth',
    'login',
    'logout',
    'session',
    'token',
    'password',
    'secret',
    'key',
    'credential',
    'deploy',
    'git_commit',
    'git_push',
    'file_write',
    'exec_command',
];

/**
 * Check if a response type is cacheable
 */
export function isCacheable(responseType: string): boolean {
    const lowerType = responseType.toLowerCase();
    
    // Check if explicitly non-cacheable
    if (NON_CACHEABLE_PATTERNS.some(p => lowerType.includes(p))) {
        return false;
    }
    
    // Check if explicitly cacheable
    return CACHEABLE_RESPONSES.some(r => lowerType.includes(r.pattern));
}

/**
 * Get the TTL for a cacheable response type
 */
export function getCacheTTL(responseType: string): number {
    const lowerType = responseType.toLowerCase();
    
    const match = CACHEABLE_RESPONSES.find(r => lowerType.includes(r.pattern));
    return match?.ttl ?? 60000; // Default 1 minute
}

/**
 * Response wrapper with cache metadata
 */
export interface CachedResponseWrapper<T> {
    data: T;
    cached: boolean;
    cachedAt?: number;
    expiresAt?: number;
}

/**
 * Wrap a response with cache metadata
 */
export function wrapResponse<T>(
    data: T,
    cached: boolean,
    ttl?: number
): CachedResponseWrapper<T> {
    const now = Date.now();
    return {
        data,
        cached,
        cachedAt: cached ? now : undefined,
        expiresAt: cached && ttl ? now + ttl : undefined,
    };
}
