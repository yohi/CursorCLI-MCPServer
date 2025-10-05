/**
 * エラーハンドラーのテスト
 * Task 9.2: エラーレスポンス生成とJSON-RPC変換
 */

import {
  ErrorHandler,
  JSONRPCErrorCode,
} from '../../src/errors/handler';
import {
  ValidationError,
  SecurityError,
  NotFoundError,
  TimeoutError,
  ResourceExhaustedError,
  BusinessRuleViolationError,
  MCPError,
  ErrorCode,
} from '../../src/errors';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    // ログ出力をモック
    logSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('handleError', () => {
    it('ValidationErrorをJSON-RPCエラーに変換すること', () => {
      const error = new ValidationError(
        'パラメータが不正です',
        'path',
        'invalid-path'
      );
      const requestId = '123';

      const response = errorHandler.handleError(error, requestId);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(requestId);
      expect(response.error.code).toBe(JSONRPCErrorCode.INVALID_PARAMS);
      expect(response.error.message).toBe('パラメータが不正です');
      expect(response.error.data).toMatchObject({
        errorCode: ErrorCode.VALIDATION_ERROR,
        field: 'path',
        receivedValue: 'invalid-path',
      });
    });

    it('SecurityErrorをJSON-RPCエラーに変換すること', () => {
      const error = new SecurityError(
        'アクセスが拒否されました',
        '/etc/passwd'
      );
      const requestId = '456';

      const response = errorHandler.handleError(error, requestId);

      expect(response.error.code).toBe(JSONRPCErrorCode.INVALID_REQUEST);
      expect(response.error.message).toBe('アクセスが拒否されました');
      expect(response.error.data).toMatchObject({
        errorCode: ErrorCode.SECURITY_ERROR,
        attemptedPath: '/etc/passwd',
      });
    });

    it('NotFoundErrorをJSON-RPCエラーに変換すること', () => {
      const error = new NotFoundError(
        'ファイルが見つかりません',
        'file',
        '/missing.txt'
      );
      const requestId = '789';

      const response = errorHandler.handleError(error, requestId);

      expect(response.error.code).toBe(JSONRPCErrorCode.INVALID_REQUEST);
      expect(response.error.message).toBe('ファイルが見つかりません');
      expect(response.error.data).toMatchObject({
        errorCode: ErrorCode.NOT_FOUND,
        resourceType: 'file',
        resourceId: '/missing.txt',
      });
    });

    it('TimeoutErrorをJSON-RPCエラーに変換すること', () => {
      const error = new TimeoutError(
        'ツール実行がタイムアウトしました',
        'read_file',
        5000
      );

      const response = errorHandler.handleError(error, '101');

      expect(response.error.code).toBe(JSONRPCErrorCode.INTERNAL_ERROR);
      expect(response.error.data).toMatchObject({
        errorCode: ErrorCode.TIMEOUT_ERROR,
        operation: 'read_file',
        timeoutMs: 5000,
      });
    });

    it('ResourceExhaustedErrorをJSON-RPCエラーに変換すること', () => {
      const error = new ResourceExhaustedError(
        '同時接続数の上限に達しました',
        'connections',
        10,
        10
      );

      const response = errorHandler.handleError(error, '102');

      expect(response.error.code).toBe(JSONRPCErrorCode.INTERNAL_ERROR);
      expect(response.error.data).toMatchObject({
        errorCode: ErrorCode.RESOURCE_EXHAUSTED,
        resourceType: 'connections',
        currentUsage: 10,
        limit: 10,
      });
    });

    it('BusinessRuleViolationErrorをJSON-RPCエラーに変換すること', () => {
      const error = new BusinessRuleViolationError(
        'プロジェクトが開かれていません',
        'PROJECT_NOT_OPEN'
      );

      const response = errorHandler.handleError(error, '103');

      expect(response.error.code).toBe(JSONRPCErrorCode.INVALID_REQUEST);
      expect(response.error.data).toMatchObject({
        errorCode: ErrorCode.BUSINESS_RULE_VIOLATION,
        ruleId: 'PROJECT_NOT_OPEN',
      });
    });

    it('一般的なErrorをJSON-RPCエラーに変換すること', () => {
      const error = new Error('予期しないエラー');

      const response = errorHandler.handleError(error, '104');

      expect(response.error.code).toBe(JSONRPCErrorCode.INTERNAL_ERROR);
      expect(response.error.message).toBe('予期しないエラー');
      expect(response.error.data).toMatchObject({
        errorCode: 'UNKNOWN_ERROR',
      });
    });

    it('スタックトレースを含むこと', () => {
      const error = new ValidationError('テストエラー');

      const response = errorHandler.handleError(error, '105');

      expect(response.error.data?.stack).toBeDefined();
      expect(typeof response.error.data?.stack).toBe('string');
      expect(response.error.data?.stack).toContain('ValidationError');
    });

    it('エラーコンテキストを含むこと', () => {
      const context = { userId: 'test-user', requestId: '123' };
      const error = new MCPError(
        ErrorCode.INTERNAL_ERROR,
        'テストエラー',
        context
      );

      const response = errorHandler.handleError(error, '106');

      expect(response.error.data?.context).toEqual(context);
    });

    it('エラーをログに記録すること', () => {
      const error = new ValidationError('ログ記録テスト');

      errorHandler.handleError(error, '107');

      expect(logSpy).toHaveBeenCalled();
      const loggedMessage = logSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('Error handling request 107');
      expect(loggedMessage).toContain('ログ記録テスト');
    });
  });

  describe('formatStackTrace', () => {
    it('スタックトレースを整形すること', () => {
      const error = new Error('スタックトレーステスト');

      const formatted = errorHandler['formatStackTrace'](error);

      expect(formatted).toBeDefined();
      expect(formatted).toContain('Error: スタックトレーステスト');
      expect(formatted?.split('\n').length).toBeGreaterThan(1);
    });

    it('スタックトレースがない場合はundefinedを返すこと', () => {
      const error = new Error('テスト');
      delete (error as any).stack;

      const formatted = errorHandler['formatStackTrace'](error);

      expect(formatted).toBeUndefined();
    });
  });
});

describe('JSON-RPCエラーコードマッピング', () => {
  it('すべてのJSON-RPCエラーコードが定義されていること', () => {
    expect(JSONRPCErrorCode.PARSE_ERROR).toBe(-32700);
    expect(JSONRPCErrorCode.INVALID_REQUEST).toBe(-32600);
    expect(JSONRPCErrorCode.METHOD_NOT_FOUND).toBe(-32601);
    expect(JSONRPCErrorCode.INVALID_PARAMS).toBe(-32602);
    expect(JSONRPCErrorCode.INTERNAL_ERROR).toBe(-32603);
  });
});
