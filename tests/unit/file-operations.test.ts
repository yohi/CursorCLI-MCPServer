/**
 * File Operations Tool のユニットテスト
 *
 * Requirements:
 * - 2.1: MCPクライアントがread_fileツールを呼び出すと、指定されたファイルの内容を読み取り、JSON形式で返却
 * - 2.4: 指定されたファイルパスがプロジェクトルート外の場合、セキュリティエラーを返却し、アクセスを拒否
 * - 2.5: ファイル操作が失敗（権限不足、ファイル不存在など）すると、詳細なエラーコードとメッセージを返却
 * - 2.6: ファイルパスが相対パスの場合、現在のプロジェクトルートを基準として解決
 * - 8.3: ファイル読み込みサイズが10MBを超過する場合、分割読み込みまたはストリーミング方式を使用
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import { FileOperationsTool } from '../../src/tools/file-operations';
import { SecurityValidator } from '../../src/security/validator';

describe('FileOperationsTool - read_file', () => {
  let fileOps: FileOperationsTool;
  let testDir: string;
  let securityValidator: SecurityValidator;

  beforeEach(async () => {
    // テスト用ディレクトリを作成
    testDir = path.join(process.cwd(), 'test-workspace');
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

  describe('基本的なファイル読み込み', () => {
    it('UTF-8エンコーディングのファイルを読み込める', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const content = 'Hello, World!';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await fileOps.readFile({
        path: 'test.txt',
        encoding: 'utf-8'
      });

      expect(result.content).toBe(content);
      expect(result.size).toBe(Buffer.byteLength(content));
      expect(result.encoding).toBe('utf-8');
      expect(result.truncated).toBe(false);
      expect(result.lastModified).toBeDefined();
    });

    it('相対パスを正しく解決してファイルを読み込める', async () => {
      const subDir = path.join(testDir, 'subdir');
      await fs.mkdir(subDir);
      const filePath = path.join(subDir, 'nested.txt');
      const content = 'Nested file content';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await fileOps.readFile({
        path: 'subdir/nested.txt'
      });

      expect(result.content).toBe(content);
    });

    it('絶対パスでファイルを読み込める', async () => {
      const filePath = path.join(testDir, 'absolute.txt');
      const content = 'Absolute path content';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await fileOps.readFile({
        path: filePath
      });

      expect(result.content).toBe(content);
    });

    it('デフォルトエンコーディング（UTF-8）でファイルを読み込める', async () => {
      const filePath = path.join(testDir, 'default-encoding.txt');
      const content = 'デフォルトエンコーディング';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await fileOps.readFile({
        path: 'default-encoding.txt'
      });

      expect(result.content).toBe(content);
      expect(result.encoding).toBe('utf-8');
    });
  });

  describe('エンコーディング対応', () => {
    it('UTF-16LEエンコーディングのファイルを読み込める', async () => {
      const filePath = path.join(testDir, 'utf16le.txt');
      const content = 'UTF-16LE content';
      await fs.writeFile(filePath, content, 'utf-16le');

      const result = await fileOps.readFile({
        path: 'utf16le.txt',
        encoding: 'utf-16le'
      });

      expect(result.content).toBe(content);
      expect(result.encoding).toBe('utf-16le');
    });

    it('バイナリファイルを読み込める', async () => {
      const filePath = path.join(testDir, 'binary.bin');
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      await fs.writeFile(filePath, buffer);

      const result = await fileOps.readFile({
        path: 'binary.bin',
        encoding: 'binary'
      });

      expect(result.content).toBeDefined();
      expect(result.encoding).toBe('binary');
    });
  });

  describe('大容量ファイルの処理', () => {
    it('10MB以下のファイルは全て読み込める', async () => {
      const filePath = path.join(testDir, 'large.txt');
      const content = 'A'.repeat(5 * 1024 * 1024); // 5MB
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await fileOps.readFile({
        path: 'large.txt'
      });

      expect(result.content.length).toBe(5 * 1024 * 1024);
      expect(result.truncated).toBe(false);
    });

    it('10MBを超えるファイルは切り詰められる', async () => {
      const filePath = path.join(testDir, 'very-large.txt');
      const content = 'B'.repeat(15 * 1024 * 1024); // 15MB
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await fileOps.readFile({
        path: 'very-large.txt'
      });

      expect(result.content.length).toBeLessThanOrEqual(10 * 1024 * 1024);
      expect(result.truncated).toBe(true);
    });

    it('offsetとlengthを指定して部分的に読み込める', async () => {
      const filePath = path.join(testDir, 'partial.txt');
      const content = '0123456789ABCDEFGHIJ';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await fileOps.readFile({
        path: 'partial.txt',
        offset: 5,
        length: 10
      });

      expect(result.content).toBe('56789ABCDE');
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しないファイルを読み込もうとするとエラーをスローする', async () => {
      await expect(
        fileOps.readFile({ path: 'non-existent.txt' })
      ).rejects.toThrow(/not found|ENOENT/i);
    });

    it('プロジェクトルート外のファイルへのアクセスを拒否する', async () => {
      await expect(
        fileOps.readFile({ path: '../outside.txt' })
      ).rejects.toThrow(/security|outside project root/i);
    });

    it('権限のないファイルを読み込もうとするとエラーをスローする', async () => {
      const filePath = path.join(testDir, 'no-permission.txt');
      await fs.writeFile(filePath, 'secret', 'utf-8');
      await fs.chmod(filePath, 0o000);

      await expect(
        fileOps.readFile({ path: 'no-permission.txt' })
      ).rejects.toThrow(/permission|EACCES/i);

      // クリーンアップのために権限を戻す
      await fs.chmod(filePath, 0o644);
    });

    it('不正なエンコーディングを指定するとエラーをスローする', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'test', 'utf-8');

      await expect(
        fileOps.readFile({ path: 'test.txt', encoding: 'invalid' as any })
      ).rejects.toThrow();
    });
  });

  describe('メタデータ情報', () => {
    it('ファイルサイズを正しく返す', async () => {
      const filePath = path.join(testDir, 'size-test.txt');
      const content = 'Test content for size';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await fileOps.readFile({
        path: 'size-test.txt'
      });

      expect(result.size).toBe(Buffer.byteLength(content));
    });

    it('最終更新日時を返す', async () => {
      const filePath = path.join(testDir, 'timestamp-test.txt');
      await fs.writeFile(filePath, 'test', 'utf-8');

      const result = await fileOps.readFile({
        path: 'timestamp-test.txt'
      });

      expect(result.lastModified).toBeDefined();
      expect(typeof result.lastModified).toBe('string');
      expect(new Date(result.lastModified).getTime()).toBeGreaterThan(0);
    });
  });
});

describe('FileOperationsTool - write_file', () => {
  let fileOps: FileOperationsTool;
  let testDir: string;
  let securityValidator: SecurityValidator;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-workspace');
    await fs.mkdir(testDir, { recursive: true });

    securityValidator = new SecurityValidator({
      projectRoot: testDir,
      blockedPatterns: [],
      enforceProjectRoot: true
    });

    fileOps = new FileOperationsTool(securityValidator, testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('基本的なファイル書き込み', () => {
    it('新しいファイルを作成できる', async () => {
      const result = await fileOps.writeFile({
        path: 'new-file.txt',
        content: 'Hello, World!'
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(result.size).toBe(Buffer.byteLength('Hello, World!'));

      const content = await fs.readFile(path.join(testDir, 'new-file.txt'), 'utf-8');
      expect(content).toBe('Hello, World!');
    });

    it('相対パスでファイルを作成できる', async () => {
      const result = await fileOps.writeFile({
        path: 'subdir/nested.txt',
        content: 'Nested content',
        createDirectories: true
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);

      const content = await fs.readFile(
        path.join(testDir, 'subdir/nested.txt'),
        'utf-8'
      );
      expect(content).toBe('Nested content');
    });

    it('絶対パスでファイルを作成できる', async () => {
      const filePath = path.join(testDir, 'absolute.txt');
      const result = await fileOps.writeFile({
        path: filePath,
        content: 'Absolute path content'
      });

      expect(result.success).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Absolute path content');
    });
  });

  describe('既存ファイルの上書き', () => {
    it('overwrite=trueの場合、既存ファイルを上書きできる', async () => {
      const filePath = path.join(testDir, 'existing.txt');
      await fs.writeFile(filePath, 'Original content', 'utf-8');

      const result = await fileOps.writeFile({
        path: 'existing.txt',
        content: 'New content',
        overwrite: true
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(false);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('New content');
    });

    it('overwrite=falseの場合、既存ファイルへの書き込みを拒否する', async () => {
      const filePath = path.join(testDir, 'existing.txt');
      await fs.writeFile(filePath, 'Original content', 'utf-8');

      await expect(
        fileOps.writeFile({
          path: 'existing.txt',
          content: 'New content',
          overwrite: false
        })
      ).rejects.toThrow(/already exists|overwrite/i);
    });

    it('デフォルト（overwrite=true）で既存ファイルを上書きする', async () => {
      const filePath = path.join(testDir, 'default-overwrite.txt');
      await fs.writeFile(filePath, 'Original', 'utf-8');

      const result = await fileOps.writeFile({
        path: 'default-overwrite.txt',
        content: 'Updated'
      });

      expect(result.success).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Updated');
    });
  });

  describe('ディレクトリの自動作成', () => {
    it('createDirectories=trueの場合、親ディレクトリを自動作成する', async () => {
      const result = await fileOps.writeFile({
        path: 'deep/nested/path/file.txt',
        content: 'Deep content',
        createDirectories: true
      });

      expect(result.success).toBe(true);

      const content = await fs.readFile(
        path.join(testDir, 'deep/nested/path/file.txt'),
        'utf-8'
      );
      expect(content).toBe('Deep content');
    });

    it('createDirectories=falseの場合、親ディレクトリが存在しないとエラーをスローする', async () => {
      await expect(
        fileOps.writeFile({
          path: 'nonexistent/file.txt',
          content: 'Content',
          createDirectories: false
        })
      ).rejects.toThrow(/ENOENT|directory does not exist/i);
    });
  });

  describe('エンコーディング対応', () => {
    it('UTF-8エンコーディングでファイルを書き込める', async () => {
      const result = await fileOps.writeFile({
        path: 'utf8.txt',
        content: '日本語テキスト',
        encoding: 'utf-8'
      });

      expect(result.success).toBe(true);

      const content = await fs.readFile(path.join(testDir, 'utf8.txt'), 'utf-8');
      expect(content).toBe('日本語テキスト');
    });

    it('UTF-16LEエンコーディングでファイルを書き込める', async () => {
      const result = await fileOps.writeFile({
        path: 'utf16le.txt',
        content: 'UTF-16LE text',
        encoding: 'utf-16le'
      });

      expect(result.success).toBe(true);

      const content = await fs.readFile(
        path.join(testDir, 'utf16le.txt'),
        'utf-16le'
      );
      expect(content).toBe('UTF-16LE text');
    });
  });

  describe('セキュリティとエラーハンドリング', () => {
    it('プロジェクトルート外へのファイル書き込みを拒否する', async () => {
      await expect(
        fileOps.writeFile({
          path: '../outside.txt',
          content: 'Should be blocked'
        })
      ).rejects.toThrow(/security|outside project root/i);
    });

    it('書き込み権限がないディレクトリへの書き込みを拒否する', async () => {
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.mkdir(readOnlyDir);
      await fs.chmod(readOnlyDir, 0o444);

      await expect(
        fileOps.writeFile({
          path: 'readonly/file.txt',
          content: 'Should fail',
          createDirectories: false
        })
      ).rejects.toThrow(/permission|EACCES/i);

      // クリーンアップ
      await fs.chmod(readOnlyDir, 0o755);
    });
  });

  describe('結果情報', () => {
    it('書き込んだファイルサイズを返す', async () => {
      const content = 'Test content for size';
      const result = await fileOps.writeFile({
        path: 'size-test.txt',
        content
      });

      expect(result.size).toBe(Buffer.byteLength(content));
    });

    it('書き込んだファイルパスを返す', async () => {
      const result = await fileOps.writeFile({
        path: 'path-test.txt',
        content: 'test'
      });

      expect(result.path).toBe(path.join(testDir, 'path-test.txt'));
    });

    it('新規作成と上書きを区別する', async () => {
      const result1 = await fileOps.writeFile({
        path: 'distinguish.txt',
        content: 'First'
      });
      expect(result1.created).toBe(true);

      const result2 = await fileOps.writeFile({
        path: 'distinguish.txt',
        content: 'Second'
      });
      expect(result2.created).toBe(false);
    });
  });
});
