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

    it('カスタム設定でロガーを初期化できる', async () => {
      // カスタム設定でロガーを作成
      const customLogger = new LoggingSystem({
        level: 'debug',
        outputs: ['console'],
      });

      // Winston の内部ロガーにアクセスして設定を確認
      const winstonLogger = (customLogger as any).logger;
      expect(winstonLogger).toBeDefined();
      expect(winstonLogger.level).toBe('debug');

      // トランスポートが正しく設定されているか確認
      expect(winstonLogger.transports).toBeDefined();
      expect(winstonLogger.transports.length).toBeGreaterThan(0);

      // ログ出力のモック化（log メソッドを使用）
      const logMessages: Array<{ level: string; message: string }> = [];
      const originalLog = winstonLogger.transports[0].log;

      winstonLogger.transports[0].log = function (info: any, callback: any) {
        logMessages.push({ level: info.level, message: info.message });
        if (callback) callback();
      };

      // 各ログレベルでメッセージを記録
      customLogger.debug('Debug message');
      customLogger.info('Info message');
      customLogger.warn('Warn message');
      customLogger.error('Error message');

      // debug レベルではすべてのメッセージが記録されることを確認
      expect(logMessages.length).toBe(4);
      expect(logMessages[0].message).toBe('Debug message');
      expect(logMessages[1].message).toBe('Info message');
      expect(logMessages[2].message).toBe('Warn message');
      expect(logMessages[3].message).toBe('Error message');

      // モックを元に戻す
      winstonLogger.transports[0].log = originalLog;

      // クリーンアップ
      await customLogger.shutdown();
    });

    it('ログレベルが info の場合、debug メッセージは抑制される', async () => {
      // info レベルのロガーを作成
      const infoLogger = new LoggingSystem({
        level: 'info',
        outputs: ['console'],
      });

      const winstonLogger = (infoLogger as any).logger;
      expect(winstonLogger.level).toBe('info');

      // ログ出力のモック化（log メソッドを使用）
      const logMessages: Array<{ level: string; message: string }> = [];
      const originalLog = winstonLogger.transports[0].log;

      winstonLogger.transports[0].log = function (info: any, callback: any) {
        logMessages.push({ level: info.level, message: info.message });
        if (callback) callback();
      };

      // 各ログレベルでメッセージを記録
      infoLogger.debug('Debug message'); // 抑制されるはず
      infoLogger.info('Info message');
      infoLogger.warn('Warn message');
      infoLogger.error('Error message');

      // info レベルでは debug が抑制され、3件のみ記録される
      expect(logMessages.length).toBe(3);
      expect(logMessages.find(m => m.message === 'Debug message')).toBeUndefined();
      expect(logMessages[0].message).toBe('Info message');
      expect(logMessages[1].message).toBe('Warn message');
      expect(logMessages[2].message).toBe('Error message');

      // モックを元に戻す
      winstonLogger.transports[0].log = originalLog;

      // クリーンアップ
      await infoLogger.shutdown();
    });
  });

  describe('ログレベル', () => {
    it('debugレベルのログを記録できる', () => {
      const message = 'Debug message';
      const context: LogContext = { requestId: '123' };

      // Winston の内部ロガーにアクセスしてモック化
      const winstonLogger = (loggingSystem as any).logger;
      const logEntries: any[] = [];
      const originalWrite = winstonLogger.transports[0].write;

      winstonLogger.transports[0].write = function (info: any) {
        logEntries.push(info);
        return true;
      };

      // ログを記録
      loggingSystem.debug(message, context);

      // 検証: ログエントリが正しく記録されているか
      expect(logEntries.length).toBe(1);
      expect(logEntries[0].level).toBe('debug');
      expect(logEntries[0].message).toBe(message);
      expect(logEntries[0].requestId).toBe('123');

      // モックを元に戻す
      winstonLogger.transports[0].write = originalWrite;
    });

    it('infoレベルのログを記録できる', () => {
      const message = 'Info message';

      // Winston の内部ロガーにアクセスしてモック化
      const winstonLogger = (loggingSystem as any).logger;
      const logEntries: any[] = [];
      const originalWrite = winstonLogger.transports[0].write;

      winstonLogger.transports[0].write = function (info: any) {
        logEntries.push(info);
        return true;
      };

      // ログを記録
      loggingSystem.info(message);

      // 検証: ログエントリが正しく記録されているか
      expect(logEntries.length).toBe(1);
      expect(logEntries[0].level).toBe('info');
      expect(logEntries[0].message).toBe(message);

      // モックを元に戻す
      winstonLogger.transports[0].write = originalWrite;
    });

    it('warnレベルのログを記録できる', () => {
      const message = 'Warning message';
      const error = new Error('Test warning');

      // Winston の内部ロガーにアクセスしてモック化
      const winstonLogger = (loggingSystem as any).logger;
      const logEntries: any[] = [];
      const originalWrite = winstonLogger.transports[0].write;

      winstonLogger.transports[0].write = function (info: any) {
        logEntries.push(info);
        return true;
      };

      // ログを記録
      loggingSystem.warn(message, error);

      // 検証: ログエントリが正しく記録されているか
      expect(logEntries.length).toBe(1);
      expect(logEntries[0].level).toBe('warn');
      expect(logEntries[0].message).toBe(message);
      expect(logEntries[0].error).toBeDefined();
      expect(logEntries[0].error.name).toBe('Error');
      expect(logEntries[0].error.message).toBe('Test warning');
      expect(logEntries[0].error.stack).toBeDefined();

      // モックを元に戻す
      winstonLogger.transports[0].write = originalWrite;
    });

    it('errorレベルのログを記録できる', () => {
      const message = 'Error message';
      const error = new Error('Test error');

      // Winston の内部ロガーにアクセスしてモック化
      const winstonLogger = (loggingSystem as any).logger;
      const logEntries: any[] = [];
      const originalWrite = winstonLogger.transports[0].write;

      winstonLogger.transports[0].write = function (info: any) {
        logEntries.push(info);
        return true;
      };

      // ログを記録
      loggingSystem.error(message, error);

      // 検証: ログエントリが正しく記録されているか
      expect(logEntries.length).toBe(1);
      expect(logEntries[0].level).toBe('error');
      expect(logEntries[0].message).toBe(message);
      expect(logEntries[0].error).toBeDefined();
      expect(logEntries[0].error.name).toBe('Error');
      expect(logEntries[0].error.message).toBe('Test error');
      expect(logEntries[0].error.stack).toBeDefined();

      // モックを元に戻す
      winstonLogger.transports[0].write = originalWrite;
    });

    it('ログレベル設定により低優先度のメッセージが抑制される', () => {
      // Winston の内部ロガーにアクセスしてモック化
      const winstonLogger = (loggingSystem as any).logger;
      const logEntries: any[] = [];
      const originalLog = winstonLogger.transports[0].log;
      const originalLevel = winstonLogger.level;

      // log メソッドをオーバーライド（write ではなく log を使用）
      winstonLogger.transports[0].log = function (info: any, callback: any) {
        logEntries.push(info);
        if (callback) callback();
      };

      // ログレベルを 'warn' に設定
      loggingSystem.setLevel('warn');

      // 各レベルのログを記録
      loggingSystem.debug('Debug message'); // 抑制されるはず
      loggingSystem.info('Info message');   // 抑制されるはず
      loggingSystem.warn('Warn message');   // 記録されるはず
      loggingSystem.error('Error message'); // 記録されるはず

      // 検証: warn と error のみが記録されている
      expect(logEntries.length).toBe(2);
      expect(logEntries[0].level).toBe('warn');
      expect(logEntries[0].message).toBe('Warn message');
      expect(logEntries[1].level).toBe('error');
      expect(logEntries[1].message).toBe('Error message');

      // モックとログレベルを元に戻す
      winstonLogger.transports[0].log = originalLog;
      winstonLogger.level = originalLevel;
      loggingSystem.setLevel('debug');
    });
  });

  describe('ログフォーマット', () => {
    it('ログにタイムスタンプが含まれる', () => {
      // Winston の内部ロガーにアクセスしてモック化
      const winstonLogger = (loggingSystem as any).logger;
      const logEntries: any[] = [];
      const originalWrite = winstonLogger.transports[0].write;

      winstonLogger.transports[0].write = function (info: any) {
        logEntries.push(info);
        return true;
      };

      // ログを記録
      loggingSystem.info('Test message with timestamp');

      // 検証: タイムスタンプが含まれている
      expect(logEntries.length).toBe(1);
      expect(logEntries[0].message).toBe('Test message with timestamp');
      expect(logEntries[0].timestamp).toBeDefined();
      expect(typeof logEntries[0].timestamp).toBe('string');

      // モックを元に戻す
      winstonLogger.transports[0].write = originalWrite;
    });

    it('ログにコンテキスト情報が含まれる', () => {
      const context: LogContext = {
        requestId: '456',
        toolName: 'read_file',
      };

      // Winston の内部ロガーにアクセスしてモック化
      const winstonLogger = (loggingSystem as any).logger;
      const logEntries: any[] = [];
      const originalWrite = winstonLogger.transports[0].write;

      winstonLogger.transports[0].write = function (info: any) {
        logEntries.push(info);
        return true;
      };

      // ログを記録
      loggingSystem.info('Test message', context);

      // 検証: コンテキスト情報が含まれている
      expect(logEntries.length).toBe(1);
      expect(logEntries[0].message).toBe('Test message');
      expect(logEntries[0].requestId).toBe('456');
      expect(logEntries[0].toolName).toBe('read_file');

      // モックを元に戻す
      winstonLogger.transports[0].write = originalWrite;
    });
  });

  describe('ツール実行ログ', () => {
    it('ツール実行の詳細をログ記録できる', () => {
      const toolName = 'read_file';
      const params = { path: '/test/file.txt' };
      const result = { content: 'file content', size: 12 };
      const duration = 150;

      // Winston の内部ロガーにアクセスしてモック化
      const winstonLogger = (loggingSystem as any).logger;
      const logEntries: any[] = [];
      const originalWrite = winstonLogger.transports[0].write;

      winstonLogger.transports[0].write = function (info: any) {
        logEntries.push(info);
        return true;
      };

      // ツール実行ログを記録
      loggingSystem.logToolExecution(toolName, params, result, duration);

      // 検証: ツール実行の詳細が正しく記録されている
      expect(logEntries.length).toBe(1);
      expect(logEntries[0].level).toBe('info');
      expect(logEntries[0].message).toBe('Tool execution');
      expect(logEntries[0].toolName).toBe(toolName);
      expect(logEntries[0].params).toEqual(params);
      expect(logEntries[0].result).toEqual(result);
      expect(logEntries[0].duration).toBe(duration);
      expect(logEntries[0].timestamp).toBeDefined();

      // モックを元に戻す
      winstonLogger.transports[0].write = originalWrite;
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
