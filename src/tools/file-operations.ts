/**
 * File Operations Tool
 *
 * ファイルシステム操作（読み取り、書き込み、ディレクトリ一覧）のMCPツール実装
 * Requirements: 2.1-2.6, 8.3
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { minimatch } from 'minimatch';
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
 * list_directory ツールのスキーマ
 */
export const ListDirectorySchema = z.object({
  path: z.string().describe('一覧を取得するディレクトリパス'),
  recursive: z.boolean().default(false).optional().describe('サブディレクトリの再帰的取得'),
  includeHidden: z.boolean().default(false).optional().describe('隠しファイルの含有'),
  pattern: z.string().optional().describe('ファイル名のglob パターン（例: *.ts）')
});

export type ListDirectoryParams = z.infer<typeof ListDirectorySchema>;

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

/**
 * list_directory ツールの結果
 */
export interface ListDirectoryResult {
  entries: FileEntry[];
  totalCount: number;
  path: string;
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

      const fileSize = stats.size;
      const encoding = validated.encoding || 'utf-8';

      // 読み取りオフセットと長さの決定
      const readOffset = validated.offset ?? 0;
      const availableBytes = Math.max(0, fileSize - readOffset);
      const requestedLength = validated.length ?? Math.min(availableBytes, this.MAX_FILE_SIZE);
      const desiredLength = Math.min(requestedLength, this.MAX_FILE_SIZE, availableBytes);

      // truncatedフラグの判定
      // 1. lengthが未指定で、利用可能バイト数がMAX_FILE_SIZEを超える場合
      // 2. lengthが指定されたが、実際に読める長さがそれより小さい場合
      const truncated =
        (validated.length === undefined && availableBytes > this.MAX_FILE_SIZE) ||
        (validated.length !== undefined && desiredLength < validated.length);

      let content: string;
      let buffer: Buffer;

      // フルファイル高速パス: offset=0 かつ desiredLength >= fileSize の場合
      if (readOffset === 0 && desiredLength >= fileSize) {
        buffer = await fs.readFile(resolvedPath);
      } else {
        // 部分読み込み: ファイルディスクリプタを使用
        const fileHandle = await fs.open(resolvedPath, 'r');
        try {
          buffer = Buffer.alloc(desiredLength);
          const { bytesRead } = await fileHandle.read(buffer, 0, desiredLength, readOffset);
          // 実際に読み取られたバイト数がdesiredLengthより少ない場合、バッファをスライス
          if (bytesRead < desiredLength) {
            buffer = buffer.slice(0, bytesRead);
          }
        } finally {
          await fileHandle.close();
        }
      }

      // エンコーディングに応じて変換
      if (encoding === 'binary') {
        content = buffer.toString('base64');
      } else if (encoding === 'utf-16le') {
        content = buffer.toString('utf16le');
      } else {
        content = buffer.toString('utf8');
      }

      return {
        content,
        size: buffer.length,
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

  /**
   * ディレクトリの内容を一覧取得する
   *
   * Requirement 2.3: ディレクトリ内容のリスト形式での返却
   * Requirement 2.4: プロジェクトルート外アクセスの拒否
   * Requirement 2.5: 詳細なエラー情報の返却
   * Requirement 2.6: 相対パスの解決
   */
  async listDirectory(params: ListDirectoryParams): Promise<ListDirectoryResult> {
    // パラメータのバリデーション
    const validated = ListDirectorySchema.parse(params);

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
      // ディレクトリの存在確認
      const stats = await fs.stat(resolvedPath);

      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${validated.path}`);
      }

      // デフォルト値の設定
      const recursive = validated.recursive ?? false;
      const includeHidden = validated.includeHidden ?? false;
      const pattern = validated.pattern;

      // エントリを収集
      const entries: FileEntry[] = [];
      await this.collectEntries(resolvedPath, entries, {
        recursive,
        includeHidden,
        pattern,
        basePath: resolvedPath
      });

      return {
        entries,
        totalCount: entries.length,
        path: resolvedPath
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Directory not found: ${validated.path}`);
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new Error(`Permission denied: ${validated.path}`);
      }
      throw error;
    }
  }

  /**
   * ディレクトリエントリを再帰的に収集する
   */
  private async collectEntries(
    dirPath: string,
    entries: FileEntry[],
    options: {
      recursive: boolean;
      includeHidden: boolean;
      pattern?: string;
      basePath: string;
    }
  ): Promise<void> {
    const dirEntries = await fs.readdir(dirPath);

    for (const entryName of dirEntries) {
      // 隠しファイルのフィルタリング
      if (!options.includeHidden && entryName.startsWith('.')) {
        continue;
      }

      const entryPath = path.join(dirPath, entryName);

      // lstatを使用（シンボリックリンクをそのまま扱う）
      const stats = await fs.lstat(entryPath);

      // エントリタイプの判定
      let type: 'file' | 'directory' | 'symlink';
      if (stats.isSymbolicLink()) {
        type = 'symlink';
      } else if (stats.isDirectory()) {
        type = 'directory';
      } else {
        type = 'file';
      }

      // globパターンマッチング
      if (options.pattern && !minimatch(entryName, options.pattern)) {
        // パターンにマッチしない場合はスキップ
        // ただし、再帰処理の場合はディレクトリは処理を続ける
        if (!options.recursive || type !== 'directory') {
          continue;
        }
      }

      // パーミッション文字列の生成（8進数）
      const permissions = (stats.mode & 0o777).toString(8).padStart(3, '0');

      // エントリを追加（パターンマッチする場合、またはディレクトリで再帰モードの場合）
      if (!options.pattern || minimatch(entryName, options.pattern) || (options.recursive && type === 'directory')) {
        entries.push({
          name: entryName,
          path: entryPath,
          type,
          size: type === 'directory' ? 0 : stats.size,
          lastModified: stats.mtime.toISOString(),
          permissions
        });
      }

      // 再帰的にサブディレクトリを処理
      if (options.recursive && type === 'directory') {
        await this.collectEntries(entryPath, entries, options);
      }
    }
  }
}
