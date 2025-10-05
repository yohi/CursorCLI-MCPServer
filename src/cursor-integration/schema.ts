/**
 * Cursor IDE統合のスキーマ定義
 *
 * Cursor IDEのmcpServers設定フォーマットに対応するための型定義とスキーマ
 */

import { z } from 'zod';

/**
 * MCPサーバー設定スキーマ
 */
export const McpServerConfigSchema = z.object({
  command: z.string().min(1).describe('起動コマンド（例: node, python）'),
  args: z.array(z.string()).default([]).describe('コマンドライン引数'),
  env: z
    .record(z.string())
    .optional()
    .describe('環境変数（${VAR_NAME}形式でプロセス環境変数を参照可能）'),
  disabled: z.boolean().optional().default(false).describe('サーバーの有効/無効状態'),
  cwd: z.string().optional().describe('作業ディレクトリ'),
});

/**
 * MCPサーバー設定型
 */
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

/**
 * Cursor設定のmcpServersセクションスキーマ
 */
export const McpServersSchema = z.record(McpServerConfigSchema);

/**
 * Cursor設定全体のスキーマ
 */
export const CursorSettingsSchema = z.object({
  mcpServers: McpServersSchema.optional().default({}),
  // 他のCursor設定フィールドは必要に応じて追加
});

/**
 * Cursor設定型
 */
export type CursorSettings = z.infer<typeof CursorSettingsSchema>;

/**
 * デフォルトのCursor設定
 */
export const DEFAULT_CURSOR_SETTINGS: CursorSettings = {
  mcpServers: {},
};
