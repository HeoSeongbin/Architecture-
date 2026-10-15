# 개발 진행 상태

갱신: 2026-10-15 (Asia/Seoul)

## 현재 Phase

Phase 0–1 완료, Phase 2 UI/UX 구현 및 아래 범위의 통합/브라우저 검증 완료. 다음 미완료 단계는 Phase 3 편집 기능 확장이다. 실제 파일 다운로드·휴대폰 터치·다른 브라우저·배포 검증은 완료하지 않았다.

첫 실행 범위는 Phase 0–1, 이번 후속 실행은 Phase 2다. PROJECT.md가 전체 요구사항의 기준이며 다음 실행은 이 문서와 AGENTS.md, DECISIONS.md를 먼저 읽는다. 작업 시작 시 Git에 이전 Phase의 변경이 커밋되지 않은 상태였으며 모두 보존했다.

## 분석 기준과 구조

- 최초 Git HEAD: `ad8aa68` (Delete license section from README), remote: HeoSeongbin/Architecture-. 최초 로컬 변경은 앞선 설치에서 수정한 package-lock.json 하나였으며 보존했다.
- `App.tsx`: hydration, debounce URL, 키보드, 파일 입출력, 헤더.
- `components`: Canvas, Sidebar, Inspector, CustomNodes(일반/그룹), CustomEdges.
- `store/useGraphStore.ts`: 그래프/선택/80단계 히스토리/ELK/그룹.
- `utils`: URL/JSON 계약 및 edge 표시 파생값. `data`: 20개 자산과 샘플. `types`: graph.
- `.github/workflows/deploy.yml`: 기존 Pages workflow. npm install/build/deploy만 있으며 lint/test는 없음. 실행/배포 결과 미확인.
- 유지: React/TypeScript, React Flow, Zustand, hash DEFLATE/Base64, ELK와 fallback, html-to-image. 개선: 입력 검증·히스토리·비동기 보호·회귀 검증. 향후 UI/공유/출력 책임 분리는 실제 변경 단위에 맞춘다.

## 기존 기능 조사

아래 '구현 및 검증 완료'는 기재된 자동화 범위의 검증을 뜻하며 실제 브라우저 E2E를 의미하지 않는다.

| 기능                       | 상태                      | 근거와 남은 검증                                                                     |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| 자산 Drag & Drop           | 구현되어 있으나 개선 필요 | Sidebar 검색/drag payload 테스트; Canvas 실제 drop/좌표 미검증                       |
| React Flow 노드/엣지 편집  | 구현되어 있으나 개선 필요 | Store 연결/이동/삭제 테스트; 포인터 조작 미검증                                      |
| 노드 Inspector             | 구현 및 검증 완료         | label 편집, duplicate/delete 컴포넌트 테스트                                         |
| 엣지 Inspector             | 구현 및 검증 완료         | label/방향 편집 컴포넌트 테스트; 나머지 controls는 소스 확인                         |
| Duplicate/Delete           | 구현 및 검증 완료         | Store/Inspector 테스트; 고유 ID, 연결 삭제, 복원                                     |
| Undo/Redo                  | 구현되어 있으나 개선 필요 | 이동/추가/삭제/80단계/redo 초기화/단축키 테스트; 그룹 전환·resize 히스토리 추가 필요 |
| 샘플                       | 구현 및 검증 완료         | 8노드/7엣지, App Sample 및 왕복 테스트                                               |
| 자동 레이아웃              | 구현되어 있으나 개선 필요 | ELK sample/빈 그래프/비동기 경합 테스트; 그룹/크기/순환/비연결 배치 검증 미완료      |
| JSON Import                | 구현되어 있으나 개선 필요 | 구조/ID/참조/부모/좌표 검증 테스트; 파일 선택·오류 상세 미검증                       |
| JSON Export                | 구현 및 검증 완료         | 정규화 왕복, 그룹 크기/관계·엣지 수동 속성 테스트; 실제 다운로드 미검증              |
| PNG Export                 | 구현되어 있으나 개선 필요 | html-to-image 현재 캔버스 코드 확인; 파일/이미지 잘림 실제 검증 불가                 |
| URL 자동 저장              | 구현되어 있으나 개선 필요 | App hydration → 수정 → 400ms 반영 테스트; 선택/drag 압축 비용 미최적화               |
| URL 공유/복원              | 구현되어 있으나 개선 필요 | 한글/legacy/300노드/그룹/엣지 왕복; clipboard·재접속 실브라우저 미검증               |
| URL 오류 복구              | 부분 구현                 | 손상 hash fallback 및 배너 테스트; 구조/버전/압축 상한/상세 오류 미구현              |
| MiniMap/Controls           | 검증 불가                 | 소스 구현 확인; 실제 zoom/pan/fit 동작 미검증                                        |
| 그룹/크기/포함             | 구현되어 있으나 개선 필요 | NodeResizer/parentId/그룹 DnD 존재; 삭제 자식 보존과 데이터 왕복 테스트              |
| 다중 선택/일괄 편집        | 부분 구현                 | React Flow 기본 선택에 의존, Inspector는 첫 항목만; 일괄 편집/단축키 미구현          |
| 테마/한국어 UI/반응형 패널 | 구현 및 검증 완료         | Phase 2 통합 테스트와 Chromium 화면 검증 (상세 아래)                                 |
| 복사·붙여넣기/SVG/PDF      | 미구현                    | 각각 Phase 3/5 대상                                                                  |

## README와 코드의 차이 (이번에 수정)

1. README는 자체 depth 정렬만 설명했지만 ELK layered + fallback이 이미 존재했다.
2. 그룹을 미래 기능으로만 기술했으나 Group Card, NodeResizer, parentId 저장/복원이 구현되어 있었다.
3. 연결 handle 설명과 달리 네 면 모두 source이며 ConnectionMode.Loose를 사용한다.
4. 엣지는 라벨 외에 방향·표시 모드·회전·연결 면·오프셋 편집이 구현되어 있었다.
5. 원래 lint/test 설정이 없었고 배포 workflow는 이미 존재했다. README를 실제 상태로 보완했다.

## 완료 작업

- PROJECT.md: 전체 Phase/기능 명세, 데이터 호환성, 품질/성능/배포 완료 조건.
- AGENTS.md: 세션 시작/검증/보존/문서화 규칙.
- DECISIONS.md: 아키텍처 유지, 도구, 히스토리, JSON/그룹 정책, ELK/Tailwind 결정.
- ESLint(규칙/hook/refresh), Prettier, Vitest/jsdom, Testing Library, test/typecheck/lint/format/check scripts.
- 직접 의존성 설치 버전 고정과 lock 동기화. 호환 범위 보안 업데이트 적용.
- JSON: 부분 데이터 누락 대신 원자적 거부, 중복/빈 ID·좌표·참조·부모 순환 검증, legacy edge.label 지원.
- Store: 드래그 시작 snapshot 기반 Undo, 키보드 그룹 삭제 시 자식 절대 위치 보존, dangling edge 제거, 정렬 경합 결과 폐기.
- App: 키보드 대상 Element 검사와 중첩 contenteditable 입력 보호.
- 전체 Prettier 정렬. 기존 컴포넌트의 부수 diff는 포맷 변경이며 리디자인하지 않았다.

## 검증 결과

환경: Windows, Node 24.12.0. 직접 버전은 package.json/lock 참고. 주요 버전: React 19.2.7, React Flow 12.11.0, Zustand 5.0.14, ELK 0.11.1, pako 2.1.0, html-to-image 1.11.13, Vite 8.0.16, TypeScript 6.0.3, Tailwind 3.4.19, Vitest 5.0.4.

- 초기 build: 성공. 초기 lint/test 명령: 없음.
- npm ci --no-audit --no-fund: lock 복구 후 성공 (329 packages).
- npm run check: lint 성공, 4개 파일 27개 테스트 통과, strict TS 포함 production build 성공.
- npm run format:check: 성공. 관리 문서 갱신 후 재확인한다.
- 테스트: Store 10개, URL/JSON 11개, Sidebar/Inspector 3개, App 3개.
- production JS 약 1,922KB / gzip 598KB, 500KB chunk 경고 유지. 성능 측정/개선 완료로 간주하지 않는다.
- npm audit fix 후 7건 잔여 (high 5, moderate 2): Tailwind 3의 braces/chokidar/micromatch/fast-glob/postcss-selector-parser/postcss-nested 경로. Tailwind 4 강제 업데이트는 하지 않았다. npm ls에 플랫폼 선택적 @emnapi/wasi-threads 및 tslib extraneous 표시가 남지만 ci/build/test 성공.
- 브라우저 E2E, 실제 PNG/JSON 다운로드, OS/브라우저별 호환성, GitHub workflow/배포: 미실행.

## 오류 및 해결

- Git clone/npm 네트워크: sandbox 제한으로 승인된 네트워크 명령 사용.
- lock @emnapi/wasi-threads 불일치: npm install로 재동기화, npm ci 성공 확인. offline lock 생성은 선택적 peer 해석이 달라 실패하여 사용하지 않음.
- 최초 추가 테스트의 미사용 import: 제거, lint/TS 재통과.
- App keydown 테스트에서 window target.matches 오류 발견: instanceof Element와 closest로 방어 후 통과.
- 중간 테스트 실패는 최종 통과 결과로 대체했으며 회귀 테스트를 남겼다.

## 진행 중 / 미완료 / 차단 요인

현재 진행 중인 구현 없음. Phase 3–7 미착수. Chromium에서 일부 클릭/속성 편집/테마/반응형을 확인했으며 다운로드/전체 포인터 시나리오/배포 검증은 수행 환경과 원격 설정 확인이 필요하다. 코드 작업 자체의 차단 요인은 없다.

남은 부채: URL 스키마 검사/압축 해제 상한/길이 안내/외부 hash 정책, Import 작업 보호 UI/크기 제한/상세 필드 오류, 노드 kind/category 및 치수 검증 확장, 그룹 resize/포함 전환의 히스토리, 정렬 다양한 크기/그룹, PNG 전체 영역, 큰 번들, Tailwind 보안 경고. clipboard fallback은 반환값/예외를 확인하도록 수정했으나 실제 OS clipboard fallback 동작은 미검증이다. React Flow attribution은 다시 표시하며 라이선스 전반 검토는 후속 대상이다.

## Phase 2 구현 및 검증 (2026-10-15)

### 구현 기능

- 한국어 Toolbar/Inspector/도움말/분류/상태 메시지와 HTML lang=ko. 기존 제품명과 사용자가 입력한 노드 데이터는 번역/변조하지 않는다.
- EditorToolbar 추출: 파일(새 다이어그램/Import/JSON/PNG/Clear), 보기(Fit/Zoom/Grid/연결 라벨) 메뉴, 실행 취소/다시 실행, 샘플/정렬/공유/테마. 좁은 화면에서는 배치 메뉴로 정리한다. 새 문서는 Clear와 같은 Undo 가능한 그래프 초기화다.
- native details 메뉴는 Escape/외부 클릭/액션 실행으로 닫힌다. 파일/보기 메뉴 버튼, 편집 기록과 패널 토글에 접근 가능한 이름을 제공한다.
- Sidebar 아이콘 미리보기/설명 툴팁/분류 접기, 한국어 분류 검색, 화면 중앙 클릭 추가. 기존 HTML5 drag payload는 유지한다. 검색 결과는 접힌 분류도 펼쳐 보여준다.
- 테마 CSS 토큰, React Flow colorMode, 커스텀 노드/그룹/엣지/Controls/MiniMap의 테마 적용. 첫 방문 시스템 테마와 브라우저 설정 기억, storage 차단 시 메모리 fallback. PNG 배경도 테마에 맞춘다.
- 900px 이하에서 양쪽 고정 패널을 숨겨 캔버스를 확보하고 한 패널씩 비모달로 연다. 닫기/Escape 후 토글로 포커스를 복귀한다. 클릭 추가 후 패널을 닫는다.
- 선택 강조와 aria-pressed, 무선택 도움말, 하단 live status/alert 및 노드/연결/URL 문자 수. import/export/share/clear/sample/layout/이미지 처리 결과를 안내한다. 실제 다운로드 완료를 확인하지 않고 다운로드 요청으로 표현한다.
- skip link는 location.hash를 바꾸지 않고 캔버스에 포커스만 이동한다. reduced-motion 설정을 따른다. 작은 화면에서도 Fit View 가능하도록 minZoom 0.1.

### 발견한 문제와 조치

- 자산 목록 가로 스크롤: minmax grid와 overflow-x 제어로 수정.
- 모바일 메뉴가 길고 작업 영역을 차지함: 배치 메뉴/링크 아이콘으로 정리하고 메뉴 폭을 화면 안에 제한.
- 클릭 추가 후 Inspector가 비는 현상: addNode가 selectedNodeId만 설정하고 React Flow selected 속성은 설정하지 않아 선택 이벤트가 ID를 지움. 기존 선택을 해제하고 새 노드를 selected로 표시하도록 수정; Store 회귀와 실제 브라우저로 확인.
- clipboard fallback이 실패해도 성공 안내: execCommand 반환값 검사, textarea 정리와 원래 포커스 복원.
- 테스트의 accessible name 공백 가정 오류: 자산 버튼에 명시적 접근 가능한 이름을 부여하고 한국어 UI에 맞춰 테스트 갱신.
- sandbox 내부 Vite 서버는 내장 브라우저에서 연결 실패. 승인된 로컬 개발 서버 실행으로 해결.
- HMR 중 React Flow nodeTypes 변경 경고 1회 관찰. nodeTypes/edgeTypes는 기존처럼 모듈 상수이며, 새로고침 이후 추가 경고/오류는 관찰되지 않았다.

### 검증 결과

- `npm run check`: ESLint 성공, 4개 테스트 파일 **37개 통과**, strict TypeScript 검사와 production build 성공.
- `npm run format:check`: 성공. 문서 마지막 갱신 후 포맷 재확인.
- 기존 Store/URL/JSON 회귀 테스트 유지. 새 테마가 그래프 참조/공유 hash를 바꾸지 않음, 저장된 테마/시스템 테마/storage 차단, 패널 표시/Escape/포커스, skip link hash 보존, Import 실패 시 작업 유지/성공 후 Undo, clipboard 실패, 클릭 추가·Undo·분류 접기, 보기 라벨 URL 왕복, 새 문서 Undo를 검증.
- Codex 내장 Chromium 실제 UI: 1280×720 라이트/다크, 390×844 메뉴/패널/자산 클릭 추가/전체 보기, 노드 선택·한국어 이름 편집, 새로고침 후 URL 복원과 테마 유지 확인. desktop 문서 너비 1280=viewport 1280, 캔버스 너비 732px 확인. 임시 viewport는 기본으로 복원했다.
- 화면 근거: `docs/screenshots/phase2-light.jpg`, `phase2-dark.jpg`, `phase2-mobile.jpg`.
- JS 약 1,929KB/gzip 601KB, CSS 50.84KB. 큰 chunk 경고는 유지한다. 성능 개선 완료를 주장하지 않는다.
- URL/JSON 스키마와 압축 코드는 이번 Phase에서 변경하지 않았다. 라이브러리 추가/업데이트와 원격 push/배포도 수행하지 않았다.
- 실제 JSON/PNG 파일 다운로드, 모바일 실제 터치, Firefox/Safari/Edge 별도 실행, 전체 drag/resize/연결/정렬 E2E, 스크린리더 실기 검증은 미완료다.

### 변경 파일 (이번 Phase)

- UI: src/App.tsx, components/EditorToolbar.tsx(신규), Sidebar.tsx, Inspector.tsx, ArchitectureCanvas.tsx, CustomNodes/ArchitectureNodeCard.tsx, GroupNodeCard.tsx, src/styles.css, index.html.
- UI 로직: src/hooks/useEditorTheme.ts, useNarrowScreen.ts, src/utils/assetPresentation.ts (신규).
- 선택 일치 수정: src/store/useGraphStore.ts.
- 회귀: src/App.test.tsx, src/components/editor.test.tsx, src/store/useGraphStore.test.ts.
- 문서/근거: AGENTS.md, PROJECT.md, README.md, docs/PROGRESS.md, docs/DECISIONS.md, docs/screenshots/*.jpg.

## 다음 작업 — Phase 3

다중 선택/일괄 편집, Ctrl/⌘+C/V/D/A, 일반 노드 크기, 엣지 선 종류/색/화살표, 그룹 포함 관리와 resize/포함 전환 히스토리를 구현한다. 각 기능은 Undo/Redo와 구버전 URL/JSON 왕복을 함께 검증한다. 즐겨찾기/최근 사용은 Phase 5이며 이번에 미리 구현하지 않았다.

## 전체 단계

Phase 0 분석/문서 완료 → Phase 1 안정화/검증 기반 완료 → Phase 2 UI 구현/명시 범위 검증 완료 → Phase 3 편집 확장 대기 → Phase 4 정렬/데이터 대기 → Phase 5 자산/출력 대기 → Phase 6 성능/E2E 대기 → Phase 7 문서/배포 검증 대기.
