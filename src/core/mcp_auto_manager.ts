/**
 * TechQuotas Antigravity - MCP Auto Manager
 * Automatically applies Best Pick MCP servers per workspace
 */

import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { MCPManager } from './mcp_manager';
import { MCPRecommender } from './recommender';
import { MCPRegistry } from './mcp_registry';

const LOG_CAT = 'MCPAutoManager';

// Settings keys for user preferences
const SETTING_AUTO_APPLY = 'mcp.autoApplyBestPicks';
const SETTING_DISMISSED_WORKSPACES = 'mcp.dismissedWorkspaces';

export class MCPAutoManager {
    private context: vscode.ExtensionContext;
    private mcpManager: MCPManager;
    private registry: MCPRegistry;

    constructor(
        context: vscode.ExtensionContext,
        mcpManager: MCPManager,
        registry: MCPRegistry
    ) {
        this.context = context;
        this.mcpManager = mcpManager;
        this.registry = registry;

        logger.info(LOG_CAT, 'MCPAutoManager initialized');
    }

    /**
     * Check if Best Picks should be applied and prompt user if needed.
     * Called on workspace activation.
     */
    public async checkAndPrompt(): Promise<void> {
        const workspaceUri = this.getWorkspaceUri();
        if (!workspaceUri) {
            logger.debug(LOG_CAT, 'No workspace folder open');
            return;
        }

        const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'This Workspace';

        // Check if auto-apply is enabled
        const autoApply = this.context.globalState.get<boolean>(SETTING_AUTO_APPLY, false);
        if (autoApply) {
            logger.info(LOG_CAT, 'Auto-apply enabled, applying Best Picks silently');
            await this.applyBestPicks();
            return;
        }

        // Check if workspace is dismissed
        const dismissedWorkspaces = this.context.globalState.get<string[]>(SETTING_DISMISSED_WORKSPACES, []);
        if (dismissedWorkspaces.includes(workspaceUri)) {
            logger.debug(LOG_CAT, 'Workspace is dismissed, skipping prompt');
            return;
        }

        // Get Best Picks for this workspace
        const bestPickIds = await this.getBestPickServerIds();
        if (bestPickIds.length === 0) {
            logger.debug(LOG_CAT, 'No Best Picks found for this workspace');
            return;
        }

        // Check if config already matches Best Picks
        const installedIds = await this.mcpManager.getInstalledServerIds();
        const servers = await this.mcpManager.get_servers();
        const enabledIds = Object.entries(servers)
            .filter(([_, config]) => !config.disabled)
            .map(([id, _]) => id.toLowerCase());

        // Check if Best Picks are already the only enabled servers
        const bestPickSet = new Set(bestPickIds.map(id => id.toLowerCase()));
        const enabledSet = new Set(enabledIds);
        const alreadyApplied =
            bestPickSet.size === enabledSet.size &&
            [...bestPickSet].every(id => enabledSet.has(id));

        if (alreadyApplied) {
            logger.debug(LOG_CAT, 'Best Picks already applied');
            return;
        }

        // Show prompt
        const bestPickNames = bestPickIds.join(', ');
        const message = `Apply Best Pick MCP servers for "${workspaceName}"?\n\nThis will enable: ${bestPickNames}\nand disable all other MCP servers.`;

        const applyBtn = 'Apply Best Picks';
        const alwaysBtn = 'Always Auto-Apply';
        const dismissBtn = "Don't Show Again";

        const choice = await vscode.window.showInformationMessage(
            message,
            { modal: false },
            applyBtn,
            alwaysBtn,
            dismissBtn
        );

        switch (choice) {
            case applyBtn:
                await this.applyBestPicks();
                vscode.window.showInformationMessage(`Best Picks applied for ${workspaceName}`);
                break;

            case alwaysBtn:
                await this.context.globalState.update(SETTING_AUTO_APPLY, true);
                await this.applyBestPicks();
                vscode.window.showInformationMessage('Best Picks applied. Auto-apply enabled for all workspaces.');
                break;

            case dismissBtn:
                const updated = [...dismissedWorkspaces, workspaceUri];
                await this.context.globalState.update(SETTING_DISMISSED_WORKSPACES, updated);
                logger.info(LOG_CAT, `Workspace dismissed: ${workspaceUri}`);
                break;
        }
    }

    /**
     * Apply Best Picks: enable recommended servers, disable others.
     * Only installs TRUSTED sources automatically (community tools skipped).
     */
    public async applyBestPicks(): Promise<void> {
        // Use trustedOnly=true to only auto-install from verified sources
        const bestPickIds = await this.getBestPickServerIds(true);

        if (bestPickIds.length === 0) {
            logger.warn(LOG_CAT, 'No Best Picks to apply');
            vscode.window.showWarningMessage('No Best Picks found for this workspace.');
            return;
        }

        // Get installed server IDs
        const installedIds = await this.mcpManager.getInstalledServerIds();
        const installedSet = new Set(installedIds.map(id => id.toLowerCase()));

        // Find which Best Picks are installed
        const bestPicksToEnable = bestPickIds.filter(id => installedSet.has(id.toLowerCase()));
        const missingBestPicks = bestPickIds.filter(id => !installedSet.has(id.toLowerCase()));

        logger.info(LOG_CAT, `Best Picks to enable: ${bestPicksToEnable.join(', ')}`);
        logger.info(LOG_CAT, `Missing Best Picks: ${missingBestPicks.join(', ')}`);

        // If no Best Picks are installed, try to auto-install them
        if (bestPicksToEnable.length === 0) {
            vscode.window.showInformationMessage(`Auto-installing missing Best Picks: ${missingBestPicks.join(', ')}...`);

            let installedCount = 0;
            for (const id of missingBestPicks) {
                const success = await this.autoInstallServer(id);
                if (success) {
                    bestPicksToEnable.push(id);
                    installedCount++;
                }
            }

            if (installedCount === 0) {
                vscode.window.showWarningMessage(
                    `Could not auto-install: ${missingBestPicks.join(', ')}. ` +
                    'Please install them manually from the MCP Marketplace.'
                );
                return;
            }
        } else if (missingBestPicks.length > 0) {
            // Try to install the remaining missing ones too
            vscode.window.showInformationMessage(`Auto-installing missing keys: ${missingBestPicks.join(', ')}...`);
            for (const id of missingBestPicks) {
                const success = await this.autoInstallServer(id);
                if (success) {
                    bestPicksToEnable.push(id);
                }
            }
        }

        // Apply: enable Best Picks that are installed, disable others
        const result = await this.mcpManager.applyServerSet(bestPicksToEnable);
        logger.info(LOG_CAT, `Applied: ${result.enabled} enabled, ${result.disabled} disabled`);

        // Only prompt/notify if there were actual changes
        if (result.enabled > 0 || result.disabled > 0) {
            // Build result message
            let message = `Applied Best Picks: ${bestPicksToEnable.join(', ')}`;
            const stillMissing = missingBestPicks.filter(id => !bestPicksToEnable.includes(id));
            if (stillMissing.length > 0) {
                message += `\n\nFailed to install: ${stillMissing.join(', ')}`;
            }

            // Prompt to reload window
            const reloadBtn = 'Reload Window';
            const choice = await vscode.window.showInformationMessage(
                message + '\n\nReload window to activate changes?',
                reloadBtn
            );

            if (choice === reloadBtn) {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        } else {
            logger.debug(LOG_CAT, 'Best Picks already active, no changes needed.');
        }
    }

    /**
     * Installs and Enables Best Picks WITHOUT disabling other servers.
     * Use this for the "Install Best Picks" button in the UI.
     * Only installs TRUSTED sources (community tools require manual install).
     */
    public async installMissingBestPicks(): Promise<void> {
        // Use trustedOnly=true to only install verified sources
        const bestPickIds = await this.getBestPickServerIds(true);

        if (bestPickIds.length === 0) {
            vscode.window.showInformationMessage('No Best Picks found for this workspace.');
            return;
        }

        // Get installed server IDs
        const installedIds = await this.mcpManager.getInstalledServerIds();
        const installedSet = new Set(installedIds.map(id => id.toLowerCase()));

        // Find which Best Picks are NOT installed
        const missingBestPicks = bestPickIds.filter(id => !installedSet.has(id.toLowerCase()));

        // Find which are installed but disabled (we should enable them)
        const disabledBestPicks = bestPickIds.filter(id => {
            // Check if installed but key starts with _disabled_
            // getInstalledServerIds returns both enabled and disabled keys (normalized? wait)
            // mcpManager.getInstalledServerIds returns IDs. mcpManager.get_servers returns config.
            // Let's rely on applyServerSet to handle enabling.
            return installedSet.has(id.toLowerCase());
        });

        if (missingBestPicks.length === 0 && disabledBestPicks.length === 0) {
            vscode.window.showInformationMessage('All Best Picks are already installed and enabled.');
            return;
        }

        // Auto-install missing ones
        let installedCount = 0;
        if (missingBestPicks.length > 0) {
            vscode.window.showInformationMessage(`Installing missing Best Picks: ${missingBestPicks.join(', ')}...`);
            for (const id of missingBestPicks) {
                const success = await this.autoInstallServer(id);
                if (success) {
                    installedCount++;
                }
            }
        }

        // Now enable ALL Best Pick IDs (whether just installed or previously existing)
        // We use a custom logic here: Enable these, but DO NOT disable others.
        // mcpManager.applyServerSet disables others?
        // Let's check mcpManager.applyServerSet logic. 
        // It iterates ALL keys. If not in enableSet -> Disable.
        // We need a non-destructive method: enableServers(ids).

        // Since we don't have enableServers(), we can simulate it:
        // Get all currently enabled servers. Add Best Picks to that list. Call applyServerSet with the UNION.

        const servers = await this.mcpManager.get_servers();
        const currentlyEnabled = Object.keys(servers).filter(k => !k.startsWith('_disabled_') && !servers[k].disabled);

        // Union of currently enabled + best picks
        const unionSet = new Set([...currentlyEnabled, ...bestPickIds]);
        const unionIds = Array.from(unionSet);

        const result = await this.mcpManager.applyServerSet(unionIds);

        const reloadBtn = 'Reload Window';
        const choice = await vscode.window.showInformationMessage(
            `Installed/Enabled Best Picks. ${result.enabled} active. Reload to apply?`,
            reloadBtn
        );

        if (choice === reloadBtn) {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    }
    /**
     * TRUSTED SOURCES - Only these namespaces are auto-installed without warning
     * Based on research of official MCP server providers
     */
    private static readonly TRUSTED_NAMESPACES = [
        'modelcontextprotocol',   // Anthropic Official Reference Implementations
        'anthropic',              // Anthropic's own tools
        'github',                 // GitHub Official
        'cloudflare',             // Cloudflare Official
        'firebase',               // Firebase/Google (if official)
        'microsoft',              // Microsoft Official
        'aws',                    // Amazon Web Services
        'google',                 // Google Official
        'vercel',                 // Vercel Official
        'supabase',               // Supabase Official
        'stripe',                 // Stripe Official
        'twilio',                 // Twilio Official
    ];

    /**
     * Comprehensive installer registry for Best Pick tools
     * type: 'npm' | 'python'
     * trusted: true = auto-install allowed, false = requires manual confirmation
     */
    private static readonly INSTALLERS: Record<string, {
        type: 'npm' | 'python' | 'remote';
        package?: string;
        url?: string;
        trusted: boolean;
        requires?: string[]; // Required Environment Variables
        runConfig?: { command: string; args: string[] };
    }> = {
            // === TRUSTED: Anthropic Reference Implementations ===
            'github-mcp-server': {
                type: 'npm',
                package: '@modelcontextprotocol/server-github',
                trusted: true,
                requires: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
            },
            'server-git': {
                type: 'npm',
                package: '@modelcontextprotocol/server-git',
                trusted: true,
            },
            'server-filesystem': {
                type: 'npm',
                package: '@modelcontextprotocol/server-filesystem',
                trusted: true,
            },
            'server-postgres': {
                type: 'npm',
                package: '@modelcontextprotocol/server-postgres',
                trusted: true,
            },
            'server-slack': {
                type: 'npm',
                package: '@modelcontextprotocol/server-slack',
                trusted: true,
            },
            'server-memory': {
                type: 'npm',
                package: '@modelcontextprotocol/server-memory',
                trusted: true,
            },
            'server-puppeteer': {
                type: 'npm',
                package: '@modelcontextprotocol/server-puppeteer',
                trusted: true,
            },
            'server-brave-search': {
                type: 'npm',
                package: '@modelcontextprotocol/server-brave-search',
                trusted: true,
                requires: ['BRAVE_API_KEY'],
            },
            'server-google-maps': {
                type: 'npm',
                package: '@modelcontextprotocol/server-google-maps',
                trusted: true,
                requires: ['GOOGLE_MAPS_API_KEY'],
            },
            'server-fetch': {
                type: 'npm',
                package: '@modelcontextprotocol/server-fetch',
                trusted: true,
            },
            'server-sequential-thinking': {
                type: 'npm',
                package: '@modelcontextprotocol/server-sequential-thinking',
                trusted: true,
            },
            // === TRUSTED: Official Vendor Tools ===
            'firebase-mcp': {
                type: 'npm',
                package: 'firebase-mcp',
                trusted: true, // gannonh's is widely adopted
            },
            // Cloudflare Docs server (remote MCP - lightweight, no npm install needed)
            'cloudflare-docs': {
                type: 'remote',
                url: 'https://docs.mcp.cloudflare.com/mcp',
                trusted: true,
            },
            'cloudflare-mcp': {
                type: 'npm',
                package: '@cloudflare/mcp-server-cloudflare',
                trusted: true,
                requires: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
            },
            'mcp-server': { // Vercel Official
                type: 'npm',
                package: '@vercel/mcp-server',
                trusted: true,
                requires: ['VERCEL_API_TOKEN'],
            },
            // === COMMUNITY: Require Warning ===
            'mcp-git-ingest': {
                type: 'python',
                package: 'mcp-git-ingest',
                trusted: false, // adhikasp - community maintained
            },
        };

    /**
     * Attempts to auto-install a server by ID
     * @param id Server ID to install
     * @param trustedOnly If true, skip non-trusted sources
     */
    private async autoInstallServer(id: string, trustedOnly: boolean = true): Promise<boolean> {
        const installer = MCPAutoManager.INSTALLERS[id];
        if (!installer) {
            logger.warn(LOG_CAT, `No installer config for ${id}`);
            return false;
        }

        // Skip non-trusted if trustedOnly is set
        if (trustedOnly && !installer.trusted) {
            logger.info(LOG_CAT, `Skipping non-trusted tool ${id} (trustedOnly=true)`);
            return false;
        }

        try {
            let config: any;
            let envVars: Record<string, string> = {};

            // Check for required environment variables (Auth)
            if (installer.requires && installer.requires.length > 0) {
                logger.info(LOG_CAT, `Prompting for auth keys: ${installer.requires.join(', ')}`);
                const collected = await this.promptForEnvVars(installer.requires);
                if (!collected) {
                    vscode.window.showWarningMessage(`Installation of ${id} cancelled (missing auth).`);
                    return false;
                }
                envVars = collected;
            }

            if (installer.type === 'npm') {
                config = await this.buildNpmConfig(installer.package!, envVars);
            } else if (installer.type === 'python') {
                config = await this.buildPythonConfig(installer.package!, envVars);
            } else if (installer.type === 'remote') {
                // Remote MCP server (HTTP-based, no local install)
                config = {
                    url: installer.url,
                    transport: 'streamable-http'
                };
            }

            if (!config) {
                return false;
            }

            logger.info(LOG_CAT, `Auto-installing ${id} (${installer.type})...`);
            await this.mcpManager.install_server(id, config);
            return true;
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to auto-install ${id}: ${e.message}`);
            return false;
        }
    }

    /**
     * Use when tool requires API keys. Prompts user securely.
     */
    private async promptForEnvVars(requiredKeys: string[]): Promise<Record<string, string> | null> {
        const env: Record<string, string> = {};
        for (const key of requiredKeys) {
            const value = await vscode.window.showInputBox({
                prompt: `Enter API Key/Token for ${key}`,
                placeHolder: `Value for ${key} (required)`,
                password: true, // Mask input
                ignoreFocusOut: true
            });
            if (!value) {
                logger.warn(LOG_CAT, `User cancelled auth prompt for ${key}`);
                return null;
            }
            env[key] = value;
        }
        return env;
    }

    /**
     * Build config for npm-based MCP server
     */
    private async buildNpmConfig(packageName: string, env: Record<string, string> = {}): Promise<any> {
        const isWin = process.platform === 'win32';
        const command = isWin ? 'npx.cmd' : 'npx';

        return {
            command: command,
            args: ['-y', packageName],
            env: env
        };
    }

    /**
     * Build config for Python-based MCP server
     * Prefers uvx (isolated), falls back to pip
     */
    private async buildPythonConfig(packageName: string, env: Record<string, string> = {}): Promise<any> {
        const hasUvx = await this.checkCommand('uvx');

        if (hasUvx) {
            logger.info(LOG_CAT, `Using uvx for Python package: ${packageName}`);
            return {
                command: 'uvx',
                args: [packageName],
                env: env
            };
        }

        // Try to install uv first
        const installed = await this.ensureUvInstalled();
        if (installed) {
            return {
                command: 'uvx',
                args: [packageName],
                env: env
            };
        }

        // Fallback to pip (with warning)
        logger.warn(LOG_CAT, `Falling back to pip for ${packageName} (not isolated)`);
        vscode.window.showWarningMessage(
            `Installing ${packageName} globally via pip. Consider installing 'uv' for safer isolated installs.`
        );
        return {
            command: 'pip',
            args: ['install', packageName],
            env: env
        };
    }


    /**
     * Check if a command exists on the system
     */
    private async checkCommand(cmd: string): Promise<boolean> {
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
            exec(checkCmd, (error: any) => {
                resolve(!error);
            });
        });
    }

    /**
     * Ensure uv is installed (for uvx support)
     */
    private async ensureUvInstalled(): Promise<boolean> {
        const hasUv = await this.checkCommand('uv');
        if (hasUv) return true;

        // Try to install uv via pip
        logger.info(LOG_CAT, 'Installing uv for Python package management...');
        vscode.window.showInformationMessage('Installing uv for safe Python package management...');

        const { exec } = require('child_process');
        return new Promise((resolve) => {
            exec('pip install uv', (error: any) => {
                if (error) {
                    logger.error(LOG_CAT, `Failed to install uv: ${error.message}`);
                    resolve(false);
                } else {
                    logger.info(LOG_CAT, 'uv installed successfully');
                    resolve(true);
                }
            });
        });
    }

    /**
     * Get the server IDs of Best Picks for the current workspace.
     * @param trustedOnly If true, only return trusted Best Picks (for auto-install)
     */
    private async getBestPickServerIds(trustedOnly: boolean = false): Promise<string[]> {
        try {
            const registryData = await this.registry.get_registry_data();
            const recommender = new MCPRecommender();
            const recommendations = await recommender.getRecommendations(registryData);

            // Filter to Best Picks only
            let bestPicks = recommendations.filter(item => item.isBestPick);

            // If trustedOnly, further filter to trusted sources
            if (trustedOnly) {
                bestPicks = bestPicks.filter(item => item.isTrusted);
            }

            // Map registry names to config IDs
            const serverIds = bestPicks.map(item => {
                const parts = item.name.split('/');
                return parts.length > 1 ? parts[parts.length - 1] : item.name;
            });

            logger.debug(LOG_CAT, `Best Pick server IDs (trustedOnly=${trustedOnly}): ${serverIds.join(', ')}`);
            return serverIds;
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to get Best Pick server IDs: ${e.message}`);
            return [];
        }
    }

    /**
     * Get the current workspace URI as a string for storage
     */
    private getWorkspaceUri(): string | null {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return null;
        }
        return folders[0].uri.toString();
    }

    /**
     * Reset user preferences (for testing)
     */
    public async resetPreferences(): Promise<void> {
        await this.context.globalState.update(SETTING_AUTO_APPLY, undefined);
        await this.context.globalState.update(SETTING_DISMISSED_WORKSPACES, undefined);
        logger.info(LOG_CAT, 'Preferences reset');
    }
}
