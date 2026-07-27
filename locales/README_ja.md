<div align="center">

  <img src="../assets/icon.jpg" alt="Markdown Viewer のロゴ" width="100" />

  <h1>Markdown Viewer</h1>

  **ライブプレビューを備えた、ローカルファーストの Markdown エディター／ビューアー**

  ブラウザー、Progressive Web App（PWA）、Docker、Neutralino デスクトップアプリケーションで Markdown を開き、編集、整理、レビュー、描画、エクスポートできます。必要に応じて共有や共同編集も利用できます。

  [![ライセンス](https://img.shields.io/github/license/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=red)](../LICENSE)
  [![最新リリース](https://img.shields.io/github/v/release/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=FF6B00)](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

  [English](../README.md) · **日本語** · [한국어](README_ko.md) · [简体中文](README_zh.md) · [繁體中文](README_tw.md)

  [Web アプリを開く](https://markdownviewer.pages.dev/) · [ドキュメント（英語）](../wiki/Home.md) · [Issue を報告](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) · [リリース](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

</div>

## Markdown Viewer について

Markdown Viewer は、`.md`／`.markdown` 文書向けのオープンソースエディターです。プレーンテキストのエディター、サニタイズ済みプレビュー、複数文書を管理できるワークスペース、レビュー機能、各種レンダラー、インポート／エクスポート、Share Snapshot、Live Share をひとつのアプリケーションにまとめています。

開発者、テクニカルライター、学生、研究者など、アカウントを作成せずに Markdown を扱いたいユーザーを想定しています。通常の編集、プレビュー、ローカルファイルのインポート、文書整理、ほとんどのエクスポートは端末上で行われます。ネットワークを使用する機能は、この文書で明示しています。

## 主な機能

- **ワークスペースと文書：** 最大 50 件の文書をネストしたフォルダーに整理できます。最近使ったファイル、お気に入り、検索、タブ、一括操作、暗号化された Secret Workspace（秘密のワークスペース）に対応します。
- **編集とレビュー：** エディター、分割表示、プレビューを切り替えられます。書式設定ツール、独自の元に戻す／やり直す、検索と置換、LTR／RTL、コメント、提案を利用できます。
- **Markdown 描画：** CommonMark 形式の基本構文、GitHub-Flavored Markdown（GFM）、表、タスクリスト、アラート、脚注、定義リスト、コードのシンタックスハイライト、サニタイズ済み HTML、MathJax に対応します。
- **ビジュアルコンテンツ：** Mermaid、PlantUML、Graphviz／DOT、D2、Vega-Lite、WaveDrom、Markmap、GeoJSON、TopoJSON、STL、ABC 記譜を描画できます。
- **インポートとエクスポート：** ローカルファイルや公開 GitHub コンテンツを開き、Markdown、単体 HTML、PNG、ブラウザー印刷／PDF 保存、従来のラスター PDF として出力できます。
- **任意の共有機能：** 「表示のみ」または「編集可能」の Share Snapshot（スナップショットの共有）を作成したり、ホスト／編集可能／表示のみの権限を持つ一時的な Live Share（ライブシェア）ルームを開始したりできます。
- **複数の提供形態：** ホスト済み Web アプリ、PWA、静的ホスティング、Docker、Cloudflare、Neutralino デスクトップアプリケーションを利用できます。

実装済みの動作と制限は、[機能リファレンス（英語）](../wiki/Features.md)を参照してください。

## クイックスタート

[ホスト済み Web アプリ](https://markdownviewer.pages.dev/)を利用するか、リポジトリをローカル HTTP サーバーで起動します。

```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
python -m http.server 8080
```

`http://localhost:8080` を開きます。`file://` では Web Worker や Service Worker がブラウザーにブロックされる場合があります。

| 利用方法 | 詳細（英語） |
| :--- | :--- |
| PWA／静的 Web ホスティング | [インストール](../wiki/Installation.md) |
| Docker | [Docker デプロイ](../wiki/Docker-Deployment.md) |
| Cloudflare Pages／KV／Durable Objects | [設定](../wiki/Configuration.md) |
| Neutralino デスクトップアプリケーション | [デスクトップアプリケーション](../wiki/Desktop-App.md) |

## ローカル処理とネットワーク処理

Markdown Viewer はローカルファーストですが、すべての機能がオフラインで動作するわけではありません。

| 操作 | 既定のデータ経路 |
| :--- | :--- |
| 編集、ローカルインポート、プレビュー、ワークスペースの自動保存、ほとんどのエクスポート | 端末上 |
| Web ライブラリと未キャッシュのレンダラー依存関係 | Web／PWA 版から CDN へ接続 |
| GitHub インポートと絵文字検索 | GitHub API／raw コンテンツ |
| PlantUML、D2、Graphviz、Vega-Lite、WaveDrom、一部の図表プレビュー | 図表ソースを PlantUML、Kroki、mermaid.ink に送信する場合あり |
| 同意後に挿入する画像、GIF、動画 | 公開リンク型の Cloudflare 一時メディアストレージ（90 日） |
| 大きな Share Snapshot | Cloudflare KV（90 日） |
| Live Share | Cloudflare Durable Object の WebSocket リレー |
| 外部画像、メディア、リンク、地図タイル | 文書で指定された外部ホスト |

Share Snapshot と Live Share の URL はベアラーリンクです。有効なリンクを入手した人は、そのリンクに含まれる権限を利用できます。Live Share はエンドツーエンド暗号化されていません。機密性の高い文書を扱う前に、[プライバシーとセキュリティ（英語）](../wiki/Privacy-and-Security.md)を確認してください。

## メディアの保存

- AVIF、BMP、GIF（アニメーション GIF を含む）、JPEG、PNG、WebP、MP4、WebM、Ogg を挿入できます。
- 初回の同意後、メディアは Cloudflare の一時ストレージにアップロードされ、短いコンテンツアドレス型 HTTPS URL として挿入されます。
- URL を知っている人は誰でも、期限が切れるまでメディアを取得できます。
- 同一コンテンツを最後にアップロードしてから 90 日後に期限切れになります。
- Share Snapshot と Live Share は Markdown 内の URL を共有します。メディアの別コピーは作成しません。

## 主な制限

- ワークスペースは最大 50 文書です。ロック中の Secret Workspace の件数と一時的な Share Snapshot／Live Share タブも含まれます。
- 1 件のローカル Markdown ファイルは 10 MB までです。
- GitHub インポーターが表示する Markdown ファイルは、リポジトリ／フォルダーごとに最大 30 件です。
- メディアの元ファイルは処理前で 25 MiB までです。保存上限は静止画 300 KiB、GIF 5 MiB、動画 10 MiB です。
- 保存型 Share Snapshot は最大 8,000,000 文字で、90 日後に期限切れになります。
- Live Share は最大 64 WebSocket 参加者、1 メッセージ 8 MB までです。
- STL はソース 2 MiB、描画ジオメトリ 300,000 頂点までです。
- ラスター PDF／PNG はブラウザーのメモリ、Canvas、CORS の制約を受けます。

## プライバシー上の重要事項

- 通常のワークスペースデータは、ブラウザープロファイルまたはデスクトップのローカルストレージに保存されます。
- プライベートモードを有効にすると、Secret Workspace の暗号化済みデータを含む永続化済み文書データが消去され、その後の保存が停止します。
- **ワークスペースをリセット**すると、通常文書、レビューデータ、Secret Workspace データが削除されます。Markdown Viewer からは復元できません。
- Live Share は Markdown／レビューデータをサーバー側に永続保存しません。ただし、役割別のベアラー権限値と作成時刻は Durable Object ストレージに保存され、アプリケーション側の有効期限／削除経路はありません。
- Share Snapshot の作成 API は削除トークンを返しますが、現在の UI はそのトークンを表示せず、期限前の削除操作も提供していません。
- アプリケーションコードには、アカウント、分析、テレメトリ、広告、トラッキングピクセル、アプリ固有 Cookie は実装されていません。外部サービスやホスティング事業者は通常のリクエストログを処理する場合があります。

> **警告:** プライベートモードまたは **ワークスペースをリセット**を使用する前に、必要な文書を Markdown としてエクスポートしてください。

## ドキュメント

詳細ページは英語で管理されています。

| 目的 | ページ（英語） |
| :--- | :--- |
| 全機能と制限 | [Features](../wiki/Features.md) |
| 日常の操作とショートカット | [Usage Guide](../wiki/Usage-Guide.md) |
| Markdown／図表の構文 | [Markdown Reference](../wiki/Markdown-Reference.md) |
| Share Snapshot | [Share Snapshot](../wiki/Share-Snapshot.md) |
| Live Share | [Live Share](../wiki/Live-Share-Cloudflare.md) |
| プライバシーとセキュリティ | [Privacy and Security](../wiki/Privacy-and-Security.md) |
| インストールとデプロイ | [Installation](../wiki/Installation.md) |
| トラブルシューティング | [Troubleshooting](../wiki/Troubleshooting.md)／[FAQ](../wiki/FAQ.md) |
| コントリビューション | [Contributing](../wiki/Contributing.md) |
| 多言語用語とローカライズ | [Localization and Terminology](../wiki/Localization.md) |

## コントリビューションとライセンス

Pull Request を作成する前に、[Contributing（英語）](../wiki/Contributing.md)を確認してください。再現可能な不具合や明確な機能提案は [Issue Tracker](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) に報告できます。脆弱性の詳細は通常の Issue に投稿しないでください。

Markdown Viewer は [Apache License 2.0](../LICENSE) で提供されています。
