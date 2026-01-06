/**
 * TechAI MCP Proxy - Cost/Token Tracking
 * 
 * Estimates and tracks token usage per workspace and tool.
 * Provides usage reports and budget awareness.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

const LOG_CAT = 'CostTracker';

interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number; // USD
}

interface DailyUsage {
    date: string; // YYYY-MM-DD
    usage: TokenUsage;
    toolCalls: number;
}

interface WorkspaceUsage {
    workspacePath: string;
    name: string;
    allTime: TokenUsage;
    today: TokenUsage;
    dailyHistory: DailyUsage[];
}

interface UsageData {
    version: 1;
    lastUpdated: string;
    global: TokenUsage;
    today: TokenUsage;
    todayDate: string;
    workspaces: Record<string, WorkspaceUsage>;
    dailyHistory: DailyUsage[];
}

/**
 * Token estimation for common operations
 */
const TOKEN_ESTIMATES: Record<string, { input: number; output: number }> = {
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
    input: 3.0,   // $3 per 1M input tokens
    output: 15.0  // $15 per 1M output tokens
};

export class CostTracker {
    private dataPath: string;
    private data: UsageData;
    private dirty: boolean = false;
    private saveInterval?: NodeJS.Timeout;

    constructor(dataDir: string) {
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
    private loadData(): UsageData {
        try {
            if (fs.existsSync(this.dataPath)) {
                return JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
            }
        } catch (e) {
            logger.warn(LOG_CAT, `Failed to load usage data: ${e}`);
        }

        return this.createEmptyData();
    }

    private createEmptyData(): UsageData {
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

    private createEmptyUsage(): TokenUsage {
        return { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 };
    }

    private getToday(): string {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Check if we need to roll over to a new day
     */
    private checkDateRollover(): void {
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
    private saveData(): void {
        try {
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.data.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
            this.dirty = false;
        } catch (e) {
            logger.error(LOG_CAT, `Failed to save usage data: ${e}`);
        }
    }

    /**
     * Estimate tokens for a tool call
     */
    public estimateTokens(toolName: string, argsSize: number = 0, resultSize: number = 0): { input: number; output: number } {
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
    public trackToolCall(
        toolName: string,
        workspacePath: string,
        inputTokens: number,
        outputTokens: number
    ): void {
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
    public getSummary(): {
        global: TokenUsage;
        today: TokenUsage;
        topWorkspaces: Array<{ name: string; tokens: number; cost: number }>;
    } {
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
    public getWorkspaceUsage(workspacePath: string): WorkspaceUsage | null {
        return this.data.workspaces[workspacePath] || null;
    }

    /**
     * Format tokens for display
     */
    public static formatTokens(tokens: number): string {
        if (tokens >= 1000000) {
            return `${(tokens / 1000000).toFixed(1)}M`;
        } else if (tokens >= 1000) {
            return `${(tokens / 1000).toFixed(1)}K`;
        }
        return tokens.toString();
    }

    /**
     * Format cost for display
     */
    public static formatCost(cost: number): string {
        if (cost < 0.01) {
            return `$${(cost * 100).toFixed(2)}¢`;
        }
        return `$${cost.toFixed(2)}`;
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        if (this.dirty) {
            this.saveData();
        }
    }
}
