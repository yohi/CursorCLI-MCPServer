/**
 * Project Management Tool Tests
 *
 * Requirements: 3.1-3.5
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  ProjectManagementTool,
  GetProjectInfoSchema,
  SearchFilesSchema,
  GetWorkspaceStructureSchema,
  type SearchFilesParams,
  type GetWorkspaceStructureParams
} from '../../src/tools/project-management';
import { SecurityValidator } from '../../src/security/validator';

describe('ProjectManagementTool', () => {
  let tool: ProjectManagementTool;
  let securityValidator: SecurityValidator;
  let projectRoot: string;

  beforeEach(async () => {
    // テスト用ディレクトリを作成
    projectRoot = path.join(process.cwd(), 'test-project');
    await fs.mkdir(projectRoot, { recursive: true });

    // SecurityValidator の作成
    securityValidator = new SecurityValidator({
      projectRoot,
      blockedPatterns: [],
      enforceProjectRoot: true
    });

    // ProjectManagementTool の作成
    tool = new ProjectManagementTool(projectRoot, securityValidator);
  });

  afterEach(async () => {
    // テスト用ディレクトリをクリーンアップ
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  describe('get_project_info', () => {
    it('プロジェクト情報を正常に取得できる', async () => {
      // Arrange
      const packageJson = {
        name: 'test-project',
        version: '1.0.0'
      };
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      // Act
      const result = await tool.getProjectInfo();

      // Assert
      expect(result).toEqual({
        name: 'test-project',
        rootPath: projectRoot,
        settings: {},
        language: 'typescript' // package.jsonから推測
      });
    });

    it('.cursor/settings.json が存在する場合、設定情報を含む', async () => {
      // Arrange
      const packageJson = {
        name: 'test-project',
        version: '1.0.0'
      };
      const cursorSettings = {
        theme: 'dark',
        fontSize: 14
      };

      await fs.mkdir(path.join(projectRoot, '.cursor'), { recursive: true });
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));
      await fs.writeFile(
        path.join(projectRoot, '.cursor', 'settings.json'),
        JSON.stringify(cursorSettings)
      );

      // Act
      const result = await tool.getProjectInfo();

      // Assert
      expect(result.settings).toEqual(cursorSettings);
    });

    it('プロジェクトが初期化されていない場合、エラーをスローする', async () => {
      // Arrange
      // package.jsonが存在しない状態

      // Act & Assert
      await expect(tool.getProjectInfo()).rejects.toThrow('プロジェクトが初期化されていません');
    });

    it('フレームワーク情報を推測できる', async () => {
      // Arrange
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0'
        }
      };
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify(packageJson));

      // Act
      const result = await tool.getProjectInfo();

      // Assert
      expect(result.framework).toBe('react');
    });

    it('言語情報を推測できる (Python)', async () => {
      // Arrange
      const setupPy = `from setuptools import setup

setup(
    name='test-project',
    version='1.0.0'
)`;
      await fs.writeFile(path.join(projectRoot, 'setup.py'), setupPy);

      // Act
      const result = await tool.getProjectInfo();

      // Assert
      expect(result.language).toBe('python');
    });
  });

  describe('search_files', () => {
    beforeEach(async () => {
      // テスト用のファイル構造を作成
      await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
      await fs.mkdir(path.join(projectRoot, 'tests'), { recursive: true });
      await fs.mkdir(path.join(projectRoot, 'node_modules'), { recursive: true });

      await fs.writeFile(path.join(projectRoot, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(projectRoot, 'src', 'main.ts'), '');
      await fs.writeFile(path.join(projectRoot, 'tests', 'test.ts'), '');
      await fs.writeFile(path.join(projectRoot, 'node_modules', 'lib.js'), '');
      await fs.writeFile(path.join(projectRoot, 'README.md'), '');
    });

    it('glob パターンでファイルを検索できる', async () => {
      // Arrange
      const params: SearchFilesParams = {
        pattern: '**/*.ts'
      };

      // Act
      const result = await tool.searchFiles(params);

      // Assert
      expect(result.files).toHaveLength(3);
      expect(result.files.map(f => path.basename(f.path))).toEqual(
        expect.arrayContaining(['index.ts', 'main.ts', 'test.ts'])
      );
      expect(result.totalCount).toBe(3);
      expect(result.truncated).toBe(false);
    });

    it('.gitignore に基づいてファイルを除外できる', async () => {
      // Arrange
      await fs.writeFile(path.join(projectRoot, '.gitignore'), 'node_modules/\n*.log');
      const params: SearchFilesParams = {
        pattern: '**/*',
        includeIgnored: false
      };

      // Act
      const result = await tool.searchFiles(params);

      // Assert
      expect(result.files.find(f => f.path.includes('node_modules'))).toBeUndefined();
    });

    it('最大結果数を制限できる', async () => {
      // Arrange
      const params: SearchFilesParams = {
        pattern: '**/*.ts',
        maxResults: 2
      };

      // Act
      const result = await tool.searchFiles(params);

      // Assert
      expect(result.files).toHaveLength(2);
      expect(result.truncated).toBe(true);
      expect(result.totalCount).toBe(3);
    });

    it('ファイルタイプでフィルタリングできる', async () => {
      // Arrange
      const params: SearchFilesParams = {
        pattern: '**/*',
        fileType: 'file'
      };

      // Act
      const result = await tool.searchFiles(params);

      // Assert
      expect(result.files.every(f => f.type === 'file')).toBe(true);
    });
  });

  describe('get_workspace_structure', () => {
    beforeEach(async () => {
      // テスト用のディレクトリ構造を作成
      await fs.mkdir(path.join(projectRoot, 'src', 'components'), { recursive: true });
      await fs.mkdir(path.join(projectRoot, 'tests'), { recursive: true });

      await fs.writeFile(path.join(projectRoot, 'src', 'index.ts'), 'content');
      await fs.writeFile(path.join(projectRoot, 'src', 'components', 'Button.tsx'), 'content');
      await fs.writeFile(path.join(projectRoot, 'tests', 'test.ts'), 'content');
    });

    it('ワークスペース構造を取得できる', async () => {
      // Arrange
      const params: GetWorkspaceStructureParams = {
        maxDepth: 5
      };

      // Act
      const result = await tool.getWorkspaceStructure(params);

      // Assert
      expect(result.root.name).toBe('test-project');
      expect(result.root.type).toBe('directory');
      expect(result.root.children).toBeDefined();
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalDirectories).toBeGreaterThan(0);
    });

    it('最大深さを制限できる', async () => {
      // Arrange
      const params: GetWorkspaceStructureParams = {
        maxDepth: 1
      };

      // Act
      const result = await tool.getWorkspaceStructure(params);

      // Assert
      // 深さ1なので、直下のディレクトリまで
      const srcDir = result.root.children.find(c => c.name === 'src');
      expect(srcDir).toBeDefined();
      if (srcDir && srcDir.type === 'directory') {
        expect(srcDir.children).toHaveLength(0); // 深さ制限により子は含まれない
      }
    });

    it('除外パターンを適用できる', async () => {
      // Arrange
      await fs.mkdir(path.join(projectRoot, 'node_modules'), { recursive: true });
      await fs.writeFile(path.join(projectRoot, 'node_modules', 'lib.js'), '');

      const params: GetWorkspaceStructureParams = {
        maxDepth: 5,
        excludePatterns: ['node_modules/**']
      };

      // Act
      const result = await tool.getWorkspaceStructure(params);

      // Assert
      const hasNodeModules = result.root.children.some(c => c.name === 'node_modules');
      expect(hasNodeModules).toBe(false);
    });

    it('ファイルサイズ情報を含む', async () => {
      // Arrange
      const params: GetWorkspaceStructureParams = {
        maxDepth: 5
      };

      // Act
      const result = await tool.getWorkspaceStructure(params);

      // Assert
      const findFile = (node: any, name: string): any => {
        if (node.type === 'file' && node.name === name) {
          return node;
        }
        if (node.type === 'directory' && node.children) {
          for (const child of node.children) {
            const found = findFile(child, name);
            if (found) return found;
          }
        }
        return null;
      };

      const indexFile = findFile(result.root, 'index.ts');
      expect(indexFile).toBeDefined();
      expect(indexFile?.size).toBeDefined();
    });
  });

  describe('Schema Validation', () => {
    it('GetProjectInfoSchema は正しく定義されている', () => {
      const result = GetProjectInfoSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('SearchFilesSchema は正しくバリデーションする', () => {
      const validParams = {
        pattern: '**/*.ts',
        includeIgnored: false,
        maxResults: 100,
        fileType: 'file' as const
      };

      const result = SearchFilesSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('SearchFilesSchema は不正な値を拒否する', () => {
      const invalidParams = {
        pattern: '**/*.ts',
        maxResults: 2000 // 最大1000を超える
      };

      const result = SearchFilesSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('GetWorkspaceStructureSchema は正しくバリデーションする', () => {
      const validParams = {
        maxDepth: 5,
        excludePatterns: ['node_modules/**']
      };

      const result = GetWorkspaceStructureSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('GetWorkspaceStructureSchema は不正な深さを拒否する', () => {
      const invalidParams = {
        maxDepth: 20 // 最大10を超える
      };

      const result = GetWorkspaceStructureSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });
});
