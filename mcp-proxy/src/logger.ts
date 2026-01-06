/**
 * TechAI MCP Proxy - Logger Module
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
    private level: LogLevel = 'info';
    private readonly levels: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };

    setLevel(level: LogLevel): void {
        this.level = level;
    }

    private shouldLog(level: LogLevel): boolean {
        return this.levels[level] >= this.levels[this.level];
    }

    private format(level: LogLevel, category: string, message: string, ...args: unknown[]): string {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}] [${category}]`;
        return `${prefix} ${message} ${args.length ? JSON.stringify(args) : ''}`;
    }

    debug(category: string, message: string, ...args: unknown[]): void {
        if (this.shouldLog('debug')) {
            console.debug(this.format('debug', category, message, ...args));
        }
    }

    info(category: string, message: string, ...args: unknown[]): void {
        if (this.shouldLog('info')) {
            console.info(this.format('info', category, message, ...args));
        }
    }

    warn(category: string, message: string, ...args: unknown[]): void {
        if (this.shouldLog('warn')) {
            console.warn(this.format('warn', category, message, ...args));
        }
    }

    error(category: string, message: string, ...args: unknown[]): void {
        if (this.shouldLog('error')) {
            console.error(this.format('error', category, message, ...args));
        }
    }
}

export const logger = new Logger();
