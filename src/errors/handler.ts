/**
 * エラーハンドラー
 * Task 9.2: エラーレスポンス生成とJSON-RPC変換
 */

import {
  MCPError,
  ValidationError,
  SecurityError,
  NotFoundError,
  InfrastructureError,
  TimeoutError,
  ResourceExhaustedError,
  BusinessRuleViolationError,
} from './index';

/**
 * JSON-RPCエラーコード
 * @see https://www.jsonrpc.org/specification#error_object
 */
export enum JSONRPCErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
}

/**
 * JSON-RPCエラーレスポンス型
 */
export interface ErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: {
      errorCode: string;
      stack?: string;
      context?: Record<string, unknown>;
      [key: string]: unknown;
    };
  };
}

/**
 * エラーハンドラークラス
 *
 * セキュリティ考慮事項:
 * - 本番環境(NODE_ENV=production)ではスタックトレースを含めない
 * - 内部実装の詳細漏洩を防ぐため、エラー情報を制限する
 */
export class ErrorHandler {
  /**
   * 本番環境かどうかを判定
   *
   * @returns NODE_ENV が 'production' の場合は true
   */
  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * エラーをJSON-RPCエラーレスポンスに変換
   */
  public handleError(
    error: Error,
    requestId: string | number | null
  ): ErrorResponse {
    // エラーをログに記録
    this.logError(error, requestId);

    // MCPErrorの場合は詳細情報を抽出
    if (error instanceof MCPError) {
      return this.handleMCPError(error, requestId);
    }

    // 一般的なErrorの場合
    return this.handleGenericError(error, requestId);
  }

  /**
   * MCPErrorをJSON-RPCエラーレスポンスに変換
   */
  private handleMCPError(
    error: MCPError,
    requestId: string | number | null
  ): ErrorResponse {
    const jsonRpcCode = this.mapToJSONRPCCode(error);
    const errorData = this.buildErrorData(error);

    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: jsonRpcCode,
        message: error.message,
        data: errorData,
      },
    };
  }

  /**
   * 一般的なErrorをJSON-RPCエラーレスポンスに変換
   */
  private handleGenericError(
    error: Error,
    requestId: string | number | null
  ): ErrorResponse {
    const data: ErrorResponse['error']['data'] = {
      errorCode: 'UNKNOWN_ERROR',
    };

    // 本番環境以外ではスタックトレースを含める
    if (!this.isProduction()) {
      data.stack = this.formatStackTrace(error);
    }

    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: JSONRPCErrorCode.INTERNAL_ERROR,
        message: error.message,
        data,
      },
    };
  }

  /**
   * MCPエラーコードをJSON-RPCエラーコードにマッピング
   */
  private mapToJSONRPCCode(error: MCPError): number {
    if (error instanceof ValidationError) {
      return JSONRPCErrorCode.INVALID_PARAMS;
    }
    if (
      error instanceof SecurityError ||
      error instanceof NotFoundError ||
      error instanceof BusinessRuleViolationError
    ) {
      return JSONRPCErrorCode.INVALID_REQUEST;
    }
    if (
      error instanceof InfrastructureError ||
      error instanceof TimeoutError ||
      error instanceof ResourceExhaustedError
    ) {
      return JSONRPCErrorCode.INTERNAL_ERROR;
    }
    return JSONRPCErrorCode.INTERNAL_ERROR;
  }

  /**
   * エラーデータオブジェクトを構築
   */
  private buildErrorData(error: MCPError): ErrorResponse['error']['data'] {
    const data: ErrorResponse['error']['data'] = {
      errorCode: error.code,
    };

    // 本番環境以外ではスタックトレースを含める
    if (!this.isProduction()) {
      data.stack = this.formatStackTrace(error);
    }

    // コンテキスト情報を追加
    if (error.context) {
      data.context = error.context;
    }

    // エラー固有の情報を追加
    if (error instanceof ValidationError) {
      if (error.field) data.field = error.field;
      if (error.receivedValue !== undefined)
        data.receivedValue = error.receivedValue;
    } else if (error instanceof SecurityError) {
      if (error.attemptedPath) data.attemptedPath = error.attemptedPath;
    } else if (error instanceof NotFoundError) {
      if (error.resourceType) data.resourceType = error.resourceType;
      if (error.resourceId) data.resourceId = error.resourceId;
    } else if (error instanceof InfrastructureError) {
      if (error.infrastructureType)
        data.infrastructureType = error.infrastructureType;
      if (error.cause) data.cause = error.cause.message;
    } else if (error instanceof TimeoutError) {
      if (error.operation) data.operation = error.operation;
      if (error.timeoutMs !== undefined) data.timeoutMs = error.timeoutMs;
    } else if (error instanceof ResourceExhaustedError) {
      if (error.resourceType) data.resourceType = error.resourceType;
      if (error.currentUsage !== undefined)
        data.currentUsage = error.currentUsage;
      if (error.limit !== undefined) data.limit = error.limit;
    } else if (error instanceof BusinessRuleViolationError) {
      if (error.ruleId) data.ruleId = error.ruleId;
    }

    return data;
  }

  /**
   * スタックトレースを整形
   */
  private formatStackTrace(error: Error): string | undefined {
    if (!error.stack) {
      return undefined;
    }

    // スタックトレースを読みやすく整形
    return error.stack;
  }

  /**
   * エラーをログに記録
   */
  private logError(error: Error, requestId: string | number | null): void {
    const errorInfo = {
      requestId,
      errorName: error.name,
      errorMessage: error.message,
      errorCode:
        error instanceof MCPError ? error.code : 'UNKNOWN_ERROR',
    };

    console.error(
      `Error handling request ${requestId}: ${error.name} - ${error.message}`,
      errorInfo
    );
  }
}
