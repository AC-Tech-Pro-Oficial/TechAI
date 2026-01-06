/**
 * TechAI Antigravity - Update Checker
 * Checks GitHub Releases for updates and installs new versions
 */

import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';
import { showTimedInfoMessage } from '../utils/notifications';

const LOG_CAT = 'UpdateChecker';
const GITHUB_OWNER = 'AC-Tech-Pro-Oficial';
const GITHUB_REPO = 'techai-Antigravity';
const REMIND_LATER_KEY = 'techai.remindLaterTimestamp';
const REMIND_LATER_DAYS = 7;

interface GitHubRelease {
    tag_name: string;
    name: string;
    assets: {
        name: string;
        browser_download_url: string;
    }[];
}

export class UpdateChecker {
    private context: vscode.ExtensionContext;
    private currentVersion: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        // Get current version from package.json
        const ext = vscode.extensions.getExtension('ac-tech-pro.techai-antigravity');
        this.currentVersion = ext?.packageJSON?.version || '0.0.0';
        logger.info(LOG_CAT, `Current version: ${this.currentVersion}`);
    }

    /**
     * Main entry point - check for updates on startup
     */
    public async checkForUpdates(force: boolean = false): Promise<void> {
        // Check if "Remind Later" is still active
        if (!force && this.isRemindLaterActive()) {
            logger.debug(LOG_CAT, 'Remind Later is active, skipping update check');
            return;
        }

        // Check if auto-update is enabled
        const autoUpdate = vscode.workspace.getConfiguration('techai').get<boolean>('autoUpdate', false);

        try {
            const latestRelease = await this.fetchLatestRelease();
            if (!latestRelease) {
                logger.warn(LOG_CAT, 'Could not fetch latest release');
                return;
            }

            const latestVersion = latestRelease.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
            logger.info(LOG_CAT, `Latest version on GitHub: ${latestVersion}`);

            if (this.isNewerVersion(latestVersion, this.currentVersion)) {
                logger.info(LOG_CAT, `Update available: ${this.currentVersion} -> ${latestVersion}`);

                // Find VSIX asset
                const vsixAsset = latestRelease.assets.find(a => a.name.endsWith('.vsix'));
                if (!vsixAsset) {
                    logger.warn(LOG_CAT, 'No VSIX asset found in release');
                    return;
                }

                if (autoUpdate) {
                    // Auto-update enabled, just do it
                    await this.downloadAndInstall(vsixAsset.browser_download_url, latestVersion);
                } else {
                    // Prompt user
                    await this.promptUpdate(latestVersion, vsixAsset.browser_download_url);
                }
            } else {
                logger.info(LOG_CAT, 'Already up to date');
            }
        } catch (e: any) {
            logger.error(LOG_CAT, `Update check failed: ${e.message}`);
        }
    }

    private isRemindLaterActive(): boolean {
        const timestamp = this.context.globalState.get<number>(REMIND_LATER_KEY);
        if (!timestamp) return false;

        const now = Date.now();
        const isActive = now < timestamp;
        if (!isActive) {
            // Clear expired timestamp
            this.context.globalState.update(REMIND_LATER_KEY, undefined);
        }
        return isActive;
    }

    private setRemindLater(): void {
        const futureTime = Date.now() + (REMIND_LATER_DAYS * 24 * 60 * 60 * 1000);
        this.context.globalState.update(REMIND_LATER_KEY, futureTime);
        logger.info(LOG_CAT, `Remind Later set for ${REMIND_LATER_DAYS} days`);
    }

    private async fetchLatestRelease(): Promise<GitHubRelease | null> {
        return new Promise((resolve, reject) => {
            const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

            const req = https.get(url, {
                headers: {
                    'User-Agent': 'TechAI-Antigravity-Extension',
                    'Accept': 'application/vnd.github.v3+json'
                },
                timeout: 10000 // 10s timeout
            }, (res) => {
                if (res.statusCode === 404) {
                    resolve(null); // No releases yet
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`GitHub API returned ${res.statusCode}`));
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data) as GitHubRelease);
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('GitHub API request timed out'));
            });
        });
    }

    /**
     * Simple semver comparison: returns true if latest > current
     */
    private isNewerVersion(latest: string, current: string): boolean {
        // Safety check: if current is 0.0.0 (dev or undetected), don't update to avoid loops
        if (current === '0.0.0') {
            logger.warn(LOG_CAT, 'Current version is 0.0.0, skipping update check');
            return false;
        }

        const latestParts = latest.split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            const l = latestParts[i] || 0;
            const c = currentParts[i] || 0;
            if (l > c) return true;
            if (l < c) return false;
        }
        return false; // Equal
    }

    private async promptUpdate(version: string, downloadUrl: string): Promise<void> {
        const updateNow = 'Update Now';
        const enableAutoUpdate = 'Enable Auto-Update';
        const remindLater = 'Remind Me in 7 Days';

        const choice = await vscode.window.showInformationMessage(
            `techai v${version} is available. You are using v${this.currentVersion}.`,
            updateNow,
            enableAutoUpdate,
            remindLater
        );

        switch (choice) {
            case updateNow:
                await this.downloadAndInstall(downloadUrl, version);
                break;
            case enableAutoUpdate:
                await vscode.workspace.getConfiguration('techai').update('autoUpdate', true, vscode.ConfigurationTarget.Global);
                showTimedInfoMessage('Auto-Update enabled for techai.');
                await this.downloadAndInstall(downloadUrl, version);
                break;
            case remindLater:
                this.setRemindLater();
                showTimedInfoMessage('You will be reminded in 7 days.');
                break;
        }
    }

    private async downloadAndInstall(downloadUrl: string, version: string): Promise<void> {
        const progressOptions: vscode.ProgressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: `Updating techai to v${version}`,
            cancellable: false
        };

        let success = false;

        await vscode.window.withProgress(progressOptions, async (progress) => {
            progress.report({ message: 'Downloading...' });

            const tempDir = os.tmpdir();
            const vsixPath = path.join(tempDir, `techai-${version}.vsix`);

            try {
                // Ensure we delete any existing temp file first
                if (fs.existsSync(vsixPath)) {
                    fs.unlinkSync(vsixPath);
                }

                await this.downloadFile(downloadUrl, vsixPath);
                progress.report({ message: 'Installing...' });

                await vscode.commands.executeCommand(
                    'workbench.extensions.installExtension',
                    vscode.Uri.file(vsixPath)
                );

                // Clean up temp file
                if (fs.existsSync(vsixPath)) {
                    fs.unlinkSync(vsixPath);
                }

                success = true;
            } catch (e: any) {
                logger.error(LOG_CAT, `Install failed: ${e.message}`);
                vscode.window.showErrorMessage(`Failed to install update: ${e.message}`);

                // Cleanup on error
                if (fs.existsSync(vsixPath)) {
                    fs.unlinkSync(vsixPath);
                }
            }
        });

        if (success) {
            const reload = await vscode.window.showInformationMessage(
                `techai v${version} installed. Reload to activate.`,
                'Reload Now'
            );

            if (reload === 'Reload Now') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        }
    }

    private downloadFile(url: string, destPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);

            file.on('error', (err) => {
                fs.unlink(destPath, () => { }); // Async unlink, don't wait
                reject(err);
            });

            const request = (urlToFetch: string) => {
                const req = https.get(urlToFetch, {
                    headers: { 'User-Agent': 'TechAI-Antigravity-Extension' },
                    timeout: 15000 // 15s timeout for download
                }, (res) => {
                    // Handle redirects (GitHub uses them for downloads)
                    if (res.statusCode === 302 || res.statusCode === 301) {
                        const redirectUrl = res.headers.location;
                        if (redirectUrl) {
                            request(redirectUrl);
                            return;
                        }
                    }

                    if (res.statusCode !== 200) {
                        file.close();
                        fs.unlink(destPath, () => { });
                        reject(new Error(`Download failed with status ${res.statusCode}`));
                        return;
                    }

                    const contentLength = parseInt(res.headers['content-length'] || '0', 10);

                    res.pipe(file);

                    file.on('finish', () => {
                        file.close();

                        // Verify size if Content-Length was provided
                        if (contentLength > 0) {
                            const stats = fs.statSync(destPath);
                            if (stats.size !== contentLength) {
                                fs.unlink(destPath, () => { });
                                reject(new Error(`Download incomplete: expected ${contentLength} bytes, got ${stats.size}`));
                                return;
                            }
                        }

                        resolve();
                    });
                });

                req.on('error', (e) => {
                    file.close();
                    fs.unlink(destPath, () => { });
                    reject(e);
                });

                req.on('timeout', () => {
                    req.destroy();
                    file.close();
                    fs.unlink(destPath, () => { });
                    reject(new Error('Download timed out'));
                });
            };

            request(url);
        });
    }
}

