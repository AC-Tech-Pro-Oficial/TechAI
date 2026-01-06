"use strict";
/**
 * TechAI MCP Proxy - Centralized Config Watcher
 *
 * Single file watcher for mcp_config.json that broadcasts changes
 * to all connected extension windows via SSE. This prevents the
 * "event storm" problem when multiple windows each have their own watcher.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigWatcher = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const events_1 = require("events");
const logger_1 = require("./logger");
const LOG_CAT = 'ConfigWatcher';
class ConfigWatcher extends events_1.EventEmitter {
    constructor(configPath) {
        super();
        this.watcher = null;
        this.debounceTimer = null;
        this.lastContent = '';
        this.DEBOUNCE_MS = 300;
        this.configPath = configPath || this.getDefaultConfigPath();
        this.startWatching();
    }
    /**
     * Get default MCP config path
     */
    getDefaultConfigPath() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        // Check Antigravity-specific path first
        const antigravityPath = path.join(homeDir, '.gemini', 'antigravity', 'mcp_config.json');
        if (fs.existsSync(path.dirname(antigravityPath))) {
            return antigravityPath;
        }
        if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
            return path.join(appData, 'Antigravity', 'User', 'mcp_config.json');
        }
        else if (process.platform === 'darwin') {
            return path.join(homeDir, 'Library', 'Application Support', 'Antigravity', 'User', 'mcp_config.json');
        }
        else {
            return path.join(homeDir, '.config', 'Antigravity', 'User', 'mcp_config.json');
        }
    }
    /**
     * Start watching the config file
     */
    startWatching() {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                logger_1.logger.warn(LOG_CAT, `Config directory does not exist: ${dir}`);
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
            logger_1.logger.info(LOG_CAT, `Watching config: ${this.configPath}`);
        }
        catch (error) {
            logger_1.logger.error(LOG_CAT, 'Failed to start config watcher:', error);
        }
    }
    /**
     * Handle file change with debounce and content comparison
     */
    handleChange(eventType) {
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
                    const event = {
                        type: 'config_change',
                        path: this.configPath,
                        timestamp: Date.now()
                    };
                    logger_1.logger.info(LOG_CAT, `Config changed (${eventType}), broadcasting to clients`);
                    this.emit('change', event);
                }
            }
            catch (error) {
                logger_1.logger.error(LOG_CAT, 'Error reading config:', error);
            }
        }, this.DEBOUNCE_MS);
    }
    /**
     * Get current config content
     */
    getContent() {
        return this.lastContent;
    }
    /**
     * Get config path
     */
    getPath() {
        return this.configPath;
    }
    /**
     * Stop watching
     */
    dispose() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        logger_1.logger.info(LOG_CAT, 'Config watcher stopped');
    }
}
exports.ConfigWatcher = ConfigWatcher;
//# sourceMappingURL=config_watcher.js.map