<div align="center">

  <img src="../assets/icon.jpg" alt="Markdown Viewer Logo" width="100" />

  <h1>Markdown Viewer - 실시간 미리보기가 있는 온라인 Markdown 에디터</h1>

  **브라우저 기반 Markdown 에디터, 뷰어, 프리뷰어, 리더입니다.**

  *`.md` 파일을 열고, 읽고, 편집하고, 분할 화면 실시간 Markdown 미리보기, 동기화 스크롤, GitHub-Flavored Markdown, 다이어그램, 지도, 3D STL 미리보기, ABC 악보 재생, PDF/HTML/PNG 내보내기, Web/데스크톱/Docker의 다중 탭 작업을 지원합니다.*

  [![License](https://img.shields.io/github/license/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=red)](https://github.com/ThisIs-Developer/Markdown-Viewer/blob/main/LICENSE)
  [![Latest Release](https://img.shields.io/github/v/release/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=FF6B00)](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)
  [![Last Commit](https://img.shields.io/github/last-commit/ThisIs-Developer/Markdown-Viewer?style=flat-square)](https://github.com/ThisIs-Developer/Markdown-Viewer/commits/main)
  [![Stars](https://img.shields.io/github/stars/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=dfb317)](https://github.com/ThisIs-Developer/Markdown-Viewer/stargazers)

  <p>
    <a href="https://codewiki.google/github.com/thisis-developer/markdown-viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/badge/CodeWiki-Explore-4285F4?logo=wikipedia&logoColor=white&style=flat" alt="CodeWiki" />
    </a>
    <a href="https://deepwiki.com/ThisIs-Developer/Markdown-Viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://deepwiki.com/badge.svg" alt="DeepWiki" />
    </a>
  </p>

  🌐 [English](../README.md) • [简体中文](README_zh.md) • [日本語](README_ja.md) • **한국어** • <a href="../wiki/Localization.md">더 많은 언어</a>

  [라이브 데모](https://markdownviewer.pages.dev/) • [Wiki](../wiki/Home.md#start-here) • [이슈 추적기](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) • [릴리스](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

</div>

## 목차

<details>
  <summary>📂 <b>목차</b> (클릭하여 펼치기)</summary>
  <br />

  - [프로젝트 소개](#프로젝트-소개)
  - [빠르게 사용해 보기](#빠르게-사용해-보기)
  - [주요 기능](#주요-기능)
  - [Markdown 편집과 실시간 미리보기](#markdown-편집과-실시간-미리보기)
  - [다이어그램과 시각 콘텐츠](#다이어그램과-시각-콘텐츠)
  - [공유, 협업, 내보내기](#공유-협업-내보내기)
  - [시스템 구조](#시스템-구조)
    - [핵심 파일](#핵심-파일)
  - [시작하기와 설치](#시작하기와-설치)
  - [사용 가이드와 키보드 단축키](#사용-가이드와-키보드-단축키)
  - [프로젝트 디렉터리 구조](#프로젝트-디렉터리-구조)
  - [Built With (기술 스택)](#built-with-기술-스택)
  - [개인정보](#개인정보)
  - [보안 및 개인정보 보호](#보안-및-개인정보-보호)
  - [기여와 코드 품질](#기여와-코드-품질)
  - [쇼케이스와 커뮤니티 프로젝트](#쇼케이스와-커뮤니티-프로젝트)
  - [기여자](#기여자)
  - [📈 개발 여정](#-개발-여정)
  - [라이선스](#라이선스)
  - [연락처와 지원](#연락처와-지원)
</details>

---

## 프로젝트 소개

**Markdown Viewer**는 `.md` 및 `.markdown` 파일을 위한 오픈 소스 브라우저 기반 Markdown 에디터이자 뷰어입니다. 일반 텍스트 Markdown 편집, GitHub 스타일 실시간 미리보기, 문서 탭, diagram-as-code 도구, 수식, 내보내기, 공유, Web/데스크톱 배포 옵션을 함께 제공합니다.

대부분의 편집, 미리보기, 자동 저장, 로컬 파일 가져오기, 설정, 내보내기는 사용자의 기기에서 처리됩니다. 네트워크 기능은 명확히 설명되어 있습니다. 로그인은 필요하지 않습니다.

<p align="center">
  <img src="https://github.com/user-attachments/assets/ccfd7772-8874-4470-9282-7b0327a87bbd" alt="Markdown Viewer - GFM 렌더링, 다중 문서 탭 작업 공간, 다크 테마를 지원하는 분할 화면 실시간 Markdown 에디터와 미리보기" width="90%" />
</p>

## 빠르게 사용해 보기

1. [온라인 Markdown 에디터](https://markdownviewer.pages.dev/)를 엽니다.
2. `.md` 또는 `.markdown` 파일을 끌어오거나 바로 작성합니다.
3. 필요에 따라 실시간 미리보기, **Insert Diagram & More**, 내보내기 메뉴, Share Snapshot, Live Share를 사용합니다.

자세한 내용은 Wiki의 [기능](../wiki/Features.md#product-summary), [개인정보](../wiki/Home.md#privacy-at-a-glance), [공유](../wiki/Features.md#share-markdown-with-snapshot-links), [내보내기](../wiki/Features.md#export-markdown-to-pdf-html-png-and-md), [데스크톱](../wiki/Features.md#desktop-app) 섹션을 참고하세요.

## 주요 기능

Markdown Viewer는 기본 Markdown 기능을 지원하면서, 더 풍부한 기술 문서를 작성할 수 있게 도와줍니다.

1. **GitHub-Flavored Markdown (GFM)**: 일반 Markdown을 작성하면서 표, 작업 목록, 취소선, 자동 링크, 코드 블록, 알림 블록, 각주, 실시간 미리보기를 사용할 수 있습니다. 대부분의 Markdown 편집기는 기본 기능을 다루지만, 아래 기능들은 Markdown Viewer가 더 풍부한 기술 문서를 위해 제공하는 추가 기능입니다.
2. **Advanced Diagram Support & More**: 하나의 **Insert Diagram & More** 버튼으로 시각 템플릿, 미리보기, 바로 삽입할 수 있는 예제를 열 수 있어 사용자가 모든 문법을 외우지 않아도 복잡한 콘텐츠를 추가할 수 있습니다.

   - **Mermaid**: 플로차트, 시퀀스 다이어그램, 간트 차트, 상태도, 문서 친화적인 아키텍처 시각화를 만들 수 있습니다.
   - **PlantUML**: 소프트웨어 설계 노트에 시퀀스, 클래스, 유스케이스, 엔지니어링 다이어그램을 추가할 수 있습니다.
   - **Graphviz**: 트리, 의존성 맵, 네트워크 관계를 위한 DOT 그래프를 렌더링할 수 있습니다.
   - **D2**: 현대적인 레이아웃 출력으로 깔끔한 diagram-as-code를 만들 수 있습니다.
   - **Vega-Lite**: Markdown 안에서 차트와 데이터 시각화를 직접 설명할 수 있습니다.
   - **Markmap**: 중첩 Markdown 목록을 계획과 학습 노트에 적합한 마인드맵으로 바꿀 수 있습니다.
   - **WaveDrom**: 하드웨어나 프로토콜 작업을 위한 타이밍 다이어그램과 신호 파형을 문서화할 수 있습니다.
   - **Map**: 문서를 벗어나지 않고 GeoJSON 및 TopoJSON 데이터를 미리볼 수 있습니다.
   - **STL 3D Model Renderer**: 기술 노트 옆에서 3D 모델 미리보기.
   - **ABC Music Player & Sheet Music Viewer**: 악보 렌더링과 브라우저 재생.

3. **문서 탐색기 및 두 문서 분할 보기**: 중첩 폴더에 저장된 파일을 최대 50개까지 정리하고, 일괄 파일 작업을 사용하며, 두 문서를 나란히 열어 Markdown, 수식, 다이어그램, 지도, STL, ABC 기보를 모두 렌더링할 수 있습니다.
4. **Comments & Suggestions**: Markdown 소스를 변경하지 않고 렌더링된 문서 블록에 피드백을 추가하고 관리하며 해결할 수 있습니다.
5. **Live Share Temporary Rooms**: 서버가 확인하는 호스트, 편집 가능, 보기 전용 권한으로 빠른 편집 세션, 리뷰, 페어 작성에 사용할 수 있는 실시간 협업 공간입니다.
6. **Share Snapshot Links**: 문서 상태를 빠르게 보내야 할 때 읽기 전용 또는 편집 가능한 특정 시점 링크를 만들 수 있습니다. 저장된 큰 스냅샷은 90일 후 만료됩니다.
7. **LaTeX Math Notation**: MathJax로 인라인 및 표시 수식을 렌더링하며, 수식이 많은 노트, 논문, 기술 설명에 유용합니다.
8. **Markdown to PDF, HTML & PNG Export**: 공유, 인쇄, 보관이 필요한 문서를 위해 Markdown, HTML, PNG, Browser Print / Save as PDF, Legacy Raster PDF를 내보낼 수 있습니다.
9. **개인정보 및 보안 제어**: 작업 공간 설정에서 Private mode를 켜 문서와 리뷰 데이터를 현재 세션에만 유지할 수 있습니다. 미리보기는 정리되고, 내보낸 HTML은 보안이 강화되며, 데스크톱 네이티브 API는 제한됩니다.

자세한 기능, 제한, 개인정보 관련 사항은 [기능 참고](../wiki/Features.md#product-summary)를 확인하세요.

## Markdown 편집과 실시간 미리보기

- 일반 Markdown을 작성하면서 GFM, 구문 강조, 수식, 알림, 각주, 표, 작업 목록, 정리된 HTML을 실시간으로 미리볼 수 있습니다.
- 반응형 탐색기에서 저장된 Markdown 파일을 최대 50개까지 정리할 수 있습니다. 고정된 Workspace 및 Secret Workspace 루트, 중첩 폴더, 검색, 최근 파일, 즐겨찾기, 끌어서 놓기 이동, 폴더 자동 펼치기, 가장자리 자동 스크롤을 지원합니다. Secret Workspace 내용은 기기에서 비밀번호로 암호화됩니다.
- 파일 메뉴에서 두 문서를 나란히 열 수 있습니다. 하나의 공용 컨트롤로 양쪽을 편집과 미리보기 사이에서 전환하며, 미리보기 모드에서는 Markdown, 수식, Mermaid와 원격 다이어그램, 지도, STL 모델, ABC 기보를 렌더링합니다. 탐색기에서 파일을 여러 개 선택해 함께 열거나 이동하거나 삭제할 수 있고, 빈 영역이나 문서 영역을 마우스 오른쪽 버튼으로 클릭해 관련 작업을 열 수 있습니다.
- 편집기 커서 위치에 이미지, 애니메이션 GIF, MP4, WebM, Ogg 동영상을 붙여넣거나 업로드하거나 놓을 수 있습니다. 진행 토스트가 업로드 상태를 보여 주며, 관리형 미디어는 짧은 콘텐츠 주소형 HTTPS 링크를 사용해 새로 고침, Share Snapshot, Live Share, Markdown 내보내기 후에도 90일 만료 시점까지 사용할 수 있습니다. 같은 최초 동의 후 기존 인라인 래스터 이미지도 변환할 수 있습니다.
- WYSIWYG 스타일 툴바를 사용하면서도 일반 텍스트 Markdown 소스를 그대로 제어할 수 있습니다.
- 큰 문서는 디바운스 렌더링과 백그라운드 Worker로 미리보며, 입력이 계속 빠르게 반응하도록 합니다.

## 다이어그램과 시각 콘텐츠

Markdown Viewer는 기술 노트, 문서, 하드웨어 글, 음악 스니펫, 데이터가 많은 문서를 위한 Markdown 다이어그램 편집기로도 잘 맞습니다.

- **Mermaid, PlantUML, Graphviz / DOT, D2**: 플로차트, 시퀀스 다이어그램, 클래스 다이어그램, 아키텍처 스케치, 의존성 그래프, diagram-as-code 작업 흐름에 사용할 수 있습니다.
- **Vega-Lite, Markmap**: Markdown 차트, 데이터 시각화, 마인드맵에 사용할 수 있습니다.
- **WaveDrom**: 타이밍 다이어그램과 신호 문서화에 사용할 수 있습니다.
- **GeoJSON 및 TopoJSON 지도**: 위치 정보를 포함한 Markdown 문서에 사용할 수 있습니다.
- **STL 3D 모델 미리보기**: 노트 옆에서 3D 모델 스니펫을 확인하는 데 사용할 수 있습니다.
- **ABC notation**: 악보 렌더링과 브라우저 재생에 사용할 수 있습니다.

<p align="center">
  <img src="https://github.com/user-attachments/assets/15c87e8c-43f0-4a4f-a4d7-81e98ba5c1cb" alt="다이어그램 지원 및 기타 기능" width="90%" />
  <img src="https://github.com/user-attachments/assets/4341040b-eddd-40fa-8d1f-ba6ec9ac1010" alt="ABC 음악 악보와 오디오 합성" width="90%" />
  <img src="https://github.com/user-attachments/assets/606b1666-7359-4872-bb98-e3ae37b65ca9" alt="STL 3D 모델 렌더러" width="90%" />
</p>

## 공유, 협업, 내보내기

- **Comments & Suggestions**는 Markdown을 변경하지 않고 렌더링된 YAML, 제목, 문단, 코드 블록, 다이어그램에 리뷰 계층을 추가합니다. 피드백을 추가, 편집, 해결, 다시 열기, 삭제, 복사할 수 있으며 일반 탭에 저장되고 활성 Live Share 공간에서만 동기화됩니다.
- **Share Snapshot**은 특정 시점의 Markdown 공유를 위한 빠른 링크를 만듭니다. 작은 문서는 URL hash에 남길 수 있고, 더 큰 스냅샷은 해당 백엔드가 구성된 경우 Cloudflare KV에 최대 90일간 임시 저장됩니다. 링크를 가진 사람은 누구나 열 수 있습니다.
<p align="center">
  <img src="https://github.com/user-attachments/assets/e62ca1a0-011a-4b01-90f9-e72638b9a6d5" alt="Share Snapshot" width="90%" />
</p>

- **Live Share rooms**는 Cloudflare Durable Objects를 통한 임시 공동 편집을 제공하며, 서버가 호스트, 편집 가능, 보기 전용 권한을 확인합니다. 리뷰와 페어 작성에 유용하지만 엔드 투 엔드 암호화는 아닙니다.
<p align="center">
  <img src="https://github.com/user-attachments/assets/4d7a72c7-8eec-48df-9f66-49fe9f205d4f" alt="Live Share rooms" width="90%" />
</p>

- **Markdown export**는 원본 `.md` 문서를 다운로드합니다.
- **HTML export**는 독립 실행 가능한 렌더링 문서를 만듭니다.
- **PDF export**는 Browser Print / Save as PDF와 Legacy Raster PDF를 포함합니다.
- **PNG export**는 렌더링된 미리보기를 이미지로 캡처합니다.

---

## 시스템 구조

Markdown Viewer는 클라이언트 측 단일 페이지 앱입니다. `script.js`가 UI를 제어하고, `preview-worker.js`가 백그라운드에서 Markdown을 컴파일하며, `sw.js`가 오프라인 가능 캐싱을 처리합니다.

### 핵심 파일

1. **`index.html`**: 앱 레이아웃과 스크립트/스타일 진입점.
2. **`script.js`**: 탭, 편집기 상태, 미리보기 업데이트, 가져오기, 내보내기, 공유, UI 동작.
3. **`styles.css`**: 레이아웃, 테마, 미리보기 스타일, 인쇄 스타일.
4. **`preview-worker.js`**: Markdown 파싱과 구문 강조.
5. **`sw.js`**: 오프라인 가능 자산 캐싱.

---

## 시작하기와 설치

### 💻 방법 1: 빠른 로컬 실행(설치 없음)

`index.html`을 `file://`로 직접 여는 대신 로컬 HTTP 서버를 통해 실행하세요.

1. 저장소를 클론하거나 다운로드합니다.
2. 저장소 폴더에서 터미널을 엽니다.
3. `python -m http.server 8080` 또는 `npx serve . -p 8080`을 실행합니다.
4. 브라우저에서 **[http://localhost:8080](http://localhost:8080)**을 엽니다.

---

### 🐳 방법 2: Docker 컨테이너

컨테이너에서 앱을 실행합니다.

**미리 빌드된 Docker 이미지(GHCR):**
```bash
docker run -d \
  --name markdown-viewer \
  -p 8080:80 \
  --restart unless-stopped \
  ghcr.io/thisis-developer/markdown-viewer:latest
```

브라우저에서 **[http://localhost:8080](http://localhost:8080)**을 엽니다.

**로컬 Docker Compose 빌드:**
```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
docker compose up -d
```
브라우저에서 **[http://localhost:8080](http://localhost:8080)**을 엽니다.

---

### 🖥️ 방법 3: 데스크톱 앱 빌드

소스에서 Neutralinojs 데스크톱 앱을 빌드합니다.

1. 저장소를 클론하고 `desktop-app/` 디렉터리로 이동합니다.
   ```bash
   cd desktop-app
   ```
2. 의존성을 설치하고 빌드합니다.
   ```powershell
   npm install
   npm run build
   ```

`npm run build`는 필요한 Neutralino 바이너리를 다운로드하고 로컬 리소스를 준비한 뒤, 자체 실행 가능한 플랫폼별 실행 파일 7개를 만듭니다.

미리 빌드된 바이너리는 [Releases](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)에서 받을 수 있습니다.

---

## 사용 가이드와 키보드 단축키

작업 흐름, 편집기 컨트롤, 내보내기, 공유, 단축키는 [사용 가이드](../wiki/Usage-Guide.md#workspace-layout-for-editing-and-previewing-markdown)를 참고하세요.

---

## 프로젝트 디렉터리 구조

```text
Markdown-Viewer/
+-- index.html              # 웹 앱 기본 화면
+-- script.js               # 앱 로직과 UI 제어
+-- styles.css              # 앱 및 미리보기 스타일
+-- preview-worker.js       # Markdown 미리보기 Worker
+-- sw.js                   # Service Worker 캐시
+-- assets/                 # 앱 이미지와 아이콘
|   +-- i18n/              # UI 번역 카탈로그와 생성기
+-- functions/              # Cloudflare Pages Functions
+-- workers/                # Live Share Worker 소스
+-- desktop-app/            # Neutralinojs 데스크톱 빌드
+-- locales/                # 현지화된 README
+-- wiki/                   # 프로젝트 문서
+-- Dockerfile              # Docker 이미지 설정
+-- docker-compose.yml      # 로컬 컨테이너 설정
+-- wrangler.toml           # Cloudflare 배포 설정
+-- README.md               # 프로젝트 개요
+-- CHANGELOG.md            # 릴리스 기록
+-- LICENSE                 # Apache License 2.0
```

---

## Built With (기술 스택)

<p align="left">
  <a href="https://developer.mozilla.org/ko/docs/Web/HTML"><img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5" /></a>
  <a href="https://developer.mozilla.org/ko/docs/Web/CSS"><img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3" /></a>
  <a href="https://developer.mozilla.org/ko/docs/Web/JavaScript"><img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript" /></a>
  <a href="https://getbootstrap.com"><img src="https://img.shields.io/badge/Bootstrap-7952B3?style=flat-square&logo=bootstrap&logoColor=white" alt="Bootstrap" /></a>
  <a href="https://neutralino.js.org"><img src="https://img.shields.io/badge/NeutralinoJS-FFA500?style=flat-square&logo=neutralinojs&logoColor=white" alt="NeutralinoJS" /></a>
</p>

핵심 기술 스택: HTML, CSS, JavaScript, Bootstrap, Bootstrap Icons, Neutralinojs, Marked.js, Highlight.js, DOMPurify, MathJax, Mermaid, Leaflet, Three.js, ABCJS, Markmap, Yjs, jsPDF, html2canvas, Cloudflare Pages/Workers.

의존성 로딩 방식, CDN 사용, 데스크톱 로컬 라이브러리 복사본은 [클라이언트 라이브러리 설명](../wiki/Configuration.md#client-libraries)을 참고하세요.

일부 고급 다이어그램 엔진은 필요할 때 PlantUML, Kroki, mermaid.ink 같은 원격 렌더러를 사용합니다. 렌더러 동작과 개인정보 세부 사항은 [다이어그램 렌더러 설명](../wiki/Features.md#insert-diagrams-charts-maps-models-and-music)을 참고하세요.

---

## 개인정보

Markdown Viewer는 클라우드 작업 공간이 아닙니다. 일반 입력, 미리보기 렌더링, 로컬 파일 가져오기, 탭 자동 저장, 테마 설정, 대부분의 내보내기는 사용자의 기기에서 처리됩니다. 로그인은 필요하지 않으며 분석, 텔레메트리, 광고, 추적 쿠키를 구현하지 않습니다.

네트워크 사용은 동의한 관리형 미디어 업로드, GitHub 가져오기, 원격 다이어그램 렌더러, Share Snapshot, Live Share, CDN 라이브러리, 외부 문서 자산처럼 사용자가 실행하는 기능에 한정됩니다. 작업 공간 설정의 Private mode를 사용하면 편집 및 리뷰 도구는 그대로 사용하면서 문서 내용, 작업 공간 상태, 리뷰 피드백을 현재 세션에만 유지할 수 있습니다. 전체 내용은 [데이터 처리 요약](../wiki/Features.md#data-handling-summary)을 참고하세요.

## 보안 및 개인정보 보호

- 미리보기 HTML은 삽입 전에 정리됩니다. 내보낸 HTML에는 제한적인 CSP와 외부 자산용 SRI 메타데이터가 포함됩니다.
- Secret Workspace는 PBKDF2-SHA-256으로 비밀번호에서 로컬 키를 만들고 AES-GCM으로 파일 및 폴더 이름을 암호화합니다. 키는 잠금 해제된 세션 동안만 유지되며, 잊어버린 비밀번호는 복구할 수 없습니다.
- Cloudflare Pages는 `_headers`를 사용해 CSP, 클릭재킹 방지, 리퍼러 및 권한 정책, MIME 스니핑 방지를 적용합니다. 민감한 경로는 404로 리디렉션됩니다.
- 관리형 미디어 및 저장형 Share Snapshot API 업로드는 프로덕션 앱, 미리보기, `null`, 로컬 개발 출처로 제한됩니다. 이미지, GIF, 동영상은 추측하기 어려운 공개 링크로 90일간 가져올 수 있습니다. 스냅샷 응답은 `no-store`를 사용하며 생성자는 삭제 토큰을 받습니다.
- STL 렌더링은 WebGL 처리 전에 크기가 너무 큰 소스, 유한하지 않은 형상, 과도한 정점 수를 거부합니다.
- Neutralino 데스크톱 빌드는 기본 `os.execCommand`를 노출하지 않고 네이티브 API를 명시적인 허용 목록으로 제한합니다. 자세한 내용은 [보안 모델](../wiki/Features.md#security-model)과 [설정 참고](../wiki/Configuration.md#share-api)를 확인하세요.

---

## 기여와 코드 품질

커뮤니티 기여를 환영합니다! Pull Request를 만들기 전에 [코드 변경 전 기여 안내](../wiki/Contributing.md#before-changing-code)를 확인하세요.

### 핵심 워크플로 요약:
1. **Fork** 저장소를 포크하고 기능 브랜치를 만듭니다(`git checkout -b feature/your-feature`).
2. **코드 스타일 확인:** HTML, CSS, JS 파일 전체에서 깔끔한 2칸 들여쓰기를 유지하세요. 원시 HTML 구조는 의미론적으로 작성하세요. 처리 Worker 안에서 직접 DOM 쿼리를 사용하는 것은 피하세요.
3. **Conventional Commits:** `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`, `chore:` 접두사가 붙은 명확한 커밋 메시지를 작성하세요.
4. **테스트:** Chrome, Firefox, Edge, Safari 뷰포트에서 변경 사항을 테스트하세요.

---

## 쇼케이스와 커뮤니티 프로젝트

*   **[Markdown Desk](https://github.com/jhrepo/markdown-desk):** Tauri로 만든 네이티브 macOS 래퍼로, 네이티브 파일 시스템 핸들러, 메뉴 막대 통합, 자동 다시 로드 기능을 추가합니다.

---

## 기여자

Markdown Viewer에 기여해 주신 모든 분께 감사드립니다.

<a href="https://github.com/ThisIs-Developer/Markdown-Viewer/graphs/contributors" target="_blank" rel="noopener noreferrer">
  <img src="https://contrib.rocks/image?repo=ThisIs-Developer/Markdown-Viewer" alt="Contributors" />
</a>

---

## 📈 개발 여정

Markdown Viewer는 PC에서 시작한 작은 개인 프로젝트였습니다. 호기심, 실수, 수정, 많은 정성으로 만들어진 간단한 Markdown 뷰어였습니다. <a href="https://a1b91221.markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">원래 버전</a>은 아직 온라인에 있으며, 여전히 이 프로젝트의 중심에 남아 있습니다.

현재의 <a href="https://markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">Markdown Viewer</a>는 커뮤니티 피드백, Issue, PR, 스크린샷, GIF, 제안, 실제 문서 작업 흐름을 통해 성장했습니다. 기술적인 발전도 중요하지만, 이 여정에는 감정적인 면도 있습니다. 많은 사람들이 이 앱이 오늘의 모습이 되도록 함께 만들어 주었습니다.

---

## 라이선스

이 프로젝트는 Apache License 2.0으로 제공됩니다. 전체 약관과 조건은 [LICENSE](../LICENSE)를 참고하세요.

---

## 연락처와 지원

개발 및 유지 관리: **[ThisIs-Developer](https://github.com/ThisIs-Developer)**

*   **버그 보고와 요청:** [Issue 제출](https://github.com/ThisIs-Developer/Markdown-Viewer/issues)
*   **문서:** [Wiki 시작 안내](../wiki/Home.md#start-here)
