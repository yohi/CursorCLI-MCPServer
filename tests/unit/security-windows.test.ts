/**
 * Windows環境でのセキュリティテスト
 *
 * バックスラッシュのパス区切り、ケースインセンシティブなマッチング、
 * minimatchのPOSIX形式要件への対応を確認する
 */

import { describe, it, expect } from '@jest/globals';
import { SecurityValidator } from '../../src/security/validator.js';

describe('SecurityValidator - Windows パス対応', () => {
  describe('POSIX形式への変換', () => {
    it('パス区切り文字に関わらずブロックパターンが正しく動作する', () => {
      const projectRoot = process.cwd();
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['node_modules/**', '.git/**'],
      });

      // Unix形式のパス
      const unixPath = 'node_modules/package/index.js';
      const result1 = validator.validatePath(unixPath);
      expect(result1.ok).toBe(false);
      if (!result1.ok) {
        expect(result1.error.code).toBe('BLOCKED_PATTERN');
      }

      // Windows形式のパス（バックスラッシュ）を明示的に指定
      // 全プラットフォームでバックスラッシュ変換をテストする
      const windowsStylePath = 'node_modules\\package\\index.js';
      const result2 = validator.validatePath(windowsStylePath);
      expect(result2.ok).toBe(false);
      if (!result2.ok) {
        expect(result2.error.code).toBe('BLOCKED_PATTERN');
      }
    });

    it('.gitディレクトリのブロックが正しく動作する', () => {
      const projectRoot = process.cwd();
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['.git/**'],
      });

      // Unix形式
      const result1 = validator.validatePath('.git/config');
      expect(result1.ok).toBe(false);

      // Windows形式（バックスラッシュ）を明示的に指定
      const windowsPath = '.git\\config';
      const result2 = validator.validatePath(windowsPath);
      expect(result2.ok).toBe(false);
    });

    it('ネストされたパターンが正しく動作する', () => {
      const projectRoot = process.cwd();
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['**/test/**/*.test.ts'],
      });

      // 深くネストされたテストファイル（Windows形式バックスラッシュ）
      const testPath = 'src\\components\\test\\unit\\Button.test.ts';
      const result = validator.validatePath(testPath);
      expect(result.ok).toBe(false);
    });
  });

  describe('セキュリティオプションの動作確認', () => {
    it('nonegate: true により否定パターンが無効化される', () => {
      const projectRoot = process.cwd();

      // ! による否定パターンはセキュリティ上の理由で無効化される
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['!important.txt', 'temp/**'],
      });

      // !important.txt は否定として解釈されず、リテラルパターンとして扱われる
      // このため '!important.txt' というファイル名にしかマッチしない
      const result1 = validator.validatePath('important.txt');
      expect(result1.ok).toBe(true); // 否定が無効なのでブロックされない

      // temp/** は正常にブロックされる
      const result2 = validator.validatePath('temp/file.txt');
      expect(result2.ok).toBe(false);
    });

    it('nocomment: true によりコメントパターンが無効化される', () => {
      const projectRoot = process.cwd();

      // # によるコメントはセキュリティ上の理由で無効化される
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['#comment', 'blocked/**'],
      });

      // '#comment' はコメントとして無視されず、リテラルパターンとして扱われる
      const result1 = validator.validatePath('comment');
      expect(result1.ok).toBe(true); // リテラル '#comment' にマッチしないのでOK

      const result2 = validator.validatePath('blocked/file.txt');
      expect(result2.ok).toBe(false);
    });

    it('dot: true により.で始まるファイルもマッチする', () => {
      const projectRoot = process.cwd();
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['.*', '.*/**'],
      });

      // .で始まるファイル
      const result1 = validator.validatePath('.env');
      expect(result1.ok).toBe(false);

      // .で始まるディレクトリ内のファイル
      const result2 = validator.validatePath('.config/settings.json');
      expect(result2.ok).toBe(false);
    });
  });

  describe('パフォーマンス最適化の確認', () => {
    it('プリコンパイルされたパターンが複数回のマッチングで再利用される', () => {
      const projectRoot = process.cwd();
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['node_modules/**', 'dist/**', 'build/**'],
      });

      // 同じバリデーターで複数回チェック（プリコンパイルの効果を確認）
      const paths = [
        'node_modules/pkg/index.js',
        'dist/bundle.js',
        'build/output.js',
        'src/index.ts',
      ];

      const results = paths.map((p) => validator.validatePath(p));

      // 最初の3つはブロックされる
      expect(results[0].ok).toBe(false);
      expect(results[1].ok).toBe(false);
      expect(results[2].ok).toBe(false);

      // 最後の1つは許可される
      expect(results[3].ok).toBe(true);
    });

    it('大量のパターンでもパフォーマンスが維持される', () => {
      const projectRoot = process.cwd();

      // 100個のブロックパターンを作成
      const manyPatterns = Array.from({ length: 100 }, (_, i) => `blocked${i}/**`);

      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: manyPatterns,
      });

      // 許可されるパス
      const startTime = Date.now();
      const result = validator.validatePath('src/index.ts');
      const duration = Date.now() - startTime;

      expect(result.ok).toBe(true);
      // プリコンパイルにより、100個のパターンチェックでも十分高速
      expect(duration).toBeLessThan(100); // 100ms未満
    });
  });

  describe('Windows環境特有の動作（シミュレート）', () => {
    it('ケースインセンシティブなマッチングの確認（Windowsのみ）', () => {
      const projectRoot = process.cwd();
      const isWindows = process.platform === 'win32';

      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['Node_Modules/**'],
      });

      // 小文字のnode_modules
      const result1 = validator.validatePath('node_modules/package/index.js');

      if (isWindows) {
        // Windows環境ではケースインセンシティブなのでマッチする
        expect(result1.ok).toBe(false);
      } else {
        // Unix系ではケースセンシティブなのでマッチしない
        expect(result1.ok).toBe(true);
      }
    });

    it('大文字小文字が混在するパスの処理', () => {
      const projectRoot = process.cwd();
      const isWindows = process.platform === 'win32';

      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: ['DIST/**'],
      });

      // 小文字のdist
      const result = validator.validatePath('dist/bundle.js');

      if (isWindows) {
        expect(result.ok).toBe(false); // Windows: マッチする
      } else {
        expect(result.ok).toBe(true); // Unix: マッチしない
      }
    });
  });

  describe('エッジケース', () => {
    it('空のパターンリストでは何もブロックしない', () => {
      const projectRoot = process.cwd();
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: [],
      });

      const result = validator.validatePath('any/path/file.txt');
      expect(result.ok).toBe(true);
    });

    it('複雑なglobパターンが正しく動作する', () => {
      const projectRoot = process.cwd();
      const validator = new SecurityValidator({
        projectRoot,
        blockedPatterns: [
          '**/*.{log,tmp,temp}',
          '**/test-*/**',
          '**/*-backup/**',
        ],
      });

      // 拡張子マッチ
      expect(validator.validatePath('logs/app.log').ok).toBe(false);
      expect(validator.validatePath('tmp/data.tmp').ok).toBe(false);
      expect(validator.validatePath('cache/file.temp').ok).toBe(false);

      // ディレクトリ名パターン
      expect(validator.validatePath('test-unit/spec.ts').ok).toBe(false);
      expect(validator.validatePath('data-backup/old.json').ok).toBe(false);

      // 許可されるパス
      expect(validator.validatePath('src/index.ts').ok).toBe(true);
    });
  });
});
