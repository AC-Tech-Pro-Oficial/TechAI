/**
 * TechAI MCP Proxy - Request Router
 * 
 * Routes MCP requests based on workspace context.
 * Determines which backend servers to use for each workspace.
 */

import { ProfileManager } from './profiles';
import { BackendPool } from './pool';
import { ContextInjector } from './context';
import {
    MCPRequest,
    MCPResponse,
    RequestContext,
    ToolDefinition,
    Resource,
    PromptDefinition,
    ToolCallResult,
    ResourceContent
} from './types';
import { logger } from './logger';

const LOG_CAT = 'Router';

interface WorkspaceSession {
    workspacePath: string;
    profileName: string;
    enabledServers: string[];
    contextInjector: ContextInjector;
    lastActivity: number;
}

export class Router {
    private profileManager: ProfileManager;
    private backendPool: BackendPool;
    private sessions: Map<string, WorkspaceSession> = new Map();
    private readonly SESSION_TTL_MS = 300000; // 5 minutes

    constructor(profileManager: ProfileManager, backendPool: BackendPool) {
        this.profileManager = profileManager;
        this.backendPool = backendPool;

        // Cleanup stale sessions periodically
        setInterval(() => this.cleanupStaleSessions(), 60000);
    }

    /**
     * Process an incoming MCP request with workspace context
     */
    public async handleRequest(
        request: MCPRequest,
        context: RequestContext
    ): Promise<MCPResponse> {
        logger.debug(LOG_CAT, `Request: ${request.method} from workspace ${context.workspaceId}`);

        try {
            // Ensure session exists for this workspace
            const session = await this.getOrCreateSession(context);

            // Route based on method
            switch (request.method) {
                case 'initialize':
                    return this.handleInitialize(request, session);

                case 'tools/list':
                    return this.handleToolsList(request, session);

                case 'tools/call':
                    return this.handleToolsCall(request, session);

                case 'resources/list':
                    return this.handleResourcesList(request, session);

                case 'resources/read':
                    return this.handleResourcesRead(request, session);

                case 'prompts/list':
                    return this.handlePromptsList(request, session);

                case 'prompts/get':
                    return this.handlePromptsGet(request, session);

                default:
                    return this.createErrorResponse(request.id, -32601, `Method not found: ${request.method}`);
            }
        } catch (error) {
            logger.error(LOG_CAT, `Error handling request:`, error);
            return this.createErrorResponse(
                request.id,
                -32603,
                error instanceof Error ? error.message : 'Internal error'
            );
        }
    }

    /**
     * Get or create a session for a workspace
     */
    private async getOrCreateSession(context: RequestContext): Promise<WorkspaceSession> {
        let session = this.sessions.get(context.workspaceId);

        if (!session || session.workspacePath !== context.workspacePath) {
            // Create new session
            const profile = await this.profileManager.getProfileForWorkspace(context.workspacePath);

            session = {
                workspacePath: context.workspacePath,
                profileName: profile.name,
                enabledServers: profile.servers,
                contextInjector: new ContextInjector(context.workspacePath),
                lastActivity: Date.now()
            };

            this.sessions.set(context.workspaceId, session);

            // Connect to required backend servers
            logger.info(LOG_CAT, `Creating session for ${context.workspaceId} with profile "${profile.name}"`);
            await this.ensureServersConnected(session.enabledServers);
        }

        session.lastActivity = Date.now();
        return session;
    }

    /**
     * Ensure all required servers are connected
     */
    private async ensureServersConnected(serverIds: string[]): Promise<void> {
        const toConnect: string[] = [];

        for (const id of serverIds) {
            if (this.backendPool.hasServer(id)) {
                const status = this.backendPool.getServerStatus().get(id);
                if (!status || status.status !== 'connected') {
                    toConnect.push(id);
                }
            } else {
                logger.warn(LOG_CAT, `Server ${id} not found in MCP config`);
            }
        }

        if (toConnect.length > 0) {
            logger.info(LOG_CAT, `Connecting to ${toConnect.length} servers: ${toConnect.join(', ')}`);
            await this.backendPool.connectAll(toConnect);
        }
    }

    /**
     * Handle initialize request
     */
    private handleInitialize(request: MCPRequest, _session: WorkspaceSession): MCPResponse {
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: { listChanged: true },
                    resources: { subscribe: false, listChanged: true },
                    prompts: { listChanged: true }
                },
                serverInfo: {
                    name: 'TechAI-MCP-Proxy',
                    version: '1.0.0'
                }
            }
        };
    }

    /**
     * Handle tools/list - aggregate tools from enabled servers
     */
    private handleToolsList(request: MCPRequest, session: WorkspaceSession): MCPResponse {
        const tools = this.backendPool.getTools(session.enabledServers);

        logger.debug(LOG_CAT, `Returning ${tools.length} tools for workspace ${session.workspacePath}`);

        return {
            jsonrpc: '2.0',
            id: request.id,
            result: { tools }
        };
    }

    /**
     * Handle tools/call - route to appropriate backend
     */
    private async handleToolsCall(request: MCPRequest, _session: WorkspaceSession): Promise<MCPResponse> {
        const params = request.params as { name: string; arguments?: Record<string, unknown> };

        if (!params?.name) {
            return this.createErrorResponse(request.id, -32602, 'Missing tool name');
        }

        const result = await this.backendPool.callTool({
            name: params.name,
            arguments: params.arguments
        });

        return {
            jsonrpc: '2.0',
            id: request.id,
            result
        };
    }

    /**
     * Handle resources/list - aggregate resources + inject context
     */
    private handleResourcesList(request: MCPRequest, session: WorkspaceSession): MCPResponse {
        // Get resources from backend servers
        const backendResources = this.backendPool.getResources(session.enabledServers);

        // Get injected context resources
        const contextResources = session.contextInjector.getResources();

        // Combine both
        const allResources = [...contextResources, ...backendResources];

        logger.debug(LOG_CAT, `Returning ${allResources.length} resources (${contextResources.length} context + ${backendResources.length} backend)`);

        return {
            jsonrpc: '2.0',
            id: request.id,
            result: { resources: allResources }
        };
    }

    /**
     * Handle resources/read - read from context or backend
     */
    private async handleResourcesRead(request: MCPRequest, session: WorkspaceSession): Promise<MCPResponse> {
        const params = request.params as { uri: string };

        if (!params?.uri) {
            return this.createErrorResponse(request.id, -32602, 'Missing resource URI');
        }

        let contents: ResourceContent[];

        // Check if this is a context resource
        if (params.uri.startsWith('workspace://')) {
            try {
                const content = await session.contextInjector.readResource(params.uri);
                contents = [content];
            } catch (error) {
                return this.createErrorResponse(
                    request.id,
                    -32602,
                    error instanceof Error ? error.message : 'Resource not found'
                );
            }
        } else {
            // Read from backend
            try {
                contents = await this.backendPool.readResource(params.uri);
            } catch (error) {
                return this.createErrorResponse(
                    request.id,
                    -32602,
                    error instanceof Error ? error.message : 'Resource not found'
                );
            }
        }

        return {
            jsonrpc: '2.0',
            id: request.id,
            result: { contents }
        };
    }

    /**
     * Handle prompts/list - aggregate prompts from enabled servers
     */
    private handlePromptsList(request: MCPRequest, session: WorkspaceSession): MCPResponse {
        const prompts = this.backendPool.getPrompts(session.enabledServers);

        logger.debug(LOG_CAT, `Returning ${prompts.length} prompts`);

        return {
            jsonrpc: '2.0',
            id: request.id,
            result: { prompts }
        };
    }

    /**
     * Handle prompts/get - forward to appropriate backend
     */
    private async handlePromptsGet(request: MCPRequest, _session: WorkspaceSession): Promise<MCPResponse> {
        // TODO: Implement prompt retrieval from backends
        return this.createErrorResponse(request.id, -32601, 'prompts/get not yet implemented');
    }

    /**
     * Create an error response
     */
    private createErrorResponse(id: string | number, code: number, message: string): MCPResponse {
        return {
            jsonrpc: '2.0',
            id,
            error: { code, message }
        };
    }

    /**
     * Cleanup stale sessions
     */
    private cleanupStaleSessions(): void {
        const now = Date.now();
        const stale: string[] = [];

        for (const [id, session] of this.sessions) {
            if (now - session.lastActivity > this.SESSION_TTL_MS) {
                stale.push(id);
            }
        }

        for (const id of stale) {
            logger.debug(LOG_CAT, `Removing stale session: ${id}`);
            this.sessions.delete(id);
        }
    }

    /**
     * Get session info for a workspace
     */
    public getSessionInfo(workspaceId: string): WorkspaceSession | undefined {
        return this.sessions.get(workspaceId);
    }

    /**
     * Force refresh a session (re-detect profile)
     */
    public async refreshSession(workspaceId: string, workspacePath: string): Promise<void> {
        this.sessions.delete(workspaceId);
        await this.getOrCreateSession({ workspaceId, workspacePath });
    }

    /**
     * Get all active sessions
     */
    public getActiveSessions(): Map<string, WorkspaceSession> {
        return new Map(this.sessions);
    }

    /**
     * Cleanup resources
     */
    public dispose(): void {
        this.sessions.clear();
    }
}
