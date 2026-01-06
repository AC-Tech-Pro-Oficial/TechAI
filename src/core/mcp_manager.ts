/**
 * TechAI Antigravity - MCP Manager (Simplified)
 * 
 * Direct read/write to mcp_config.json.
 * No file watchers, no workspaceState merging.
 * Uses _disabled_ prefix convention for disabled servers.
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
    private _on_config_change = new vscode.EventEmitter<MCPConfigChangeEvent>();
    private context: vscode.ExtensionContext;

    public readonly on_config_change = this._on_config_change.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config_path = this.resolve_config_path();
        logger.info(LOG_CAT, `MCP Manager initialized. Config path: ${this.config_path}`);
    }

    /**
     * Resolves the path to mcp_config.json based on platform
     */
    private resolve_config_path(): string {
        // 1. Check for Antigravity specific path
        const antigravityPath = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');

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

    public get_config_path(): string {
        return this.config_path;
    }

    /**
     * Reads the current MCP configuration directly from file.
     * Servers with _disabled_ prefix are marked as disabled.
     */
    public async get_servers(): Promise<MCPServersCollection> {
        if (!fs.existsSync(this.config_path)) {
            logger.warn(LOG_CAT, 'Config file not found, returning empty');
            return {};
        }

        try {
            const content = await fs.promises.readFile(this.config_path, 'utf8');
            const json = JSON.parse(content) as MCPConfig;

            const result: MCPServersCollection = {};

            if (json && json.mcpServers) {
                for (const [key, config] of Object.entries(json.mcpServers)) {
                    // Check if server is disabled (has _disabled_ prefix)
                    const isDisabled = key.startsWith('_disabled_');
                    const realId = isDisabled ? key.replace('_disabled_', '') : key;

                    result[realId] = {
                        ...config,
                        disabled: isDisabled
                    };
                }
            }

            return result;
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to read config: ${e.message}`);
            return {};
        }
    }

    /**
     * Get list of installed server IDs (regardless of enabled/disabled state)
     */
    public async getInstalledServerIds(): Promise<string[]> {
        const servers = await this.get_servers();
        return Object.keys(servers);
    }

    /**
     * Toggles a server enabled/disabled by modifying the config file directly.
     * Uses _disabled_ prefix convention.
     */
    public async toggle_server(server_id: string, enabled: boolean): Promise<boolean> {
        logger.info(LOG_CAT, `Toggling server ${server_id} to ${enabled}`);

        try {
            const config = await this.read_raw_config();
            if (!config.mcpServers) {
                config.mcpServers = {};
            }

            const disabledKey = `_disabled_${server_id}`;
            const enabledKey = server_id;

            if (enabled) {
                // Move from _disabled_ to enabled
                if (config.mcpServers[disabledKey]) {
                    config.mcpServers[enabledKey] = config.mcpServers[disabledKey];
                    delete config.mcpServers[disabledKey];
                }
                // If already enabled, no change needed
            } else {
                // Move from enabled to _disabled_
                if (config.mcpServers[enabledKey]) {
                    config.mcpServers[disabledKey] = config.mcpServers[enabledKey];
                    delete config.mcpServers[enabledKey];
                }
                // If already disabled, no change needed
            }

            await this.write_raw_config(config);
            this.emit_config_change();
            return true;
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to toggle server: ${e.message}`);
            return false;
        }
    }

    /**
     * Applies a set of servers: enables the specified IDs, disables all others.
     * Writes directly to config file.
     */
    public async applyServerSet(enableIds: string[]): Promise<{ enabled: number; disabled: number }> {
        logger.info(LOG_CAT, `Applying server set: ${enableIds.length > 0 ? enableIds.join(', ') : '(none - disable all)'}`);

        try {
            const config = await this.read_raw_config();
            if (!config.mcpServers) {
                return { enabled: 0, disabled: 0 };
            }

            const enableSet = new Set(enableIds.map(id => id.toLowerCase()));
            const newServers: Record<string, MCPServerConfig> = {};
            let changedEnabled = 0;
            let changedDisabled = 0;

            for (const [key, serverConfig] of Object.entries(config.mcpServers)) {
                const isCurrentlyDisabled = key.startsWith('_disabled_');
                const realId = isCurrentlyDisabled ? key.replace('_disabled_', '') : key;
                const shouldBeEnabled = enableSet.has(realId.toLowerCase());

                if (shouldBeEnabled) {
                    // Server should be enabled
                    newServers[realId] = serverConfig;
                    if (isCurrentlyDisabled) changedEnabled++;
                } else {
                    // Server should be disabled
                    newServers[`_disabled_${realId}`] = serverConfig;
                    if (!isCurrentlyDisabled) changedDisabled++;
                }
            }

            config.mcpServers = newServers;
            await this.write_raw_config(config);
            this.emit_config_change();

            logger.info(LOG_CAT, `Applied server set. Changes: ${changedEnabled} enabled, ${changedDisabled} disabled`);
            return { enabled: changedEnabled, disabled: changedDisabled };
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to apply server set: ${e.message}`);
            return { enabled: 0, disabled: 0 };
        }
    }

    /**
     * Adds a new server to the config
     */
    public async add_server(id: string, serverConfig: MCPServerConfig): Promise<boolean> {
        logger.info(LOG_CAT, `Adding server: ${id}`);

        try {
            const config = await this.read_raw_config();
            if (!config.mcpServers) {
                config.mcpServers = {};
            }

            // Remove any existing entry (enabled or disabled)
            delete config.mcpServers[id];
            delete config.mcpServers[`_disabled_${id}`];

            // Add as enabled
            config.mcpServers[id] = serverConfig;

            await this.write_raw_config(config);
            this.emit_config_change();
            return true;
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to add server: ${e.message}`);
            return false;
        }
    }

    /**
     * Removes a server from the config
     */
    public async remove_server(id: string): Promise<boolean> {
        logger.info(LOG_CAT, `Removing server: ${id}`);

        try {
            const config = await this.read_raw_config();
            if (!config.mcpServers) {
                return true;
            }

            // Remove both enabled and disabled versions
            delete config.mcpServers[id];
            delete config.mcpServers[`_disabled_${id}`];

            await this.write_raw_config(config);
            this.emit_config_change();
            return true;
        } catch (e: any) {
            logger.error(LOG_CAT, `Failed to remove server: ${e.message}`);
            return false;
        }
    }

    /**
     * Read raw config file with lock check
     */
    private async read_raw_config(): Promise<MCPConfig> {
        if (!fs.existsSync(this.config_path)) {
            return { mcpServers: {} };
        }

        // Wait for lock if it exists (simple spin wait)
        await this.waitForLock();

        try {
            const content = await fs.promises.readFile(this.config_path, 'utf8');
            return JSON.parse(content) as MCPConfig;
        } catch (error) {
            // If read fails (e.g. race condition), try once more after small delay
            await new Promise(resolve => setTimeout(resolve, 100));
            const content = await fs.promises.readFile(this.config_path, 'utf8');
            return JSON.parse(content) as MCPConfig;
        }
    }

    /**
     * Write raw config file using Lock + Atomic Write (tmp -> rename)
     */
    private async write_raw_config(config: MCPConfig): Promise<void> {
        // Ensure directory exists
        const dir = path.dirname(this.config_path);
        if (!fs.existsSync(dir)) {
            await fs.promises.mkdir(dir, { recursive: true });
        }

        const lockFile = this.config_path + '.lock';
        const tmpFile = this.config_path + '.tmp';
        let hasLock = false;

        try {
            // 1. Acquire Lock
            hasLock = await this.acquireLock(lockFile);
            if (!hasLock) {
                throw new Error('Could not acquire config file lock after retries');
            }

            // 2. Write to temp file
            const content = JSON.stringify(config, null, 2);
            await fs.promises.writeFile(tmpFile, content, 'utf8');

            // 3. Atomic Rename
            // Windows: primitive rename might fail if target exists and is open, 
            // but in Node >10 fs.rename is generally atomic-ish or uses move-file semantics.
            // Loop a few times for Windows EPERM issues.
            let renamed = false;
            for (let i = 0; i < 5; i++) {
                try {
                    await fs.promises.rename(tmpFile, this.config_path);
                    renamed = true;
                    break;
                } catch (e: any) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            if (!renamed) {
                // Fallback: force copy and delete (less atomic but works on stubborn Windows locks)
                await fs.promises.copyFile(tmpFile, this.config_path);
                await fs.promises.unlink(tmpFile).catch(() => { });
            }

        } finally {
            // 4. Release Lock
            if (hasLock) {
                try {
                    if (fs.existsSync(lockFile)) {
                        await fs.promises.unlink(lockFile);
                    }
                } catch (e) {
                    logger.warn(LOG_CAT, `Failed to release lock: ${e}`);
                }
            }
        }
    }

    /**
     * Simple spin-lock to acquire exclusive access
     */
    private async acquireLock(lockFile: string): Promise<boolean> {
        const uniqueId = Math.random().toString(36).substring(7);
        const maxRetries = 20; // 2 seconds total timeout
        const retryDelay = 100;

        for (let i = 0; i < maxRetries; i++) {
            try {
                // "x" flag ensures we fail if file exists (atomic creation)
                await fs.promises.writeFile(lockFile, uniqueId, { flag: 'wx' });
                return true; // Acquired
            } catch (e: any) {
                if (e.code === 'EEXIST') {
                    // Lock exists, check staleness
                    try {
                        const stats = await fs.promises.stat(lockFile);
                        const now = Date.now();
                        // If lock is older than 5 seconds, assume stale and force break (orphan lock)
                        if (now - stats.mtimeMs > 5000) {
                            logger.warn(LOG_CAT, 'Found stale lock file, forcing removal.');
                            await fs.promises.unlink(lockFile).catch(() => { });
                            continue; // Retry immediately
                        }
                    } catch (statError) {
                        // Lock might have been deleted between EEXIST and stat
                    }

                    // Wait and retry
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    throw e; // Unexpected error
                }
            }
        }
        return false;
    }

    private async waitForLock(): Promise<void> {
        const lockFile = this.config_path + '.lock';
        for (let i = 0; i < 20; i++) {
            if (!fs.existsSync(lockFile)) return;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * Emit config change event for UI updates
     */
    private async emit_config_change(): Promise<void> {
        const servers = await this.get_servers();
        this._on_config_change.fire({
            servers,
            path: this.config_path
        });
    }

    /**
     * Install a new server (alias for add_server for backwards compatibility)
     */
    public async install_server(id: string, serverConfig: MCPServerConfig): Promise<boolean> {
        return this.add_server(id, serverConfig);
    }

    /**
     * Dispose resources (no cleanup needed after removing file watcher)
     */
    public dispose(): void {
        this._on_config_change.dispose();
    }
}
