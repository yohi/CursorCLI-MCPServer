/**
 * MCP Protocol Handler
 *
 * MCPプロトコルハンドラーの実装
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import type {
  InitializeRequest,
  InitializeResult,
  ListToolsResult,
  CallToolRequest,
  CallToolResult,
  ClientInfo,
  ServerInfo,
  ToolDefinition
} from './types.js';

/**
 * サーバー設定
 */
export interface ServerConfig {
  name: string;
  version: string;
}

/**
 * プロトコルバージョン不一致エラー
 */
export class ProtocolVersionError extends Error {
  constructor(version: string) {
    super(`Unsupported protocol version: ${version}`);
    this.name = 'ProtocolVersionError';
  }
}

/**
 * 未初期化エラー
 */
export class NotInitializedError extends Error {
  constructor() {
    super('Server not initialized');
    this.name = 'NotInitializedError';
  }
}

/**
 * ツール未発見エラー
 */
export class ToolNotFoundError extends Error {
  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`);
    this.name = 'ToolNotFoundError';
  }
}

/**
 * サポートされているプロトコルバージョン
 */
const SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = ['2024-11-05'];

/**
 * MCP Protocol Handler
 */
export class MCPProtocolHandler {
  private initialized = false;
  private clientInfo: ClientInfo | null = null;
  private readonly serverInfo: ServerInfo;
  private readonly tools: Map<string, ToolDefinition> = new Map();

  constructor(config: ServerConfig) {
    this.serverInfo = {
      name: config.name,
      version: config.version
    };
  }

  /**
   * サーバーを初期化する
   *
   * Requirement 1.1: MCPクライアントがサーバーに接続要求を送信した際、MCP仕様に準拠したハンドシェイクを実行
   * Requirement 1.2: MCPクライアントが初期化リクエストを送信した際、サーバー情報を返却
   * Requirement 1.3: MCPクライアントのプロトコルバージョンが非対応の場合、エラーレスポンスを返却
   */
  async initialize(request: InitializeRequest): Promise<InitializeResult> {
    // プロトコルバージョンチェック
    if (!this.isVersionSupported(request.protocolVersion)) {
      throw new ProtocolVersionError(request.protocolVersion);
    }

    // クライアント情報を記録
    this.clientInfo = request.clientInfo;

    // 初期化完了フラグを設定
    this.initialized = true;

    // サーバー情報とcapabilitiesを返却
    return {
      protocolVersion: request.protocolVersion,
      capabilities: {
        tools: {},
        logging: {}
      },
      serverInfo: this.serverInfo
    };
  }

  /**
   * ツール一覧を取得する
   *
   * Requirement 1.4: MCPクライアントが利用可能なツール一覧をリクエストした際、全ての公開ツール定義を返却
   */
  async listTools(): Promise<ListToolsResult> {
    this.ensureInitialized();

    return {
      tools: Array.from(this.tools.values())
    };
  }

  /**
   * ツールを呼び出す
   */
  async callTool(request: CallToolRequest): Promise<CallToolResult> {
    this.ensureInitialized();

    const tool = this.tools.get(request.name);
    if (!tool) {
      throw new ToolNotFoundError(request.name);
    }

    // ツール実装は後続タスクで追加
    throw new Error('Not implemented');
  }

  /**
   * サーバーが初期化済みかチェックする
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * サポートされているプロトコルバージョンのリストを取得する
   */
  getSupportedVersions(): string[] {
    return [...SUPPORTED_PROTOCOL_VERSIONS];
  }

  /**
   * 指定されたバージョンがサポートされているか確認する
   */
  isVersionSupported(version: string): boolean {
    return SUPPORTED_PROTOCOL_VERSIONS.includes(version);
  }

  /**
   * クライアント情報を取得する
   */
  getClientInfo(): ClientInfo | null {
    return this.clientInfo;
  }

  /**
   * 初期化チェック
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new NotInitializedError();
    }
  }
}
