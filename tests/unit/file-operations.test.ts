/**
 * File Operations Tools のユニットテスト
 *
 * Requirements:
 * - 2.1: ファイル読み込み機能（read_file）
 * - 2.2: ファイル書き込み機能（write_file）
 * - 2.3: ディレクトリ一覧取得（list_directory）
 * - 2.4: セキュリティ検証
 * - 2.5: エラーハンドリング
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFile } from '../../src/tools/file-operations';
// TODO: タスク5.2, 5.3で使用
// import { writeFile, listDirectory } from '../../src/tools/file-operations';
import { SecurityValidator } from '../../src/security';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('File Operations Tools', () => {
  let tempDir: string;
  let securityValidator: SecurityValidator;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-ops-test-'));
    securityValidator = new SecurityValidator({
      projectRoot: tempDir,
      enforceProjectRoot: true
    });
  });

  afterEach(async () => {
    // テスト後にクリーンアップ
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // クリーンアップエラーは無視
    }
  });

  describe('read_file ツール', () => {
    describe('正常系', () => {
      it('UTF-8ファイルを正しく読み込める', async () => {
        // Arrange
        const testFile = path.join(tempDir, 'test.txt');
        const testContent = 'Hello, World!';
        await fs.writeFile(testFile, testContent, 'utf-8');

        // Act
        const result = await readFile({
          path: 'test.txt',
          encoding: 'utf-8'
        }, securityValidator);

        // Assert
        expect(result.isError).toBeFalsy();
        expect(result.content).toHaveLength(1);
        expect(result.content[0]).toEqual({
          type: 'text',
          text: expect.stringContaining(testContent)
        });
      });

      it('相対パスでファイルを読み込める', async () => {
        // Arrange
        const subDir = path.join(tempDir, 'subdir');
        await fs.mkdir(subDir);
        const testFile = path.join(subDir, 'nested.txt');
        const testContent = 'Nested file content';
        await fs.writeFile(testFile, testContent, 'utf-8');

        // Act
        const result = await readFile({
          path: 'subdir/nested.txt',
          encoding: 'utf-8'
        }, securityValidator);

        // Assert
        expect(result.isError).toBeFalsy();
        expect(result.content[0]).toEqual({
          type: 'text',
          text: expect.stringContaining(testContent)
        });
      });

      it('ファイルサイズとメタデータを返す', async () => {
        // Arrange
        const testFile = path.join(tempDir, 'metadata.txt');
        const testContent = 'Test content for metadata';
        await fs.writeFile(testFile, testContent, 'utf-8');

        // Act
        const result = await readFile({
          path: 'metadata.txt'
        }, securityValidator);

        // Assert
        expect(result.isError).toBeFalsy();
        const text = result.content[0].type === 'text' ? result.content[0].text : '';
        const data = JSON.parse(text);
        expect(data.size).toBe(Buffer.byteLength(testContent));
        expect(data.lastModified).toBeDefined();
        expect(data.encoding).toBe('utf-8');
        expect(data.truncated).toBe(false);
      });
    });

    describe('エンコーディング', () => {
      it('デフォルトでUTF-8を使用する', async () => {
        // Arrange
        const testFile = path.join(tempDir, 'default-encoding.txt');
        const testContent = '日本語コンテンツ';
        await fs.writeFile(testFile, testContent, 'utf-8');

        // Act
        const result = await readFile({
          path: 'default-encoding.txt'
          // encoding未指定
        }, securityValidator);

        // Assert
        expect(result.isError).toBeFalsy();
        expect(result.content[0]).toEqual({
          type: 'text',
          text: expect.stringContaining(testContent)
        });
      });

      it('UTF-16LEエンコーディングを指定できる', async () => {
        // Arrange
        const testFile = path.join(tempDir, 'utf16.txt');
        const testContent = 'UTF-16 content';
        await fs.writeFile(testFile, testContent, 'utf16le');

        // Act
        const result = await readFile({
          path: 'utf16.txt',
          encoding: 'utf-16le'
        }, securityValidator);

        // Assert
        expect(result.isError).toBeFalsy();
        expect(result.content[0]).toEqual({
          type: 'text',
          text: expect.stringContaining(testContent)
        });
      });

      it('binaryエンコーディングでバイナリファイルを読み込める', async () => {
        // Arrange
        const testFile = path.join(tempDir, 'binary.dat');
        const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF]);
        await fs.writeFile(testFile, binaryData);

        // Act
        const result = await readFile({
          path: 'binary.dat',
          encoding: 'binary'
        }, securityValidator);

        // Assert
        expect(result.isError).toBeFalsy();
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('セキュリティ', () => {
      it('プロジェクトルート外のファイルへのアクセスを拒否する', async () => {
        // Arrange
        const outsideFile = path.join(os.tmpdir(), 'outside.txt');
        await fs.writeFile(outsideFile, 'Should not be accessible', 'utf-8');

        try {
          // Act
          const result = await readFile({
            path: outsideFile
          }, securityValidator);

          // Assert
          expect(result.isError).toBe(true);
          expect(result.content[0]).toEqual({
            type: 'text',
            text: expect.stringContaining('OUTSIDE_PROJECT_ROOT')
          });
        } finally {
          await fs.unlink(outsideFile);
        }
      });

      it('パストラバーサル（../）を検出して拒否する', async () => {
        // Act
        const result = await readFile({
          path: '../../../etc/passwd'
        }, securityValidator);

        // Assert
        expect(result.isError).toBe(true);
        expect(result.content[0]).toEqual({
          type: 'text',
          text: expect.stringContaining('PATH_TRAVERSAL')
        });
      });
    });

    describe('エラーハンドリング', () => {
      it('存在しないファイルに対してエラーを返す', async () => {
        // Act
        const result = await readFile({
          path: 'non-existent-file.txt'
        }, securityValidator);

        // Assert
        expect(result.isError).toBe(true);
        expect(result.content[0]).toEqual({
          type: 'text',
          text: expect.stringContaining('not found')
        });
      });

      it('不正なエンコーディングを指定するとエラーを返す', async () => {
        // Arrange
        const testFile = path.join(tempDir, 'test.txt');
        await fs.writeFile(testFile, 'content', 'utf-8');

        // Act
        const result = await readFile({
          path: 'test.txt',
          encoding: 'invalid-encoding' as any
        }, securityValidator);

        // Assert
        expect(result.isError).toBe(true);
      });
    });

    describe('大容量ファイル処理', () => {
      it('10MB以下のファイルは全て読み込む', async () => {
        // Arrange
        const testFile = path.join(tempDir, 'large.txt');
        const size = 1024 * 1024; // 1MB
        const content = 'x'.repeat(size);
        await fs.writeFile(testFile, content, 'utf-8');

        // Act
        const result = await readFile({
          path: 'large.txt'
        }, securityValidator);

        // Assert
        expect(result.isError).toBeFalsy();
        const text = result.content[0].type === 'text' ? result.content[0].text : '';
        const data = JSON.parse(text);
        expect(data.truncated).toBe(false);
        expect(data.content).toBe(content);
      });

      it('10MBを超えるファイルは切り詰めフラグを返す', async () => {
        // Arrange
        const testFile = path.join(tempDir, 'huge.txt');
        const size = 11 * 1024 * 1024; // 11MB
        const content = 'x'.repeat(size);
        await fs.writeFile(testFile, content, 'utf-8');

        // Act
        const result = await readFile({
          path: 'huge.txt'
        }, securityValidator);

        // Assert
        expect(result.isError).toBeFalsy();
        const text = result.content[0].type === 'text' ? result.content[0].text : '';
        const data = JSON.parse(text);
        expect(data.truncated).toBe(true);
        expect(data.content.length).toBeLessThan(content.length);
      });
    });
  });

  describe('write_file ツール', () => {
    // タスク5.2でテストを追加
    it.todo('ファイルを書き込める');
  });

  describe('list_directory ツール', () => {
    // タスク5.3でテストを追加
    it.todo('ディレクトリ一覧を取得できる');
  });
});
