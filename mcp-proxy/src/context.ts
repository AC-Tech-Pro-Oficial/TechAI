/**
 * TechAI MCP Proxy - Context Injector
 * 
 * Injects workspace-specific context using MCP Resources.
 * This allows the proxy to provide dynamic context to agents without
 * relying on IDE system prompt injection.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Resource, ResourceContent, ResourceAnnotations } from './types';
import { logger } from './logger';

const LOG_CAT = 'ContextInjector';

/**
 * Workspace information resource
 */
interface WorkspaceInfo {
    path: string;
    name: string;
    projectType: string;
    detectedTechnologies: string[];
    files: {
        total: number;
        byExtension: Record<string, number>;
    };
    git?: {
        branch?: string;
        remote?: string;
        hasUncommitted?: boolean;
    };
}

/**
 * Context injector provides MCP Resources for workspace context
 */
export class ContextInjector {
    private workspacePath: string;
    private cachedInfo?: WorkspaceInfo;
    private cacheTimestamp: number = 0;
    private readonly CACHE_TTL_MS = 30000; // 30 seconds

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
    }

    /**
     * Update workspace path
     */
    public setWorkspace(workspacePath: string): void {
        if (this.workspacePath !== workspacePath) {
            this.workspacePath = workspacePath;
            this.cachedInfo = undefined;
            this.cacheTimestamp = 0;
        }
    }

    /**
     * Get all injected resources for this workspace
     */
    public getResources(): Resource[] {
        const resources: Resource[] = [];

        // Workspace info resource
        resources.push({
            uri: 'workspace://project-info',
            name: 'Project Information',
            title: 'Current Workspace Context',
            description: 'Automatically detected information about the current project including technologies, structure, and git status.',
            mimeType: 'application/json',
            annotations: {
                audience: ['assistant'],
                priority: 0.9,
                lastModified: new Date().toISOString()
            }
        });

        // README if exists
        const readmePath = this.findReadme();
        if (readmePath) {
            resources.push({
                uri: 'workspace://readme',
                name: 'README',
                title: 'Project README',
                description: 'Project documentation from README file.',
                mimeType: 'text/markdown',
                annotations: {
                    audience: ['assistant'],
                    priority: 0.8
                }
            });
        }

        // Package manifest
        const manifestInfo = this.getManifestResource();
        if (manifestInfo) {
            resources.push(manifestInfo);
        }

        // .gitignore patterns
        if (fs.existsSync(path.join(this.workspacePath, '.gitignore'))) {
            resources.push({
                uri: 'workspace://gitignore',
                name: '.gitignore',
                title: 'Git Ignore Patterns',
                description: 'Files and patterns to ignore in version control.',
                mimeType: 'text/plain',
                annotations: {
                    audience: ['assistant'],
                    priority: 0.5
                }
            });
        }

        // CRITICAL: System Context (Date/Time/Environment)
        resources.push({
            uri: 'workspace://system-context',
            name: 'System Context',
            title: 'Current Environment Metadata',
            description: 'CRITICAL: Contains current date, time, and timezone information. AGENTS MUST READ THIS.',
            mimeType: 'application/json',
            annotations: {
                audience: ['assistant'],
                priority: 1.0 // HIGHEST PRIORITY
            }
        });

        logger.debug(LOG_CAT, `Providing ${resources.length} context resources`);
        return resources;
    }

    /**
     * Read resource content by URI
     */
    public async readResource(uri: string): Promise<ResourceContent> {
        switch (uri) {
            case 'workspace://project-info':
                return this.getProjectInfoContent();

            case 'workspace://readme':
                return this.getReadmeContent();

            case 'workspace://manifest':
                return this.getManifestContent();

            case 'workspace://gitignore':
                return this.getGitignoreContent();

            case 'workspace://system-context':
                return this.getSystemContextContent();

            default:
                throw new Error(`Unknown resource: ${uri}`);
        }
    }

    /**
     * Get project info content
     */
    private async getProjectInfoContent(): Promise<ResourceContent> {
        const info = await this.analyzeWorkspace();

        return {
            uri: 'workspace://project-info',
            mimeType: 'application/json',
            text: JSON.stringify(info, null, 2)
        };
    }

    /**
     * Analyze workspace and cache results
     */
    private async analyzeWorkspace(): Promise<WorkspaceInfo> {
        const now = Date.now();

        if (this.cachedInfo && (now - this.cacheTimestamp) < this.CACHE_TTL_MS) {
            return this.cachedInfo;
        }

        const info: WorkspaceInfo = {
            path: this.workspacePath,
            name: path.basename(this.workspacePath),
            projectType: 'unknown',
            detectedTechnologies: [],
            files: {
                total: 0,
                byExtension: {}
            }
        };

        // Scan files
        const files = this.scanFiles(this.workspacePath, 3);
        info.files.total = files.length;

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (ext) {
                info.files.byExtension[ext] = (info.files.byExtension[ext] || 0) + 1;
            }
        }

        // Detect project type and technologies
        const detections = this.detectTechnologies(files);
        info.projectType = detections.projectType;
        info.detectedTechnologies = detections.technologies;

        // Git info
        info.git = await this.getGitInfo();

        this.cachedInfo = info;
        this.cacheTimestamp = now;

        logger.debug(LOG_CAT, `Analyzed workspace: ${info.projectType}, ${info.detectedTechnologies.join(', ')}`);
        return info;
    }

    /**
     * Scan files in workspace
     */
    private scanFiles(dir: string, maxDepth: number, depth = 0): string[] {
        if (depth > maxDepth) return [];

        const files: string[] = [];

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.name.startsWith('.') && entry.name !== '.firebaserc') continue;
                if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === 'dist') continue;

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    files.push(...this.scanFiles(fullPath, maxDepth, depth + 1));
                } else {
                    files.push(path.relative(this.workspacePath, fullPath).replace(/\\/g, '/'));
                }
            }
        } catch {
            // Ignore permission errors
        }

        return files;
    }

    /**
     * Detect project type and technologies
     */
    private detectTechnologies(files: string[]): { projectType: string; technologies: string[] } {
        const fileSet = new Set(files.map(f => f.toLowerCase()));
        const technologies: string[] = [];
        let projectType = 'unknown';

        // Flutter/Dart
        if (fileSet.has('pubspec.yaml')) {
            projectType = 'flutter';
            technologies.push('Flutter', 'Dart');
        }

        // Node.js
        if (fileSet.has('package.json')) {
            if (projectType === 'unknown') projectType = 'nodejs';
            technologies.push('Node.js');

            // Check for frameworks
            try {
                const pkgPath = path.join(this.workspacePath, 'package.json');
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };

                if (deps['next']) technologies.push('Next.js');
                if (deps['react']) technologies.push('React');
                if (deps['vue']) technologies.push('Vue.js');
                if (deps['angular']) technologies.push('Angular');
                if (deps['express']) technologies.push('Express');
                if (deps['typescript']) technologies.push('TypeScript');
            } catch {
                // Ignore parse errors
            }
        }

        // Python
        if (fileSet.has('requirements.txt') || fileSet.has('pyproject.toml') || fileSet.has('setup.py')) {
            if (projectType === 'unknown') projectType = 'python';
            technologies.push('Python');
        }

        // Firebase
        if (fileSet.has('firebase.json') || fileSet.has('.firebaserc')) {
            technologies.push('Firebase');
        }

        // Docker
        if (files.some(f => f.toLowerCase().includes('dockerfile'))) {
            technologies.push('Docker');
        }

        // Cloudflare
        if (fileSet.has('wrangler.toml') || fileSet.has('wrangler.json')) {
            technologies.push('Cloudflare Workers');
        }

        // PostgreSQL
        if (files.some(f => f.endsWith('.sql'))) {
            technologies.push('SQL');
        }

        // Git
        if (fs.existsSync(path.join(this.workspacePath, '.git'))) {
            technologies.push('Git');
        }

        return { projectType, technologies };
    }

    /**
     * Get Git info
     */
    private async getGitInfo(): Promise<WorkspaceInfo['git']> {
        const gitDir = path.join(this.workspacePath, '.git');
        if (!fs.existsSync(gitDir)) return undefined;

        const info: WorkspaceInfo['git'] = {};

        try {
            // Read current branch
            const headPath = path.join(gitDir, 'HEAD');
            if (fs.existsSync(headPath)) {
                const head = fs.readFileSync(headPath, 'utf-8').trim();
                if (head.startsWith('ref: refs/heads/')) {
                    info.branch = head.replace('ref: refs/heads/', '');
                }
            }

            // Check for uncommitted changes (check if index file was modified)
            const indexPath = path.join(gitDir, 'index');
            if (fs.existsSync(indexPath)) {
                const stats = fs.statSync(indexPath);
                // If modified in last 5 minutes, likely has changes
                info.hasUncommitted = (Date.now() - stats.mtimeMs) < 300000;
            }

            // Read remote
            const configPath = path.join(gitDir, 'config');
            if (fs.existsSync(configPath)) {
                const config = fs.readFileSync(configPath, 'utf-8');
                const remoteMatch = config.match(/\[remote "origin"\][^[]*url = ([^\n]+)/);
                if (remoteMatch) {
                    info.remote = remoteMatch[1].trim();
                }
            }
        } catch {
            // Ignore git read errors
        }

        return info;
    }

    /**
     * Find README file
     */
    private findReadme(): string | null {
        const candidates = ['README.md', 'readme.md', 'README.txt', 'README'];

        for (const name of candidates) {
            const filePath = path.join(this.workspacePath, name);
            if (fs.existsSync(filePath)) {
                return filePath;
            }
        }

        return null;
    }

    /**
     * Get README content
     */
    private getReadmeContent(): ResourceContent {
        const readmePath = this.findReadme();

        if (!readmePath) {
            throw new Error('README not found');
        }

        return {
            uri: 'workspace://readme',
            mimeType: 'text/markdown',
            text: fs.readFileSync(readmePath, 'utf-8')
        };
    }

    /**
     * Get manifest resource info (package.json, pubspec.yaml, etc.)
     */
    private getManifestResource(): Resource | null {
        const manifests = [
            { file: 'package.json', type: 'application/json', name: 'package.json' },
            { file: 'pubspec.yaml', type: 'application/x-yaml', name: 'pubspec.yaml' },
            { file: 'pyproject.toml', type: 'application/toml', name: 'pyproject.toml' }
        ];

        for (const manifest of manifests) {
            if (fs.existsSync(path.join(this.workspacePath, manifest.file))) {
                return {
                    uri: 'workspace://manifest',
                    name: manifest.name,
                    title: 'Project Manifest',
                    description: `Project configuration from ${manifest.name}`,
                    mimeType: manifest.type,
                    annotations: {
                        audience: ['assistant'],
                        priority: 0.7
                    }
                };
            }
        }

        return null;
    }

    /**
     * Get manifest file content
     */
    private getManifestContent(): ResourceContent {
        const manifests = ['package.json', 'pubspec.yaml', 'pyproject.toml'];

        for (const manifest of manifests) {
            const filePath = path.join(this.workspacePath, manifest);
            if (fs.existsSync(filePath)) {
                return {
                    uri: 'workspace://manifest',
                    mimeType: manifest.endsWith('.json') ? 'application/json' : 'text/plain',
                    text: fs.readFileSync(filePath, 'utf-8')
                };
            }
        }

        throw new Error('No manifest file found');
    }

    /**
     * Get .gitignore content
     */
    private getGitignoreContent(): ResourceContent {
        const filePath = path.join(this.workspacePath, '.gitignore');

        if (!fs.existsSync(filePath)) {
            throw new Error('.gitignore not found');
        }

        return {
            uri: 'workspace://gitignore',
            mimeType: 'text/plain',
            text: fs.readFileSync(filePath, 'utf-8')
        };
    }

    /**
     * Get system context content (CRITICAL: includes current date/time)
     */
    private getSystemContextContent(): ResourceContent {
        const now = new Date();

        return {
            uri: 'workspace://system-context',
            mimeType: 'application/json',
            text: JSON.stringify({
                currentDate: now.toISOString(),
                localTime: now.toLocaleString('en-US', {
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    dateStyle: 'full',
                    timeStyle: 'long'
                }),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                timestamp: now.getTime(),
                system: {
                    platform: process.platform,
                    nodeVersion: process.version,
                    arch: process.arch
                },
                workspace: {
                    path: this.workspacePath,
                    name: path.basename(this.workspacePath)
                }
            }, null, 2)
        };
    }
}
