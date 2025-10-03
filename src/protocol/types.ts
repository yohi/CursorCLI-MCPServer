/**
 * MCP Protocol Types
 *
 * MCPプロトコルで使用される型定義
 */

/**
 * クライアント情報
 */
export interface ClientInfo {
  name: string;
  version: string;
}

/**
 * サーバー情報
 */
export interface ServerInfo {
  name: string;
  version: string;
}

/**
 * クライアントのCapabilities
 */
export interface ClientCapabilities {
  tools?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  resources?: Record<string, unknown>;
}

/**
 * サーバーのCapabilities
 */
export interface ServerCapabilities {
  tools?: Record<string, unknown>;
  logging?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  resources?: Record<string, unknown>;
}

/**
 * 初期化リクエスト
 */
export interface InitializeRequest {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: ClientInfo;
}

/**
 * 初期化結果
 */
export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: ServerInfo;
}

/**
 * ツール定義
 */
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * ツール一覧結果
 */
export interface ListToolsResult {
  tools: ToolDefinition[];
}

/**
 * ツール呼び出しリクエスト
 */
export interface CallToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * ツールレスポンスコンテンツ
 */
export type ToolResponseContent = {
  type: 'text';
  text: string;
} | {
  type: 'image';
  data: string;
  mimeType: string;
} | {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
  };
};

/**
 * ツール呼び出し結果
 */
export interface CallToolResult {
  content: ToolResponseContent[];
  isError?: boolean;
}

/**
 * エラーレスポンス
 */
export interface ErrorResponse {
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}
