/**
 * Configuration Manager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { ConfigurationManager } from '../../src/config/manager.js';
import { DEFAULT_CONFIG } from '../../src/config/schema.js';
import type { ServerConfig } from '../../src/config/schema.js';

describe('ConfigurationManager', () => {
  const testConfigDir = '.cursorcli-mcp-test';
  const testConfigPath = path.join(testConfigDir, 'config.json');

  beforeEach(async () => {
    // テスト用設定ディレクトリのクリーンアップ
    try {
      await fs.rm(testConfigDir, { recursive: true, force: true });
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  });

  afterEach(async () => {
    // クリーンアップ
    try {
      await fs.rm(testConfigDir, { recursive: true, force: true });
    } catch {
      // 無視
    }
  });

  describe('初期化', () => {
    it('デフォルト設定でConfigurationManagerを初期化できる', () => {
      const manager = new ConfigurationManager();
      expect(manager).toBeDefined();
      expect(manager.getConfig()).toBeNull(); // 初期状態ではnull
    });

    it('カスタム設定パスでConfigurationManagerを初期化できる', () => {
      const customPath = path.join(testConfigDir, 'custom-config.json');
      const manager = new ConfigurationManager({ configPath: customPath });
      expect(manager).toBeDefined();
    });
  });

  describe('設定ファイル読み込み', () => {
    it('有効な設定ファイルを読み込める', async () => {
      // テスト用の有効な設定ファイルを作成
      await fs.mkdir(testConfigDir, { recursive: true });
      const validConfig: ServerConfig = { ...DEFAULT_CONFIG };
      await fs.writeFile(testConfigPath, JSON.stringify(validConfig, null, 2), 'utf-8');

      const manager = new ConfigurationManager({ configPath: testConfigPath });
      const config = await manager.loadConfig();

      expect(config).toBeDefined();
      expect(config.server.name).toBe(DEFAULT_CONFIG.server.name);
      expect(config.logging.level).toBe(DEFAULT_CONFIG.logging.level);
    });

    it('設定ファイルが存在しない場合、デフォルト設定を生成する', async () => {
      const manager = new ConfigurationManager({ configPath: testConfigPath });
      const config = await manager.loadConfig();

      // デフォルト設定が返される
      expect(config).toEqual(DEFAULT_CONFIG);

      // ファイルが生成されたことを確認
      const fileContent = await fs.readFile(testConfigPath, 'utf-8');
      const savedConfig = JSON.parse(fileContent);
      expect(savedConfig).toEqual(DEFAULT_CONFIG);
    });

    it('不正なJSON形式の設定ファイルの場合、エラーを投げる', async () => {
      // 不正なJSONファイルを作成
      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, '{ invalid json', 'utf-8');

      const manager = new ConfigurationManager({ configPath: testConfigPath });

      await expect(manager.loadConfig()).rejects.toThrow();
    });
  });

  describe('設定バリデーション', () => {
    it('有効な設定オブジェクトを検証できる', () => {
      const manager = new ConfigurationManager();
      const validConfig: ServerConfig = { ...DEFAULT_CONFIG };

      const result = manager.validateConfig(validConfig);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(validConfig);
      }
    });

    it('必須フィールドが欠けている場合、バリデーションエラーを返す', () => {
      const manager = new ConfigurationManager();
      const invalidConfig = {
        server: {
          name: 'test',
          // versionフィールドが欠けている
          maxConcurrentRequests: 10,
          requestTimeoutMs: 5000,
        },
      };

      const result = manager.validateConfig(invalidConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.field).toContain('server');
      }
    });

    it('型が不正な場合、バリデーションエラーを返す', () => {
      const manager = new ConfigurationManager();
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        server: {
          ...DEFAULT_CONFIG.server,
          maxConcurrentRequests: 'invalid', // 数値であるべき
        },
      };

      const result = manager.validateConfig(invalidConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBeDefined();
      }
    });

    it('範囲外の値の場合、バリデーションエラーを返す', () => {
      const manager = new ConfigurationManager();
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        server: {
          ...DEFAULT_CONFIG.server,
          maxConcurrentRequests: 200, // 最大100を超えている
        },
      };

      const result = manager.validateConfig(invalidConfig);

      expect(result.ok).toBe(false);
    });
  });

  describe('デフォルト設定生成', () => {
    it('デフォルト設定を生成できる', async () => {
      const manager = new ConfigurationManager({ configPath: testConfigPath });
      await manager.loadConfig();

      // ファイルが生成されていることを確認
      const fileExists = await fs.access(testConfigPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // ファイル内容がデフォルト設定であることを確認
      const fileContent = await fs.readFile(testConfigPath, 'utf-8');
      const savedConfig = JSON.parse(fileContent);
      expect(savedConfig).toEqual(DEFAULT_CONFIG);
    });

    it('デフォルト設定がZodスキーマを満たしている', () => {
      const manager = new ConfigurationManager();
      const result = manager.validateConfig(DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
    });
  });

  describe('環境変数マージ', () => {
    it('環境変数から設定を上書きできる', async () => {
      // 環境変数を設定
      process.env.MCP_LOG_LEVEL = 'debug';
      process.env.MCP_MAX_CONCURRENT_REQUESTS = '20';

      // テスト用設定ファイルを作成
      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');

      const manager = new ConfigurationManager({ configPath: testConfigPath });
      const config = await manager.loadConfig();

      expect(config.logging.level).toBe('debug');
      expect(config.server.maxConcurrentRequests).toBe(20);

      // 環境変数をクリーンアップ
      delete process.env.MCP_LOG_LEVEL;
      delete process.env.MCP_MAX_CONCURRENT_REQUESTS;
    });

    it('存在しない環境変数は無視される', async () => {
      // 環境変数をクリア
      delete process.env.MCP_LOG_LEVEL;
      delete process.env.MCP_MAX_CONCURRENT_REQUESTS;

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');

      const manager = new ConfigurationManager({ configPath: testConfigPath });
      const config = await manager.loadConfig();

      // デフォルト値が維持される
      expect(config.logging.level).toBe(DEFAULT_CONFIG.logging.level);
      expect(config.server.maxConcurrentRequests).toBe(DEFAULT_CONFIG.server.maxConcurrentRequests);
    });

    it('不正な環境変数値はデフォルト値にフォールバックする', async () => {
      // 不正な環境変数を設定
      process.env.MCP_LOG_LEVEL = 'invalid_level';
      process.env.MCP_MAX_CONCURRENT_REQUESTS = 'not_a_number';

      await fs.mkdir(testConfigDir, { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');

      const manager = new ConfigurationManager({ configPath: testConfigPath });
      const config = await manager.loadConfig();

      // デフォルト値にフォールバック
      expect(config.logging.level).toBe(DEFAULT_CONFIG.logging.level);
      expect(config.server.maxConcurrentRequests).toBe(DEFAULT_CONFIG.server.maxConcurrentRequests);

      // 環境変数をクリーンアップ
      delete process.env.MCP_LOG_LEVEL;
      delete process.env.MCP_MAX_CONCURRENT_REQUESTS;
    });
  });

  describe('設定取得', () => {
    it('現在の設定を取得できる', async () => {
      const manager = new ConfigurationManager({ configPath: testConfigPath });
      await manager.loadConfig();

      const config = manager.getConfig();

      expect(config).toBeDefined();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('設定が読み込まれていない場合はnullを返す', () => {
      const manager = new ConfigurationManager();
      const config = manager.getConfig();

      expect(config).toBeNull();
    });
  });
});
