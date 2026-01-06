/**
 * TechAI MCP Proxy - Request Router
 *
 * Routes MCP requests based on workspace context.
 * Determines which backend servers to use for each workspace.
 */
import { ProfileManager } from './profiles';
import { BackendPool } from './pool';
import { ContextInjector } from './context';
import { MCPRequest, MCPResponse, RequestContext } from './types';
interface WorkspaceSession {
    workspacePath: string;
    profileName: string;
    enabledServers: string[];
    contextInjector: ContextInjector;
    lastActivity: number;
}
export declare class Router {
    private profileManager;
    private backendPool;
    private sessions;
    private readonly SESSION_TTL_MS;
    constructor(profileManager: ProfileManager, backendPool: BackendPool);
    /**
     * Process an incoming MCP request with workspace context
     */
    handleRequest(request: MCPRequest, context: RequestContext): Promise<MCPResponse>;
    /**
     * Get or create a session for a workspace
     */
    private getOrCreateSession;
    /**
     * Ensure all required servers are connected
     */
    private ensureServersConnected;
    /**
     * Handle initialize request
     */
    private handleInitialize;
    /**
     * Handle tools/list - aggregate tools from enabled servers
     */
    private handleToolsList;
    /**
     * Handle tools/call - route to appropriate backend
     */
    private handleToolsCall;
    /**
     * Handle resources/list - aggregate resources + inject context
     */
    private handleResourcesList;
    /**
     * Handle resources/read - read from context or backend
     */
    private handleResourcesRead;
    /**
     * Handle prompts/list - aggregate prompts from enabled servers
     */
    private handlePromptsList;
    /**
     * Handle prompts/get - forward to appropriate backend
     */
    private handlePromptsGet;
    /**
     * Create an error response
     */
    private createErrorResponse;
    /**
     * Cleanup stale sessions
     */
    private cleanupStaleSessions;
    /**
     * Get session info for a workspace
     */
    getSessionInfo(workspaceId: string): WorkspaceSession | undefined;
    /**
     * Force refresh a session (re-detect profile)
     */
    refreshSession(workspaceId: string, workspacePath: string): Promise<void>;
    /**
     * Get all active sessions
     */
    getActiveSessions(): Map<string, WorkspaceSession>;
    /**
     * Cleanup resources
     */
    dispose(): void;
}
export {};
//# sourceMappingURL=router.d.ts.map