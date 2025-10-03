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
    // path.resolveで相対パスを絶対パスに変換
    // 絶対パスの場合はpath.resolveが第2引数を優先するため、そのまま使用
    const absolutePath = path.resolve(this.projectRoot, inputPath);

    // OS ネイティブのセパレータと正規化を使用
    return path.normalize(absolutePath);
  }

  /**
   * パストラバーサルを検出
   *
   * PATH_TRAVERSALとして扱うのは以下の条件を満たす場合のみ：
   * - 入力が相対パス（絶対パスではない）
   * - 正規化後にプロジェクトルート外に解決される
   *
   * 絶対パスは後続のOUTSIDE_PROJECT_ROOTチェックで処理される
   */
  private detectPathTraversal(inputPath: string): boolean {
    // 絶対パスはパストラバーサルとして扱わない
    // （後続のOUTSIDE_PROJECT_ROOTチェックで処理）
    if (path.isAbsolute(inputPath)) {
      return false;
    }

    // enforceProjectRootが無効の場合、パストラバーサルチェックをスキップ
    if (!this.enforceProjectRoot) {
      return false;
    }

    // 相対パスを正規化して、プロジェクトルート外に解決されるかチェック
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
