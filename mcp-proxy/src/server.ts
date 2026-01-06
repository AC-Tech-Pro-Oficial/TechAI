/**
 * TechAI MCP Proxy - HTTP/SSE Server
 * 
 * Exposes the MCP Proxy as an HTTP server using Server-Sent Events (SSE)
 * for streaming responses, compatible with MCP Streamable HTTP transport.
 * 
 * Includes centralized config file watching with broadcast to all windows.
 * Provides API endpoints for analytics, usage, cache, and security status.
 */

import * as http from 'http';
import { Router } from './router';
import { MCPRequest, RequestContext } from './types';
import { ConfigWatcher, ConfigChangeEvent } from './config_watcher';
import { Analytics } from './analytics';
import { ResultCache } from './cache';
import { CostTracker } from './cost_tracker';
import { SecuritySandbox } from './security';
import { ToolFilter } from './tool_filter';
import { PromptLibrary } from './prompts';
import { logger } from './logger';

const LOG_CAT = 'Server';

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

export class MCPProxyServer {
    private server: http.Server | null = null;
    private router: Router;
    private config: ServerConfig;
    private isRunning = false;
    private sseHandler: SSEHandler;
    private configWatcher: ConfigWatcher;
    private services?: ProxyServices;

    constructor(router: Router, config: ServerConfig, services?: ProxyServices) {
        this.router = router;
        this.config = config;
        this.services = services;
        this.sseHandler = new SSEHandler();
        this.configWatcher = new ConfigWatcher();

        // Wire up config changes to SSE broadcast
        this.configWatcher.on('change', (event: ConfigChangeEvent) => {
            logger.info(LOG_CAT, `Broadcasting config change to ${this.sseHandler.getClientCount()} clients`);
            this.sseHandler.broadcast('config_change', event);
        });
    }

    /**
     * Start the HTTP server
     */
    public async start(): Promise<number> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            this.server.on('error', (error: NodeJS.ErrnoException) => {
                if (error.code === 'EADDRINUSE') {
                    // Try next port
                    logger.warn(LOG_CAT, `Port ${this.config.port} in use, trying ${this.config.port + 1}`);
                    this.config.port++;
                    this.start().then(resolve).catch(reject);
                } else {
                    reject(error);
                }
            });

            this.server.listen(this.config.port, this.config.host, () => {
                const address = this.server?.address();
                const port = typeof address === 'object' && address ? address.port : this.config.port;
                this.config.port = port; // Update config with actual port if 0 was used
                
                this.isRunning = true;
                // CRITICAL: This specific log format is parsed by the extension client
                logger.info(LOG_CAT, `MCP Proxy Server running on http://${this.config.host}:${port}`);
                resolve(port);
            });
        });
    }

    /**
     * Stop the HTTP server
     */
    public async stop(): Promise<void> {
        return new Promise((resolve) => {
            this.configWatcher.dispose();
            this.sseHandler.closeAll();

            if (this.server) {
                this.server.close(() => {
                    this.isRunning = false;
                    logger.info(LOG_CAT, 'Server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Get the server port
     */
    public getPort(): number {
        return this.config.port;
    }

    /**
     * Check if server is running
     */
    public isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Handle incoming HTTP requests
     */
    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Workspace-ID, X-Workspace-Path, X-Model-ID, X-Session-ID');

        // Handle preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = req.url || '/';

        // Health check endpoint
        if (url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
            return;
        }

        // Status endpoint
        if (url === '/status') {
            const sessions = this.router.getActiveSessions();
            const status = {
                running: this.isRunning,
                port: this.config.port,
                sseClients: this.sseHandler.getClientCount(),
                configPath: this.configWatcher.getPath(),
                sessions: Array.from(sessions.entries()).map(([id, session]) => ({
                    id,
                    profile: session.profileName,
                    servers: session.enabledServers,
                    lastActivity: new Date(session.lastActivity).toISOString()
                }))
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(status, null, 2));
            return;
        }

        // Analytics endpoint
        if (url === '/analytics') {
            if (!this.services?.analytics) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Analytics service not available' }));
                return;
            }
            const data = this.services.analytics.getSummary();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data, null, 2));
            return;
        }

        // Usage/Cost endpoint
        if (url === '/usage') {
            if (!this.services?.costTracker) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Cost tracker not available' }));
                return;
            }
            const data = this.services.costTracker.getSummary();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data, null, 2));
            return;
        }

        // Cache stats endpoint
        if (url === '/cache') {
            if (!this.services?.cache) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Cache service not available' }));
                return;
            }
            const data = this.services.cache.getStats();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data, null, 2));
            return;
        }

        // Security status endpoint
        if (url === '/security') {
            if (!this.services?.security) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Security service not available' }));
                return;
            }
            const data = this.services.security.getStatus();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data, null, 2));
            return;
        }

        // SSE endpoint for config change subscriptions
        if (url === '/events' && req.method === 'GET') {
            const clientId = req.headers['x-window-id'] as string || `client_${Date.now()}`;
            this.sseHandler.register(clientId, res);
            return;
        }

        // Only accept POST for MCP requests
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        // Parse request body
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const request = JSON.parse(body) as MCPRequest;

                // Extract context from headers
                const context: RequestContext = {
                    workspaceId: req.headers['x-workspace-id'] as string || 'default',
                    workspacePath: req.headers['x-workspace-path'] as string || process.cwd(),
                    modelId: req.headers['x-model-id'] as string,
                    sessionId: req.headers['x-session-id'] as string
                };

                // Security check
                if (this.services?.security && request.method === 'tools/call') {
                    const params = request.params as { name: string; arguments?: Record<string, any> };
                    const violation = this.services.security.validate(params?.name || '', params?.arguments || {});
                    if (violation) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            id: request.id,
                            error: { code: -32000, message: violation }
                        }));
                        return;
                    }
                }

                // Process request through router
                const response = await this.router.handleRequest(request, context);

                // Track analytics and cost if tools/call
                if (this.services && request.method === 'tools/call') {
                    const params = request.params as { name: string; arguments?: Record<string, any> };
                    const toolName = params?.name || 'unknown';
                    const resultSize = JSON.stringify(response.result || {}).length;
                    const argsSize = JSON.stringify(params?.arguments || {}).length;

                    // Estimate tokens
                    const tokens = this.services.costTracker.estimateTokens(toolName, argsSize, resultSize);

                    // Track
                    this.services.analytics.trackToolCall(
                        toolName,
                        context.workspacePath,
                        0, // latency not measured yet
                        !response.error
                    );
                    this.services.costTracker.trackToolCall(
                        toolName,
                        context.workspacePath,
                        tokens.input,
                        tokens.output
                    );
                }

                // Send JSON response
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));

            } catch (error) {
                logger.error(LOG_CAT, 'Failed to process request:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    id: null,
                    error: {
                        code: -32700,
                        message: 'Parse error'
                    }
                }));
            }
        });
    }
}

/**
 * Server-Sent Events handler for real-time updates
 */
class SSEHandler {
    private clients: Map<string, http.ServerResponse> = new Map();

    /**
     * Register a new SSE client
     */
    public register(clientId: string, res: http.ServerResponse): void {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Send initial connection event
        res.write(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`);

        this.clients.set(clientId, res);
        logger.info(LOG_CAT, `SSE client connected: ${clientId}`);

        // Handle client disconnect
        res.on('close', () => {
            this.clients.delete(clientId);
            logger.info(LOG_CAT, `SSE client disconnected: ${clientId}`);
        });
    }

    /**
     * Broadcast an event to all connected clients
     */
    public broadcast(event: string, data: any): void {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

        for (const [id, res] of this.clients) {
            try {
                res.write(message);
            } catch (e) {
                logger.warn(LOG_CAT, `Failed to send to client ${id}:`, e);
                this.clients.delete(id);
            }
        }
    }

    /**
     * Close all SSE connections
     */
    public closeAll(): void {
        for (const [id, res] of this.clients) {
            try {
                res.end();
            } catch {
                // Ignore
            }
        }
        this.clients.clear();
    }

    /**
     * Get number of connected clients
     */
    public getClientCount(): number {
        return this.clients.size;
    }
}
