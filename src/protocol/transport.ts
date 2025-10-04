/**
 * stdio Transport
 *
 * stdioベースのJSON-RPCトランスポート実装
 * Requirements: 1.5, 9.2
 */

import { Readable, Writable } from 'stream';
import type { JSONRPCMessage } from './types.js';

/**
 * トランスポート設定
 */
export interface TransportConfig {
  stdin: Readable;
  stdout: Writable;
}

/**
 * メッセージハンドラー
 */
type MessageHandler = (message: JSONRPCMessage) => void;

/**
 * エラーハンドラー
 */
type ErrorHandler = (error: Error) => void;

/**
 * クローズハンドラー
 */
type CloseHandler = () => void;

/**
 * stdio Transport
 *
 * Requirement 1.5: JSON-RPC 2.0形式のメッセージ送受信を維持
 * Requirement 9.2: stdioトランスポート方式で通信を確立
 */
export class StdioTransport {
  private stdin: Readable;
  private stdout: Writable;
  private connected = false;
  private closed = false;
  private buffer = '';

  private messageHandlers: MessageHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private closeHandlers: CloseHandler[] = [];

  // リスナー参照を保存（特定のリスナーのみを削除するため）
  private dataListener?: (chunk: Buffer) => void;
  private endListener?: () => void;
  private stdinErrorListener?: (error: Error) => void;
  private stdoutErrorListener?: (error: Error) => void;

  constructor(config: TransportConfig) {
    this.stdin = config.stdin;
    this.stdout = config.stdout;
  }

  /**
   * トランスポートを開始する
   */
  async start(): Promise<void> {
    if (this.closed) {
      throw new Error('Transport already closed');
    }

    if (this.connected) {
      return;
    }

    // リスナー関数を保存してからアタッチ
    this.dataListener = (chunk: Buffer) => {
      this.handleData(chunk.toString());
    };

    this.endListener = () => {
      this.handleClose();
    };

    this.stdinErrorListener = (error: Error) => {
      this.emitError(error);
    };

    this.stdoutErrorListener = (error: Error) => {
      this.emitError(error);
    };

    // stdinからのデータ受信設定
    this.stdin.on('data', this.dataListener);

    // stdinのendイベント
    this.stdin.on('end', this.endListener);

    // エラーハンドリング
    this.stdin.on('error', this.stdinErrorListener);
    this.stdout.on('error', this.stdoutErrorListener);

    this.connected = true;
  }

  /**
   * メッセージを送信する
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    const messageStr = JSON.stringify(message) + '\n';

    return new Promise((resolve, reject) => {
      this.stdout.write(messageStr, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 接続をクローズする
   */
  async close(): Promise<void> {
    // 既にクローズ済みの場合は何もしない
    if (this.closed) {
      return;
    }

    // 保存されたリスナーのみを削除（他のモジュールのリスナーには影響しない）
    if (this.dataListener) {
      this.stdin.off('data', this.dataListener);
    }
    if (this.endListener) {
      this.stdin.off('end', this.endListener);
    }
    if (this.stdinErrorListener) {
      this.stdin.off('error', this.stdinErrorListener);
    }
    if (this.stdoutErrorListener) {
      this.stdout.off('error', this.stdoutErrorListener);
    }

    // クローズハンドラーを通知（connected/closedフラグはhandleClose()で設定される）
    this.handleClose();
  }

  /**
   * 接続状態を取得する
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * メッセージハンドラーを登録する
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * エラーハンドラーを登録する
   */
  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * クローズハンドラーを登録する
   */
  onClose(handler: CloseHandler): void {
    this.closeHandlers.push(handler);
  }

  /**
   * データを処理する
   */
  private handleData(data: string): void {
    this.buffer += data;

    // 改行で分割してメッセージを抽出
    const lines = this.buffer.split('\n');

    // 最後の要素は不完全な可能性があるのでバッファに保持
    this.buffer = lines.pop() || '';

    // 各行をJSON-RPCメッセージとしてパース
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }

      try {
        const message = JSON.parse(line) as JSONRPCMessage;
        this.emitMessage(message);
      } catch (error) {
        this.emitError(new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }
  }

  /**
   * メッセージイベントを発火する
   */
  private emitMessage(message: JSONRPCMessage): void {
    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }

  /**
   * エラーイベントを発火する
   */
  private emitError(error: Error): void {
    for (const handler of this.errorHandlers) {
      handler(error);
    }
  }

  /**
   * クローズイベントを発火する（冪等）
   */
  private handleClose(): void {
    // 既にクローズ済みの場合は何もしない（冪等性の保証）
    if (this.closed) {
      return;
    }

    this.connected = false;
    this.closed = true;

    for (const handler of this.closeHandlers) {
      handler();
    }
  }
}
