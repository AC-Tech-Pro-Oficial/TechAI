/**
 * TechAI MCP Proxy - Prompt Library
 *
 * Provides workspace-specific prompts via MCP prompts/list and prompts/get.
 * Prompts are dynamically selected based on detected project type.
 */
import { PromptDefinition, PromptMessage } from './types';
export declare class PromptLibrary {
    private customPrompts;
    private projectType;
    /**
     * Set the current project type
     */
    setProjectType(type: string): void;
    /**
     * Add custom prompts
     */
    addCustomPrompts(prompts: PromptDefinition[]): void;
    /**
     * Get all available prompts for current project
     */
    getPrompts(): PromptDefinition[];
    /**
     * Get a specific prompt's messages
     */
    getPromptMessages(name: string, args?: Record<string, string>): PromptMessage[];
    /**
     * Check if a prompt exists
     */
    hasPrompt(name: string): boolean;
    /**
     * Load custom prompts from a directory
     */
    loadCustomPrompts(promptsDir: string): void;
}
//# sourceMappingURL=prompts.d.ts.map