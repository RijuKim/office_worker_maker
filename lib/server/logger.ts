type LogLevel = "debug" | "info" | "warn" | "error";

interface LogMeta {
  [key: string]: unknown;
}

class Logger {
  private _requestId?: string;
  private _userId?: string;

  withRequestId(requestId: string): Logger {
    const l = new Logger();
    l._requestId = requestId;
    l._userId = this._userId;
    return l;
  }

  withUserId(userId: string): Logger {
    const l = new Logger();
    l._requestId = this._requestId;
    l._userId = userId;
    return l;
  }

  private log(level: LogLevel, message: string, meta?: LogMeta): void {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    if (this._requestId) entry.requestId = this._requestId;
    if (this._userId) entry.userId = this._userId;
    if (meta && Object.keys(meta).length > 0) {
      for (const [key, value] of Object.entries(meta)) {
        entry[key] = value;
      }
    }

    if (process.env.NODE_ENV === "production") {
      console[level](JSON.stringify(entry));
    } else {
      const prefix = [
        entry.timestamp,
        level.toUpperCase(),
        this._requestId,
      ].filter(Boolean).join(" ");
      console[level](`[${prefix}] ${message}`, meta ?? "");
    }
  }

  debug(message: string, meta?: LogMeta): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: LogMeta): void {
    this.log("error", message, meta);
  }
}

export const logger = new Logger();
