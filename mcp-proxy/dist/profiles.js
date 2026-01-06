"use strict";
/**
 * TechAI MCP Proxy - Profile Manager
 *
 * Manages workspace profiles for MCP server routing.
 * Profiles define which MCP servers to enable for different workspace types.
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
exports.ProfileManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const minimatch_1 = require("minimatch");
const logger_1 = require("./logger");
const LOG_CAT = 'ProfileManager';
/**
 * Default profiles if no configuration file exists
 */
const DEFAULT_PROFILES = {
    version: 1,
    profiles: [
        {
            name: 'Flutter/Firebase Projects',
            match: ['**/pubspec.yaml', '**/firebase.json', '**/.firebaserc'],
            servers: [
                'firebase-mcp',
                'server-filesystem',
                'server-git'
            ],
            resources: ['workspace://project-info'],
            prompts: ['flutter-best-practices']
        },
        {
            name: 'Node.js Projects',
            match: ['**/package.json'],
            servers: [
                'github-mcp-server',
                'server-git',
                'server-filesystem'
            ],
            resources: ['workspace://project-info']
        },
        {
            name: 'Python Projects',
            match: ['**/requirements.txt', '**/pyproject.toml', '**/setup.py', '**/*.py'],
            servers: [
                'server-filesystem',
                'server-git'
            ]
        },
        {
            name: 'Cloudflare Projects',
            match: ['**/wrangler.toml', '**/wrangler.json'],
            servers: [
                'mcp-server-cloudflare-docs',
                'server-filesystem',
                'server-git'
            ]
        },
        {
            name: 'Docker Projects',
            match: ['**/Dockerfile', '**/docker-compose.yml', '**/docker-compose.yaml'],
            servers: [
                'server-docker',
                'server-filesystem'
            ]
        },
        {
            name: 'Database Projects',
            match: ['**/*.sql', '**/schema.prisma', '**/drizzle.config.*'],
            servers: [
                'server-postgres',
                'server-filesystem'
            ]
        },
        {
            name: 'Default (Minimal)',
            match: ['**/*'],
            servers: [
                'server-filesystem'
            ]
        }
    ],
    defaultProfile: 'Default (Minimal)'
};
class ProfileManager {
    constructor(configPath) {
        this.configPath = configPath || this.getDefaultConfigPath();
        this.config = this.loadConfig();
        this.setupFileWatcher();
    }
    /**
     * Get default config path based on platform
     */
    getDefaultConfigPath() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        if (process.platform === 'win32') {
            // Windows: Use Antigravity config folder
            return path.join(homeDir, '.gemini', 'antigravity', 'mcp_profiles.json');
        }
        else if (process.platform === 'darwin') {
            // macOS
            return path.join(homeDir, 'Library', 'Application Support', 'Antigravity', 'mcp_profiles.json');
        }
        else {
            // Linux
            return path.join(homeDir, '.config', 'antigravity', 'mcp_profiles.json');
        }
    }
    /**
     * Load configuration from file or use defaults
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(content);
                logger_1.logger.info(LOG_CAT, `Loaded ${parsed.profiles.length} profiles from ${this.configPath}`);
                return parsed;
            }
        }
        catch (error) {
            logger_1.logger.warn(LOG_CAT, `Failed to load profiles from ${this.configPath}:`, error);
        }
        // Save defaults and return them
        logger_1.logger.info(LOG_CAT, 'Using default profiles');
        this.saveDefaultConfig();
        return DEFAULT_PROFILES;
    }
    /**
     * Save default configuration to file
     */
    saveDefaultConfig() {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(DEFAULT_PROFILES, null, 2));
            logger_1.logger.info(LOG_CAT, `Saved default profiles to ${this.configPath}`);
        }
        catch (error) {
            logger_1.logger.error(LOG_CAT, `Failed to save default profiles:`, error);
        }
    }
    /**
     * Watch for config file changes and reload
     */
    setupFileWatcher() {
        try {
            if (fs.existsSync(this.configPath)) {
                this.fileWatcher = fs.watch(this.configPath, (eventType) => {
                    if (eventType === 'change') {
                        logger_1.logger.info(LOG_CAT, 'Profile config changed, reloading...');
                        this.config = this.loadConfig();
                    }
                });
            }
        }
        catch (error) {
            logger_1.logger.warn(LOG_CAT, 'Failed to setup file watcher:', error);
        }
    }
    /**
     * Find the best matching profile for a workspace
     *
     * @param workspacePath - Absolute path to the workspace folder
     * @param existingFiles - Optional pre-scanned list of files in the workspace
     */
    async getProfileForWorkspace(workspacePath, existingFiles) {
        const files = existingFiles || await this.scanWorkspaceFiles(workspacePath);
        logger_1.logger.debug(LOG_CAT, `Scanning workspace ${workspacePath} with ${files.length} files`);
        // Find best matching profile (first match wins, order matters)
        for (const profile of this.config.profiles) {
            if (profile.name === this.config.defaultProfile) {
                continue; // Skip default, check it last
            }
            if (this.matchesProfile(files, profile)) {
                logger_1.logger.info(LOG_CAT, `Matched profile "${profile.name}" for ${workspacePath}`);
                return profile;
            }
        }
        // Return default profile
        const defaultProfile = this.config.profiles.find(p => p.name === this.config.defaultProfile) || this.config.profiles[this.config.profiles.length - 1];
        logger_1.logger.info(LOG_CAT, `Using default profile "${defaultProfile.name}" for ${workspacePath}`);
        return defaultProfile;
    }
    /**
     * Check if workspace files match a profile's patterns
     */
    matchesProfile(files, profile) {
        for (const pattern of profile.match) {
            // Skip the catch-all pattern for non-default profiles
            if (pattern === '**/*')
                continue;
            for (const file of files) {
                if ((0, minimatch_1.minimatch)(file, pattern, { nocase: true, dot: true })) {
                    logger_1.logger.debug(LOG_CAT, `Pattern "${pattern}" matched file "${file}"`);
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Scan workspace for files (limited depth for performance)
     */
    async scanWorkspaceFiles(workspacePath, maxDepth = 3) {
        const files = [];
        const scan = (dir, depth) => {
            if (depth > maxDepth)
                return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    // Skip hidden dirs and node_modules
                    if (entry.name.startsWith('.') && entry.name !== '.firebaserc')
                        continue;
                    if (entry.name === 'node_modules')
                        continue;
                    if (entry.name === 'build' || entry.name === 'dist')
                        continue;
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(workspacePath, fullPath).replace(/\\/g, '/');
                    if (entry.isDirectory()) {
                        scan(fullPath, depth + 1);
                    }
                    else {
                        files.push(relativePath);
                    }
                }
            }
            catch (error) {
                // Ignore permission errors
            }
        };
        scan(workspacePath, 0);
        logger_1.logger.debug(LOG_CAT, `Scanned ${files.length} files in ${workspacePath}`);
        return files;
    }
    /**
     * Get all profiles
     */
    getProfiles() {
        return [...this.config.profiles];
    }
    /**
     * Get a profile by name
     */
    getProfileByName(name) {
        return this.config.profiles.find(p => p.name === name);
    }
    /**
     * Get servers for a specific profile name
     */
    getServersForProfile(profileName) {
        const profile = this.getProfileByName(profileName);
        return profile?.servers || [];
    }
    /**
     * Add or update a profile
     */
    setProfile(profile) {
        const existingIndex = this.config.profiles.findIndex(p => p.name === profile.name);
        if (existingIndex >= 0) {
            this.config.profiles[existingIndex] = profile;
        }
        else {
            // Insert before the default profile
            const defaultIndex = this.config.profiles.findIndex(p => p.name === this.config.defaultProfile);
            if (defaultIndex >= 0) {
                this.config.profiles.splice(defaultIndex, 0, profile);
            }
            else {
                this.config.profiles.push(profile);
            }
        }
        this.saveConfig();
    }
    /**
     * Save current config to file
     */
    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            logger_1.logger.info(LOG_CAT, 'Saved profile config');
        }
        catch (error) {
            logger_1.logger.error(LOG_CAT, 'Failed to save profile config:', error);
        }
    }
    /**
     * Cleanup resources
     */
    dispose() {
        if (this.fileWatcher) {
            this.fileWatcher.close();
        }
    }
}
exports.ProfileManager = ProfileManager;
//# sourceMappingURL=profiles.js.map