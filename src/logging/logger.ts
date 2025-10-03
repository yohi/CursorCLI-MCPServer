/**
 * Logging System Implementation
 *
 * Winston をベースにしたロギングシステム。
 * 複数の出力先（コンソール、ファイル、Output panel）をサポートします。
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import type { LogContext } from '../types/index.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogOutput = 'console' | 'file' | 'cursor-output-panel';

export interface LoggingConfig {
  level: LogLevel;
  outputs: LogOutput[];
  logFile?: string;
  maxLogSize?: number;
  rotationCount?: number;
}

const DEFAULT_CONFIG: LoggingConfig = {
  level: 'info',
  outputs: ['console'],
  logFile: '.cursorcli-mcp/logs/server.log',
  maxLogSize: 10 * 1024 * 1024, // 10MB
  rotationCount: 5,
};

/**
 * ロギングシステム
 */
export class LoggingSystem {
  private logger: winston.Logger;
  private config: LoggingConfig;

  constructor(config: Partial<LoggingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = this.createLogger();
  }

  /**
   * Winstonロガーの作成
   */
  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // コンソール出力
    if (this.config.outputs.includes('console')) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          ),
        })
      );
    }

    // ファイル出力（ローテーション付き）
    if (this.config.outputs.includes('file') && this.config.logFile) {
      transports.push(
        new DailyRotateFile({
          filename: this.config.logFile.replace('.log', '-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.maxLogSize,
          maxFiles: this.config.rotationCount,
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.json()
          ),
        })
      );
    }

    return winston.createLogger({
      level: this.config.level,
      transports,
    });
  }

  /**
   * DEBUGレベルのログ記録
   */
  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }

  /**
   * INFOレベルのログ記録
   */
  info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  /**
   * WARNレベルのログ記録
   */
  warn(message: string, error?: Error, context?: LogContext): void {
    this.logger.warn(message, {
      ...context,
      error: error
        ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
        : undefined,
    });
  }

  /**
   * ERRORレベルのログ記録
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, {
      ...context,
      error: error
        ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
        : undefined,
    });
  }

  /**
   * ツール実行のログ記録
   */
  logToolExecution(toolName: string, params: unknown, result: unknown, duration: number): void {
    this.logger.info('Tool execution', {
      toolName,
      params,
      result,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * ログレベルの変更
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.logger.level = level;
  }

  /**
   * ロガーのシャットダウン
   */
  async shutdown(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.logger.close();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}

/**
 * グローバルロガーインスタンス（シングルトン）
 */
let globalLogger: LoggingSystem | null = null;

/**
 * グローバルロガーの取得
 */
export function getLogger(config?: Partial<LoggingConfig>): LoggingSystem {
  if (!globalLogger) {
    globalLogger = new LoggingSystem(config);
  }
  return globalLogger;
}

/**
 * グローバルロガーのリセット（テスト用）
 */
export function resetLogger(): void {
  globalLogger = null;
}
