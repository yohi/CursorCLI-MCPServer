/**
 * Security Validator Implementation
 *
 * ファイルパスのセキュリティ検証を行います。
 * - パストラバーサル検出
 * - プロジェクトルート外アクセス防止
 * - ブロックパターンによるファイル除外
 */

import path from 'path';
import { minimatch } from 'minimatch';
import type { Result } from '../types/index.js';

/**
 * セキュリティエラー
 */
export interface SecurityError {
  code: 'PATH_TRAVERSAL' | 'OUTSIDE_PROJECT_ROOT' | 'BLOCKED_PATTERN';
  message: string;
  attemptedPath: string;
}

/**
 * SecurityValidatorのオプション
 */
export interface SecurityValidatorOptions {
  projectRoot?: string;
  blockedPatterns?: string[];
  enforceProjectRoot?: boolean;
}

const DEFAULT_BLOCKED_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.cursorcli-mcp/**',
];

/**
 * セキュリティバリデーター
 */
export class SecurityValidator {
  private projectRoot: string;
  private blockedPatterns: string[];
  private enforceProjectRoot: boolean;

  constructor(options: SecurityValidatorOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.blockedPatterns = options.blockedPatterns || DEFAULT_BLOCKED_PATTERNS;
    this.enforceProjectRoot = options.enforceProjectRoot !== false;
  }

  /**
   * パスを正規化
   */
  sanitizePath(inputPath: string): string {
    // 相対パスを絶対パスに変換
    const absolutePath = path.isAbsolute(inputPath)
      ? inputPath
      : path.join(this.projectRoot, inputPath);

    // パスを正規化（../ などを解決）
    const normalized = path.normalize(absolutePath);

    // 余分なスラッシュを削除
    return normalized.replace(/\/+/g, '/');
  }

  /**
   * パストラバーサルを検出
   */
  private detectPathTraversal(inputPath: string): boolean {
    // 正規化前のパスに ../ が含まれているかチェック
    if (inputPath.includes('..')) {
      return true;
    }

    // 正規化後のパスがプロジェクトルート外になっていないかチェック
    const sanitized = this.sanitizePath(inputPath);
    return !this.isWithinProjectRoot(sanitized);
  }

  /**
   * プロジェクトルート内かどうかを判定
   */
  isWithinProjectRoot(inputPath: string): boolean {
    const sanitized = this.sanitizePath(inputPath);
    const relativePath = path.relative(this.projectRoot, sanitized);

    // 相対パスが ../ で始まる場合、プロジェクトルート外
    // 空文字列の場合はプロジェクトルート自体なので許可
    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  /**
   * ブロックパターンに一致するかチェック
   */
  private matchesBlockedPattern(inputPath: string): boolean {
    const sanitized = this.sanitizePath(inputPath);
    const relativePath = path.relative(this.projectRoot, sanitized);

    return this.blockedPatterns.some((pattern) => {
      return minimatch(relativePath, pattern, { dot: true });
    });
  }

  /**
   * パスの検証（統合）
   */
  validatePath(inputPath: string): Result<string, SecurityError> {
    try {
      // 1. パストラバーサル検出
      if (this.detectPathTraversal(inputPath)) {
        return {
          ok: false,
          error: {
            code: 'PATH_TRAVERSAL',
            message: 'Path traversal detected. Access denied.',
            attemptedPath: inputPath,
          },
        };
      }

      // 2. 正規化
      const sanitized = this.sanitizePath(inputPath);

      // 3. プロジェクトルート外アクセスチェック
      if (this.enforceProjectRoot && !this.isWithinProjectRoot(sanitized)) {
        return {
          ok: false,
          error: {
            code: 'OUTSIDE_PROJECT_ROOT',
            message: `Access denied. Path is outside project root: ${this.projectRoot}`,
            attemptedPath: inputPath,
          },
        };
      }

      // 4. ブロックパターンチェック
      if (this.matchesBlockedPattern(sanitized)) {
        return {
          ok: false,
          error: {
            code: 'BLOCKED_PATTERN',
            message: 'Access denied. Path matches blocked pattern.',
            attemptedPath: inputPath,
          },
        };
      }

      // 検証成功
      return {
        ok: true,
        value: sanitized,
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'PATH_TRAVERSAL',
          message: error instanceof Error ? error.message : 'Unknown error during path validation',
          attemptedPath: inputPath,
        },
      };
    }
  }

  /**
   * プロジェクトルートの取得
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * ブロックパターンの取得
   */
  getBlockedPatterns(): string[] {
    return [...this.blockedPatterns];
  }
}
