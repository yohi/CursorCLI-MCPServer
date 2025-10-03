/**
 * Configuration Schema Definitions
 *
 * Zodスキーマを使用した設定の型安全性とバリデーションを提供します。
 */

import { z } from 'zod';

/**
 * サーバー設定スキーマ
 */
export const ServerConfigSchema = z.object({
  server: z.object({
    name: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    maxConcurrentRequests: z.number().int().min(1).max(100),
    requestTimeoutMs: z.number().int().min(1000).max(60000),
  }),
  tools: z.object({
    allowedTools: z.array(z.string()).min(1),
    fileOperations: z.object({
      maxFileSize: z.number().int().min(1024).max(100 * 1024 * 1024), // 1KB to 100MB
      allowedDirectories: z.array(z.string()),
      blockedPatterns: z.array(z.string()),
    }),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    outputs: z.array(z.enum(['console', 'file', 'cursor-output-panel'])).min(1),
    logFile: z.string().optional(),
    maxLogSize: z.number().int().min(1024 * 1024).max(100 * 1024 * 1024), // 1MB to 100MB
    rotationCount: z.number().int().min(1).max(30),
  }),
  security: z.object({
    enforceProjectRoot: z.boolean(),
    allowDestructiveOperations: z.boolean(),
  }),
});

/**
 * ServerConfig型
 */
export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/**
 * バリデーションエラー
 */
export interface ValidationError {
  field: string;
  message: string;
  received: unknown;
}

/**
 * デフォルト設定
 */
export const DEFAULT_CONFIG: ServerConfig = {
  server: {
    name: 'cursorcli-mcp-server',
    version: '1.0.0',
    maxConcurrentRequests: 10,
    requestTimeoutMs: 5000,
  },
  tools: {
    allowedTools: [
      'read_file',
      'write_file',
      'list_directory',
      'get_project_info',
      'search_files',
      'get_workspace_structure',
      'open_file_in_editor',
      'get_active_file',
      'insert_text',
      'replace_text',
      'get_current_model',
      'track_token_usage',
      'get_model_statistics',
      'get_server_stats',
    ],
    fileOperations: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedDirectories: [],
      blockedPatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
    },
  },
  logging: {
    level: 'info',
    outputs: ['console', 'file'],
    logFile: '.cursorcli-mcp/logs/server.log',
    maxLogSize: 10 * 1024 * 1024, // 10MB
    rotationCount: 5,
  },
  security: {
    enforceProjectRoot: true,
    allowDestructiveOperations: false,
  },
};
