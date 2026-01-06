/**
 * TechAI Extension - Model-Based MCP Activation
 * 
 * Automatically activates relevant MCP servers based on the AI model being used.
 * For example: Claude models → anthropic-tools, Gemini → gemini-mcp
 */

import * as vscode from 'vscode';
import { MCPManager } from './mcp_manager';
import { logger } from '../utils/logger';

const LOG_CAT = 'ModelMCPActivation';

/**
 * Default model → MCP server mappings
 * Users can customize these in settings
 */
export const DEFAULT_MODEL_MCP_MAPPINGS: Record<string, string[]> = {
    // Claude/Anthropic models
    'claude': ['anthropic/tool-search-mcp', 'anthropics/anthropic-tools'],
    'claude-3': ['anthropic/tool-search-mcp', 'anthropics/anthropic-tools'],
    'claude-3.5': ['anthropic/tool-search-mcp', 'anthropics/anthropic-tools'],
    'claude-sonnet': ['anthropic/tool-search-mcp', 'anthropics/anthropic-tools'],
    'claude-opus': ['anthropic/tool-search-mcp', 'anthropics/anthropic-tools'],

    // Gemini/Google models
    'gemini': ['google/gemini-mcp-server', 'aliargun/mcp-server-gemini', '@google/genai'],
    'gemini-pro': ['google/gemini-mcp-server', 'aliargun/mcp-server-gemini'],
    'gemini-flash': ['google/gemini-mcp-server', '@houtini/gemini-mcp'],
    'gemini-2': ['google/gemini-mcp-server', 'aliargun/mcp-server-gemini'],

    // OpenAI/GPT models
    'gpt': ['openai/openai-mcp'],
    'gpt-4': ['openai/openai-mcp'],
    'gpt-4o': ['openai/openai-mcp'],
    'o1': ['openai/openai-mcp'],

    // GitHub Copilot
    'copilot': ['github/copilot-mcp'],

    // Grok/X.AI
    'grok': ['xai-org/grok-mcp'],

    // Llama/Meta
    'llama': ['meta/llama-mcp'],
    'codellama': ['meta/llama-mcp'],

    // Mistral
    'mistral': ['mistralai/mistral-mcp'],
    'mixtral': ['mistralai/mistral-mcp']
};

/**
 * Get MCP servers to activate for a given model ID
 */
export function getMCPServersForModel(modelId: string): string[] {
    const lowerModel = modelId.toLowerCase();

    // Check for exact match first
    if (DEFAULT_MODEL_MCP_MAPPINGS[lowerModel]) {
        return DEFAULT_MODEL_MCP_MAPPINGS[lowerModel];
    }

    // Check for partial matches
    for (const [key, servers] of Object.entries(DEFAULT_MODEL_MCP_MAPPINGS)) {
        if (lowerModel.includes(key)) {
            return servers;
        }
    }

    return [];
}

/**
 * Model MCP Activator class
 */
export class ModelMCPActivator {
    private mcpManager: MCPManager;
    private context: vscode.ExtensionContext;
    private currentModel: string = '';
    private activatedServers: string[] = [];

    constructor(mcpManager: MCPManager, context: vscode.ExtensionContext) {
        this.mcpManager = mcpManager;
        this.context = context;
    }

    /**
     * Get user-configured model mappings (merged with defaults)
     */
    private getMappings(): Record<string, string[]> {
        const userMappings = this.context.globalState.get<Record<string, string[]>>('mcp.modelMappings', {});
        return { ...DEFAULT_MODEL_MCP_MAPPINGS, ...userMappings };
    }

    /**
     * Check if model-based activation is enabled
     */
    private isEnabled(): boolean {
        return this.context.globalState.get<boolean>('mcp.enableModelActivation', true);
    }

    /**
     * Activate MCP servers for a model
     */
    public async activateForModel(modelId: string): Promise<{ activated: string[]; skipped: string[] }> {
        if (!this.isEnabled()) {
            logger.debug(LOG_CAT, 'Model-based MCP activation is disabled');
            return { activated: [], skipped: [] };
        }

        const mappings = this.getMappings();
        const lowerModel = modelId.toLowerCase();

        // Find matching servers
        let serversToActivate: string[] = [];

        // Exact match
        for (const [key, servers] of Object.entries(mappings)) {
            if (lowerModel.includes(key.toLowerCase())) {
                serversToActivate = [...new Set([...serversToActivate, ...servers])];
            }
        }

        if (serversToActivate.length === 0) {
            logger.debug(LOG_CAT, `No MCP mappings found for model: ${modelId}`);
            return { activated: [], skipped: [] };
        }

        logger.info(LOG_CAT, `Model ${modelId} → activating MCP servers: ${serversToActivate.join(', ')}`);

        // Get currently installed servers
        const installedIds = await this.mcpManager.getInstalledServerIds();
        const installedSet = new Set(installedIds.map(id => id.toLowerCase()));

        const activated: string[] = [];
        const skipped: string[] = [];

        for (const serverId of serversToActivate) {
            // Check if server is installed (by name match)
            const serverKey = this.findInstalledServer(serverId, installedIds);

            if (serverKey) {
                // Enable the server
                await this.mcpManager.toggle_server(serverKey, true);
                activated.push(serverKey);
                logger.info(LOG_CAT, `Enabled: ${serverKey}`);
            } else {
                skipped.push(serverId);
                logger.debug(LOG_CAT, `Not installed: ${serverId}`);
            }
        }

        this.currentModel = modelId;
        this.activatedServers = activated;

        return { activated, skipped };
    }

    /**
     * Find installed server by partial name match
     */
    private findInstalledServer(targetId: string, installedIds: string[]): string | null {
        const targetLower = targetId.toLowerCase();
        const targetName = targetLower.split('/').pop() || targetLower;

        for (const installed of installedIds) {
            const installedLower = installed.toLowerCase();
            if (installedLower === targetLower || installedLower.includes(targetName)) {
                return installed;
            }
        }
        return null;
    }

    /**
     * Deactivate servers that were activated for the previous model
     */
    public async deactivatePreviousModel(): Promise<void> {
        if (this.activatedServers.length === 0) return;

        logger.info(LOG_CAT, `Deactivating ${this.activatedServers.length} servers from previous model`);

        for (const serverId of this.activatedServers) {
            await this.mcpManager.toggle_server(serverId, false);
        }

        this.activatedServers = [];
        this.currentModel = '';
    }

    /**
     * Get current model and its activated servers
     */
    public getStatus(): { model: string; servers: string[] } {
        return {
            model: this.currentModel,
            servers: this.activatedServers
        };
    }
}

/**
 * Workflow MCP activation
 * Parses workflow frontmatter for `mcpServers` key
 */
export function parseWorkflowMCPServers(workflowContent: string): string[] {
    // Parse YAML frontmatter
    const frontmatterMatch = workflowContent.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return [];

    const frontmatter = frontmatterMatch[1];

    // Look for mcpServers key (supports both array and comma-separated string)
    const mcpServersMatch = frontmatter.match(/mcpServers:\s*\[([^\]]+)\]|mcpServers:\s*(.+)/);
    if (!mcpServersMatch) return [];

    const rawServers = mcpServersMatch[1] || mcpServersMatch[2] || '';

    // Parse as array or comma-separated
    return rawServers
        .split(/[,\n]/)
        .map(s => s.trim().replace(/['"]/g, ''))
        .filter(s => s.length > 0);
}

/**
 * Activate MCP servers for a workflow
 */
export async function activateWorkflowMCPServers(
    workflowContent: string,
    mcpManager: MCPManager
): Promise<{ activated: string[]; notFound: string[] }> {
    const requiredServers = parseWorkflowMCPServers(workflowContent);

    if (requiredServers.length === 0) {
        return { activated: [], notFound: [] };
    }

    logger.info(LOG_CAT, `Workflow requires MCP servers: ${requiredServers.join(', ')}`);

    const installedIds = await mcpManager.getInstalledServerIds();
    const installedSet = new Set(installedIds.map(id => id.toLowerCase()));

    const activated: string[] = [];
    const notFound: string[] = [];

    for (const serverId of requiredServers) {
        const serverLower = serverId.toLowerCase();
        const matchedId = installedIds.find(id =>
            id.toLowerCase() === serverLower ||
            id.toLowerCase().includes(serverLower.split('/').pop() || '')
        );

        if (matchedId) {
            await mcpManager.toggle_server(matchedId, true);
            activated.push(matchedId);
            logger.info(LOG_CAT, `Workflow activated: ${matchedId}`);
        } else {
            notFound.push(serverId);
            logger.warn(LOG_CAT, `Workflow MCP server not installed: ${serverId}`);
        }
    }

    return { activated, notFound };
}
