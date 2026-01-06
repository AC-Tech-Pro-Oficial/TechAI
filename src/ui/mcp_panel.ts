/**
 * TechAI Antigravity - MCP Panel
 * Webview-based UI for managing MCP servers and marketplace
 */

import * as vscode from 'vscode';
import { MCPManager } from '../core/mcp_manager';
import { MCPRegistry } from '../core/mcp_registry';
import { logger } from '../utils/logger';
import { MCPServersCollection, RegistryData, RegistryItem } from '../utils/mcp_types';
import { MCPRecommender } from '../core/recommender';
import { showTimedInfoMessage } from '../utils/notifications';

export class MCPPanel {
	public static currentPanel: MCPPanel | undefined;
	public static readonly viewType = 'techaiMCP';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	private _mcpManager: MCPManager;
	private _mcpRegistry: MCPRegistry;
	private _context: vscode.ExtensionContext;

	private _currentServers: MCPServersCollection = {};
	private _registryData: RegistryData | null = null;
	private _recommendedItems: RegistryItem[] = [];
	private _recommender: MCPRecommender;
	private _isInstallerBusy: boolean = false;

	public static createOrShow(
		extensionUri: vscode.Uri,
		mcpManager: MCPManager,
		mcpRegistry: MCPRegistry,
		context: vscode.ExtensionContext,
		initialTab?: string
	) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (MCPPanel.currentPanel) {
			MCPPanel.currentPanel._panel.reveal(column);
			if (initialTab) {
				MCPPanel.currentPanel.switchToTab(initialTab);
			}
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			MCPPanel.viewType,
			'MCP',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'assets')],
			}
		);

		MCPPanel.currentPanel = new MCPPanel(panel, extensionUri, mcpManager, mcpRegistry, context);

		// Switch to the requested tab after creation
		if (initialTab) {
			// Delay slightly to allow webview to initialize
			setTimeout(() => {
				MCPPanel.currentPanel?.switchToTab(initialTab);
			}, 100);
		}
	}

	/**
	 * Switch to a specific tab in the panel
	 */
	public switchToTab(tabId: string) {
		this._panel.webview.postMessage({ command: 'switchTab', tabId });
	}

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		mcpManager: MCPManager,
		mcpRegistry: MCPRegistry,
		context: vscode.ExtensionContext
	) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._mcpManager = mcpManager;
		this._mcpRegistry = mcpRegistry;
		this._context = context;
		this._recommender = new MCPRecommender();

		// Set the webview's initial html content
		const scriptUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'assets', 'main.js'));
		logger.info('MCPPanel', `Webview Script URI: ${scriptUri.toString()}`);
		this._panel.webview.html = this._getHtmlForWebview(scriptUri);

		// Listen for config changes
		this._mcpManager.on_config_change(async (event) => {
			this._currentServers = event.servers;
			await this._updateWebviewState();
		});

		// Listen for when the panel is disposed
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case 'refresh':
						await this._refreshData();
						break;
					case 'toggleServer':
						await this._mcpManager.toggle_server(message.id, message.enabled);
						showTimedInfoMessage(`MCP Server ${message.id} ${message.enabled ? 'enabled' : 'disabled'}`);
						break;
					case 'installServer':
						await this._installServer(message.repoUrl, message.name);
						break;
					case 'openLink':
						vscode.env.openExternal(vscode.Uri.parse(message.url));
						break;
					case 'editConfig':
						const doc = await vscode.workspace.openTextDocument(this._mcpManager.get_config_path());
						await vscode.window.showTextDocument(doc);
						break;
					case 'uninstallServer':
						const confirm = await vscode.window.showWarningMessage(
							`Are you sure you want to uninstall "${message.id}"? This will remove it from your MCP configuration.`,
							{ modal: true },
							'Uninstall'
						);
						if (confirm === 'Uninstall') {
							await this._mcpManager.remove_server(message.id);
							showTimedInfoMessage(`MCP Server "${message.id}" has been uninstalled.`);
							await this._refreshData();
						}
						break;
					case 'installBestPicks':
						await vscode.commands.executeCommand('techai.installBestPicks');
						break;
					case 'toggleAutoApply':
						await this._context.globalState.update('mcp.autoApplyBestPicks', message.value);
						// If enabled, immediately apply Best Picks via command
						if (message.value) {
							logger.info('MCPPanel', 'Auto-Apply enabled - triggering Best Picks application');
							await vscode.commands.executeCommand('techai.applyBestPicks');
						}
						// Refresh data to reflect new server states (not just updateWebviewState which uses stale data)
						await this._refreshData();
						break;
					case 'updateSetting':
						await this._context.globalState.update(message.key, message.value);
						logger.info('MCPPanel', `Setting updated: ${message.key} = ${message.value}`);
						await this._updateWebviewState(); // Sync all tabs
						break;
					case 'updateConfig':
						// Update VS Code workspace configuration
						const [section, setting] = message.key.split('.');
						await vscode.workspace.getConfiguration(section).update(setting, message.value, vscode.ConfigurationTarget.Global);
						logger.info('MCPPanel', `Config updated: ${message.key} = ${message.value}`);
						break;
					case 'showLogs':
						vscode.commands.executeCommand('workbench.action.output.toggleOutput');
						break;
					// ========== CONTEXT INJECTION HANDLERS ==========
					case 'updateContextSetting':
						const currentCtx = this._context.globalState.get<any>('context.injection', {});
						currentCtx[message.key] = message.value;
						await this._context.globalState.update('context.injection', currentCtx);
						logger.info('MCPPanel', `Context setting updated: ${message.key} = ${message.value}`);
						break;
					case 'addCustomContextFile':
						const ctxSettings = this._context.globalState.get<any>('context.injection', {});
						const files = ctxSettings.customFiles || [];
						if (!files.includes(message.filePath)) {
							files.push(message.filePath);
							ctxSettings.customFiles = files;
							await this._context.globalState.update('context.injection', ctxSettings);
							await this._updateWebviewState();
						}
						break;
					case 'removeCustomContextFile':
						const ctxSet = this._context.globalState.get<any>('context.injection', {});
						ctxSet.customFiles = (ctxSet.customFiles || []).filter((f: string) => f !== message.filePath);
						await this._context.globalState.update('context.injection', ctxSet);
						await this._updateWebviewState();
						break;
					// ========== CREDENTIALS HANDLERS ==========
					case 'saveCredential':
						await this._context.secrets.store(`mcp.credential.${message.serverId}`, message.value);
						logger.info('MCPPanel', `Credential saved for: ${message.serverId}`);
						showTimedInfoMessage(`${message.serverId} credential saved securely.`);
						break;
					case 'deleteCredential':
						await this._context.secrets.delete(`mcp.credential.${message.serverId}`);
						logger.info('MCPPanel', `Credential deleted for: ${message.serverId}`);
						break;
					// ========== LLM PROVIDERS HANDLERS ==========
					case 'toggleLLMProvider':
						const llmProviders = this._context.globalState.get<any[]>('llm.providers', []);
						const providerIdx = llmProviders.findIndex(p => p.id === message.providerId);
						if (providerIdx >= 0) {
							llmProviders[providerIdx].enabled = message.enabled;
						} else {
							llmProviders.push({ id: message.providerId, enabled: message.enabled });
						}
						await this._context.globalState.update('llm.providers', llmProviders);
						logger.info('MCPPanel', `LLM provider ${message.providerId} ${message.enabled ? 'enabled' : 'disabled'}`);
						break;
					case 'saveLLMKey':
						await this._context.secrets.store(`llm.apikey.${message.providerId}`, message.apiKey);
						logger.info('MCPPanel', `API key saved for LLM provider: ${message.providerId}`);
						showTimedInfoMessage(`${message.providerId} API key saved securely.`);
						break;
					case 'updateLLMProvider':
						const providers = this._context.globalState.get<any[]>('llm.providers', []);
						const idx = providers.findIndex(p => p.id === message.providerId);
						if (idx >= 0) {
							if (message.model) providers[idx].model = message.model;
							if (message.endpoint) providers[idx].endpoint = message.endpoint;
						} else {
							providers.push({
								id: message.providerId,
								model: message.model,
								endpoint: message.endpoint,
								enabled: false
							});
						}
						await this._context.globalState.update('llm.providers', providers);
						logger.info('MCPPanel', `LLM provider ${message.providerId} updated`);
						break;
				}
			},
			null,
			this._disposables
		);

		// Initial load
		this._refreshData();
	}

	private async _refreshData() {
		try {
			// Load configured servers
			logger.info('MCPPanel', 'Loading MCP servers...');
			this._currentServers = await this._mcpManager.get_servers();
			logger.info('MCPPanel', `Loaded ${Object.keys(this._currentServers).length} servers`);

			// Load Registry data
			this._panel.webview.postMessage({ command: 'setLoading', value: true });
			logger.info('MCPPanel', 'Fetching registry data...');
			this._registryData = await this._mcpRegistry.get_registry_data();
			logger.info('MCPPanel', `Registry loaded: ${this._registryData ? Object.keys(this._registryData).length : 0} entries`);

			if (this._registryData) {
				this._recommendedItems = await this._recommender.getRecommendations(this._registryData);
				logger.info('MCPPanel', `Recommendations: ${this._recommendedItems?.length || 0}`);
			}
			this._panel.webview.postMessage({ command: 'setLoading', value: false });

			await this._updateWebviewState();
		} catch (e: any) {
			logger.error('MCPPanel', `_refreshData failed: ${e.message}`);
		}
	}

	private async _updateWebviewState() {
		try {
			const vscodeConfig = vscode.workspace.getConfiguration('techai');

			// Get context injection settings
			const contextSettings = this._context.globalState.get<any>('context.injection', {
				includeReadme: true,
				includeManifest: true,
				includeGitignore: true,
				includeSystemContext: true,
				cacheTtlSeconds: 30,
				customFiles: []
			});

			// Get LLM providers with API key status
			let llmProviders = this._context.globalState.get<any[]>('llm.providers', []);
			if (!Array.isArray(llmProviders)) {
				logger.warn('MCPPanel', 'llm.providers in globalState is not an array, resetting to []');
				llmProviders = [];
			}

			const llmProvidersWithStatus = await Promise.all(
				['openai', 'anthropic', 'groq', 'openrouter', 'ollama', 'together'].map(async (id) => {
					const config = llmProviders.find(p => p.id === id) || { id, enabled: false };
					const hasApiKey = !!(await this._context.secrets.get(`llm.apikey.${id}`));
					return { ...config, hasApiKey };
				})
			);

			// Get credentials status
			const credentials = await Promise.all(
				['github', 'supabase', 'stripe', 'firebase'].map(async (id) => ({
					id,
					hasCredential: !!(await this._context.secrets.get(`mcp.credential.${id}`))
				}))
			);

			await this._panel.webview.postMessage({
				command: 'updateData',
				servers: this._currentServers || {},
				registry: this._registryData || [],
				recommended: this._recommendedItems || [],
				autoApplyEnabled: this._context.globalState.get('mcp.autoApplyBestPicks', false),
				settings: {
					autoApplyEnabled: this._context.globalState.get('mcp.autoApplyBestPicks', false),
					maxContextTokens: this._context.globalState.get('mcp.maxContextTokens', 50000),
					showBadges: this._context.globalState.get('mcp.showBadges', true),
					debugEnabled: this._context.globalState.get('mcp.debugLogging', false),
					configPath: this._mcpManager.get_config_path(),
					// VS Code config settings
					showGauges: vscodeConfig.get<boolean>('showGauges', true),
					showPromptCredits: vscodeConfig.get<boolean>('showPromptCredits', true)
				},
				contextSettings: contextSettings,
				llmProviders: llmProvidersWithStatus,
				credentials: credentials
			});
		} catch (error) {
			logger.error('MCPPanel', `Error updating webview state: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async _installServer(repoUrl: string, name: string) {
		if (this._isInstallerBusy) return;
		this._isInstallerBusy = true;
		this._panel.webview.postMessage({ command: 'setBusy', busy: true });

		try {
			// Extract simple name from repo URL for basic ID
			// e.g. https://github.com/user/repo -> repo
			const repoName = repoUrl.split('/').pop()?.replace('.git', '') || name.toLowerCase().replace(/\s+/g, '-');
			const id = repoName.replace(/[^a-zA-Z0-9-_]/g, '');

			logger.info('MCPPanel', `Installing ${name} (ID: ${id}) from ${repoUrl}`);

			const config = {
				command: 'npx',
				args: ['-y', repoUrl], // Heuristic: Try running repo directly with npx
				env: {}
			};

			const success = await this._mcpManager.install_server(id, config);

			if (success) {
				showTimedInfoMessage(`Installed ${name}. Please edit config to add required ENV variables.`);
				// Open config for user to edit env vars
				const doc = await vscode.workspace.openTextDocument(this._mcpManager.get_config_path());
				await vscode.window.showTextDocument(doc);
			} else {
				vscode.window.showErrorMessage(`Failed to install ${name}`);
			}

		} catch (e: any) {
			vscode.window.showErrorMessage(`Error installing server: ${e.message}`);
		} finally {
			this._isInstallerBusy = false;
			this._panel.webview.postMessage({ command: 'setBusy', busy: false });
		}
	}

	public dispose() {
		MCPPanel.currentPanel = undefined;
		this._panel.dispose();
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _getHtmlForWebview(scriptUri: vscode.Uri) {
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https: vscode-resource:; img-src https: data: vscode-resource:; font-src 'none';">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>MCP Integration</title>
			<style>
				:root {
					--bg-color: #0d1117;
					--card-bg: #161b22;
					--card-border: #30363d;
					--accent-color: #58a6ff;
					--text-primary: #c9d1d9;
					--text-secondary: #8b949e;
					--success-color: #238636;
					--glass-bg: rgba(22, 27, 34, 0.7);
					--glass-border: rgba(48, 54, 61, 0.5);
				}

				body {
					padding: 0;
					margin: 0;
					font-family: 'Segoe UI', 'Roboto', sans-serif;
					color: var(--text-primary);
					background-color: var(--bg-color);
					background-image: 
						radial-gradient(circle at 10% 20%, rgba(88, 166, 255, 0.05) 0%, transparent 20%),
						radial-gradient(circle at 90% 80%, rgba(35, 134, 54, 0.05) 0%, transparent 20%);
				}

				/* VS Code Scrollbar Styling */
				::-webkit-scrollbar {
					width: 10px;
					height: 10px;
				}
				::-webkit-scrollbar-thumb {
					background: #30363d;
					border-radius: 5px;
				}
				::-webkit-scrollbar-track {
					background: transparent;
				}

				.tabs {
					display: flex;
					background: rgba(13, 17, 23, 0.95);
					padding: 0 20px;
					backdrop-filter: blur(10px);
					position: sticky;
					top: 0;
					z-index: 100;
					border-bottom: 1px solid var(--card-border);
					gap: 20px;
				}

				.tab {
					padding: 16px 4px;
					cursor: pointer;
					border-bottom: 3px solid transparent;
					opacity: 0.6;
					transition: all 0.3s ease;
					font-weight: 600;
					font-size: 14px;
					letter-spacing: 0.5px;
					color: var(--text-secondary);
				}

				.tab:hover {
					opacity: 0.9;
					color: var(--text-primary);
				}

				.tab.active {
					border-bottom-color: var(--accent-color);
					opacity: 1;
					color: var(--accent-color);
				}

				.content {
					padding: 30px;
					max-width: 1200px;
					margin: 0 auto;
					min-height: calc(100vh - 60px);
					animation: fadeIn 0.4s ease-out;
				}

				@keyframes fadeIn {
					from { opacity: 0; transform: translateY(10px); }
					to { opacity: 1; transform: translateY(0); }
				}

				.hidden {
					display: none !important;
				}

				.header-bar {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 30px;
				}

				h2 {
					font-size: 1.5rem;
					font-weight: 300;
					margin: 0;
					color: var(--text-primary);
					letter-spacing: -0.5px;
				}

				/* Card Grid */
				.grid {
					display: grid;
					grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
					gap: 20px;
				}

				.card {
					background: var(--glass-bg);
					border: 1px solid var(--glass-border);
					border-radius: 12px;
					padding: 20px;
					position: relative;
					transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
					backdrop-filter: blur(12px);
					box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
					display: flex;
					flex-direction: column;
				}

				.card:hover {
					transform: translateY(-4px);
					box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
					border-color: var(--accent-color);
				}

				.card-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 12px;
				}

				.card-title {
					font-size: 1.1em;
					font-weight: 600;
					color: var(--text-primary);
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				/* Toggle Switch */
				.toggle-container {
					position: relative;
					width: 44px;
					height: 24px;
					cursor: pointer;
				}

				.toggle-chk {
					opacity: 0;
					width: 0;
					height: 0;
				}

				.toggle-track {
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background-color: #30363d;
					transition: .4s;
					border-radius: 34px;
				}

				.toggle-track:before {
					position: absolute;
					content: "";
					height: 18px;
					width: 18px;
					left: 3px;
					bottom: 3px;
					background-color: white;
					transition: .4s;
					border-radius: 50%;
				}

				.toggle-chk:checked + .toggle-track {
					background-color: var(--success-color);
				}

				.toggle-chk:checked + .toggle-track:before {
					transform: translateX(20px);
				}

				/* Tags */
				.card-meta {
					display: flex;
					flex-wrap: wrap;
					gap: 8px;
					margin-bottom: 16px;
				}

				.tag {
					background: rgba(88, 166, 255, 0.15);
					color: #79c0ff;
					padding: 4px 10px;
					border-radius: 20px;
					font-size: 0.75em;
					font-weight: 600;
					font-weight: 600;
					border: 1px solid rgba(88, 166, 255, 0.2);
					cursor: pointer;
					transition: all 0.2s;
				}

				.tag:hover {
					background: rgba(88, 166, 255, 0.3);
				}

				.tag.local { background: rgba(52, 211, 153, 0.15); color: #6ee7b7; border-color: rgba(52, 211, 153, 0.2); }
				.tag.local:hover { background: rgba(52, 211, 153, 0.3); }
				
				.tag.cloud { background: rgba(167, 139, 250, 0.15); color: #c4b5fd; border-color: rgba(167, 139, 250, 0.2); }
				.tag.cloud:hover { background: rgba(167, 139, 250, 0.3); }

				/* Active Filter Chips */
				.active-tags-container {
					display: flex;
					flex-wrap: wrap;
					gap: 8px;
					margin-bottom: 20px;
				}
				
				.tag-chip {
					background: var(--accent-color);
					color: white;
					padding: 4px 12px;
					border-radius: 16px;
					font-size: 0.85em;
					display: flex;
					align-items: center;
					gap: 6px;
					animation: fadeIn 0.2s;
					border: 1px solid rgba(255,255,255,0.1);
				}

				.tag-chip-remove {
					cursor: pointer;
					font-weight: bold;
					opacity: 0.7;
					font-size: 1.1em;
					line-height: 1;
				}

				.tag-chip-remove:hover {
					opacity: 1;
				}

				.active-tag-highlight {
					border: 1px solid var(--accent-color);
					background: rgba(88, 166, 255, 0.25);
					box-shadow: 0 0 0 1px var(--accent-color);
				}

				/* Best Pick Badge */
				.best-pick-badge {
					background: linear-gradient(135deg, #fbbf24, #f59e0b);
					color: #1a1a1a;
					padding: 3px 10px;
					border-radius: 12px;
					font-size: 0.7em;
					font-weight: 700;
					text-transform: uppercase;
					letter-spacing: 0.5px;
					display: inline-flex;
					align-items: center;
					gap: 4px;
					box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
				}

				.best-pick-badge::before {
					content: '★';
					font-size: 1.1em;
				}

				/* Server Toggle Switch */
				.server-toggle {
					display: flex;
					align-items: center;
					gap: 8px;
				}

				.toggle-switch {
					position: relative;
					width: 44px;
					height: 24px;
					background: rgba(255,255,255,0.1);
					border-radius: 12px;
					cursor: pointer;
					transition: all 0.3s;
				}

				.toggle-switch.enabled {
					background: var(--accent-color);
				}

				/* Checkbox-based toggle (for Auto-Apply) */
				.toggle-switch input[type="checkbox"] {
					opacity: 0;
					width: 0;
					height: 0;
				}

				.toggle-switch .slider {
					position: absolute;
					cursor: pointer;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background-color: rgba(255,255,255,0.1);
					transition: 0.3s;
					border-radius: 24px;
				}

				.toggle-switch .slider:before {
					position: absolute;
					content: "";
					height: 20px;
					width: 20px;
					left: 2px;
					bottom: 2px;
					background-color: white;
					transition: 0.3s;
					border-radius: 50%;
					box-shadow: 0 2px 4px rgba(0,0,0,0.2);
				}

				.toggle-switch input:checked + .slider {
					background-color: var(--success-color);
				}

				.toggle-switch input:checked + .slider:before {
					transform: translateX(20px);
				}

				.toggle-label {
					font-size: 0.8em;
					color: var(--text-secondary);
				}

				.card-desc {
					font-size: 0.9em;
					line-height: 1.5;
					color: var(--text-secondary);
					margin-bottom: 20px;
					flex-grow: 1;
					display: -webkit-box;
					-webkit-line-clamp: 3;
					-webkit-box-orient: vertical;
					overflow: hidden;
				}

				/* Buttons */
				.actions {
					display: flex;
					gap: 10px;
					margin-top: auto;
				}

				.btn {
					background: var(--accent-color);
					color: white;
					border: none;
					padding: 8px 16px;
					border-radius: 6px;
					cursor: pointer;
					font-weight: 600;
					font-size: 0.9em;
					transition: all 0.2s;
					flex: 1;
					text-align: center;
					text-decoration: none;
				}

				.btn:hover {
					filter: brightness(1.1);
					transform: translateY(-1px);
				}

				.btn.secondary {
					background: transparent;
					border: 1px solid var(--card-border);
					color: var(--text-primary);
				}

				.btn.secondary:hover {
					background: rgba(255, 255, 255, 0.05);
					border-color: var(--text-secondary);
				}

				/* Search */
				.search-container {
					position: relative;
					margin-bottom: 30px;
				}

				.search-box {
					width: 100%;
					padding: 14px 20px;
					background: var(--card-bg);
					border: 1px solid var(--card-border);
					border-radius: 8px;
					font-size: 1rem;
					color: var(--text-primary);
					transition: all 0.3s;
					box-sizing: border-box;
				}

				.search-box:focus {
					outline: none;
					border-color: var(--accent-color);
					box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
				}

				/* Section Dividers */
				.section-title {
					font-size: 1.1rem;
					color: var(--text-secondary);
					margin: 40px 0 20px;
					padding-bottom: 10px;
					border-bottom: 1px solid var(--card-border);
					text-transform: uppercase;
					letter-spacing: 1px;
					font-weight: 600;
				}
				
				/* Loading Overlay */
				.loading-overlay {
					position: fixed;
					top: 0; left: 0; right: 0; bottom: 0;
					background: rgba(13, 17, 23, 0.85);
					backdrop-filter: blur(5px);
					display: flex;
					flex-direction: column;
					justify-content: center;
					align-items: center;
					z-index: 1000;
					opacity: 1;
					transition: opacity 0.3s ease;
				}

				.loading-overlay.hidden {
					opacity: 0;
					pointer-events: none;
					visibility: hidden;
				}

				.spinner {
					width: 50px;
					height: 50px;
					border: 3px solid rgba(88, 166, 255, 0.3);
					border-radius: 50%;
					border-top-color: var(--accent-color);
					animation: spin 1s linear infinite;
					margin-bottom: 20px;
				}

				@keyframes spin {
					to { transform: rotate(360deg); }
				}

				.loading-text {
					font-size: 1.2em;
					color: var(--text-primary);
					font-weight: 300;
					letter-spacing: 1px;
				}

				/* Settings Tab Styles */
				.settings-section {
					background: var(--card-bg);
					border: 1px solid var(--card-border);
					border-radius: 12px;
					padding: 25px;
					margin-bottom: 20px;
				}

				.settings-row {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 15px 0;
					border-bottom: 1px solid var(--card-border);
				}

				.settings-row:last-child {
					border-bottom: none;
					padding-bottom: 0;
				}

				.settings-row:first-child {
					padding-top: 0;
				}

				.settings-label {
					flex: 1;
					padding-right: 20px;
				}

				/* Range Slider Styling */
				input[type="range"] {
					-webkit-appearance: none;
					height: 8px;
					background: rgba(255,255,255,0.1);
					border-radius: 4px;
					outline: none;
				}

				input[type="range"]::-webkit-slider-thumb {
					-webkit-appearance: none;
					width: 20px;
					height: 20px;
					background: var(--accent-color);
					border-radius: 50%;
					cursor: pointer;
					transition: transform 0.2s;
				}

				input[type="range"]::-webkit-slider-thumb:hover {
					transform: scale(1.1);
				}
			</style>
		</head>
		<body>
			<div class="tabs">
				<div class="tab active" id="tab-installed" onclick="switchTab('installed')">📦 Installed</div>
				<div class="tab" id="tab-recommended" onclick="switchTab('recommended')">✨ Recommended</div>
				<div class="tab" id="tab-marketplace" onclick="switchTab('marketplace')">🛍️ Marketplace</div>
				<div class="tab" id="tab-context" onclick="switchTab('context')">🧠 Context</div>
				<div class="tab" id="tab-credentials" onclick="switchTab('credentials')">🔑 Credentials</div>
				<div class="tab" id="tab-llm" onclick="switchTab('llm')">🤖 LLM Providers</div>
				<div class="tab" id="tab-settings" onclick="switchTab('settings')">⚙ Settings</div>
			</div>

			<!-- INSTALLED TAB -->
			<div id="installed" class="content">
				<div class="header-bar">
					<h2>Your Active Servers</h2>
					<div class="actions" style="width: auto; gap: 10px;">
						<button class="btn secondary" onclick="sendMessage('refresh')">Refetch</button>
						<button class="btn secondary" onclick="sendMessage('editConfig')">Edit Config</button>
					</div>
				</div>
				<div id="servers-list" class="grid">
					<!-- Servers injected here -->
				</div>
			</div>

			<!-- RECOMMENDED TAB -->
			<div id="recommended" class="content hidden">
				<div class="header-bar">
					<h2>Recommended for this Workspace</h2>
					<button class="btn secondary" onclick="sendMessage('refresh')" style="flex: 0 0 auto; width: auto;">Refresh</button>
				</div>
				<div id="recommended-list" class="grid">
					<!-- Recommendations injected here -->
				</div>
			</div>

			<!-- MARKETPLACE TAB -->
			<div id="marketplace" class="content hidden">
				<div class="header-bar">
					<h2>Discover New Tools</h2>
					<button class="btn secondary" onclick="sendMessage('refresh')" style="flex: 0 0 auto; width: auto;">Refresh Registry</button>
				</div>
				<div class="search-container">
					<input type="text" class="search-box" id="search" placeholder="Search servers by name or description..." oninput="filterMarketplace()">
				</div>
				<div id="active-tags" class="active-tags-container"></div>
				<div id="registry-list">
					<!-- Marketplace items injected here -->
				</div>
			</div>

			<!-- SETTINGS TAB -->
			<div id="settings" class="content hidden">
				<div class="header-bar">
					<h2>Extension Settings</h2>
				</div>
				<div style="max-width: 800px; margin: 0 auto; padding: 20px;">
					<!-- Monitoring Section -->
					<div class="settings-section">
						<h3 class="section-title" style="margin-top: 0;">📊 Monitoring</h3>
						<div class="settings-row">
							<div class="settings-label">
								<strong>Enable Auto Monitoring</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
									Automatically track AI quota usage in the background.
								</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="setting-enabled" checked onchange="updateSetting('enabled', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
						<div class="settings-row">
							<div class="settings-label">
								<strong>Polling Interval (seconds)</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
									How often to refresh quota data. Minimum: 30s, Recommended: 120s+
								</p>
							</div>
							<input type="number" id="setting-polling" value="120" min="30" 
								style="width: 80px; padding: 8px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 6px; color: var(--text-primary);"
								onchange="updateSetting('pollingInterval', parseInt(this.value))">
						</div>
						<div class="settings-row">
							<div class="settings-label">
								<strong>Auto Update</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
									Automatically download and install updates from GitHub Releases.
								</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="setting-auto-update" onchange="updateSetting('autoUpdate', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
					</div>

					<!-- Status Bar Section -->
					<div class="settings-section">
						<h3 class="section-title">📍 Status Bar</h3>
						<div class="settings-row">
							<div class="settings-label">
								<strong>Show Visual Gauges</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
									Display gauge icons for each model in the status bar.
								</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="setting-show-gauges" checked onchange="updateSetting('showGauges', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
						<div class="settings-row">
							<div class="settings-label">
								<strong>Show Prompt Credits</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
									Display prompt credits in the status bar.
								</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="setting-show-prompt-credits" onchange="updateSetting('showPromptCredits', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
					</div>

					<!-- MCP Automation Section -->
					<div class="settings-section">
						<h3 class="section-title">🚀 MCP Automation</h3>
						<div class="settings-row">
							<div class="settings-label">
								<strong>Auto-Apply Best Picks on Startup</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
									Automatically check and apply recommended MCP servers when you open a workspace.
								</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="setting-auto-apply" onchange="updateSetting('autoApply', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
					</div>

					<!-- Token Limit Section -->
					<div class="settings-section">
						<h3 class="section-title">📊 Context Token Limits</h3>
						<div class="settings-row" style="flex-direction: column; align-items: flex-start;">
							<div class="settings-label" style="margin-bottom: 15px;">
								<strong>Maximum MCP Context Tokens</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
									Limit the total tokens used by MCP tool definitions. Servers exceeding this limit will show a warning.
									Lower values prevent model context overload.
								</p>
							</div>
							<div style="width: 100%; display: flex; align-items: center; gap: 15px;">
								<input type="range" id="setting-max-tokens" min="10000" max="200000" step="5000" value="50000" 
									style="flex: 1; accent-color: var(--accent-color);"
									oninput="document.getElementById('token-display').textContent = (this.value/1000) + 'K'; updateSetting('maxTokens', parseInt(this.value));">
								<span id="token-display" style="min-width: 60px; text-align: right; font-weight: bold; color: var(--accent-color);">50K</span>
							</div>
							<div style="display: flex; justify-content: space-between; width: 100%; color: var(--text-secondary); font-size: 0.8em; margin-top: 5px;">
								<span>10K (Minimal)</span>
								<span>200K (Maximum)</span>
							</div>
						</div>
					</div>

					<!-- Display Section -->
					<div class="settings-section">
						<h3 class="section-title">🎨 Display</h3>
						<div class="settings-row">
							<div class="settings-label">
								<strong>Show Best Picks Badge</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
									Display the "★ Best Pick" badge on curated recommendations.
								</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="setting-show-badges" checked onchange="updateSetting('showBadges', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
					</div>

					<!-- Debug Section -->
					<div class="settings-section">
						<h3 class="section-title">🔧 Developer</h3>
						<div class="settings-row">
							<div class="settings-label">
								<strong>Enable Debug Logging</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
									Log detailed information to the Output panel for troubleshooting.
								</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="setting-debug" onchange="updateSetting('debug', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
						<div class="settings-row" style="margin-top: 15px;">
							<div class="settings-label">
								<strong>Configuration Path</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
									Location of your MCP configuration file.
								</p>
							</div>
							<code id="config-path" style="background: var(--card-bg); padding: 8px 12px; border-radius: 6px; font-size: 0.85em; color: var(--text-secondary); word-break: break-all;"></code>
						</div>
						<div style="margin-top: 20px;">
							<button class="btn secondary" onclick="sendMessage('editConfig')" style="width: auto;">
								📝 Edit Config File
							</button>
							<button class="btn secondary" onclick="sendMessage('showLogs')" style="width: auto; margin-left: 10px;">
								📋 View Logs
							</button>
						</div>
					</div>

					<!-- About Section -->
					<div class="settings-section" style="margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--card-border);">
						<div style="text-align: center; color: var(--text-secondary);">
							<p style="margin: 0; font-size: 1.1em; font-weight: 600; color: var(--text-primary);">TechAI</p>
							<p style="margin: 5px 0 0; font-size: 0.9em;">v<span id="version-display">1.7.2</span> by AC Tech</p>
						</div>
					</div>
				</div>
			</div>

			<!-- CONTEXT INJECTION TAB -->
			<div id="context" class="content hidden">
				<div class="header-bar">
					<h2>🧠 Agent Context Injection</h2>
				</div>
				<p style="color: var(--text-secondary); margin-bottom: 20px;">
					Configure what context is automatically injected into AI agent conversations. This helps agents understand your project better.
				</p>
				
				<div class="settings-section">
					<h3 class="section-title">📄 Automatic Context Sources</h3>
					<div class="settings-row">
						<div class="settings-label">
							<strong>Include README</strong>
							<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
								Automatically inject README.md content to help agents understand the project.
							</p>
						</div>
						<div class="server-toggle">
							<label class="toggle-switch">
								<input type="checkbox" id="ctx-readme" checked onchange="updateContextSetting('includeReadme', this.checked)">
								<span class="slider"></span>
							</label>
						</div>
					</div>
					<div class="settings-row">
						<div class="settings-label">
							<strong>Include Manifest</strong>
							<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
								Include package.json, pubspec.yaml, or pyproject.toml for dependency awareness.
							</p>
						</div>
						<div class="server-toggle">
							<label class="toggle-switch">
								<input type="checkbox" id="ctx-manifest" checked onchange="updateContextSetting('includeManifest', this.checked)">
								<span class="slider"></span>
							</label>
						</div>
					</div>
					<div class="settings-row">
						<div class="settings-label">
							<strong>Include .gitignore</strong>
							<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
								Help agents avoid suggesting ignored files or patterns.
							</p>
						</div>
						<div class="server-toggle">
							<label class="toggle-switch">
								<input type="checkbox" id="ctx-gitignore" checked onchange="updateContextSetting('includeGitignore', this.checked)">
								<span class="slider"></span>
							</label>
						</div>
					</div>
					<div class="settings-row">
						<div class="settings-label">
							<strong>Include System Context (Date/Time)</strong>
							<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
								<span style="color: #ffa500;">⚠️ CRITICAL:</span> Ensures agents know the current date and timezone.
							</p>
						</div>
						<div class="server-toggle">
							<label class="toggle-switch">
								<input type="checkbox" id="ctx-system" checked onchange="updateContextSetting('includeSystemContext', this.checked)">
								<span class="slider"></span>
							</label>
						</div>
					</div>
				</div>

				<div class="settings-section">
					<h3 class="section-title">⏱️ Cache Settings</h3>
					<div class="settings-row" style="flex-direction: column; align-items: flex-start;">
						<div class="settings-label" style="margin-bottom: 15px;">
							<strong>Context Cache TTL (seconds)</strong>
							<p style="color: var(--text-secondary); font-size: 0.85em; margin: 5px 0 0;">
								How long to cache workspace analysis before refreshing.
							</p>
						</div>
						<div style="width: 100%; display: flex; align-items: center; gap: 15px;">
							<input type="range" id="ctx-cache-ttl" min="10" max="300" step="10" value="30" 
								style="flex: 1; accent-color: var(--accent-color);"
								oninput="document.getElementById('cache-ttl-display').textContent = this.value + 's'; updateContextSetting('cacheTtlSeconds', parseInt(this.value));">
							<span id="cache-ttl-display" style="min-width: 50px; text-align: right; font-weight: bold; color: var(--accent-color);">30s</span>
						</div>
					</div>
				</div>

				<div class="settings-section">
					<h3 class="section-title">📁 Custom Context Files</h3>
					<p style="color: var(--text-secondary); font-size: 0.9em; margin-bottom: 15px;">
						Add custom files that should always be included in agent context (relative to workspace root).
					</p>
					<div id="custom-files-list" style="margin-bottom: 15px;">
						<!-- Custom files will be rendered here -->
					</div>
					<div style="display: flex; gap: 10px;">
						<input type="text" id="new-custom-file" placeholder="e.g., docs/ARCHITECTURE.md" 
							style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--card-bg); color: var(--text-primary);">
						<button class="btn secondary" onclick="addCustomFile()" style="width: auto;">+ Add</button>
					</div>
				</div>
			</div>

			<!-- CREDENTIALS TAB -->
			<div id="credentials" class="content hidden">
				<div class="header-bar">
					<h2>🔑 MCP Server Credentials</h2>
				</div>
				<p style="color: var(--text-secondary); margin-bottom: 20px;">
					Securely store API keys and tokens for MCP servers that require authentication. Keys are encrypted using VS Code's secure storage.
				</p>

				<div id="credentials-list" class="grid">
					<!-- Credentials will be rendered here -->
					<div class="card" style="padding: 20px;">
						<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
							<span style="font-size: 24px;">📦</span>
							<div>
								<strong>GitHub</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 2px 0 0;">GITHUB_TOKEN for repository access</p>
							</div>
							<span id="cred-github-status" class="status-badge" style="margin-left: auto; padding: 4px 10px; border-radius: 12px; font-size: 0.75em; background: var(--card-bg);">Not Set</span>
						</div>
						<div style="display: flex; gap: 10px;">
							<input type="password" id="cred-github" placeholder="ghp_xxxxxxxxxxxx" 
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
							<button class="btn secondary" onclick="saveCredential('github')" style="width: auto;">Save</button>
							<button class="btn" onclick="deleteCredential('github')" style="width: auto; background: transparent; color: #ff6b6b;">✕</button>
						</div>
					</div>

					<div class="card" style="padding: 20px;">
						<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
							<span style="font-size: 24px;">🗄️</span>
							<div>
								<strong>Supabase</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 2px 0 0;">Supabase service role key</p>
							</div>
							<span id="cred-supabase-status" class="status-badge" style="margin-left: auto; padding: 4px 10px; border-radius: 12px; font-size: 0.75em; background: var(--card-bg);">Not Set</span>
						</div>
						<div style="display: flex; gap: 10px;">
							<input type="password" id="cred-supabase" placeholder="eyJxxxxxxxxxxxx" 
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
							<button class="btn secondary" onclick="saveCredential('supabase')" style="width: auto;">Save</button>
							<button class="btn" onclick="deleteCredential('supabase')" style="width: auto; background: transparent; color: #ff6b6b;">✕</button>
						</div>
					</div>

					<div class="card" style="padding: 20px;">
						<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
							<span style="font-size: 24px;">💳</span>
							<div>
								<strong>Stripe</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 2px 0 0;">Stripe API key (use restricted key)</p>
							</div>
							<span id="cred-stripe-status" class="status-badge" style="margin-left: auto; padding: 4px 10px; border-radius: 12px; font-size: 0.75em; background: var(--card-bg);">Not Set</span>
						</div>
						<div style="display: flex; gap: 10px;">
							<input type="password" id="cred-stripe" placeholder="sk_xxxxxxxxxxxx" 
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
							<button class="btn secondary" onclick="saveCredential('stripe')" style="width: auto;">Save</button>
							<button class="btn" onclick="deleteCredential('stripe')" style="width: auto; background: transparent; color: #ff6b6b;">✕</button>
						</div>
					</div>

					<div class="card" style="padding: 20px;">
						<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
							<span style="font-size: 24px;">🔥</span>
							<div>
								<strong>Firebase</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 2px 0 0;">Firebase service account JSON</p>
							</div>
							<span id="cred-firebase-status" class="status-badge" style="margin-left: auto; padding: 4px 10px; border-radius: 12px; font-size: 0.75em; background: var(--card-bg);">Not Set</span>
						</div>
						<div style="display: flex; gap: 10px;">
							<input type="password" id="cred-firebase" placeholder="Path to service-account.json" 
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
							<button class="btn secondary" onclick="saveCredential('firebase')" style="width: auto;">Save</button>
							<button class="btn" onclick="deleteCredential('firebase')" style="width: auto; background: transparent; color: #ff6b6b;">✕</button>
						</div>
					</div>
				</div>
			</div>

			<!-- LLM PROVIDERS TAB -->
			<div id="llm" class="content hidden">
				<div class="header-bar">
					<h2>🤖 External LLM Providers</h2>
				</div>
				<p style="color: var(--text-secondary); margin-bottom: 10px;">
					Configure external LLM providers that can be used as sub-agents or tools. Enable providers and add your API keys.
				</p>
				<div style="background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
					<strong style="color: #ffa500;">💡 How It Works:</strong>
					<span style="color: var(--text-secondary);"> The main agent (Gemini/Claude) can call these providers as MCP tools for specialized tasks. Double tokens may apply when using sub-agents.</span>
				</div>

				<div id="llm-providers-list" class="grid">
					<!-- OpenAI -->
					<div class="card" style="padding: 20px;">
						<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
							<span style="font-size: 28px;">🤖</span>
							<div style="flex: 1;">
								<strong>OpenAI</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 2px 0 0;">GPT-4o, GPT-4 Turbo, GPT-3.5</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="llm-openai-enabled" onchange="toggleLLMProvider('openai', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
						<div style="display: flex; gap: 10px; margin-bottom: 10px;">
							<input type="password" id="llm-openai-key" placeholder="sk-xxxxxxxxxxxxxxxx" 
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
							<button class="btn secondary" onclick="saveLLMKey('openai')" style="width: auto;">Save</button>
						</div>
						<div style="display: flex; gap: 10px;">
							<select id="llm-openai-model" onchange="updateLLMModel('openai', this.value)"
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
								<option value="gpt-4o">GPT-4o (Recommended)</option>
								<option value="gpt-4o-mini">GPT-4o Mini (Faster)</option>
								<option value="gpt-4-turbo">GPT-4 Turbo</option>
								<option value="o1">O1 (Reasoning)</option>
								<option value="o1-mini">O1 Mini</option>
							</select>
						</div>
					</div>

					<!-- Anthropic -->
					<div class="card" style="padding: 20px;">
						<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
							<span style="font-size: 28px;">🧠</span>
							<div style="flex: 1;">
								<strong>Anthropic (Claude)</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 2px 0 0;">Claude 3.5 Sonnet, Claude 3 Opus</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="llm-anthropic-enabled" onchange="toggleLLMProvider('anthropic', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
						<div style="display: flex; gap: 10px; margin-bottom: 10px;">
							<input type="password" id="llm-anthropic-key" placeholder="sk-ant-xxxxxxxxxxxxxxxx" 
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
							<button class="btn secondary" onclick="saveLLMKey('anthropic')" style="width: auto;">Save</button>
						</div>
						<div style="display: flex; gap: 10px;">
							<select id="llm-anthropic-model" onchange="updateLLMModel('anthropic', this.value)"
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
								<option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Recommended)</option>
								<option value="claude-3-opus-20240229">Claude 3 Opus (Most Capable)</option>
								<option value="claude-3-haiku-20240307">Claude 3 Haiku (Fastest)</option>
							</select>
						</div>
					</div>

					<!-- Groq -->
					<div class="card" style="padding: 20px;">
						<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
							<span style="font-size: 28px;">⚡</span>
							<div style="flex: 1;">
								<strong>Groq</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 2px 0 0;">Llama 3.3 70B, Mixtral (Ultra Fast)</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="llm-groq-enabled" onchange="toggleLLMProvider('groq', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
						<div style="display: flex; gap: 10px; margin-bottom: 10px;">
							<input type="password" id="llm-groq-key" placeholder="gsk_xxxxxxxxxxxxxxxx" 
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
							<button class="btn secondary" onclick="saveLLMKey('groq')" style="width: auto;">Save</button>
						</div>
						<div style="display: flex; gap: 10px;">
							<select id="llm-groq-model" onchange="updateLLMModel('groq', this.value)"
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
								<option value="llama-3.3-70b-versatile">Llama 3.3 70B (Recommended)</option>
								<option value="llama-3.1-8b-instant">Llama 3.1 8B (Fastest)</option>
								<option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
							</select>
						</div>
					</div>

					<!-- OpenRouter -->
					<div class="card" style="padding: 20px;">
						<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
							<span style="font-size: 28px;">🌐</span>
							<div style="flex: 1;">
								<strong>OpenRouter</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 2px 0 0;">Access 100+ models via single API</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="llm-openrouter-enabled" onchange="toggleLLMProvider('openrouter', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
						<div style="display: flex; gap: 10px; margin-bottom: 10px;">
							<input type="password" id="llm-openrouter-key" placeholder="sk-or-xxxxxxxxxxxxxxxx" 
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
							<button class="btn secondary" onclick="saveLLMKey('openrouter')" style="width: auto;">Save</button>
						</div>
						<div style="display: flex; gap: 10px;">
							<input type="text" id="llm-openrouter-model" placeholder="anthropic/claude-3.5-sonnet" 
								onchange="updateLLMModel('openrouter', this.value)"
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
						</div>
					</div>

					<!-- Ollama -->
					<div class="card" style="padding: 20px;">
						<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
							<span style="font-size: 28px;">🏠</span>
							<div style="flex: 1;">
								<strong>Ollama (Local)</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 2px 0 0;">Run models locally (free, private)</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="llm-ollama-enabled" onchange="toggleLLMProvider('ollama', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
						<div style="display: flex; gap: 10px; margin-bottom: 10px;">
							<input type="text" id="llm-ollama-endpoint" placeholder="http://localhost:11434" value="http://localhost:11434"
								onchange="updateLLMEndpoint('ollama', this.value)"
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
						</div>
						<div style="display: flex; gap: 10px;">
							<input type="text" id="llm-ollama-model" placeholder="llama3.2" value="llama3.2"
								onchange="updateLLMModel('ollama', this.value)"
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
						</div>
					</div>

					<!-- Together AI -->
					<div class="card" style="padding: 20px;">
						<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
							<span style="font-size: 28px;">🔗</span>
							<div style="flex: 1;">
								<strong>Together AI</strong>
								<p style="color: var(--text-secondary); font-size: 0.85em; margin: 2px 0 0;">Llama 3.3, Qwen 2.5, DeepSeek</p>
							</div>
							<div class="server-toggle">
								<label class="toggle-switch">
									<input type="checkbox" id="llm-together-enabled" onchange="toggleLLMProvider('together', this.checked)">
									<span class="slider"></span>
								</label>
							</div>
						</div>
						<div style="display: flex; gap: 10px; margin-bottom: 10px;">
							<input type="password" id="llm-together-key" placeholder="xxxxxxxxxxxxxxxx" 
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
							<button class="btn secondary" onclick="saveLLMKey('together')" style="width: auto;">Save</button>
						</div>
						<div style="display: flex; gap: 10px;">
							<select id="llm-together-model" onchange="updateLLMModel('together', this.value)"
								style="flex: 1; padding: 10px; border: 1px solid var(--card-border); border-radius: 8px; background: var(--input-bg); color: var(--text-primary);">
								<option value="meta-llama/Llama-3.3-70B-Instruct-Turbo">Llama 3.3 70B Turbo</option>
								<option value="Qwen/Qwen2.5-72B-Instruct-Turbo">Qwen 2.5 72B Turbo</option>
								<option value="deepseek-ai/DeepSeek-V3">DeepSeek V3</option>
							</select>
						</div>
					</div>
				</div>
			</div>

			<div id="loading" class="loading-overlay hidden">
				<div class="spinner"></div>
				<div class="loading-text">PROCESSING</div>
			</div>

			<script src="${scriptUri}"></script>
		</body>
		</html>`.trim();
	}
}
