/**
 * File Operations Tool
 *
 * ファイルシステム操作（読み取り、書き込み、ディレクトリ一覧）のMCPツール実装
 * Requirements: 2.1-2.6, 8.3
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type { SecurityValidator } from '../security/validator.js';

/**
 * read_file ツールのスキーマ
 */
export const ReadFileSchema = z.object({
  path: z.string().describe('読み取るファイルの相対パスまたは絶対パス'),
  encoding: z.enum(['utf-8', 'utf-16le', 'binary']).default('utf-8').optional(),
  offset: z.number().min(0).optional().describe('読み取り開始位置（バイト）'),
  length: z.number().min(1).max(10_000_000).optional().describe('読み取りサイズ（バイト、最大10MB）')
});

export type ReadFileParams = z.infer<typeof ReadFileSchema>;

/**
 * read_file ツールの結果
 */
export interface ReadFileResult {
  content: string;
  size: number;
  encoding: string;
  truncated: boolean;
  lastModified: string;
}

/**
 * write_file ツールのスキーマ
 */
export const WriteFileSchema = z.object({
  path: z.string().describe('書き込み先ファイルの相対パスまたは絶対パス'),
  content: z.string().describe('書き込む内容'),
  encoding: z.enum(['utf-8', 'utf-16le']).optional().describe('エンコーディング'),
  createDirectories: z.boolean().optional().describe('親ディレクトリの自動作成'),
  overwrite: z.boolean().optional().describe('既存ファイルの上書き許可')
});

export type WriteFileParams = z.infer<typeof WriteFileSchema>;

/**
 * write_file ツールの結果
 */
export interface WriteFileResult {
  success: boolean;
  path: string;
  size: number;
  created: boolean;
}

/**
 * File Operations Tool
 *
 * Requirement 2.1-2.6: ファイル操作機能のMCPツール化
 * Requirement 8.3: 大容量ファイルの分割読み込み
 */
export class FileOperationsTool {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  constructor(
    private securityValidator: SecurityValidator,
    private projectRoot: string
  ) {}

  /**
   * ファイルを読み込む
   *
   * Requirement 2.1: ファイル内容の読み取りとJSON形式での返却
   * Requirement 2.4: プロジェクトルート外アクセスの拒否
   * Requirement 2.5: 詳細なエラー情報の返却
   * Requirement 2.6: 相対パスの解決
   * Requirement 8.3: 大容量ファイルの処理
   */
  async readFile(params: ReadFileParams): Promise<ReadFileResult> {
    // パラメータのバリデーション
    const validated = ReadFileSchema.parse(params);

    // パスの解決（相対パス対応）
    const resolvedPath = path.isAbsolute(validated.path)
      ? validated.path
      : path.join(this.projectRoot, validated.path);

    // セキュリティ検証
    const securityResult = this.securityValidator.validatePath(resolvedPath);
    if (!securityResult.ok) {
      throw new Error(`Security error: ${securityResult.error.message}`);
    }

    try {
      // ファイルの存在確認と統計情報取得
      const stats = await fs.stat(resolvedPath);

      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${validated.path}`);
      }

      // エンコーディングの処理
      const encoding = validated.encoding || 'utf-8';
      let content: string;
      let actualSize: number;
      let truncated = false;

      if (encoding === 'binary') {
        // バイナリファイルの読み込み
        const buffer = await this.readFileWithLimits(
          resolvedPath,
          validated.offset,
          validated.length
        );
        content = buffer.toString('base64');
        actualSize = buffer.length;
        truncated = stats.size > this.MAX_FILE_SIZE && !validated.length;
      } else {
        // テキストファイルの読み込み
        const buffer = await this.readFileWithLimits(
          resolvedPath,
          validated.offset,
          validated.length
        );

        // エンコーディングに応じて変換
        if (encoding === 'utf-16le') {
          content = buffer.toString('utf16le');
        } else {
          content = buffer.toString('utf8');
        }

        actualSize = buffer.length;
        truncated = stats.size > this.MAX_FILE_SIZE && !validated.length;
      }

      return {
        content,
        size: actualSize,
        encoding,
        truncated,
        lastModified: stats.mtime.toISOString()
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${validated.path}`);
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new Error(`Permission denied: ${validated.path}`);
      }
      throw error;
    }
  }

  /**
   * ファイルをサイズ制限付きで読み込む
   */
  private async readFileWithLimits(
    filePath: string,
    offset?: number,
    length?: number
  ): Promise<Buffer> {
    const stats = await fs.stat(filePath);

    // 読み取り範囲の決定
    const startOffset = Math.max(0, offset ?? 0);

    // offsetがファイルサイズ以上の場合は空バッファを返す
    if (startOffset >= stats.size) {
      return Buffer.alloc(0);
    }

    const maxLength = Math.min(length ?? this.MAX_FILE_SIZE, this.MAX_FILE_SIZE);
    const remaining = stats.size - startOffset;
    const actualLength = Math.min(maxLength, remaining);

    // ファイルハンドルを開いて部分的に読み込み
    const fileHandle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(actualLength);
      await fileHandle.read(buffer, 0, actualLength, startOffset);
      return buffer;
    } finally {
      await fileHandle.close();
    }
  }

  /**
   * ファイルに書き込む
   *
   * Requirement 2.2: ファイル書き込みと成功/失敗ステータスの返却
   * Requirement 2.4: プロジェクトルート外アクセスの拒否
   * Requirement 2.5: 詳細なエラー情報の返却
   * Requirement 2.6: 相対パスの解決
   * Requirement 5.5: 破壊的操作の確認フラグチェック
   */
  async writeFile(params: WriteFileParams): Promise<WriteFileResult> {
    // パラメータのバリデーション
    const validated = WriteFileSchema.parse(params);

    // パスの解決（相対パス対応）
    const resolvedPath = path.isAbsolute(validated.path)
      ? validated.path
      : path.join(this.projectRoot, validated.path);

    // セキュリティ検証
    const securityResult = this.securityValidator.validatePath(resolvedPath);
    if (!securityResult.ok) {
      throw new Error(`Security error: ${securityResult.error.message}`);
    }

    try {
      // ファイルの存在確認
      let fileExists = false;
      try {
        const stats = await fs.stat(resolvedPath);
        fileExists = stats.isFile();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      // デフォルト値の設定
      const overwrite = validated.overwrite ?? true;
      const createDirectories = validated.createDirectories ?? false;
      const encoding = validated.encoding || 'utf-8';

      // 上書き確認
      if (fileExists && !overwrite) {
        throw new Error(`File already exists and overwrite is disabled: ${validated.path}`);
      }

      // 親ディレクトリの作成
      const dirPath = path.dirname(resolvedPath);
      if (createDirectories) {
        await fs.mkdir(dirPath, { recursive: true });
      }

      // エンコーディングに応じて書き込み
      const writeEncoding = encoding === 'utf-16le' ? 'utf16le' : 'utf8';

      await fs.writeFile(resolvedPath, validated.content, writeEncoding as BufferEncoding);

      // 書き込み後のファイルサイズを取得
      const stats = await fs.stat(resolvedPath);

      return {
        success: true,
        path: resolvedPath,
        size: stats.size,
        created: !fileExists
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Parent directory does not exist: ${path.dirname(validated.path)}`);
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new Error(`Permission denied: ${validated.path}`);
      }
      throw error;
    }
  }
}
