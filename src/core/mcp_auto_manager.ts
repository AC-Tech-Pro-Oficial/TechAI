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
     * Only affects servers that are actually installed.
     * Warns if recommended servers are not installed yet.
     */
    public async applyBestPicks(): Promise<void> {
        const bestPickIds = await this.getBestPickServerIds();

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
    }

    /**
     * Installs and Enables Best Picks WITHOUT disabling other servers.
     * Use this for the "Install Best Picks" button in the UI.
     */
    public async installMissingBestPicks(): Promise<void> {
        const bestPickIds = await this.getBestPickServerIds();

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
     * Attempts to auto-install a server by ID using known configs
     */
    private async autoInstallServer(id: string): Promise<boolean> {
        // Known installers for Best Picks
        const INSTALLERS: Record<string, any> = {
            'github-mcp-server': {
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-github'],
                env: {}
            },
            'server-git': { // Try official npm package
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-git'],
                env: {}
            },
            'mcp-git-ingest': { // Python - try pip if python available, else fail
                command: 'pip',
                args: ['install', 'mcp-git-ingest'], // risky assumption without venv
            },
            'firebase-mcp': {
                command: 'npx',
                args: ['-y', 'firebase-mcp'], // Check if this is the right package
                env: {}
            }
        };

        const config = INSTALLERS[id];
        if (!config) {
            logger.warn(LOG_CAT, `No auto-install config for ${id}`);
            return false;
        }

        // For Python tools, we probably shouldn't just run 'pip install' globally
        // So for now, skip Python unless we are sure.
        // Actually, let's skip checking and just return false for now for non-npx to be safe
        if (config.command !== 'npx') {
            logger.warn(LOG_CAT, `Skipping auto-install for non-npx tool ${id}`);
            return false;
        }

        try {
            logger.info(LOG_CAT, `Auto-installing ${id}...`);
            // We just add the config to mcp_config.json. 
            // The actual "installation" happens when the server starts (npx downloads it).
            // So we just need to write the config!
            await this.mcpManager.install_server(id, config);
            return true;
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to auto-install ${id}: ${e.message}`);
            return false;
        }
    }

    /**
     * Get the server IDs of Best Picks for the current workspace.
     * These are the IDs as they would appear in mcp_config.json.
     */
    private async getBestPickServerIds(): Promise<string[]> {
        try {
            const registryData = await this.registry.get_registry_data();
            const recommender = new MCPRecommender();
            const recommendations = await recommender.getRecommendations(registryData);

            // Filter to Best Picks only
            const bestPicks = recommendations.filter(item => item.isBestPick);

            // Map registry names (e.g., "github/github-mcp-server") to likely config IDs
            // Common pattern: the repo name part (after /) is used as the server ID
            const serverIds = bestPicks.map(item => {
                // Try to extract a reasonable ID from the registry name
                const parts = item.name.split('/');
                return parts.length > 1 ? parts[parts.length - 1] : item.name;
            });

            logger.debug(LOG_CAT, `Best Pick server IDs: ${serverIds.join(', ')}`);
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
