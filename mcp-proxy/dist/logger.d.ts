/**
 * TechAI MCP Proxy - Logger Module
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
declare class Logger {
    private level;
    private readonly levels;
    setLevel(level: LogLevel): void;
    private shouldLog;
    private format;
    debug(category: string, message: string, ...args: unknown[]): void;
    info(category: string, message: string, ...args: unknown[]): void;
    warn(category: string, message: string, ...args: unknown[]): void;
    error(category: string, message: string, ...args: unknown[]): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map