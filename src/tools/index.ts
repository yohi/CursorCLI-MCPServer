/**
 * Tools Module
 *
 * MCPツールの登録とエクスポート
 * Requirement: 5.4
 */

import type { ToolRegistry } from '../protocol/registry.js';
import type { SecurityValidator } from '../security/validator.js';
import {
  FileOperationsTool,
  ReadFileSchema,
  WriteFileSchema,
  ListDirectorySchema
} from './file-operations.js';

/**
 * ファイル操作ツールをツールレジストリに登録する
 *
 * Requirement 5.4: ツールレジストリへの登録処理
 */
export function registerFileOperationsTools(
  registry: ToolRegistry,
  securityValidator: SecurityValidator,
  projectRoot: string
): void {
  const fileOps = new FileOperationsTool(securityValidator, projectRoot);

  // read_file ツールを登録
  registry.register({
    name: 'read_file',
    description: 'ファイルの内容を読み取ります。相対パスまたは絶対パスを指定できます。',
    schema: ReadFileSchema,
    handler: async (params) => {
      try {
        const result = await fileOps.readFile(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  });

  // write_file ツールを登録
  registry.register({
    name: 'write_file',
    description: 'ファイルに内容を書き込みます。相対パスまたは絶対パスを指定できます。',
    schema: WriteFileSchema,
    handler: async (params) => {
      try {
        const result = await fileOps.writeFile(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  });

  // list_directory ツールを登録
  registry.register({
    name: 'list_directory',
    description: 'ディレクトリの内容を一覧表示します。再帰的な取得やglobパターンフィルタリングに対応しています。',
    schema: ListDirectorySchema,
    handler: async (params) => {
      try {
        const result = await fileOps.listDirectory(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  });
}

export { FileOperationsTool } from './file-operations.js';
export type {
  ReadFileParams,
  ReadFileResult,
  WriteFileParams,
  WriteFileResult,
  ListDirectoryParams,
  ListDirectoryResult,
  FileEntry
} from './file-operations.js';
