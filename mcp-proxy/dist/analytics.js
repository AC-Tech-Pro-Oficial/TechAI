"use strict";
/**
 * TechAI MCP Proxy - Tool Usage Analytics
 *
 * Tracks tool usage patterns for insights.
 * Optional auto-disable for unused tools (OFF by default).
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
exports.Analytics = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
const LOG_CAT = 'Analytics';
class Analytics {
    constructor(dataDir) {
        this.dirty = false;
        // Settings
        this.autoDisableEnabled = false;
        this.autoDisableThresholdDays = 30;
        this.dataPath = path.join(dataDir, 'analytics.json');
        this.data = this.loadData();
        // Auto-save every 60 seconds if dirty
        this.saveInterval = setInterval(() => {
            if (this.dirty) {
                this.saveData();
            }
        }, 60000);
    }
    /**
     * Load analytics data from disk
     */
    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const content = fs.readFileSync(this.dataPath, 'utf-8');
                return JSON.parse(content);
            }
        }
        catch (e) {
            logger_1.logger.warn(LOG_CAT, `Failed to load analytics: ${e}`);
        }
        return {
            version: 1,
            globalStats: {
                totalCalls: 0,
                uniqueTools: 0,
                lastUpdated: new Date().toISOString()
            },
            workspaces: {},
            tools: {}
        };
    }
    /**
     * Save analytics data to disk
     */
    saveData() {
        try {
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            this.data.globalStats.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
            this.dirty = false;
            logger_1.logger.debug(LOG_CAT, 'Analytics saved');
        }
        catch (e) {
            logger_1.logger.error(LOG_CAT, `Failed to save analytics: ${e}`);
        }
    }
    /**
     * Record a tool call
     */
    trackToolCall(toolName, workspacePath, latencyMs, success) {
        const now = new Date().toISOString();
        // Update global tool stats
        if (!this.data.tools[toolName]) {
            this.data.tools[toolName] = {
                toolName,
                count: 0,
                lastUsed: now,
                firstUsed: now,
                averageLatencyMs: 0,
                errors: 0
            };
            this.data.globalStats.uniqueTools++;
        }
        const toolStats = this.data.tools[toolName];
        const prevAvg = toolStats.averageLatencyMs;
        const prevCount = toolStats.count;
        toolStats.count++;
        toolStats.lastUsed = now;
        toolStats.averageLatencyMs = ((prevAvg * prevCount) + latencyMs) / toolStats.count;
        if (!success)
            toolStats.errors++;
        // Update workspace stats
        if (!this.data.workspaces[workspacePath]) {
            this.data.workspaces[workspacePath] = {
                workspacePath,
                totalCalls: 0,
                tools: {},
                lastUpdated: now
            };
        }
        const wsStats = this.data.workspaces[workspacePath];
        wsStats.totalCalls++;
        wsStats.lastUpdated = now;
        if (!wsStats.tools[toolName]) {
            wsStats.tools[toolName] = {
                toolName,
                count: 0,
                lastUsed: now,
                firstUsed: now,
                averageLatencyMs: 0,
                errors: 0
            };
        }
        const wsToolStats = wsStats.tools[toolName];
        wsToolStats.count++;
        wsToolStats.lastUsed = now;
        // Update global stats
        this.data.globalStats.totalCalls++;
        this.dirty = true;
    }
    /**
     * Get unused tools (not used in N days)
     */
    getUnusedTools(thresholdDays) {
        const days = thresholdDays ?? this.autoDisableThresholdDays;
        const threshold = Date.now() - (days * 24 * 60 * 60 * 1000);
        const unused = [];
        for (const [name, stats] of Object.entries(this.data.tools)) {
            const lastUsed = new Date(stats.lastUsed).getTime();
            if (lastUsed < threshold) {
                unused.push(name);
            }
        }
        return unused;
    }
    /**
     * Check if auto-disable is enabled
     */
    isAutoDisableEnabled() {
        return this.autoDisableEnabled;
    }
    /**
     * Enable/disable auto-disable feature
     */
    setAutoDisable(enabled, thresholdDays) {
        this.autoDisableEnabled = enabled;
        if (thresholdDays !== undefined) {
            this.autoDisableThresholdDays = thresholdDays;
        }
        logger_1.logger.info(LOG_CAT, `Auto-disable: ${enabled ? 'ON' : 'OFF'} (${this.autoDisableThresholdDays} days)`);
    }
    /**
     * Get top N most used tools
     */
    getTopTools(n = 10) {
        return Object.values(this.data.tools)
            .sort((a, b) => b.count - a.count)
            .slice(0, n);
    }
    /**
     * Get analytics summary for API endpoint
     */
    getSummary() {
        return {
            totalCalls: this.data.globalStats.totalCalls,
            uniqueTools: this.data.globalStats.uniqueTools,
            topTools: this.getTopTools(10),
            unusedTools: this.getUnusedTools(),
            workspaceCount: Object.keys(this.data.workspaces).length
        };
    }
    /**
     * Get workspace-specific analytics
     */
    getWorkspaceStats(workspacePath) {
        return this.data.workspaces[workspacePath] || null;
    }
    /**
     * Reset all analytics data
     */
    reset() {
        this.data = {
            version: 1,
            globalStats: {
                totalCalls: 0,
                uniqueTools: 0,
                lastUpdated: new Date().toISOString()
            },
            workspaces: {},
            tools: {}
        };
        this.saveData();
        logger_1.logger.info(LOG_CAT, 'Analytics data reset');
    }
    /**
     * Dispose and save
     */
    dispose() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        if (this.dirty) {
            this.saveData();
        }
    }
}
exports.Analytics = Analytics;
//# sourceMappingURL=analytics.js.map