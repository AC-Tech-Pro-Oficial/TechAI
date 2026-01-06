/**
 * TechAI MCP Proxy - Centralized Config Watcher
 *
 * Single file watcher for mcp_config.json that broadcasts changes
 * to all connected extension windows via SSE. This prevents the
 * "event storm" problem when multiple windows each have their own watcher.
 */
import { EventEmitter } from 'events';
export interface ConfigChangeEvent {
    type: 'config_change';
    path: string;
    timestamp: number;
}
export declare class ConfigWatcher extends EventEmitter {
    private configPath;
    private watcher;
    private debounceTimer;
    private lastContent;
    private readonly DEBOUNCE_MS;
    constructor(configPath?: string);
    /**
     * Get default MCP config path
     */
    private getDefaultConfigPath;
    /**
     * Start watching the config file
     */
    private startWatching;
    /**
     * Handle file change with debounce and content comparison
     */
    private handleChange;
    /**
     * Get current config content
     */
    getContent(): string;
    /**
     * Get config path
     */
    getPath(): string;
    /**
     * Stop watching
     */
    dispose(): void;
}
//# sourceMappingURL=config_watcher.d.ts.map