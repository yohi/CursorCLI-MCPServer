/**
 * Tool Executor のユニットテスト
 *
 * Requirements:
 * - 5.4: 同時に複数のツール呼び出しリクエストを受信した際、各リクエストを独立して処理
 * - 8.1: ツール実行時間が5秒を超過した場合、タイムアウトエラーを返却
 * - 8.2: 同時接続数が設定された最大値に達した場合、新規接続を拒否
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ToolExecutor } from '../../src/protocol/executor';
import { ToolRegistry } from '../../src/protocol/registry';
import { z } from 'zod';

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new ToolExecutor(registry, {
      maxConcurrency: 3,
      timeoutMs: 1000
    });
  });

  describe('ツール実行', () => {
    beforeEach(() => {
      const schema = z.object({
        value: z.string()
      });

      registry.register({
        name: 'echo',
        description: 'エコーツール',
        schema,
        handler: async (params) => ({
          content: [{ type: 'text', text: params.value }]
        })
      });
    });

    it('登録されたツールを実行できる', async () => {
      const result = await executor.execute('echo', { value: 'hello' });

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'hello'
      });
    });

    it('パラメータのバリデーションが成功する', async () => {
      const result = await executor.execute('echo', { value: 'test' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'test'
      });
    });

    it('パラメータのバリデーションが失敗するとエラーを返す', async () => {
      await expect(
        executor.execute('echo', { invalid: 'param' })
      ).rejects.toThrow();
    });

    it('存在しないツールを実行しようとするとエラーをスローする', async () => {
      await expect(
        executor.execute('non_existent', {})
      ).rejects.toThrow('Tool not found: non_existent');
    });

    it('無効化されたツールを実行しようとするとエラーをスローする', async () => {
      // ツールを無効化
      registry.disable('echo');

      // 実行しようとするとエラー
      await expect(
        executor.execute('echo', { value: 'test' })
      ).rejects.toThrow('Tool disabled: echo');
    });

    it('無効化されたツールはセマフォを消費しない', async () => {
      // ツールを無効化
      registry.disable('echo');

      // 無効化されたツールを実行しようとする（セマフォは消費されない）
      await expect(
        executor.execute('echo', { value: 'test' })
      ).rejects.toThrow('Tool disabled: echo');

      // その後、有効なツールは正常に実行できる（セマフォが消費されていないことを確認）
      registry.enable('echo');
      const result = await executor.execute('echo', { value: 'hello' });
      expect(result.content[0]).toEqual({ type: 'text', text: 'hello' });
    });
  });

  describe('タイムアウト制御', () => {
    beforeEach(() => {
      const schema = z.object({
        delay: z.number()
      });

      registry.register({
        name: 'slow_tool',
        description: '遅いツール',
        schema,
        handler: async (params) => {
          await new Promise(resolve => setTimeout(resolve, params.delay));
          return { content: [{ type: 'text', text: 'done' }] };
        }
      });
    });

    it('タイムアウト時間内に完了するツールは正常に実行される', async () => {
      const result = await executor.execute('slow_tool', { delay: 100 });

      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'done'
      });
    });

    it('タイムアウト時間を超過するとタイムアウトエラーをスローする', async () => {
      await expect(
        executor.execute('slow_tool', { delay: 2000 })
      ).rejects.toThrow(/timeout|exceeded/i);
    }, 3000);
  });

  describe('並行実行制御', () => {
    beforeEach(() => {
      const schema = z.object({
        id: z.number(),
        delay: z.number()
      });

      registry.register({
        name: 'concurrent_tool',
        description: '並行実行テストツール',
        schema,
        handler: async (params) => {
          await new Promise(resolve => setTimeout(resolve, params.delay));
          return {
            content: [{ type: 'text', text: `result-${params.id}` }]
          };
        }
      });
    });

    it('最大並行数以内であれば複数のツールを同時実行できる', async () => {
      const promises = [
        executor.execute('concurrent_tool', { id: 1, delay: 100 }),
        executor.execute('concurrent_tool', { id: 2, delay: 100 }),
        executor.execute('concurrent_tool', { id: 3, delay: 100 })
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect((results[0].content[0] as any).text).toBe('result-1');
      expect((results[1].content[0] as any).text).toBe('result-2');
      expect((results[2].content[0] as any).text).toBe('result-3');
    });

    it('最大並行数を超えるリクエストは即座に拒否される', async () => {
      // 3つの長時間実行タスクを開始（最大並行数=3）
      const longRunningPromises = [
        executor.execute('concurrent_tool', { id: 1, delay: 500 }),
        executor.execute('concurrent_tool', { id: 2, delay: 500 }),
        executor.execute('concurrent_tool', { id: 3, delay: 500 })
      ];

      // 4つ目のリクエストは即座にエラーをスローする（Requirement 8.2）
      await expect(
        executor.execute('concurrent_tool', { id: 4, delay: 100 })
      ).rejects.toThrow(/maximum concurrent executions/i);

      // 既存の3つのタスクは正常に完了する
      const results = await Promise.all(longRunningPromises);
      expect(results).toHaveLength(3);
    });

    it('各リクエストは独立して処理される', async () => {
      const results = await Promise.all([
        executor.execute('concurrent_tool', { id: 1, delay: 50 }),
        executor.execute('concurrent_tool', { id: 2, delay: 100 }),
        executor.execute('concurrent_tool', { id: 3, delay: 25 })
      ]);

      // 各結果が正しく対応していることを確認
      const texts = results.map((r: any) => r.content[0].text);
      expect(texts).toContain('result-1');
      expect(texts).toContain('result-2');
      expect(texts).toContain('result-3');
    });
  });

  describe('エラーハンドリング', () => {
    beforeEach(() => {
      const schema = z.object({
        shouldFail: z.boolean()
      });

      registry.register({
        name: 'error_tool',
        description: 'エラーテストツール',
        schema,
        handler: async (params) => {
          if (params.shouldFail) {
            throw new Error('Tool execution failed');
          }
          return { content: [{ type: 'text', text: 'success' }] };
        }
      });
    });

    it('ツール実行中のエラーを適切にキャッチする', async () => {
      await expect(
        executor.execute('error_tool', { shouldFail: true })
      ).rejects.toThrow('Tool execution failed');
    });

    it('エラーが発生しても他のリクエストに影響しない', async () => {
      const results = await Promise.allSettled([
        executor.execute('error_tool', { shouldFail: true }),
        executor.execute('error_tool', { shouldFail: false })
      ]);

      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('fulfilled');
      if (results[1].status === 'fulfilled') {
        expect((results[1].value.content[0] as any).text).toBe('success');
      }
    });
  });
});
