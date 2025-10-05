/**
 * Cursor IDE統合マネージャー
 *
 * Cursor IDEのmcpServers設定フォーマットに対応し、
 * 環境変数管理、サーバー有効/無効切り替え、設定同期を実現します。
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chokidar from 'chokidar';
import { CursorSettingsSchema, type CursorSettings, DEFAULT_CURSOR_SETTINGS } from './schema.js';
import { getLogger } from '../logging/index.js';

/**
 * Cursor統合マネージャーのオプション
 */
export interface CursorIntegrationOptions {
  cursorConfigPath?: string;
  strictEnvMode?: boolean;
}

/**
 * 設定変更コールバック
 */
export type CursorConfigChangeCallback = () => void;

/**
 * Cursor IDE統合マネージャー
 */
export class CursorIntegrationManager {
  private cursorConfigPath: string;
  private cursorSettings: CursorSettings | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private changeCallbacks: CursorConfigChangeCallback[] = [];
  private reloadTimeout: NodeJS.Timeout | null = null;
  private strictEnvMode: boolean;
  private logger = getLogger();

  constructor(options: CursorIntegrationOptions = {}) {
    // Cursor設定ファイルのパスを決定
    if (options.cursorConfigPath) {
      this.cursorConfigPath = options.cursorConfigPath;
    } else {
      // os.homedir()を使用し、falsyの場合はprocess.cwd()にフォールバック
      const resolvedHome = os.homedir() || process.cwd();
      this.cursorConfigPath = path.join(resolvedHome, '.cursor', 'settings.json');
    }

    // strictEnvModeの設定（デフォルトはfalse）
    this.strictEnvMode = options.strictEnvMode ?? false;
  }

  /**
   * Cursor設定を読み込み
   */
  async loadCursorConfig(): Promise<CursorSettings> {
    try {
      // 設定ファイルの存在確認
      await fs.access(this.cursorConfigPath);

      // ファイルの読み込み
      const fileContent = await fs.readFile(this.cursorConfigPath, 'utf-8');
      const parsedSettings = JSON.parse(fileContent);

      // バリデーション
      this.cursorSettings = CursorSettingsSchema.parse(parsedSettings);

      // mcpServersが確実に存在することを保証
      if (!this.cursorSettings.mcpServers) {
        this.cursorSettings.mcpServers = {};
      }

      return this.cursorSettings;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 設定ファイルが存在しない場合、デフォルト設定を返す
        this.cursorSettings = { ...DEFAULT_CURSOR_SETTINGS };

        // mcpServersが確実に存在することを保証
        if (!this.cursorSettings.mcpServers) {
          this.cursorSettings.mcpServers = {};
        }

        return this.cursorSettings;
      }
      throw error;
    }
  }

  /**
   * 環境変数を解決
   *
   * ${VAR_NAME} 形式の参照を実際の環境変数の値に置き換えます。
   *
   * 動作モード:
   * - strictEnvMode = false (デフォルト): 環境変数が未定義の場合、警告を出力して空文字列を返す
   * - strictEnvMode = true: 環境変数が未定義の場合、エラーをthrowする
   *
   * @param serverName - サーバー名
   * @returns 解決された環境変数のマップ
   * @throws strictEnvMode=trueかつ参照された環境変数が未定義の場合、Errorをthrow
   */
  async resolveEnvironmentVariables(serverName: string): Promise<Record<string, string>> {
    if (!this.cursorSettings) {
      await this.loadCursorConfig();
    }

    const serverConfig = this.cursorSettings?.mcpServers?.[serverName];
    if (!serverConfig || !serverConfig.env) {
      return {};
    }

    const resolvedEnv: Record<string, string> = {};

    for (const [key, value] of Object.entries(serverConfig.env)) {
      // ${VAR_NAME} 形式の参照を検出して解決
      const envVarMatch = value.match(/^\$\{([^}]+)\}$/);
      if (envVarMatch) {
        const envVarName = envVarMatch[1];
        const envValue = process.env[envVarName];

        if (envValue === undefined) {
          // 環境変数が未定義の場合
          const errorMessage = `Environment variable "${envVarName}" referenced in server "${serverName}" key "${key}" is not defined`;

          if (this.strictEnvMode) {
            // strictモード: エラーをthrow
            this.logger.error(errorMessage, undefined, {
              serverName,
              key,
              missingVar: envVarName,
            });
            throw new Error(errorMessage);
          } else {
            // 非strictモード: 警告を出力して空文字列を返す
            this.logger.warn(errorMessage, undefined, {
              serverName,
              key,
              missingVar: envVarName,
            });
            resolvedEnv[key] = '';
          }
        } else {
          resolvedEnv[key] = envValue;
        }
      } else {
        resolvedEnv[key] = value;
      }
    }

    return resolvedEnv;
  }

  /**
   * サーバーが有効かチェック
   */
  async isServerEnabled(serverName: string): Promise<boolean> {
    if (!this.cursorSettings) {
      await this.loadCursorConfig();
    }

    const serverConfig = this.cursorSettings?.mcpServers?.[serverName];
    if (!serverConfig) {
      return false;
    }

    return serverConfig.disabled !== true;
  }

  /**
   * サーバーを有効化
   */
  async enableServer(serverName: string): Promise<void> {
    if (!this.cursorSettings) {
      await this.loadCursorConfig();
    }

    // optional chainingを使用してサーバー設定の存在を確認
    const serverConfig = this.cursorSettings?.mcpServers?.[serverName];
    if (!serverConfig) {
      throw new Error(`Server "${serverName}" not found in Cursor settings`);
    }

    // disabled フラグを false に設定
    serverConfig.disabled = false;

    // 設定ファイルに書き込み
    await this.saveCursorConfig();
  }

  /**
   * サーバーを無効化
   */
  async disableServer(serverName: string): Promise<void> {
    if (!this.cursorSettings) {
      await this.loadCursorConfig();
    }

    // optional chainingを使用してサーバー設定の存在を確認
    const serverConfig = this.cursorSettings?.mcpServers?.[serverName];
    if (!serverConfig) {
      throw new Error(`Server "${serverName}" not found in Cursor settings`);
    }

    // disabled フラグを true に設定
    serverConfig.disabled = true;

    // 設定ファイルに書き込み
    await this.saveCursorConfig();
  }

  /**
   * Cursor設定をファイルに保存
   */
  private async saveCursorConfig(): Promise<void> {
    if (!this.cursorSettings) {
      throw new Error('No Cursor settings to save');
    }

    const configContent = JSON.stringify(this.cursorSettings, null, 2);
    await fs.writeFile(this.cursorConfigPath, configContent, 'utf-8');
  }

  /**
   * Cursor設定の変更を監視
   */
  watchCursorConfig(callback: CursorConfigChangeCallback): void {
    // コールバックを登録
    this.changeCallbacks.push(callback);

    // 既に監視中の場合は何もしない
    if (this.watcher) {
      return;
    }

    // chokidarでCursor設定ファイルを監視
    this.watcher = chokidar.watch(this.cursorConfigPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher.on('change', () => {
      // Debounce: 連続したイベントをマージ
      if (this.reloadTimeout) {
        clearTimeout(this.reloadTimeout);
        this.reloadTimeout = null;
      }

      // 200msの非アクティブ後に設定を再読み込み
      this.reloadTimeout = setTimeout(async () => {
        try {
          // 設定を再読み込み
          await this.loadCursorConfig();

          // すべてのコールバックを実行
          this.changeCallbacks.forEach((cb) => cb());
        } catch (error) {
          // エラーが発生した場合はデフォルト設定にフォールバック
          this.cursorSettings = { ...DEFAULT_CURSOR_SETTINGS };
          this.changeCallbacks.forEach((cb) => cb());
        } finally {
          this.reloadTimeout = null;
        }
      }, 200);
    });
  }

  /**
   * Cursor設定の監視を停止
   */
  async stopWatching(): Promise<void> {
    // 保留中のリロードタイムアウトをクリア
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

  /**
   * 現在のCursor設定を取得
   */
  getCursorSettings(): CursorSettings | null {
    return this.cursorSettings;
  }
}
