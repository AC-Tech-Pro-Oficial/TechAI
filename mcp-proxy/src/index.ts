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

import * as path from 'path';
import * as os from 'os';

import { ProfileManager } from './profiles';
import { BackendPool } from './pool';
import { Router } from './router';
import { MCPProxyServer } from './server';
import { Analytics } from './analytics';
import { ResultCache } from './cache';
import { CostTracker } from './cost_tracker';
import { SecuritySandbox } from './security';
import { ToolFilter } from './tool_filter';
import { PromptLibrary } from './prompts';
import { logger, LogLevel } from './logger';

const LOG_CAT = 'Main';

export interface ProxyOptions {
    port?: number;
    host?: string;
    logLevel?: LogLevel;
    profilesPath?: string;
    mcpConfigPath?: string;
    dataDir?: string; // For analytics, cache, etc.
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
export class MCPProxy {
    private profileManager: ProfileManager;
    private backendPool: BackendPool;
    private router: Router;
    private server: MCPProxyServer;
    private options: Required<ProxyOptions>;
    private services: ProxyServices;

    constructor(options: ProxyOptions = {}) {
        // Resolve data directory
        const defaultDataDir = path.join(os.homedir(), '.gemini', 'antigravity', 'proxy-data');

        this.options = {
            port: options.port !== undefined ? options.port : 9847,
            host: options.host || '127.0.0.1',
            logLevel: options.logLevel || 'info',
            profilesPath: options.profilesPath || '',
            mcpConfigPath: options.mcpConfigPath || '',
            dataDir: options.dataDir || defaultDataDir
        };

        // Set log level
        logger.setLevel(this.options.logLevel);
        logger.info(LOG_CAT, `Data directory: ${this.options.dataDir}`);

        // Initialize core components
        this.profileManager = new ProfileManager(
            this.options.profilesPath || undefined
        );

        this.backendPool = new BackendPool(
            this.options.mcpConfigPath || undefined
        );

        this.router = new Router(this.profileManager, this.backendPool);

        // Initialize feature services
        this.services = {
            analytics: new Analytics(this.options.dataDir),
            cache: new ResultCache(100, 60000), // 100 items, 60s TTL
            costTracker: new CostTracker(this.options.dataDir),
            security: new SecuritySandbox(), // Disabled by default
            toolFilter: new ToolFilter(),
            prompts: new PromptLibrary()
        };

        // Create server with services
        this.server = new MCPProxyServer(this.router, {
            port: this.options.port,
            host: this.options.host
        }, this.services);
    }

    /**
     * Start the proxy server
     */
    public async start(): Promise<number> {
        logger.info(LOG_CAT, 'Starting TechAI MCP Proxy...');

        const port = await this.server.start();

        logger.info(LOG_CAT, `TechAI MCP Proxy started on port ${port}`);
        logger.info(LOG_CAT, `Available MCP servers: ${this.backendPool.getAvailableServerIds().join(', ')}`);

        return port;
    }

    /**
     * Stop the proxy server
     */
    public async stop(): Promise<void> {
        logger.info(LOG_CAT, 'Stopping TechAI MCP Proxy...');

        // Dispose services
        this.services.analytics.dispose();
        this.services.cache.dispose();
        this.services.costTracker.dispose();

        await this.server.stop();
        await this.backendPool.dispose();
        this.profileManager.dispose();
        this.router.dispose();

        logger.info(LOG_CAT, 'TechAI MCP Proxy stopped');
    }

    /**
     * Get the running port
     */
    public getPort(): number {
        return this.server.getPort();
    }

    /**
     * Get services for external access
     */
    public getServices(): ProxyServices {
        return this.services;
    }

    /**
     * Get profile manager for external access
     */
    public getProfileManager(): ProfileManager {
        return this.profileManager;
    }

    /**
     * Get backend pool for external access
     */
    public getBackendPool(): BackendPool {
        return this.backendPool;
    }

    /**
     * Get router for external access
     */
    public getRouter(): Router {
        return this.router;
    }

    /**
     * Force reload of configurations
     */
    public async reload(): Promise<void> {
        logger.info(LOG_CAT, 'Reloading configuration...');
        this.backendPool.reloadConfig();
    }
}

// Export all modules
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

/**
 * Main function for standalone execution
 */
async function main(): Promise<void> {
    // Handle port 0 correctly (dynamic port allocation)
    logger.info('Main', `Environment MCP_PROXY_PORT: ${process.env.MCP_PROXY_PORT}`);
    const envPort = process.env.MCP_PROXY_PORT;
    const port = envPort !== undefined ? parseInt(envPort, 10) : 9847;
    logger.info('Main', `Resolved Start Port: ${port}`);

    const proxy = new MCPProxy({
        port: port,
        host: process.env.MCP_PROXY_HOST || '127.0.0.1',
        logLevel: (process.env.MCP_PROXY_LOG_LEVEL as LogLevel) || 'info'
    });

    // Handle graceful shutdown
    const shutdown = async () => {
        logger.info(LOG_CAT, 'Received shutdown signal');
        await proxy.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        await proxy.start();

        // Keep process running
        logger.info(LOG_CAT, 'Press Ctrl+C to stop');

    } catch (error) {
        logger.error(LOG_CAT, 'Failed to start proxy:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}
