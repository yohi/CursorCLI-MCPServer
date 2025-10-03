/**
 * Configuration Manager Implementation
 *
 * 設定ファイルの読み込み、バリデーション、環境変数マージを管理します。
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import chokidar from 'chokidar';
import type { Result } from '../types/index.js';
import { ServerConfigSchema, DEFAULT_CONFIG, type ServerConfig, type ValidationError } from './schema.js';

/**
 * 設定マネージャーのオプション
 */
export interface ConfigManagerOptions {
  configPath?: string;
  configDir?: string;
}

/**
 * 設定変更コールバック
 */
export type ConfigChangeCallback = (newConfig: ServerConfig) => void;

const DEFAULT_CONFIG_DIR = '.cursorcli-mcp';
const DEFAULT_CONFIG_FILENAME = 'config.json';

/**
 * 設定マネージャー
 */
export class ConfigurationManager {
  private config: ServerConfig | null = null;
  private configPath: string;
  private configDir: string;
  private watcher: chokidar.FSWatcher | null = null;
  private changeCallbacks: ConfigChangeCallback[] = [];
  private loadingPromise: Promise<ServerConfig> | null = null;
  private reloadTimeout: NodeJS.Timeout | null = null;

  constructor(options: ConfigManagerOptions = {}) {
    this.configDir = options.configDir || DEFAULT_CONFIG_DIR;
    this.configPath = options.configPath || path.join(this.configDir, DEFAULT_CONFIG_FILENAME);
  }

  /**
   * 設定ファイルを読み込み、バリデーションを実行
   */
  async loadConfig(): Promise<ServerConfig> {
    // Single-flight guard: return existing promise if load is already in progress
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Create new loading promise
    this.loadingPromise = (async () => {
      try {
        // Load config into local variable to avoid partial updates
        let loadedConfig: ServerConfig;

        try {
          // 設定ファイルの存在確認
          await fs.access(this.configPath);

          // ファイルの読み込み
          const fileContent = await fs.readFile(this.configPath, 'utf-8');
          const parsedConfig = JSON.parse(fileContent);

          // バリデーション
          const validationResult = this.validateConfig(parsedConfig);

          if (!validationResult.ok) {
            throw new Error(`Configuration validation failed: ${validationResult.error.message}`);
          }

          // 環境変数からのマージ
          loadedConfig = this.mergeEnvironmentVariables(validationResult.value);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // 設定ファイルが存在しない場合、デフォルト設定を生成
            await this.generateDefaultConfig();
            loadedConfig = { ...DEFAULT_CONFIG };
          } else {
            throw error;
          }
        }

        // Assign to this.config only once from local result
        this.config = loadedConfig;
        return loadedConfig;
      } finally {
        // Clear loadingPromise in finally block so subsequent calls start fresh
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  /**
   * 設定のバリデーション
   */
  validateConfig(config: unknown): Result<ServerConfig, ValidationError> {
    try {
      const validated = ServerConfigSchema.parse(config);
      return { ok: true, value: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstIssue = error.issues[0];
        return {
          ok: false,
          error: {
            field: firstIssue.path.join('.'),
            message: firstIssue.message,
            received: 'received' in firstIssue ? firstIssue.received : undefined,
          },
        };
      }
      return {
        ok: false,
        error: {
          field: 'unknown',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          received: config,
        },
      };
    }
  }

  /**
   * デフォルト設定を生成してファイルに書き込み
   */
  private async generateDefaultConfig(): Promise<void> {
    try {
      // ディレクトリの作成
      await fs.mkdir(this.configDir, { recursive: true });

      // デフォルト設定を書き込み
      const configContent = JSON.stringify(DEFAULT_CONFIG, null, 2);
      await fs.writeFile(this.configPath, configContent, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to generate default config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 環境変数から設定を上書き
   */
  private mergeEnvironmentVariables(config: ServerConfig): ServerConfig {
    const merged = { ...config };

    // MCP_LOG_LEVEL
    if (process.env.MCP_LOG_LEVEL) {
      const logLevel = process.env.MCP_LOG_LEVEL.toLowerCase();
      if (['debug', 'info', 'warn', 'error'].includes(logLevel)) {
        merged.logging.level = logLevel as 'debug' | 'info' | 'warn' | 'error';
      }
    }

    // MCP_MAX_CONCURRENT_REQUESTS
    if (process.env.MCP_MAX_CONCURRENT_REQUESTS) {
      const value = parseInt(process.env.MCP_MAX_CONCURRENT_REQUESTS, 10);
      if (!isNaN(value) && value >= 1 && value <= 100) {
        merged.server.maxConcurrentRequests = value;
      }
    }

    // MCP_REQUEST_TIMEOUT_MS
    if (process.env.MCP_REQUEST_TIMEOUT_MS) {
      const value = parseInt(process.env.MCP_REQUEST_TIMEOUT_MS, 10);
      if (!isNaN(value) && value >= 1000 && value <= 60000) {
        merged.server.requestTimeoutMs = value;
      }
    }

    // MCP_ENFORCE_PROJECT_ROOT
    if (process.env.MCP_ENFORCE_PROJECT_ROOT) {
      merged.security.enforceProjectRoot = process.env.MCP_ENFORCE_PROJECT_ROOT === 'true';
    }

    // MCP_ALLOW_DESTRUCTIVE_OPERATIONS
    if (process.env.MCP_ALLOW_DESTRUCTIVE_OPERATIONS) {
      merged.security.allowDestructiveOperations = process.env.MCP_ALLOW_DESTRUCTIVE_OPERATIONS === 'true';
    }

    return merged;
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): ServerConfig | null {
    return this.config;
  }

  /**
   * 設定を強制的に設定（テスト用）
   */
  setConfig(config: ServerConfig): void {
    this.config = config;
  }

  /**
   * 設定ファイルの変更を監視
   */
  watchConfig(callback: ConfigChangeCallback): void {
    // コールバックを登録
    this.changeCallbacks.push(callback);

    // 既に監視中の場合は何もしない
    if (this.watcher) {
      return;
    }

    // chokidarで設定ファイルを監視
    this.watcher = chokidar.watch(this.configPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher.on('change', () => {
      // Debounce: clear any existing timeout to merge rapid consecutive events
      if (this.reloadTimeout) {
        clearTimeout(this.reloadTimeout);
        this.reloadTimeout = null;
      }

      // Set new timeout to reload config after 200ms of inactivity
      this.reloadTimeout = setTimeout(async () => {
        try {
          // 設定を再読み込み
          const newConfig = await this.loadConfig();

          // Update this.config (already done in loadConfig, but for clarity)
          this.config = newConfig;

          // すべてのコールバックを実行
          this.changeCallbacks.forEach(cb => cb(newConfig));
        } catch (error) {
          // エラーが発生した場合はデフォルト設定にフォールバック
          const fallbackConfig = { ...DEFAULT_CONFIG };
          this.config = fallbackConfig;
          this.changeCallbacks.forEach(cb => cb(fallbackConfig));
        } finally {
          // Clear timeout reference
          this.reloadTimeout = null;
        }
      }, 200);
    });
  }

  /**
   * 設定ファイルの監視を停止
   */
  async stopWatching(): Promise<void> {
    // Clear any pending reload timeout
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
      this.reloadTimeout = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.changeCallbacks = [];
  }
}
