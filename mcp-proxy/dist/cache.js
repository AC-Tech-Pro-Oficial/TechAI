"use strict";
/**
 * TechAI MCP Proxy - Result Caching Layer
 *
 * LRU cache with TTL for expensive tool operations.
 * Reduces latency and API calls for repeated queries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultCache = void 0;
const logger_1 = require("./logger");
const LOG_CAT = 'Cache';
class ResultCache {
    constructor(maxSize = 100, defaultTtlMs = 60000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.defaultTtlMs = defaultTtlMs;
        this.stats = { hits: 0, misses: 0, size: 0, maxSize };
        // Cleanup expired entries every 30 seconds
        this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
    }
    /**
     * Generate cache key from tool name and arguments
     */
    generateKey(toolName, args) {
        const argsStr = JSON.stringify(args, Object.keys(args).sort());
        return `${toolName}:${argsStr}`;
    }
    /**
     * Check if a tool is cacheable
     */
    isCacheable(toolName) {
        // Explicit non-cacheable
        if (ResultCache.NON_CACHEABLE_TOOLS.has(toolName)) {
            return false;
        }
        // Explicit cacheable or has "read/list/get/search" in name
        return ResultCache.CACHEABLE_TOOLS.has(toolName) ||
            /^(read|list|get|search|find|fetch)_/.test(toolName);
    }
    /**
     * Get cached result if exists and not expired
     */
    get(toolName, args) {
        if (!this.isCacheable(toolName)) {
            return null;
        }
        const key = this.generateKey(toolName, args);
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttlMs) {
            this.cache.delete(key);
            this.stats.size--;
            this.stats.misses++;
            return null;
        }
        entry.hits++;
        this.stats.hits++;
        logger_1.logger.debug(LOG_CAT, `Cache HIT: ${toolName} (${entry.hits} hits)`);
        return entry.value;
    }
    /**
     * Store result in cache
     */
    set(toolName, args, value, ttlMs) {
        if (!this.isCacheable(toolName)) {
            return;
        }
        const key = this.generateKey(toolName, args);
        // Evict oldest entries if at capacity
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }
        const isNew = !this.cache.has(key);
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttlMs: ttlMs ?? this.defaultTtlMs,
            hits: 0
        });
        if (isNew) {
            this.stats.size++;
        }
        logger_1.logger.debug(LOG_CAT, `Cache SET: ${toolName} (TTL: ${ttlMs ?? this.defaultTtlMs}ms)`);
    }
    /**
     * Evict oldest (least recently added) entry
     */
    evictOldest() {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
            this.cache.delete(firstKey);
            this.stats.size--;
            logger_1.logger.debug(LOG_CAT, `Cache EVICT: ${firstKey}`);
        }
    }
    /**
     * Remove expired entries
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > entry.ttlMs) {
                this.cache.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            this.stats.size = this.cache.size;
            logger_1.logger.debug(LOG_CAT, `Cache cleanup: removed ${removed} expired entries`);
        }
    }
    /**
     * Invalidate cache entries matching a pattern
     */
    invalidate(toolNamePattern) {
        if (!toolNamePattern) {
            this.cache.clear();
            this.stats.size = 0;
            logger_1.logger.info(LOG_CAT, 'Cache cleared');
            return;
        }
        const keysToRemove = [];
        for (const key of this.cache.keys()) {
            if (key.startsWith(toolNamePattern)) {
                keysToRemove.push(key);
            }
        }
        for (const key of keysToRemove) {
            this.cache.delete(key);
        }
        this.stats.size = this.cache.size;
        logger_1.logger.info(LOG_CAT, `Cache invalidated ${keysToRemove.length} entries for ${toolNamePattern}`);
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            hitRate: total > 0 ? this.stats.hits / total : 0
        };
    }
    /**
     * Dispose resources
     */
    dispose() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
    }
}
exports.ResultCache = ResultCache;
/**
 * Tools that are safe to cache (deterministic and slow)
 */
ResultCache.CACHEABLE_TOOLS = new Set([
    // Git operations (slow, deterministic for short periods)
    'git_log',
    'git_status',
    'git_diff',
    'list_commits',
    // File listing (slow on large projects)
    'list_directory',
    'list_files',
    'find_files',
    'search_files',
    // Web fetches (expensive, deterministic for short periods)
    'brave_search',
    'read_url',
    'fetch_webpage',
    // Analysis tools
    'analyze_codebase',
    'get_file_outline',
]);
/**
 * Tools that should NEVER be cached (side effects or real-time data)
 */
ResultCache.NON_CACHEABLE_TOOLS = new Set([
    'run_command',
    'write_file',
    'create_file',
    'delete_file',
    'execute_code',
    'send_email',
    'deploy',
    'git_commit',
    'git_push',
]);
//# sourceMappingURL=cache.js.map