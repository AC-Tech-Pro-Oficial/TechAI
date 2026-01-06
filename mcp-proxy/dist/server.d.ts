/**
 * TechAI MCP Proxy - HTTP/SSE Server
 *
 * Exposes the MCP Proxy as an HTTP server using Server-Sent Events (SSE)
 * for streaming responses, compatible with MCP Streamable HTTP transport.
 *
 * Includes centralized config file watching with broadcast to all windows.
 * Provides API endpoints for analytics, usage, cache, and security status.
 */
import { Router } from './router';
import { Analytics } from './analytics';
import { ResultCache } from './cache';
import { CostTracker } from './cost_tracker';
import { SecuritySandbox } from './security';
import { ToolFilter } from './tool_filter';
import { PromptLibrary } from './prompts';
export interface ServerConfig {
    port: number;
    host: string;
}
/**
 * Feature services passed from MCPProxy
 */
export interface ProxyServices {
    analytics: Analytics;
    cache: ResultCache;
    costTracker: CostTracker;
    security: SecuritySandbox;
    toolFilter: ToolFilter;
    prompts: PromptLibrary;
}
export declare class MCPProxyServer {
    private server;
    private router;
    private config;
    private isRunning;
    private sseHandler;
    private configWatcher;
    private services?;
    constructor(router: Router, config: ServerConfig, services?: ProxyServices);
    /**
     * Start the HTTP server
     */
    start(): Promise<number>;
    /**
     * Stop the HTTP server
     */
    stop(): Promise<void>;
    /**
     * Get the server port
     */
    getPort(): number;
    /**
     * Check if server is running
     */
    isActive(): boolean;
    /**
     * Handle incoming HTTP requests
     */
    private handleRequest;
}
//# sourceMappingURL=server.d.ts.map