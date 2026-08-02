# Localization and Internationalization

Markdown Viewer translates its interface in the browser. Core labels live in `I18N_DICTS` in `script.js`, while broader static and dynamic interface strings are loaded from `assets/i18n/<language>.json`. User-authored Markdown and filenames are never translated.

The English interface and English documentation are the source text. The approved multilingual terminology tables on this page align documentation with the current interface labels.

## Supported Locales

| Code | Language |
| :--- | :--- |
| `en` | English |
| `zh` | Simplified Chinese |
| `ja` | Japanese |
| `ko` | Korean |
| `pt` | Portuguese (Brazil) |
| `es` | Spanish |
| `fr` | French |
| `de` | German |
| `ru` | Russian |
| `it` | Italian |
| `tr` | Turkish |
| `pl` | Polish |
| `tw` | Traditional Chinese |
| `uk` | Ukrainian |

## Maintained Documentation Entry Points

| Language | File |
| :--- | :--- |
| English | [`README.md`](../README.md) |
| Japanese | [`locales/README_ja.md`](../locales/README_ja.md) |
| Korean | [`locales/README_ko.md`](../locales/README_ko.md) |
| Simplified Chinese | [`locales/README_zh.md`](../locales/README_zh.md) |
| Traditional Chinese | [`locales/README_tw.md`](../locales/README_tw.md) |

Detailed Wiki pages are maintained in English. Localized READMEs label those destinations as English instead of pointing to nonexistent localized pages.

## Selection Order

The app chooses a language in this order:

1. URL query parameter, such as `?lang=pt`.
2. Hash query parameter when present in a shared URL.
3. Saved `localStorage` key `app-lang`.
4. Browser language from `navigator.language`.
5. English fallback.

When a user picks a language from the dropdown, the app saves `app-lang` and updates the URL query parameter.

## What Gets Translated

The catalogs cover:

- Header, toolbar, Explorer, tab, context-menu, and bulk-action labels.
- Import, media upload, GitHub import, export, Share Snapshot, and Live Share flows.
- View, review, theme, direction, statistics, workspace, and Secret Workspace controls.
- Modal titles, instructions, buttons, placeholders, progress messages, validation errors, tooltips, and accessibility labels.

Renderer output, browser messages, third-party text, generated filenames, external services, and some low-level errors can remain English.

## Dictionary Shape

`assets/i18n/en.json` is the source list. Every translated catalog uses the same English keys:

```json
{
  "New file": "新文件",
  "Reset workspace": "重置工作区",
  "Live Share": "实时共享"
}
```

The runtime also supports numbered templates such as `{{0}} files`. If a catalog entry is missing, the English source remains visible.

## Contributor Checklist

- Add or update visible English source text first.
- Regenerate catalogs from the repository root with `node assets/i18n/generate-ui-locales.mjs`.
- Run `node assets/i18n/audit-ui-locales.mjs` and resolve every reported catalog, key, placeholder, terminology, or encoding problem.
- Review every new translation in context; use curated overrides where literal machine translation is unclear.
- Keep all locale catalogs on the same key set as `en.json`.
- Run the desktop prepare step so bundled catalogs match the web app.
- Check desktop and mobile menus, context menus, modal buttons, validation messages, Share Snapshot, Live Share, and `?lang=` URLs.
- Update the terminology tables on this page when a named concept or interface label changes.
- For documentation, finalize `README.md` before synchronizing the four localized READMEs.
- Preserve code, commands, paths, URLs, routes, configuration keys, library names, Markdown syntax, and Git branch names.
- Verify localized language navigation, relative paths, anchors, tables, code fences, heading length, and native grammar.
- Record a section for native-speaker review when technical meaning cannot be translated confidently.

## Terminology Glossary

Use these terms in Markdown Viewer documentation and translation reviews. The Japanese, Korean, Simplified Chinese, and Traditional Chinese values follow the current interface label when that exact source key exists; otherwise they use standard software terminology for the concept.

**Markdown Viewer** is a product name and must not be translated. Code, commands, file paths, URLs, API routes, configuration keys, library names, Markdown syntax, and Git branch names also remain unchanged.

### Core Terms

| English | Japanese | Korean | Simplified Chinese | Traditional Chinese |
| :--- | :--- | :--- | :--- | :--- |
| Workspace | ワークスペース | 작업공간 | 工作区 | 工作區 |
| Secret Workspace | 秘密のワークスペース | 비밀 작업 공간 | 秘密工作区 | 秘密工作區 |
| Folder | フォルダー | 폴더 | 文件夹 | 資料夾 |
| Document | 文書 | 문서 | 文档 | 文件 |
| Active Document | アクティブな文書 | 활성 문서 | 当前文档 | 目前文件 |
| Editor | エディター | 편집기 | 编辑器 | 編輯器 |
| Preview | プレビュー | 미리보기 | 预览 | 預覽 |
| Split view | 分割表示 | 분할 보기 | 分屏视图 | 分割檢視 |
| Review | レビュー | 리뷰 | 审阅 | 審閱 |
| Comment | コメント | 댓글 | 评论 | 留言 |
| Suggestion | 提案 | 제안 | 建议 | 建議 |
| Recent | 最近使ったファイル | 최근 파일 | 最近使用 | 最近使用 |
| Favorites | お気に入り | 즐겨찾기 | 收藏夹 | 我的最愛 |
| Local storage | ローカルストレージ | 로컬 저장소 | 本地存储 | 本機儲存空間 |
| Temporary tab | 一時タブ | 임시 탭 | 临时标签页 | 暫存分頁 |

### Sharing, Privacy, and Access

| English | Japanese | Korean | Simplified Chinese | Traditional Chinese |
| :--- | :--- | :--- | :--- | :--- |
| Share Snapshot | スナップショットの共有 | 스냅샷 공유 | 分享快照 | 分享快照 |
| Live Share | ライブシェア | 라이브 공유 | 实时共享 | 即時共享 |
| View only | 表示のみ | 보기 전용 | 仅供查看 | 僅供查看 |
| Can edit | 編集可能 | 편집 가능 | 可以编辑 | 可以編輯 |
| Host | ホスト | 호스트 | 主持人 | 主持人 |
| Editor role | 編集者ロール | 편집자 역할 | 编辑者角色 | 編輯者角色 |
| Viewer role | 閲覧者ロール | 뷰어 역할 | 查看者角色 | 檢視者角色 |
| Temporary room | 一時ルーム | 임시 방 | 临时房间 | 暫時房間 |
| Bearer link | ベアラーリンク | 베어러 링크 | 持有者链接 | 持有者連結 |
| Private mode | プライベートモード | 프라이빗 모드 | 隐私模式 | 隱私模式 |
| Clear local data | ローカルデータを消去 | 로컬 데이터 지우기 | 清除本地数据 | 清除本機資料 |
| Reset workspace | 作業領域をリセット | 작업 공간 재설정 | 重置工作区 | 重設工作區 |
| Managed media | 管理対象メディア | 관리형 미디어 | 托管媒体 | 受管理媒體 |
| Deletion token | 削除トークン | 삭제 토큰 | 删除令牌 | 刪除權杖 |
| Expiration | 有効期限 | 만료 | 过期 | 到期 |
| End-to-end encryption | エンドツーエンド暗号化 | 종단 간 암호화 | 端到端加密 | 端對端加密 |

### Content, Import, and Export

| English | Japanese | Korean | Simplified Chinese | Traditional Chinese |
| :--- | :--- | :--- | :--- | :--- |
| Storage and Backup | ストレージとバックアップ | 저장 및 백업 | 存储与备份 | 儲存與備份 |
| Backup | バックアップ | 백업 | 备份 | 備份 |
| Import Backup | インポートバックアップ | 백업 가져오기 | 导入备份 | 導入備份 |
| Import | インポート | 가져오기 | 导入 | 導入 |
| GitHub import | GitHub インポート | GitHub 가져오기 | GitHub 导入 | GitHub 導入 |
| Repository | リポジトリ | 저장소 | 仓库 | 儲存庫 |
| Private repository | 非公開リポジトリ | 비공개 저장소 | 私有仓库 | 私人儲存庫 |
| Branch | ブランチ | 브랜치 | 分支 | 分支 |
| Tag | タグ | 태그 | 标签 | 標籤 |
| Commit SHA | コミット SHA | 커밋 SHA | 提交 SHA | 提交 SHA |
| Personal access token (PAT) | 個人アクセストークン（PAT） | 개인용 액세스 토큰(PAT) | 个人访问令牌（PAT） | 個人存取權杖（PAT） |
| Credential vault | 認証情報保管領域 | 자격 증명 보관소 | 凭据保管库 | 認證保管庫 |
| Export | エクスポート | 내보내기 | 导出 | 匯出 |
| Markdown export | Markdown エクスポート | Markdown 내보내기 | Markdown 导出 | Markdown 匯出 |
| HTML export | HTML エクスポート | HTML 내보내기 | HTML 导出 | HTML 匯出 |
| Browser Print | ブラウザー印刷 | 브라우저 인쇄 | 浏览器打印 | 瀏覽器列印 |
| Legacy Raster PDF | 従来のラスター PDF | 레거시 래스터 PDF | 旧版栅格 PDF | 舊版點陣 PDF |
| PNG export | PNG エクスポート | PNG 내보내기 | PNG 导出 | PNG 匯出 |
| Diagram | 図表 | 다이어그램 | 图表 | 圖表 |
| Diagram renderer | 図表レンダラー | 다이어그램 렌더러 | 图表渲染器 | 圖表轉譯器 |
| Remote renderer | リモートレンダラー | 원격 렌더러 | 远程渲染器 | 遠端轉譯器 |
| Sanitized HTML | サニタイズ済み HTML | 정제된 HTML | 已清理的 HTML | 已清理的 HTML |
| Code highlighting | コードのシンタックスハイライト | 코드 구문 강조 | 代码语法高亮 | 程式碼語法醒目提示 |
| Math | 数式 | 수식 | 数学公式 | 數學公式 |
| Progressive Web App (PWA) | プログレッシブウェブアプリ（PWA） | 프로그레시브 웹 앱(PWA) | 渐进式 Web 应用（PWA） | 漸進式 Web 應用程式（PWA） |
| Desktop application | デスクトップアプリケーション | 데스크톱 애플리케이션 | 桌面应用 | 桌面應用程式 |

### Usage Rules

- In English, keep the feature names **Share Snapshot**, **Live Share**, **View only**, **Can edit**, **Private mode**, and **Secret Workspace** exactly as written.
- In localized READMEs, use the localized UI label in explanatory prose. Keep the English feature name at first mention when it helps readers match English screenshots or Wiki pages.
- Do not alternate between “snapshot sharing,” “share link,” and **Share Snapshot** for the named feature.
- Use “live room” only for the technical room; use **Live Share** for the feature.
- Use “Document” for user content and “file” for an imported, exported, or filesystem object.
- Use “Workspace” for the product's document container and “repository” for GitHub source.
- Use “Preview” for the rendered pane and “renderer” for the library or service that creates visual output.
- Use “local-first” to describe the default data path. Do not use it to imply that every feature is offline or network-free.
- Use “temporary” only with the exact lifetime or persistence boundary nearby.

### UI Alignment Notes

- `assets/i18n/<language>.json` is the current UI catalog source. Some concepts in these tables do not have a standalone source key and therefore cannot be compared one-to-one.
- The Traditional Chinese catalog currently uses `導入` for **Import**. Documentation uses that value when naming the UI action, even though `匯入` is also common in Traditional Chinese software.
- If a UI label changes, update the English catalog first, regenerate locale catalogs, review the change in context, then update these tables and affected localized documentation.

## Privacy

Localization is local. The app does not send document text or UI text to machine translation APIs.

Related pages: [Contributing](Contributing.md) and [Documentation Home](Home.md).
