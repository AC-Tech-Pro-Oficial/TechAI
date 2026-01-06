/**
 * TechAI MCP Proxy - Smart Tool Filtering
 *
 * Filters and prioritizes tools based on user intent/message context.
 * Reduces token usage by only exposing relevant tools.
 */
import { ToolDefinition } from './types';
export declare class ToolFilter {
    private enabled;
    private minScore;
    /**
     * Enable/disable filtering
     */
    setEnabled(enabled: boolean): void;
    /**
     * Filter tools based on user message intent
     */
    filterByIntent(tools: ToolDefinition[], userMessage: string): ToolDefinition[];
    /**
     * Score tools based on message relevance
     */
    private scoreTools;
    /**
     * Prioritize tools (sort by relevance)
     */
    prioritize(tools: ToolDefinition[], userMessage: string): ToolDefinition[];
}
//# sourceMappingURL=tool_filter.d.ts.map