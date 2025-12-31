/**
 * TechQuotas Antigravity - MCP Manager
 * Core logic for reading, writing, and managing MCP server configurations
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';
import { MCPConfig, MCPServerConfig, MCPServersCollection, MCPConfigChangeEvent } from '../utils/mcp_types';

const LOG_CAT = 'MCPManager';

export class MCPManager {
    private config_path: string;
    private config_watcher: fs.FSWatcher | null = null;
    private _on_config_change = new vscode.EventEmitter<MCPConfigChangeEvent>();

    public readonly on_config_change = this._on_config_change.event;

    constructor() {
        this.config_path = this.resolve_config_path();
        logger.info(LOG_CAT, `MCP Manager initialized. Config path: ${this.config_path}`);
        this.init_watcher();
    }

    /**
     * Resolves the path to mcp_config.json based on platform
     * Matches path found in research: C:\Users\MBCJ\AppData\Roaming\Antigravity\User\mcp_config.json
     */
    private resolve_config_path(): string {
        // 1. Check for Antigravity specific path (User Request)
        const antigravityPath = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
        // We prioritize this path if we are in the Antigravity context or if it exists
        // Since the user explicitly requested it, we check for it.
        // We'll trust it exists or we default to it if we want to create it there.
        // But for safety, let's check existence first, or just return it if we want to switch entirely.

        // Actually, let's just make it the primary path for Windows if it exists.
        // Or if the directory exists.
        const antigravityDir = path.dirname(antigravityPath);
        if (fs.existsSync(antigravityDir)) {
            return antigravityPath;
        }

        // 2. Fallback to Standard Logic
        if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
            return path.join(appData, 'Antigravity', 'User', 'mcp_config.json');
        } else if (process.platform === 'darwin') {
            return path.join(os.homedir(), 'Library', 'Application Support', 'Antigravity', 'User', 'mcp_config.json');
        } else {
            return path.join(os.homedir(), '.config', 'Antigravity', 'User', 'mcp_config.json');
        }
    }

    private init_watcher() {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.config_path);
            if (!fs.existsSync(dir)) {
                logger.warn(LOG_CAT, `Config directory does not exist: ${dir}`);
                return;
            }

            // Watch the specific file
            // Note: fs.watch can be flaky on some systems, but usually fine for single file
            this.config_watcher = fs.watch(this.config_path, (eventType) => {
                logger.debug(LOG_CAT, `Config file changed: ${eventType}`);
                // Debounce slightly if needed, but for now direct emit
                this.emit_config_change();
            });
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to setup file watcher: ${e.message}`);
        }
    }

    private async emit_config_change() {
        const servers = await this.get_servers();
        this._on_config_change.fire({
            servers,
            path: this.config_path
        });
    }

    public get_config_path(): string {
        return this.config_path;
    }

    /**
     * Reads the current MCP configuration
     * Handles "soft disabled" servers (keys prefixed with _disabled_)
     */
    public async get_servers(): Promise<MCPServersCollection> {
        if (!fs.existsSync(this.config_path)) {
            logger.warn(LOG_CAT, 'Config file not found, returning empty');
            return {};
        }

        try {
            const content = await fs.promises.readFile(this.config_path, 'utf8');
            const json = JSON.parse(content) as MCPConfig;

            // Normalize: Handle disabled servers
            // If we see "_disabled_hostinger", we treat it as "hostinger" with disabled: true
            const normalized: MCPServersCollection = {};

            if (json && json.mcpServers) {
                for (const [key, config] of Object.entries(json.mcpServers)) {
                    if (key.startsWith('_disabled_')) {
                        const realName = key.replace('_disabled_', '');
                        normalized[realName] = { ...config, disabled: true };
                    } else {
                        normalized[key] = { ...config, disabled: false };
                    }
                }
            }

            return normalized;
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to read config: ${e.message}`);
            return {};
        }
    }

    /**
     * Toggles a server enabled/disabled
     * Implemented by renaming the key in the JSON object (e.g. hostinger -> _disabled_hostinger)
     */
    public async toggle_server(server_id: string, enabled: boolean): Promise<boolean> {
        logger.info(LOG_CAT, `Toggling server ${server_id} to ${enabled}`);

        try {
            const content = await fs.promises.readFile(this.config_path, 'utf8');
            const json = JSON.parse(content) as MCPConfig;

            if (!json.mcpServers) {
                json.mcpServers = {};
            }

            // Check if keys exist
            const disabledKey = `_disabled_${server_id}`;
            const enabledKey = server_id;

            let configToMove: MCPServerConfig | undefined;

            // Find current config
            if (json.mcpServers[enabledKey]) {
                configToMove = json.mcpServers[enabledKey];
                // If we want to disable it, delete original and add new key
                if (!enabled) {
                    delete json.mcpServers[enabledKey];
                    json.mcpServers[disabledKey] = configToMove;
                }
            } else if (json.mcpServers[disabledKey]) {
                configToMove = json.mcpServers[disabledKey];
                // If we want to enable it, delete disabled key and add new key
                if (enabled) {
                    delete json.mcpServers[disabledKey];
                    json.mcpServers[enabledKey] = configToMove;
                }
            } else {
                logger.warn(LOG_CAT, `Server ${server_id} not found in config`);
                return false;
            }

            await this.write_config(json);
            return true;
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to toggle server: ${e.message}`);
            return false;
        }
    }

    /**
     * Applies a set of servers: enables the specified IDs, disables all others.
     * Uses soft-toggle (rename key) - does NOT uninstall any servers.
     * @param enableIds - Server IDs to enable
     * @returns Object with counts of enabled and disabled servers
     */
    public async applyServerSet(enableIds: string[]): Promise<{ enabled: number; disabled: number }> {
        logger.info(LOG_CAT, `Applying server set: ${enableIds.join(', ')}`);

        try {
            const content = await fs.promises.readFile(this.config_path, 'utf8');
            const json = JSON.parse(content) as MCPConfig;

            if (!json.mcpServers) {
                return { enabled: 0, disabled: 0 };
            }

            let enabledCount = 0;
            let disabledCount = 0;

            // Get all current server keys (both enabled and disabled)
            const allKeys = Object.keys(json.mcpServers);
            const enableSet = new Set(enableIds.map(id => id.toLowerCase()));

            for (const key of allKeys) {
                const isDisabledKey = key.startsWith('_disabled_');
                const baseId = isDisabledKey ? key.replace('_disabled_', '') : key;
                const shouldEnable = enableSet.has(baseId.toLowerCase());

                if (shouldEnable && isDisabledKey) {
                    // Enable: rename _disabled_X to X
                    const config = json.mcpServers[key];
                    delete json.mcpServers[key];
                    json.mcpServers[baseId] = config;
                    enabledCount++;
                    logger.debug(LOG_CAT, `Enabled server: ${baseId}`);
                } else if (!shouldEnable && !isDisabledKey) {
                    // Disable: rename X to _disabled_X
                    const config = json.mcpServers[key];
                    delete json.mcpServers[key];
                    json.mcpServers[`_disabled_${key}`] = config;
                    disabledCount++;
                    logger.debug(LOG_CAT, `Disabled server: ${key}`);
                }
                // Otherwise, already in correct state
            }

            await this.write_config(json);
            logger.info(LOG_CAT, `Applied server set: ${enabledCount} enabled, ${disabledCount} disabled`);
            return { enabled: enabledCount, disabled: disabledCount };
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to apply server set: ${e.message}`);
            return { enabled: 0, disabled: 0 };
        }
    }

    /**
     * Gets list of all installed server IDs (both enabled and disabled)
     */
    public async getInstalledServerIds(): Promise<string[]> {
        const servers = await this.get_servers();
        return Object.keys(servers);
    }

    /**
     * Installs a new server (adds to config)
     */
    public async install_server(server_id: string, config: MCPServerConfig): Promise<boolean> {
        logger.info(LOG_CAT, `Installing server ${server_id}`);

        try {
            const content = await fs.promises.readFile(this.config_path, 'utf8');
            const json = JSON.parse(content) as MCPConfig;

            if (!json.mcpServers) {
                json.mcpServers = {};
            }

            // Clean any existing entries for this ID (enabled or disabled)
            const disabledKey = `_disabled_${server_id}`;
            delete json.mcpServers[server_id];
            delete json.mcpServers[disabledKey];

            // Add new
            json.mcpServers[server_id] = config;

            await this.write_config(json);
            return true;
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to install server: ${e.message}`);
            return false;
        }
    }

    /**
     * Removes a server from config completely
     */
    public async remove_server(server_id: string): Promise<boolean> {
        logger.info(LOG_CAT, `Removing server ${server_id}`);

        try {
            const content = await fs.promises.readFile(this.config_path, 'utf8');
            const json = JSON.parse(content) as MCPConfig;

            if (!json.mcpServers) {
                return false;
            }

            // Remove both enabled and disabled versions
            const disabledKey = `_disabled_${server_id}`;
            let deleted = false;

            if (server_id in json.mcpServers) {
                delete json.mcpServers[server_id];
                deleted = true;
            }
            if (disabledKey in json.mcpServers) {
                delete json.mcpServers[disabledKey];
                deleted = true;
            }

            if (deleted) {
                await this.write_config(json);
            }
            return deleted;
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to remove server: ${e.message}`);
            return false;
        }
    }

    private async write_config(config: MCPConfig): Promise<void> {
        await fs.promises.writeFile(this.config_path, JSON.stringify(config, null, 2), 'utf8');
        this.emit_config_change();
    }

    public dispose() {
        if (this.config_watcher) {
            this.config_watcher.close();
        }
    }
}
