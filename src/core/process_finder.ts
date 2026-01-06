/**
 * Process Finder Service
 * Refactored to use spawn with {shell: false} to avoid quote escaping issues
 * when running from D:\ root directory on Windows.
 * Updated to iterate through ALL candidate processes to find the correct window's backend.
 */

import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import * as https from 'https';
import * as process from 'process';
import { logger } from '../utils/logger';

// Windows absolute paths for system commands
const WIN_SYS32 = 'C:\\Windows\\System32';
const WIN_POWERSHELL = `${WIN_SYS32}\\WindowsPowerShell\\v1.0\\powershell.exe`;

export interface process_info {
	extension_port: number;
	connect_port: number;
	csrf_token: string;
}

interface parsed_process_info {
	pid: number;
	ppid: number; // Added to identify parent process (VS Code Extension Host)
	extension_port: number;
	csrf_token: string;
	commandLine: string; // Added to help filter by workspace path
}

const LOG_CAT = 'ProcessFinder';

/**
 * Execute a command using spawn with {shell: false}
 * This avoids all shell quote escaping issues
 */
async function spawn_async(
	cmd: string,
	args: string[],
	options?: SpawnOptionsWithoutStdio
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		logger.debug(LOG_CAT, `spawn: ${cmd} ${args.map(a => `"${a}"`).join(' ')}`);

		const child = spawn(cmd, args, options);
		let stdout = '';
		let stderr = '';

		child.stdout?.on('data', data => {
			stdout += data.toString();
		});

		child.stderr?.on('data', data => {
			stderr += data.toString();
		});

		child.on('close', code => {
			if (code === 0 || stdout.length > 0) {
				resolve({ stdout, stderr });
			} else {
				reject(new Error(`Process exited with code ${code}: ${stderr}`));
			}
		});

		child.on('error', err => {
			reject(err);
		});
	});
}

/**
 * Normalizes a path for comparison:
 * 1. Lowercase
 * 2. Replace backslashes with forward slashes
 * 3. Trim trailing slashes
 */
function normalizePath(p: string): string {
	return p.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
}

export class ProcessFinder {
	private process_name: string;

	constructor() {
		logger.debug(LOG_CAT, `Initializing ProcessFinder for platform: ${process.platform}, arch: ${process.arch}`);

		if (process.platform === 'win32') {
			this.process_name = 'language_server_windows_x64.exe';
		} else if (process.platform === 'darwin') {
			this.process_name = `language_server_macos${process.arch === 'arm64' ? '_arm' : ''}`;
		} else {
			this.process_name = `language_server_linux${process.arch === 'arm64' ? '_arm' : '_x64'}`;
		}

		logger.info(LOG_CAT, `Target process name: ${this.process_name}`);
	}

	/**
	 * Detects the backend process info.
	 * @param max_retries Number of attempts
	 * @param workspacePath Optional path to filtering candidates. Usually context.storageUri.fsPath
	 */
	async detect_process_info(max_retries: number = 2, workspacePath?: string): Promise<process_info | null> {
		logger.section(LOG_CAT, `Starting process detection (max_retries: ${max_retries})`);
		if (workspacePath) {
			logger.debug(LOG_CAT, `Filtering for workspace path: ${workspacePath}`);
		}

		const timer = logger.time_start('detect_process_info');
		const myParentPid = process.ppid; // The VS Code Extension Host PID
		logger.info(LOG_CAT, `Extension Host PID: ${process.pid}, Parent PID: ${myParentPid}`);

		for (let i = 0; i < max_retries; i++) {
			logger.debug(LOG_CAT, `Attempt ${i + 1}/${max_retries}`);

			try {
				// Get ALL candidate processes
				const candidates = await this.get_process_candidates();

				if (candidates.length === 0) {
					logger.debug(LOG_CAT, 'No Antigravity candidates found');
					await this.sleep(200);
					continue;
				}

				logger.info(LOG_CAT, `Found ${candidates.length} candidate process(es).`);

				// Sort candidates:
				// Priority 1: Sibling Process (Same PPID) - STRONGEST SIGNAL
				// Priority 2: Workspace Path Match (URI Encoded check)
				const sortedCandidates = candidates.sort((a, b) => {
					// 1. PPID Match
					const aSibling = a.ppid === myParentPid;
					const bSibling = b.ppid === myParentPid;

					if (aSibling && !bSibling) return -1;
					if (!aSibling && bSibling) return 1;

					// 2. Workspace Path Match
					if (workspacePath) {
						// Normalize paths
						const normWorkspace = normalizePath(workspacePath);
						// Create basename check (e.g. "Research Results")
						const workspaceBase = normWorkspace.split('/').pop() || '';

						const cmdA = a.commandLine.toLowerCase();
						const cmdB = b.commandLine.toLowerCase();

						// Check for encoded match in command line (e.g. "Research_20Results")
						// We don't fully decode cmd line, just check if it contains parts of workspace
						const aMatch = cmdA.includes(normWorkspace) || (workspaceBase && cmdA.includes(workspaceBase));
						const bMatch = cmdB.includes(normWorkspace) || (workspaceBase && cmdB.includes(workspaceBase));

						if (aMatch && !bMatch) return -1;
						if (!aMatch && bMatch) return 1;
					}

					return 0;
				});

				const sortOrder = sortedCandidates.map(c => `PID:${c.pid}(Sibling:${c.ppid === myParentPid})`).join(', ');
				logger.info(LOG_CAT, `Testing Order: ${sortOrder}`);

				// Iterate through sorted candidates
				for (const info of sortedCandidates) {
					// STRICT CHECK: If we found a sibling, we ONLY want to connect to siblings.
					// Connecting to a non-sibling when a sibling exists is high risk of hijacking.
					const hasSibling = sortedCandidates.some(c => c.ppid === myParentPid);
					const isSibling = info.ppid === myParentPid;

					if (hasSibling && !isSibling) {
						logger.debug(LOG_CAT, `Skipping PID ${info.pid} (Not a sibling, but a sibling exists)`);
						continue;
					}

					// PATH CHECK: If no sibling, but we have a strong path match, prefer that.
					if (!hasSibling && workspacePath) {
						const normWorkspace = normalizePath(workspacePath);
						const workspaceBase = normWorkspace.split('/').pop() || '';

						const cmd = info.commandLine.toLowerCase();
						const isPathMatch = cmd.includes(normWorkspace) || (workspaceBase && cmd.includes(workspaceBase));

						// If this candidate is NOT a match, but another candidate IS a match, skip this one.
						const anyPathMatch = sortedCandidates.some(c => {
							const cCmd = c.commandLine.toLowerCase();
							return cCmd.includes(normWorkspace) || (workspaceBase && cCmd.includes(workspaceBase));
						});

						if (anyPathMatch && !isPathMatch) {
							logger.debug(LOG_CAT, `Skipping PID ${info.pid} (Path mismatch, better candidate exists)`);
							continue;
						}
					}

					logger.debug(LOG_CAT, `Testing candidate [PID: ${info.pid}]`, {
						extension_port: info.extension_port,
					});

					const ports = await this.get_listening_ports(info.pid);
					logger.debug(LOG_CAT, `PID ${info.pid} listening on: [${ports.join(', ')}]`);

					if (ports.length > 0) {
						const valid_port = await this.find_working_port(ports, info.csrf_token);

						if (valid_port) {
							logger.info(LOG_CAT, `SUCCESS: Connected to PID ${info.pid} on port ${valid_port}`);
							timer();
							return {
								extension_port: info.extension_port,
								connect_port: valid_port,
								csrf_token: info.csrf_token,
							};
						}
					}
				}

				logger.warn(LOG_CAT, `Attempt ${i + 1}: Tested ${candidates.length} candidates, none responded.`);

			} catch (e: any) {
				logger.error(LOG_CAT, `Attempt ${i + 1} failed with error:`, { message: e.message });
			}

			if (i < max_retries - 1) {
				await this.sleep(500);
			}
		}

		logger.error(LOG_CAT, `Process detection failed after ${max_retries} attempt(s)`);
		timer();
		return null;
	}

	private async sleep(ms: number) {
		return new Promise(r => setTimeout(r, ms));
	}

	private async get_process_candidates(): Promise<parsed_process_info[]> {
		if (process.platform === 'win32') {
			return this.get_process_info_windows();
		}
		return this.get_process_info_unix();
	}

	private async get_process_info_windows(): Promise<parsed_process_info[]> {
		// Use PowerShell with spawn - no shell escaping needed!
		const psCommand = `Get-CimInstance Win32_Process -Filter "name='${this.process_name}'" | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json`;

		try {
			const { stdout } = await spawn_async(WIN_POWERSHELL, ['-NoProfile', '-Command', psCommand]);

			if (!stdout.trim()) {
				logger.debug(LOG_CAT, 'PowerShell returned empty output');
				return [];
			}

			let data;
			try {
				data = JSON.parse(stdout.trim());
			} catch (jsonErr) {
				logger.warn(LOG_CAT, 'Failed to parse PowerShell JSON output');
				return [];
			}

			if (!Array.isArray(data)) {
				data = [data];
			}

			// Filter for Antigravity processes
			const candidates: parsed_process_info[] = [];

			for (const proc of data) {
				const cmd = proc.CommandLine || '';
				const isAntigravity = (
					/--app_data_dir\s+antigravity\b/i.test(cmd) ||
					cmd.toLowerCase().includes('\\antigravity\\') ||
					cmd.toLowerCase().includes('/antigravity/')
				);

				if (isAntigravity) {
					const pid = proc.ProcessId;
					const portMatch = cmd.match(/--extension_server_port[=\s]+(\d+)/);
					const tokenMatch = cmd.match(/--csrf_token[=\s]+([a-f0-9-]+)/i);

					if (tokenMatch?.[1]) {
						candidates.push({
							pid,
							ppid: proc.ParentProcessId || 0,
							extension_port: portMatch?.[1] ? parseInt(portMatch[1], 10) : 0,
							csrf_token: tokenMatch[1],
							commandLine: cmd
						});
					}
				}
			}

			return candidates;
		} catch (e: any) {
			logger.error(LOG_CAT, `PowerShell command failed: ${e.message}`);
			return [];
		}
	}

	private async get_process_info_unix(): Promise<parsed_process_info[]> {
		const cmd = 'pgrep';
		// MacOS pgrep -fl includes the full command line, Linux pgrep -af does too
		const args = process.platform === 'darwin' ? ['-fl', this.process_name] : ['-af', this.process_name];
		const candidates: parsed_process_info[] = [];

		try {
			const { stdout } = await spawn_async(cmd, args);
			const lines = stdout.split('\n');

			for (const line of lines) {
				if (line.includes('--extension_server_port')) {
					const parts = line.trim().split(/\s+/);
					const pid = parseInt(parts[0], 10);
					const cmdLine = line.substring(parts[0].length).trim();

					const portMatch = cmdLine.match(/--extension_server_port[=\s]+(\d+)/);
					const tokenMatch = cmdLine.match(/--csrf_token[=\s]+([a-zA-Z0-9-]+)/);

					if (tokenMatch?.[1]) {
						candidates.push({
							pid,
							ppid: 0, // pgrep doesn't easily provide PPID in this simple format, not critical for Unix yet
							extension_port: portMatch ? parseInt(portMatch[1], 10) : 0,
							csrf_token: tokenMatch[1],
							commandLine: cmdLine
						});
					}
				}
			}
		} catch (e: any) {
			// pgrep usually returns exit code 1 if no process found, which spawns an error.
			// Currently we log it but returning empty list is fine.
			logger.debug(LOG_CAT, `pgrep check (may be empty): ${e.message}`);
		}
		return candidates;
	}

	private async get_listening_ports(pid: number): Promise<number[]> {
		if (process.platform === 'win32') {
			return this.get_listening_ports_windows(pid);
		}
		return this.get_listening_ports_unix(pid);
	}

	private async get_listening_ports_windows(pid: number): Promise<number[]> {
		// Use PowerShell with spawn
		const psCommand = `Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort | ConvertTo-Json`;

		try {
			const { stdout } = await spawn_async(WIN_POWERSHELL, ['-NoProfile', '-Command', psCommand]);

			if (!stdout.trim()) {
				return [];
			}

			let data;
			try {
				data = JSON.parse(stdout.trim());
			} catch {
				return [];
			}

			if (Array.isArray(data)) {
				return data.filter(p => typeof p === 'number').sort((a, b) => a - b);
			} else if (typeof data === 'number') {
				return [data];
			}
		} catch (e: any) {
			logger.debug(LOG_CAT, `PowerShell port detection failed: ${e.message}`);
		}
		return [];
	}

	private async get_listening_ports_unix(pid: number): Promise<number[]> {
		const ports: number[] = [];

		// Try lsof first
		try {
			const { stdout } = await spawn_async('lsof', ['-nP', '-a', '-iTCP', '-sTCP:LISTEN', '-p', pid.toString()]);
			const regex = new RegExp(`^\\S+\\s+${pid}\\s+.*?(?:TCP|UDP)\\s+(?:\\*|[\\d.]+|\\[[\\da-f:]+\\]):(\\d+)\\s+\\(LISTEN\\)`, 'gim');
			let match;
			while ((match = regex.exec(stdout)) !== null) {
				const port = parseInt(match[1], 10);
				if (!ports.includes(port)) {
					ports.push(port);
				}
			}
		} catch {
			// lsof not available, continue
		}

		return ports.sort((a, b) => a - b);
	}

	private async find_working_port(ports: number[], csrf_token: string): Promise<number | null> {
		for (const port of ports) {
			// Optimization: Prioritize likely ports if we knew them, but here we just try all
			const is_working = await this.test_port(port, csrf_token);

			if (is_working) {
				return port;
			}
		}
		return null;
	}

	private test_port(port: number, csrf_token: string): Promise<boolean> {
		return new Promise(resolve => {
			const options = {
				hostname: '127.0.0.1',
				port,
				path: '/exa.language_server_pb.LanguageServerService/GetUnleashData',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Codeium-Csrf-Token': csrf_token,
					'Connect-Protocol-Version': '1',
				},
				rejectUnauthorized: false,
				timeout: 2000, // Reduced timeout for faster scanning
			};

			const req = https.request(options, res => {
				let body = '';
				res.on('data', chunk => (body += chunk));
				res.on('end', () => {
					if (res.statusCode === 200) {
						try {
							JSON.parse(body);
							resolve(true); // Valid JSON response means it is our server
						} catch {
							resolve(false);
						}
					} else {
						resolve(false);
					}
				});
			});

			req.on('error', () => resolve(false));
			req.on('timeout', () => {
				req.destroy();
				resolve(false);
			});

			req.write(JSON.stringify({ wrapper_data: {} }));
			req.end();
		});
	}
}
