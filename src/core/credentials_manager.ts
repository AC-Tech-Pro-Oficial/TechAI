/**
 * TechAI Antigravity - Credentials Manager
 * Secure storage for MCP server API keys and LLM provider credentials
 */

import * as vscode from 'vscode';
import { logger } from '../utils/logger';

const LOG_CAT = 'CredentialsManager';

export interface CredentialInfo {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    hasCredential: boolean;
}

export interface LLMProviderConfig {
    id: string;
    name: string;
    enabled: boolean;
    apiKey?: string;
    endpoint?: string;
    model?: string;
    description?: string;
    icon?: string;
}

/**
 * Default LLM provider configurations
 */
export const DEFAULT_LLM_PROVIDERS: LLMProviderConfig[] = [
    {
        id: 'openai',
        name: 'OpenAI',
        enabled: false,
        endpoint: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        description: 'GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo',
        icon: '🤖'
    },
    {
        id: 'anthropic',
        name: 'Anthropic (Claude)',
        enabled: false,
        endpoint: 'https://api.anthropic.com/v1',
        model: 'claude-3-5-sonnet-20241022',
        description: 'Claude 3.5 Sonnet, Claude 3 Opus',
        icon: '🧠'
    },
    {
        id: 'groq',
        name: 'Groq',
        enabled: false,
        endpoint: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile',
        description: 'Llama 3.3 70B, Mixtral 8x7B (Ultra Fast)',
        icon: '⚡'
    },
    {
        id: 'together',
        name: 'Together AI',
        enabled: false,
        endpoint: 'https://api.together.xyz/v1',
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        description: 'Llama 3.3, Qwen 2.5, DeepSeek',
        icon: '🔗'
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        enabled: false,
        endpoint: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-3.5-sonnet',
        description: 'Access 100+ models via single API',
        icon: '🌐'
    },
    {
        id: 'ollama',
        name: 'Ollama (Local)',
        enabled: false,
        endpoint: 'http://localhost:11434/v1',
        model: 'llama3.2',
        description: 'Run models locally (free)',
        icon: '🏠'
    }
];

/**
 * Known MCP servers that require credentials
 */
export const MCP_SERVER_CREDENTIALS: CredentialInfo[] = [
    { id: 'github', name: 'GitHub', description: 'GITHUB_TOKEN for repository access', icon: '📦', hasCredential: false },
    { id: 'supabase', name: 'Supabase', description: 'Supabase API key', icon: '🗄️', hasCredential: false },
    { id: 'stripe', name: 'Stripe', description: 'Stripe API key (restricted)', icon: '💳', hasCredential: false },
    { id: 'slack', name: 'Slack', description: 'Slack Bot Token', icon: '💬', hasCredential: false },
    { id: 'notion', name: 'Notion', description: 'Notion Integration Token', icon: '📝', hasCredential: false },
    { id: 'firebase', name: 'Firebase', description: 'Firebase Service Account', icon: '🔥', hasCredential: false },
    { id: 'aws', name: 'AWS', description: 'AWS Access Key', icon: '☁️', hasCredential: false },
    { id: 'gcp', name: 'Google Cloud', description: 'GCP Service Account Key', icon: '🌩️', hasCredential: false },
];

/**
 * Manages secure credential storage using VS Code's SecretStorage API
 */
export class CredentialsManager {
    private secrets: vscode.SecretStorage;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.secrets = context.secrets;
    }

    // ========== MCP Server Credentials ==========

    /**
     * Get credential for an MCP server
     */
    async getMCPCredential(serverId: string): Promise<string | undefined> {
        const key = `mcp.credential.${serverId}`;
        return await this.secrets.get(key);
    }

    /**
     * Set credential for an MCP server
     */
    async setMCPCredential(serverId: string, value: string): Promise<void> {
        const key = `mcp.credential.${serverId}`;
        await this.secrets.store(key, value);
        logger.info(LOG_CAT, `Stored credential for MCP server: ${serverId}`);
    }

    /**
     * Delete credential for an MCP server
     */
    async deleteMCPCredential(serverId: string): Promise<void> {
        const key = `mcp.credential.${serverId}`;
        await this.secrets.delete(key);
        logger.info(LOG_CAT, `Deleted credential for MCP server: ${serverId}`);
    }

    /**
     * Get list of all MCP servers with credential status
     */
    async getMCPCredentialsList(): Promise<CredentialInfo[]> {
        const list = [...MCP_SERVER_CREDENTIALS];

        for (const item of list) {
            const cred = await this.getMCPCredential(item.id);
            item.hasCredential = !!cred;
        }

        return list;
    }

    // ========== LLM Provider Credentials ==========

    /**
     * Get API key for an LLM provider
     */
    async getLLMApiKey(providerId: string): Promise<string | undefined> {
        const key = `llm.apikey.${providerId}`;
        return await this.secrets.get(key);
    }

    /**
     * Set API key for an LLM provider
     */
    async setLLMApiKey(providerId: string, apiKey: string): Promise<void> {
        const key = `llm.apikey.${providerId}`;
        await this.secrets.store(key, apiKey);
        logger.info(LOG_CAT, `Stored API key for LLM provider: ${providerId}`);
    }

    /**
     * Delete API key for an LLM provider
     */
    async deleteLLMApiKey(providerId: string): Promise<void> {
        const key = `llm.apikey.${providerId}`;
        await this.secrets.delete(key);
        logger.info(LOG_CAT, `Deleted API key for LLM provider: ${providerId}`);
    }

    /**
     * Get LLM provider configuration (stored in globalState)
     */
    getLLMProviderConfig(providerId: string): LLMProviderConfig | undefined {
        const configs = this.context.globalState.get<LLMProviderConfig[]>('llm.providers', DEFAULT_LLM_PROVIDERS);
        return configs.find(p => p.id === providerId);
    }

    /**
     * Update LLM provider configuration
     */
    async updateLLMProviderConfig(config: Partial<LLMProviderConfig> & { id: string }): Promise<void> {
        const configs = this.context.globalState.get<LLMProviderConfig[]>('llm.providers', DEFAULT_LLM_PROVIDERS);
        const index = configs.findIndex(p => p.id === config.id);

        if (index >= 0) {
            configs[index] = { ...configs[index], ...config };
        } else {
            configs.push(config as LLMProviderConfig);
        }

        await this.context.globalState.update('llm.providers', configs);
        logger.info(LOG_CAT, `Updated LLM provider config: ${config.id}`);
    }

    /**
     * Get all LLM provider configurations with API key status
     */
    async getLLMProvidersList(): Promise<(LLMProviderConfig & { hasApiKey: boolean })[]> {
        const configs = this.context.globalState.get<LLMProviderConfig[]>('llm.providers', DEFAULT_LLM_PROVIDERS);
        const result: (LLMProviderConfig & { hasApiKey: boolean })[] = [];

        for (const config of configs) {
            const apiKey = await this.getLLMApiKey(config.id);
            result.push({
                ...config,
                hasApiKey: !!apiKey
            });
        }

        return result;
    }

    /**
     * Get all enabled LLM providers (for sub-agent use)
     */
    async getEnabledLLMProviders(): Promise<LLMProviderConfig[]> {
        const configs = this.context.globalState.get<LLMProviderConfig[]>('llm.providers', DEFAULT_LLM_PROVIDERS);
        return configs.filter(p => p.enabled);
    }

    // ========== Context Injection Settings ==========

    /**
     * Get context injection settings
     */
    getContextSettings(): ContextInjectionSettings {
        return this.context.globalState.get<ContextInjectionSettings>('context.injection', DEFAULT_CONTEXT_SETTINGS);
    }

    /**
     * Update context injection settings
     */
    async updateContextSettings(settings: Partial<ContextInjectionSettings>): Promise<void> {
        const current = this.getContextSettings();
        const updated = { ...current, ...settings };
        await this.context.globalState.update('context.injection', updated);
        logger.info(LOG_CAT, 'Updated context injection settings');
    }
}

/**
 * Context injection settings
 */
export interface ContextInjectionSettings {
    includeReadme: boolean;
    includeManifest: boolean;
    includeGitignore: boolean;
    includeSystemContext: boolean;
    cacheTtlSeconds: number;
    maxContextTokens: number;
    customFiles: string[];
}

export const DEFAULT_CONTEXT_SETTINGS: ContextInjectionSettings = {
    includeReadme: true,
    includeManifest: true,
    includeGitignore: true,
    includeSystemContext: true,
    cacheTtlSeconds: 30,
    maxContextTokens: 50000,
    customFiles: []
};
