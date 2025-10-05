/**
 * Cursor IDE Integration Module Exports
 */

export { CursorIntegrationManager } from './manager.js';
export type { CursorIntegrationOptions, CursorConfigChangeCallback } from './manager.js';
export {
  McpServerConfigSchema,
  McpServersSchema,
  CursorSettingsSchema,
  DEFAULT_CURSOR_SETTINGS,
} from './schema.js';
export type { McpServerConfig, CursorSettings } from './schema.js';
