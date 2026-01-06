/**
 * TechAI MCP Proxy - Context Injector
 *
 * Injects workspace-specific context using MCP Resources.
 * This allows the proxy to provide dynamic context to agents without
 * relying on IDE system prompt injection.
 */
import { Resource, ResourceContent } from './types';
/**
 * Context injector provides MCP Resources for workspace context
 */
export declare class ContextInjector {
    private workspacePath;
    private cachedInfo?;
    private cacheTimestamp;
    private readonly CACHE_TTL_MS;
    constructor(workspacePath: string);
    /**
     * Update workspace path
     */
    setWorkspace(workspacePath: string): void;
    /**
     * Get all injected resources for this workspace
     */
    getResources(): Resource[];
    /**
     * Read resource content by URI
     */
    readResource(uri: string): Promise<ResourceContent>;
    /**
     * Get project info content
     */
    private getProjectInfoContent;
    /**
     * Analyze workspace and cache results
     */
    private analyzeWorkspace;
    /**
     * Scan files in workspace
     */
    private scanFiles;
    /**
     * Detect project type and technologies
     */
    private detectTechnologies;
    /**
     * Get Git info
     */
    private getGitInfo;
    /**
     * Find README file
     */
    private findReadme;
    /**
     * Get README content
     */
    private getReadmeContent;
    /**
     * Get manifest resource info (package.json, pubspec.yaml, etc.)
     */
    private getManifestResource;
    /**
     * Get manifest file content
     */
    private getManifestContent;
    /**
     * Get .gitignore content
     */
    private getGitignoreContent;
    /**
     * Get system context content (CRITICAL: includes current date/time)
     */
    private getSystemContextContent;
}
//# sourceMappingURL=context.d.ts.map