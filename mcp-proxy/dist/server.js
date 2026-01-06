"use strict";
/**
 * TechAI MCP Proxy - HTTP/SSE Server
 *
 * Exposes the MCP Proxy as an HTTP server using Server-Sent Events (SSE)
 * for streaming responses, compatible with MCP Streamable HTTP transport.
 *
 * Includes centralized config file watching with broadcast to all windows.
 * Provides API endpoints for analytics, usage, cache, and security status.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPProxyServer = void 0;
const http = __importStar(require("http"));
const config_watcher_1 = require("./config_watcher");
const logger_1 = require("./logger");
const LOG_CAT = 'Server';
class MCPProxyServer {
    constructor(router, config, services) {
        this.server = null;
        this.isRunning = false;
        this.router = router;
        this.config = config;
        this.services = services;
        this.sseHandler = new SSEHandler();
        this.configWatcher = new config_watcher_1.ConfigWatcher();
        // Wire up config changes to SSE broadcast
        this.configWatcher.on('change', (event) => {
            logger_1.logger.info(LOG_CAT, `Broadcasting config change to ${this.sseHandler.getClientCount()} clients`);
            this.sseHandler.broadcast('config_change', event);
        });
    }
    /**
     * Start the HTTP server
     */
    async start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    // Try next port
                    logger_1.logger.warn(LOG_CAT, `Port ${this.config.port} in use, trying ${this.config.port + 1}`);
                    this.config.port++;
                    this.start().then(resolve).catch(reject);
                }
                else {
                    reject(error);
                }
            });
            this.server.listen(this.config.port, this.config.host, () => {
                const address = this.server?.address();
                const port = typeof address === 'object' && address ? address.port : this.config.port;
                this.config.port = port; // Update config with actual port if 0 was used
                this.isRunning = true;
                // CRITICAL: This specific log format is parsed by the extension client
                logger_1.logger.info(LOG_CAT, `MCP Proxy Server running on http://${this.config.host}:${port}`);
                resolve(port);
            });
        });
    }
    /**
     * Stop the HTTP server
     */
    async stop() {
        return new Promise((resolve) => {
            this.configWatcher.dispose();
            this.sseHandler.closeAll();
            if (this.server) {
                this.server.close(() => {
                    this.isRunning = false;
                    logger_1.logger.info(LOG_CAT, 'Server stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    /**
     * Get the server port
     */
    getPort() {
        return this.config.port;
    }
    /**
     * Check if server is running
     */
    isActive() {
        return this.isRunning;
    }
    /**
     * Handle incoming HTTP requests
     */
    async handleRequest(req, res) {
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
            const clientId = req.headers['x-window-id'] || `client_${Date.now()}`;
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
                const request = JSON.parse(body);
                // Extract context from headers
                const context = {
                    workspaceId: req.headers['x-workspace-id'] || 'default',
                    workspacePath: req.headers['x-workspace-path'] || process.cwd(),
                    modelId: req.headers['x-model-id'],
                    sessionId: req.headers['x-session-id']
                };
                // Security check
                if (this.services?.security && request.method === 'tools/call') {
                    const params = request.params;
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
                    const params = request.params;
                    const toolName = params?.name || 'unknown';
                    const resultSize = JSON.stringify(response.result || {}).length;
                    const argsSize = JSON.stringify(params?.arguments || {}).length;
                    // Estimate tokens
                    const tokens = this.services.costTracker.estimateTokens(toolName, argsSize, resultSize);
                    // Track
                    this.services.analytics.trackToolCall(toolName, context.workspacePath, 0, // latency not measured yet
                    !response.error);
                    this.services.costTracker.trackToolCall(toolName, context.workspacePath, tokens.input, tokens.output);
                }
                // Send JSON response
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            }
            catch (error) {
                logger_1.logger.error(LOG_CAT, 'Failed to process request:', error);
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
exports.MCPProxyServer = MCPProxyServer;
/**
 * Server-Sent Events handler for real-time updates
 */
class SSEHandler {
    constructor() {
        this.clients = new Map();
    }
    /**
     * Register a new SSE client
     */
    register(clientId, res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        // Send initial connection event
        res.write(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`);
        this.clients.set(clientId, res);
        logger_1.logger.info(LOG_CAT, `SSE client connected: ${clientId}`);
        // Handle client disconnect
        res.on('close', () => {
            this.clients.delete(clientId);
            logger_1.logger.info(LOG_CAT, `SSE client disconnected: ${clientId}`);
        });
    }
    /**
     * Broadcast an event to all connected clients
     */
    broadcast(event, data) {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const [id, res] of this.clients) {
            try {
                res.write(message);
            }
            catch (e) {
                logger_1.logger.warn(LOG_CAT, `Failed to send to client ${id}:`, e);
                this.clients.delete(id);
            }
        }
    }
    /**
     * Close all SSE connections
     */
    closeAll() {
        for (const [id, res] of this.clients) {
            try {
                res.end();
            }
            catch {
                // Ignore
            }
        }
        this.clients.clear();
    }
    /**
     * Get number of connected clients
     */
    getClientCount() {
        return this.clients.size;
    }
}
//# sourceMappingURL=server.js.map