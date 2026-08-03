import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { chromium } from '@playwright/test';

const ROOT = new URL('../../', import.meta.url);
const ROOT_PATH = fileURLToPath(ROOT);
const OUTPUT_DIR = new URL('./', import.meta.url);
const PORT = 4197;
const HOST = '127.0.0.1';
const FORCE = process.argv.includes('--force');
const REPAIR_TERMS = process.argv.includes('--repair-terms');
const REPAIR_CORRUPT = process.argv.includes('--repair-corrupt');

const LOCALES = {
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
  pt: 'pt',
  es: 'es',
  fr: 'fr',
  de: 'de',
  ru: 'ru',
  it: 'it',
  tr: 'tr',
  pl: 'pl',
  tw: 'zh-TW',
  uk: 'uk'
};

const PROTECTED_TERMS = [
  { pattern: /Markdown Viewer/g, token: '__MVTERM_MARKDOWN_VIEWER__', value: 'Markdown Viewer' },
  { pattern: /Markdown/g, token: '__MVTERM_MARKDOWN__', value: 'Markdown' }
];

const CURATED_OVERRIDES = {
  de: {
    'Report': 'Melden', 'Light mode': 'Heller Modus', 'Use light mode': 'Hellen Modus verwenden',
    'Use dark mode': 'Dunklen Modus verwenden', 'Protect Secret Workspace': 'Geheimen Arbeitsbereich schützen',
    'Backup': 'Sicherung',
    'Paste a GitHub file or repository URL.': 'Fügen Sie eine GitHub-Datei- oder Repository-URL ein.',
    'PDF export failed:': 'PDF-Export fehlgeschlagen:',
    'PDF generation progress': 'Fortschritt der PDF-Erstellung',
    'Please enter a GitHub URL.': 'Bitte geben Sie eine GitHub-URL ein.',
    'Please enter a valid GitHub URL.': 'Bitte geben Sie eine gültige GitHub-URL ein.',
    'PNG export failed:': 'PNG-Export fehlgeschlagen:',
    'Polyphony Voices': 'Polyphonie-Stimmen',
    'Preparing document': 'Dokument wird vorbereitet',
    'Preparing download': 'Download wird vorbereitet',
    'Preparing import…': 'Import wird vorbereitet…',
    'Preparing repository folder…': 'Repository-Ordner wird vorbereitet…',
    'Previous match (Shift+Enter)': 'Vorheriger Treffer (Shift+Enter)'
  },
  es: {
    'Report': 'Informar', 'Light mode': 'Modo claro', 'Use light mode': 'Usar modo claro'
  },
  fr: {
    'Workspace menu': 'Menu de l’espace de travail', 'Document tools': 'Outils de document',
    'Report': 'Signaler', 'Light mode': 'Mode clair', 'Use light mode': 'Utiliser le mode clair'
  },
  it: {
    'Report': 'Segnala', 'Light mode': 'Modalità chiara', 'Use light mode': 'Usa la modalità chiara',
    'Close menu': 'Chiudi il menu'
  },
  ja: {
    'Settings': '設定', 'About': '情報', 'Appearance': '外観',
    'Browser Print (Recommended)': 'ブラウザー印刷（推奨）',
    'Closed: Not closed': '終了: 未終了',
    'Enter a folder name.': 'フォルダー名を入力してください。',
    'Enter a name.': '名前を入力してください。',
    'folder': 'フォルダー', 'items available.': '件利用できます。',
    'Preserve Case': '大文字と小文字を保持', 'review item': 'レビュー項目',
    'Review item reopened.': 'レビュー項目を再開しました。',
    'Terminal block': 'ターミナルブロック',
    'This review item is no longer available.': 'このレビュー項目は利用できません。',
    'Zoom model': 'モデルを拡大表示'
  },
  ko: {
    'Explorer': '탐색기',
    'Protect Secret Workspace': '비밀 작업 공간 보호',
    'Unlock Secret Workspace': '비밀 작업 공간 잠금 해제',
    'Create a local access key to encrypt files and folder names stored in this workspace. The key cannot be recovered.': '이 작업 공간에 저장된 파일 및 폴더 이름을 암호화할 로컬 액세스 키를 만드세요. 이 키는 복구할 수 없습니다.',
    'Enter the local access key used to encrypt this workspace on this device.': '이 기기에서 이 작업 공간을 암호화하는 데 사용한 로컬 액세스 키를 입력하세요.',
    'Create access key': '액세스 키 만들기',
    'Lock workspace': '작업 공간 잠그기',
    'Title case': '제목 형식',
    'UPPERCASE': '대문자',
    'lowercase': '소문자',
    'Left-to-right text': '왼쪽에서 오른쪽으로 쓰기',
    'Right-to-left text': '오른쪽에서 왼쪽으로 쓰기',
    'This will remove {{0}} and end any active Live Share session. Unsaved changes cannot be recovered.': '{{0}}를 삭제하고 활성 Live Share 세션을 종료합니다. 저장하지 않은 변경 사항은 복구할 수 없습니다.',
    'Type, paste, or import Markdown here...': '여기에 Markdown을 입력하거나 붙여넣거나 가져오세요...',
    '{{0}} file': '파일 {{0}}개', '{{0}} files': '파일 {{0}}개',
    '{{0}} review item': '리뷰 항목 {{0}}개', '{{0}} review items': '리뷰 항목 {{0}}개',
    '{{0}} and {{1}}': '{{0}} 및 {{1}}', 'Estimated remaining': '예상 남은 시간', '{{0}}s': '{{0}}초',
    '{{0}}m': '{{0}}분', '{{0}}m {{1}}s': '{{0}}분 {{1}}초'
  },
  pl: {
    'New': 'Nowy', 'Report': 'Zgłoś', 'Theme': 'Motyw', 'Light mode': 'Tryb jasny'
  },
  pt: {
    'Report': 'Relatar', 'Light mode': 'Modo claro', 'Share Snapshot': 'Compartilhar captura'
  },
  ru: {
    'New': 'Новый', 'Report': 'Сообщить', 'About': 'О программе',
    'Review mode': 'Режим рецензирования', 'Live Share': 'Совместный доступ'
  },
  tr: {
    'Sync scrolling': 'Kaydırmayı eşitle', 'Report': 'Bildir', 'Light mode': 'Açık mod',
    'Dark mode': 'Koyu mod', 'Use light mode': 'Açık modu kullan', 'Use dark mode': 'Koyu modu kullan',
    'Markdown files in this GitHub location': 'Bu GitHub konumundaki Markdown dosyaları'
  },
  tw: {
    'View': '檢視', 'Split': '分割', 'Actions': '操作', 'New': '新增', 'New document': '新增文件',
    'From files': '從檔案', 'From GitHub': '從 GitHub', 'Export': '匯出', 'Live Share': '即時共享',
    'Report': '回報問題', 'Theme': '外觀', 'Light mode': '淺色模式', 'Use light mode': '使用淺色模式',
    'Private mode': '隱私模式', 'Reset workspace': '重設工作區', 'Explorer': '檔案總管',
    'Choose an alert style to insert into the document.': '選擇要插入文件的提示樣式。',
    'Recent files': '最近使用的檔案', 'Favorites': '我的最愛',
    'No documents to show.': '沒有可顯示的文件。', 'No favorite documents yet.': '尚無最愛文件。',
    'Generating PDF': '正在產生 PDF', 'Generating Image': '正在產生圖片',
    'Current Step': '目前步驟', 'Estimated remaining': '預估剩餘時間',
    'Optimizing page breaks': '正在最佳化分頁', 'Select All': '全選', 'Clear All': '取消全選',
    'Select Markdown file(s) to import': '選擇要匯入的 Markdown 檔案',
    'Title case': '字首大寫',
    '{{0}} file': '{{0}} 個檔案', '{{0}} files': '{{0}} 個檔案',
    '{{0}} review item': '{{0}} 個審閱項目', '{{0}} review items': '{{0}} 個審閱項目',
    '{{0}} and {{1}}': '{{0}}和{{1}}',
    '{{0}}s': '{{0}} 秒', '{{0}}m': '{{0}} 分鐘', '{{0}}m {{1}}s': '{{0}} 分 {{1}} 秒'
  },
  uk: {
    'View': 'Вигляд', 'Split': 'Розділити', 'Review mode': 'Режим рецензування', 'New': 'Новий',
    'Export': 'Експортувати', 'Live Share': 'Спільний доступ наживо', 'Report': 'Повідомити',
    'About': 'Про програму', 'Theme': 'Оформлення', 'Use light mode': 'Увімкнути світлу тему',
    'Use dark mode': 'Увімкнути темну тему', 'Min Read': 'Хв читання',
    'Wrap Around (Wrap)': 'Циклічний пошук (Перенесення)'
  },
  zh: {
    'View': '视图', 'Split': '分屏', 'Actions': '操作', 'New': '新建', 'New document': '新建文档',
    'From files': '从文件', 'From GitHub': '从 GitHub', 'Live Share': '实时共享', 'Report': '报告问题',
    'Theme': '外观', 'Light mode': '浅色模式', 'Use light mode': '使用浅色模式',
    'Private mode': '隐私模式', 'Explorer': '文件资源管理器',
    'Choose an alert style to insert into the document.': '选择要插入文档的提示样式。',
    'Recent files': '最近文件', 'Favorites': '收藏',
    'No documents to show.': '没有可显示的文档。', 'No favorite documents yet.': '还没有收藏的文档。',
    'Generating PDF': '正在生成 PDF', 'Generating Image': '正在生成图片',
    'Current Step': '当前步骤', 'Estimated remaining': '预计剩余时间',
    'Optimizing page breaks': '正在优化分页', 'Select All': '全选', 'Clear All': '取消全选',
    'Select Markdown file(s) to import': '选择要导入的 Markdown 文件',
    'Title case': '首字母大写',
    '{{0}} file': '{{0}} 个文件', '{{0}} files': '{{0}} 个文件',
    '{{0}} review item': '{{0}} 个审阅项', '{{0}} review items': '{{0}} 个审阅项',
    '{{0}} and {{1}}': '{{0}}和{{1}}',
    '{{0}}s': '{{0}} 秒', '{{0}}m': '{{0}} 分钟', '{{0}}m {{1}}s': '{{0}} 分 {{1}} 秒'
  }
};

const EXTRA_STRINGS = [
  'All changes saved', 'Saving...', 'Saved', 'Copied!', 'Copy failed',
  'Import complete', 'Import completed with errors', 'Import failed', 'Preparing import…',
  'No data is stored', 'Data is stored locally', 'Use light mode', 'Use dark mode',
  'Turn private mode off', 'Turn private mode on', 'Enable synchronized scrolling',
  'Disable synchronized scrolling', 'Open Explorer', 'Close Explorer', 'Expand all folders',
  'Collapse all folders', 'Show sidebar', 'Hide sidebar', 'Open menu', 'Close menu',
  'No recent documents', 'No matching files', 'No files selected', 'No document is open',
  'File created', 'Folder created', 'File renamed', 'Folder renamed', 'File deleted',
  'Folder deleted', 'Files deleted', 'Items deleted', 'Download started', 'Link copied',
  'Session active', 'Session ended', 'Connection lost', 'Reconnect', 'Try again',
  'Loading...', 'Loading emojis...', 'Fetching file tree...', 'Searching...',
  'Open comments and suggestions', 'Close comments and suggestions',
  'Mermaid diagram', 'Mermaid diagram actions',
  'Add feedback', 'Edit feedback', 'Delete feedback', 'Resolve feedback',
  'Workspace menu', 'Document tools', 'Sync scrolling', 'Copy Markdown', 'Review mode',
  'Light mode', 'Dark mode', 'Private mode', 'Reset workspace', 'Storage and Backup', 'Share Snapshot',
  'Back up or restore your workspace', 'Permanently delete all workspace data',
  'Backup', 'Import Backup', 'Create workspace backup', 'Close backup options',
  'Close import confirmation',
  'Choose what to include before downloading the ZIP file.', 'Download Backup',
  'Include secure workspace files', 'Confirm Reset',
  'Importing this backup permanently replaces the current workspace, including its files, folders, settings, and Secret Workspace data.',
  'Unable to read the workspace backup.',
  'Secure workspace files will remain encrypted in the backup. They can only be accessed after importing the backup into Markdown Viewer and unlocking them with the correct password.',
  "Clearing this site's browser data will delete local documents.",
  'Live Share', 'Report an issue', 'About Markdown Viewer', 'Workspace settings',
  'file', 'files', 'folder', 'folders', 'item', 'items', 'selected', 'of', 'match',
  'matches', 'open review item', 'open review items', 'No results', 'No documents open',
  'Delete {{0}} selected items?', 'Delete “{{0}}”?', '{{0}} of {{1}} files',
  '{{0}} file selected', '{{0}} files selected', '{{0}} words', '{{0}} characters',
  'Show {{0}} more',
  '{{0}} Min Read', 'Welcome, {{0}}', 'Importing {{0}}', '{{0}} imported',
  'Failed to import {{0}}', 'Move {{0}} selected items', 'Rename {{0}}',
  'Close {{0}}', 'Download {{0}}', 'Duplicate {{0}}',
  'Protect Secret Workspace', 'Unlock Secret Workspace',
  'Create a local access key to encrypt files and folder names stored in this workspace. The key cannot be recovered.',
  'Enter the local access key used to encrypt this workspace on this device.',
  'Create access key', 'Lock workspace', 'Unlock workspace', 'Set password',
  'Title case', 'UPPERCASE', 'lowercase', 'Left-to-right text', 'Right-to-left text',
  'This will remove {{0}} and end any active Live Share session. Unsaved changes cannot be recovered.',
  'Type, paste, or import Markdown here...',
  'Choose an alert style to insert into the document.',
  'Recent files', 'Favorites', 'No documents to show.', 'No favorite documents yet.',
  'Generating PDF', 'Generating Image', 'Generating PDF...', 'Generating Image...',
  'Cancel PDF generation', 'Cancel Image generation', 'PDF generation progress', 'Image generation progress',
  'Current Step', 'Estimated remaining', 'Preparing', 'Calculating...', 'Complete',
  'Loading PDF libraries', 'Preparing document', 'Rendering diagrams', 'Rendering music notation',
  'Rendering math', 'Loading document assets', 'Optimizing page breaks', 'Rendering pages',
  'Rendering page {{0}} of {{1}}', 'Preparing download',
  '{{0}}s', '{{0}}m', '{{0}}m {{1}}s', '{{0}} selected',
  '{{0}} file', '{{0}} files', '{{0}} review item', '{{0}} review items', '{{0}} and {{1}}',
  'Select All', 'Clear All', 'Select all', 'Select Markdown file(s) to import',
  'A folder with this name already exists in the workspace.',
  'Changes not saved', 'Copy command was unsuccessful',
  'Click Start session to create a temporary room and generate an invite link.',
  'Collaborators can view updates but cannot edit.',
  'Copy this link and send it to collaborators. New participants appear above when they join.',
  'Could not protect this workspace. Try again.',
  'Incorrect access key or unreadable Secret Workspace data.',
  'Secret Workspace has not been set up yet.',
  'Delete folder', 'Delete selected items', 'Enter a folder name.', 'Enter a name.',
  'No documents match your search.', 'Open or create a document to use editing tools.',
  'Add another review item', 'Add feedback', 'Add suggestion', 'Edit comment', 'Edit suggestion',
  'All feedback resolved', 'Everything has been resolved. Switch to Resolved or All to review earlier feedback.',
  'Review item deleted.', 'Review item reopened.', 'Review item resolved.', 'Review item updated.',
  'Review mode keeps the Markdown source read only.',
  'Release notes are read only.',
  'Creating link', 'Creating snapshot link...', 'Room active - waiting for collaborators',
  'Ending live room...', 'Live room disconnected', 'Live room ended by the host',
  'This Live Share session is view only.', 'This document is read only.',
  'This shared document is read-only for you.',
  'This share link has expired or does not exist.',
  'This Live Share room has ended, expired, or no active host is available.',
  'No access token added', 'Enter a token name.', 'Keep the token name to 60 characters or fewer.',
  'Use a unique token name.', 'Enter a valid personal access token without spaces.',
  'Up to 50 GitHub access tokens can be saved.', 'GitHub access', 'GitHub access added',
  'GitHub access removed', 'GitHub access repaired', 'GitHub access unavailable',
  '"{{0}}" was added. You can select or remove it anytime.', '"{{0}}" was removed.',
  '"{{0}}" is no longer available. Add the token again.', '"{{0}}" is unavailable. Add the token again.',
  'Some damaged saved GitHub access entries were removed.',
  'Select Markdown files to import', 'Loading Markdown files from GitHub…',
  'Loading Markdown files…', 'Search Markdown files', 'Loading…', 'Import Selected',
  '{{0}} selected', '{{0}} Markdown files found. Choose what to save to Explorer.',
  'No Markdown files match your search.', 'Select all files', 'Deselect all files',
  'Collapse all folders', 'Expand all folders', 'Clear search to change all folders',
  'Open commit {{0}} on GitHub',
  'No Markdown files were found at that GitHub location.',
  'The provided URL does not point to a Markdown file.',
  'Please enter a GitHub URL.', 'Please enter a valid GitHub URL.',
  'Please select at least one file to import.',
  'No matching branch, tag, or commit was found in this GitHub URL.',
  'GitHub returned a partial tree. Scanning every folder to find all Markdown files…',
  'Large GitHub repository detected. Scanning every folder.',
  'All GitHub folders expanded.', 'All GitHub folders collapsed.',
  'GitHub import finished.', 'Your file is ready.', 'Your files are ready.', 'Save changes'
];

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function removeEmbeddedTranslationDictionary(source) {
  const dictionaryStart = source.indexOf('  const I18N_DICTS = {');
  const dictionaryEnd = source.indexOf("  let activeLang = 'en';", dictionaryStart);
  if (dictionaryStart < 0 || dictionaryEnd < 0) return source;
  return source.slice(0, dictionaryStart) + source.slice(dictionaryEnd);
}

function isTranslatable(value) {
  const text = normalize(value);
  if (text.length < 2 || text.length > 420) return false;
  if (!/\p{L}/u.test(text)) return false;
  if (/^(?:https?:\/\/|data:|blob:|#[0-9a-f]{3,8}$)/i.test(text)) return false;
  if (/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/i.test(text)) return false;
  if (/<[^>]*>|(?:^|\s)(?:style|class|id|aria-[\w-]+|data-[\w-]+|role|tabindex)=|\\u200b/i.test(text)) return false;
  if (/^bi(?:\s+bi-[\w-]+)+$/i.test(text)) return false;
  if (/[{}]=>|\b(?:document|window|console)\.[A-Za-z_$]|function\s*\(/.test(text)) return false;
  if (/^[-+*/=<>()[\]{}.,:;!?\\|_`~]+$/.test(text)) return false;
  return true;
}

function extractScriptStrings(source) {
  const values = new Set();
  const patterns = [
    /(?:alert|confirm|prompt|announceToScreenReader)\(\s*(['"])([^'"\r\n]{2,420})\1/g,
    /\.(?:textContent|title|placeholder)\s*=\s*(['"])([^'"\r\n]{2,420})\1/g,
    /setAttribute\(\s*['"](?:title|aria-label|placeholder)['"]\s*,\s*(['"])([^'"\r\n]{2,420})\1/g
  ];
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(source))) {
      const value = normalize(match[2]);
      if (isTranslatable(value)) values.add(value);
    }
  });

  const templatePattern = /\.(?:textContent|innerHTML|title|placeholder)\s*=\s*`([^`]{2,500})`/g;
  let templateMatch;
  while ((templateMatch = templatePattern.exec(source))) {
    let placeholderIndex = 0;
    const template = templateMatch[1].replace(/\$\{[^}]+\}/g, () => `{{${placeholderIndex++}}}`);
    const templateValue = normalize(template.replace(/<[^>]+>/g, ' '));
    if (isTranslatable(templateValue)) values.add(templateValue);
    templateMatch[1].split(/\$\{[^}]+\}/g).forEach(part => {
      const value = normalize(part);
      if (isTranslatable(value)) values.add(value);
    });
  }

  // Pick up same-line ternaries and configuration labels that are applied to
  // UI later. Keeping this line-scoped prevents source examples and rendering
  // templates from being mistaken for interface copy.
  const addQuotedValues = segment => {
    const quotedPattern = /(?:'((?:\\.|[^'\\\r\n])*)'|"((?:\\.|[^"\\\r\n])*)")/g;
    let match;
    while ((match = quotedPattern.exec(segment))) {
      const value = normalize((match[1] ?? match[2] ?? '')
        .replace(/\\(['"\\])/g, '$1')
        .replace(/\\u\{([0-9a-f]+)\}/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/\\n/g, ' '));
      if (isLikelyUiLiteral(value)) values.add(value);
    }
  };
  const uiLinePattern = /(?:\.(?:textContent|innerHTML|title|placeholder)\s*=|\b(?:label|title|subtitle|description|detail|message|placeholder|heading|tooltip|ariaLabel|titleText|labelText|progressLabelText|cancelLabelText|generatingLabel)\s*[:=]|\b(?:alert|confirm|prompt|(?:show|set|update|announce|open)[A-Z][\w$]*)\s*\()/;
  source.split(/\r?\n/).filter(line => uiLinePattern.test(line)).forEach(addQuotedValues);
  return values;
}

function isLikelyUiLiteral(value) {
  const text = normalize(value);
  if (!isTranslatable(text)) return false;
  if (/^(?:https?:|wss?:|data:|blob:|[.#/]|\$\d|\(|```|M\s*\d)/i.test(text)) return false;
  if (/\b(?:lucide|skeleton|modal-|document-|tab-|github-|live-share-|markdown-|pdf-|preview-)\S*/i.test(text)) return false;
  if (/[<>]|(?:^|\s)(?:display|width|height|padding|margin|color|background|grid|flex)[-\w]*\s*:/i.test(text)) return false;
  if (/\\[sSdDwWbB]|\$\{|=>|\btypeof\b|\bquerySelector\b|\bgetElementById\b/.test(text)) return false;
  if (/^[\w.-]+\.(?:js|css|html|json|md|png|jpe?g|svg|wasm)$/i.test(text)) return false;
  return /\s|[.!?…:]/.test(text) || /^(?:Open|Close|Cancel|Delete|Rename|Duplicate|Download|Move|Create|Import|Export|Share|Copy|Save|Reset|Unlock|Lock|Preparing|Complete|Favorites)$/i.test(text);
}

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}

function restoreProtectedTerms(value) {
  return PROTECTED_TERMS.reduce(
    (result, term) => result.replaceAll(term.token, term.value),
    value
  );
}

function hasTranslationArtifact(value) {
  return /[\r\n]|MV\d+|__MVTERM_|\uFFFD/i.test(String(value || ''));
}

function chunkStrings(strings) {
  const chunks = [];
  let current = [];
  let currentLength = 0;
  strings.forEach(value => {
    const cost = value.length + 40;
    if (current.length && (current.length >= 24 || currentLength + cost > 3400)) {
      chunks.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(value);
    currentLength += cost;
  });
  if (current.length) chunks.push(current);
  return chunks;
}

async function translateChunk(values, targetLanguage) {
  const protectedValues = values.map(value => PROTECTED_TERMS.reduce(
    (result, term) => result.replace(term.pattern, term.token),
    value
  ));
  const markup = protectedValues.map((value, index) => `[[MV${index}]] ${value}`).join('\n');
  const params = new URLSearchParams({
    client: 'gtx', sl: 'en', tl: targetLanguage, dt: 't', q: markup
  });
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
  if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);
  const payload = await response.json();
  const translatedMarkup = (payload[0] || []).map(segment => segment[0] || '').join('');
  const translated = new Array(values.length);
  const pattern = /\[\[MV(\d+)\]\]\s*([\s\S]*?)(?=\s*\[\[MV\d+\]\]|$)/gi;
  let match;
  while ((match = pattern.exec(translatedMarkup))) {
    translated[Number(match[1])] = decodeHtml(match[2]).replace(/\[\[MV\d+\]\]/gi, '').trim();
  }
  if (translated.some(value => typeof value !== 'string' || !value)) {
    if (values.length === 1) {
      return [restoreProtectedTerms(decodeHtml(translatedMarkup).replace(/\[\[MV\d+\]\]/gi, '').trim())];
    }
    return Promise.all(values.map(async value => (await translateChunk([value], targetLanguage))[0]));
  }
  const restored = translated.map(restoreProtectedTerms);
  const corruptIndexes = restored.flatMap((value, index) => hasTranslationArtifact(value) ? [index] : []);
  if (corruptIndexes.length) {
    if (values.length === 1) {
      throw new Error(`Translation service returned a corrupt value for: ${values[0]}`);
    }
    await Promise.all(corruptIndexes.map(async index => {
      restored[index] = (await translateChunk([values[index]], targetLanguage))[0];
    }));
  }
  return restored;
}

async function repairProtectedTerms() {
  const englishCatalog = JSON.parse(await readFile(new URL('en.json', OUTPUT_DIR), 'utf8'));
  const sources = Object.keys(englishCatalog).filter(source =>
    PROTECTED_TERMS.some(term => source.includes(term.value))
  );
  for (const [locale, targetLanguage] of Object.entries(LOCALES)) {
    const outputUrl = new URL(`${locale}.json`, OUTPUT_DIR);
    const catalog = JSON.parse(await readFile(outputUrl, 'utf8'));
    const chunks = chunkStrings(sources);
    for (let index = 0; index < chunks.length; index += 4) {
      const group = chunks.slice(index, index + 4);
      const translatedGroup = await Promise.all(group.map(chunk => translateChunk(chunk, targetLanguage)));
      group.forEach((chunk, groupIndex) => {
        chunk.forEach((source, itemIndex) => { catalog[source] = translatedGroup[groupIndex][itemIndex]; });
      });
    }
    Object.assign(catalog, CURATED_OVERRIDES[locale] || {});
    await writeFile(outputUrl, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
    console.log(`Repaired protected terms for ${locale}.`);
  }
}

async function repairCorruptTranslations() {
  const englishCatalog = JSON.parse(await readFile(new URL('en.json', OUTPUT_DIR), 'utf8'));
  for (const [locale, targetLanguage] of Object.entries(LOCALES)) {
    const outputUrl = new URL(`${locale}.json`, OUTPUT_DIR);
    const catalog = JSON.parse(await readFile(outputUrl, 'utf8'));
    const sources = Object.keys(englishCatalog).filter(source => hasTranslationArtifact(catalog[source]));
    console.log(`Repairing ${locale}: ${sources.length} corrupt translations...`);
    for (let index = 0; index < sources.length; index += 4) {
      const group = sources.slice(index, index + 4);
      const translations = await Promise.all(group.map(source => translateChunk([source], targetLanguage)));
      group.forEach((source, groupIndex) => { catalog[source] = translations[groupIndex][0]; });
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    Object.assign(catalog, CURATED_OVERRIDES[locale] || {});
    await writeFile(outputUrl, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  }
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the local application server.');
}

async function collectDomStrings() {
  console.log('Collecting interface strings from the application…');
  const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', HOST], {
    cwd: ROOT_PATH, stdio: 'ignore', windowsHide: true
  });
  let browser;
  try {
    await waitForServer(`http://${HOST}:${PORT}/`);
    browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
    const page = await browser.newPage({ locale: 'en-US' });
    await page.goto(`http://${HOST}:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1_500);
    return await page.evaluate(() => {
      const values = new Set();
      const skipSelector = [
        'script', 'style', 'code', 'pre', 'textarea', '.editor-pane', '.preview-pane',
        '#markdown-editor', '#markdown-preview', '.lang-select-item', '[data-i18n-skip]',
        '.markdown-tool-menu-symbol', '[data-toolbar-menu-toggle="case"] > span', '#find-case'
      ].join(',');
      const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
      const add = value => {
        const text = normalize(value);
        if (text) values.add(text);
      };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest(skipSelector)) continue;
        add(node.nodeValue);
      }
      document.querySelectorAll('*').forEach(element => {
        if (element.closest('.lang-select-item, [data-i18n-skip]')) return;
        ['title', 'aria-label', 'placeholder'].forEach(name => add(element.getAttribute(name)));
      });
      return Array.from(values);
    });
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

async function main() {
  if (REPAIR_TERMS) {
    await repairProtectedTerms();
    return;
  }
  if (REPAIR_CORRUPT) {
    await repairCorruptTranslations();
    return;
  }
  const domStrings = await collectDomStrings();
  const scriptSource = removeEmbeddedTranslationDictionary(
    await readFile(new URL('../../script.js', import.meta.url), 'utf8')
  );
  const allStrings = new Set([...domStrings, ...extractScriptStrings(scriptSource), ...EXTRA_STRINGS]);
  const strings = Array.from(allStrings).map(normalize).filter(isTranslatable).sort((a, b) => a.localeCompare(b));

  await mkdir(OUTPUT_DIR, { recursive: true });
  const englishCatalog = Object.fromEntries(strings.map(value => [value, value]));
  await writeFile(new URL('en.json', OUTPUT_DIR), JSON.stringify(englishCatalog, null, 2) + '\n', 'utf8');
  console.log(`Collected ${strings.length} English interface strings.`);

  for (const [locale, targetLanguage] of Object.entries(LOCALES)) {
    const outputUrl = new URL(`${locale}.json`, OUTPUT_DIR);
    let catalog = {};
    if (!FORCE) {
      try {
        await access(outputUrl);
        const currentCatalog = JSON.parse(await readFile(outputUrl, 'utf8'));
        const sourceSet = new Set(strings);
        catalog = Object.fromEntries(Object.entries(currentCatalog).filter(([source]) => sourceSet.has(source)));
      } catch (_) {}
    }

    const stringsToTranslate = FORCE ? strings : strings.filter(source => !catalog[source]);
    const chunks = chunkStrings(stringsToTranslate);
    console.log(`Translating ${locale}: ${stringsToTranslate.length} new strings in ${chunks.length} batches...`);
    for (let index = 0; index < chunks.length; index += 4) {
      const group = chunks.slice(index, index + 4);
      const translatedGroup = await Promise.all(group.map(chunk => translateChunk(chunk, targetLanguage)));
      group.forEach((chunk, groupIndex) => {
        const translations = translatedGroup[groupIndex];
        chunk.forEach((source, itemIndex) => { catalog[source] = translations[itemIndex] || source; });
      });
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    Object.assign(catalog, CURATED_OVERRIDES[locale] || {});
    await writeFile(outputUrl, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
