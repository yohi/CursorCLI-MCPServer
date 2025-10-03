# Requirements Document

## Introduction

CursorCLI-MCPServerは、既存のCursorCLI（Cursor IDE用CLIツール）をMCP（Model Context Protocol）サーバーとして機能拡張するシステムです。本システムにより、AIツールやCursor IDE自身から、CursorCLIの機能（ファイル操作、プロジェクト管理、エディタ制御など）を標準化されたMCPプロトコル経由で呼び出すことが可能になります。

これにより、以下のビジネス価値を提供します：
- AIツール間の相互運用性向上による開発効率化
- 統一プロトコルによる保守性・拡張性の向上
- Cursor IDEエコシステムの機能拡張基盤の確立

## Requirements

### Requirement 1: MCPプロトコル準拠のサーバー実装
**Objective:** MCPクライアントとして、標準化されたプロトコルでCursorCLI機能にアクセスしたい、それにより異なるAIツール間での統一的な操作が可能になる

#### Acceptance Criteria

1. WHEN MCPクライアントがサーバーに接続要求を送信 THEN CursorCLI-MCPサーバー SHALL MCP仕様に準拠したハンドシェイクを実行
2. WHEN MCPクライアントが初期化リクエストを送信 THEN CursorCLI-MCPサーバー SHALL サーバー情報（名前、バージョン、プロトコルバージョン）を返却
3. IF MCPクライアントのプロトコルバージョンが非対応 THEN CursorCLI-MCPサーバー SHALL エラーレスポンス（バージョン不一致）を返却
4. WHEN MCPクライアントが利用可能なツール一覧をリクエスト THEN CursorCLI-MCPサーバー SHALL 全ての公開ツール定義（名前、説明、パラメータスキーマ）を返却
5. WHILE セッションが確立されている THE CursorCLI-MCPサーバー SHALL JSON-RPC 2.0形式のメッセージ送受信を維持

### Requirement 2: ファイル操作機能のMCPツール化
**Objective:** AIエージェントとして、MCPプロトコル経由でファイルシステム操作を実行したい、それによりCursorプロジェクト内のファイルを安全に管理できる

#### Acceptance Criteria

1. WHEN MCPクライアントが`read_file`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL 指定されたファイルの内容を読み取り、JSON形式で返却
2. WHEN MCPクライアントが`write_file`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL 指定されたパスに内容を書き込み、成功/失敗ステータスを返却
3. WHEN MCPクライアントが`list_directory`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL 指定ディレクトリの内容（ファイル名、タイプ、サイズ）をリスト形式で返却
4. IF 指定されたファイルパスがプロジェクトルート外 THEN CursorCLI-MCPサーバー SHALL セキュリティエラーを返却し、アクセスを拒否
5. WHEN ファイル操作が失敗（権限不足、ファイル不存在など） THEN CursorCLI-MCPサーバー SHALL 詳細なエラーコードとメッセージを含むレスポンスを返却
6. WHERE ファイルパスが相対パス THE CursorCLI-MCPサーバー SHALL 現在のプロジェクトルートを基準として解決

### Requirement 3: プロジェクト管理機能のMCPツール化
**Objective:** AIエージェントとして、Cursorプロジェクトの構造と設定を把握したい、それによりコンテキストに応じた適切な操作を実行できる

#### Acceptance Criteria

1. WHEN MCPクライアントが`get_project_info`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL プロジェクト名、ルートパス、設定情報を返却
2. WHEN MCPクライアントが`search_files`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL 指定されたパターンに一致するファイルパスのリストを返却
3. WHEN MCPクライアントが`get_workspace_structure`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL プロジェクトのディレクトリツリー構造をJSON形式で返却
4. IF プロジェクトが開かれていない状態 THEN CursorCLI-MCPサーバー SHALL エラーレスポンス（プロジェクト未初期化）を返却
5. WHERE プロジェクト設定ファイル（.cursor/settings.json）が存在する THE CursorCLI-MCPサーバー SHALL その設定内容を`get_project_info`の結果に含める

### Requirement 4: エディタ制御機能のMCPツール化
**Objective:** AIエージェントとして、Cursor IDEのエディタ操作を自動化したい、それによりコード編集やナビゲーションを効率化できる

#### Acceptance Criteria

1. WHEN MCPクライアントが`open_file_in_editor`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL 指定されたファイルをCursor IDEで開き、成功ステータスを返却
2. WHEN MCPクライアントが`get_active_file`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL 現在アクティブなファイルのパスとカーソル位置を返却
3. WHEN MCPクライアントが`insert_text`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL 指定された位置にテキストを挿入し、変更後の状態を返却
4. WHEN MCPクライアントが`replace_text`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL 指定された範囲のテキストを置換し、変更後の状態を返却
5. IF Cursor IDEが起動していない THEN CursorCLI-MCPサーバー SHALL エラーレスポンス（IDE未起動）を返却
6. WHILE エディタ操作が実行中 THE CursorCLI-MCPサーバー SHALL 操作完了まで次のリクエストを待機

### Requirement 5: エラーハンドリングと安全性保証
**Objective:** システム管理者として、MCPサーバーが安全かつ予測可能に動作することを保証したい、それによりシステムの信頼性を維持できる

#### Acceptance Criteria

1. WHEN 任意のツール呼び出しで例外が発生 THEN CursorCLI-MCPサーバー SHALL エラーをキャッチし、標準化されたエラーレスポンス（エラーコード、メッセージ、スタックトレース）を返却
2. WHEN MCPクライアントが不正なJSON形式のリクエストを送信 THEN CursorCLI-MCPサーバー SHALL パースエラーを返却し、接続を維持
3. IF ツール実行の結果がレスポンスサイズ制限を超過 THEN CursorCLI-MCPサーバー SHALL 結果を切り詰め、切り詰め発生を示すフラグを返却
4. WHEN 同時に複数のツール呼び出しリクエストを受信 THEN CursorCLI-MCPサーバー SHALL 各リクエストを独立して処理し、結果を正しいリクエストIDに関連付けて返却
5. WHERE ファイルシステム操作が破壊的（削除、上書き） THE CursorCLI-MCPサーバー SHALL 操作前に確認フラグをチェックし、未設定の場合は操作を中止
6. WHILE サーバーが起動中 THE CursorCLI-MCPサーバー SHALL 全てのエラーとワーニングをログファイルに記録

### Requirement 6: 設定とカスタマイズ機能
**Objective:** システム管理者として、MCPサーバーの動作を環境に応じて設定したい、それによりセキュリティポリシーやパフォーマンス要件に適合できる

#### Acceptance Criteria

1. WHEN CursorCLI-MCPサーバーが起動 THEN サーバー SHALL 設定ファイル（.cursorcli-mcp/config.json）を読み込み、設定を適用
2. IF 設定ファイルが存在しない THEN CursorCLI-MCPサーバー SHALL デフォルト設定を使用し、設定ファイルテンプレートを生成
3. WHERE 設定で許可されたツールリストが定義されている THE CursorCLI-MCPサーバー SHALL そのリスト内のツールのみを公開
4. WHEN 設定で最大レスポンスサイズが指定されている THEN CursorCLI-MCPサーバー SHALL その制限を全てのツールレスポンスに適用
5. IF 設定でアクセス可能なディレクトリが制限されている THEN CursorCLI-MCPサーバー SHALL 指定されたディレクトリ外へのアクセスを拒否
6. WHILE サーバーが実行中 THE CursorCLI-MCPサーバー SHALL 設定ファイルの変更を監視し、変更時に設定を再読み込み

### Requirement 7: ロギングとデバッグ機能
**Objective:** 開発者として、MCPサーバーの動作を監視・デバッグしたい、それにより問題の迅速な特定と解決ができる

#### Acceptance Criteria

1. WHEN CursorCLI-MCPサーバーがリクエストを受信 THEN サーバー SHALL リクエストの詳細（タイムスタンプ、ツール名、パラメータ）をログに記録
2. WHEN ツール実行が完了 THEN CursorCLI-MCPサーバー SHALL 実行時間とレスポンスステータスをログに記録
3. IF ログレベルが"debug"に設定されている THEN CursorCLI-MCPサーバー SHALL 全てのJSON-RPCメッセージの生データをログに記録
4. WHERE ログファイルがサイズ制限に達した THE CursorCLI-MCPサーバー SHALL ログファイルをローテーションし、古いログをアーカイブ
5. WHEN MCPクライアントが`get_server_stats`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL サーバー統計（稼働時間、リクエスト数、エラー率）を返却
6. WHILE サーバーがシャットダウン処理中 THE CursorCLI-MCPサーバー SHALL 全ての保留中のログを書き込み完了してから終了

### Requirement 8: パフォーマンスとスケーラビリティ
**Objective:** システム管理者として、MCPサーバーが効率的に動作することを保証したい、それにより複数のAIエージェントが同時に利用できる

#### Acceptance Criteria

1. WHEN ツール実行時間が5秒を超過 THEN CursorCLI-MCPサーバー SHALL タイムアウトエラーを返却し、操作を中止
2. WHEN 同時接続数が設定された最大値に達した THEN CursorCLI-MCPサーバー SHALL 新規接続を拒否し、エラーレスポンスを返却
3. IF ファイル読み込みサイズが10MBを超過 THEN CursorCLI-MCPサーバー SHALL 分割読み込みまたはストリーミング方式を使用
4. WHERE 大量のファイル検索が実行される THE CursorCLI-MCPサーバー SHALL 検索結果をページネーション形式で返却
5. WHILE 複数のリクエストが処理中 THE CursorCLI-MCPサーバー SHALL CPU使用率を80%以下に維持
6. WHEN サーバー起動時 THEN CursorCLI-MCPサーバー SHALL 5秒以内にMCPクライアントからの接続を受け付け可能な状態になる

### Requirement 9: Cursor IDE統合機能
**Objective:** Cursor IDEユーザーとして、MCPサーバーをCursor環境内でシームレスに利用したい、それによりAI機能を通じて開発ワークフローを効率化できる

#### Acceptance Criteria

1. WHEN ユーザーがCursor Settings（`Ctrl+Shift+J`）からMCPサーバー設定画面を開く THEN CursorCLI-MCPサーバー SHALL 設定UI上で有効/無効の切り替えが可能
2. WHEN CursorCLI-MCPサーバーがCursor IDEに登録される THEN サーバー SHALL `stdio`トランスポート方式で通信を確立
3. WHEN サーバー起動時または実行時にログが生成される THEN CursorCLI-MCPサーバー SHALL Output panel（`Ctrl+Shift+U`）の"MCP"チャンネルにログを出力
4. IF サーバー起動に失敗（環境変数未設定、実行ファイル不存在など） THEN CursorCLI-MCPサーバー SHALL 詳細なエラーメッセージをOutput panelに表示
5. WHEN ユーザーがCursor Composer内でMCPツールを使用 THEN CursorCLI-MCPサーバー SHALL ツール呼び出しと結果をOutput panelにリアルタイムで記録
6. WHERE 環境変数によるシークレット管理が必要 THE CursorCLI-MCPサーバー SHALL Cursor設定の`env`フィールドから環境変数を読み込み
7. WHEN ユーザーがSettings UIからサーバーを無効化 THEN CursorCLI-MCPサーバー SHALL 既存のセッションを安全にシャットダウンし、リソースを解放
8. IF 複数のCursorウィンドウが開かれている THEN CursorCLI-MCPサーバー SHALL 各ウィンドウで独立したサーバーインスタンスを起動

### Requirement 10: モデル選択とコンテキスト管理
**Objective:** AI開発者として、MCPツールを使用する際に適切なAIモデルを選択したい、それによりタスクに応じた最適なパフォーマンスとコストバランスを実現できる

#### Acceptance Criteria

1. WHEN ユーザーがCursor Composerでモデルを選択 THEN CursorCLI-MCPサーバー SHALL 選択されたモデル情報（モデル名、プロバイダー）をコンテキストとして取得可能
2. WHEN MCPクライアントが`get_current_model`ツールを呼び出し THEN CursorCLI-MCPサーバー SHALL 現在選択されているAIモデルの情報を返却
3. IF ユーザーがモデルを切り替え THEN CursorCLI-MCPサーバー SHALL 新しいモデル情報を反映し、`model_changed`イベントをログに記録
4. WHERE 高コストモデル（GPT-4等）が選択されている THE CursorCLI-MCPサーバー SHALL 長時間実行ツール使用時に警告ログを出力
5. WHEN ユーザーがカスタムモデル設定を保存 THEN CursorCLI-MCPサーバー SHALL その設定を`.cursorcli-mcp/model-preferences.json`に永続化
6. WHILE Composerセッションが継続中 THE CursorCLI-MCPサーバー SHALL 使用モデル情報とトークン消費量を追跡し、統計情報として提供
7. IF モデル情報の取得に失敗 THEN CursorCLI-MCPサーバー SHALL デフォルトモデル（設定で指定）を返却し、警告をログに記録
