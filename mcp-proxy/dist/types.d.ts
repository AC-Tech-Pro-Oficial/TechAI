/**
 * TechAI MCP Proxy - Type Definitions
 */
/**
 * MCP JSON-RPC Message Types
 */
export interface MCPRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
}
export interface MCPResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: unknown;
    error?: MCPError;
}
export interface MCPError {
    code: number;
    message: string;
    data?: unknown;
}
export interface MCPNotification {
    jsonrpc: '2.0';
    method: string;
    params?: Record<string, unknown>;
}
/**
 * Tool Definitions
 */
export interface ToolDefinition {
    name: string;
    description?: string;
    inputSchema: {
        type: 'object';
        properties?: Record<string, unknown>;
        required?: string[];
    };
}
export interface ToolsListResult {
    tools: ToolDefinition[];
}
export interface ToolCallParams {
    name: string;
    arguments?: Record<string, unknown>;
}
export interface ToolCallResult {
    content: Array<{
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}
/**
 * Resource Definitions (for context injection)
 */
export interface Resource {
    uri: string;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
    size?: number;
    annotations?: ResourceAnnotations;
}
export interface ResourceAnnotations {
    audience?: ('user' | 'assistant')[];
    priority?: number;
    lastModified?: string;
}
export interface ResourceContent {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
}
export interface ResourcesListResult {
    resources: Resource[];
}
export interface ResourceReadResult {
    contents: ResourceContent[];
}
/**
 * Prompt Definitions (for context templates)
 */
export interface PromptDefinition {
    name: string;
    description?: string;
    arguments?: PromptArgument[];
}
export interface PromptArgument {
    name: string;
    description?: string;
    required?: boolean;
}
export interface PromptsListResult {
    prompts: PromptDefinition[];
}
export interface PromptMessage {
    role: 'user' | 'assistant';
    content: {
        type: 'text' | 'image' | 'resource';
        text?: string;
        resource?: {
            uri: string;
        };
    };
}
export interface PromptGetResult {
    description?: string;
    messages: PromptMessage[];
}
/**
 * Workspace Profile Configuration
 */
export interface WorkspaceProfile {
    name: string;
    match: string[];
    servers: string[];
    resources?: string[];
    prompts?: string[];
}
export interface ProfileConfig {
    version: number;
    profiles: WorkspaceProfile[];
    defaultProfile?: string;
}
/**
 * Backend MCP Server Connection
 */
export interface BackendServer {
    id: string;
    name: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    tools?: ToolDefinition[];
    resources?: Resource[];
    prompts?: PromptDefinition[];
    lastError?: string;
}
/**
 * Proxy Server Configuration
 */
export interface ProxyConfig {
    port: number;
    host: string;
    profilesPath: string;
    mcpConfigPath: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}
/**
 * Request Context (passed via headers)
 */
export interface RequestContext {
    workspaceId: string;
    workspacePath: string;
    modelId?: string;
    sessionId?: string;
}
/**
 * Server Capabilities
 */
export interface ServerCapabilities {
    tools?: {
        listChanged?: boolean;
    };
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    prompts?: {
        listChanged?: boolean;
    };
}
export interface InitializeResult {
    protocolVersion: string;
    capabilities: ServerCapabilities;
    serverInfo: {
        name: string;
        version: string;
    };
}
//# sourceMappingURL=types.d.ts.map