/**
 * File Operations Tools
 *
 * ファイル操作ツールの実装
 * Requirements: 2.1-2.6
 */

import { z } from 'zod';
import * as fs from 'node:fs/promises';
// import * as path from 'node:path'; // TODO: タスク5.2, 5.3で使用
import type { CallToolResult } from '../protocol/types.js';
import type { SecurityValidator } from '../security/index.js';

/**
 * read_file ツールのスキーマ
 *
 * Requirement 2.1: ファイル読み込み機能
 */
export const ReadFileSchema = z.object({
  path: z.string().describe('読み取るファイルの相対パスまたは絶対パス'),
  encoding: z.enum(['utf-8', 'utf-16le', 'binary']).default('utf-8').optional().describe('ファイルエンコーディング'),
  offset: z.number().min(0).optional().describe('読み取り開始位置（バイト）'),
  length: z.number().min(1).max(10_000_000).optional().describe('読み取りサイズ（バイト、最大10MB）')
});

export type ReadFileParams = z.infer<typeof ReadFileSchema>;

/**
 * ファイル読み込みツール
 *
 * Requirements:
 * - 2.1: ファイル内容の読み込み
 * - 2.4: セキュリティ検証（プロジェクトルート外アクセス拒否）
 * - 2.5: エラーハンドリング
 * - 8.3: 大容量ファイル処理（10MB制限）
 */
export async function readFile(
  params: ReadFileParams,
  securityValidator: SecurityValidator
): Promise<CallToolResult> {
  try {
    // パラメータバリデーション
    const validated = ReadFileSchema.parse(params);

    // セキュリティ検証
    const pathValidation = securityValidator.validatePath(validated.path);
    if (!pathValidation.ok) {
      return {
        content: [{
          type: 'text',
          text: `Security error: ${pathValidation.error.code} - ${pathValidation.error.message}`
        }],
        isError: true
      };
    }

    const safePath = pathValidation.value;

    // ファイル存在確認
    try {
      await fs.access(safePath, fs.constants.R_OK);
    } catch {
      return {
        content: [{
          type: 'text',
          text: `File not found or not accessible: ${validated.path}`
        }],
        isError: true
      };
    }

    // ファイル情報取得
    const stats = await fs.stat(safePath);
    const fileSize = stats.size;

    // エンコーディングの処理
    const encoding = validated.encoding || 'utf-8';
    let content: string;
    let truncated = false;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    if (encoding === 'binary') {
      // バイナリファイルの読み込み
      const buffer = await fs.readFile(safePath);
      if (buffer.length > MAX_FILE_SIZE) {
        truncated = true;
        content = buffer.subarray(0, MAX_FILE_SIZE).toString('base64');
      } else {
        content = buffer.toString('base64');
      }
    } else {
      // テキストファイルの読み込み
      const nodeEncoding = encoding === 'utf-16le' ? 'utf16le' : 'utf8';

      if (fileSize > MAX_FILE_SIZE) {
        // 大容量ファイルの場合は切り詰め
        truncated = true;
        const buffer = Buffer.alloc(MAX_FILE_SIZE);
        const fd = await fs.open(safePath, 'r');
        try {
          await fd.read(buffer, 0, MAX_FILE_SIZE, 0);
          content = buffer.toString(nodeEncoding);
        } finally {
          await fd.close();
        }
      } else {
        content = await fs.readFile(safePath, nodeEncoding);
      }
    }

    // メタデータを含めたレスポンス
    const responseText = JSON.stringify({
      content,
      size: fileSize,
      encoding,
      truncated,
      lastModified: stats.mtime.toISOString()
    }, null, 2);

    return {
      content: [{
        type: 'text',
        text: responseText
      }],
      isError: false
    };

  } catch (error) {
    // バリデーションエラーやその他のエラー
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text',
        text: `Error reading file: ${errorMessage}`
      }],
      isError: true
    };
  }
}

/**
 * write_file ツールのスキーマ
 *
 * Requirement 2.2: ファイル書き込み機能
 */
export const WriteFileSchema = z.object({
  path: z.string().describe('書き込み先ファイルの相対パスまたは絶対パス'),
  content: z.string().describe('書き込む内容'),
  encoding: z.enum(['utf-8', 'utf-16le']).default('utf-8').optional().describe('ファイルエンコーディング'),
  createDirectories: z.boolean().default(false).describe('親ディレクトリの自動作成'),
  overwrite: z.boolean().default(true).describe('既存ファイルの上書き許可')
});

export type WriteFileParams = z.infer<typeof WriteFileSchema>;

/**
 * ファイル書き込みツール
 *
 * TODO: タスク5.2で実装
 */
export async function writeFile(
  _params: WriteFileParams,
  _securityValidator: SecurityValidator
): Promise<CallToolResult> {
  // タスク5.2で実装
  return {
    content: [{
      type: 'text',
      text: 'Not implemented yet'
    }],
    isError: true
  };
}

/**
 * list_directory ツールのスキーマ
 *
 * Requirement 2.3: ディレクトリ一覧取得
 */
export const ListDirectorySchema = z.object({
  path: z.string().describe('一覧を取得するディレクトリパス'),
  recursive: z.boolean().default(false).describe('サブディレクトリの再帰的取得'),
  includeHidden: z.boolean().default(false).describe('隠しファイルの含有'),
  pattern: z.string().optional().describe('ファイル名のglob パターン（例: *.ts）')
});

export type ListDirectoryParams = z.infer<typeof ListDirectorySchema>;

/**
 * ディレクトリ一覧取得ツール
 *
 * TODO: タスク5.3で実装
 */
export async function listDirectory(
  _params: ListDirectoryParams,
  _securityValidator: SecurityValidator
): Promise<CallToolResult> {
  // タスク5.3で実装
  return {
    content: [{
      type: 'text',
      text: 'Not implemented yet'
    }],
    isError: true
  };
}
