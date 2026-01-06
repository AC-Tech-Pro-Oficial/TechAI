/**
 * TechAI MCP Proxy - Cost/Token Tracking
 *
 * Estimates and tracks token usage per workspace and tool.
 * Provides usage reports and budget awareness.
 */
interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
}
interface DailyUsage {
    date: string;
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
export declare class CostTracker {
    private dataPath;
    private data;
    private dirty;
    private saveInterval?;
    constructor(dataDir: string);
    /**
     * Load usage data from disk
     */
    private loadData;
    private createEmptyData;
    private createEmptyUsage;
    private getToday;
    /**
     * Check if we need to roll over to a new day
     */
    private checkDateRollover;
    /**
     * Save usage data to disk
     */
    private saveData;
    /**
     * Estimate tokens for a tool call
     */
    estimateTokens(toolName: string, argsSize?: number, resultSize?: number): {
        input: number;
        output: number;
    };
    /**
     * Track a tool call
     */
    trackToolCall(toolName: string, workspacePath: string, inputTokens: number, outputTokens: number): void;
    /**
     * Get usage summary for API
     */
    getSummary(): {
        global: TokenUsage;
        today: TokenUsage;
        topWorkspaces: Array<{
            name: string;
            tokens: number;
            cost: number;
        }>;
    };
    /**
     * Get workspace usage
     */
    getWorkspaceUsage(workspacePath: string): WorkspaceUsage | null;
    /**
     * Format tokens for display
     */
    static formatTokens(tokens: number): string;
    /**
     * Format cost for display
     */
    static formatCost(cost: number): string;
    /**
     * Dispose resources
     */
    dispose(): void;
}
export {};
//# sourceMappingURL=cost_tracker.d.ts.map