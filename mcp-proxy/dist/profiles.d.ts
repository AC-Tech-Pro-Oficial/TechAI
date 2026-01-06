/**
 * TechAI MCP Proxy - Profile Manager
 *
 * Manages workspace profiles for MCP server routing.
 * Profiles define which MCP servers to enable for different workspace types.
 */
import { WorkspaceProfile } from './types';
export declare class ProfileManager {
    private config;
    private configPath;
    private fileWatcher?;
    constructor(configPath?: string);
    /**
     * Get default config path based on platform
     */
    private getDefaultConfigPath;
    /**
     * Load configuration from file or use defaults
     */
    private loadConfig;
    /**
     * Save default configuration to file
     */
    private saveDefaultConfig;
    /**
     * Watch for config file changes and reload
     */
    private setupFileWatcher;
    /**
     * Find the best matching profile for a workspace
     *
     * @param workspacePath - Absolute path to the workspace folder
     * @param existingFiles - Optional pre-scanned list of files in the workspace
     */
    getProfileForWorkspace(workspacePath: string, existingFiles?: string[]): Promise<WorkspaceProfile>;
    /**
     * Check if workspace files match a profile's patterns
     */
    private matchesProfile;
    /**
     * Scan workspace for files (limited depth for performance)
     */
    private scanWorkspaceFiles;
    /**
     * Get all profiles
     */
    getProfiles(): WorkspaceProfile[];
    /**
     * Get a profile by name
     */
    getProfileByName(name: string): WorkspaceProfile | undefined;
    /**
     * Get servers for a specific profile name
     */
    getServersForProfile(profileName: string): string[];
    /**
     * Add or update a profile
     */
    setProfile(profile: WorkspaceProfile): void;
    /**
     * Save current config to file
     */
    private saveConfig;
    /**
     * Cleanup resources
     */
    dispose(): void;
}
//# sourceMappingURL=profiles.d.ts.map