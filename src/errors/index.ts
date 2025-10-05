/**
 * エラーハンドリングシステム
 * Task 9.1: エラークラスの定義と階層化
 */

/**
 * エラーコード列挙型
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INFRASTRUCTURE_ERROR = 'INFRASTRUCTURE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * エラーコンテキスト型
 */
export interface ErrorContext {
  [key: string]: unknown;
}

/**
 * MCP基底エラークラス
 */
export class MCPError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: ErrorContext;

  constructor(
    code: ErrorCode,
    message: string,
    context?: ErrorContext
  ) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.context = context;

    // スタックトレースを適切に設定
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends MCPError {
  public readonly field?: string;
  public readonly receivedValue?: unknown;

  constructor(
    message: string,
    field?: string,
    receivedValue?: unknown,
    context?: ErrorContext
  ) {
    super(ErrorCode.VALIDATION_ERROR, message, context);
    this.name = 'ValidationError';
    this.field = field;
    this.receivedValue = receivedValue;
  }
}

/**
 * セキュリティエラー
 */
export class SecurityError extends MCPError {
  public readonly attemptedPath?: string;

  constructor(
    message: string,
    attemptedPath?: string,
    context?: ErrorContext
  ) {
    super(ErrorCode.SECURITY_ERROR, message, context);
    this.name = 'SecurityError';
    this.attemptedPath = attemptedPath;
  }
}

/**
 * Not Foundエラー
 */
export class NotFoundError extends MCPError {
  public readonly resourceType?: string;
  public readonly resourceId?: string;

  constructor(
    message: string,
    resourceType?: string,
    resourceId?: string,
    context?: ErrorContext
  ) {
    super(ErrorCode.NOT_FOUND, message, context);
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * インフラストラクチャエラー
 */
export class InfrastructureError extends MCPError {
  public readonly infrastructureType?: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    infrastructureType?: string,
    cause?: Error,
    context?: ErrorContext
  ) {
    super(ErrorCode.INFRASTRUCTURE_ERROR, message, context);
    this.name = 'InfrastructureError';
    this.infrastructureType = infrastructureType;
    this.cause = cause;
  }
}

/**
 * タイムアウトエラー
 */
export class TimeoutError extends MCPError {
  public readonly operation?: string;
  public readonly timeoutMs?: number;

  constructor(
    message: string,
    operation?: string,
    timeoutMs?: number,
    context?: ErrorContext
  ) {
    super(ErrorCode.TIMEOUT_ERROR, message, context);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * リソース枯渇エラー
 */
export class ResourceExhaustedError extends MCPError {
  public readonly resourceType?: string;
  public readonly currentUsage?: number;
  public readonly limit?: number;

  constructor(
    message: string,
    resourceType?: string,
    currentUsage?: number,
    limit?: number,
    context?: ErrorContext
  ) {
    super(ErrorCode.RESOURCE_EXHAUSTED, message, context);
    this.name = 'ResourceExhaustedError';
    this.resourceType = resourceType;
    this.currentUsage = currentUsage;
    this.limit = limit;
  }
}

/**
 * ビジネスルール違反エラー
 */
export class BusinessRuleViolationError extends MCPError {
  public readonly ruleId?: string;

  constructor(
    message: string,
    ruleId?: string,
    context?: ErrorContext
  ) {
    super(ErrorCode.BUSINESS_RULE_VIOLATION, message, context);
    this.name = 'BusinessRuleViolationError';
    this.ruleId = ruleId;
  }
}
