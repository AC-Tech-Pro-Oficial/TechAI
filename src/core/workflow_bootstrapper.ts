/**
 * Workflow Bootstrapper
 * Copies bundled workflows to %USERPROFILE%\.gemini\antigravity\global_workflows\
 * Copies bundled contexts to %USERPROFILE%\.gemini\antigravity\contexts\
 * Applies PROJECT_RULES.md to D:\ projects.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ConfigManager } from './config_manager';

export class WorkflowBootstrapper {
    private static readonly ANTIGRAVITY_ROOT = path.join(
        process.env.USERPROFILE || process.env.HOME || '',
        '.gemini', 'antigravity'
    );
    private static readonly GLOBAL_WORKFLOWS_PATH = path.join(
        this.ANTIGRAVITY_ROOT, 'global_workflows'
    );
    private static readonly CONTEXTS_PATH = path.join(
        this.ANTIGRAVITY_ROOT, 'contexts'
    );
    // private static readonly AC_TECH_DRIVE = 'D:'; // Removed in favor of config
    private static readonly BUNDLED_WORKFLOWS_PATH = 'resources/bundled_workflows';
    private static readonly BUNDLED_CONTEXTS_PATH = 'resources/bundled_contexts';

    /**
     * Initialize the bootstrapper. Called on extension activation.
     */
    public static async initialize(context: vscode.ExtensionContext): Promise<void> {
        logger.section('Bootstrapper', 'Initializing Workflow Bootstrapper');

        try {
            await this.ensureDirectories();
            await this.syncBundledWorkflows(context);
            await this.syncBundledContexts(context);
            await this.applyProjectRulesToWorkspaceRoot();
            logger.info('Bootstrapper', 'Workflow Bootstrapper initialized successfully');
        } catch (err) {
            logger.error('Bootstrapper', `Initialization failed: ${err}`);
        }
    }

    /**
     * Ensure all required directories exist.
     */
    private static async ensureDirectories(): Promise<void> {
        for (const dir of [this.GLOBAL_WORKFLOWS_PATH, this.CONTEXTS_PATH]) {
            if (!fs.existsSync(dir)) {
                logger.info('Bootstrapper', `Creating directory: ${dir}`);
                await fs.promises.mkdir(dir, { recursive: true });
            }
        }
    }

    /**
     * Copy bundled workflows from extension resources to global workflows directory.
     * ALWAYS overwrites to ensure users have the latest AC Tech standard workflows.
     */
    private static async syncBundledWorkflows(context: vscode.ExtensionContext): Promise<void> {
        const bundledPath = path.join(context.extensionPath, this.BUNDLED_WORKFLOWS_PATH);

        if (!fs.existsSync(bundledPath)) {
            logger.warn('Bootstrapper', `Bundled workflows not found at: ${bundledPath}`);
            return;
        }

        const files = await fs.promises.readdir(bundledPath);
        let copiedCount = 0;

        for (const file of files) {
            if (!file.endsWith('.md')) continue;

            const srcFile = path.join(bundledPath, file);
            const destFile = path.join(this.GLOBAL_WORKFLOWS_PATH, file);

            try {
                await fs.promises.copyFile(srcFile, destFile);
                copiedCount++;
                logger.debug('Bootstrapper', `Synced workflow: ${file}`);
            } catch (err) {
                logger.warn('Bootstrapper', `Failed to sync ${file}: ${err}`);
            }
        }

        if (copiedCount > 0) {
            logger.info('Bootstrapper', `Synced ${copiedCount} workflow file(s)`);
        }
    }

    /**
     * Copy bundled contexts from extension resources to contexts directory.
     * ALWAYS overwrites to ensure users have the latest AC Tech context templates.
     */
    private static async syncBundledContexts(context: vscode.ExtensionContext): Promise<void> {
        const bundledPath = path.join(context.extensionPath, this.BUNDLED_CONTEXTS_PATH);

        if (!fs.existsSync(bundledPath)) {
            logger.warn('Bootstrapper', `Bundled contexts not found at: ${bundledPath}`);
            return;
        }

        const files = await fs.promises.readdir(bundledPath);
        let copiedCount = 0;

        for (const file of files) {
            if (!file.endsWith('.txt')) continue;

            const srcFile = path.join(bundledPath, file);
            const destFile = path.join(this.CONTEXTS_PATH, file);

            try {
                await fs.promises.copyFile(srcFile, destFile);
                copiedCount++;
                logger.debug('Bootstrapper', `Synced context: ${file}`);
            } catch (err) {
                logger.warn('Bootstrapper', `Failed to sync ${file}: ${err}`);
            }
        }

        if (copiedCount > 0) {
            logger.info('Bootstrapper', `Synced ${copiedCount} context file(s)`);
        }
    }

    /**
     * Scan user-configured workspace root for project directories and apply PROJECT_RULES.md if missing.
     */
    private static async applyProjectRulesToWorkspaceRoot(): Promise<void> {
        const configManager = new ConfigManager();
        const config = configManager.get_config();

        let acTechRoot = config.workspace_root || 'D:\\';

        // Ensure trailing slash for consistency if needed, though path.join handles it.
        // But readdir might expect a directory. 
        // If user enters "D:", fs.readdir might fail or behave differently than "D:\"
        // Let's ensure it has a separator if it's a drive letter only, but path.join usually works.
        // Actually, let's just use it as is, but log it.

        if (!fs.existsSync(acTechRoot)) {
            logger.debug('Bootstrapper', `Workspace root not found at: ${acTechRoot}, skipping project rules sync`);
            return;
        }

        try {
            const entries = await fs.promises.readdir(acTechRoot, { withFileTypes: true });
            const projectFolders = entries.filter(e =>
                e.isDirectory() &&
                !e.name.startsWith('.') &&
                !e.name.startsWith('$') &&
                e.name !== 'System Volume Information'
            );

            for (const folder of projectFolders) {
                const projectPath = path.join(acTechRoot, folder.name);
                const rulesPath = path.join(projectPath, 'PROJECT_RULES.md');

                const isProject =
                    fs.existsSync(path.join(projectPath, '.git')) ||
                    fs.existsSync(path.join(projectPath, 'pubspec.yaml')) ||
                    fs.existsSync(path.join(projectPath, 'package.json'));

                if (isProject) {
                    // Forcefully overwrite or create the project rules, ensuring strict adherence to global standards.
                    await this.createDefaultProjectRules(rulesPath, folder.name);
                }
            }
        } catch (err) {
            logger.warn('Bootstrapper', `Error scanning workspace root (${acTechRoot}): ${err}`);
        }
    }

    /**
     * Create a default PROJECT_RULES.md for a new project.
     */
    private static async createDefaultProjectRules(rulesPath: string, projectName: string): Promise<void> {
        const template = `# Project Rules: ${projectName}

## Metadata
- **Type**: AC Tech Project
- **Path**: ${path.dirname(rulesPath)}

## Core Directives
1. Follow global rules in \`%USERPROFILE%\\.gemini\\antigravity\\global_workflows\\TechAI_Instructions.md\`.
2. Follow context from \`%USERPROFILE%\\.gemini\\antigravity\\contexts\\Context_Loader.txt\`.
3. **CLI-First**: Always use CLI tools before browser.
4. **Exhaustive Execution**: Agents must be exhaustive and aim for perfection.

<!-- MANUAL -->

<!-- /MANUAL -->
`;
        try {
            await fs.promises.writeFile(rulesPath, template, 'utf-8');
            logger.info('Bootstrapper', `Enforced PROJECT_RULES.md for: ${projectName}`);
        } catch (err) {
            logger.warn('Bootstrapper', `Failed to create rules for ${projectName}: ${err}`);
        }
    }
}
