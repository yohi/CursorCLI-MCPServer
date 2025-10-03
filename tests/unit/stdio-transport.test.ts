/**
 * stdio Transport のユニットテスト
 *
 * Requirements:
 * - 1.5: JSON-RPC 2.0形式のメッセージ送受信を維持
 * - 9.2: stdioトランスポート方式で通信を確立
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Readable, Writable } from 'stream';
import { StdioTransport } from '../../src/protocol/transport';
import type { JSONRPCMessage } from '../../src/protocol/types';

describe('StdioTransport', () => {
  let mockStdin: Readable;
  let mockStdout: Writable;
  let transport: StdioTransport;
  let outputData: string[] = [];

  beforeEach(() => {
    // モックストリームの作成
    mockStdin = new Readable({
      read() {}
    });

    mockStdout = new Writable({
      write(chunk: any, _encoding: any, callback: any) {
        outputData.push(chunk.toString());
        callback();
      }
    });

    outputData = [];

    transport = new StdioTransport({
      stdin: mockStdin,
      stdout: mockStdout
    });
  });

  afterEach(async () => {
    await transport.close();
  });

  describe('初期化とライフサイクル', () => {
    it('トランスポートを初期化できる', () => {
      expect(transport).toBeDefined();
      expect(transport.isConnected()).toBe(false);
    });

    it('接続を開始できる', async () => {
      await transport.start();
      expect(transport.isConnected()).toBe(true);
    });

    it('接続をクローズできる', async () => {
      await transport.start();
      await transport.close();
      expect(transport.isConnected()).toBe(false);
    });

    it('クローズ後に再接続しようとするとエラーをスローする', async () => {
      await transport.start();
      await transport.close();
      await expect(transport.start()).rejects.toThrow('Transport already closed');
    });
  });

  describe('JSON-RPCメッセージの送信', () => {
    beforeEach(async () => {
      await transport.start();
    });

    it('JSON-RPCメッセージを送信できる', async () => {
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: { foo: 'bar' }
      };

      await transport.send(message);

      expect(outputData.length).toBe(1);
      const sent = JSON.parse(outputData[0]);
      expect(sent).toEqual(message);
    });

    it('複数のメッセージを順次送信できる', async () => {
      const messages: JSONRPCMessage[] = [
        { jsonrpc: '2.0', id: 1, method: 'test1' },
        { jsonrpc: '2.0', id: 2, method: 'test2' },
        { jsonrpc: '2.0', id: 3, method: 'test3' }
      ];

      for (const msg of messages) {
        await transport.send(msg);
      }

      expect(outputData.length).toBe(3);
      messages.forEach((msg, i) => {
        expect(JSON.parse(outputData[i])).toEqual(msg);
      });
    });

    it('未接続時にメッセージを送信しようとするとエラーをスローする', async () => {
      await transport.close();
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test'
      };

      await expect(transport.send(message)).rejects.toThrow('Transport not connected');
    });
  });

  describe('JSON-RPCメッセージの受信', () => {
    beforeEach(async () => {
      await transport.start();
    });

    it('JSON-RPCメッセージを受信できる', (done) => {
      const expectedMessage: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: { foo: 'bar' }
      };

      transport.onMessage((message: JSONRPCMessage) => {
        expect(message).toEqual(expectedMessage);
        done();
      });

      const messageStr = JSON.stringify(expectedMessage) + '\n';
      mockStdin.push(messageStr);
    });

    it('複数の改行区切りメッセージを受信できる', (done) => {
      const messages: JSONRPCMessage[] = [
        { jsonrpc: '2.0', id: 1, method: 'test1' },
        { jsonrpc: '2.0', id: 2, method: 'test2' }
      ];

      const received: JSONRPCMessage[] = [];

      transport.onMessage((message: JSONRPCMessage) => {
        received.push(message);
        if (received.length === messages.length) {
          expect(received).toEqual(messages);
          done();
        }
      });

      const messageStr = messages.map(m => JSON.stringify(m)).join('\n') + '\n';
      mockStdin.push(messageStr);
    });

    it('不正なJSONを受信した場合、エラーイベントを発火する', (done) => {
      transport.onError((error: Error) => {
        expect(error.message).toContain('Invalid JSON');
        done();
      });

      mockStdin.push('invalid json\n');
    });

    it('不完全なメッセージはバッファリングされる', (done) => {
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test'
      };

      transport.onMessage((msg: JSONRPCMessage) => {
        expect(msg).toEqual(message);
        done();
      });

      const messageStr = JSON.stringify(message) + '\n';
      // メッセージを分割して送信
      mockStdin.push(messageStr.substring(0, 10));
      setTimeout(() => {
        mockStdin.push(messageStr.substring(10));
      }, 10);
    });
  });

  describe('エラーハンドリング', () => {
    beforeEach(async () => {
      await transport.start();
    });

    it('stdinエラーをキャッチしてエラーイベントを発火する', (done) => {
      transport.onError((error: Error) => {
        expect(error.message).toBe('stdin error');
        done();
      });

      mockStdin.emit('error', new Error('stdin error'));
    });

    it('stdoutエラーをキャッチしてエラーイベントを発火する', (done) => {
      transport.onError((error: Error) => {
        expect(error.message).toBe('stdout error');
        done();
      });

      mockStdout.emit('error', new Error('stdout error'));
    });
  });

  describe('クローズイベント', () => {
    it('stdinクローズ時にクローズイベントを発火する', (done) => {
      transport.start().then(() => {
        transport.onClose(() => {
          expect(transport.isConnected()).toBe(false);
          done();
        });

        mockStdin.emit('end');
      });
    });
  });
});
