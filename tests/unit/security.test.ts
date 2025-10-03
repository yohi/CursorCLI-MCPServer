/**
 * Security Validator Unit Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { SecurityValidator } from '../../src/security/validator.js';

describe('SecurityValidator', () => {
  const projectRoot = '/home/user/project';
  let validator: SecurityValidator;

  beforeEach(() => {
    // テスト前の初期化
    validator = new SecurityValidator({ projectRoot });
  });

  describe('初期化', () => {
    it('プロジェクトルートパスを指定してSecurityValidatorを初期化できる', () => {
      const customValidator = new SecurityValidator({ projectRoot: '/custom/path' });
      expect(customValidator).toBeDefined();
      expect(customValidator.getProjectRoot()).toBe('/custom/path');
    });

    it('プロジェクトルートパスが指定されない場合、デフォルト値を使用する', () => {
      const defaultValidator = new SecurityValidator();
      expect(defaultValidator).toBeDefined();
      expect(defaultValidator.getProjectRoot()).toBe(process.cwd());
    });
  });

  describe('パス正規化', () => {
    it('相対パスを絶対パスに正規化できる', () => {
      const result = validator.sanitizePath('src/index.ts');
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toBe(path.join(projectRoot, 'src/index.ts'));
    });

    it('既に絶対パスの場合はそのまま返す（正規化済み）', () => {
      const absolutePath = path.join(projectRoot, 'file.txt');
      const result = validator.sanitizePath(absolutePath);
      expect(result).toBe(absolutePath);
    });

    it('パス区切り文字を正規化できる', () => {
      const result = validator.sanitizePath('src/./index.ts');
      expect(result).toBe(path.join(projectRoot, 'src/index.ts'));
    });

    it('重複するスラッシュを削除できる', () => {
      const result = validator.sanitizePath('src//index.ts');
      expect(result).toBe(path.join(projectRoot, 'src/index.ts'));
    });
  });

  describe('パストラバーサル検出', () => {
    it('../ を含むパスを検出できる', () => {
      const result = validator.validatePath('../etc/passwd');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PATH_TRAVERSAL');
      }
    });

    it('複数の ../ を含むパスを検出できる', () => {
      const result = validator.validatePath('../../sensitive/data');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PATH_TRAVERSAL');
      }
    });

    it('正規化後にプロジェクトルート外になるパスを検出できる', () => {
      const result = validator.validatePath('src/../../outside');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PATH_TRAVERSAL');
      }
    });

    it('安全なパスは通過させる', () => {
      const result = validator.validatePath('src/index.ts');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(path.join(projectRoot, 'src/index.ts'));
      }
    });
  });

  describe('プロジェクトルート外アクセス検出', () => {
    it('プロジェクトルート外の絶対パスを検出できる', () => {
      const result = validator.validatePath('/etc/passwd');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('OUTSIDE_PROJECT_ROOT');
      }
    });

    it('プロジェクトルート内のパスは許可する', () => {
      const result = validator.validatePath(path.join(projectRoot, 'file.txt'));
      expect(result.ok).toBe(true);
    });

    it('プロジェクトルート自体は許可する', () => {
      const result = validator.validatePath(projectRoot);
      expect(result.ok).toBe(true);
    });

    it('enforceProjectRoot=falseの場合、プロジェクトルート外も許可する', () => {
      const permissiveValidator = new SecurityValidator({
        projectRoot,
        enforceProjectRoot: false,
      });
      const result = permissiveValidator.validatePath('/etc/passwd');
      expect(result.ok).toBe(true);
    });
  });

  describe('ブロックパターンマッチング', () => {
    it('node_modules パターンをブロックできる', () => {
      const result = validator.validatePath('node_modules/package/index.js');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BLOCKED_PATTERN');
      }
    });

    it('.git パターンをブロックできる', () => {
      const result = validator.validatePath('.git/config');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BLOCKED_PATTERN');
      }
    });

    it('カスタムブロックパターンを適用できる', () => {
      const customValidator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['**/*.secret', 'private/**'],
      });

      const result1 = customValidator.validatePath('config.secret');
      expect(result1.ok).toBe(false);

      const result2 = customValidator.validatePath('private/data.txt');
      expect(result2.ok).toBe(false);
    });

    it('ブロックパターンに一致しないパスは許可する', () => {
      const result = validator.validatePath('src/index.ts');
      expect(result.ok).toBe(true);
    });

    it('複数のブロックパターンを評価できる', () => {
      const result1 = validator.validatePath('node_modules/test');
      expect(result1.ok).toBe(false);

      const result2 = validator.validatePath('.git/HEAD');
      expect(result2.ok).toBe(false);

      const result3 = validator.validatePath('dist/bundle.js');
      expect(result3.ok).toBe(false);
    });
  });

  describe('パスバリデーション統合', () => {
    it('有効なパスはバリデーションをパスする', () => {
      const result = validator.validatePath('src/config.json');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(path.join(projectRoot, 'src/config.json'));
      }
    });

    it('パストラバーサルを含むパスはエラーを返す', () => {
      const result = validator.validatePath('../../../etc/passwd');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PATH_TRAVERSAL');
        expect(result.error.message).toContain('Path traversal');
        expect(result.error.attemptedPath).toBe('../../../etc/passwd');
      }
    });

    it('プロジェクトルート外のパスはエラーを返す', () => {
      const result = validator.validatePath('/var/log/system.log');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('OUTSIDE_PROJECT_ROOT');
        expect(result.error.message).toContain('outside project root');
        expect(result.error.attemptedPath).toBe('/var/log/system.log');
      }
    });

    it('ブロックパターンに一致するパスはエラーを返す', () => {
      const result = validator.validatePath('.git/config');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BLOCKED_PATTERN');
        expect(result.error.message).toContain('blocked pattern');
        expect(result.error.attemptedPath).toBe('.git/config');
      }
    });

    it('エラーには適切なコードとメッセージが含まれる', () => {
      const result = validator.validatePath('../secret');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toBeDefined();
        expect(result.error.attemptedPath).toBeDefined();
        expect(['PATH_TRAVERSAL', 'OUTSIDE_PROJECT_ROOT', 'BLOCKED_PATTERN']).toContain(
          result.error.code
        );
      }
    });
  });

  describe('isWithinProjectRoot', () => {
    it('プロジェクトルート内のパスに対してtrueを返す', () => {
      const testPath = path.join(projectRoot, 'src/file.ts');
      expect(validator.isWithinProjectRoot(testPath)).toBe(true);
    });

    it('プロジェクトルート外のパスに対してfalseを返す', () => {
      expect(validator.isWithinProjectRoot('/etc/passwd')).toBe(false);
    });

    it('プロジェクトルート自体に対してtrueを返す', () => {
      expect(validator.isWithinProjectRoot(projectRoot)).toBe(true);
    });

    it('相対パスも正しく判定できる', () => {
      expect(validator.isWithinProjectRoot('src/index.ts')).toBe(true);
      expect(validator.isWithinProjectRoot('../outside')).toBe(false);
    });
  });
});
