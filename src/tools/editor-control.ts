/**
 * Editor Control Tool
 *
 * Cursor IDEエディタ制御（ファイルオープン、テキスト編集、カーソル制御）のMCPツール実装
 * Requirements: 4.1-4.6
 */

import { z } from 'zod';

/**
 * Position（行と列）の定義
 */
export interface Position {
  line: number;
  column: number;
}

/**
 * open_file_in_editor ツールのスキーマ
 */
export const OpenFileSchema = z.object({
  path: z.string().describe('開くファイルのパス'),
  line: z.number().min(1).optional().describe('移動先の行番号'),
  column: z.number().min(1).optional().describe('移動先の列番号'),
  preview: z.boolean().default(false).describe('プレビューモードで開く')
});

export type OpenFileParams = z.infer<typeof OpenFileSchema>;

/**
 * open_file_in_editor ツールの結果
 */
export interface OpenFileResult {
  success: boolean;
  path: string;
  isNewFile: boolean;
}

/**
 * get_active_file ツールのスキーマ（パラメータなし）
 */
export const GetActiveFileSchema = z.object({});

export type GetActiveFileParams = z.infer<typeof GetActiveFileSchema>;

/**
 * get_active_file ツールの結果
 */
export interface ActiveFileInfo {
  path: string | null;
  cursorPosition: Position | null;
  selection: { start: Position; end: Position } | null;
  isDirty: boolean;
}

/**
 * insert_text ツールのスキーマ
 */
export const InsertTextSchema = z.object({
  text: z.string().describe('挿入するテキスト'),
  position: z.object({
    line: z.number().min(1),
    column: z.number().min(1)
  }).optional().describe('挿入位置（省略時は現在のカーソル位置）')
});

export type InsertTextParams = z.infer<typeof InsertTextSchema>;

/**
 * replace_text ツールのスキーマ
 */
export const ReplaceTextSchema = z.object({
  text: z.string().describe('置換後のテキスト'),
  range: z.object({
    start: z.object({ line: z.number().min(1), column: z.number().min(1) }),
    end: z.object({ line: z.number().min(1), column: z.number().min(1) })
  }).describe('置換範囲')
});

export type ReplaceTextParams = z.infer<typeof ReplaceTextSchema>;

/**
 * 編集操作の結果
 */
export interface EditResult {
  success: boolean;
  newCursorPosition: Position;
  linesAffected: number;
}

/**
 * CursorCLI Editor API Interface
 *
 * 実際のCursor IDEとの通信を抽象化したインターフェース。
 * テスト時はモックを使用し、本番環境では実際のCursor IDEと通信する実装を使用します。
 */
export interface CursorEditorAPI {
  /**
   * Cursor IDEが起動しているか確認
   */
  isIDERunning(): Promise<boolean>;

  /**
   * ファイルをエディタで開く
   */
  openFile(params: OpenFileParams): Promise<OpenFileResult>;

  /**
   * 現在アクティブなファイル情報を取得
   */
  getActiveFile(): Promise<ActiveFileInfo>;

  /**
   * テキストを挿入
   */
  insertText(params: InsertTextParams): Promise<EditResult>;

  /**
   * テキストを置換
   */
  replaceText(params: ReplaceTextParams): Promise<EditResult>;
}

/**
 * Editor Control Tool
 *
 * Requirement 4.1-4.6: エディタ制御機能のMCPツール化
 */
export class EditorControlTool {
  constructor(private editorAPI: CursorEditorAPI) {}

  /**
   * ファイルをCursor IDEで開く
   *
   * Requirement 4.1: ファイルをCursor IDEで開き、成功ステータスを返却
   * Requirement 4.5: Cursor IDEが起動していない場合はエラーを返却
   */
  async openFileInEditor(params: OpenFileParams): Promise<OpenFileResult> {
    // パラメータのバリデーション
    const validated = OpenFileSchema.parse(params);

    // IDE起動確認
    const isRunning = await this.editorAPI.isIDERunning();
    if (!isRunning) {
      throw new Error('Cursor IDE is not running');
    }

    // ファイルを開く
    const result = await this.editorAPI.openFile(validated);
    return result;
  }

  /**
   * 現在アクティブなファイル情報を取得
   *
   * Requirement 4.2: 現在アクティブなファイルのパスとカーソル位置を返却
   */
  async getActiveFile(): Promise<ActiveFileInfo> {
    // IDE起動確認
    const isRunning = await this.editorAPI.isIDERunning();
    if (!isRunning) {
      throw new Error('Cursor IDE is not running');
    }

    const result = await this.editorAPI.getActiveFile();
    return result;
  }

  /**
   * テキストを挿入
   *
   * Requirement 4.3: 指定された位置にテキストを挿入し、変更後の状態を返却
   */
  async insertText(params: InsertTextParams): Promise<EditResult> {
    // パラメータのバリデーション
    const validated = InsertTextSchema.parse(params);

    // IDE起動確認
    const isRunning = await this.editorAPI.isIDERunning();
    if (!isRunning) {
      throw new Error('Cursor IDE is not running');
    }

    const result = await this.editorAPI.insertText(validated);
    return result;
  }

  /**
   * テキストを置換
   *
   * Requirement 4.4: 指定された範囲のテキストを置換し、変更後の状態を返却
   */
  async replaceText(params: ReplaceTextParams): Promise<EditResult> {
    // パラメータのバリデーション
    const validated = ReplaceTextSchema.parse(params);

    // IDE起動確認
    const isRunning = await this.editorAPI.isIDERunning();
    if (!isRunning) {
      throw new Error('Cursor IDE is not running');
    }

    const result = await this.editorAPI.replaceText(validated);
    return result;
  }
}
