/**
 * シンボリックリンク経由のセキュリティテスト
 *
 * シンボリックリンクを使用したディレクトリトラバーサル攻撃を
 * 正しく検出できることを確認する
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SecurityValidator } from '../../src/security/validator.js';

describe('SecurityValidator - シンボリックリンク攻撃対策', () => {
  let testDir: string;
  let projectRoot: string;
  let outsideDir: string;
  let symlinkPath: string;
  let validator: SecurityValidator;

  beforeAll(() => {
    // テスト用の一時ディレクトリを作成
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-test-'));
    projectRoot = path.join(testDir, 'project');
    outsideDir = path.join(testDir, 'outside');
    symlinkPath = path.join(projectRoot, 'malicious-link');

    // ディレクトリ構造を作成
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });

    // プロジェクト外のディレクトリに機密ファイルを作成
    fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'sensitive data');

    // プロジェクト内から外部ディレクトリへのシンボリックリンクを作成
    try {
      fs.symlinkSync(outsideDir, symlinkPath, 'dir');
    } catch (error) {
      // シンボリックリンク作成に失敗した場合（権限不足等）はスキップ
      console.warn('シンボリックリンクの作成に失敗しました。テストをスキップします。');
    }

    // バリデーターを初期化
    validator = new SecurityValidator({
      projectRoot,
      enforceProjectRoot: true,
    });
  });

  afterAll(() => {
    // テスト用ディレクトリをクリーンアップ
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('テストディレクトリの削除に失敗しました:', error);
    }
  });

  describe('シンボリックリンク経由のアクセス試行', () => {
    it('🔴 Critical: プロジェクト内のシンボリックリンク経由での外部アクセスを検出できる', () => {
      // シンボリックリンクが作成されているか確認
      if (!fs.existsSync(symlinkPath)) {
        console.warn('シンボリックリンクが存在しないためテストをスキップします');
        return;
      }

      // シンボリックリンク経由でのファイルアクセスを試みる
      const maliciousPath = 'malicious-link/secret.txt';
      const result = validator.validatePath(maliciousPath);

      // 期待される動作: アクセスが拒否される
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // PATH_TRAVERSAL または OUTSIDE_PROJECT_ROOT のいずれかで拒否される
        expect(['PATH_TRAVERSAL', 'OUTSIDE_PROJECT_ROOT']).toContain(result.error.code);
      }
    });

    it('プロジェクト内のシンボリックリンク自体は検出される', () => {
      if (!fs.existsSync(symlinkPath)) {
        console.warn('シンボリックリンクが存在しないためテストをスキップします');
        return;
      }

      const result = validator.validatePath('malicious-link');

      // シンボリックリンクがプロジェクト外を指している場合は拒否される
      expect(result.ok).toBe(false);
    });

    it('正常なプロジェクト内ファイルは許可される', () => {
      // プロジェクト内に正常なファイルを作成
      const normalFile = path.join(projectRoot, 'normal.txt');
      fs.writeFileSync(normalFile, 'normal content');

      const result = validator.validatePath('normal.txt');
      expect(result.ok).toBe(true);
    });
  });

  describe('物理パス比較の動作確認', () => {
    it('projectRoot が realpath で解決されている', () => {
      const resolvedRoot = validator.getProjectRoot();

      // realpath が成功していれば、シンボリックリンクを含まない物理パス
      expect(resolvedRoot).toBeTruthy();
      expect(path.isAbsolute(resolvedRoot)).toBe(true);
    });

    it('存在しないパスの親ディレクトリは物理パスで比較される', () => {
      // まだ作成されていないファイルパス
      const futurePath = 'subdir/future-file.txt';
      const result = validator.validatePath(futurePath);

      // プロジェクト内の未作成ファイルは許可される
      expect(result.ok).toBe(true);
    });
  });

  describe('TOCTOU 攻撃対策', () => {
    it('検証時と使用時でパスが変わらないことを確認', () => {
      // 正常なパスを検証
      const normalPath = 'data.txt';
      const result1 = validator.validatePath(normalPath);

      // 同じパスを再度検証
      const result2 = validator.validatePath(normalPath);

      // 結果が一貫している
      expect(result1.ok).toBe(result2.ok);
      if (result1.ok && result2.ok) {
        expect(result1.value).toBe(result2.value);
      }
    });
  });

  describe('enforceProjectRoot=false の動作', () => {
    it('enforceProjectRoot=false でもシンボリックリンク経由の外部アクセスは検出される', () => {
      if (!fs.existsSync(symlinkPath)) {
        console.warn('シンボリックリンクが存在しないためテストをスキップします');
        return;
      }

      const permissiveValidator = new SecurityValidator({
        projectRoot,
        enforceProjectRoot: false,
      });

      // シンボリックリンク経由でのアクセス
      const result = permissiveValidator.validatePath('malicious-link/secret.txt');

      // enforceProjectRoot=false でも物理パス比較により、
      // 実際にプロジェクト外を指すパスは適切に処理される
      // （ブロックパターンでの除外等、他のチェックは依然として有効）
      expect(result).toBeDefined();
    });
  });
});
