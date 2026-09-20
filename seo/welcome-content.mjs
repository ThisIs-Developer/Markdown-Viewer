// Public starter content shared by the HTML response and the browser fallback.
// These strings describe the app; saved documents are never translated.
const COPY = {
  en: [
    'Welcome to Markdown Viewer',
    'Write and preview Markdown in your browser without creating an account. Open a local .md or .markdown file, paste text, or import a document from GitHub. The editor and preview sit side by side so you can check formatting as you type.',
    'Start with a document',
    'Use New to create a file or open one from your device. Switch between Edit, Split, and Preview in the toolbar. Organize documents into workspaces and folders, and download a Markdown copy to keep a backup.',
    'Preview and export',
    'Use GitHub-Flavored Markdown for headings, links, tables, and task lists. Preview highlighted code, LaTeX math, and Mermaid diagrams. Export the result as Markdown, HTML, PDF, or PNG; Share Snapshot and Live Share provide optional sharing.',
    'Where your content goes',
    'Ordinary editing and autosave stay on this device. Sharing, GitHub import, external images, and remote diagram rendering use network services. Keep separate backups: clearing browser storage can remove your locally saved documents.',
    'Try a small example',
    'Edit the text on the left and watch the preview update. Use the toolbar to insert a link, table, or diagram.'
  ],
  zh: [
    '欢迎使用 Markdown Viewer',
    '无需创建账户，即可在浏览器中编写和预览 Markdown。打开本地 .md 或 .markdown 文件、粘贴文本，或从 GitHub 导入文档。编辑器与预览并排显示，输入时就能检查排版。',
    '开始编辑文档',
    '使用“新建”创建文件，或打开设备上的文件。在工具栏中切换编辑、分屏和预览模式。通过工作区和文件夹整理文档，并下载 Markdown 副本作为备份。',
    '预览与导出',
    '使用 GitHub 风格的 Markdown 编写标题、链接、表格和任务列表，预览代码高亮、LaTeX 公式和 Mermaid 图表。可导出 Markdown、HTML、PDF 或 PNG，也可选择快照分享或实时协作。',
    '内容存储在哪里',
    '日常编辑和自动保存都在此设备上进行。分享、GitHub 导入、外部图片和远程图表渲染会使用网络服务。请另存备份：清除浏览器存储可能会删除本地文档。',
    '尝试一个简单示例',
    '修改左侧文本，查看预览如何更新。使用工具栏插入链接、表格或图表。'
  ],
  ja: [
    'Markdown Viewer へようこそ',
    'アカウントを作成せずに、ブラウザーで Markdown を編集してプレビューできます。端末の .md や .markdown ファイルを開く、テキストを貼り付ける、GitHub から文書を取り込むことができます。編集欄とプレビューを並べて、入力しながら書式を確認できます。',
    '文書を作成する',
    '新規作成からファイルを作るか、端末のファイルを開いてください。ツールバーで編集、分割、プレビューを切り替えられます。ワークスペースとフォルダーで文書を整理し、Markdown ファイルをダウンロードしてバックアップを保存できます。',
    'プレビューとエクスポート',
    'GitHub Flavored Markdown の見出し、リンク、表、タスクリストに対応しています。コードの色分け、LaTeX 数式、Mermaid 図を確認し、Markdown、HTML、PDF、PNG として書き出せます。スナップショット共有やライブ共有も利用できます。',
    '文書の保存先',
    '通常の編集と自動保存はこの端末で行われます。共有、GitHub からの取り込み、外部画像、リモートでの図の描画にはネットワークサービスを使います。ブラウザーの保存データを消すと文書が失われる場合があるため、別途バックアップを残してください。',
    '小さな例で試す',
    '左側の文章を編集してプレビューの変化を確認してください。ツールバーからリンク、表、図を挿入できます。'
  ],
  ko: [
    'Markdown Viewer에 오신 것을 환영합니다',
    '계정을 만들지 않고 브라우저에서 Markdown을 작성하고 미리 볼 수 있습니다. 기기의 .md 또는 .markdown 파일을 열거나, 텍스트를 붙여 넣거나, GitHub에서 문서를 가져오세요. 편집기와 미리보기를 나란히 놓고 입력하면서 서식을 확인할 수 있습니다.',
    '문서 시작하기',
    '새 파일을 만들거나 기기에서 파일을 여세요. 도구 모음에서 편집, 분할, 미리보기 모드를 전환할 수 있습니다. 작업공간과 폴더로 문서를 정리하고 Markdown 사본을 다운로드해 백업하세요.',
    '미리보기와 내보내기',
    'GitHub Flavored Markdown의 제목, 링크, 표, 작업 목록을 사용할 수 있습니다. 코드 구문 강조, LaTeX 수식, Mermaid 다이어그램을 미리 보고 Markdown, HTML, PDF, PNG로 내보내세요. 스냅샷 공유와 라이브 공유도 선택해서 사용할 수 있습니다.',
    '콘텐츠 저장 위치',
    '일반 편집과 자동 저장은 이 기기에서 이루어집니다. 공유, GitHub 가져오기, 외부 이미지, 원격 다이어그램 렌더링은 네트워크 서비스를 사용합니다. 브라우저 저장소를 지우면 로컬 문서가 삭제될 수 있으므로 별도의 백업을 보관하세요.',
    '간단한 예제 사용하기',
    '왼쪽 텍스트를 수정하면서 미리보기가 바뀌는 모습을 확인하세요. 도구 모음에서 링크, 표, 다이어그램을 삽입할 수 있습니다.'
  ],
  pt: [
    'Boas-vindas ao Markdown Viewer',
    'Escreva e visualize Markdown no navegador sem criar uma conta. Abra um arquivo .md ou .markdown do seu dispositivo, cole texto ou importe um documento do GitHub. O editor e a prévia ficam lado a lado para conferir a formatação enquanto você digita.',
    'Comece com um documento',
    'Use Novo para criar um arquivo ou abra um do seu dispositivo. Alterne entre edição, tela dividida e prévia na barra de ferramentas. Organize documentos em espaços de trabalho e pastas e baixe uma cópia em Markdown como backup.',
    'Prévia e exportação',
    'Use Markdown no estilo GitHub para títulos, links, tabelas e listas de tarefas. Visualize código com destaque, fórmulas LaTeX e diagramas Mermaid. Exporte para Markdown, HTML, PDF ou PNG. O compartilhamento de snapshots e a colaboração ao vivo são opcionais.',
    'Onde fica seu conteúdo',
    'A edição comum e o salvamento automático ficam neste dispositivo. Compartilhamento, importação do GitHub, imagens externas e renderização remota de diagramas usam serviços de rede. Guarde backups separados: limpar os dados do navegador pode apagar seus documentos locais.',
    'Experimente um exemplo simples',
    'Edite o texto à esquerda e acompanhe a prévia. Use a barra de ferramentas para inserir um link, uma tabela ou um diagrama.'
  ],
  es: [
    'Te damos la bienvenida a Markdown Viewer',
    'Escribe y previsualiza Markdown en el navegador sin crear una cuenta. Abre un archivo .md o .markdown de tu dispositivo, pega texto o importa un documento desde GitHub. El editor y la vista previa aparecen juntos para comprobar el formato mientras escribes.',
    'Empieza con un documento',
    'Usa Nuevo para crear un archivo o abre uno de tu dispositivo. Cambia entre edición, vista dividida y vista previa desde la barra de herramientas. Organiza documentos en espacios de trabajo y carpetas y descarga una copia en Markdown como respaldo.',
    'Vista previa y exportación',
    'Usa Markdown de GitHub para títulos, enlaces, tablas y listas de tareas. Previsualiza código resaltado, fórmulas LaTeX y diagramas Mermaid. Exporta a Markdown, HTML, PDF o PNG. Puedes compartir una instantánea o colaborar en directo si lo necesitas.',
    'Dónde se guarda el contenido',
    'La edición habitual y el guardado automático se realizan en este dispositivo. Compartir, importar desde GitHub, cargar imágenes externas y renderizar diagramas de forma remota utiliza servicios de red. Guarda copias aparte: borrar los datos del navegador puede eliminar tus documentos locales.',
    'Prueba un ejemplo sencillo',
    'Edita el texto de la izquierda y observa cómo cambia la vista previa. Usa la barra de herramientas para insertar un enlace, una tabla o un diagrama.'
  ],
  fr: [
    'Bienvenue dans Markdown Viewer',
    'Rédigez et prévisualisez du Markdown dans votre navigateur sans créer de compte. Ouvrez un fichier .md ou .markdown de votre appareil, collez du texte ou importez un document depuis GitHub. L’éditeur et l’aperçu sont côte à côte pour vérifier la mise en forme pendant la saisie.',
    'Commencer un document',
    'Créez un fichier avec Nouveau ou ouvrez un fichier de votre appareil. Passez de l’édition à la vue partagée ou à l’aperçu depuis la barre d’outils. Classez vos documents dans des espaces de travail et des dossiers, puis téléchargez une copie Markdown pour la sauvegarder.',
    'Aperçu et exportation',
    'Utilisez le Markdown de GitHub pour les titres, liens, tableaux et listes de tâches. Prévisualisez le code coloré, les formules LaTeX et les diagrammes Mermaid. Exportez en Markdown, HTML, PDF ou PNG. Le partage d’instantanés et la collaboration en direct sont facultatifs.',
    'Où se trouve votre contenu',
    'L’édition courante et la sauvegarde automatique restent sur cet appareil. Le partage, l’importation GitHub, les images externes et le rendu distant des diagrammes utilisent des services réseau. Gardez des sauvegardes séparées : effacer les données du navigateur peut supprimer vos documents locaux.',
    'Essayer un exemple simple',
    'Modifiez le texte à gauche et observez l’aperçu. Utilisez la barre d’outils pour insérer un lien, un tableau ou un diagramme.'
  ],
  de: [
    'Willkommen bei Markdown Viewer',
    'Schreibe Markdown im Browser und sieh dir die Vorschau an, ohne ein Konto anzulegen. Öffne eine lokale .md- oder .markdown-Datei, füge Text ein oder importiere ein Dokument von GitHub. Editor und Vorschau stehen nebeneinander, damit du die Formatierung beim Schreiben prüfen kannst.',
    'Mit einem Dokument beginnen',
    'Erstelle über Neu eine Datei oder öffne eine Datei von deinem Gerät. Wechsle in der Werkzeugleiste zwischen Bearbeiten, geteilter Ansicht und Vorschau. Ordne Dokumente in Arbeitsbereichen und Ordnern und lade eine Markdown-Kopie als Sicherung herunter.',
    'Vorschau und Export',
    'Nutze GitHub Flavored Markdown für Überschriften, Links, Tabellen und Aufgabenlisten. Prüfe hervorgehobenen Code, LaTeX-Formeln und Mermaid-Diagramme. Exportiere als Markdown, HTML, PDF oder PNG. Bei Bedarf kannst du einen Snapshot teilen oder live zusammenarbeiten.',
    'Wo deine Inhalte gespeichert werden',
    'Normales Bearbeiten und automatisches Speichern erfolgen auf diesem Gerät. Teilen, GitHub-Import, externe Bilder und entfernte Diagrammdienste nutzen das Netzwerk. Bewahre zusätzliche Sicherungen auf: Wenn du Browserdaten löschst, können lokal gespeicherte Dokumente verloren gehen.',
    'Ein kleines Beispiel ausprobieren',
    'Bearbeite den Text links und beobachte die Vorschau. Über die Werkzeugleiste kannst du Links, Tabellen und Diagramme einfügen.'
  ],
  ru: [
    'Добро пожаловать в Markdown Viewer',
    'Пишите и просматривайте Markdown в браузере без создания аккаунта. Откройте локальный файл .md или .markdown, вставьте текст или импортируйте документ из GitHub. Редактор и предпросмотр расположены рядом, чтобы проверять оформление во время ввода.',
    'Начните с документа',
    'Создайте новый файл или откройте файл с устройства. На панели инструментов переключайтесь между редактированием, разделённым экраном и предпросмотром. Размещайте документы в рабочих пространствах и папках, скачивайте копии Markdown для резервного хранения.',
    'Предпросмотр и экспорт',
    'Используйте Markdown в стиле GitHub для заголовков, ссылок, таблиц и списков задач. Просматривайте код с подсветкой, формулы LaTeX и диаграммы Mermaid. Экспортируйте в Markdown, HTML, PDF или PNG. При необходимости делитесь снимками или работайте совместно в реальном времени.',
    'Где хранятся ваши данные',
    'Обычное редактирование и автосохранение происходят на этом устройстве. Общий доступ, импорт из GitHub, внешние изображения и удалённое построение диаграмм используют сетевые сервисы. Делайте отдельные резервные копии: очистка данных браузера может удалить локальные документы.',
    'Попробуйте простой пример',
    'Изменяйте текст слева и наблюдайте за предпросмотром. С помощью панели инструментов вставляйте ссылки, таблицы и диаграммы.'
  ],
  it: [
    'Benvenuto in Markdown Viewer',
    'Scrivi e visualizza Markdown nel browser senza creare un account. Apri un file .md o .markdown dal dispositivo, incolla del testo o importa un documento da GitHub. Editor e anteprima sono affiancati per controllare la formattazione mentre scrivi.',
    'Inizia con un documento',
    'Usa Nuovo per creare un file oppure aprine uno dal dispositivo. Passa tra modifica, vista divisa e anteprima dalla barra degli strumenti. Organizza i documenti in spazi di lavoro e cartelle e scarica una copia Markdown come backup.',
    'Anteprima ed esportazione',
    'Usa Markdown in stile GitHub per titoli, collegamenti, tabelle ed elenchi di attività. Visualizza codice evidenziato, formule LaTeX e diagrammi Mermaid. Esporta in Markdown, HTML, PDF o PNG. La condivisione di snapshot e la collaborazione in tempo reale sono facoltative.',
    'Dove vengono salvati i contenuti',
    'La normale modifica e il salvataggio automatico avvengono su questo dispositivo. Condivisione, importazione da GitHub, immagini esterne e rendering remoto dei diagrammi usano servizi di rete. Conserva backup separati: cancellare i dati del browser può eliminare i documenti locali.',
    'Prova un piccolo esempio',
    'Modifica il testo a sinistra e osserva l’anteprima. Usa la barra degli strumenti per inserire un collegamento, una tabella o un diagramma.'
  ],
  tr: [
    'Markdown Viewer’a hoş geldiniz',
    'Hesap oluşturmadan tarayıcınızda Markdown yazın ve önizleyin. Cihazınızdaki .md veya .markdown dosyasını açın, metin yapıştırın ya da GitHub’dan belge aktarın. Düzenleyici ve önizleme yan yana durur; yazarken biçimlendirmeyi kontrol edebilirsiniz.',
    'Bir belgeyle başlayın',
    'Yeni seçeneğiyle dosya oluşturun veya cihazınızdan bir dosya açın. Araç çubuğundan düzenleme, bölünmüş görünüm ve önizleme arasında geçiş yapın. Belgeleri çalışma alanları ve klasörlerle düzenleyin; yedeklemek için Markdown kopyasını indirin.',
    'Önizleme ve dışa aktarma',
    'Başlıklar, bağlantılar, tablolar ve görev listeleri için GitHub tarzı Markdown kullanın. Vurgulanmış kodu, LaTeX formüllerini ve Mermaid diyagramlarını önizleyin. Markdown, HTML, PDF veya PNG olarak dışa aktarın. İsterseniz anlık görüntü paylaşabilir veya canlı olarak birlikte çalışabilirsiniz.',
    'İçeriğiniz nerede saklanır',
    'Normal düzenleme ve otomatik kaydetme bu cihazda gerçekleşir. Paylaşım, GitHub’dan aktarma, harici görseller ve uzaktan diyagram oluşturma ağ hizmetlerini kullanır. Ayrı yedekler tutun: tarayıcı verilerini temizlemek yerel belgelerinizi silebilir.',
    'Küçük bir örnek deneyin',
    'Soldaki metni düzenleyip önizlemenin güncellenmesini izleyin. Araç çubuğuyla bağlantı, tablo veya diyagram ekleyin.'
  ],
  pl: [
    'Witaj w Markdown Viewer',
    'Pisz i przeglądaj Markdown w przeglądarce bez zakładania konta. Otwórz lokalny plik .md lub .markdown, wklej tekst albo zaimportuj dokument z GitHub. Edytor i podgląd są obok siebie, więc możesz sprawdzać formatowanie podczas pisania.',
    'Zacznij od dokumentu',
    'Utwórz nowy plik lub otwórz plik z urządzenia. Na pasku narzędzi przełączaj się między edycją, widokiem dzielonym i podglądem. Porządkuj dokumenty w obszarach roboczych i folderach, a kopię Markdown pobierz jako kopię zapasową.',
    'Podgląd i eksport',
    'Używaj Markdown w stylu GitHub do nagłówków, linków, tabel i list zadań. Przeglądaj wyróżniony kod, wzory LaTeX i diagramy Mermaid. Eksportuj do Markdown, HTML, PDF lub PNG. Opcjonalnie udostępniaj migawki lub współpracuj na żywo.',
    'Gdzie trafiają Twoje dane',
    'Zwykła edycja i automatyczny zapis odbywają się na tym urządzeniu. Udostępnianie, import z GitHub, zewnętrzne obrazy i zdalne renderowanie diagramów korzystają z usług sieciowych. Przechowuj osobne kopie zapasowe: wyczyszczenie danych przeglądarki może usunąć lokalne dokumenty.',
    'Wypróbuj prosty przykład',
    'Zmień tekst po lewej i obserwuj podgląd. Użyj paska narzędzi, aby wstawić link, tabelę lub diagram.'
  ],
  tw: [
    '歡迎使用 Markdown Viewer',
    '無須建立帳號，即可在瀏覽器中撰寫和預覽 Markdown。開啟本機 .md 或 .markdown 檔案、貼上文字，或從 GitHub 導入文件。編輯器與預覽並排顯示，輸入時就能檢查排版。',
    '開始編輯文件',
    '使用「新增」建立檔案，或開啟裝置上的檔案。在工具列切換編輯、分割檢視和預覽模式。透過工作區與資料夾整理文件，並下載 Markdown 副本作為備份。',
    '預覽與匯出',
    '使用 GitHub 風格的 Markdown 撰寫標題、連結、表格和工作清單，預覽程式碼醒目提示、LaTeX 公式與 Mermaid 圖表。可匯出 Markdown、HTML、PDF 或 PNG，也可選擇快照分享或即時協作。',
    '內容儲存在哪裡',
    '一般編輯與自動儲存都在此裝置上進行。分享、GitHub 導入、外部圖片與遠端圖表轉譯會使用網路服務。請另外保存備份：清除瀏覽器儲存空間可能會刪除本機文件。',
    '試用一個簡單範例',
    '修改左側文字，查看預覽如何更新。使用工具列插入連結、表格或圖表。'
  ],
  uk: [
    'Ласкаво просимо до Markdown Viewer',
    'Пишіть і переглядайте Markdown у браузері без створення облікового запису. Відкрийте локальний файл .md або .markdown, вставте текст чи імпортуйте документ із GitHub. Редактор і попередній перегляд розташовані поруч, щоб перевіряти оформлення під час введення.',
    'Почніть із документа',
    'Створіть новий файл або відкрийте файл із пристрою. На панелі інструментів перемикайтеся між редагуванням, розділеним виглядом і переглядом. Упорядковуйте документи в робочих просторах і папках, завантажуйте копію Markdown для резервного зберігання.',
    'Перегляд та експорт',
    'Використовуйте Markdown у стилі GitHub для заголовків, посилань, таблиць і списків завдань. Переглядайте підсвічений код, формули LaTeX і діаграми Mermaid. Експортуйте в Markdown, HTML, PDF або PNG. За потреби діліться знімками чи працюйте разом у реальному часі.',
    'Де зберігаються ваші дані',
    'Звичайне редагування й автозбереження відбуваються на цьому пристрої. Спільний доступ, імпорт із GitHub, зовнішні зображення та віддалене створення діаграм використовують мережеві служби. Робіть окремі резервні копії: очищення даних браузера може видалити локальні документи.',
    'Спробуйте простий приклад',
    'Змінюйте текст ліворуч і спостерігайте за переглядом. За допомогою панелі інструментів вставляйте посилання, таблиці та діаграми.'
  ],
  bg: [
    'Добре дошли в Markdown Viewer',
    'Пишете и преглеждайте Markdown в браузъра, без да създавате профил. Отворете локален файл .md или .markdown, поставете текст или импортирайте документ от GitHub. Редакторът и прегледът са един до друг, за да проверявате оформлението, докато пишете.',
    'Започнете с документ',
    'Създайте нов файл или отворете файл от устройството си. От лентата с инструменти превключвайте между редактиране, разделен изглед и преглед. Подреждайте документите в работни пространства и папки и изтегляйте Markdown копие за резервно съхранение.',
    'Преглед и експортиране',
    'Използвайте Markdown в стил GitHub за заглавия, връзки, таблици и списъци със задачи. Преглеждайте оцветен код, формули LaTeX и диаграми Mermaid. Експортирайте като Markdown, HTML, PDF или PNG. По желание споделяйте снимки на документи или работете съвместно на живо.',
    'Къде се съхранява съдържанието',
    'Обикновеното редактиране и автоматичното запазване се извършват на това устройство. Споделянето, импортирането от GitHub, външните изображения и отдалеченото изобразяване на диаграми използват мрежови услуги. Пазете отделни резервни копия: изчистването на данните на браузъра може да премахне локалните документи.',
    'Опитайте кратък пример',
    'Редактирайте текста отляво и наблюдавайте прегледа. Използвайте лентата с инструменти, за да вмъкнете връзка, таблица или диаграма.'
  ]
};

export function getWelcomeCopy(code) {
  const strings = COPY[code] || COPY.en;
  const [heading, intro, startHeading, start, featuresHeading, features, privacyHeading, privacy, exampleHeading, example] = strings;
  return { heading, intro, startHeading, start, featuresHeading, features, privacyHeading, privacy, exampleHeading, example };
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function renderWelcomeHtml(code) {
  const copy = getWelcomeCopy(code);
  return `<article id="welcome-preview">
  <h2>${escapeHtml(copy.heading)}</h2>
  <p>${escapeHtml(copy.intro)}</p>
  <h3>${escapeHtml(copy.startHeading)}</h3>
  <p>${escapeHtml(copy.start)}</p>
  <h3>${escapeHtml(copy.featuresHeading)}</h3>
  <p>${escapeHtml(copy.features)}</p>
  <h3>${escapeHtml(copy.privacyHeading)}</h3>
  <p>${escapeHtml(copy.privacy)}</p>
</article>`;
}

export function localizedWelcomeMarkdown(code) {
  const copy = getWelcomeCopy(code);
  return `# ${copy.heading}

${copy.intro}

## ${copy.startHeading}

${copy.start}

## ${copy.featuresHeading}

${copy.features}

## ${copy.exampleHeading}

${copy.example}

\`\`\`javascript
const message = "Markdown";
console.log(message);
\`\`\`

$$E = mc^2$$

\`\`\`mermaid
flowchart LR
  Markdown --> HTML
  HTML --> PDF
\`\`\`

## ${copy.privacyHeading}

${copy.privacy}
`;
}
