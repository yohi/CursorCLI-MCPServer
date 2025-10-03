/**
 * Tool Executor
 *
 * ツール実行エンジン
 * Requirements: 5.4, 8.1, 8.2
 */

import type { ToolRegistry } from './registry.js';
import type { CallToolResult } from './types.js';

/**
 * 実行設定
 */
export interface ExecutorConfig {
  maxConcurrency: number;
  timeoutMs: number;
}

/**
 * セマフォ（並行実行制御）
 */
class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--;
      return () => this.release();
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.permits--;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.permits++;

    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

/**
 * Tool Executor
 *
 * Requirement 5.4: 同時に複数のツール呼び出しリクエストを受信した際、各リクエストを独立して処理
 * Requirement 8.1: ツール実行時間が5秒を超過した場合、タイムアウトエラーを返却
 * Requirement 8.2: 同時接続数が設定された最大値に達した場合、新規接続を拒否
 */
export class ToolExecutor {
  private registry: ToolRegistry;
  private semaphore: Semaphore;
  private timeoutMs: number;

  constructor(registry: ToolRegistry, config: ExecutorConfig) {
    this.registry = registry;
    this.semaphore = new Semaphore(config.maxConcurrency);
    this.timeoutMs = config.timeoutMs;
  }

  /**
   * ツールを実行する
   */
  async execute(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<CallToolResult> {
    // ツールの存在確認
    const tool = this.registry.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // 並行実行制御
    const release = await this.semaphore.acquire();

    try {
      // パラメータのバリデーション
      const validatedParams = tool.schema.parse(params);

      // タイムアウト付きでツールを実行
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Tool execution timeout exceeded: ${this.timeoutMs}ms`));
        }, this.timeoutMs);
      });

      const executionPromise = tool.handler(validatedParams);

      const result = await Promise.race([executionPromise, timeoutPromise]);

      return result;
    } finally {
      release();
    }
  }
}
