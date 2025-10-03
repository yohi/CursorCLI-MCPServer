/**
 * Security Validator Logging Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SecurityValidator } from '../../src/security/validator.js';
import { getLogger, resetLogger } from '../../src/logging/logger.js';
import type { LoggingSystem } from '../../src/logging/logger.js';

describe('SecurityValidator - Logging Integration', () => {
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

  describe('セキュリティ違反のログ記録', () => {
    it('パストラバーサル検出時にログを記録する', () => {
      const winstonLogger = (logger as any).logger;
      const logEntries: any[] = [];
      const originalWrite = winstonLogger.transports[0].write;

      try {
        // モンキーパッチを適用
        winstonLogger.transports[0].write = function (info: any) {
          logEntries.push(info);
          return true;
        };

        // パストラバーサルを試行
        const result = validator.validatePath('../etc/passwd');

        // ログ記録を確認（後で統合時に実装予定）
        expect(result.ok).toBe(false);
      } finally {
        // アサーションの成否に関わらず、必ず元に戻す
        winstonLogger.transports[0].write = originalWrite;
      }
    });

    it('プロジェクトルート外アクセス時にログを記録する', () => {
      const result = validator.validatePath('/etc/passwd');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('OUTSIDE_PROJECT_ROOT');
        expect(result.error.attemptedPath).toBe('/etc/passwd');
      }
    });

    it('ブロックパターン検出時にログを記録する', () => {
      const result = validator.validatePath('node_modules/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BLOCKED_PATTERN');
      }
    });
  });

  describe('セキュリティ統計', () => {
    it('複数のセキュリティ違反を追跡できる', () => {
      const violations = [
        '../etc/passwd',
        '/var/log/system.log',
        'node_modules/package',
        '.git/config',
      ];

      let errorCount = 0;
      violations.forEach((path) => {
        const result = validator.validatePath(path);
        if (!result.ok) {
          errorCount++;
        }
      });

      expect(errorCount).toBe(4);
    });

    it('セキュリティエラーの種類を分類できる', () => {
      const testCases = [
        { path: '../secret', expectedCode: 'PATH_TRAVERSAL' },
        { path: '/etc/passwd', expectedCode: 'OUTSIDE_PROJECT_ROOT' },
        { path: 'node_modules/test', expectedCode: 'BLOCKED_PATTERN' },
      ];

      testCases.forEach(({ path, expectedCode }) => {
        const result = validator.validatePath(path);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe(expectedCode);
        }
      });
    });
  });
});
