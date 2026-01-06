/**
 * TechAI MCP Proxy - Result Caching Layer
 *
 * LRU cache with TTL for expensive tool operations.
 * Reduces latency and API calls for repeated queries.
 */
interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
}
export declare class ResultCache {
    private cache;
    private maxSize;
    private defaultTtlMs;
    private stats;
    private cleanupInterval?;
    /**
     * Tools that are safe to cache (deterministic and slow)
     */
    private static readonly CACHEABLE_TOOLS;
    /**
     * Tools that should NEVER be cached (side effects or real-time data)
     */
    private static readonly NON_CACHEABLE_TOOLS;
    constructor(maxSize?: number, defaultTtlMs?: number);
    /**
     * Generate cache key from tool name and arguments
     */
    private generateKey;
    /**
     * Check if a tool is cacheable
     */
    isCacheable(toolName: string): boolean;
    /**
     * Get cached result if exists and not expired
     */
    get<T>(toolName: string, args: Record<string, any>): T | null;
    /**
     * Store result in cache
     */
    set<T>(toolName: string, args: Record<string, any>, value: T, ttlMs?: number): void;
    /**
     * Evict oldest (least recently added) entry
     */
    private evictOldest;
    /**
     * Remove expired entries
     */
    private cleanup;
    /**
     * Invalidate cache entries matching a pattern
     */
    invalidate(toolNamePattern?: string): void;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats & {
        hitRate: number;
    };
    /**
     * Dispose resources
     */
    dispose(): void;
}
export {};
//# sourceMappingURL=cache.d.ts.map