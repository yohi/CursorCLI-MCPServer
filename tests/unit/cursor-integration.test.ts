/**
 * Cursor IDE統合機能のテスト
 *
 * Requirements: 9.1, 9.6
 * - mcpServers設定フォーマットへの対応
 * - 環境変数管理機能（env フィールド）
 * - サーバー有効/無効切り替えのサポート
 * - 設定同期機能の実装
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CursorIntegrationManager } from '../../src/cursor-integration/manager.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('CursorIntegrationManager', () => {
  let tempDir: string;
  let manager: CursorIntegrationManager;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cursor-integration-test-'));
    manager = new CursorIntegrationManager({
      cursorConfigPath: path.join(tempDir, 'cursor-settings.json'),
    });
  });

  afterEach(async () => {
    // 一時ディレクトリをクリーンアップ
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('mcpServers設定フォーマット対応', () => {
    it('Cursor設定からmcpServers設定を読み込める', async () => {
      // Arrange: Cursor設定ファイルを作成
      const cursorSettings = {
        mcpServers: {
          'cursorcli-mcp-server': {
            command: 'node',
            args: ['/path/to/server.js'],
            disabled: false,
          },
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'cursor-settings.json'),
        JSON.stringify(cursorSettings, null, 2)
      );

      // Act: 設定を読み込み
      const config = await manager.loadCursorConfig();

      // Assert: mcpServers設定が取得できる
      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers['cursorcli-mcp-server']).toBeDefined();
      expect(config.mcpServers['cursorcli-mcp-server'].command).toBe('node');
    });

    it('mcpServers設定が存在しない場合、デフォルト設定を返す', async () => {
      // Arrange: 空のCursor設定ファイルを作成
      await fs.writeFile(path.join(tempDir, 'cursor-settings.json'), JSON.stringify({}, null, 2));

      // Act: 設定を読み込み
      const config = await manager.loadCursorConfig();

      // Assert: デフォルトのmcpServers設定が返される
      expect(config.mcpServers).toBeDefined();
      expect(Object.keys(config.mcpServers)).toHaveLength(0);
    });
  });

  describe('環境変数管理機能', () => {
    it('env フィールドから環境変数を読み込める', async () => {
      // Arrange: 環境変数を含むCursor設定を作成
      const cursorSettings = {
        mcpServers: {
          'cursorcli-mcp-server': {
            command: 'node',
            args: ['/path/to/server.js'],
            env: {
              MCP_LOG_LEVEL: 'debug',
              API_KEY: '${API_KEY}',
            },
          },
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'cursor-settings.json'),
        JSON.stringify(cursorSettings, null, 2)
      );

      // Act: 環境変数を解決
      const resolvedEnv = await manager.resolveEnvironmentVariables('cursorcli-mcp-server');

      // Assert: 環境変数が解決される
      expect(resolvedEnv.MCP_LOG_LEVEL).toBe('debug');
      expect(resolvedEnv.API_KEY).toBeDefined();
    });

    it('環境変数の参照形式を正しく解決する', async () => {
      // Arrange: テスト用の環境変数を設定
      process.env.TEST_API_KEY = 'test-secret-key';
      const cursorSettings = {
        mcpServers: {
          'cursorcli-mcp-server': {
            command: 'node',
            args: ['/path/to/server.js'],
            env: {
              API_KEY: '${TEST_API_KEY}',
            },
          },
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'cursor-settings.json'),
        JSON.stringify(cursorSettings, null, 2)
      );

      // Act: 環境変数を解決
      const resolvedEnv = await manager.resolveEnvironmentVariables('cursorcli-mcp-server');

      // Assert: 環境変数が正しく解決される
      expect(resolvedEnv.API_KEY).toBe('test-secret-key');

      // Cleanup
      delete process.env.TEST_API_KEY;
    });
  });

  describe('サーバー有効/無効切り替え', () => {
    it('サーバーが無効の場合、disabled: trueを検出する', async () => {
      // Arrange: 無効化されたサーバー設定
      const cursorSettings = {
        mcpServers: {
          'cursorcli-mcp-server': {
            command: 'node',
            args: ['/path/to/server.js'],
            disabled: true,
          },
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'cursor-settings.json'),
        JSON.stringify(cursorSettings, null, 2)
      );

      // Act: サーバーが有効かチェック
      const isEnabled = await manager.isServerEnabled('cursorcli-mcp-server');

      // Assert: サーバーは無効
      expect(isEnabled).toBe(false);
    });

    it('サーバーが有効の場合、disabled: falseまたは未設定を検出する', async () => {
      // Arrange: 有効なサーバー設定
      const cursorSettings = {
        mcpServers: {
          'cursorcli-mcp-server': {
            command: 'node',
            args: ['/path/to/server.js'],
            disabled: false,
          },
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'cursor-settings.json'),
        JSON.stringify(cursorSettings, null, 2)
      );

      // Act: サーバーが有効かチェック
      const isEnabled = await manager.isServerEnabled('cursorcli-mcp-server');

      // Assert: サーバーは有効
      expect(isEnabled).toBe(true);
    });

    it('サーバーを有効化できる', async () => {
      // Arrange: 無効なサーバー設定
      const cursorSettings = {
        mcpServers: {
          'cursorcli-mcp-server': {
            command: 'node',
            args: ['/path/to/server.js'],
            disabled: true,
          },
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'cursor-settings.json'),
        JSON.stringify(cursorSettings, null, 2)
      );

      // Act: サーバーを有効化
      await manager.enableServer('cursorcli-mcp-server');

      // Assert: 設定ファイルが更新される
      const updatedSettings = JSON.parse(
        await fs.readFile(path.join(tempDir, 'cursor-settings.json'), 'utf-8')
      );
      expect(updatedSettings.mcpServers['cursorcli-mcp-server'].disabled).toBe(false);
    });

    it('サーバーを無効化できる', async () => {
      // Arrange: 有効なサーバー設定
      const cursorSettings = {
        mcpServers: {
          'cursorcli-mcp-server': {
            command: 'node',
            args: ['/path/to/server.js'],
            disabled: false,
          },
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'cursor-settings.json'),
        JSON.stringify(cursorSettings, null, 2)
      );

      // Act: サーバーを無効化
      await manager.disableServer('cursorcli-mcp-server');

      // Assert: 設定ファイルが更新される
      const updatedSettings = JSON.parse(
        await fs.readFile(path.join(tempDir, 'cursor-settings.json'), 'utf-8')
      );
      expect(updatedSettings.mcpServers['cursorcli-mcp-server'].disabled).toBe(true);
    });
  });

  describe('設定同期機能', () => {
    it('Cursor設定が変更されたら、変更を検知する', async () => {
      // Arrange: 初期設定
      const initialSettings = {
        mcpServers: {
          'cursorcli-mcp-server': {
            command: 'node',
            args: ['/path/to/server.js'],
          },
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'cursor-settings.json'),
        JSON.stringify(initialSettings, null, 2)
      );

      let changeDetected = false;
      const callback = () => {
        changeDetected = true;
      };

      // Act: 設定変更を監視
      manager.watchCursorConfig(callback);

      // 設定を更新
      const updatedSettings = {
        ...initialSettings,
        mcpServers: {
          'cursorcli-mcp-server': {
            ...initialSettings.mcpServers['cursorcli-mcp-server'],
            disabled: true,
          },
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'cursor-settings.json'),
        JSON.stringify(updatedSettings, null, 2)
      );

      // Wait for file watcher to detect change
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert: 変更が検知される
      expect(changeDetected).toBe(true);

      // Cleanup
      await manager.stopWatching();
    });

    it('Cursor設定の変更を自動的にサーバー設定に反映する', async () => {
      // Arrange: 初期設定
      const initialSettings = {
        mcpServers: {
          'cursorcli-mcp-server': {
            command: 'node',
            args: ['/path/to/server.js'],
            env: {
              MCP_LOG_LEVEL: 'info',
            },
          },
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'cursor-settings.json'),
        JSON.stringify(initialSettings, null, 2)
      );

      let syncedEnv: Record<string, string> = {};
      const callback = async () => {
        syncedEnv = await manager.resolveEnvironmentVariables('cursorcli-mcp-server');
      };

      // Act: 設定同期を開始
      manager.watchCursorConfig(callback);

      // 設定を更新
      const updatedSettings = {
        ...initialSettings,
        mcpServers: {
          'cursorcli-mcp-server': {
            ...initialSettings.mcpServers['cursorcli-mcp-server'],
            env: {
              MCP_LOG_LEVEL: 'debug',
            },
          },
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'cursor-settings.json'),
        JSON.stringify(updatedSettings, null, 2)
      );

      // Wait for sync
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert: 環境変数が同期される
      expect(syncedEnv.MCP_LOG_LEVEL).toBe('debug');

      // Cleanup
      await manager.stopWatching();
    });
  });
});
