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

    // stdinからのデータ受信設定
    this.stdin.on('data', (chunk: Buffer) => {
      this.handleData(chunk.toString());
    });

    // stdinのendイベント
    this.stdin.on('end', () => {
      this.handleClose();
    });

    // エラーハンドリング
    this.stdin.on('error', (error: Error) => {
      this.emitError(error);
    });

    this.stdout.on('error', (error: Error) => {
      this.emitError(error);
    });

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
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.closed = true;

    // リスナーをクリア
    this.stdin.removeAllListeners();
    this.stdout.removeAllListeners();
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
   * クローズイベントを発火する
   */
  private handleClose(): void {
    this.connected = false;

    for (const handler of this.closeHandlers) {
      handler();
    }
  }
}
