"use strict";
/**
 * TechAI MCP Proxy - Backend Connection Pool
 *
 * Manages connections to backend MCP servers.
 * Handles spawning, connecting, health checks, and tool/resource aggregation.
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
exports.BackendPool = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
const logger_1 = require("./logger");
const LOG_CAT = 'BackendPool';
class BackendPool {
    constructor(mcpConfigPath) {
        this.servers = new Map();
        this.processes = new Map();
        this.pendingRequests = new Map();
        this.mcpConfig = {};
        this.mcpConfigPath = mcpConfigPath || this.getDefaultConfigPath();
        this.loadMCPConfig();
    }
    /**
     * Get default MCP config path
     */
    getDefaultConfigPath() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        if (process.platform === 'win32') {
            return path.join(homeDir, '.gemini', 'antigravity', 'mcp_config.json');
        }
        else if (process.platform === 'darwin') {
            return path.join(homeDir, 'Library', 'Application Support', 'Antigravity', 'User', 'mcp_config.json');
        }
        else {
            return path.join(homeDir, '.config', 'antigravity', 'mcp_config.json');
        }
    }
    /**
     * Load MCP server configurations
     */
    loadMCPConfig() {
        try {
            if (fs.existsSync(this.mcpConfigPath)) {
                const content = fs.readFileSync(this.mcpConfigPath, 'utf-8');
                const parsed = JSON.parse(content);
                this.mcpConfig = parsed.mcpServers || {};
                logger_1.logger.info(LOG_CAT, `Loaded ${Object.keys(this.mcpConfig).length} MCP server configs`);
            }
        }
        catch (error) {
            logger_1.logger.error(LOG_CAT, 'Failed to load MCP config:', error);
        }
    }
    /**
     * Reload config (call when file changes)
     */
    reloadConfig() {
        this.loadMCPConfig();
    }
    /**
     * Connect to a backend MCP server
     */
    async connect(serverId) {
        const config = this.mcpConfig[serverId];
        if (!config) {
            logger_1.logger.warn(LOG_CAT, `No config found for server: ${serverId}`);
            return false;
        }
        // Check if already connected
        const existing = this.servers.get(serverId);
        if (existing?.status === 'connected') {
            return true;
        }
        // Initialize server state
        const server = {
            id: serverId,
            name: serverId,
            command: config.command,
            args: config.args,
            env: config.env,
            status: 'connecting'
        };
        this.servers.set(serverId, server);
        try {
            // Spawn the MCP server process
            const proc = (0, child_process_1.spawn)(config.command, config.args || [], {
                env: { ...process.env, ...config.env },
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });
            this.processes.set(serverId, proc);
            // Handle stdout (JSON-RPC messages)
            let buffer = '';
            proc.stdout?.on('data', (data) => {
                buffer += data.toString();
                this.processBuffer(serverId, buffer);
                buffer = '';
            });
            // Handle stderr (logs)
            proc.stderr?.on('data', (data) => {
                logger_1.logger.debug(LOG_CAT, `[${serverId}] stderr: ${data.toString().trim()}`);
            });
            // Handle process exit
            proc.on('exit', (code) => {
                logger_1.logger.info(LOG_CAT, `Server ${serverId} exited with code ${code}`);
                const srv = this.servers.get(serverId);
                if (srv) {
                    srv.status = 'disconnected';
                }
                this.processes.delete(serverId);
            });
            proc.on('error', (error) => {
                logger_1.logger.error(LOG_CAT, `Server ${serverId} error:`, error);
                const srv = this.servers.get(serverId);
                if (srv) {
                    srv.status = 'error';
                    srv.lastError = error.message;
                }
            });
            // Wait for process to start
            await new Promise(resolve => setTimeout(resolve, 500));
            // Initialize the connection
            const initResult = await this.sendRequest(serverId, 'initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {},
                    resources: {},
                    prompts: {}
                },
                clientInfo: {
                    name: 'TechAI-MCP-Proxy',
                    version: '1.0.0'
                }
            });
            if (initResult.error) {
                throw new Error(initResult.error.message);
            }
            // Send initialized notification
            this.sendNotification(serverId, 'notifications/initialized', {});
            // Fetch tools, resources, and prompts
            await this.refreshCapabilities(serverId);
            server.status = 'connected';
            logger_1.logger.info(LOG_CAT, `Connected to ${serverId}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(LOG_CAT, `Failed to connect to ${serverId}:`, error);
            server.status = 'error';
            server.lastError = error instanceof Error ? error.message : 'Unknown error';
            return false;
        }
    }
    /**
     * Disconnect from a backend server
     */
    async disconnect(serverId) {
        const proc = this.processes.get(serverId);
        if (proc) {
            proc.kill();
            this.processes.delete(serverId);
        }
        const server = this.servers.get(serverId);
        if (server) {
            server.status = 'disconnected';
        }
        logger_1.logger.info(LOG_CAT, `Disconnected from ${serverId}`);
    }
    /**
     * Connect to multiple servers
     */
    async connectAll(serverIds) {
        const results = new Map();
        await Promise.all(serverIds.map(async (id) => {
            const success = await this.connect(id);
            results.set(id, success);
        }));
        return results;
    }
    /**
     * Refresh tools, resources, and prompts from a server
     */
    async refreshCapabilities(serverId) {
        const server = this.servers.get(serverId);
        if (!server)
            return;
        try {
            // Get tools
            const toolsResult = await this.sendRequest(serverId, 'tools/list', {});
            if (toolsResult.result) {
                server.tools = toolsResult.result.tools;
                logger_1.logger.debug(LOG_CAT, `${serverId} has ${server.tools?.length || 0} tools`);
            }
            // Get resources
            const resourcesResult = await this.sendRequest(serverId, 'resources/list', {});
            if (resourcesResult.result) {
                server.resources = resourcesResult.result.resources;
                logger_1.logger.debug(LOG_CAT, `${serverId} has ${server.resources?.length || 0} resources`);
            }
            // Get prompts
            const promptsResult = await this.sendRequest(serverId, 'prompts/list', {});
            if (promptsResult.result) {
                server.prompts = promptsResult.result.prompts;
                logger_1.logger.debug(LOG_CAT, `${serverId} has ${server.prompts?.length || 0} prompts`);
            }
        }
        catch (error) {
            logger_1.logger.warn(LOG_CAT, `Failed to refresh capabilities for ${serverId}:`, error);
        }
    }
    /**
     * Process incoming data buffer for JSON-RPC messages
     */
    processBuffer(serverId, data) {
        const lines = data.split('\n').filter(line => line.trim());
        for (const line of lines) {
            try {
                const message = JSON.parse(line);
                if (message.id) {
                    const pending = this.pendingRequests.get(String(message.id));
                    if (pending) {
                        clearTimeout(pending.timeout);
                        pending.resolve(message);
                        this.pendingRequests.delete(String(message.id));
                    }
                }
            }
            catch {
                // Ignore non-JSON lines
            }
        }
    }
    /**
     * Send a request to a backend server
     */
    async sendRequest(serverId, method, params) {
        const proc = this.processes.get(serverId);
        if (!proc?.stdin) {
            throw new Error(`Server ${serverId} not connected`);
        }
        const id = (0, uuid_1.v4)();
        const request = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request ${method} to ${serverId} timed out`));
            }, 30000);
            this.pendingRequests.set(id, { resolve, reject, timeout });
            proc.stdin.write(JSON.stringify(request) + '\n');
        });
    }
    /**
     * Send a notification to a backend server (no response expected)
     */
    sendNotification(serverId, method, params) {
        const proc = this.processes.get(serverId);
        if (!proc?.stdin)
            return;
        const notification = {
            jsonrpc: '2.0',
            method,
            params
        };
        proc.stdin.write(JSON.stringify(notification) + '\n');
    }
    /**
     * Get aggregated tools from multiple servers
     */
    getTools(serverIds) {
        const tools = [];
        for (const id of serverIds) {
            const server = this.servers.get(id);
            if (server?.status === 'connected' && server.tools) {
                // Prefix tool names with server ID to avoid collisions
                for (const tool of server.tools) {
                    tools.push({
                        ...tool,
                        name: `${id}::${tool.name}`
                    });
                }
            }
        }
        return tools;
    }
    /**
     * Get aggregated resources from multiple servers
     */
    getResources(serverIds) {
        const resources = [];
        for (const id of serverIds) {
            const server = this.servers.get(id);
            if (server?.status === 'connected' && server.resources) {
                for (const resource of server.resources) {
                    resources.push({
                        ...resource,
                        uri: `${id}::${resource.uri}`
                    });
                }
            }
        }
        return resources;
    }
    /**
     * Get aggregated prompts from multiple servers
     */
    getPrompts(serverIds) {
        const prompts = [];
        for (const id of serverIds) {
            const server = this.servers.get(id);
            if (server?.status === 'connected' && server.prompts) {
                for (const prompt of server.prompts) {
                    prompts.push({
                        ...prompt,
                        name: `${id}::${prompt.name}`
                    });
                }
            }
        }
        return prompts;
    }
    /**
     * Execute a tool call on the appropriate backend
     */
    async callTool(params) {
        // Parse server ID from namespaced tool name
        const [serverId, toolName] = this.parseNamespacedName(params.name);
        if (!serverId) {
            return {
                content: [{ type: 'text', text: `Invalid tool name: ${params.name}` }],
                isError: true
            };
        }
        const server = this.servers.get(serverId);
        if (!server || server.status !== 'connected') {
            return {
                content: [{ type: 'text', text: `Server ${serverId} not connected` }],
                isError: true
            };
        }
        try {
            const result = await this.sendRequest(serverId, 'tools/call', {
                name: toolName,
                arguments: params.arguments
            });
            if (result.error) {
                return {
                    content: [{ type: 'text', text: result.error.message }],
                    isError: true
                };
            }
            return result.result;
        }
        catch (error) {
            return {
                content: [{ type: 'text', text: error instanceof Error ? error.message : 'Unknown error' }],
                isError: true
            };
        }
    }
    /**
     * Read a resource from the appropriate backend
     */
    async readResource(uri) {
        const [serverId, resourceUri] = this.parseNamespacedName(uri);
        if (!serverId) {
            throw new Error(`Invalid resource URI: ${uri}`);
        }
        const server = this.servers.get(serverId);
        if (!server || server.status !== 'connected') {
            throw new Error(`Server ${serverId} not connected`);
        }
        const result = await this.sendRequest(serverId, 'resources/read', {
            uri: resourceUri
        });
        if (result.error) {
            throw new Error(result.error.message);
        }
        return result.result.contents;
    }
    /**
     * Parse a namespaced name (serverId::name) into parts
     */
    parseNamespacedName(name) {
        const parts = name.split('::');
        if (parts.length >= 2) {
            return [parts[0], parts.slice(1).join('::')];
        }
        return [null, name];
    }
    /**
     * Get status of all servers
     */
    getServerStatus() {
        return new Map(this.servers);
    }
    /**
     * Get IDs of connected servers
     */
    getConnectedServerIds() {
        return Array.from(this.servers.entries())
            .filter(([, server]) => server.status === 'connected')
            .map(([id]) => id);
    }
    /**
     * Check if a server is available in config
     */
    hasServer(serverId) {
        return serverId in this.mcpConfig;
    }
    /**
     * Get all available server IDs from config
     */
    getAvailableServerIds() {
        return Object.keys(this.mcpConfig);
    }
    /**
     * Cleanup all connections
     */
    async dispose() {
        for (const [id, proc] of this.processes) {
            logger_1.logger.info(LOG_CAT, `Stopping server ${id}`);
            proc.kill();
        }
        this.processes.clear();
        this.servers.clear();
        for (const pending of this.pendingRequests.values()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Pool disposed'));
        }
        this.pendingRequests.clear();
    }
}
exports.BackendPool = BackendPool;
//# sourceMappingURL=pool.js.map