# Technical Design Document: CursorCLI-MCPServer - Appendix

## Data Models

### Domain Model Summary

本システムの中核ドメインは**MCPツール実行コンテキスト**であり、Tool Definition、Tool Execution Request、Tool Execution Result、Security Context、Server Configurationの5つの主要概念で構成されます。これらはすべて、MCPプロトコルの標準に準拠しながら、Cursor IDE環境との統合を実現します。

### Physical Storage

- **Configuration**: `.cursorcli-mcp/config.json` (JSON)
- **Logs**: `.cursorcli-mcp/logs/` (daily rotation)
- **Statistics**: In-memory only (future: `.cursorcli-mcp/statistics.json`)

## Error Handling Summary

エラーは3つの主要カテゴリに分類されます：

1. **User Errors (4xx)**: ValidationError、SecurityError、NotFoundError
2. **System Errors (5xx)**: InfrastructureError、TimeoutError、ResourceExhaustedError
3. **Business Logic Errors (422)**: BusinessRuleViolationError

すべてのエラーはLogging Systemに記録され、Cursor Output panelに表示されます。

## Testing Strategy Summary

- **Unit Tests**: 90%カバレッジ目標、Jestフレームワーク使用
- **Integration Tests**: E2Eツール実行フロー、80%カバレッジ目標
- **E2E Tests**: Manual testing（初期バージョン）
- **Performance Tests**: Latency、Concurrency、Load tests

## Security Summary

主要な脅威に対する緩和策：

- **Path Traversal**: Security Validatorによる厳格な検証
- **Command Injection**: パラメータサニタイゼーション
- **DoS**: 同時実行数制限、タイムアウト
- **Information Disclosure**: ログのサニタイゼーション
- **Unauthorized Modification**: 確認フラグの必須化

## Performance Targets

- Tool Execution: 平均1秒、最大5秒
- Server Startup: 5秒以内
- Memory Usage: 500MB以下（通常）、1GB以下（ピーク）
- Concurrent Requests: 10並行（デフォルト）

## Implementation Timeline

- **Phase 1-2**: Core Infrastructure + Tools (Week 1-4)
- **Phase 3**: Cursor IDE Integration (Week 5)
- **Phase 4**: Testing & Documentation (Week 6)
- **Phase 5**: Production Deployment (Week 7)

Total: 7週間の実装期間を想定
