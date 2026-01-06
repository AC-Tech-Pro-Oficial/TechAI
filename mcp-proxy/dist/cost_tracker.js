"use strict";
/**
 * TechAI MCP Proxy - Cost/Token Tracking
 *
 * Estimates and tracks token usage per workspace and tool.
 * Provides usage reports and budget awareness.
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
exports.CostTracker = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
const LOG_CAT = 'CostTracker';
/**
 * Token estimation for common operations
 */
const TOKEN_ESTIMATES = {
    // File operations
    'read_file': { input: 50, output: 500 },
    'write_file': { input: 200, output: 50 },
    'list_directory': { input: 30, output: 200 },
    // Git operations
    'git_status': { input: 40, output: 300 },
    'git_log': { input: 50, output: 1000 },
    'git_diff': { input: 50, output: 800 },
    // Search operations
    'search_files': { input: 100, output: 500 },
    'brave_search': { input: 100, output: 800 },
    'grep_search': { input: 80, output: 400 },
    // Default for unknown tools
    'default': { input: 100, output: 300 }
};
/**
 * Cost per 1M tokens (approximate, varies by model)
 */
const COST_PER_MILLION_TOKENS = {
    input: 3.0, // $3 per 1M input tokens
    output: 15.0 // $15 per 1M output tokens
};
class CostTracker {
    constructor(dataDir) {
        this.dirty = false;
        this.dataPath = path.join(dataDir, 'usage.json');
        this.data = this.loadData();
        this.checkDateRollover();
        // Auto-save every 30 seconds
        this.saveInterval = setInterval(() => {
            this.checkDateRollover();
            if (this.dirty) {
                this.saveData();
            }
        }, 30000);
    }
    /**
     * Load usage data from disk
     */
    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                return JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
            }
        }
        catch (e) {
            logger_1.logger.warn(LOG_CAT, `Failed to load usage data: ${e}`);
        }
        return this.createEmptyData();
    }
    createEmptyData() {
        const today = this.getToday();
        return {
            version: 1,
            lastUpdated: new Date().toISOString(),
            global: this.createEmptyUsage(),
            today: this.createEmptyUsage(),
            todayDate: today,
            workspaces: {},
            dailyHistory: []
        };
    }
    createEmptyUsage() {
        return { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 };
    }
    getToday() {
        return new Date().toISOString().split('T')[0];
    }
    /**
     * Check if we need to roll over to a new day
     */
    checkDateRollover() {
        const today = this.getToday();
        if (this.data.todayDate !== today) {
            // Save yesterday's data to history
            if (this.data.today.totalTokens > 0) {
                this.data.dailyHistory.push({
                    date: this.data.todayDate,
                    usage: { ...this.data.today },
                    toolCalls: 0
                });
                // Keep only last 30 days
                if (this.data.dailyHistory.length > 30) {
                    this.data.dailyHistory = this.data.dailyHistory.slice(-30);
                }
            }
            // Reset today's usage
            this.data.today = this.createEmptyUsage();
            this.data.todayDate = today;
            this.dirty = true;
        }
    }
    /**
     * Save usage data to disk
     */
    saveData() {
        try {
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            this.data.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
            this.dirty = false;
        }
        catch (e) {
            logger_1.logger.error(LOG_CAT, `Failed to save usage data: ${e}`);
        }
    }
    /**
     * Estimate tokens for a tool call
     */
    estimateTokens(toolName, argsSize = 0, resultSize = 0) {
        const estimate = TOKEN_ESTIMATES[toolName] || TOKEN_ESTIMATES['default'];
        // Adjust based on actual data size
        const inputAdjust = Math.ceil(argsSize / 4); // ~4 chars per token
        const outputAdjust = Math.ceil(resultSize / 4);
        return {
            input: estimate.input + inputAdjust,
            output: estimate.output + outputAdjust
        };
    }
    /**
     * Track a tool call
     */
    trackToolCall(toolName, workspacePath, inputTokens, outputTokens) {
        this.checkDateRollover();
        const totalTokens = inputTokens + outputTokens;
        const cost = (inputTokens / 1000000) * COST_PER_MILLION_TOKENS.input +
            (outputTokens / 1000000) * COST_PER_MILLION_TOKENS.output;
        // Update global
        this.data.global.inputTokens += inputTokens;
        this.data.global.outputTokens += outputTokens;
        this.data.global.totalTokens += totalTokens;
        this.data.global.estimatedCost += cost;
        // Update today
        this.data.today.inputTokens += inputTokens;
        this.data.today.outputTokens += outputTokens;
        this.data.today.totalTokens += totalTokens;
        this.data.today.estimatedCost += cost;
        // Update workspace
        const wsName = path.basename(workspacePath);
        if (!this.data.workspaces[workspacePath]) {
            this.data.workspaces[workspacePath] = {
                workspacePath,
                name: wsName,
                allTime: this.createEmptyUsage(),
                today: this.createEmptyUsage(),
                dailyHistory: []
            };
        }
        const ws = this.data.workspaces[workspacePath];
        ws.allTime.inputTokens += inputTokens;
        ws.allTime.outputTokens += outputTokens;
        ws.allTime.totalTokens += totalTokens;
        ws.allTime.estimatedCost += cost;
        ws.today.inputTokens += inputTokens;
        ws.today.outputTokens += outputTokens;
        ws.today.totalTokens += totalTokens;
        ws.today.estimatedCost += cost;
        this.dirty = true;
    }
    /**
     * Get usage summary for API
     */
    getSummary() {
        const topWorkspaces = Object.values(this.data.workspaces)
            .sort((a, b) => b.allTime.totalTokens - a.allTime.totalTokens)
            .slice(0, 5)
            .map(ws => ({
            name: ws.name,
            tokens: ws.allTime.totalTokens,
            cost: ws.allTime.estimatedCost
        }));
        return {
            global: this.data.global,
            today: this.data.today,
            topWorkspaces
        };
    }
    /**
     * Get workspace usage
     */
    getWorkspaceUsage(workspacePath) {
        return this.data.workspaces[workspacePath] || null;
    }
    /**
     * Format tokens for display
     */
    static formatTokens(tokens) {
        if (tokens >= 1000000) {
            return `${(tokens / 1000000).toFixed(1)}M`;
        }
        else if (tokens >= 1000) {
            return `${(tokens / 1000).toFixed(1)}K`;
        }
        return tokens.toString();
    }
    /**
     * Format cost for display
     */
    static formatCost(cost) {
        if (cost < 0.01) {
            return `$${(cost * 100).toFixed(2)}¢`;
        }
        return `$${cost.toFixed(2)}`;
    }
    /**
     * Dispose resources
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
exports.CostTracker = CostTracker;
//# sourceMappingURL=cost_tracker.js.map