# CursorCLI-MCP Server

CursorCLI as a Model Context Protocol (MCP) server.

## Overview

CursorCLI-MCPServerは、既存のCursorCLI（Cursor IDE用CLIツール）をModel Context Protocol（MCP）サーバーとして機能拡張するシステムです。本システムにより、AIツールやCursor IDE自身が、CursorCLIの機能（ファイル操作、プロジェクト管理、エディタ制御など）を標準化されたMCPプロトコル経由で呼び出すことが可能になります。

## Requirements

- Node.js >= 18.0.0
- TypeScript 5.x

## Installation

```bash
npm install
```

## Development

```bash
# Build the project
npm run build

# Run in development mode with watch
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## Project Structure

```
cursorcli-mcp-server/
├── src/
│   ├── protocol/     # MCP protocol implementation
│   ├── tools/        # MCP tools (file ops, project mgmt, etc.)
│   ├── config/       # Configuration management
│   ├── security/     # Security validation
│   ├── logging/      # Logging system
│   └── index.ts      # Entry point
├── tests/
│   ├── unit/         # Unit tests
│   └── integration/  # Integration tests
├── dist/             # Build output
└── .cursorcli-mcp/   # Runtime configuration and logs
```

## License

MIT
