/**
 * TechAI MCP Proxy - Tool Usage Analytics
 * 
 * Tracks tool usage patterns for insights.
 * Optional auto-disable for unused tools (OFF by default).
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

const LOG_CAT = 'Analytics';

interface ToolUsageRecord {
    toolName: string;
    count: number;
    lastUsed: string;  // ISO date
    firstUsed: string; // ISO date
    averageLatencyMs: number;
    errors: number;
}

interface WorkspaceAnalytics {
    workspacePath: string;
    totalCalls: number;
    tools: Record<string, ToolUsageRecord>;
    lastUpdated: string;
}

interface AnalyticsData {
    version: 1;
    globalStats: {
        totalCalls: number;
        uniqueTools: number;
        lastUpdated: string;
    };
    workspaces: Record<string, WorkspaceAnalytics>;
    tools: Record<string, ToolUsageRecord>;
}

export class Analytics {
    private dataPath: string;
    private data: AnalyticsData;
    private dirty: boolean = false;
    private saveInterval?: NodeJS.Timeout;

    // Settings
    private autoDisableEnabled: boolean = false;
    private autoDisableThresholdDays: number = 30;

    constructor(dataDir: string) {
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
    private loadData(): AnalyticsData {
        try {
            if (fs.existsSync(this.dataPath)) {
                const content = fs.readFileSync(this.dataPath, 'utf-8');
                return JSON.parse(content);
            }
        } catch (e) {
            logger.warn(LOG_CAT, `Failed to load analytics: ${e}`);
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
    private saveData(): void {
        try {
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.data.globalStats.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
            this.dirty = false;
            logger.debug(LOG_CAT, 'Analytics saved');
        } catch (e) {
            logger.error(LOG_CAT, `Failed to save analytics: ${e}`);
        }
    }

    /**
     * Record a tool call
     */
    public trackToolCall(
        toolName: string,
        workspacePath: string,
        latencyMs: number,
        success: boolean
    ): void {
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
        if (!success) toolStats.errors++;

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
    public getUnusedTools(thresholdDays?: number): string[] {
        const days = thresholdDays ?? this.autoDisableThresholdDays;
        const threshold = Date.now() - (days * 24 * 60 * 60 * 1000);
        const unused: string[] = [];

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
    public isAutoDisableEnabled(): boolean {
        return this.autoDisableEnabled;
    }

    /**
     * Enable/disable auto-disable feature
     */
    public setAutoDisable(enabled: boolean, thresholdDays?: number): void {
        this.autoDisableEnabled = enabled;
        if (thresholdDays !== undefined) {
            this.autoDisableThresholdDays = thresholdDays;
        }
        logger.info(LOG_CAT, `Auto-disable: ${enabled ? 'ON' : 'OFF'} (${this.autoDisableThresholdDays} days)`);
    }

    /**
     * Get top N most used tools
     */
    public getTopTools(n: number = 10): ToolUsageRecord[] {
        return Object.values(this.data.tools)
            .sort((a, b) => b.count - a.count)
            .slice(0, n);
    }

    /**
     * Get analytics summary for API endpoint
     */
    public getSummary(): {
        totalCalls: number;
        uniqueTools: number;
        topTools: ToolUsageRecord[];
        unusedTools: string[];
        workspaceCount: number;
    } {
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
    public getWorkspaceStats(workspacePath: string): WorkspaceAnalytics | null {
        return this.data.workspaces[workspacePath] || null;
    }

    /**
     * Reset all analytics data
     */
    public reset(): void {
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
        logger.info(LOG_CAT, 'Analytics data reset');
    }

    /**
     * Dispose and save
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
