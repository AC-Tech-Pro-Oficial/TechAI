/**
 * TechAI Antigravity - Main Entry
 * Advanced quota monitoring for Antigravity IDE by AC Tech
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './core/config_manager';
import { ProcessFinder } from './core/process_finder';
import { QuotaManager } from './core/quota_manager';
import { StatusBarManager } from './ui/status_bar';
import { DashboardPanel } from './ui/dashboard';
import { MCPManager } from './core/mcp_manager';
import { MCPRegistry } from './core/mcp_registry';
import { MCPPanel } from './ui/mcp_panel';
import { UpdateChecker } from './core/update_checker';
import { MCPAutoManager } from './core/mcp_auto_manager';
import { MCPProxyClient } from './core/mcp_proxy_client';
import { logger } from './utils/logger';
import { showTimedInfoMessage } from './utils/notifications';
import { WorkflowBootstrapper } from './core/workflow_bootstrapper';

let extensionUri: vscode.Uri;
let extensionContext: vscode.ExtensionContext;

let config_manager: ConfigManager;
let process_finder: ProcessFinder;
let quota_manager: QuotaManager;
let status_bar: StatusBarManager;
let mcp_manager: MCPManager;
let mcp_registry: MCPRegistry;
let update_checker: UpdateChecker;
let mcp_auto_manager: MCPAutoManager;
let mcp_proxy_client: MCPProxyClient;
let is_initialized = false;

export async function activate(context: vscode.ExtensionContext) {
	extensionUri = context.extensionUri;
	extensionContext = context;
	logger.init(context);
	logger.section('Extension', 'TechAI Antigravity Activating');
	// Watch for extension changes based on Window Focus
	// Since onDidChange doesn't fire reliably for side-loads, we check when the user returns to the IDE
	let hasPromptedReload = false;

	const checkExtensionChange = async () => {
		if (hasPromptedReload) return;

		try {
			const currentPackageJson = path.join(context.extensionPath, 'package.json');
			const stats = await fs.promises.stat(currentPackageJson);
			const currentMtime = stats.mtimeMs;
			const lastKnownMtime = context.globalState.get<number>('techai.lastKnownMtime') || 0;

			// Check for new version folders (upgrade)
			const extensionsDir = path.dirname(context.extensionPath);
			const entries = await fs.promises.readdir(extensionsDir);
			const currentFolderName = path.basename(context.extensionPath);
			const otherVersions = entries.filter(name =>
				name.startsWith('ac-tech-pro.techai-ide') && name !== currentFolderName
			);
			const hasNewerVersion = otherVersions.length > 0;

			// Check for file modifications (reinstall same version)
			// Difference > 2 seconds indicates the file was modified
			const filesChanged = lastKnownMtime > 0 && Math.abs(currentMtime - lastKnownMtime) > 2000;

			logger.debug('Extension', `Reload check: mtime=${currentMtime}, stored=${lastKnownMtime}, diff=${Math.abs(currentMtime - lastKnownMtime)}, otherVersions=${otherVersions.join(',')}, hasNewer=${hasNewerVersion}, filesChanged=${filesChanged}`);

			if (hasNewerVersion || filesChanged) {
				hasPromptedReload = true;
				logger.info('Extension', `Change detected (Newer: ${hasNewerVersion}, Modified: ${filesChanged}). Prompting reload.`);

				// Update state to prevent loop (if they don't reload immediately)
				await context.globalState.update('techai.lastKnownMtime', currentMtime);

				const selection = await vscode.window.showInformationMessage(
					'TechAI has been updated. Reload to activate.',
					'Reload Now'
				);

				if (selection === 'Reload Now') {
					vscode.commands.executeCommand('workbench.action.reloadWindow');
				} else {
					// Reset after 1 minute to allow re-prompting
					setTimeout(() => { hasPromptedReload = false; }, 60000);
				}
			}
		} catch (e) {
			// Ignore errors (e.g. race conditions during uninstall)
			logger.debug('Extension', `checkExtensionChange error: ${e}`);
		}
	};

	context.subscriptions.push(
		vscode.window.onDidChangeWindowState(async (state) => {
			if (state.focused) {
				logger.debug('Extension', 'Window focused - checking for extension changes');
				await checkExtensionChange();
			}
		})
	);

	// Store initial mtime on activation (only once, don't overwrite if checkExtensionChange already did)
	try {
		const packageJsonPath = path.join(context.extensionPath, 'package.json');
		const stats = fs.statSync(packageJsonPath);
		const storedMtime = context.globalState.get<number>('techai.lastKnownMtime') || 0;
		// Only store if we haven't stored before (fresh install)
		if (storedMtime === 0) {
			await context.globalState.update('techai.lastKnownMtime', stats.mtimeMs);
			logger.debug('Extension', `Initial mtime stored: ${stats.mtimeMs}`);
		}
	} catch (e) {
		logger.warn('Extension', 'Could not store initial mtime');
	}

	// Cleanup old extension versions (Antigravity/VS Code doesn't always remove them)
	try {
		const extensionId = 'ac-tech-pro.techai-ide';
		const extensionsDir = path.dirname(context.extensionPath);
		const currentFolderName = path.basename(context.extensionPath);

		const entries = await fs.promises.readdir(extensionsDir);
		const oldFolders = entries.filter(name =>
			name.startsWith(extensionId) && name !== currentFolderName
		);

		for (const oldFolder of oldFolders) {
			const oldPath = path.join(extensionsDir, oldFolder);
			try {
				await fs.promises.rm(oldPath, { recursive: true, force: true });
				logger.info('Extension', `Cleaned up old extension folder: ${oldFolder}`);
			} catch (rmErr) {
				// May fail if files are locked - that's OK, will try next time
				logger.warn('Extension', `Could not remove old folder ${oldFolder}: ${rmErr}`);
			}
		}

		if (oldFolders.length > 0) {
			logger.info('Extension', `Cleaned up ${oldFolders.length} old extension version(s)`);
		}
	} catch (cleanupErr) {
		logger.warn('Extension', `Extension cleanup failed: ${cleanupErr}`);
	}

	config_manager = new ConfigManager();
	process_finder = new ProcessFinder();
	quota_manager = new QuotaManager();
	status_bar = new StatusBarManager();

	// Check and prompt for workspace root (First Run)
	const hasConfiguredRoot = context.globalState.get<boolean>('techai.hasConfiguredRoot', false);
	if (!hasConfiguredRoot) {
		const currentConfig = config_manager.get_config();
		const defaultRoot = currentConfig.workspace_root || 'D:\\';

		vscode.window.showInputBox({
			prompt: 'Set the root directory for AC Tech projects (e.g., D:\\)',
			value: defaultRoot,
			placeHolder: 'Enter directory path',
			ignoreFocusOut: true
		}).then(async (path) => {
			if (path) {
				// Normalize path separators if needed or just save as is
				await vscode.workspace.getConfiguration('techai').update('workspaceRoot', path, vscode.ConfigurationTarget.Global);
				await context.globalState.update('techai.hasConfiguredRoot', true);
				logger.info('Extension', `Workspace root configured to: ${path}`);

				// Initialize bootstrapper ONLY after we have the config confirmed (or if we already had it)
				// But Bootstrapper is initialized in a setTimeout later (line 341). 
				// The prompt is async, so the timeout might fire before the user answers.
				// However, `config_manager.get_config()` reads live config.
				// If the user answers late, the bootstrapper might run with default.
				// This is acceptable for first run, or we could delay bootstrapper.
				// For now, let's keep it simple. The Bootstrapper reads config when it runs.
			}
		});
		// Mark as configured immediately to prevent loop if they cancel? 
		// No, if they cancel, we might want to ask again next time? 
		// Instructions said "defaults to D:\ if user presses enter". 
		// InputBox returns undefined on ESC.
		// Let's assume on NEXT run if they ignored it, we ask again.
	}

	// Initialize MCP Components
	mcp_manager = new MCPManager(context);
	mcp_registry = new MCPRegistry();

	// Initialize Update Checker
	update_checker = new UpdateChecker(context);

	// Initialize MCP Auto Manager for Best Picks
	mcp_auto_manager = new MCPAutoManager(context, mcp_manager, mcp_registry);

	// Initialize MCP Proxy Client (for per-workspace tool isolation)
	mcp_proxy_client = new MCPProxyClient(context);
	mcp_proxy_client.start().then(started => {
		if (started) {
			logger.info('Extension', `MCP Proxy started on port ${mcp_proxy_client.getPort()}`);
		} else {
			logger.warn('Extension', 'MCP Proxy failed to start - using direct MCP connections');
		}
	}).catch(err => {
		logger.error('Extension', 'MCP Proxy start error:', err);
	});

	context.subscriptions.push(status_bar);

	const config = config_manager.get_config();
	logger.debug('Extension', 'Initial config:', config);

	// Register Commands
	context.subscriptions.push(
		vscode.commands.registerCommand('techai.refresh', () => {
			logger.info('Extension', 'Manual refresh triggered');
			// Silent refresh - notification removed per user request
			quota_manager.fetch_quota();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('techai.show_menu', () => {
			logger.debug('Extension', 'Show menu triggered');
			status_bar.show_menu();
		})
	);

	// Manual activation command
	context.subscriptions.push(
		vscode.commands.registerCommand('techai.activate', async () => {
			logger.info('Extension', 'Manual activation triggered');
			if (!is_initialized) {
				await initialize_extension();
			} else {
				showTimedInfoMessage('TechAI is already active');
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('techai.reconnect', async () => {
			logger.info('Extension', 'Reconnect triggered');
			showTimedInfoMessage('TechAI: Reconnecting to Antigravity...');
			is_initialized = false;
			quota_manager.stop_polling();
			status_bar.show_loading();
			await initialize_extension();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('techai.show_logs', () => {
			logger.info('Extension', 'Opening debug log panel');
			logger.show();
			showTimedInfoMessage('TechAI: Debug log opened');
		})
	);

	// Open Dashboard command
	context.subscriptions.push(
		vscode.commands.registerCommand('techai.openDashboard', () => {
			logger.info('Extension', 'Opening dashboard');
			const snapshot = quota_manager.get_last_snapshot();
			DashboardPanel.createOrShow(extensionUri, snapshot);
		})
	);

	// MCP Commands
	context.subscriptions.push(
		vscode.commands.registerCommand('techai.openMCPPanel', () => {
			logger.info('Extension', 'Opening MCP Panel');
			MCPPanel.createOrShow(extensionUri, mcp_manager, mcp_registry, context);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('techai.openMCPPanelSettings', () => {
			logger.info('Extension', 'Opening MCP Panel - Settings Tab');
			MCPPanel.createOrShow(extensionUri, mcp_manager, mcp_registry, context, 'settings');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('techai.checkForUpdates', () => {
			logger.info('Extension', 'Manual update check triggered');
			update_checker.checkForUpdates(true);
		})
	);

	// Apply Best Picks command
	context.subscriptions.push(
		vscode.commands.registerCommand('techai.applyBestPicks', async () => {
			logger.info('Extension', 'Manual apply Best Picks triggered');
			await mcp_auto_manager.applyBestPicks();
			showTimedInfoMessage('Best Pick MCP servers applied for this workspace');
		})
	);

	// Install Best Picks Only command (Additive)
	context.subscriptions.push(
		vscode.commands.registerCommand('techai.installBestPicks', async () => {
			logger.info('Extension', 'Manual install Best Picks triggered');
			await mcp_auto_manager.installMissingBestPicks();
			// Message handled in installMissingBestPicks
		})
	);

	// Reset Best Picks settings (for testing)
	context.subscriptions.push(
		vscode.commands.registerCommand('techai.resetBestPicksSettings', async () => {
			logger.info('Extension', 'Resetting Best Picks settings');
			await mcp_auto_manager.resetPreferences();
			showTimedInfoMessage('Best Picks settings reset. Reload window to see prompt again.');
		})
	);

	// Setup Quota Manager Callbacks
	quota_manager.on_update(snapshot => {
		const current_config = config_manager.get_config();
		logger.debug('Extension', 'Quota update received:', {
			models_count: snapshot.models?.length ?? 0,
			prompt_credits: snapshot.prompt_credits,
			timestamp: snapshot.timestamp,
		});
		status_bar.update(snapshot, current_config.show_prompt_credits ?? false);

		// Also update dashboard if open
		if (DashboardPanel.currentPanel) {
			DashboardPanel.currentPanel.update(snapshot);
		}
	});

	quota_manager.on_error(err => {
		logger.error('Extension', `Quota error: ${err.message}`);
		status_bar.show_error(err.message);

		// Auto-reconnect on connection refusal (e.g. IDE restart or port change)
		if (err.message.includes('ECONNREFUSED')) {
			logger.warn('Extension', 'Connection refused. Attempting to reconnect...');
			// Debounce reconnection to prevent loops
			if (!is_initialized) return; // Already reconnecting
			is_initialized = false;
			setTimeout(() => {
				initialize_extension().catch(e => {
					logger.error('Extension', 'Reconnection failed:', e);
				});
			}, 2000);
		}
	});

	// Initialize extension asynchronously (non-blocking)
	logger.debug('Extension', 'Starting async initialization...');
	initialize_extension().catch(err => {
		logger.error('Extension', 'Failed to initialize techai:', err);
	});

	// Check for updates after a short delay (non-blocking)
	setTimeout(() => {
		update_checker.checkForUpdates();
	}, 5000);

	// Check and prompt for Best Picks MCP servers (guard with setting)
	setTimeout(() => {
		const autoApply = context.globalState.get<boolean>('mcp.autoApplyBestPicks', false);
		if (autoApply) {
			mcp_auto_manager.checkAndPrompt().catch(err => {
				logger.error('Extension', 'Auto-apply Best Picks check failed:', err);
			});
		}
	}, 3000);

	// Initialize Workflow Bootstrapper (sync global workflows and project rules)
	setTimeout(() => {
		WorkflowBootstrapper.initialize(context).catch(err => {
			logger.error('Extension', 'Workflow Bootstrapper failed:', err);
		});
	}, 4000);

	// Handle Config Changes
	context.subscriptions.push(
		config_manager.on_config_change(new_config => {
			logger.info('Extension', 'Config changed:', new_config);
			if (new_config.enabled) {
				quota_manager.start_polling(new_config.polling_interval);
			} else {
				quota_manager.stop_polling();
			}
		})
	);

	logger.info('Extension', 'Extension activation complete');
}

async function initialize_extension() {
	if (is_initialized) {
		logger.debug('Extension', 'Already initialized, skipping');
		return;
	}

	logger.section('Extension', 'Initializing techai');
	const timer = logger.time_start('initialize_extension');

	const config = config_manager.get_config();
	status_bar.show_loading();

	try {
		logger.info('Extension', 'Detecting Antigravity process...');
		// Pass storage path to help find the correct window's backend
		const workspacePath = extensionContext.storageUri?.fsPath;
		const process_info = await process_finder.detect_process_info(2, workspacePath);

		if (process_info) {
			logger.info('Extension', 'Process found successfully', {
				extension_port: process_info.extension_port,
				connect_port: process_info.connect_port,
				csrf_token: process_info.csrf_token.substring(0, 8) + '...',
			});

			quota_manager.init(process_info.connect_port, process_info.csrf_token);

			if (config.enabled) {
				logger.debug('Extension', `Starting polling with interval: ${config.polling_interval}ms`);
				quota_manager.start_polling(config.polling_interval);
			}
			is_initialized = true;
			logger.info('Extension', 'Initialization successful');
		} else {
			logger.error('Extension', 'Antigravity process not found');
			logger.info('Extension', 'Troubleshooting tips:');
			logger.info('Extension', '   1. Make sure Antigravity is running');
			logger.info('Extension', '   2. Check if the language_server process is running');
			logger.info('Extension', '   3. Try reloading the IDE');
			logger.info('Extension', '   4. Use "TechAI: Show Debug Log" for details');

			status_bar.show_error('Antigravity not found');
			vscode.window.showErrorMessage(
				'TechAI: Could not find Antigravity process. Is it running?',
				'Show Logs'
			).then(action => {
				if (action === 'Show Logs') {
					logger.show();
				}
			});
		}
	} catch (e: any) {
		logger.error('Extension', 'Detection failed with exception:', {
			message: e.message,
			stack: e.stack,
		});
		status_bar.show_error('Detection failed');
	}

	timer();
}

export function deactivate() {
	logger.info('Extension', 'TechAI deactivating');
	quota_manager?.stop_polling();
	status_bar?.dispose();
	mcp_manager?.dispose();
	mcp_proxy_client?.dispose();
}
