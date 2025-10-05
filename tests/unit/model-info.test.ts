/**
 * Model Info Tool Tests
 *
 * モデル情報管理ツールのテスト
 * Requirements: 10.1, 10.2, 10.3, 10.6, 10.7
 */

import {
  ModelInfoTool,
  GetCurrentModelSchema,
  TrackTokenUsageSchema,
  GetModelStatisticsSchema
} from '../../src/tools/model-info.js';
import type { CursorModelAPI } from '../../src/tools/model-info.js';

describe('ModelInfoTool', () => {
  let modelInfoTool: ModelInfoTool;
  let mockModelAPI: CursorModelAPI;

  beforeEach(() => {
    // モックAPI
    mockModelAPI = {
      getCurrentModel: jest.fn().mockResolvedValue({
        name: 'gpt-4',
        provider: 'openai',
        version: 'gpt-4-0613',
        contextWindow: 8192,
        costPer1kTokens: { input: 0.03, output: 0.06 }
      })
    };

    modelInfoTool = new ModelInfoTool(mockModelAPI);
  });

  describe('get_current_model', () => {
    describe('正常系', () => {
      it('現在のモデル情報を正しく取得できる', async () => {
        const result = await modelInfoTool.getCurrentModel();

        expect(result).toEqual({
          name: 'gpt-4',
          provider: 'openai',
          version: 'gpt-4-0613',
          contextWindow: 8192,
          costPer1kTokens: { input: 0.03, output: 0.06 }
        });
        expect(mockModelAPI.getCurrentModel).toHaveBeenCalledTimes(1);
      });

      it('バージョン情報が無いモデルも正しく取得できる', async () => {
        mockModelAPI.getCurrentModel = jest.fn().mockResolvedValue({
          name: 'claude-3-opus',
          provider: 'anthropic',
          contextWindow: 200000
        });

        const result = await modelInfoTool.getCurrentModel();

        expect(result).toEqual({
          name: 'claude-3-opus',
          provider: 'anthropic',
          contextWindow: 200000,
          version: undefined,
          costPer1kTokens: undefined
        });
      });

      it('スキーマが空オブジェクトを許可する', () => {
        const validation = GetCurrentModelSchema.safeParse({});
        expect(validation.success).toBe(true);
      });
    });

    describe('異常系', () => {
      it('モデル情報取得失敗時にデフォルト値を返す', async () => {
        mockModelAPI.getCurrentModel = jest.fn().mockRejectedValue(new Error('API Error'));

        const result = await modelInfoTool.getCurrentModel();

        expect(result).toEqual({
          name: 'unknown',
          provider: 'unknown',
          contextWindow: 4096
        });
      });

      it('部分的なモデル情報でもエラーにならない', async () => {
        mockModelAPI.getCurrentModel = jest.fn().mockResolvedValue({
          name: 'test-model'
        });

        const result = await modelInfoTool.getCurrentModel();

        expect(result.name).toBe('test-model');
        expect(result.provider).toBeUndefined();
      });
    });
  });

  describe('track_token_usage', () => {
    describe('正常系', () => {
      it('トークン使用量を正しく記録できる', async () => {
        const params = {
          modelName: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          duration: 1500
        };

        await modelInfoTool.trackTokenUsage(params);

        const stats = await modelInfoTool.getModelStatistics();
        expect(stats.totalSessions).toBe(1);
        expect(stats.totalTokensUsed.input).toBe(100);
        expect(stats.totalTokensUsed.output).toBe(50);
        expect(stats.modelBreakdown['gpt-4']).toBeDefined();
        expect(stats.modelBreakdown['gpt-4'].count).toBe(1);
      });

      it('複数のセッションのトークンを累積できる', async () => {
        await modelInfoTool.trackTokenUsage({
          modelName: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          duration: 1500
        });

        await modelInfoTool.trackTokenUsage({
          modelName: 'gpt-4',
          inputTokens: 200,
          outputTokens: 100,
          duration: 2000
        });

        const stats = await modelInfoTool.getModelStatistics();
        expect(stats.totalSessions).toBe(2);
        expect(stats.totalTokensUsed.input).toBe(300);
        expect(stats.totalTokensUsed.output).toBe(150);
        expect(stats.modelBreakdown['gpt-4'].count).toBe(2);
      });

      it('異なるモデルのトークンを別々に記録できる', async () => {
        await modelInfoTool.trackTokenUsage({
          modelName: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          duration: 1500
        });

        await modelInfoTool.trackTokenUsage({
          modelName: 'claude-3-opus',
          inputTokens: 200,
          outputTokens: 100,
          duration: 2000
        });

        const stats = await modelInfoTool.getModelStatistics();
        expect(stats.modelBreakdown['gpt-4']).toBeDefined();
        expect(stats.modelBreakdown['claude-3-opus']).toBeDefined();
        expect(stats.modelBreakdown['gpt-4'].count).toBe(1);
        expect(stats.modelBreakdown['claude-3-opus'].count).toBe(1);
      });

      it('スキーマが正しいパラメータを検証する', () => {
        const validation = TrackTokenUsageSchema.safeParse({
          modelName: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          duration: 1500
        });
        expect(validation.success).toBe(true);
      });
    });

    describe('異常系', () => {
      it('負のトークン数を拒否する', () => {
        const validation = TrackTokenUsageSchema.safeParse({
          modelName: 'gpt-4',
          inputTokens: -100,
          outputTokens: 50,
          duration: 1500
        });
        expect(validation.success).toBe(false);
      });

      it('負の実行時間を拒否する', () => {
        const validation = TrackTokenUsageSchema.safeParse({
          modelName: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          duration: -1500
        });
        expect(validation.success).toBe(false);
      });

      it('必須フィールドが欠けている場合にエラーになる', () => {
        const validation = TrackTokenUsageSchema.safeParse({
          inputTokens: 100
        });
        expect(validation.success).toBe(false);
      });
    });
  });

  describe('get_model_statistics', () => {
    describe('正常系', () => {
      it('統計情報を正しく計算できる', async () => {
        await modelInfoTool.trackTokenUsage({
          modelName: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          duration: 1500
        });

        await modelInfoTool.trackTokenUsage({
          modelName: 'gpt-4',
          inputTokens: 200,
          outputTokens: 100,
          duration: 2500
        });

        const stats = await modelInfoTool.getModelStatistics();

        expect(stats.totalSessions).toBe(2);
        expect(stats.totalTokensUsed.input).toBe(300);
        expect(stats.totalTokensUsed.output).toBe(150);
        expect(stats.averageDuration).toBe(2000); // (1500 + 2500) / 2
        expect(stats.modelBreakdown['gpt-4'].averageDuration).toBe(2000);
      });

      it('推定コストを正しく計算できる', async () => {
        // gpt-4のコスト: input $0.03, output $0.06 per 1k tokens
        await modelInfoTool.trackTokenUsage({
          modelName: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 1000,
          duration: 1500
        });

        const stats = await modelInfoTool.getModelStatistics();

        // (1000/1000 * 0.03) + (1000/1000 * 0.06) = 0.09
        expect(stats.estimatedCost).toBe(0.09);
      });

      it('モデル切替時も各レコードの単価で正しくコスト計算できる', async () => {
        // gpt-4で記録 (input $0.03, output $0.06)
        await modelInfoTool.trackTokenUsage({
          modelName: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 1000,
          duration: 1500
        });

        // モデルを変更
        mockModelAPI.getCurrentModel = jest.fn().mockResolvedValue({
          name: 'claude-3-opus',
          provider: 'anthropic',
          contextWindow: 200000,
          costPer1kTokens: { input: 0.015, output: 0.075 }
        });

        // claude-3-opusで記録 (input $0.015, output $0.075)
        await modelInfoTool.trackTokenUsage({
          modelName: 'claude-3-opus',
          inputTokens: 2000,
          outputTokens: 2000,
          duration: 2000
        });

        const stats = await modelInfoTool.getModelStatistics();

        // gpt-4: (1000/1000 * 0.03) + (1000/1000 * 0.06) = 0.09
        // claude-3-opus: (2000/1000 * 0.015) + (2000/1000 * 0.075) = 0.18
        // 合計: 0.09 + 0.18 = 0.27
        expect(stats.estimatedCost).toBeCloseTo(0.27, 5);
      });

      it('コスト情報が無いモデルはコストを0とする', async () => {
        mockModelAPI.getCurrentModel = jest.fn().mockResolvedValue({
          name: 'unknown-model',
          provider: 'unknown',
          contextWindow: 4096
        });

        await modelInfoTool.trackTokenUsage({
          modelName: 'unknown-model',
          inputTokens: 1000,
          outputTokens: 1000,
          duration: 1500
        });

        const stats = await modelInfoTool.getModelStatistics();
        expect(stats.estimatedCost).toBe(0);
      });

      it('データが無い場合は初期統計を返す', async () => {
        const stats = await modelInfoTool.getModelStatistics();

        expect(stats.totalSessions).toBe(0);
        expect(stats.totalTokensUsed.input).toBe(0);
        expect(stats.totalTokensUsed.output).toBe(0);
        expect(stats.estimatedCost).toBe(0);
        expect(stats.averageDuration).toBe(0);
        expect(Object.keys(stats.modelBreakdown)).toHaveLength(0);
      });

      it('スキーマが空オブジェクトを許可する', () => {
        const validation = GetModelStatisticsSchema.safeParse({});
        expect(validation.success).toBe(true);
      });
    });
  });

  describe('モデル切り替え検知', () => {
    it('モデル変更を検知してログに記録する', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      // 最初のモデル取得
      await modelInfoTool.getCurrentModel();

      // モデルを変更
      mockModelAPI.getCurrentModel = jest.fn().mockResolvedValue({
        name: 'claude-3-opus',
        provider: 'anthropic',
        contextWindow: 200000
      });

      // 再度取得
      await modelInfoTool.getCurrentModel();

      // モデル変更ログが記録されることを確認
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Model changed'));

      logSpy.mockRestore();
    });
  });
});
