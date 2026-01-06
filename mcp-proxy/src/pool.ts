/**
 * TechAI MCP Proxy - Backend Connection Pool
 * 
 * Manages connections to backend MCP servers.
 * Handles spawning, connecting, health checks, and tool/resource aggregation.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
    BackendServer,
    ToolDefinition,
    Resource,
    PromptDefinition,
    MCPRequest,
    MCPResponse,
    ToolCallParams,
    ToolCallResult,
    ResourceContent
} from './types';
import { logger } from './logger';

const LOG_CAT = 'BackendPool';

interface PendingRequest {
    resolve: (value: MCPResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

interface MCPServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

export class BackendPool {
    private servers: Map<string, BackendServer> = new Map();
    private processes: Map<string, ChildProcess> = new Map();
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private mcpConfigPath: string;
    private mcpConfig: Record<string, MCPServerConfig> = {};

    constructor(mcpConfigPath?: string) {
        this.mcpConfigPath = mcpConfigPath || this.getDefaultConfigPath();
        this.loadMCPConfig();
    }

    /**
     * Get default MCP config path
     */
    private getDefaultConfigPath(): string {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';

        if (process.platform === 'win32') {
            return path.join(homeDir, '.gemini', 'antigravity', 'mcp_config.json');
        } else if (process.platform === 'darwin') {
            return path.join(homeDir, 'Library', 'Application Support', 'Antigravity', 'User', 'mcp_config.json');
        } else {
            return path.join(homeDir, '.config', 'antigravity', 'mcp_config.json');
        }
    }

    /**
     * Load MCP server configurations
     */
    private loadMCPConfig(): void {
        try {
            if (fs.existsSync(this.mcpConfigPath)) {
                const content = fs.readFileSync(this.mcpConfigPath, 'utf-8');
                const parsed = JSON.parse(content);
                this.mcpConfig = parsed.mcpServers || {};
                logger.info(LOG_CAT, `Loaded ${Object.keys(this.mcpConfig).length} MCP server configs`);
            }
        } catch (error) {
            logger.error(LOG_CAT, 'Failed to load MCP config:', error);
        }
    }

    /**
     * Reload config (call when file changes)
     */
    public reloadConfig(): void {
        this.loadMCPConfig();
    }

    /**
     * Connect to a backend MCP server
     */
    public async connect(serverId: string): Promise<boolean> {
        const config = this.mcpConfig[serverId];
        if (!config) {
            logger.warn(LOG_CAT, `No config found for server: ${serverId}`);
            return false;
        }

        // Check if already connected
        const existing = this.servers.get(serverId);
        if (existing?.status === 'connected') {
            return true;
        }

        // Initialize server state
        const server: BackendServer = {
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
            const proc = spawn(config.command, config.args || [], {
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
                logger.debug(LOG_CAT, `[${serverId}] stderr: ${data.toString().trim()}`);
            });

            // Handle process exit
            proc.on('exit', (code) => {
                logger.info(LOG_CAT, `Server ${serverId} exited with code ${code}`);
                const srv = this.servers.get(serverId);
                if (srv) {
                    srv.status = 'disconnected';
                }
                this.processes.delete(serverId);
            });

            proc.on('error', (error) => {
                logger.error(LOG_CAT, `Server ${serverId} error:`, error);
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
            logger.info(LOG_CAT, `Connected to ${serverId}`);
            return true;

        } catch (error) {
            logger.error(LOG_CAT, `Failed to connect to ${serverId}:`, error);
            server.status = 'error';
            server.lastError = error instanceof Error ? error.message : 'Unknown error';
            return false;
        }
    }

    /**
     * Disconnect from a backend server
     */
    public async disconnect(serverId: string): Promise<void> {
        const proc = this.processes.get(serverId);
        if (proc) {
            proc.kill();
            this.processes.delete(serverId);
        }

        const server = this.servers.get(serverId);
        if (server) {
            server.status = 'disconnected';
        }

        logger.info(LOG_CAT, `Disconnected from ${serverId}`);
    }

    /**
     * Connect to multiple servers
     */
    public async connectAll(serverIds: string[]): Promise<Map<string, boolean>> {
        const results = new Map<string, boolean>();

        await Promise.all(serverIds.map(async (id) => {
            const success = await this.connect(id);
            results.set(id, success);
        }));

        return results;
    }

    /**
     * Refresh tools, resources, and prompts from a server
     */
    private async refreshCapabilities(serverId: string): Promise<void> {
        const server = this.servers.get(serverId);
        if (!server) return;

        try {
            // Get tools
            const toolsResult = await this.sendRequest(serverId, 'tools/list', {});
            if (toolsResult.result) {
                server.tools = (toolsResult.result as { tools: ToolDefinition[] }).tools;
                logger.debug(LOG_CAT, `${serverId} has ${server.tools?.length || 0} tools`);
            }

            // Get resources
            const resourcesResult = await this.sendRequest(serverId, 'resources/list', {});
            if (resourcesResult.result) {
                server.resources = (resourcesResult.result as { resources: Resource[] }).resources;
                logger.debug(LOG_CAT, `${serverId} has ${server.resources?.length || 0} resources`);
            }

            // Get prompts
            const promptsResult = await this.sendRequest(serverId, 'prompts/list', {});
            if (promptsResult.result) {
                server.prompts = (promptsResult.result as { prompts: PromptDefinition[] }).prompts;
                logger.debug(LOG_CAT, `${serverId} has ${server.prompts?.length || 0} prompts`);
            }

        } catch (error) {
            logger.warn(LOG_CAT, `Failed to refresh capabilities for ${serverId}:`, error);
        }
    }

    /**
     * Process incoming data buffer for JSON-RPC messages
     */
    private processBuffer(serverId: string, data: string): void {
        const lines = data.split('\n').filter(line => line.trim());

        for (const line of lines) {
            try {
                const message = JSON.parse(line) as MCPResponse;

                if (message.id) {
                    const pending = this.pendingRequests.get(String(message.id));
                    if (pending) {
                        clearTimeout(pending.timeout);
                        pending.resolve(message);
                        this.pendingRequests.delete(String(message.id));
                    }
                }
            } catch {
                // Ignore non-JSON lines
            }
        }
    }

    /**
     * Send a request to a backend server
     */
    private async sendRequest(
        serverId: string,
        method: string,
        params: Record<string, unknown>
    ): Promise<MCPResponse> {
        const proc = this.processes.get(serverId);
        if (!proc?.stdin) {
            throw new Error(`Server ${serverId} not connected`);
        }

        const id = uuidv4();
        const request: MCPRequest = {
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

            proc.stdin!.write(JSON.stringify(request) + '\n');
        });
    }

    /**
     * Send a notification to a backend server (no response expected)
     */
    private sendNotification(
        serverId: string,
        method: string,
        params: Record<string, unknown>
    ): void {
        const proc = this.processes.get(serverId);
        if (!proc?.stdin) return;

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
    public getTools(serverIds: string[]): ToolDefinition[] {
        const tools: ToolDefinition[] = [];

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
    public getResources(serverIds: string[]): Resource[] {
        const resources: Resource[] = [];

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
    public getPrompts(serverIds: string[]): PromptDefinition[] {
        const prompts: PromptDefinition[] = [];

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
    public async callTool(params: ToolCallParams): Promise<ToolCallResult> {
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

            return result.result as ToolCallResult;

        } catch (error) {
            return {
                content: [{ type: 'text', text: error instanceof Error ? error.message : 'Unknown error' }],
                isError: true
            };
        }
    }

    /**
     * Read a resource from the appropriate backend
     */
    public async readResource(uri: string): Promise<ResourceContent[]> {
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

        return (result.result as { contents: ResourceContent[] }).contents;
    }

    /**
     * Parse a namespaced name (serverId::name) into parts
     */
    private parseNamespacedName(name: string): [string | null, string] {
        const parts = name.split('::');
        if (parts.length >= 2) {
            return [parts[0], parts.slice(1).join('::')];
        }
        return [null, name];
    }

    /**
     * Get status of all servers
     */
    public getServerStatus(): Map<string, BackendServer> {
        return new Map(this.servers);
    }

    /**
     * Get IDs of connected servers
     */
    public getConnectedServerIds(): string[] {
        return Array.from(this.servers.entries())
            .filter(([, server]) => server.status === 'connected')
            .map(([id]) => id);
    }

    /**
     * Check if a server is available in config
     */
    public hasServer(serverId: string): boolean {
        return serverId in this.mcpConfig;
    }

    /**
     * Get all available server IDs from config
     */
    public getAvailableServerIds(): string[] {
        return Object.keys(this.mcpConfig);
    }

    /**
     * Cleanup all connections
     */
    public async dispose(): Promise<void> {
        for (const [id, proc] of this.processes) {
            logger.info(LOG_CAT, `Stopping server ${id}`);
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
