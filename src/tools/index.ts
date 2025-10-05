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
import {
  ProjectManagementTool,
  GetProjectInfoSchema,
  SearchFilesSchema,
  GetWorkspaceStructureSchema
} from './project-management.js';
import {
  EditorControlTool,
  CursorEditorAPI,
  OpenFileSchema,
  GetActiveFileSchema,
  InsertTextSchema,
  ReplaceTextSchema
} from './editor-control.js';

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

/**
 * プロジェクト管理ツールをツールレジストリに登録する
 *
 * Requirement 6.4: ツールレジストリへの登録処理
 */
export function registerProjectManagementTools(
  registry: ToolRegistry,
  securityValidator: SecurityValidator,
  projectRoot: string
): void {
  const projectMgmt = new ProjectManagementTool(projectRoot, securityValidator);

  // get_project_info ツールを登録
  registry.register({
    name: 'get_project_info',
    description: 'プロジェクトの情報（名前、ルートパス、設定、言語、フレームワーク）を取得します。',
    schema: GetProjectInfoSchema,
    handler: async () => {
      try {
        const result = await projectMgmt.getProjectInfo();
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

  // search_files ツールを登録
  registry.register({
    name: 'search_files',
    description: 'glob パターンでファイルを検索します。.gitignore対応、最大結果数制限、ファイルタイプフィルタリングが可能です。',
    schema: SearchFilesSchema,
    handler: async (params) => {
      try {
        const result = await projectMgmt.searchFiles(params);
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

  // get_workspace_structure ツールを登録
  registry.register({
    name: 'get_workspace_structure',
    description: 'プロジェクトのディレクトリツリー構造をJSON形式で取得します。最大深さ制限と除外パターンに対応しています。',
    schema: GetWorkspaceStructureSchema,
    handler: async (params) => {
      try {
        const result = await projectMgmt.getWorkspaceStructure(params);
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

/**
 * エディタ制御ツールをツールレジストリに登録する
 *
 * Requirement 7.4: ツールレジストリへの登録処理
 */
export function registerEditorControlTools(
  registry: ToolRegistry,
  editorAPI: CursorEditorAPI
): void {
  const editorControl = new EditorControlTool(editorAPI);

  // open_file_in_editor ツールを登録
  registry.register({
    name: 'open_file_in_editor',
    description: 'Cursor IDEでファイルを開きます。行番号や列番号を指定してカーソル位置を移動できます。',
    schema: OpenFileSchema,
    handler: async (params) => {
      try {
        const result = await editorControl.openFileInEditor(params);
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

  // get_active_file ツールを登録
  registry.register({
    name: 'get_active_file',
    description: '現在Cursor IDEでアクティブになっているファイルの情報（パス、カーソル位置、選択範囲）を取得します。',
    schema: GetActiveFileSchema,
    handler: async () => {
      try {
        const result = await editorControl.getActiveFile();
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

  // insert_text ツールを登録
  registry.register({
    name: 'insert_text',
    description: '指定された位置にテキストを挿入します。位置を省略した場合は現在のカーソル位置に挿入します。',
    schema: InsertTextSchema,
    handler: async (params) => {
      try {
        const result = await editorControl.insertText(params);
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

  // replace_text ツールを登録
  registry.register({
    name: 'replace_text',
    description: '指定された範囲のテキストを置換します。複数行にまたがる範囲も指定できます。',
    schema: ReplaceTextSchema,
    handler: async (params) => {
      try {
        const result = await editorControl.replaceText(params);
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
export { ProjectManagementTool } from './project-management.js';
export { EditorControlTool } from './editor-control.js';

export type {
  ReadFileParams,
  ReadFileResult,
  WriteFileParams,
  WriteFileResult,
  ListDirectoryParams,
  ListDirectoryResult,
  FileEntry
} from './file-operations.js';

export type {
  ProjectInfo,
  SearchFilesParams,
  SearchFilesResult,
  SearchResult,
  GetWorkspaceStructureParams,
  WorkspaceStructure,
  DirectoryNode,
  FileNode
} from './project-management.js';

export type {
  OpenFileParams,
  OpenFileResult,
  GetActiveFileParams,
  ActiveFileInfo,
  InsertTextParams,
  ReplaceTextParams,
  EditResult,
  Position,
  CursorEditorAPI
} from './editor-control.js';
