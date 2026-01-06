"use strict";
/**
 * TechAI MCP Proxy - Security Sandbox
 *
 * Validates tool calls to block potentially dangerous operations.
 * Disabled by default - must be explicitly enabled.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecuritySandbox = void 0;
const logger_1 = require("./logger");
const LOG_CAT = 'Security';
/**
 * Dangerous command patterns
 */
const DANGEROUS_PATTERNS = [
    // Destructive file operations
    { pattern: /rm\s+-rf\s+[\/\\]/, reason: 'Recursive delete of root directory' },
    { pattern: /rm\s+-rf\s+~/, reason: 'Recursive delete of home directory' },
    { pattern: /del\s+\/s\s+\/q\s+[cC]:/, reason: 'Recursive delete on Windows' },
    { pattern: /format\s+[a-zA-Z]:/, reason: 'Disk format command' },
    // Privilege escalation
    { pattern: /sudo\s+/, reason: 'Sudo command (privilege escalation)' },
    { pattern: /su\s+-/, reason: 'Switch user command' },
    { pattern: /runas\s+/, reason: 'Windows runas command' },
    // System modification
    { pattern: /chmod\s+777/, reason: 'Overly permissive chmod' },
    { pattern: /chown\s+-R/, reason: 'Recursive ownership change' },
    { pattern: /registry\s+delete/i, reason: 'Registry deletion' },
    // Network attacks
    { pattern: /curl.*\|\s*sh/, reason: 'Piping curl to shell (potential RCE)' },
    { pattern: /wget.*\|\s*sh/, reason: 'Piping wget to shell (potential RCE)' },
    { pattern: /curl.*\|\s*bash/, reason: 'Piping curl to bash' },
    // Crypto mining
    { pattern: /xmrig|minerd|cgminer/i, reason: 'Potential crypto miner' },
    // Credential theft
    { pattern: /\.ssh\/id_rsa/, reason: 'SSH private key access' },
    { pattern: /\.aws\/credentials/, reason: 'AWS credentials access' },
    { pattern: /\.env.*password/i, reason: 'Password in environment' },
    // Fork bombs
    { pattern: /:\(\)\{:\|:&\};:/, reason: 'Bash fork bomb' },
    { pattern: /%0\|%0/, reason: 'Windows fork bomb' },
];
/**
 * Tools that are always blocked
 */
const BLOCKED_TOOLS = new Set([
    'execute_arbitrary_code',
    'system_shell',
    'raw_exec',
]);
/**
 * Tools that require extra scrutiny
 */
const SENSITIVE_TOOLS = new Set([
    'run_command',
    'execute_command',
    'shell',
    'terminal',
    'bash',
    'powershell',
]);
class SecuritySandbox {
    constructor() {
        this.enabled = false; // OFF by default
        this.strictMode = false;
        this.violations = [];
        this.maxViolations = 100;
    }
    /**
     * Enable/disable security sandbox
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        logger_1.logger.info(LOG_CAT, `Security sandbox: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
    /**
     * Check if security is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Enable strict mode (blocks more operations)
     */
    setStrictMode(strict) {
        this.strictMode = strict;
        logger_1.logger.info(LOG_CAT, `Strict mode: ${strict ? 'ON' : 'OFF'}`);
    }
    /**
     * Validate a tool call
     * Returns null if safe, error message if blocked
     */
    validate(toolName, args) {
        if (!this.enabled) {
            return null; // Security disabled, allow everything
        }
        const toolLower = toolName.toLowerCase();
        // Check if tool is blocked
        if (BLOCKED_TOOLS.has(toolLower)) {
            return this.recordViolation(toolName, 'Tool is blocked', toolName);
        }
        // Check sensitive tools more carefully
        if (SENSITIVE_TOOLS.has(toolLower)) {
            const argsStr = JSON.stringify(args);
            for (const { pattern, reason } of DANGEROUS_PATTERNS) {
                if (pattern.test(argsStr)) {
                    return this.recordViolation(toolName, reason, pattern.toString());
                }
            }
            // Strict mode: require explicit allowlisting
            if (this.strictMode) {
                return this.recordViolation(toolName, 'Shell commands blocked in strict mode', toolName);
            }
        }
        // Check for path traversal
        const pathArgs = this.extractPaths(args);
        for (const p of pathArgs) {
            if (this.isPathTraversal(p)) {
                return this.recordViolation(toolName, 'Path traversal detected', p);
            }
        }
        return null; // Safe
    }
    /**
     * Extract file paths from arguments
     */
    extractPaths(args) {
        const paths = [];
        const extract = (obj) => {
            if (typeof obj === 'string') {
                // Check if it looks like a path
                if (obj.includes('/') || obj.includes('\\')) {
                    paths.push(obj);
                }
            }
            else if (Array.isArray(obj)) {
                obj.forEach(extract);
            }
            else if (obj && typeof obj === 'object') {
                Object.values(obj).forEach(extract);
            }
        };
        extract(args);
        return paths;
    }
    /**
     * Check for path traversal attempts
     */
    isPathTraversal(p) {
        const normalized = p.replace(/\\/g, '/');
        return normalized.includes('../') ||
            normalized.includes('/..') ||
            normalized.startsWith('..') ||
            /^\/(?:etc|proc|sys|dev|root)\//.test(normalized);
    }
    /**
     * Record a security violation
     */
    recordViolation(toolName, reason, pattern) {
        const violation = {
            toolName,
            reason,
            pattern,
            timestamp: new Date().toISOString()
        };
        this.violations.push(violation);
        // Trim old violations
        if (this.violations.length > this.maxViolations) {
            this.violations = this.violations.slice(-this.maxViolations);
        }
        logger_1.logger.warn(LOG_CAT, `BLOCKED: ${toolName} - ${reason}`);
        return `Security: ${reason}`;
    }
    /**
     * Get recent violations
     */
    getViolations(limit = 20) {
        return this.violations.slice(-limit);
    }
    /**
     * Get security status for API
     */
    getStatus() {
        return {
            enabled: this.enabled,
            strictMode: this.strictMode,
            violationCount: this.violations.length,
            recentViolations: this.getViolations(5)
        };
    }
}
exports.SecuritySandbox = SecuritySandbox;
//# sourceMappingURL=security.js.map