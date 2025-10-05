/**
 * File Operations Tools Integration Test
 *
 * Requirements:
 * - 5.4: ファイル操作の統合とエラーハンドリング
 * - ツールレジストリへの登録処理の検証
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ToolRegistry } from '../../src/protocol/registry';
import { SecurityValidator } from '../../src/security/validator';
import { registerFileOperationsTools } from '../../src/tools';

describe('File Operations Tools Integration', () => {
  let testDir: string;
  let securityValidator: SecurityValidator;
  let registry: ToolRegistry;

  beforeEach(async () => {
    // テスト用ディレクトリを作成
    testDir = path.join(process.cwd(), 'test-workspace-integration');
    await fs.mkdir(testDir, { recursive: true });

    // セキュリティバリデーターの初期化
    securityValidator = new SecurityValidator({
      projectRoot: testDir,
      blockedPatterns: [],
      enforceProjectRoot: true
    });

    // ツールレジストリの初期化
    registry = new ToolRegistry();

    // ファイル操作ツールを登録
    registerFileOperationsTools(registry, securityValidator, testDir);
  });

  afterEach(async () => {
    // テスト用ディレクトリをクリーンアップ
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('ツールレジストリへの登録', () => {
    it('read_fileツールが登録されている', () => {
      expect(registry.has('read_file')).toBe(true);
      expect(registry.isEnabled('read_file')).toBe(true);
    });

    it('write_fileツールが登録されている', () => {
      expect(registry.has('write_file')).toBe(true);
      expect(registry.isEnabled('write_file')).toBe(true);
    });

    it('list_directoryツールが登録されている', () => {
      expect(registry.has('list_directory')).toBe(true);
      expect(registry.isEnabled('list_directory')).toBe(true);
    });

    it('ツール一覧に3つのツールが含まれる', () => {
      const tools = registry.list();
      expect(tools).toHaveLength(3);

      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('list_directory');
    });
  });

  describe('統合エラーハンドリング', () => {
    it('read_fileで存在しないファイルを読み取ろうとするとエラーレスポンスを返す', async () => {
      const tool = registry.get('read_file');
      expect(tool).toBeDefined();

      const result = await tool!.handler({ path: 'non-existent.txt' });

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe('text');
      if (result.content[0].type === 'text') {
        expect(result.content[0].text).toContain('Error');
        expect(result.content[0].text).toContain('not found');
      }
    });

    it('write_fileで上書き禁止のファイルに書き込もうとするとエラーレスポンスを返す', async () => {
      // 既存ファイルを作成
      const filePath = path.join(testDir, 'existing.txt');
      await fs.writeFile(filePath, 'existing content');

      const tool = registry.get('write_file');
      expect(tool).toBeDefined();

      const result = await tool!.handler({
        path: 'existing.txt',
        content: 'new content',
        overwrite: false
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe('text');
      if (result.content[0].type === 'text') {
        expect(result.content[0].text).toContain('Error');
        expect(result.content[0].text).toContain('already exists');
      }
    });

    it('list_directoryで存在しないディレクトリを一覧しようとするとエラーレスポンスを返す', async () => {
      const tool = registry.get('list_directory');
      expect(tool).toBeDefined();

      const result = await tool!.handler({ path: 'non-existent-dir' });

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe('text');
      if (result.content[0].type === 'text') {
        expect(result.content[0].text).toContain('Error');
        expect(result.content[0].text).toContain('not found');
      }
    });

    it('read_fileでプロジェクトルート外のファイルを読み取ろうとするとエラーレスポンスを返す', async () => {
      const tool = registry.get('read_file');
      expect(tool).toBeDefined();

      const result = await tool!.handler({ path: '../outside.txt' });

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe('text');
      if (result.content[0].type === 'text') {
        expect(result.content[0].text).toContain('Error');
        expect(result.content[0].text).toMatch(/security|outside project root/i);
      }
    });
  });

  describe('統合動作フロー', () => {
    it('write → read → list の完全フローが正常に動作する', async () => {
      // 1. ファイルを書き込む
      const writeTool = registry.get('write_file');
      expect(writeTool).toBeDefined();

      const writeResult = await writeTool!.handler({
        path: 'test-file.txt',
        content: 'test content'
      });

      expect(writeResult.isError).toBeUndefined();
      expect(writeResult.content[0].type).toBe('text');
      if (writeResult.content[0].type === 'text') {
        const writeData = JSON.parse(writeResult.content[0].text);
        expect(writeData.success).toBe(true);
      }

      // 2. ファイルを読み取る
      const readTool = registry.get('read_file');
      expect(readTool).toBeDefined();

      const readResult = await readTool!.handler({
        path: 'test-file.txt'
      });

      expect(readResult.isError).toBeUndefined();
      expect(readResult.content[0].type).toBe('text');
      if (readResult.content[0].type === 'text') {
        const readData = JSON.parse(readResult.content[0].text);
        expect(readData.content).toBe('test content');
      }

      // 3. ディレクトリ一覧を取得
      const listTool = registry.get('list_directory');
      expect(listTool).toBeDefined();

      const listResult = await listTool!.handler({
        path: '.'
      });

      expect(listResult.isError).toBeUndefined();
      expect(listResult.content[0].type).toBe('text');
      if (listResult.content[0].type === 'text') {
        const listData = JSON.parse(listResult.content[0].text);
        expect(listData.entries).toHaveLength(1);
        expect(listData.entries[0].name).toBe('test-file.txt');
      }
    });

    it('複数ファイルのwrite → list with pattern の統合フローが正常に動作する', async () => {
      const writeTool = registry.get('write_file');
      const listTool = registry.get('list_directory');

      // 複数ファイルを書き込む
      await writeTool!.handler({ path: 'file1.txt', content: 'content1' });
      await writeTool!.handler({ path: 'file2.txt', content: 'content2' });
      await writeTool!.handler({ path: 'script.js', content: 'console.log()' });

      // パターンフィルタリングでtxtファイルのみ取得
      const listResult = await listTool!.handler({
        path: '.',
        pattern: '*.txt'
      });

      expect(listResult.content[0].type).toBe('text');
      if (listResult.content[0].type === 'text') {
        const listData = JSON.parse(listResult.content[0].text);
        expect(listData.totalCount).toBe(2);
        expect(listData.entries.every((e: any) => e.name.endsWith('.txt'))).toBe(true);
      }
    });
  });

  describe('ツールの有効化/無効化', () => {
    it('read_fileツールを無効化すると一覧に含まれない', () => {
      registry.disable('read_file');

      const tools = registry.list();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).not.toContain('read_file');
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('list_directory');
    });

    it('無効化したツールを再度有効化すると一覧に含まれる', () => {
      registry.disable('write_file');
      expect(registry.list().map(t => t.name)).not.toContain('write_file');

      registry.enable('write_file');
      expect(registry.list().map(t => t.name)).toContain('write_file');
    });
  });
});
