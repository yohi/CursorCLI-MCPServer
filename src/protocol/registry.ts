/**
 * Tool Registry
 *
 * MCPツールの登録・管理機能
 * Requirement: 1.4
 */

import { z } from 'zod';
import type { ToolDefinition, CallToolResult } from './types.js';

/**
 * ツールハンドラー
 */
export type ToolHandler<T = any> = (params: T) => Promise<CallToolResult>;

/**
 * ツール登録情報
 */
export interface ToolRegistration<T extends z.ZodType = z.ZodType> {
  name: string;
  description?: string;
  schema: T;
  handler: ToolHandler<z.infer<T>>;
}

/**
 * 内部ツール情報
 */
interface InternalTool {
  name: string;
  description?: string;
  schema: z.ZodType;
  handler: ToolHandler;
  enabled: boolean;
}

/**
 * ZodスキーマをJSON Schemaに変換する
 */
function zodToJsonSchema(schema: z.ZodType): any {
  // 簡易的なZod -> JSON Schema変換
  // 実際のプロダクションではzod-to-json-schemaなどのライブラリを使用すべき

  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      if (value instanceof z.ZodString) {
        properties[key] = { type: 'string' };
        if (value.description) {
          properties[key].description = value.description;
        }
      } else if (value instanceof z.ZodNumber) {
        properties[key] = { type: 'number' };
      } else if (value instanceof z.ZodBoolean) {
        properties[key] = { type: 'boolean' };
      } else if (value instanceof z.ZodEnum) {
        properties[key] = {
          type: 'string',
          enum: value._def.values
        };
      } else if (value instanceof z.ZodOptional) {
        const innerType = value._def.innerType;
        properties[key] = zodToJsonSchema(innerType);
      } else {
        properties[key] = { type: 'object' };
      }

      // 必須フィールドの判定
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {})
    };
  }

  return { type: 'object' };
}

/**
 * Tool Registry
 *
 * Requirement 1.4: MCPクライアントが利用可能なツール一覧をリクエストした際、全ての公開ツール定義を返却
 */
export class ToolRegistry {
  private tools: Map<string, InternalTool> = new Map();

  /**
   * ツールを登録する
   */
  register<T extends z.ZodType>(registration: ToolRegistration<T>): void {
    if (this.tools.has(registration.name)) {
      throw new Error(`Tool already registered: ${registration.name}`);
    }

    this.tools.set(registration.name, {
      name: registration.name,
      description: registration.description,
      schema: registration.schema,
      handler: registration.handler,
      enabled: true
    });
  }

  /**
   * ツールを登録解除する
   */
  unregister(name: string): void {
    if (!this.tools.has(name)) {
      throw new Error(`Tool not found: ${name}`);
    }

    this.tools.delete(name);
  }

  /**
   * ツールを取得する
   */
  get(name: string): InternalTool | undefined {
    return this.tools.get(name);
  }

  /**
   * ツールの存在を確認する
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * ツールを無効化する
   */
  disable(name: string): void {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    tool.enabled = false;
  }

  /**
   * ツールを有効化する
   */
  enable(name: string): void {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    tool.enabled = true;
  }

  /**
   * ツールが有効かチェックする
   */
  isEnabled(name: string): boolean {
    const tool = this.tools.get(name);
    return tool?.enabled ?? false;
  }

  /**
   * 有効なツールの一覧を取得する
   */
  list(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];

    for (const tool of this.tools.values()) {
      if (!tool.enabled) {
        continue;
      }

      const inputSchema = zodToJsonSchema(tool.schema);

      definitions.push({
        name: tool.name,
        description: tool.description,
        inputSchema
      });
    }

    return definitions;
  }
}
