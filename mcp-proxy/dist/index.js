"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.PromptLibrary = exports.ToolFilter = exports.SecuritySandbox = exports.CostTracker = exports.ResultCache = exports.Analytics = exports.ContextInjector = exports.MCPProxyServer = exports.Router = exports.BackendPool = exports.ProfileManager = exports.MCPProxy = void 0;
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const profiles_1 = require("./profiles");
const pool_1 = require("./pool");
const router_1 = require("./router");
const server_1 = require("./server");
const analytics_1 = require("./analytics");
const cache_1 = require("./cache");
const cost_tracker_1 = require("./cost_tracker");
const security_1 = require("./security");
const tool_filter_1 = require("./tool_filter");
const prompts_1 = require("./prompts");
const logger_1 = require("./logger");
const LOG_CAT = 'Main';
/**
 * MCP Proxy instance
 */
class MCPProxy {
    constructor(options = {}) {
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
        logger_1.logger.setLevel(this.options.logLevel);
        logger_1.logger.info(LOG_CAT, `Data directory: ${this.options.dataDir}`);
        // Initialize core components
        this.profileManager = new profiles_1.ProfileManager(this.options.profilesPath || undefined);
        this.backendPool = new pool_1.BackendPool(this.options.mcpConfigPath || undefined);
        this.router = new router_1.Router(this.profileManager, this.backendPool);
        // Initialize feature services
        this.services = {
            analytics: new analytics_1.Analytics(this.options.dataDir),
            cache: new cache_1.ResultCache(100, 60000), // 100 items, 60s TTL
            costTracker: new cost_tracker_1.CostTracker(this.options.dataDir),
            security: new security_1.SecuritySandbox(), // Disabled by default
            toolFilter: new tool_filter_1.ToolFilter(),
            prompts: new prompts_1.PromptLibrary()
        };
        // Create server with services
        this.server = new server_1.MCPProxyServer(this.router, {
            port: this.options.port,
            host: this.options.host
        }, this.services);
    }
    /**
     * Start the proxy server
     */
    async start() {
        logger_1.logger.info(LOG_CAT, 'Starting TechAI MCP Proxy...');
        const port = await this.server.start();
        logger_1.logger.info(LOG_CAT, `TechAI MCP Proxy started on port ${port}`);
        logger_1.logger.info(LOG_CAT, `Available MCP servers: ${this.backendPool.getAvailableServerIds().join(', ')}`);
        return port;
    }
    /**
     * Stop the proxy server
     */
    async stop() {
        logger_1.logger.info(LOG_CAT, 'Stopping TechAI MCP Proxy...');
        // Dispose services
        this.services.analytics.dispose();
        this.services.cache.dispose();
        this.services.costTracker.dispose();
        await this.server.stop();
        await this.backendPool.dispose();
        this.profileManager.dispose();
        this.router.dispose();
        logger_1.logger.info(LOG_CAT, 'TechAI MCP Proxy stopped');
    }
    /**
     * Get the running port
     */
    getPort() {
        return this.server.getPort();
    }
    /**
     * Get services for external access
     */
    getServices() {
        return this.services;
    }
    /**
     * Get profile manager for external access
     */
    getProfileManager() {
        return this.profileManager;
    }
    /**
     * Get backend pool for external access
     */
    getBackendPool() {
        return this.backendPool;
    }
    /**
     * Get router for external access
     */
    getRouter() {
        return this.router;
    }
    /**
     * Force reload of configurations
     */
    async reload() {
        logger_1.logger.info(LOG_CAT, 'Reloading configuration...');
        this.backendPool.reloadConfig();
    }
}
exports.MCPProxy = MCPProxy;
// Export all modules
var profiles_2 = require("./profiles");
Object.defineProperty(exports, "ProfileManager", { enumerable: true, get: function () { return profiles_2.ProfileManager; } });
var pool_2 = require("./pool");
Object.defineProperty(exports, "BackendPool", { enumerable: true, get: function () { return pool_2.BackendPool; } });
var router_2 = require("./router");
Object.defineProperty(exports, "Router", { enumerable: true, get: function () { return router_2.Router; } });
var server_2 = require("./server");
Object.defineProperty(exports, "MCPProxyServer", { enumerable: true, get: function () { return server_2.MCPProxyServer; } });
var context_1 = require("./context");
Object.defineProperty(exports, "ContextInjector", { enumerable: true, get: function () { return context_1.ContextInjector; } });
var analytics_2 = require("./analytics");
Object.defineProperty(exports, "Analytics", { enumerable: true, get: function () { return analytics_2.Analytics; } });
var cache_2 = require("./cache");
Object.defineProperty(exports, "ResultCache", { enumerable: true, get: function () { return cache_2.ResultCache; } });
var cost_tracker_2 = require("./cost_tracker");
Object.defineProperty(exports, "CostTracker", { enumerable: true, get: function () { return cost_tracker_2.CostTracker; } });
var security_2 = require("./security");
Object.defineProperty(exports, "SecuritySandbox", { enumerable: true, get: function () { return security_2.SecuritySandbox; } });
var tool_filter_2 = require("./tool_filter");
Object.defineProperty(exports, "ToolFilter", { enumerable: true, get: function () { return tool_filter_2.ToolFilter; } });
var prompts_2 = require("./prompts");
Object.defineProperty(exports, "PromptLibrary", { enumerable: true, get: function () { return prompts_2.PromptLibrary; } });
var logger_2 = require("./logger");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logger_2.logger; } });
__exportStar(require("./types"), exports);
/**
 * Main function for standalone execution
 */
async function main() {
    // Handle port 0 correctly (dynamic port allocation)
    logger_1.logger.info('Main', `Environment MCP_PROXY_PORT: ${process.env.MCP_PROXY_PORT}`);
    const envPort = process.env.MCP_PROXY_PORT;
    const port = envPort !== undefined ? parseInt(envPort, 10) : 9847;
    logger_1.logger.info('Main', `Resolved Start Port: ${port}`);
    const proxy = new MCPProxy({
        port: port,
        host: process.env.MCP_PROXY_HOST || '127.0.0.1',
        logLevel: process.env.MCP_PROXY_LOG_LEVEL || 'info'
    });
    // Handle graceful shutdown
    const shutdown = async () => {
        logger_1.logger.info(LOG_CAT, 'Received shutdown signal');
        await proxy.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    try {
        await proxy.start();
        // Keep process running
        logger_1.logger.info(LOG_CAT, 'Press Ctrl+C to stop');
    }
    catch (error) {
        logger_1.logger.error(LOG_CAT, 'Failed to start proxy:', error);
        process.exit(1);
    }
}
// Run if executed directly
if (require.main === module) {
    main();
}
//# sourceMappingURL=index.js.map