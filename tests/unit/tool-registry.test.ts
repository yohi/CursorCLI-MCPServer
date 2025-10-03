/**
 * Tool Registry のユニットテスト
 *
 * Requirements:
 * - 1.4: MCPクライアントが利用可能なツール一覧をリクエストした際、全ての公開ツール定義を返却
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ToolRegistry } from '../../src/protocol/registry';
import { z } from 'zod';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('ツール登録', () => {
    it('ツールを登録できる', () => {
      const schema = z.object({
        path: z.string()
      });

      const handler = async (params: z.infer<typeof schema>) => {
        return { content: [{ type: 'text' as const, text: params.path }] };
      };

      registry.register({
        name: 'read_file',
        description: 'ファイルを読み込む',
        schema,
        handler
      });

      expect(registry.has('read_file')).toBe(true);
    });

    it('同じ名前のツールを重複登録しようとするとエラーをスローする', () => {
      const schema = z.object({ path: z.string() });
      const handler = async () => ({ content: [] });

      registry.register({
        name: 'test_tool',
        description: 'テストツール',
        schema,
        handler
      });

      expect(() => {
        registry.register({
          name: 'test_tool',
          description: 'テストツール2',
          schema,
          handler
        });
      }).toThrow('Tool already registered: test_tool');
    });

    it('複数のツールを登録できる', () => {
      const schema = z.object({});
      const handler = async () => ({ content: [] });

      registry.register({
        name: 'tool1',
        description: 'ツール1',
        schema,
        handler
      });

      registry.register({
        name: 'tool2',
        description: 'ツール2',
        schema,
        handler
      });

      expect(registry.has('tool1')).toBe(true);
      expect(registry.has('tool2')).toBe(true);
    });
  });

  describe('ツール検索', () => {
    beforeEach(() => {
      const schema = z.object({});
      const handler = async () => ({ content: [] });

      registry.register({
        name: 'tool1',
        description: 'ツール1',
        schema,
        handler
      });
    });

    it('登録されているツールを名前で取得できる', () => {
      const tool = registry.get('tool1');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('tool1');
    });

    it('登録されていないツールを取得しようとするとundefinedを返す', () => {
      const tool = registry.get('non_existent');
      expect(tool).toBeUndefined();
    });

    it('ツールの存在を確認できる', () => {
      expect(registry.has('tool1')).toBe(true);
      expect(registry.has('non_existent')).toBe(false);
    });
  });

  describe('ツール一覧取得', () => {
    it('空のレジストリから空の配列を取得できる', () => {
      const tools = registry.list();
      expect(tools).toEqual([]);
    });

    it('登録されているすべてのツール定義を取得できる', () => {
      const schema1 = z.object({ param1: z.string() });
      const schema2 = z.object({ param2: z.number() });
      const handler = async () => ({ content: [] });

      registry.register({
        name: 'tool1',
        description: 'ツール1',
        schema: schema1,
        handler
      });

      registry.register({
        name: 'tool2',
        description: 'ツール2',
        schema: schema2,
        handler
      });

      const tools = registry.list();
      expect(tools).toHaveLength(2);

      const tool1 = tools.find((t: any) => t.name === 'tool1');
      expect(tool1).toBeDefined();
      expect(tool1?.description).toBe('ツール1');
      expect(tool1?.inputSchema.properties).toBeDefined();

      const tool2 = tools.find((t: any) => t.name === 'tool2');
      expect(tool2).toBeDefined();
      expect(tool2?.description).toBe('ツール2');
    });

    it('ツール定義にはZodスキーマからJSON Schemaが生成される', () => {
      const schema = z.object({
        path: z.string().describe('ファイルパス'),
        encoding: z.enum(['utf-8', 'utf-16']).optional()
      });

      const handler = async () => ({ content: [] });

      registry.register({
        name: 'read_file',
        description: 'ファイル読み込み',
        schema,
        handler
      });

      const tools = registry.list();
      const tool = tools[0];

      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
      expect(tool.inputSchema.properties?.path).toBeDefined();
      expect(tool.inputSchema.properties?.encoding).toBeDefined();
    });
  });

  describe('ツールの有効/無効切り替え', () => {
    beforeEach(() => {
      const schema = z.object({});
      const handler = async () => ({ content: [] });

      registry.register({
        name: 'tool1',
        description: 'ツール1',
        schema,
        handler
      });
    });

    it('ツールを無効化できる', () => {
      registry.disable('tool1');
      expect(registry.isEnabled('tool1')).toBe(false);
    });

    it('ツールを有効化できる', () => {
      registry.disable('tool1');
      registry.enable('tool1');
      expect(registry.isEnabled('tool1')).toBe(true);
    });

    it('無効化されたツールは一覧に表示されない', () => {
      registry.disable('tool1');
      const tools = registry.list();
      expect(tools).toHaveLength(0);
    });

    it('存在しないツールを無効化しようとするとエラーをスローする', () => {
      expect(() => {
        registry.disable('non_existent');
      }).toThrow('Tool not found: non_existent');
    });

    it('存在しないツールを有効化しようとするとエラーをスローする', () => {
      expect(() => {
        registry.enable('non_existent');
      }).toThrow('Tool not found: non_existent');
    });
  });

  describe('ツール登録解除', () => {
    beforeEach(() => {
      const schema = z.object({});
      const handler = async () => ({ content: [] });

      registry.register({
        name: 'tool1',
        description: 'ツール1',
        schema,
        handler
      });
    });

    it('ツールを登録解除できる', () => {
      registry.unregister('tool1');
      expect(registry.has('tool1')).toBe(false);
    });

    it('存在しないツールを登録解除しようとするとエラーをスローする', () => {
      expect(() => {
        registry.unregister('non_existent');
      }).toThrow('Tool not found: non_existent');
    });
  });
});
