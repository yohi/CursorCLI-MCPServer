/**
 * グローバルエラーハンドラーのテスト
 * Task 9.3: グローバルエラーハンドラーと例外処理
 */

import { GlobalErrorHandler } from '../../src/errors/global-handler';

describe('GlobalErrorHandler', () => {
  let globalErrorHandler: GlobalErrorHandler;
  let processExitSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    globalErrorHandler = new GlobalErrorHandler();
    // process.exitをモック
    processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    // console.errorをモック
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    globalErrorHandler.cleanup();
    processExitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('setup', () => {
    it('グローバルエラーハンドラーをセットアップできること', () => {
      const listenersBefore = process.listenerCount('uncaughtException');

      globalErrorHandler.setup();

      const listenersAfter = process.listenerCount('uncaughtException');
      expect(listenersAfter).toBeGreaterThan(listenersBefore);
    });

    it('未処理のPromise拒否をハンドリングできること', () => {
      const listenersBefore = process.listenerCount('unhandledRejection');

      globalErrorHandler.setup();

      const listenersAfter = process.listenerCount('unhandledRejection');
      expect(listenersAfter).toBeGreaterThan(listenersBefore);
    });

    it('複数回呼び出してもリスナーが増えないこと（冪等性）', () => {
      globalErrorHandler.setup();
      const listenersAfterFirst = process.listenerCount('uncaughtException');

      globalErrorHandler.setup();
      const listenersAfterSecond = process.listenerCount('uncaughtException');

      globalErrorHandler.setup();
      const listenersAfterThird = process.listenerCount('uncaughtException');

      expect(listenersAfterSecond).toBe(listenersAfterFirst);
      expect(listenersAfterThird).toBe(listenersAfterFirst);
    });

    it('複数回呼び出してもPromise拒否リスナーが増えないこと', () => {
      globalErrorHandler.setup();
      const listenersAfterFirst = process.listenerCount('unhandledRejection');

      globalErrorHandler.setup();
      const listenersAfterSecond = process.listenerCount('unhandledRejection');

      globalErrorHandler.setup();
      const listenersAfterThird = process.listenerCount('unhandledRejection');

      expect(listenersAfterSecond).toBe(listenersAfterFirst);
      expect(listenersAfterThird).toBe(listenersAfterFirst);
    });
  });

  describe('handleUncaughtException', () => {
    it('未捕捉の例外をログに記録すること', () => {
      const error = new Error('未捕捉の例外');

      globalErrorHandler.setup();
      process.emit('uncaughtException', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      // console.errorは複数回呼ばれる
      const allCalls = consoleErrorSpy.mock.calls
        .map((call) => call.join(' '))
        .join(' ');
      expect(allCalls).toContain('Uncaught Exception');
      expect(allCalls).toContain('未捕捉の例外');
    });

    it('プロセスを終了すること', (done) => {
      const error = new Error('クリティカルエラー');

      globalErrorHandler.setup();
      process.emit('uncaughtException', error);

      // 非同期処理を待つ
      setTimeout(() => {
        expect(processExitSpy).toHaveBeenCalledWith(1);
        done();
      }, 100);
    });
  });

  describe('handleUnhandledRejection', () => {
    it('未処理のPromise拒否をログに記録すること', () => {
      const reason = new Error('Promise拒否');
      const promise = Promise.reject(reason).catch(() => {
        /* テスト内でエラーを吸収 */
      });

      globalErrorHandler.setup();
      process.emit('unhandledRejection', reason, promise);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const allCalls = consoleErrorSpy.mock.calls
        .map((call) => call.join(' '))
        .join(' ');
      expect(allCalls).toContain('Unhandled Promise Rejection');
      expect(allCalls).toContain('Promise拒否');
    });

    it('プロセスを終了すること', (done) => {
      const reason = new Error('重大なPromise拒否');
      const promise = Promise.reject(reason).catch(() => {
        /* テスト内でエラーを吸収 */
      });

      globalErrorHandler.setup();
      process.emit('unhandledRejection', reason, promise);

      // 非同期処理を待つ
      setTimeout(() => {
        expect(processExitSpy).toHaveBeenCalledWith(1);
        done();
      }, 100);
    });

    it('理由が文字列の場合も処理できること', () => {
      const reason = 'Promise拒否の理由（文字列）';
      const promise = Promise.reject(reason).catch(() => {
        /* テスト内でエラーを吸収 */
      });

      globalErrorHandler.setup();
      process.emit('unhandledRejection', reason, promise);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const allCalls = consoleErrorSpy.mock.calls
        .map((call) => call.join(' '))
        .join(' ');
      expect(allCalls).toContain(reason);
    });
  });

  describe('cleanup', () => {
    it('グローバルエラーハンドラーをクリーンアップできること', () => {
      globalErrorHandler.setup();
      const listenersAfterSetup =
        process.listenerCount('uncaughtException');

      globalErrorHandler.cleanup();

      const listenersAfterCleanup =
        process.listenerCount('uncaughtException');
      expect(listenersAfterCleanup).toBeLessThan(listenersAfterSetup);
    });

    it('未処理のPromise拒否のリスナーをクリーンアップできること', () => {
      globalErrorHandler.setup();
      const listenersAfterSetup =
        process.listenerCount('unhandledRejection');

      globalErrorHandler.cleanup();

      const listenersAfterCleanup =
        process.listenerCount('unhandledRejection');
      expect(listenersAfterCleanup).toBeLessThan(listenersAfterSetup);
    });
  });

  describe('グレースフルシャットダウン', () => {
    it('エラー発生時にグレースフルシャットダウンを実行すること', (done) => {
      const shutdownCallback = jest.fn();
      globalErrorHandler.setShutdownCallback(shutdownCallback);

      const error = new Error('シャットダウンテスト');

      globalErrorHandler.setup();
      process.emit('uncaughtException', error);

      // 非同期処理を待つ
      setTimeout(() => {
        expect(shutdownCallback).toHaveBeenCalled();
        done();
      }, 100);
    });

    it('シャットダウンコールバックが例外を投げても処理を継続すること', (done) => {
      const shutdownCallback = jest.fn(() => {
        throw new Error('シャットダウンエラー');
      });
      globalErrorHandler.setShutdownCallback(shutdownCallback);

      const error = new Error('テストエラー');

      globalErrorHandler.setup();
      process.emit('uncaughtException', error);

      // 非同期処理を待つ
      setTimeout(() => {
        expect(shutdownCallback).toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(1);
        done();
      }, 100);
    });
  });
});
