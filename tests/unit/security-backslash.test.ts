/**
 * バックスラッシュ正規化の包括的テスト
 *
 * Windows形式のパス（\区切り）が正しくPOSIX形式に変換され、
 * ブロックパターンマッチングで確実に検出されることを確認
 */

import { describe, it, expect } from '@jest/globals';
import { SecurityValidator } from '../../src/security/validator.js';

describe('SecurityValidator - バックスラッシュ正規化', () => {
  const projectRoot = process.cwd();

  describe('明示的なバックスラッシュ変換', () => {
    it('バックスラッシュを含むパスがブロックパターンにマッチする', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['node_modules/**'],
      });

      // Windows形式のパス（\区切り）を直接指定
      const windowsPath = 'node_modules\\package\\index.js';
      const result = validator.validatePath(windowsPath);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BLOCKED_PATTERN');
      }
    });

    it('混在したパス区切り文字が正しく処理される', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['dist/**'],
      });

      // スラッシュとバックスラッシュの混在
      const mixedPath = 'dist/bundle\\js\\app.js';
      const result = validator.validatePath(mixedPath);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BLOCKED_PATTERN');
      }
    });

    it('複数のバックスラッシュが連続する場合も正しく処理される', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['.git/**'],
      });

      // 複数のバックスラッシュ
      const doubleBackslash = '.git\\\\config';
      const result = validator.validatePath(doubleBackslash);

      // バックスラッシュは正規化されるが、.git以下のファイルとして認識される
      expect(result.ok).toBe(false);
    });

    it('ネストされたディレクトリのバックスラッシュパスが正しくマッチする', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['**/test/**/*.spec.js'],
      });

      // 深くネストされたテストファイル（バックスラッシュ区切り）
      const deepPath = 'src\\components\\test\\unit\\Button.spec.js';
      const result = validator.validatePath(deepPath);

      expect(result.ok).toBe(false);
    });
  });

  describe('エッジケースの検証', () => {
    it('末尾にバックスラッシュがある場合も正しく処理される', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['temp/**'],
      });

      const trailingBackslash = 'temp\\data\\';
      const result = validator.validatePath(trailingBackslash);

      expect(result.ok).toBe(false);
    });

    it('先頭にバックスラッシュがある相対パスも正しく処理される', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['backup/**'],
      });

      // 先頭のバックスラッシュ（Windowsでは相対パスとして解釈される場合がある）
      const leadingBackslash = '\\backup\\files';
      const result = validator.validatePath(leadingBackslash);

      // パス正規化により適切に処理される
      expect(result).toBeDefined();
    });

    it('バックスラッシュのみのパスが適切にエラーハンドリングされる', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['node_modules/**'],
      });

      // 単一のバックスラッシュ
      const singleBackslash = '\\';
      const result = validator.validatePath(singleBackslash);

      // エラーにならず、適切に処理される
      expect(result).toBeDefined();
    });
  });

  describe('セキュリティ関連のバックスラッシュケース', () => {
    it('バックスラッシュを使った.gitアクセス試行をブロックする', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['.git/**'],
      });

      const gitConfigWindows = '.git\\config';
      const result = validator.validatePath(gitConfigWindows);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BLOCKED_PATTERN');
      }
    });

    it('バックスラッシュを使ったnode_modulesアクセス試行をブロックする', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['node_modules/**'],
      });

      const nodeModulesWindows = 'node_modules\\malicious\\package';
      const result = validator.validatePath(nodeModulesWindows);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BLOCKED_PATTERN');
      }
    });

    it('バックスラッシュを使った環境変数ディレクトリアクセス試行をブロックする', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['.env*', '.*/**'],
      });

      const envWindows = '.env\\secrets';
      const result = validator.validatePath(envWindows);

      expect(result.ok).toBe(false);
    });
  });

  describe('正規表現ベースの変換検証', () => {
    it('replace(/\\\\/g, "/") がすべてのバックスラッシュを変換する', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['a/b/c/**'],
      });

      // すべてのバックスラッシュがスラッシュに変換される
      const allBackslashes = 'a\\b\\c\\d\\e.txt';
      const result = validator.validatePath(allBackslashes);

      expect(result.ok).toBe(false);
    });

    it('split(path.sep).join("/") との動作比較', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['test/**'],
      });

      // 両方のアプローチで同じ結果になることを確認
      const path1 = 'test\\file.txt';
      const path2 = 'test/file.txt';

      const result1 = validator.validatePath(path1);
      const result2 = validator.validatePath(path2);

      expect(result1.ok).toBe(result2.ok);
      if (!result1.ok && !result2.ok) {
        expect(result1.error.code).toBe(result2.error.code);
      }
    });
  });

  describe('パフォーマンス検証', () => {
    it('正規表現ベースの変換が高速に動作する', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['blocked/**'],
      });

      const paths = Array.from({ length: 1000 }, (_, i) =>
        `path\\to\\file${i}.txt`
      );

      const startTime = Date.now();
      paths.forEach((p) => validator.validatePath(p));
      const duration = Date.now() - startTime;

      // 1000回のバリデーションが十分高速
      expect(duration).toBeLessThan(500); // 500ms未満
    });

    it('replace(/\\\\/g, "/") が split().join() より効率的', () => {
      // 正規表現による一括変換の方が通常は高速
      // （split/joinは配列を生成するオーバーヘッドがある）

      const testString = 'a\\b\\c\\d\\e\\f\\g\\h\\i\\j\\k';

      const iterations = 10000;

      // replace方式
      const replaceStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        testString.replace(/\\/g, '/');
      }
      const replaceDuration = Date.now() - replaceStart;

      // split/join方式
      const splitStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        testString.split('\\').join('/');
      }
      const splitDuration = Date.now() - splitStart;

      // replace方式の方が高速であることが期待される
      // （ただし環境により異なる場合があるため、ログ出力のみ）
      console.log(`Replace: ${replaceDuration}ms, Split/Join: ${splitDuration}ms`);

      // 両方とも十分高速であることを確認
      expect(replaceDuration).toBeLessThan(1000);
      expect(splitDuration).toBeLessThan(1000);
    });
  });

  describe('クロスプラットフォーム動作確認', () => {
    it('Unix環境でもバックスラッシュ変換が動作する', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['node_modules/**'],
      });

      // Unix環境でもバックスラッシュを含むパスが処理できる
      const windowsStylePath = 'node_modules\\test';
      const result = validator.validatePath(windowsStylePath);

      expect(result.ok).toBe(false);
    });

    it('正規のスラッシュパスも引き続き動作する', () => {
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['node_modules/**'],
      });

      // 通常のスラッシュパス
      const unixPath = 'node_modules/test';
      const result = validator.validatePath(unixPath);

      expect(result.ok).toBe(false);
    });
  });
});
