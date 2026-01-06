"use strict";
/**
 * TechAI MCP Proxy - Logger Module
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    constructor() {
        this.level = 'info';
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
    }
    setLevel(level) {
        this.level = level;
    }
    shouldLog(level) {
        return this.levels[level] >= this.levels[this.level];
    }
    format(level, category, message, ...args) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}] [${category}]`;
        return `${prefix} ${message} ${args.length ? JSON.stringify(args) : ''}`;
    }
    debug(category, message, ...args) {
        if (this.shouldLog('debug')) {
            console.debug(this.format('debug', category, message, ...args));
        }
    }
    info(category, message, ...args) {
        if (this.shouldLog('info')) {
            console.info(this.format('info', category, message, ...args));
        }
    }
    warn(category, message, ...args) {
        if (this.shouldLog('warn')) {
            console.warn(this.format('warn', category, message, ...args));
        }
    }
    error(category, message, ...args) {
        if (this.shouldLog('error')) {
            console.error(this.format('error', category, message, ...args));
        }
    }
}
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map