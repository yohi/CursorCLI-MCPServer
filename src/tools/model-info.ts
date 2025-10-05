/**
 * Model Info Tool
 *
 * モデル情報管理ツール実装
 * Requirements: 10.1, 10.2, 10.3, 10.6, 10.7
 */

import { z } from 'zod';

/**
 * Cursor Model API インターフェース
 *
 * Cursor Composerからモデル情報を取得するAPI
 */
export interface CursorModelAPI {
  getCurrentModel(): Promise<ModelInfo>;
}

/**
 * モデル情報
 */
export interface ModelInfo {
  name: string;
  provider: string;
  version?: string;
  contextWindow: number;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
}

/**
 * get_current_model ツールのスキーマ
 */
export const GetCurrentModelSchema = z.object({});

export type GetCurrentModelParams = z.infer<typeof GetCurrentModelSchema>;

/**
 * track_token_usage ツールのスキーマ
 */
export const TrackTokenUsageSchema = z.object({
  modelName: z.string().describe('モデル名'),
  inputTokens: z.number().min(0).describe('入力トークン数'),
  outputTokens: z.number().min(0).describe('出力トークン数'),
  duration: z.number().min(0).describe('実行時間（ミリ秒）'),
});

export type TrackTokenUsageParams = z.infer<typeof TrackTokenUsageSchema>;

/**
 * get_model_statistics ツールのスキーマ
 */
export const GetModelStatisticsSchema = z.object({});

export type GetModelStatisticsParams = z.infer<typeof GetModelStatisticsSchema>;

/**
 * モデル統計情報
 */
export interface ModelStatistics {
  totalSessions: number;
  totalTokensUsed: {
    input: number;
    output: number;
  };
  estimatedCost: number;
  averageDuration: number;
  modelBreakdown: Record<string, ModelUsage>;
}

/**
 * モデル使用状況
 */
export interface ModelUsage {
  count: number;
  tokens: {
    input: number;
    output: number;
  };
  averageDuration: number;
}

/**
 * トークン使用記録
 */
interface TokenUsageRecord {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  duration: number;
  timestamp: Date;
}

/**
 * Model Info Tool
 *
 * Requirement 10.1, 10.2, 10.7: 現在のモデル情報取得
 * Requirement 10.3, 10.6: トークン使用量追跡
 */
export class ModelInfoTool {
  private usageRecords: TokenUsageRecord[] = [];
  private lastModelInfo: ModelInfo | null = null;

  // デフォルトモデル情報（モデル情報取得失敗時の fallback）
  private readonly DEFAULT_MODEL_INFO: ModelInfo = {
    name: 'unknown',
    provider: 'unknown',
    contextWindow: 4096,
  };

  constructor(private readonly modelAPI: CursorModelAPI) {}

  /**
   * 現在のモデル情報を取得
   *
   * Requirement 10.1: Cursor Composerで選択されているモデル情報を取得
   * Requirement 10.2: 現在選択されているAIモデルの情報を返却
   * Requirement 10.7: モデル情報取得失敗時のデフォルト値返却
   */
  async getCurrentModel(): Promise<ModelInfo> {
    try {
      const modelInfo = await this.modelAPI.getCurrentModel();

      // モデル切り替え検知（Requirement 10.3）
      if (this.lastModelInfo && this.lastModelInfo.name !== modelInfo.name) {
        console.log(`Model changed from ${this.lastModelInfo.name} to ${modelInfo.name}`);
      }

      this.lastModelInfo = modelInfo;
      return modelInfo;
    } catch (error) {
      // Requirement 10.7: モデル情報取得失敗時はデフォルト値を返却
      console.warn('Failed to get current model info, using default:', error);
      return this.DEFAULT_MODEL_INFO;
    }
  }

  /**
   * トークン使用量を追跡
   *
   * Requirement 10.3: 入力/出力トークン数の記録
   * Requirement 10.6: トークン消費量の追跡
   */
  async trackTokenUsage(params: TrackTokenUsageParams): Promise<void> {
    const record: TokenUsageRecord = {
      modelName: params.modelName,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      duration: params.duration,
      timestamp: new Date(),
    };

    this.usageRecords.push(record);
  }

  /**
   * モデル統計情報を取得
   *
   * Requirement 10.6: トークン消費量と統計情報の提供
   */
  async getModelStatistics(): Promise<ModelStatistics> {
    if (this.usageRecords.length === 0) {
      return {
        totalSessions: 0,
        totalTokensUsed: { input: 0, output: 0 },
        estimatedCost: 0,
        averageDuration: 0,
        modelBreakdown: {},
      };
    }

    const totalSessions = this.usageRecords.length;
    const totalTokensUsed = this.usageRecords.reduce(
      (acc, record) => ({
        input: acc.input + record.inputTokens,
        output: acc.output + record.outputTokens,
      }),
      { input: 0, output: 0 }
    );

    const totalDuration = this.usageRecords.reduce((acc, record) => acc + record.duration, 0);
    const averageDuration = totalDuration / totalSessions;

    // モデル別の統計
    const modelBreakdown: Record<string, ModelUsage> = {};

    for (const record of this.usageRecords) {
      if (!modelBreakdown[record.modelName]) {
        modelBreakdown[record.modelName] = {
          count: 0,
          tokens: { input: 0, output: 0 },
          averageDuration: 0,
        };
      }

      const breakdown = modelBreakdown[record.modelName];
      breakdown.count += 1;
      breakdown.tokens.input += record.inputTokens;
      breakdown.tokens.output += record.outputTokens;
    }

    // 各モデルの平均実行時間を計算
    for (const modelName in modelBreakdown) {
      const records = this.usageRecords.filter((r) => r.modelName === modelName);
      const totalDuration = records.reduce((acc, r) => acc + r.duration, 0);
      modelBreakdown[modelName].averageDuration = totalDuration / records.length;
    }

    // 推定コストの計算
    let estimatedCost = 0;
    try {
      const currentModel = await this.modelAPI.getCurrentModel();
      if (currentModel.costPer1kTokens) {
        const inputCost = (totalTokensUsed.input / 1000) * currentModel.costPer1kTokens.input;
        const outputCost = (totalTokensUsed.output / 1000) * currentModel.costPer1kTokens.output;
        estimatedCost = inputCost + outputCost;
      }
    } catch (error) {
      // コスト情報取得失敗時は0とする
      console.warn('Failed to calculate cost:', error);
    }

    return {
      totalSessions,
      totalTokensUsed,
      estimatedCost,
      averageDuration,
      modelBreakdown,
    };
  }
}
