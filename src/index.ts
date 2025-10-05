#!/usr/bin/env node

/**
 * CursorCLI-MCP Server Entry Point
 *
 * MCPサーバーのエントリーポイント。
 * stdio transportを使用してCursor IDEと通信します。
 */

import { getLogger } from './logging/index.js';

const logger = getLogger();

logger.info('CursorCLI-MCP Server starting...');

// TODO: Implement server initialization
// This will be implemented in Task 4.1

process.on('SIGINT', async () => {
  logger.info('Server shutting down...');

  try {
    await logger.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error(
      'Error during shutdown',
      error instanceof Error ? error : new Error(String(error))
    );
    process.exit(1);
  }
});
