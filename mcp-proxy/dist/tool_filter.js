"use strict";
/**
 * TechAI MCP Proxy - Smart Tool Filtering
 *
 * Filters and prioritizes tools based on user intent/message context.
 * Reduces token usage by only exposing relevant tools.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolFilter = void 0;
const logger_1 = require("./logger");
const LOG_CAT = 'ToolFilter';
/**
 * Keyword → Tool name patterns mapping
 */
const INTENT_PATTERNS = {
    // Git operations
    'git': ['git', 'github', 'commit', 'push', 'pull', 'branch', 'merge', 'clone'],
    'commit': ['git', 'github'],
    'push': ['git', 'github'],
    'branch': ['git', 'github'],
    'pr': ['github', 'pull_request'],
    'pull request': ['github'],
    // File operations
    'file': ['filesystem', 'file', 'read', 'write', 'create', 'delete'],
    'read': ['filesystem', 'file', 'read'],
    'write': ['filesystem', 'file', 'write'],
    'create': ['filesystem', 'file', 'create'],
    'delete': ['filesystem', 'file', 'delete', 'remove'],
    // Search operations
    'search': ['search', 'grep', 'find', 'brave', 'web'],
    'find': ['filesystem', 'grep', 'find', 'search'],
    'grep': ['grep', 'search'],
    // Firebase/Cloud
    'firebase': ['firebase', 'firestore', 'functions', 'hosting', 'auth'],
    'deploy': ['firebase', 'deploy', 'hosting', 'cloudflare', 'vercel'],
    'database': ['firestore', 'firebase', 'postgres', 'sql', 'database'],
    // Web/Browser
    'browser': ['browser', 'puppeteer', 'playwright', 'web'],
    'screenshot': ['browser', 'puppeteer', 'screenshot'],
    'pdf': ['pdf', 'html2pdf', 'mcp-pdf'],
    // Code/Development
    'test': ['test', 'jest', 'pytest', 'flutter_test'],
    'lint': ['lint', 'eslint', 'analyze'],
    'build': ['build', 'compile', 'flutter_build'],
    'run': ['run', 'execute', 'start'],
    // AI/LLM
    'think': ['sequential-thinking', 'thinking'],
    'reasoning': ['sequential-thinking', 'thinking'],
    // Documentation
    'doc': ['readme', 'docs', 'documentation'],
    'readme': ['readme', 'markdown'],
};
/**
 * Always-include tools (essential utilities)
 */
const ESSENTIAL_TOOLS = [
    'read_file',
    'write_file',
    'list_directory',
    'run_command',
    'search_files',
];
class ToolFilter {
    constructor() {
        this.enabled = true;
        this.minScore = 0.3;
    }
    /**
     * Enable/disable filtering
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    /**
     * Filter tools based on user message intent
     */
    filterByIntent(tools, userMessage) {
        if (!this.enabled || !userMessage) {
            return tools;
        }
        const messageLower = userMessage.toLowerCase();
        const scores = this.scoreTools(tools, messageLower);
        // Include essential tools + tools above threshold
        const filtered = tools.filter(tool => {
            const toolName = tool.name.toLowerCase();
            const score = scores.get(tool.name) || 0;
            // Always include essential tools
            if (ESSENTIAL_TOOLS.some(e => toolName.includes(e))) {
                return true;
            }
            return score >= this.minScore;
        });
        // If filtering removes too many, return all
        if (filtered.length < 5) {
            logger_1.logger.debug(LOG_CAT, `Filtering too aggressive, returning all ${tools.length} tools`);
            return tools;
        }
        logger_1.logger.info(LOG_CAT, `Filtered ${tools.length} → ${filtered.length} tools based on intent`);
        return filtered;
    }
    /**
     * Score tools based on message relevance
     */
    scoreTools(tools, message) {
        const scores = new Map();
        // Find matching intent patterns
        const matchedPatterns = [];
        for (const [keyword, patterns] of Object.entries(INTENT_PATTERNS)) {
            if (message.includes(keyword)) {
                matchedPatterns.push(...patterns);
            }
        }
        for (const tool of tools) {
            const toolName = tool.name.toLowerCase();
            const toolDesc = (tool.description || '').toLowerCase();
            let score = 0;
            // Direct name match in message
            if (message.includes(toolName)) {
                score += 1.0;
            }
            // Pattern match
            for (const pattern of matchedPatterns) {
                if (toolName.includes(pattern) || toolDesc.includes(pattern)) {
                    score += 0.5;
                }
            }
            // Partial word matches in description
            const words = message.split(/\s+/);
            for (const word of words) {
                if (word.length > 3 && toolDesc.includes(word)) {
                    score += 0.2;
                }
            }
            scores.set(tool.name, Math.min(score, 1.0));
        }
        return scores;
    }
    /**
     * Prioritize tools (sort by relevance)
     */
    prioritize(tools, userMessage) {
        if (!userMessage)
            return tools;
        const messageLower = userMessage.toLowerCase();
        const scores = this.scoreTools(tools, messageLower);
        return [...tools].sort((a, b) => {
            const scoreA = scores.get(a.name) || 0;
            const scoreB = scores.get(b.name) || 0;
            return scoreB - scoreA;
        });
    }
}
exports.ToolFilter = ToolFilter;
//# sourceMappingURL=tool_filter.js.map