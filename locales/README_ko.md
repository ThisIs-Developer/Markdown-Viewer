<div align="center">

  <img src="../assets/icon.jpg" alt="Markdown Viewer 로고" width="100" />

  <h1>Markdown Viewer</h1>

  **실시간 미리보기를 제공하는 로컬 우선 Markdown 편집기 및 뷰어**

  브라우저, 프로그레시브 웹 앱(PWA), Docker 또는 Neutralino 데스크톱 애플리케이션에서 Markdown을 열고 작성하고 정리하고 검토하고 렌더링하고 내보낼 수 있습니다. 필요한 경우 공유와 공동 편집도 사용할 수 있습니다.

  [![라이선스](https://img.shields.io/github/license/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=red)](../LICENSE)
  [![최신 릴리스](https://img.shields.io/github/v/release/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=FF6B00)](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

  <p>
    <a href="https://codewiki.google/github.com/thisis-developer/markdown-viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/badge/CodeWiki-Explore-4285F4?logo=wikipedia&logoColor=white&style=flat" alt="CodeWiki에서 Markdown Viewer 살펴보기" />
    </a>
    <a href="https://deepwiki.com/ThisIs-Developer/Markdown-Viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://deepwiki.com/badge.svg" alt="DeepWiki에서 Markdown Viewer 살펴보기" />
    </a>
  </p>

  [English](../README.md) · [日本語](README_ja.md) · **한국어** · [简体中文](README_zh.md) · [繁體中文](README_tw.md)

  [웹 앱 열기](https://markdownviewer.pages.dev/) · [문서(영어)](../wiki/Home.md) · [이슈 보고](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) · [릴리스](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

</div>

<details>
<summary><strong>목차</strong>(클릭하여 펼치기)</summary>

- [Markdown Viewer 소개](#markdown-viewer-소개)
- [주요 기능](#주요-기능)
- [빠른 시작](#빠른-시작)
- [로컬 처리와 네트워크 처리](#로컬-처리와-네트워크-처리)
- [시각화 렌더러 개요](#시각화-렌더러-개요)
- [문서](#문서)
- [주요 제한](#주요-제한)
- [쇼케이스 프로젝트](#쇼케이스-프로젝트)
- [개발 여정](#개발-여정)
- [기여자](#기여자)
- [기여 및 지원](#기여-및-지원)
- [라이선스](#라이선스)

</details>

## Markdown Viewer 소개

Markdown Viewer는 개발자, 작성자, 학생, 연구자 등 `.md` 또는 `.markdown` 파일을 사용하는 모든 사람을 위한 오픈 소스 로컬 우선 작업공간입니다. 단순한 텍스트를 넘어 여러 문서를 정리하고, Markdown을 변경하지 않은 채 댓글과 제안으로 검토하며, 다이어그램, 지도, 차트, 수식, 3D 모델, 음악을 하나의 집중된 작업공간에서 렌더링할 수 있습니다.

문서를 Share Snapshot 링크로 만들어 빠르게 공유하거나, 접근 권한이 제어되는 Live Share에서 실시간 공동 편집, 라이브 커서, 댓글, 제안을 사용할 수 있습니다. 일상적인 편집은 기기에서 처리됩니다. 계정이 필요 없으며 애플리케이션에는 광고, 분석, 원격 측정 또는 구독이 없습니다.

<p align="center">
  <img src="https://github.com/user-attachments/assets/5a0d6fda-96f0-4baf-bf7a-0ffbe5119eab" alt="Markdown Viewer 애플리케이션 화면" width="90%" />
</p>

## 주요 기능

- **작업공간 및 문서:** 웹에서는 문서별 IndexedDB 저장소를 사용하고 중첩 폴더에서 문서를 정리할 수 있습니다. 최근 파일, 즐겨찾기, 검색, 탭, 일괄 작업, 암호화된 Secret Workspace(비밀 작업 공간)를 지원합니다.
- **백업 및 복원:** 폴더 구조를 유지하는 작업공간 ZIP을 내보내거나 가져올 수 있습니다. 암호화된 Secret Workspace 파일은 선택적으로 포함할 수 있지만 휴지통과 데스크톱 기록은 백업에 포함되지 않습니다.
- **편집 및 리뷰:** 편집기, 분할 보기, 미리보기 사이를 전환할 수 있습니다. 서식 도구, 사용자 지정 실행 취소/다시 실행, 찾기 및 바꾸기, LTR/RTL, 댓글과 제안을 사용할 수 있습니다.
- **Markdown 렌더링:** CommonMark 스타일의 기본 구문, GitHub-Flavored Markdown(GFM), 표, 작업 목록, 알림, 각주, 정의 목록, 코드 구문 강조, 정제된 HTML, MathJax를 지원합니다.
- **시각 콘텐츠:** Mermaid, PlantUML, Graphviz/DOT, D2, Vega-Lite, WaveDrom, Markmap, GeoJSON, TopoJSON, STL, ABC 기보를 렌더링합니다.

<p align="center">
  <img src="https://github.com/user-attachments/assets/57a015a4-621c-4da3-9825-604724f5966b" alt="다이어그램 삽입 모듈" width="90%" />
  <img src="https://github.com/user-attachments/assets/e4560bc1-d6a7-409a-8a93-c054d0a853b3" alt="다이어그램 렌더링 예시" width="90%" />
  <img src="https://github.com/user-attachments/assets/d50d980d-1b40-43c7-b924-901c9413987d" alt="3D STL 보기" width="90%" />
  <img src="https://github.com/user-attachments/assets/bbacabcf-eb19-4430-af19-1ab791afe01c" alt="전체 화면 3D STL 보기" width="90%" />
</p>

- **가져오기 및 내보내기:** 로컬 파일이나 브랜치, 태그, 커밋 SHA 및 필요한 경우 비공개 저장소의 GitHub 콘텐츠를 열 수 있습니다. Markdown, 독립 실행형 HTML, PNG, 브라우저 인쇄/PDF 저장, 레거시 래스터 PDF로 내보낼 수 있습니다.
- **선택적 공유:** 보기 전용 또는 편집 가능 모드의 Share Snapshot(스냅샷 공유)을 만들거나, 호스트/편집 가능/보기 전용 권한을 사용하는 임시 Live Share(라이브 공유) 방을 시작할 수 있습니다.

<p align="center">
  <img src="https://github.com/user-attachments/assets/0b2080e8-6ba8-4dac-a58a-d043fadeeb61" alt="Live Share 세션" width="90%" />
</p>

- **다양한 실행 방식:** 호스팅 웹 앱, PWA, 정적 호스팅, Docker, Cloudflare 또는 Neutralino 데스크톱 애플리케이션을 사용할 수 있습니다.

구현된 동작과 제한은 [기능 참고(영어)](../wiki/Features.md)를 확인하세요.

## 빠른 시작

[호스팅 웹 앱](https://markdownviewer.pages.dev/)을 사용하거나 로컬 HTTP 서버로 저장소를 실행합니다.

```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
python -m http.server 8080
```

`http://localhost:8080`을 여세요. `file://`에서는 브라우저 보안 정책이 Web Worker와 Service Worker를 차단할 수 있습니다.

| 실행 대상 | 자세한 문서(영어) |
| :--- | :--- |
| PWA/정적 웹 호스팅 | [설치](../wiki/Installation.md) |
| Docker | [Docker 배포](../wiki/Docker-Deployment.md) |
| Cloudflare Pages/KV/Durable Objects | [설정](../wiki/Configuration.md) |
| Neutralino 데스크톱 애플리케이션 | [데스크톱 애플리케이션](../wiki/Desktop-App.md) |

## 로컬 처리와 네트워크 처리

Markdown Viewer는 로컬 우선 애플리케이션이지만 모든 기능이 오프라인으로 작동하는 것은 아닙니다.

| 작업 | 기본 데이터 경로 |
| :--- | :--- |
| 편집, 로컬 가져오기, 미리보기, 작업공간 자동 저장, 대부분의 내보내기 | 기기 |
| 웹 라이브러리 및 캐시되지 않은 렌더러 의존성 | 웹/PWA 빌드에서 CDN 요청 |
| GitHub 가져오기 및 이모지 조회 | 공개 콘텐츠는 GitHub API/원시 콘텐츠 호스트, 비공개 콘텐츠와 PAT는 `api.github.com`만 사용 |
| PlantUML, D2, Graphviz, Vega-Lite, WaveDrom, 일부 다이어그램 미리보기 | 다이어그램 소스가 PlantUML, Kroki 또는 mermaid.ink로 전송될 수 있음 |
| 동의 후 삽입하는 이미지, GIF, 동영상 | 공개 링크 방식의 Cloudflare 임시 미디어 저장소(90일) |
| 큰 Share Snapshot | Cloudflare KV(90일) |
| Live Share | Cloudflare Durable Object WebSocket 릴레이. 문서 콘텐츠는 서버에 영구 저장되지 않음 |
| 외부 이미지, 미디어, 링크, 지도 타일 | 문서에서 지정한 외부 호스트 |

Share Snapshot 및 Live Share URL은 베어러 링크입니다. 유효한 링크를 가진 사람은 링크에 포함된 권한을 사용할 수 있습니다. Live Share는 종단 간 암호화를 제공하지 않습니다. 민감한 문서에 네트워크 기능을 사용하기 전에 [개인정보 및 보안(영어)](../wiki/Privacy-and-Security.md)을 확인하세요.

## 시각화 렌더러 개요

| 코드 펜스 | 렌더링 경로 |
| :--- | :--- |
| `mermaid` | 클라이언트 측. 삽입 미리보기에서 mermaid.ink 또는 Kroki를 사용할 수 있음 |
| `plantuml` | PlantUML 서버. Kroki를 대체 경로로 사용 |
| `d2`, `graphviz`, `dot`, `vega-lite`, `vegalite`, `wavedrom` | Kroki |
| `markmap` | 클라이언트 측 Markmap 및 D3 |
| `geojson`, `topojson` | 클라이언트 측 Leaflet. 지도 타일은 네트워크를 사용할 수 있음 |
| `stl` | 클라이언트 측 Three.js/WebGL |
| `abc` | 클라이언트 측 ABCJS. 재생에는 브라우저 오디오 지원이 필요 |
| `math` 및 LaTeX 구분 기호 | 클라이언트 측 MathJax |

원격 렌더러 서비스는 렌더링하는 다이어그램 소스를 수신합니다. 설정된 서비스를 신뢰할 수 없다면 민감한 다이어그램 소스를 보내지 마세요. 구문은 [Markdown Reference(영어)](../wiki/Markdown-Reference.md), 제한은 [기능 참고(영어)](../wiki/Features.md#insert-diagrams-charts-maps-models-and-music)를 확인하세요.

## 문서

상세 페이지는 영어로 유지 관리됩니다.

| 목적 | 페이지(영어) |
| :--- | :--- |
| 시작 페이지 선택 | [Documentation Home](../wiki/Home.md) |
| 전체 기능과 제한 | [Features](../wiki/Features.md) |
| 일상 사용법과 단축키 | [Usage Guide](../wiki/Usage-Guide.md) |
| Markdown/다이어그램 구문 | [Markdown Reference](../wiki/Markdown-Reference.md) |
| Share Snapshot | [Share Snapshot](../wiki/Share-Snapshot.md) |
| Live Share | [Live Share](../wiki/Live-Share-Cloudflare.md) |
| 개인정보 및 보안 | [Privacy and Security](../wiki/Privacy-and-Security.md) |
| 설치 및 배포 | [Installation](../wiki/Installation.md) |
| 저장소, 렌더러 및 Cloudflare 설정 | [Configuration](../wiki/Configuration.md) |
| 문제 해결 | [Troubleshooting](../wiki/Troubleshooting.md)/[FAQ](../wiki/FAQ.md) |
| 기여 | [Contributing](../wiki/Contributing.md) |
| 다국어 용어 및 현지화 | [Localization and Terminology](../wiki/Localization.md) |

## 주요 제한

- 작업공간 백업 가져오기는 작업공간을 병합하지 않습니다. 확인 후 현재 작업공간을 영구적으로 대체합니다.
- 작업공간 백업에는 휴지통, 데스크톱 기록 또는 충돌 복구 저널이 포함되지 않습니다.
- 10 MB보다 큰 로컬 Markdown 파일은 거부됩니다.
- GitHub 자격 증명 보관소에는 이름이 지정된 PAT를 최대 50개 저장할 수 있습니다. 각 토큰 이름은 60자로 제한됩니다.
- 처리 전 미디어 원본은 25 MiB까지입니다. 저장 한도는 정지 이미지 300 KiB, GIF 5 MiB, 동영상 10 MiB입니다.
- 저장형 Share Snapshot은 최대 8,000,000자이며 90일 후 만료됩니다.
- Live Share는 WebSocket 참가자 최대 64명, 실시간 메시지당 8 MB까지 지원합니다.
- STL은 소스 2 MiB, 렌더링 지오메트리 300,000개 정점으로 제한됩니다.
- 데스크톱 보관소는 문서당 최근 기록 사본을 최대 20개 유지합니다.
- 래스터 PDF/PNG는 브라우저 메모리, Canvas, CORS 제한의 영향을 받습니다.

자세한 내용은 [Features: Known Technical Limits(영어)](../wiki/Features.md#known-technical-limits)를 확인하세요.

## 쇼케이스 프로젝트

Markdown Viewer를 활용한 다음 커뮤니티 프로젝트는 해당 개발자가 독립적으로 유지 관리합니다.

- [**Markdown Desk**](https://github.com/jhrepo/markdown-desk): Tauri로 만든 네이티브 macOS 래퍼입니다. 네이티브 파일 대화 상자와 파일 핸들러, 메뉴 막대 통합, 자동 다시 불러오기 및 앱 내 업데이트 기능을 추가합니다.

## 개발 여정

Markdown Viewer는 PC에서 시작한 작은 개인 프로젝트였습니다. 호기심에서 출발해 실수와 수정을 거치고 많은 정성을 담아 만든 단순한 Markdown 뷰어입니다. <a href="https://a1b91221.markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">초기 버전</a>은 지금도 온라인에서 사용할 수 있으며 프로젝트의 중심으로 남아 있습니다.

더 자세한 역사는 [Development Journey(영어)](../wiki/Development-Journey.md)를 참조하세요.

## 기여자

Markdown Viewer는 커뮤니티의 기여를 통해 성장하고 있습니다.

<a href="https://github.com/ThisIs-Developer/Markdown-Viewer/graphs/contributors" target="_blank" rel="noopener noreferrer">
  <img src="https://contrib.rocks/image?repo=ThisIs-Developer/Markdown-Viewer" alt="Markdown Viewer 기여자" />
</a>

## 기여 및 지원

Pull Request를 만들기 전에 [Contributing(영어)](../wiki/Contributing.md)을 읽어 주세요. 재현 가능한 버그와 구체적인 기능 제안은 [이슈 추적기](https://github.com/ThisIs-Developer/Markdown-Viewer/issues)에 등록할 수 있습니다.

취약점 세부 정보는 일반 이슈에 게시하지 마세요. [Contributing: Security Reports(영어)](../wiki/Contributing.md#security-reports)에 설명된 저장소의 비공개 보안 신고 채널을 사용하세요.

## 라이선스

Markdown Viewer는 [Apache License 2.0](../LICENSE)에 따라 제공됩니다.
