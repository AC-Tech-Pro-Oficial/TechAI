/**
 * TechAI MCP Proxy - Security Sandbox
 *
 * Validates tool calls to block potentially dangerous operations.
 * Disabled by default - must be explicitly enabled.
 */
interface SecurityViolation {
    toolName: string;
    reason: string;
    pattern: string;
    timestamp: string;
}
export declare class SecuritySandbox {
    private enabled;
    private strictMode;
    private violations;
    private maxViolations;
    /**
     * Enable/disable security sandbox
     */
    setEnabled(enabled: boolean): void;
    /**
     * Check if security is enabled
     */
    isEnabled(): boolean;
    /**
     * Enable strict mode (blocks more operations)
     */
    setStrictMode(strict: boolean): void;
    /**
     * Validate a tool call
     * Returns null if safe, error message if blocked
     */
    validate(toolName: string, args: Record<string, any>): string | null;
    /**
     * Extract file paths from arguments
     */
    private extractPaths;
    /**
     * Check for path traversal attempts
     */
    private isPathTraversal;
    /**
     * Record a security violation
     */
    private recordViolation;
    /**
     * Get recent violations
     */
    getViolations(limit?: number): SecurityViolation[];
    /**
     * Get security status for API
     */
    getStatus(): {
        enabled: boolean;
        strictMode: boolean;
        violationCount: number;
        recentViolations: SecurityViolation[];
    };
}
export {};
//# sourceMappingURL=security.d.ts.map