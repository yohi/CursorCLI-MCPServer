/**
 * Project Management Tool
 *
 * プロジェクト情報の取得、ファイル検索、ワークスペース構造の提供
 * Requirements: 3.1-3.5
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { minimatch } from 'minimatch';
import ignore from 'ignore';
import type { SecurityValidator } from '../security/validator.js';

/**
 * get_project_info ツールのスキーマ
 */
export const GetProjectInfoSchema = z.object({});

export type GetProjectInfoParams = z.infer<typeof GetProjectInfoSchema>;

/**
 * プロジェクト情報
 */
export interface ProjectInfo {
  name: string;
  rootPath: string;
  settings: Record<string, unknown>;
  language: string;
  framework?: string;
}

/**
 * search_files ツールのスキーマ
 */
export const SearchFilesSchema = z.object({
  pattern: z.string().describe('検索パターン（glob形式）'),
  includeIgnored: z.boolean().default(false).optional().describe('.gitignore対象の含有'),
  maxDepth: z.number().min(1).max(50).default(20).optional().describe('最大検索深度'),
  maxResults: z.number().min(1).max(1000).default(100).optional().describe('最大結果数'),
  fileType: z.enum(['file', 'directory', 'all']).default('all').optional(),
});

export type SearchFilesParams = z.infer<typeof SearchFilesSchema>;

/**
 * 検索結果
 */
export interface SearchResult {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified: string;
}

/**
 * search_files ツールの結果
 */
export interface SearchFilesResult {
  files: SearchResult[];
  totalCount: number;
  truncated: boolean;
}

/**
 * get_workspace_structure ツールのスキーマ
 */
export const GetWorkspaceStructureSchema = z.object({
  maxDepth: z
    .number()
    .min(1)
    .max(10)
    .default(5)
    .optional()
    .describe('ディレクトリツリーの最大深さ'),
  excludePatterns: z.array(z.string()).default([]).optional().describe('除外パターン'),
});

export type GetWorkspaceStructureParams = z.infer<typeof GetWorkspaceStructureSchema>;

/**
 * ディレクトリノード
 */
export interface DirectoryNode {
  name: string;
  path: string;
  type: 'directory';
  children: (FileNode | DirectoryNode)[];
}

/**
 * ファイルノード
 */
export interface FileNode {
  name: string;
  path: string;
  type: 'file';
  size: number;
}

/**
 * ワークスペース構造
 */
export interface WorkspaceStructure {
  root: DirectoryNode;
  totalFiles: number;
  totalDirectories: number;
}

/**
 * Project Management Tool
 *
 * Requirement 3.1-3.5: プロジェクト管理機能のMCPツール化
 */
export class ProjectManagementTool {
  constructor(
    private readonly projectRoot: string,
    private readonly securityValidator: SecurityValidator
  ) {}

  /**
   * プロジェクト情報を取得
   */
  async getProjectInfo(): Promise<ProjectInfo> {
    // プロジェクトが初期化されているか確認
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const setupPyPath = path.join(this.projectRoot, 'setup.py');

    let projectName = path.basename(this.projectRoot);
    let language = 'unknown';
    let framework: string | undefined;
    let settings: Record<string, unknown> = {};

    try {
      // package.json から情報を取得
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      projectName = packageJson.name || projectName;
      language = 'typescript'; // package.json があれば TypeScript/JavaScript プロジェクトと推測

      // フレームワークを推測
      if (packageJson.dependencies) {
        if (packageJson.dependencies.react) {
          framework = 'react';
        } else if (packageJson.dependencies.vue) {
          framework = 'vue';
        } else if (packageJson.dependencies.angular) {
          framework = 'angular';
        }
      }
    } catch (error) {
      // package.json がない場合、他のファイルをチェック
      try {
        await fs.access(setupPyPath);
        language = 'python';
      } catch {
        // どちらもない場合はエラー
        throw new Error('プロジェクトが初期化されていません');
      }
    }

    // .cursor/settings.json から設定を読み込み
    const cursorSettingsPath = path.join(this.projectRoot, '.cursor', 'settings.json');
    try {
      const cursorSettingsContent = await fs.readFile(cursorSettingsPath, 'utf-8');
      settings = JSON.parse(cursorSettingsContent);
    } catch {
      // 設定ファイルがない場合は空のオブジェクト
    }

    return {
      name: projectName,
      rootPath: this.projectRoot,
      settings,
      language,
      framework,
    };
  }

  /**
   * ファイルを検索
   */
  async searchFiles(params: SearchFilesParams): Promise<SearchFilesResult> {
    const {
      pattern,
      includeIgnored = false,
      maxDepth = 20,
      maxResults = 100,
      fileType = 'all',
    } = params;

    // .gitignore を読み込み
    let ig: ReturnType<typeof ignore> | null = null;
    if (!includeIgnored) {
      const gitignorePath = path.join(this.projectRoot, '.gitignore');
      try {
        const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
        ig = ignore().add(gitignoreContent);
      } catch {
        // .gitignore がない場合は無視
      }
    }

    // ファイルを再帰的に検索
    const allFiles: SearchResult[] = [];
    const searchDir = async (dir: string, depth: number): Promise<void> => {
      // 深さ制限チェック
      if (depth > maxDepth) {
        return;
      }

      // セキュリティ検証
      const validateResult = this.securityValidator.validatePath(dir);
      if (!validateResult.ok) {
        throw new Error(validateResult.error.message);
      }

      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.projectRoot, fullPath);

        // Windows対応: バックスラッシュをフォワードスラッシュに変換
        const posixPath = relativePath.replace(/\\/g, '/');

        // .gitignore チェック（ディレクトリの場合は末尾に / を追加）
        const pathToCheck = entry.isDirectory() ? `${posixPath}/` : posixPath;
        if (ig && ig.ignores(pathToCheck)) {
          continue;
        }

        const isFile = entry.isFile();
        const isDirectory = entry.isDirectory();

        // fileType フィルター
        if (fileType === 'file' && !isFile) continue;
        if (fileType === 'directory' && !isDirectory) continue;

        // glob パターンマッチング（POSIX形式のパスを使用）
        if (minimatch(posixPath, pattern)) {
          const stats = await fs.stat(fullPath);
          allFiles.push({
            path: fullPath,
            type: isFile ? 'file' : 'directory',
            size: isFile ? stats.size : undefined,
            lastModified: stats.mtime.toISOString(),
          });
        }

        // ディレクトリの場合、再帰的に検索（深さを増やす）
        if (isDirectory) {
          await searchDir(fullPath, depth + 1);
        }
      }
    };

    await searchDir(this.projectRoot, 0);

    // 最大結果数を適用
    const totalCount = allFiles.length;
    const truncated = totalCount > maxResults;
    const files = allFiles.slice(0, maxResults);

    return {
      files,
      totalCount,
      truncated,
    };
  }

  /**
   * ワークスペース構造を取得
   */
  async getWorkspaceStructure(params: GetWorkspaceStructureParams): Promise<WorkspaceStructure> {
    const { maxDepth = 5, excludePatterns = [] } = params;

    let totalFiles = 0;
    let totalDirectories = 0;

    const buildTree = async (
      dirPath: string,
      currentDepth: number
    ): Promise<DirectoryNode | FileNode | null> => {
      const stats = await fs.stat(dirPath);
      const relativePath = path.relative(this.projectRoot, dirPath);
      const name = path.basename(dirPath);

      // Windows対応: バックスラッシュをフォワードスラッシュに変換してPOSIX形式に
      const posixPath = relativePath.replace(/\\/g, '/');

      // セキュリティ検証（POSIX形式のパスを使用）
      if (posixPath !== '') {
        const validateResult = this.securityValidator.validatePath(dirPath);
        if (!validateResult.ok) {
          return null; // ブロックされたパスは除外
        }
      }

      // 除外パターンチェック（POSIX形式のパスを使用）
      if (posixPath !== '') {
        const pathToCheck = stats.isDirectory() ? `${posixPath}/` : posixPath;
        for (const pattern of excludePatterns) {
          if (minimatch(pathToCheck, pattern)) {
            return null;
          }
        }
      }

      if (stats.isFile()) {
        totalFiles++;
        return {
          name,
          path: dirPath,
          type: 'file',
          size: stats.size,
        };
      }

      if (stats.isDirectory()) {
        totalDirectories++;
        const children: (FileNode | DirectoryNode)[] = [];

        // 深さ制限チェック
        if (currentDepth < maxDepth) {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const child = await buildTree(fullPath, currentDepth + 1);
            if (child) {
              children.push(child);
            }
          }
        }

        return {
          name,
          path: dirPath,
          type: 'directory',
          children,
        };
      }

      return null;
    };

    const root = await buildTree(this.projectRoot, 0);

    if (!root || root.type !== 'directory') {
      throw new Error('Failed to build workspace structure');
    }

    return {
      root,
      totalFiles,
      totalDirectories,
    };
  }
}
