/**
 * TechAI MCP Proxy - Tool Usage Analytics
 *
 * Tracks tool usage patterns for insights.
 * Optional auto-disable for unused tools (OFF by default).
 */
interface ToolUsageRecord {
    toolName: string;
    count: number;
    lastUsed: string;
    firstUsed: string;
    averageLatencyMs: number;
    errors: number;
}
interface WorkspaceAnalytics {
    workspacePath: string;
    totalCalls: number;
    tools: Record<string, ToolUsageRecord>;
    lastUpdated: string;
}
export declare class Analytics {
    private dataPath;
    private data;
    private dirty;
    private saveInterval?;
    private autoDisableEnabled;
    private autoDisableThresholdDays;
    constructor(dataDir: string);
    /**
     * Load analytics data from disk
     */
    private loadData;
    /**
     * Save analytics data to disk
     */
    private saveData;
    /**
     * Record a tool call
     */
    trackToolCall(toolName: string, workspacePath: string, latencyMs: number, success: boolean): void;
    /**
     * Get unused tools (not used in N days)
     */
    getUnusedTools(thresholdDays?: number): string[];
    /**
     * Check if auto-disable is enabled
     */
    isAutoDisableEnabled(): boolean;
    /**
     * Enable/disable auto-disable feature
     */
    setAutoDisable(enabled: boolean, thresholdDays?: number): void;
    /**
     * Get top N most used tools
     */
    getTopTools(n?: number): ToolUsageRecord[];
    /**
     * Get analytics summary for API endpoint
     */
    getSummary(): {
        totalCalls: number;
        uniqueTools: number;
        topTools: ToolUsageRecord[];
        unusedTools: string[];
        workspaceCount: number;
    };
    /**
     * Get workspace-specific analytics
     */
    getWorkspaceStats(workspacePath: string): WorkspaceAnalytics | null;
    /**
     * Reset all analytics data
     */
    reset(): void;
    /**
     * Dispose and save
     */
    dispose(): void;
}
export {};
//# sourceMappingURL=analytics.d.ts.map