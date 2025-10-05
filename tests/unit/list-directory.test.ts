/**
 * list_directory Tool のユニットテスト
 *
 * Requirements:
 * - 2.3: MCPクライアントがlist_directoryツールを呼び出すと、指定ディレクトリの内容をリスト形式で返却
 * - 2.4: プロジェクトルート外のディレクトリアクセスを拒否
 * - 2.5: ディレクトリアクセス失敗時に詳細なエラー情報を返却
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import { FileOperationsTool } from '../../src/tools/file-operations';
import { SecurityValidator } from '../../src/security/validator';

describe('FileOperationsTool - list_directory', () => {
  let fileOps: FileOperationsTool;
  let testDir: string;
  let securityValidator: SecurityValidator;

  beforeEach(async () => {
    // テスト用ディレクトリを作成
    testDir = path.join(process.cwd(), 'test-workspace-listdir');
    await fs.mkdir(testDir, { recursive: true });

    // セキュリティバリデーターの初期化
    securityValidator = new SecurityValidator({
      projectRoot: testDir,
      blockedPatterns: [],
      enforceProjectRoot: true
    });

    // File Operations Toolの初期化
    fileOps = new FileOperationsTool(securityValidator, testDir);
  });

  afterEach(async () => {
    // テスト用ディレクトリをクリーンアップ
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('基本的なディレクトリ一覧取得', () => {
    it('空のディレクトリの一覧を取得できる', async () => {
      const result = await fileOps.listDirectory({
        path: '.'
      });

      expect(result.entries).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.path).toBe(testDir);
    });

    it('ファイルとディレクトリの一覧を取得できる', async () => {
      // テストデータ作成
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(testDir, 'subdir'));

      const result = await fileOps.listDirectory({
        path: '.'
      });

      expect(result.entries).toHaveLength(3);
      expect(result.totalCount).toBe(3);

      // ファイルエントリの検証
      const file1 = result.entries.find(e => e.name === 'file1.txt');
      expect(file1).toBeDefined();
      expect(file1?.type).toBe('file');
      expect(file1?.size).toBeGreaterThan(0);
      expect(file1?.lastModified).toBeDefined();
      expect(file1?.permissions).toBeDefined();

      // ディレクトリエントリの検証
      const subdir = result.entries.find(e => e.name === 'subdir');
      expect(subdir).toBeDefined();
      expect(subdir?.type).toBe('directory');
    });

    it('相対パスでディレクトリ一覧を取得できる', async () => {
      const subDir = path.join(testDir, 'subdir');
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(subDir, 'nested.txt'), 'nested content');

      const result = await fileOps.listDirectory({
        path: 'subdir'
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe('nested.txt');
      expect(result.path).toBe(subDir);
    });

    it('絶対パスでディレクトリ一覧を取得できる', async () => {
      await fs.writeFile(path.join(testDir, 'absolute-test.txt'), 'test');

      const result = await fileOps.listDirectory({
        path: testDir
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe('absolute-test.txt');
    });
  });

  describe('再帰的ディレクトリ取得', () => {
    it('recursive=falseの場合、サブディレクトリ内のファイルを含まない', async () => {
      const subDir = path.join(testDir, 'subdir');
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(testDir, 'root.txt'), 'root');
      await fs.writeFile(path.join(subDir, 'nested.txt'), 'nested');

      const result = await fileOps.listDirectory({
        path: '.',
        recursive: false
      });

      expect(result.entries).toHaveLength(2); // root.txt と subdir
      expect(result.entries.some(e => e.name === 'nested.txt')).toBe(false);
    });

    it('recursive=trueの場合、サブディレクトリ内のファイルも含む', async () => {
      const subDir = path.join(testDir, 'subdir');
      const deepDir = path.join(subDir, 'deep');
      await fs.mkdir(subDir);
      await fs.mkdir(deepDir);
      await fs.writeFile(path.join(testDir, 'root.txt'), 'root');
      await fs.writeFile(path.join(subDir, 'nested.txt'), 'nested');
      await fs.writeFile(path.join(deepDir, 'deep.txt'), 'deep');

      const result = await fileOps.listDirectory({
        path: '.',
        recursive: true
      });

      expect(result.totalCount).toBeGreaterThanOrEqual(5); // root.txt, subdir, nested.txt, deep, deep.txt
      expect(result.entries.some(e => e.name === 'root.txt')).toBe(true);
      expect(result.entries.some(e => e.name === 'nested.txt')).toBe(true);
      expect(result.entries.some(e => e.name === 'deep.txt')).toBe(true);
    });
  });

  describe('隠しファイルの処理', () => {
    it('includeHidden=falseの場合、隠しファイルを除外する', async () => {
      await fs.writeFile(path.join(testDir, 'visible.txt'), 'visible');
      await fs.writeFile(path.join(testDir, '.hidden'), 'hidden');

      const result = await fileOps.listDirectory({
        path: '.',
        includeHidden: false
      });

      expect(result.entries.some(e => e.name === 'visible.txt')).toBe(true);
      expect(result.entries.some(e => e.name === '.hidden')).toBe(false);
    });

    it('includeHidden=trueの場合、隠しファイルを含む', async () => {
      await fs.writeFile(path.join(testDir, 'visible.txt'), 'visible');
      await fs.writeFile(path.join(testDir, '.hidden'), 'hidden');

      const result = await fileOps.listDirectory({
        path: '.',
        includeHidden: true
      });

      expect(result.entries.some(e => e.name === 'visible.txt')).toBe(true);
      expect(result.entries.some(e => e.name === '.hidden')).toBe(true);
    });

    it('デフォルト（includeHidden未指定）では隠しファイルを除外する', async () => {
      await fs.writeFile(path.join(testDir, 'visible.txt'), 'visible');
      await fs.writeFile(path.join(testDir, '.hidden'), 'hidden');

      const result = await fileOps.listDirectory({
        path: '.'
      });

      expect(result.entries.some(e => e.name === '.hidden')).toBe(false);
    });
  });

  describe('globパターンフィルタリング', () => {
    beforeEach(async () => {
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      await fs.writeFile(path.join(testDir, 'script.js'), 'console.log()');
      await fs.writeFile(path.join(testDir, 'data.json'), '{}');
    });

    it('pattern="*.txt"の場合、txtファイルのみを返す', async () => {
      const result = await fileOps.listDirectory({
        path: '.',
        pattern: '*.txt'
      });

      expect(result.totalCount).toBe(2);
      expect(result.entries.every(e => e.name.endsWith('.txt'))).toBe(true);
    });

    it('pattern="*.js"の場合、jsファイルのみを返す', async () => {
      const result = await fileOps.listDirectory({
        path: '.',
        pattern: '*.js'
      });

      expect(result.totalCount).toBe(1);
      expect(result.entries[0].name).toBe('script.js');
    });

    it('pattern="file*"の場合、fileで始まるファイルのみを返す', async () => {
      const result = await fileOps.listDirectory({
        path: '.',
        pattern: 'file*'
      });

      expect(result.totalCount).toBe(2);
      expect(result.entries.every(e => e.name.startsWith('file'))).toBe(true);
    });

    it('patternが未指定の場合、すべてのファイルを返す', async () => {
      const result = await fileOps.listDirectory({
        path: '.'
      });

      expect(result.totalCount).toBe(4);
    });
  });

  describe('メタデータ情報', () => {
    it('ファイルサイズを返す', async () => {
      const content = 'Test content with known size';
      await fs.writeFile(path.join(testDir, 'sized.txt'), content);

      const result = await fileOps.listDirectory({
        path: '.'
      });

      const file = result.entries.find(e => e.name === 'sized.txt');
      expect(file?.size).toBe(Buffer.byteLength(content));
    });

    it('最終更新日時を返す', async () => {
      await fs.writeFile(path.join(testDir, 'timestamped.txt'), 'test');

      const result = await fileOps.listDirectory({
        path: '.'
      });

      const file = result.entries.find(e => e.name === 'timestamped.txt');
      expect(file?.lastModified).toBeDefined();
      expect(new Date(file!.lastModified).getTime()).toBeGreaterThan(0);
    });

    it('ファイル権限情報を返す', async () => {
      await fs.writeFile(path.join(testDir, 'permissions.txt'), 'test');

      const result = await fileOps.listDirectory({
        path: '.'
      });

      const file = result.entries.find(e => e.name === 'permissions.txt');
      expect(file?.permissions).toBeDefined();
      expect(typeof file?.permissions).toBe('string');
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しないディレクトリを指定するとエラーをスローする', async () => {
      await expect(
        fileOps.listDirectory({ path: 'non-existent-dir' })
      ).rejects.toThrow(/not found|ENOENT/i);
    });

    it('ファイルパスを指定するとエラーをスローする', async () => {
      await fs.writeFile(path.join(testDir, 'notadir.txt'), 'test');

      await expect(
        fileOps.listDirectory({ path: 'notadir.txt' })
      ).rejects.toThrow(/not a directory/i);
    });

    it('プロジェクトルート外のディレクトリへのアクセスを拒否する', async () => {
      await expect(
        fileOps.listDirectory({ path: '../outside' })
      ).rejects.toThrow(/security|outside project root/i);
    });

    it('権限のないディレクトリへのアクセスを拒否する', async () => {
      const restrictedDir = path.join(testDir, 'restricted');
      await fs.mkdir(restrictedDir);
      await fs.chmod(restrictedDir, 0o000);

      await expect(
        fileOps.listDirectory({ path: 'restricted' })
      ).rejects.toThrow(/permission|EACCES/i);

      // クリーンアップ
      await fs.chmod(restrictedDir, 0o755);
    });
  });

  describe('エッジケース', () => {
    it('シンボリックリンクのタイプを正しく判定する', async () => {
      const targetFile = path.join(testDir, 'target.txt');
      const linkFile = path.join(testDir, 'link.txt');
      await fs.writeFile(targetFile, 'target content');
      await fs.symlink(targetFile, linkFile);

      const result = await fileOps.listDirectory({
        path: '.'
      });

      const link = result.entries.find(e => e.name === 'link.txt');
      expect(link?.type).toBe('symlink');
    });

    it('ディレクトリのサイズは0を返す', async () => {
      await fs.mkdir(path.join(testDir, 'emptydir'));

      const result = await fileOps.listDirectory({
        path: '.'
      });

      const dir = result.entries.find(e => e.name === 'emptydir');
      expect(dir?.size).toBe(0);
    });

    it('非常に多数のファイルがある場合でも処理できる', async () => {
      // 100ファイル作成
      for (let i = 0; i < 100; i++) {
        await fs.writeFile(path.join(testDir, `file${i}.txt`), `content${i}`);
      }

      const result = await fileOps.listDirectory({
        path: '.'
      });

      expect(result.totalCount).toBe(100);
      expect(result.entries).toHaveLength(100);
    });
  });
});
