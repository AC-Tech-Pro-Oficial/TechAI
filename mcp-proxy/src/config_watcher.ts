/**
 * TechAI MCP Proxy - Centralized Config Watcher
 * 
 * Single file watcher for mcp_config.json that broadcasts changes
 * to all connected extension windows via SSE. This prevents the
 * "event storm" problem when multiple windows each have their own watcher.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { logger } from './logger';

const LOG_CAT = 'ConfigWatcher';

export interface ConfigChangeEvent {
    type: 'config_change';
    path: string;
    timestamp: number;
}

export class ConfigWatcher extends EventEmitter {
    private configPath: string;
    private watcher: fs.FSWatcher | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;
    private lastContent: string = '';
    private readonly DEBOUNCE_MS = 300;

    constructor(configPath?: string) {
        super();
        this.configPath = configPath || this.getDefaultConfigPath();
        this.startWatching();
    }

    /**
     * Get default MCP config path
     */
    private getDefaultConfigPath(): string {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';

        // Check Antigravity-specific path first
        const antigravityPath = path.join(homeDir, '.gemini', 'antigravity', 'mcp_config.json');
        if (fs.existsSync(path.dirname(antigravityPath))) {
            return antigravityPath;
        }

        if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
            return path.join(appData, 'Antigravity', 'User', 'mcp_config.json');
        } else if (process.platform === 'darwin') {
            return path.join(homeDir, 'Library', 'Application Support', 'Antigravity', 'User', 'mcp_config.json');
        } else {
            return path.join(homeDir, '.config', 'Antigravity', 'User', 'mcp_config.json');
        }
    }

    /**
     * Start watching the config file
     */
    private startWatching(): void {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                logger.warn(LOG_CAT, `Config directory does not exist: ${dir}`);
                return;
            }

            // Read initial content for comparison
            if (fs.existsSync(this.configPath)) {
                this.lastContent = fs.readFileSync(this.configPath, 'utf-8');
            }

            // Watch the directory for file changes (more reliable than watching file directly)
            this.watcher = fs.watch(dir, (eventType, filename) => {
                if (filename === path.basename(this.configPath)) {
                    this.handleChange(eventType);
                }
            });

            logger.info(LOG_CAT, `Watching config: ${this.configPath}`);
        } catch (error) {
            logger.error(LOG_CAT, 'Failed to start config watcher:', error);
        }
    }

    /**
     * Handle file change with debounce and content comparison
     */
    private handleChange(eventType: string): void {
        // Debounce rapid changes
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            try {
                // Only emit if content actually changed
                if (!fs.existsSync(this.configPath)) {
                    return;
                }

                const newContent = fs.readFileSync(this.configPath, 'utf-8');
                if (newContent !== this.lastContent) {
                    this.lastContent = newContent;

                    const event: ConfigChangeEvent = {
                        type: 'config_change',
                        path: this.configPath,
                        timestamp: Date.now()
                    };

                    logger.info(LOG_CAT, `Config changed (${eventType}), broadcasting to clients`);
                    this.emit('change', event);
                }
            } catch (error) {
                logger.error(LOG_CAT, 'Error reading config:', error);
            }
        }, this.DEBOUNCE_MS);
    }

    /**
     * Get current config content
     */
    public getContent(): string {
        return this.lastContent;
    }

    /**
     * Get config path
     */
    public getPath(): string {
        return this.configPath;
    }

    /**
     * Stop watching
     */
    public dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        logger.info(LOG_CAT, 'Config watcher stopped');
    }
}
