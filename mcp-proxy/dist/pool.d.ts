/**
 * TechAI MCP Proxy - Backend Connection Pool
 *
 * Manages connections to backend MCP servers.
 * Handles spawning, connecting, health checks, and tool/resource aggregation.
 */
import { BackendServer, ToolDefinition, Resource, PromptDefinition, ToolCallParams, ToolCallResult, ResourceContent } from './types';
export declare class BackendPool {
    private servers;
    private processes;
    private pendingRequests;
    private mcpConfigPath;
    private mcpConfig;
    constructor(mcpConfigPath?: string);
    /**
     * Get default MCP config path
     */
    private getDefaultConfigPath;
    /**
     * Load MCP server configurations
     */
    private loadMCPConfig;
    /**
     * Reload config (call when file changes)
     */
    reloadConfig(): void;
    /**
     * Connect to a backend MCP server
     */
    connect(serverId: string): Promise<boolean>;
    /**
     * Disconnect from a backend server
     */
    disconnect(serverId: string): Promise<void>;
    /**
     * Connect to multiple servers
     */
    connectAll(serverIds: string[]): Promise<Map<string, boolean>>;
    /**
     * Refresh tools, resources, and prompts from a server
     */
    private refreshCapabilities;
    /**
     * Process incoming data buffer for JSON-RPC messages
     */
    private processBuffer;
    /**
     * Send a request to a backend server
     */
    private sendRequest;
    /**
     * Send a notification to a backend server (no response expected)
     */
    private sendNotification;
    /**
     * Get aggregated tools from multiple servers
     */
    getTools(serverIds: string[]): ToolDefinition[];
    /**
     * Get aggregated resources from multiple servers
     */
    getResources(serverIds: string[]): Resource[];
    /**
     * Get aggregated prompts from multiple servers
     */
    getPrompts(serverIds: string[]): PromptDefinition[];
    /**
     * Execute a tool call on the appropriate backend
     */
    callTool(params: ToolCallParams): Promise<ToolCallResult>;
    /**
     * Read a resource from the appropriate backend
     */
    readResource(uri: string): Promise<ResourceContent[]>;
    /**
     * Parse a namespaced name (serverId::name) into parts
     */
    private parseNamespacedName;
    /**
     * Get status of all servers
     */
    getServerStatus(): Map<string, BackendServer>;
    /**
     * Get IDs of connected servers
     */
    getConnectedServerIds(): string[];
    /**
     * Check if a server is available in config
     */
    hasServer(serverId: string): boolean;
    /**
     * Get all available server IDs from config
     */
    getAvailableServerIds(): string[];
    /**
     * Cleanup all connections
     */
    dispose(): Promise<void>;
}
//# sourceMappingURL=pool.d.ts.map