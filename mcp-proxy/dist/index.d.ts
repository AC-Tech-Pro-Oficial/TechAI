/**
 * TechAI MCP Proxy - Main Entry Point
 *
 * Orchestrates all components of the MCP Proxy Server:
 * - Profile management for workspace detection
 * - Backend connection pool for MCP servers
 * - Router for request handling
 * - HTTP server for client connections
 * - Analytics, caching, security, and more
 */
import { ProfileManager } from './profiles';
import { BackendPool } from './pool';
import { Router } from './router';
import { Analytics } from './analytics';
import { ResultCache } from './cache';
import { CostTracker } from './cost_tracker';
import { SecuritySandbox } from './security';
import { ToolFilter } from './tool_filter';
import { PromptLibrary } from './prompts';
import { LogLevel } from './logger';
export interface ProxyOptions {
    port?: number;
    host?: string;
    logLevel?: LogLevel;
    profilesPath?: string;
    mcpConfigPath?: string;
    dataDir?: string;
}
/**
 * Feature services container
 */
export interface ProxyServices {
    analytics: Analytics;
    cache: ResultCache;
    costTracker: CostTracker;
    security: SecuritySandbox;
    toolFilter: ToolFilter;
    prompts: PromptLibrary;
}
/**
 * MCP Proxy instance
 */
export declare class MCPProxy {
    private profileManager;
    private backendPool;
    private router;
    private server;
    private options;
    private services;
    constructor(options?: ProxyOptions);
    /**
     * Start the proxy server
     */
    start(): Promise<number>;
    /**
     * Stop the proxy server
     */
    stop(): Promise<void>;
    /**
     * Get the running port
     */
    getPort(): number;
    /**
     * Get services for external access
     */
    getServices(): ProxyServices;
    /**
     * Get profile manager for external access
     */
    getProfileManager(): ProfileManager;
    /**
     * Get backend pool for external access
     */
    getBackendPool(): BackendPool;
    /**
     * Get router for external access
     */
    getRouter(): Router;
    /**
     * Force reload of configurations
     */
    reload(): Promise<void>;
}
export { ProfileManager } from './profiles';
export { BackendPool } from './pool';
export { Router } from './router';
export { MCPProxyServer } from './server';
export { ContextInjector } from './context';
export { Analytics } from './analytics';
export { ResultCache } from './cache';
export { CostTracker } from './cost_tracker';
export { SecuritySandbox } from './security';
export { ToolFilter } from './tool_filter';
export { PromptLibrary } from './prompts';
export { logger } from './logger';
export * from './types';
//# sourceMappingURL=index.d.ts.map