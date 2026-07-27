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

## Markdown Viewer 소개

Markdown Viewer는 `.md` 및 `.markdown` 문서를 위한 오픈 소스 편집기입니다. 일반 텍스트 편집기, 정제된 미리보기, 여러 문서를 관리하는 작업공간, 리뷰 도구, 다양한 렌더러, 가져오기/내보내기, Share Snapshot, Live Share를 하나의 애플리케이션에서 제공합니다.

계정을 만들지 않고 Markdown을 사용하려는 개발자, 테크니컬 라이터, 학생, 연구자 등을 대상으로 합니다. 일반적인 편집, 미리보기 렌더링, 로컬 파일 가져오기, 문서 정리, 대부분의 내보내기는 기기에서 처리됩니다. 네트워크를 사용하는 기능은 이 문서에 명시되어 있습니다.

## 주요 기능

- **작업공간 및 문서:** 중첩 폴더에서 최대 50개 문서를 정리할 수 있습니다. 최근 파일, 즐겨찾기, 검색, 탭, 일괄 작업, 암호화된 Secret Workspace(비밀 작업 공간)를 지원합니다.
- **편집 및 리뷰:** 편집기, 분할 보기, 미리보기 사이를 전환할 수 있습니다. 서식 도구, 사용자 지정 실행 취소/다시 실행, 찾기 및 바꾸기, LTR/RTL, 댓글과 제안을 사용할 수 있습니다.
- **Markdown 렌더링:** CommonMark 스타일의 기본 구문, GitHub-Flavored Markdown(GFM), 표, 작업 목록, 알림, 각주, 정의 목록, 코드 구문 강조, 정제된 HTML, MathJax를 지원합니다.
- **시각 콘텐츠:** Mermaid, PlantUML, Graphviz/DOT, D2, Vega-Lite, WaveDrom, Markmap, GeoJSON, TopoJSON, STL, ABC 기보를 렌더링합니다.
- **가져오기 및 내보내기:** 로컬 파일이나 공개 GitHub 콘텐츠를 열고 Markdown, 독립 실행형 HTML, PNG, 브라우저 인쇄/PDF 저장, 레거시 래스터 PDF로 내보낼 수 있습니다.
- **선택적 공유:** 보기 전용 또는 편집 가능 모드의 Share Snapshot(스냅샷 공유)을 만들거나, 호스트/편집 가능/보기 전용 권한을 사용하는 임시 Live Share(라이브 공유) 방을 시작할 수 있습니다.
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
| GitHub 가져오기 및 이모지 조회 | GitHub API/원시 콘텐츠 호스트 |
| PlantUML, D2, Graphviz, Vega-Lite, WaveDrom, 일부 다이어그램 미리보기 | 다이어그램 소스가 PlantUML, Kroki 또는 mermaid.ink로 전송될 수 있음 |
| 동의 후 삽입하는 이미지, GIF, 동영상 | 공개 링크 방식의 Cloudflare 임시 미디어 저장소(90일) |
| 큰 Share Snapshot | Cloudflare KV(90일) |
| Live Share | Cloudflare Durable Object WebSocket 릴레이 |
| 외부 이미지, 미디어, 링크, 지도 타일 | 문서에서 지정한 외부 호스트 |

Share Snapshot 및 Live Share URL은 베어러 링크입니다. 유효한 링크를 가진 사람은 링크에 포함된 권한을 사용할 수 있습니다. Live Share는 종단 간 암호화를 제공하지 않습니다. 민감한 문서에 네트워크 기능을 사용하기 전에 [개인정보 및 보안(영어)](../wiki/Privacy-and-Security.md)을 확인하세요.

## 미디어 저장 방식

- AVIF, BMP, GIF(애니메이션 GIF 포함), JPEG, PNG, WebP, MP4, WebM, Ogg를 삽입할 수 있습니다.
- 처음 동의한 후 미디어는 Cloudflare 임시 저장소에 업로드되고 짧은 콘텐츠 주소형 HTTPS URL로 삽입됩니다.
- URL을 아는 사람은 만료 전까지 미디어를 가져올 수 있습니다.
- 같은 콘텐츠를 마지막으로 업로드한 시점부터 90일 후 만료됩니다.
- Share Snapshot과 Live Share는 Markdown 안의 URL을 공유할 뿐 별도의 미디어 복사본을 만들지 않습니다.

## 주요 제한

- 작업공간에는 최대 50개 문서를 둘 수 있습니다. 잠긴 Secret Workspace 수와 임시 Share Snapshot/Live Share 탭도 포함됩니다.
- 로컬 Markdown 파일 하나의 최대 크기는 10 MB입니다.
- GitHub 가져오기는 저장소/폴더 결과에서 Markdown 파일을 최대 30개까지 표시합니다.
- 처리 전 미디어 원본은 25 MiB까지입니다. 저장 한도는 정지 이미지 300 KiB, GIF 5 MiB, 동영상 10 MiB입니다.
- 저장형 Share Snapshot은 최대 8,000,000자이며 90일 후 만료됩니다.
- Live Share는 WebSocket 참가자 최대 64명, 실시간 메시지당 8 MB까지 지원합니다.
- STL은 소스 2 MiB, 렌더링 지오메트리 300,000개 정점으로 제한됩니다.
- 래스터 PDF/PNG는 브라우저 메모리, Canvas, CORS 제한의 영향을 받습니다.

## 개인정보 관련 중요 사항

- 일반 작업공간 데이터는 브라우저 프로필 또는 데스크톱 로컬 저장소에 보관됩니다.
- 프라이빗 모드를 켜면 Secret Workspace의 암호화된 데이터까지 포함해 영구 저장된 문서 상태가 삭제되고 이후 저장이 중지됩니다.
- **작업공간 재설정**은 일반 문서, 리뷰 데이터, Secret Workspace 데이터를 삭제합니다. Markdown Viewer에서 복구할 수 없습니다.
- Live Share는 Markdown/리뷰 콘텐츠를 서버에 영구 저장하지 않습니다. 다만 역할별 베어러 권한 값과 생성 시각은 Durable Object 저장소에 보관되며, 애플리케이션 수준의 만료 시간이나 삭제 경로가 없습니다.
- Share Snapshot 생성 API는 삭제 토큰을 반환하지만 현재 UI는 해당 토큰을 표시하거나 만료 전 삭제 작업을 제공하지 않습니다.
- 애플리케이션 코드에는 계정, 분석, 원격 측정, 광고, 추적 픽셀 또는 앱 전용 쿠키가 구현되어 있지 않습니다. 외부 서비스나 호스팅 제공자는 일반 요청 로그를 처리할 수 있습니다.

> **경고:** 프라이빗 모드 또는 **작업공간 재설정**을 사용하기 전에 필요한 문서를 Markdown으로 내보내세요.

## 문서

상세 페이지는 영어로 유지 관리됩니다.

| 목적 | 페이지(영어) |
| :--- | :--- |
| 전체 기능과 제한 | [Features](../wiki/Features.md) |
| 일상 사용법과 단축키 | [Usage Guide](../wiki/Usage-Guide.md) |
| Markdown/다이어그램 구문 | [Markdown Reference](../wiki/Markdown-Reference.md) |
| Share Snapshot | [Share Snapshot](../wiki/Share-Snapshot.md) |
| Live Share | [Live Share](../wiki/Live-Share-Cloudflare.md) |
| 개인정보 및 보안 | [Privacy and Security](../wiki/Privacy-and-Security.md) |
| 설치 및 배포 | [Installation](../wiki/Installation.md) |
| 문제 해결 | [Troubleshooting](../wiki/Troubleshooting.md)/[FAQ](../wiki/FAQ.md) |
| 기여 | [Contributing](../wiki/Contributing.md) |
| 다국어 용어 및 현지화 | [Localization and Terminology](../wiki/Localization.md) |

## 쇼케이스 프로젝트

Markdown Viewer를 활용한 다음 커뮤니티 프로젝트는 해당 개발자가 독립적으로 유지 관리합니다.

- [**Markdown Desk**](https://github.com/jhrepo/markdown-desk): Tauri로 만든 네이티브 macOS 래퍼입니다. 네이티브 파일 대화 상자와 파일 핸들러, 메뉴 막대 통합, 자동 다시 불러오기 및 앱 내 업데이트 기능을 추가합니다.

## 📈 개발 여정

Markdown Viewer는 PC에서 시작한 작은 개인 프로젝트였습니다. 호기심에서 출발해 실수와 수정을 거치고 많은 정성을 담아 만든 단순한 Markdown 뷰어입니다. <a href="https://a1b91221.markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">초기 버전</a>은 지금도 온라인에서 사용할 수 있으며 프로젝트의 중심으로 남아 있습니다.

더 자세한 역사는 [Development Journey(영어)](../wiki/Development-Journey.md)를 참조하세요.

## 기여자

Markdown Viewer는 커뮤니티의 기여를 통해 성장하고 있습니다.

<a href="https://github.com/ThisIs-Developer/Markdown-Viewer/graphs/contributors" target="_blank" rel="noopener noreferrer">
  <img src="https://contrib.rocks/image?repo=ThisIs-Developer/Markdown-Viewer" alt="Markdown Viewer 기여자" />
</a>

## 기여 및 라이선스

Pull Request를 만들기 전에 [Contributing(영어)](../wiki/Contributing.md)을 읽어 주세요. 재현 가능한 버그와 구체적인 기능 제안은 [이슈 추적기](https://github.com/ThisIs-Developer/Markdown-Viewer/issues)에 등록할 수 있습니다. 취약점 세부 정보는 일반 이슈에 게시하지 마세요.

Markdown Viewer는 [Apache License 2.0](../LICENSE)에 따라 제공됩니다.
