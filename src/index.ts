#!/usr/bin/env node

/**
 * CursorCLI-MCP Server Entry Point
 *
 * MCPサーバーのエントリーポイント。
 * stdio transportを使用してCursor IDEと通信します。
 */

console.log('CursorCLI-MCP Server starting...');

// TODO: Implement server initialization
// This will be implemented in Task 4.1

process.on('SIGINT', () => {
  console.log('Server shutting down...');
  process.exit(0);
});
