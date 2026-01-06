/**
 * TechAI Extension - MCP Proxy Client
 * 
 * Manages the lifecycle of the MCP Proxy Server from the VS Code extension.
 * Handles spawning, health checks, and communication with the proxy.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import { logger } from '../utils/logger';

const LOG_CAT = 'MCPProxyClient';

interface ProxyStatus {
    running: boolean;
    port: number;
    sessions: Array<{
        id: string;
        profile: string;
        servers: string[];
        lastActivity: string;
    }>;
}

export class MCPProxyClient {
    private process: ChildProcess | null = null;
    private port: number = 9847;
    private isRunning: boolean = false;
    private isOwner: boolean = false; // True if THIS window spawned the proxy
    private context: vscode.ExtensionContext;
    private restartAttempts: number = 0;
    private maxRestartAttempts: number = 3;
    private healthCheckInterval?: NodeJS.Timeout;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Start the MCP Proxy Server
     */
    public async start(): Promise<boolean> {
        if (this.isRunning) {
            logger.info(LOG_CAT, 'Proxy already running');
            return true;
        }

        // DYNAMIC PORT MODE: Always spawn a new isolated proxy for this window
        // This ensures complete isolation between VS Code windows/workspaces

        try {
            const proxyPath = this.getProxyPath();

            if (!proxyPath) {
                logger.error(LOG_CAT, 'Could not find MCP Proxy');
                return false;
            }

            logger.info(LOG_CAT, `Starting isolated MCP Proxy from ${proxyPath}`);

            // Spawn the proxy process with port 0 (OS assigned)
            this.process = spawn('node', [proxyPath], {
                env: {
                    ...process.env,
                    MCP_PROXY_PORT: '0', // Request dynamic port
                    MCP_PROXY_LOG_LEVEL: 'info'
                },
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false
            });

            // Handle stdout to capture the assigned port
            this.process.stdout?.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    logger.debug(LOG_CAT, `[Proxy] ${output}`);

                    // Parse "MCP Proxy Server running on http://127.0.0.1:12345"
                    // Modified regex to handle standard URL format correctly (no space before colon)
                    const match = output.match(/running on http:\/\/[\d\.]+[:](\d+)/);
                    if (match && match[1]) {
                        const assignedPort = parseInt(match[1], 10);
                        if (!isNaN(assignedPort) && this.port !== assignedPort) {
                            this.port = assignedPort;
                            logger.info(LOG_CAT, `Proxy bound to dynamic port: ${this.port}`);
                        }
                    }
                }
            });

            // Handle stderr
            this.process.stderr?.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    logger.warn(LOG_CAT, `[Proxy Error] ${output}`);
                }
            });

            // Handle exit
            this.process.on('exit', (code) => {
                logger.info(LOG_CAT, `Proxy exited with code ${code}`);
                const wasOwner = this.isOwner; // Capture before reset
                this.isRunning = false;
                this.isOwner = false;
                this.stopHealthCheck();

                // Only restart if WE spawned the proxy (not sharing another window's)
                if (wasOwner && code !== 0 && this.restartAttempts < this.maxRestartAttempts) {
                    this.restartAttempts++;
                    logger.info(LOG_CAT, `Attempting restart (${this.restartAttempts}/${this.maxRestartAttempts})`);
                    setTimeout(() => this.start(), 2000);
                }
            });

            this.process.on('error', (error) => {
                logger.error(LOG_CAT, 'Proxy process error:', error);
                this.isRunning = false;
            });

            // Wait for proxy to be ready
            await this.waitForReady();

            this.isRunning = true;
            this.isOwner = true; // Mark that THIS window owns the proxy
            this.restartAttempts = 0;
            this.startHealthCheck();

            logger.info(LOG_CAT, `MCP Proxy started on port ${this.port} (owner: true)`);
            return true;

        } catch (error) {
            logger.error(LOG_CAT, 'Failed to start proxy:', error);
            return false;
        }
    }

    /**
     * Stop the MCP Proxy Server
     */
    public async stop(): Promise<void> {
        this.stopHealthCheck();

        if (this.process) {
            logger.info(LOG_CAT, 'Stopping MCP Proxy...');
            this.process.kill('SIGTERM');

            // Force kill after 5 seconds
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
            }, 5000);

            this.process = null;
        }

        this.isRunning = false;
    }

    /**
     * Get the path to the proxy entry point
     */
    private getProxyPath(): string | null {
        // Look for the compiled proxy
        const extensionPath = this.context.extensionPath;
        const proxyPath = path.join(extensionPath, 'mcp-proxy', 'dist', 'index.js');

        // Check if it exists
        const fs = require('fs');
        if (fs.existsSync(proxyPath)) {
            return proxyPath;
        }

        logger.warn(LOG_CAT, `Proxy not found at ${proxyPath}`);
        return null;
    }

    /**
     * Wait for proxy to be ready (with timeout)
     */
    private async waitForReady(timeout = 10000): Promise<void> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            try {
                const status = await this.getStatus();
                if (status?.running) {
                    return;
                }
            } catch {
                // Not ready yet
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        throw new Error('Proxy failed to start within timeout');
    }

    /**
     * Get proxy status
     */
    public async getStatus(): Promise<ProxyStatus | null> {
        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${this.port}/status`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(null);
                    }
                });
            });

            req.on('error', () => resolve(null));
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(null);
            });
        });
    }

    /**
     * Check proxy health
     */
    public async isHealthy(): Promise<boolean> {
        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${this.port}/health`, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => resolve(false));
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    /**
     * Start periodic health checks
     */
    private startHealthCheck(): void {
        this.stopHealthCheck();

        this.healthCheckInterval = setInterval(async () => {
            const healthy = await this.isHealthy();
            if (!healthy && this.isRunning) {
                logger.warn(LOG_CAT, 'Proxy health check failed');
                // The exit handler will trigger restart
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Stop health checks
     */
    private stopHealthCheck(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }
    }

    /**
     * Send an MCP request through the proxy
     */
    public async sendRequest<T>(
        method: string,
        params: Record<string, unknown> = {}
    ): Promise<T> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath = workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        const workspaceId = this.getWorkspaceId(workspacePath);

        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now().toString(),
                method,
                params
            });

            const req = http.request({
                hostname: '127.0.0.1',
                port: this.port,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    'X-Workspace-ID': workspaceId,
                    'X-Workspace-Path': workspacePath
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        if (response.error) {
                            reject(new Error(response.error.message));
                        } else {
                            resolve(response.result);
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(data);
            req.end();
        });
    }

    /**
     * Generate a stable workspace ID from path
     */
    private getWorkspaceId(workspacePath: string): string {
        // Simple hash of the path
        let hash = 0;
        for (let i = 0; i < workspacePath.length; i++) {
            const char = workspacePath.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `ws_${Math.abs(hash).toString(16)}`;
    }

    /**
     * Get the proxy port
     */
    public getPort(): number {
        return this.port;
    }

    /**
     * Check if proxy is running
     */
    public isProxyRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.stop();
    }
}
