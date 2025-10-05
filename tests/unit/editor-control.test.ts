/**
 * Editor Control Tool のユニットテスト
 *
 * Requirements:
 * - 4.1: MCPクライアントがopen_file_in_editorツールを呼び出すと、指定されたファイルをCursor IDEで開き、成功ステータスを返却
 * - 4.2: MCPクライアントがget_active_fileツールを呼び出すと、現在アクティブなファイルのパスとカーソル位置を返却
 * - 4.3: MCPクライアントがinsert_textツールを呼び出すと、指定された位置にテキストを挿入し、変更後の状態を返却
 * - 4.4: MCPクライアントがreplace_textツールを呼び出すと、指定された範囲のテキストを置換し、変更後の状態を返却
 * - 4.5: Cursor IDEが起動していない場合はエラーレスポンス（IDE未起動）を返却
 * - 4.6: エディタ操作が実行中の場合は操作完了まで次のリクエストを待機
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  EditorControlTool,
  CursorEditorAPI,
  OpenFileParams,
  InsertTextParams,
  ReplaceTextParams,
  OpenFileResult,
  ActiveFileInfo,
  EditResult
} from '../../src/tools/editor-control';

/**
 * モックのCursor Editor API
 */
class MockCursorEditorAPI implements CursorEditorAPI {
  private _isRunning = true;
  private _activeFile: ActiveFileInfo = {
    path: null,
    cursorPosition: null,
    selection: null,
    isDirty: false
  };

  setRunning(running: boolean): void {
    this._isRunning = running;
  }

  setActiveFile(file: ActiveFileInfo): void {
    this._activeFile = file;
  }

  async isIDERunning(): Promise<boolean> {
    return this._isRunning;
  }

  async openFile(params: OpenFileParams): Promise<OpenFileResult> {
    return {
      success: true,
      path: params.path,
      isNewFile: false
    };
  }

  async getActiveFile(): Promise<ActiveFileInfo> {
    return this._activeFile;
  }

  async insertText(params: InsertTextParams): Promise<EditResult> {
    const position = params.position || { line: 1, column: 1 };
    return {
      success: true,
      newCursorPosition: {
        line: position.line,
        column: position.column + params.text.length
      },
      linesAffected: 1
    };
  }

  async replaceText(params: ReplaceTextParams): Promise<EditResult> {
    return {
      success: true,
      newCursorPosition: params.range.end,
      linesAffected: params.range.end.line - params.range.start.line + 1
    };
  }
}

describe('EditorControlTool - open_file_in_editor', () => {
  let editorTool: EditorControlTool;
  let mockAPI: MockCursorEditorAPI;

  beforeEach(() => {
    mockAPI = new MockCursorEditorAPI();
    editorTool = new EditorControlTool(mockAPI);
  });

  describe('基本的なファイルオープン', () => {
    it('ファイルパスを指定してファイルを開ける（Requirement 4.1）', async () => {
      const result = await editorTool.openFileInEditor({
        path: '/test/project/src/index.ts'
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/test/project/src/index.ts');
    });

    it('行番号と列番号を指定してファイルを開ける', async () => {
      const result = await editorTool.openFileInEditor({
        path: '/test/project/src/app.ts',
        line: 10,
        column: 5
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/test/project/src/app.ts');
    });

    it('プレビューモードでファイルを開ける', async () => {
      const result = await editorTool.openFileInEditor({
        path: '/test/project/README.md',
        preview: true
      });

      expect(result.success).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    it('Cursor IDEが起動していない場合はエラーを返す（Requirement 4.5）', async () => {
      mockAPI.setRunning(false);

      await expect(
        editorTool.openFileInEditor({
          path: '/test/project/src/index.ts'
        })
      ).rejects.toThrow('Cursor IDE is not running');
    });

    it('無効な行番号を指定した場合はバリデーションエラーを返す', async () => {
      await expect(
        editorTool.openFileInEditor({
          path: '/test/project/src/index.ts',
          line: 0 // 最小値は1
        })
      ).rejects.toThrow();
    });
  });
});

describe('EditorControlTool - get_active_file', () => {
  let editorTool: EditorControlTool;
  let mockAPI: MockCursorEditorAPI;

  beforeEach(() => {
    mockAPI = new MockCursorEditorAPI();
    editorTool = new EditorControlTool(mockAPI);
  });

  it('現在アクティブなファイル情報を取得できる（Requirement 4.2）', async () => {
    const activeFile: ActiveFileInfo = {
      path: '/test/project/src/index.ts',
      cursorPosition: { line: 10, column: 5 },
      selection: {
        start: { line: 10, column: 5 },
        end: { line: 10, column: 15 }
      },
      isDirty: true
    };

    mockAPI.setActiveFile(activeFile);

    const result = await editorTool.getActiveFile();

    expect(result.path).toBe('/test/project/src/index.ts');
    expect(result.cursorPosition).toEqual({ line: 10, column: 5 });
    expect(result.selection).toEqual({
      start: { line: 10, column: 5 },
      end: { line: 10, column: 15 }
    });
    expect(result.isDirty).toBe(true);
  });

  it('ファイルが開かれていない場合はnullを返す', async () => {
    const result = await editorTool.getActiveFile();

    expect(result.path).toBeNull();
    expect(result.cursorPosition).toBeNull();
    expect(result.selection).toBeNull();
  });

  it('Cursor IDEが起動していない場合はエラーを返す（Requirement 4.5）', async () => {
    mockAPI.setRunning(false);

    await expect(editorTool.getActiveFile()).rejects.toThrow('Cursor IDE is not running');
  });
});

describe('EditorControlTool - insert_text', () => {
  let editorTool: EditorControlTool;
  let mockAPI: MockCursorEditorAPI;

  beforeEach(() => {
    mockAPI = new MockCursorEditorAPI();
    editorTool = new EditorControlTool(mockAPI);
  });

  it('指定された位置にテキストを挿入できる（Requirement 4.3）', async () => {
    const result = await editorTool.insertText({
      text: 'console.log("test");',
      position: { line: 10, column: 5 }
    });

    expect(result.success).toBe(true);
    expect(result.newCursorPosition).toEqual({
      line: 10,
      column: 25 // 5 + 20文字
    });
    expect(result.linesAffected).toBe(1);
  });

  it('位置を省略した場合は現在のカーソル位置に挿入する', async () => {
    const result = await editorTool.insertText({
      text: 'test'
    });

    expect(result.success).toBe(true);
    expect(result.newCursorPosition).toBeDefined();
  });

  it('Cursor IDEが起動していない場合はエラーを返す（Requirement 4.5）', async () => {
    mockAPI.setRunning(false);

    await expect(
      editorTool.insertText({
        text: 'test',
        position: { line: 1, column: 1 }
      })
    ).rejects.toThrow('Cursor IDE is not running');
  });
});

describe('EditorControlTool - replace_text', () => {
  let editorTool: EditorControlTool;
  let mockAPI: MockCursorEditorAPI;

  beforeEach(() => {
    mockAPI = new MockCursorEditorAPI();
    editorTool = new EditorControlTool(mockAPI);
  });

  it('指定された範囲のテキストを置換できる（Requirement 4.4）', async () => {
    const result = await editorTool.replaceText({
      text: 'new text',
      range: {
        start: { line: 10, column: 1 },
        end: { line: 10, column: 10 }
      }
    });

    expect(result.success).toBe(true);
    expect(result.newCursorPosition).toEqual({ line: 10, column: 10 });
    expect(result.linesAffected).toBe(1);
  });

  it('複数行にまたがる範囲のテキストを置換できる', async () => {
    const result = await editorTool.replaceText({
      text: 'replacement',
      range: {
        start: { line: 5, column: 1 },
        end: { line: 8, column: 20 }
      }
    });

    expect(result.success).toBe(true);
    expect(result.linesAffected).toBe(4); // 5, 6, 7, 8行目
  });

  it('Cursor IDEが起動していない場合はエラーを返す（Requirement 4.5）', async () => {
    mockAPI.setRunning(false);

    await expect(
      editorTool.replaceText({
        text: 'test',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 5 }
        }
      })
    ).rejects.toThrow('Cursor IDE is not running');
  });
});
