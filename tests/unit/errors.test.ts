/**
 * エラーハンドリングシステムのテスト
 * Task 9.1: エラークラスの定義と階層化
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
  ErrorCode,
} from '../../src/errors';

describe('エラークラスの階層化', () => {
  describe('MCPError (基底クラス)', () => {
    it('基本的なエラー情報を保持すること', () => {
      const error = new MCPError(
        ErrorCode.INTERNAL_ERROR,
        'テストエラー'
      );

      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe('テストエラー');
      expect(error.name).toBe('MCPError');
      expect(error).toBeInstanceOf(Error);
    });

    it('コンテキスト情報を保持すること', () => {
      const context = { userId: 'test-user', requestId: '123' };
      const error = new MCPError(
        ErrorCode.INTERNAL_ERROR,
        'テストエラー',
        context
      );

      expect(error.context).toEqual(context);
    });

    it('スタックトレースを保持すること', () => {
      const error = new MCPError(
        ErrorCode.INTERNAL_ERROR,
        'テストエラー'
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('MCPError');
    });
  });

  describe('ValidationError', () => {
    it('バリデーションエラーを作成できること', () => {
      const error = new ValidationError(
        'パラメータが不正です',
        'path',
        'invalid-path'
      );

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('パラメータが不正です');
      expect(error.field).toBe('path');
      expect(error.receivedValue).toBe('invalid-path');
      expect(error.name).toBe('ValidationError');
      expect(error).toBeInstanceOf(MCPError);
    });

    it('フィールド情報なしで作成できること', () => {
      const error = new ValidationError('バリデーションエラー');

      expect(error.field).toBeUndefined();
      expect(error.receivedValue).toBeUndefined();
    });
  });

  describe('SecurityError', () => {
    it('セキュリティエラーを作成できること', () => {
      const error = new SecurityError(
        'プロジェクトルート外へのアクセスが試みられました',
        '/etc/passwd'
      );

      expect(error.code).toBe(ErrorCode.SECURITY_ERROR);
      expect(error.message).toBe('プロジェクトルート外へのアクセスが試みられました');
      expect(error.attemptedPath).toBe('/etc/passwd');
      expect(error.name).toBe('SecurityError');
      expect(error).toBeInstanceOf(MCPError);
    });

    it('試行パスなしで作成できること', () => {
      const error = new SecurityError('セキュリティ違反');

      expect(error.attemptedPath).toBeUndefined();
    });
  });

  describe('NotFoundError', () => {
    it('Not Foundエラーを作成できること', () => {
      const error = new NotFoundError(
        'ファイルが見つかりません',
        'file',
        '/path/to/missing.txt'
      );

      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe('ファイルが見つかりません');
      expect(error.resourceType).toBe('file');
      expect(error.resourceId).toBe('/path/to/missing.txt');
      expect(error.name).toBe('NotFoundError');
      expect(error).toBeInstanceOf(MCPError);
    });
  });

  describe('InfrastructureError', () => {
    it('インフラストラクチャエラーを作成できること', () => {
      const cause = new Error('ネットワークエラー');
      const error = new InfrastructureError(
        'Cursor IDEとの接続に失敗しました',
        'network',
        cause
      );

      expect(error.code).toBe(ErrorCode.INFRASTRUCTURE_ERROR);
      expect(error.message).toBe('Cursor IDEとの接続に失敗しました');
      expect(error.infrastructureType).toBe('network');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('InfrastructureError');
      expect(error).toBeInstanceOf(MCPError);
    });
  });

  describe('TimeoutError', () => {
    it('タイムアウトエラーを作成できること', () => {
      const error = new TimeoutError(
        'ツール実行がタイムアウトしました',
        'read_file',
        5000
      );

      expect(error.code).toBe(ErrorCode.TIMEOUT_ERROR);
      expect(error.message).toBe('ツール実行がタイムアウトしました');
      expect(error.operation).toBe('read_file');
      expect(error.timeoutMs).toBe(5000);
      expect(error.name).toBe('TimeoutError');
      expect(error).toBeInstanceOf(MCPError);
    });
  });

  describe('ResourceExhaustedError', () => {
    it('リソース枯渇エラーを作成できること', () => {
      const error = new ResourceExhaustedError(
        '同時接続数の上限に達しました',
        'connections',
        10,
        10
      );

      expect(error.code).toBe(ErrorCode.RESOURCE_EXHAUSTED);
      expect(error.message).toBe('同時接続数の上限に達しました');
      expect(error.resourceType).toBe('connections');
      expect(error.currentUsage).toBe(10);
      expect(error.limit).toBe(10);
      expect(error.name).toBe('ResourceExhaustedError');
      expect(error).toBeInstanceOf(MCPError);
    });
  });

  describe('BusinessRuleViolationError', () => {
    it('ビジネスルール違反エラーを作成できること', () => {
      const error = new BusinessRuleViolationError(
        'プロジェクトが開かれていません',
        'PROJECT_NOT_OPEN'
      );

      expect(error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
      expect(error.message).toBe('プロジェクトが開かれていません');
      expect(error.ruleId).toBe('PROJECT_NOT_OPEN');
      expect(error.name).toBe('BusinessRuleViolationError');
      expect(error).toBeInstanceOf(MCPError);
    });
  });
});

describe('ErrorCode列挙型', () => {
  it('すべてのエラーコードが定義されていること', () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCode.SECURITY_ERROR).toBe('SECURITY_ERROR');
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCode.INFRASTRUCTURE_ERROR).toBe('INFRASTRUCTURE_ERROR');
    expect(ErrorCode.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
    expect(ErrorCode.RESOURCE_EXHAUSTED).toBe('RESOURCE_EXHAUSTED');
    expect(ErrorCode.BUSINESS_RULE_VIOLATION).toBe('BUSINESS_RULE_VIOLATION');
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
  });
});
