/**
 * Configuration Watcher Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { ConfigurationManager } from '../../src/config/manager.js';
import { DEFAULT_CONFIG } from '../../src/config/schema.js';
import type { ServerConfig } from '../../src/config/schema.js';

describe('ConfigurationManager - Watch Mode', () => {
  const testConfigDir = '.cursorcli-mcp-test-watch';
  const testConfigPath = path.join(testConfigDir, 'config.json');
  let manager: ConfigurationManager;

  beforeEach(async () => {
    // テスト用設定ディレクトリのクリーンアップ
    try {
      await fs.rm(testConfigDir, { recursive: true, force: true });
    } catch {
      // ディレクトリが存在しない場合は無視
    }

    // 設定ディレクトリとファイルを作成
    await fs.mkdir(testConfigDir, { recursive: true });
    await fs.writeFile(testConfigPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');

    // ConfigurationManagerのインスタンスを作成
    manager = new ConfigurationManager({ configPath: testConfigPath });
    await manager.loadConfig();
  });

  afterEach(async () => {
    // 監視を停止
    await manager.stopWatching();

    // クリーンアップ
    try {
      await fs.rm(testConfigDir, { recursive: true, force: true });
    } catch {
      // 無視
    }
  });

  describe('設定変更監視', () => {
    it('設定ファイルの変更を検知できる', async () => {
      let callbackExecuted = false;
      let newConfig: ServerConfig | null = null;

      // 監視開始
      manager.watchConfig((config) => {
        callbackExecuted = true;
        newConfig = config;
      });

      // 設定ファイルを変更
      const modifiedConfig = {
        ...DEFAULT_CONFIG,
        logging: {
          ...DEFAULT_CONFIG.logging,
          level: 'debug' as const,
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(modifiedConfig, null, 2), 'utf-8');

      // 変更が検知されるまで待機（最大2秒）
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (callbackExecuted) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 2000);
      });

      expect(callbackExecuted).toBe(true);
      expect(newConfig).toBeDefined();
      expect(newConfig?.logging.level).toBe('debug');
    });

    it('複数のコールバックを登録できる', async () => {
      let callback1Executed = false;
      let callback2Executed = false;

      // 複数のコールバックを登録
      manager.watchConfig(() => {
        callback1Executed = true;
      });

      manager.watchConfig(() => {
        callback2Executed = true;
      });

      // 設定ファイルを変更
      const modifiedConfig = {
        ...DEFAULT_CONFIG,
        server: {
          ...DEFAULT_CONFIG.server,
          maxConcurrentRequests: 20,
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(modifiedConfig, null, 2), 'utf-8');

      // 変更が検知されるまで待機
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (callback1Executed && callback2Executed) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 2000);
      });

      expect(callback1Executed).toBe(true);
      expect(callback2Executed).toBe(true);
    });

    it('不正な設定値の場合、デフォルト設定にフォールバックする', async () => {
      let fallbackConfig: ServerConfig | null = null;

      // 監視開始
      manager.watchConfig((config) => {
        fallbackConfig = config;
      });

      // 不正な設定ファイルを書き込み
      await fs.writeFile(testConfigPath, '{ invalid json', 'utf-8');

      // 変更が検知されるまで待機
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (fallbackConfig) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 2000);
      });

      // デフォルト設定にフォールバック
      expect(fallbackConfig).toEqual(DEFAULT_CONFIG);
    });

    it('監視を停止できる', async () => {
      let callbackExecuted = false;

      // 監視開始
      manager.watchConfig(() => {
        callbackExecuted = true;
      });

      // 監視を停止
      await manager.stopWatching();

      // 設定ファイルを変更
      const modifiedConfig = {
        ...DEFAULT_CONFIG,
        logging: {
          ...DEFAULT_CONFIG.logging,
          level: 'error' as const,
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(modifiedConfig, null, 2), 'utf-8');

      // 少し待機
      await new Promise((resolve) => setTimeout(resolve, 500));

      // コールバックが実行されないことを確認
      expect(callbackExecuted).toBe(false);
    });
  });
});
