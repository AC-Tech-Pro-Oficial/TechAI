/**
 * Workflow Bootstrapper
 * Copies bundled workflows to %USERPROFILE%\.gemini\antigravity\global_workflows\
 * Applies PROJECT_RULES.md to D:\ projects.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export class WorkflowBootstrapper {
    private static readonly GLOBAL_WORKFLOWS_PATH = path.join(
        process.env.USERPROFILE || process.env.HOME || '',
        '.gemini', 'antigravity', 'global_workflows'
    );
    private static readonly AC_TECH_DRIVE = 'D:';
    private static readonly BUNDLED_WORKFLOWS_PATH = 'resources/bundled_workflows';

    /**
     * Initialize the bootstrapper. Called on extension activation.
     */
    public static async initialize(context: vscode.ExtensionContext): Promise<void> {
        logger.section('Bootstrapper', 'Initializing Workflow Bootstrapper');

        try {
            await this.ensureGlobalWorkflowsDir();
            await this.syncBundledWorkflows(context);
            await this.applyProjectRulesToDDrive();
            logger.info('Bootstrapper', 'Workflow Bootstrapper initialized successfully');
        } catch (err) {
            logger.error('Bootstrapper', `Initialization failed: ${err}`);
        }
    }

    /**
     * Ensure the global workflows directory exists.
     */
    private static async ensureGlobalWorkflowsDir(): Promise<void> {
        if (!fs.existsSync(this.GLOBAL_WORKFLOWS_PATH)) {
            logger.info('Bootstrapper', `Creating global workflows directory: ${this.GLOBAL_WORKFLOWS_PATH}`);
            await fs.promises.mkdir(this.GLOBAL_WORKFLOWS_PATH, { recursive: true });
        }
    }

    /**
     * Copy bundled workflows from extension resources to global workflows directory.
     * Only copies if the file is missing or older than the bundled version.
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
                const srcStat = await fs.promises.stat(srcFile);
                let shouldCopy = false;

                if (!fs.existsSync(destFile)) {
                    shouldCopy = true;
                } else {
                    const destStat = await fs.promises.stat(destFile);
                    // Copy if bundled is newer
                    shouldCopy = srcStat.mtimeMs > destStat.mtimeMs;
                }

                if (shouldCopy) {
                    await fs.promises.copyFile(srcFile, destFile);
                    copiedCount++;
                    logger.debug('Bootstrapper', `Synced workflow: ${file}`);
                }
            } catch (err) {
                logger.warn('Bootstrapper', `Failed to sync ${file}: ${err}`);
            }
        }

        if (copiedCount > 0) {
            logger.info('Bootstrapper', `Synced ${copiedCount} workflow file(s)`);
        }
    }

    /**
     * Scan D:\ for project directories and apply PROJECT_RULES.md if missing.
     */
    private static async applyProjectRulesToDDrive(): Promise<void> {
        const acTechRoot = this.AC_TECH_DRIVE + '\\';

        if (!fs.existsSync(acTechRoot)) {
            logger.debug('Bootstrapper', 'D:\\ drive not found, skipping project rules sync');
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

                // Only check if it's a git repo or has pubspec/package.json
                const isProject =
                    fs.existsSync(path.join(projectPath, '.git')) ||
                    fs.existsSync(path.join(projectPath, 'pubspec.yaml')) ||
                    fs.existsSync(path.join(projectPath, 'package.json'));

                if (isProject && !fs.existsSync(rulesPath)) {
                    await this.createDefaultProjectRules(rulesPath, folder.name);
                }
            }
        } catch (err) {
            logger.warn('Bootstrapper', `Error scanning D:\\: ${err}`);
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
1. Follow global rules in \`D:\\TechAI\\TechAI_Manifesto.md\`.
2. Follow workflow definitions in \`%USERPROFILE%\\.gemini\\antigravity\\global_workflows\\\`.
3. **CLI-First**: Always use CLI tools before browser.
4. **Exhaustive Execution**: Agents must be exhaustive and aim for perfection.

<!-- MANUAL -->

<!-- /MANUAL -->
`;
        try {
            await fs.promises.writeFile(rulesPath, template, 'utf-8');
            logger.info('Bootstrapper', `Created PROJECT_RULES.md for: ${projectName}`);
        } catch (err) {
            logger.warn('Bootstrapper', `Failed to create rules for ${projectName}: ${err}`);
        }
    }
}
