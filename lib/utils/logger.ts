export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

class Logger {
    private level: LogLevel = 'info';

    constructor() {
        // Default to 'info' unless overridden by localStorage (useful for runtime debugging)
        try {
            const savedLevel = localStorage.getItem('log_level') as LogLevel;
            if (savedLevel) {
                this.level = savedLevel;
            }
        } catch (e) {
            // ignore
        }
    }

    setLevel(level: LogLevel) {
        this.level = level;
        try {
            localStorage.setItem('log_level', level);
        } catch (e) {
            // ignore
        }
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'none'];
        return levels.indexOf(level) >= levels.indexOf(this.level);
    }

    debug(...args: any[]) {
        if (this.shouldLog('debug')) {
            console.debug('[DEBUG]', ...args);
        }
    }

    info(...args: any[]) {
        if (this.shouldLog('info')) {
            console.log('[INFO]', ...args);
        }
    }

    warn(...args: any[]) {
        if (this.shouldLog('warn')) {
            console.warn('[WARN]', ...args);
        }
    }

    error(...args: any[]) {
        if (this.shouldLog('error')) {
            console.error('[ERROR]', ...args);
        }
    }
}

export const logger = new Logger();
