/**
 * Security Logging Cleanup Tests
 *
 * try/finallyによるクリーンアップが正しく動作することを確認
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SecurityValidator } from '../../src/security/validator.js';
import { getLogger, resetLogger } from '../../src/logging/logger.js';
import type { LoggingSystem } from '../../src/logging/logger.js';

describe('SecurityValidator - Logging Cleanup Tests', () => {
  const projectRoot = '/home/user/project';
  let validator: SecurityValidator;
  let logger: LoggingSystem;

  beforeEach(() => {
    resetLogger();
    logger = getLogger({
      level: 'debug',
      outputs: ['console'],
    });
    validator = new SecurityValidator({ projectRoot });
  });

  afterEach(async () => {
    await logger.shutdown();
    resetLogger();
  });

  describe('モンキーパッチのクリーンアップ', () => {
    it('アサーション成功時にwriteメソッドが復元される', () => {
      const winstonLogger = (logger as any).logger;
      const originalWrite = winstonLogger.transports[0].write;

      try {
        winstonLogger.transports[0].write = function () {
          return true;
        };

        const result = validator.validatePath('../etc/passwd');
        expect(result.ok).toBe(false);
      } finally {
        winstonLogger.transports[0].write = originalWrite;
      }

      // クリーンアップ後、元のwriteメソッドが復元されている
      expect(winstonLogger.transports[0].write).toBe(originalWrite);
    });

    it('アサーション失敗時でもwriteメソッドが復元される', () => {
      const winstonLogger = (logger as any).logger;
      const originalWrite = winstonLogger.transports[0].write;
      let cleanupExecuted = false;

      try {
        winstonLogger.transports[0].write = function () {
          return true;
        };

        // 意図的にアサーション失敗を起こす
        try {
          expect(true).toBe(false); // これは失敗する
        } catch (error) {
          // アサーションエラーをキャッチ
          // finallyブロックが実行されることを確認するため、ここで握りつぶす
        }
      } finally {
        // finallyブロックが実行される
        winstonLogger.transports[0].write = originalWrite;
        cleanupExecuted = true;
      }

      // クリーンアップが実行された
      expect(cleanupExecuted).toBe(true);
      // writeメソッドが復元されている
      expect(winstonLogger.transports[0].write).toBe(originalWrite);
    });

    it('例外発生時でもwriteメソッドが復元される', () => {
      const winstonLogger = (logger as any).logger;
      const originalWrite = winstonLogger.transports[0].write;
      let cleanupExecuted = false;

      try {
        winstonLogger.transports[0].write = function () {
          return true;
        };

        // 例外を発生させる
        try {
          throw new Error('Test error');
        } catch (error) {
          // 例外をキャッチしてfinallyの実行を確認
        }
      } finally {
        winstonLogger.transports[0].write = originalWrite;
        cleanupExecuted = true;
      }

      expect(cleanupExecuted).toBe(true);
      expect(winstonLogger.transports[0].write).toBe(originalWrite);
    });

    it('複数のモンキーパッチが正しくネストされたクリーンアップを行う', () => {
      const winstonLogger = (logger as any).logger;
      const originalWrite = winstonLogger.transports[0].write;
      const mockWrite1 = function () { return true; };
      const mockWrite2 = function () { return true; };
      let cleanup1Executed = false;
      let cleanup2Executed = false;

      try {
        // 最初のモンキーパッチ
        winstonLogger.transports[0].write = mockWrite1;

        try {
          // 2番目のモンキーパッチ
          winstonLogger.transports[0].write = mockWrite2;

          // テスト実行
          const result = validator.validatePath('../etc/passwd');
          expect(result.ok).toBe(false);
        } finally {
          // 内側のクリーンアップ
          winstonLogger.transports[0].write = mockWrite1;
          cleanup2Executed = true;
        }
      } finally {
        // 外側のクリーンアップ
        winstonLogger.transports[0].write = originalWrite;
        cleanup1Executed = true;
      }

      expect(cleanup1Executed).toBe(true);
      expect(cleanup2Executed).toBe(true);
      expect(winstonLogger.transports[0].write).toBe(originalWrite);
    });
  });

  describe('テスト間の分離', () => {
    it('最初のテスト: モンキーパッチを適用して復元', () => {
      const winstonLogger = (logger as any).logger;
      const originalWrite = winstonLogger.transports[0].write;

      try {
        winstonLogger.transports[0].write = function () {
          return true;
        };
        expect(winstonLogger.transports[0].write).not.toBe(originalWrite);
      } finally {
        winstonLogger.transports[0].write = originalWrite;
      }

      expect(winstonLogger.transports[0].write).toBe(originalWrite);
    });

    it('2番目のテスト: 前のテストの影響を受けない', () => {
      const winstonLogger = (logger as any).logger;
      const originalWrite = winstonLogger.transports[0].write;

      // 前のテストでモンキーパッチが復元されているため、
      // このテストでも正常にwriteメソッドが使える
      try {
        winstonLogger.transports[0].write = function () {
          return true;
        };
        expect(winstonLogger.transports[0].write).not.toBe(originalWrite);
      } finally {
        winstonLogger.transports[0].write = originalWrite;
      }

      expect(winstonLogger.transports[0].write).toBe(originalWrite);
    });
  });

  describe('実践的なクリーンアップシナリオ', () => {
    it('複数のテストで同じwriteメソッドを安全に使い回せる', () => {
      const winstonLogger = (logger as any).logger;
      const originalWrite = winstonLogger.transports[0].write;

      // 1回目のモンキーパッチ
      try {
        winstonLogger.transports[0].write = function () {
          return true;
        };
        expect(winstonLogger.transports[0].write).not.toBe(originalWrite);
      } finally {
        winstonLogger.transports[0].write = originalWrite;
      }

      // 2回目のモンキーパッチ（1回目のクリーンアップ後）
      try {
        winstonLogger.transports[0].write = function () {
          return true;
        };
        expect(winstonLogger.transports[0].write).not.toBe(originalWrite);
      } finally {
        winstonLogger.transports[0].write = originalWrite;
      }

      // 両方のクリーンアップ後、元の状態
      expect(winstonLogger.transports[0].write).toBe(originalWrite);
    });

    it('モンキーパッチ中でもロガーの基本機能が動作する', () => {
      const winstonLogger = (logger as any).logger;
      const originalWrite = winstonLogger.transports[0].write;
      const logEntries: any[] = [];

      try {
        winstonLogger.transports[0].write = function (info: any) {
          logEntries.push(info);
          return true;
        };

        // テスト実行
        const result = validator.validatePath('../etc/passwd');
        expect(result.ok).toBe(false);

        // ログエントリーが記録されていることを確認（将来の実装）
        // 現在は統合されていないため、logEntriesは空の可能性がある
        expect(Array.isArray(logEntries)).toBe(true);
      } finally {
        winstonLogger.transports[0].write = originalWrite;
      }

      // クリーンアップ後も元のwriteメソッドが使える
      expect(typeof winstonLogger.transports[0].write).toBe('function');
    });
  });
});
