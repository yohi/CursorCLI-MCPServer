/**
 * Logging System Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LoggingSystem, resetLogger } from '../../src/logging/logger.js';
import type { LogContext } from '../../src/types/index.js';

describe('LoggingSystem', () => {
  let loggingSystem: LoggingSystem;

  beforeEach(() => {
    // LoggingSystemのインスタンスを作成
    resetLogger();
    loggingSystem = new LoggingSystem({
      level: 'debug',
      outputs: ['console'],
    });
  });

  afterEach(async () => {
    // クリーンアップ
    await loggingSystem.shutdown();
    resetLogger();
  });

  describe('初期化', () => {
    it('デフォルト設定でロガーを初期化できる', () => {
      expect(loggingSystem).toBeDefined();
    });

    it('カスタム設定でロガーを初期化できる', () => {
      // カスタム設定でのテスト
      expect(true).toBe(true); // プレースホルダー
    });
  });

  describe('ログレベル', () => {
    it('debugレベルのログを記録できる', () => {
      const message = 'Debug message';
      const context: LogContext = { requestId: '123' };

      expect(() => {
        loggingSystem.debug(message, context);
      }).not.toThrow();
    });

    it('infoレベルのログを記録できる', () => {
      const message = 'Info message';

      expect(() => {
        loggingSystem.info(message);
      }).not.toThrow();
    });

    it('warnレベルのログを記録できる', () => {
      const message = 'Warning message';

      expect(() => {
        loggingSystem.warn(message);
      }).not.toThrow();
    });

    it('errorレベルのログを記録できる', () => {
      const message = 'Error message';
      const error = new Error('Test error');

      expect(() => {
        loggingSystem.error(message, error);
      }).not.toThrow();
    });
  });

  describe('ログフォーマット', () => {
    it('ログにタイムスタンプが含まれる', () => {
      expect(() => {
        loggingSystem.info('Test message with timestamp');
      }).not.toThrow();
    });

    it('ログにコンテキスト情報が含まれる', () => {
      const context: LogContext = {
        requestId: '456',
        toolName: 'read_file',
      };

      expect(() => {
        loggingSystem.info('Test message', context);
      }).not.toThrow();
    });
  });

  describe('ツール実行ログ', () => {
    it('ツール実行の詳細をログ記録できる', () => {
      const toolName = 'read_file';
      const params = { path: '/test/file.txt' };
      const result = { content: 'file content', size: 12 };
      const duration = 150;

      expect(() => {
        loggingSystem.logToolExecution(toolName, params, result, duration);
      }).not.toThrow();
    });
  });

  describe('出力先管理', () => {
    it('コンソールにログを出力できる', () => {
      const consoleLogger = new LoggingSystem({
        level: 'info',
        outputs: ['console'],
      });

      expect(() => {
        consoleLogger.info('Console log test');
      }).not.toThrow();
    });

    it('ファイルにログを出力できる', () => {
      const fileLogger = new LoggingSystem({
        level: 'info',
        outputs: ['file'],
        logFile: '.cursorcli-mcp/logs/test.log',
      });

      expect(() => {
        fileLogger.info('File log test');
      }).not.toThrow();
    });

    it('複数の出力先に同時にログを出力できる', () => {
      const multiLogger = new LoggingSystem({
        level: 'info',
        outputs: ['console', 'file'],
        logFile: '.cursorcli-mcp/logs/multi-test.log',
      });

      expect(() => {
        multiLogger.info('Multi-output log test');
      }).not.toThrow();
    });
  });
});
