/**
 * グローバルエラーハンドラー
 * Task 9.3: グローバルエラーハンドラーと例外処理
 */

/**
 * グローバルエラーハンドラークラス
 */
export class GlobalErrorHandler {
  private uncaughtExceptionHandler?: (error: Error) => void;
  private unhandledRejectionHandler?: (
    reason: unknown,
    promise: Promise<unknown>
  ) => void;
  private shutdownCallback?: () => void | Promise<void>;

  /**
   * グローバルエラーハンドラーをセットアップ
   * 複数回呼び出しても安全（冪等性）
   */
  public setup(): void {
    // 既存のリスナーをクリーンアップ
    this.cleanup();

    // 未捕捉の例外をハンドリング
    this.uncaughtExceptionHandler = (error: Error) => {
      this.handleUncaughtException(error);
    };
    process.on('uncaughtException', this.uncaughtExceptionHandler);

    // 未処理のPromise拒否をハンドリング
    this.unhandledRejectionHandler = (
      reason: unknown,
      promise: Promise<unknown>
    ) => {
      this.handleUnhandledRejection(reason, promise);
    };
    process.on('unhandledRejection', this.unhandledRejectionHandler);
  }

  /**
   * シャットダウンコールバックを設定
   */
  public setShutdownCallback(callback: () => void | Promise<void>): void {
    this.shutdownCallback = callback;
  }

  /**
   * グローバルエラーハンドラーをクリーンアップ
   */
  public cleanup(): void {
    if (this.uncaughtExceptionHandler) {
      process.off('uncaughtException', this.uncaughtExceptionHandler);
      this.uncaughtExceptionHandler = undefined;
    }

    if (this.unhandledRejectionHandler) {
      process.off('unhandledRejection', this.unhandledRejectionHandler);
      this.unhandledRejectionHandler = undefined;
    }
  }

  /**
   * 未捕捉の例外をハンドリング
   */
  private handleUncaughtException(error: Error): void {
    console.error('Uncaught Exception:', error.name, '-', error.message);
    console.error('Stack:', error.stack);

    // グレースフルシャットダウンを実行
    this.performGracefulShutdown()
      .then(() => {
        process.exit(1);
      })
      .catch((shutdownError) => {
        console.error('Error during graceful shutdown:', shutdownError);
        process.exit(1);
      });
  }

  /**
   * 未処理のPromise拒否をハンドリング
   */
  private handleUnhandledRejection(
    reason: unknown,
    _promise: Promise<unknown>
  ): void {
    const errorMessage =
      reason instanceof Error
        ? `${reason.name} - ${reason.message}`
        : String(reason);

    console.error('Unhandled Promise Rejection:', errorMessage);

    if (reason instanceof Error && reason.stack) {
      console.error('Stack:', reason.stack);
    }

    // グレースフルシャットダウンを実行
    this.performGracefulShutdown()
      .then(() => {
        process.exit(1);
      })
      .catch((shutdownError) => {
        console.error('Error during graceful shutdown:', shutdownError);
        process.exit(1);
      });
  }

  /**
   * グレースフルシャットダウンを実行
   */
  private async performGracefulShutdown(): Promise<void> {
    if (!this.shutdownCallback) {
      return;
    }

    try {
      const result = this.shutdownCallback();
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      console.error('Error in shutdown callback:', error);
      // シャットダウンコールバックのエラーは無視して処理を継続
    }
  }
}
