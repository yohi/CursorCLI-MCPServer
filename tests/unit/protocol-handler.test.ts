/**
 * MCP Protocol Handler のユニットテスト
 *
 * Requirements:
 * - 1.1: MCPクライアントがサーバーに接続要求を送信した際、MCP仕様に準拠したハンドシェイクを実行
 * - 1.2: MCPクライアントが初期化リクエストを送信した際、サーバー情報を返却
 * - 1.3: MCPクライアントのプロトコルバージョンが非対応の場合、エラーレスポンスを返却
 * - 1.4: MCPクライアントが利用可能なツール一覧をリクエストした際、全ての公開ツール定義を返却
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MCPProtocolHandler } from '../../src/protocol/handler';
import type {
  InitializeRequest,
  InitializeResult,
  ListToolsResult,
  CallToolRequest
} from '../../src/protocol/types';

describe('MCPProtocolHandler', () => {
  let handler: MCPProtocolHandler;

  beforeEach(() => {
    handler = new MCPProtocolHandler({
      name: 'cursorcli-mcp-server',
      version: '1.0.0'
    });
  });

  describe('初期化ハンドシェイク', () => {
    it('初期化リクエストに対してサーバー情報を返却する', async () => {
      const request: InitializeRequest = {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      };

      const result: InitializeResult = await handler.initialize(request);

      expect(result).toEqual({
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          logging: {}
        },
        serverInfo: {
          name: 'cursorcli-mcp-server',
          version: '1.0.0'
        }
      });
    });

    it('プロトコルバージョンが非対応の場合、エラーをスローする', async () => {
      const request: InitializeRequest = {
        protocolVersion: 'unsupported-version',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      };

      await expect(handler.initialize(request)).rejects.toThrow(
        'Unsupported protocol version: unsupported-version'
      );
    });

    it('初期化後、サーバーが初期化済み状態になる', async () => {
      const request: InitializeRequest = {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      };

      await handler.initialize(request);

      expect(handler.isInitialized()).toBe(true);
    });
  });

  describe('ツール一覧の取得', () => {
    it('初期化前にツール一覧を取得しようとするとエラーをスローする', async () => {
      await expect(handler.listTools()).rejects.toThrow(
        'Server not initialized'
      );
    });

    it('初期化後、空のツール一覧を返却する（ツール未登録時）', async () => {
      const request: InitializeRequest = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      };

      await handler.initialize(request);
      const result: ListToolsResult = await handler.listTools();

      expect(result).toEqual({
        tools: []
      });
    });
  });

  describe('ツールの呼び出し', () => {
    it('初期化前にツールを呼び出そうとするとエラーをスローする', async () => {
      const request: CallToolRequest = {
        name: 'test_tool',
        arguments: {}
      };

      await expect(handler.callTool(request)).rejects.toThrow(
        'Server not initialized'
      );
    });

    it('存在しないツールを呼び出そうとするとエラーをスローする', async () => {
      const initRequest: InitializeRequest = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      };

      await handler.initialize(initRequest);

      const callRequest: CallToolRequest = {
        name: 'non_existent_tool',
        arguments: {}
      };

      await expect(handler.callTool(callRequest)).rejects.toThrow(
        'Tool not found: non_existent_tool'
      );
    });
  });

  describe('プロトコルバージョン管理', () => {
    it('サポートされているプロトコルバージョンのリストを返却する', () => {
      const versions = handler.getSupportedVersions();

      expect(versions).toContain('2024-11-05');
      expect(versions.length).toBeGreaterThan(0);
    });

    it('指定されたバージョンがサポートされているか確認できる', () => {
      expect(handler.isVersionSupported('2024-11-05')).toBe(true);
      expect(handler.isVersionSupported('invalid-version')).toBe(false);
    });
  });

  describe('クライアント情報の記録', () => {
    it('初期化後、クライアント情報を取得できる', async () => {
      const request: InitializeRequest = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: {
          name: 'test-client',
          version: '2.0.0'
        }
      };

      await handler.initialize(request);
      const clientInfo = handler.getClientInfo();

      expect(clientInfo).toEqual({
        name: 'test-client',
        version: '2.0.0'
      });
    });

    it('初期化前にクライアント情報を取得しようとするとnullを返す', () => {
      const clientInfo = handler.getClientInfo();

      expect(clientInfo).toBeNull();
    });
  });
});
