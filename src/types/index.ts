/**
 * 型定義ファイル
 *
 * プロジェクト全体で使用される共通型を定義します。
 */

/**
 * Result型 - 成功または失敗を表現する型
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * ログコンテキスト
 */
export interface LogContext {
  requestId?: string | number;
  toolName?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Position - エディタ内の位置
 */
export interface Position {
  line: number;
  column: number;
}

/**
 * ファイルエントリ
 */
export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  lastModified: string;
  permissions: string;
}
