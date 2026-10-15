# 개발 진행 상태

갱신: 2026-10-15 (Asia/Seoul)

## 현재 Phase

Phase 0–4 구현 및 아래 범위의 자동화/브라우저 검증 완료. 다음 미완료 단계는 Phase 5 자산 및 출력이다. 실제 파일 다운로드·휴대폰 터치·다른 브라우저·배포 검증은 완료하지 않았다.

첫 실행 범위는 Phase 0–1, 이전 후속 실행은 Phase 2, 이전 실행은 Phase 3, 이번 실행은 Phase 4다. PROJECT.md가 전체 요구사항의 기준이며 다음 실행은 이 문서와 AGENTS.md, DECISIONS.md를 먼저 읽는다. Phase 3 시작 시 HEAD는 `7351f4c`, 작업 폴더는 깨끗한 상태였다. Phase 3 변경을 보존하며 Phase 4를 추가했다. 두 Phase 변경은 아직 커밋/push하지 않았다.

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

| 기능                       | 상태                      | 근거와 남은 검증                                                                              |
| -------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| 자산 Drag & Drop           | 구현되어 있으나 개선 필요 | Sidebar 검색/drag payload 테스트; Canvas 실제 drop/좌표 미검증                                |
| React Flow 노드/엣지 편집  | 구현되어 있으나 개선 필요 | Store 연결/이동/삭제 테스트; 포인터 조작 미검증                                               |
| 노드 Inspector             | 구현 및 검증 완료         | label 편집, duplicate/delete 컴포넌트 테스트                                                  |
| 엣지 Inspector             | 구현 및 검증 완료         | label/방향 편집 컴포넌트 테스트; 나머지 controls는 소스 확인                                  |
| Duplicate/Delete           | 구현 및 검증 완료         | Store/Inspector 테스트; 고유 ID, 연결 삭제, 복원                                              |
| Undo/Redo                  | 구현 및 검증 완료         | 기존 회귀와 Phase 3 일괄 편집/resize/그룹 전환 단일 단계 테스트 및 실제 resize/삭제 Undo 확인 |
| 샘플                       | 구현 및 검증 완료         | 8노드/7엣지, App Sample 및 왕복 테스트                                                        |
| 자동 레이아웃              | 구현되어 있으나 개선 필요 | ELK sample/빈 그래프/비동기 경합 테스트; 그룹/크기/순환/비연결 배치 검증 미완료               |
| JSON Import                | 구현되어 있으나 개선 필요 | 구조/ID/참조/부모/좌표 검증 테스트; 파일 선택·오류 상세 미검증                                |
| JSON Export                | 구현 및 검증 완료         | 정규화 왕복, 그룹 크기/관계·엣지 수동 속성 테스트; 실제 다운로드 미검증                       |
| PNG Export                 | 구현되어 있으나 개선 필요 | html-to-image 현재 캔버스 코드 확인; 파일/이미지 잘림 실제 검증 불가                          |
| URL 자동 저장              | 구현되어 있으나 개선 필요 | App hydration → 수정 → 400ms 반영 테스트; 선택/drag 압축 비용 미최적화                        |
| URL 공유/복원              | 구현되어 있으나 개선 필요 | 한글/legacy/300노드/그룹/엣지 왕복; clipboard·재접속 실브라우저 미검증                        |
| URL 오류 복구              | 부분 구현                 | 손상 hash fallback 및 배너 테스트; 구조/버전/압축 상한/상세 오류 미구현                       |
| MiniMap/Controls           | 검증 불가                 | 소스 구현 확인; 실제 zoom/pan/fit 동작 미검증                                                 |
| 그룹/크기/포함             | 구현 및 검증 완료         | 일반/그룹 resize, 포함/해제/그룹 생성/삭제 정책, 위치 유지와 왕복, 실제 포인터 검증           |
| 다중 선택/일괄 편집        | 구현 및 검증 완료         | Ctrl/Shift/영역 선택, 공통 속성/정렬/간격/원자적 삭제 및 단축키 테스트                        |
| 테마/한국어 UI/반응형 패널 | 구현 및 검증 완료         | Phase 2 통합 테스트와 Chromium 화면 검증 (상세 아래)                                          |
| 복사·붙여넣기              | 구현 및 검증 완료         | 내부 클립보드/그룹 자식·내부 연결/새 ID 테스트, 실제 메뉴 복사·붙여넣기 확인                  |
| SVG/PDF                    | 미구현                    | Phase 5 대상                                                                                  |

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

현재 진행 중인 구현 없음. Phase 4–7 미착수. Chromium에서 아래의 선택/복제/삭제/resize/그룹/스타일 조작을 확인했다. 다운로드/전체 포인터 시나리오/배포 검증은 수행 환경과 원격 설정 확인이 필요하다. 코드 작업 자체의 차단 요인은 없다.

남은 부채: URL 스키마 검사/압축 해제 상한/길이 안내/외부 hash 정책, Import 작업 보호 UI/크기 제한/상세 필드 오류, 노드 kind/category 등 검증 확장, 그룹/방향을 고려한 정렬、PNG 전체 영역、큰 번들、Tailwind 보안 경고. clipboard fallback은 반환값/예외를 확인하도록 수정했으나 실제 OS clipboard fallback 동작은 미검증이다. React Flow attribution은 표시하며 라이선스 전반 검토는 후속 대상이다. resize는 포함 관계를 자동 변경하지 않으므로 그룹을 자식보다 작게 만들면 자식이 영역 밖에 보일 수 있다. 소속 드롭다운 또는 드래그로 관계를 관리한다.

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

## Phase 3 구현 및 검증 (2026-10-15)

### 구현 기능

- Ctrl/Shift/⌘ 클릭 다중 선택과 드래그 영역 선택. 영역에 전체가 들어온 노드만 선택하여 작은 선택 영역이 부모 그룹까지 선택하는 것을 줄인다. 캔버스 이동은 마우스 가운데/오른쪽 드래그 또는 React Flow의 Space 조작을 사용한다.
- 다중 Inspector: 공통 부제목/메모/강조색, 6방향 정렬, 균등 분배, 0–2000px 명시적 가로/세로 간격. 다른 부모의 노드도 캔버스 절대 좌표를 기준으로 처리하고 선택된 부모의 자식은 별도로 다시 이동하지 않는다.
- 편집 메뉴와 Ctrl/⌘+A/C/V/D, Delete/Backspace. 텍스트 입력/textarea/select/contenteditable에서는 브라우저 기본 동작 유지. 편집기 메모리 클립보드이며 OS clipboard/탭 간 복사는 지원하지 않는다.
- 복사/복제: 새 UUID, 선택 내부 엣지 endpoint와 parentId 재매핑, 그룹 선택 시 자식/중첩 그룹 함께 복제. 선택하지 않은 부모에서 떼어 복사한 자식은 절대 좌표로 붙여넣는다. 루트만 선택하여 중복 이동을 피하고 반복 붙여넣기는 48px씩 오프셋을 늘린다.
- 일반/그룹 NodeResizer와 Inspector 치수, 제한 범위, 저장/복원. 이동/resize snapshot을 마지막 이벤트에서 한 번 commit하고 드래그 그룹 전환도 같은 Undo에 포함한다. 일괄 삭제는 단일 액션으로 엣지와 노드를 함께 제거한다.
- 엣지 실선/파선/점선, SmoothStep/Step/Straight, 색상 picker 및 #RRGGBB 입력, 채운/열린/없는 화살표. 기존 정방향/역방향/양방향·라벨·연결 면 유지.
- 선택을 그룹으로 감싸기, 영역 이름 예시, 그룹 소속 드롭다운, 자식 해제, 그룹 삭제 시 자식 절대 위치 유지, 부모 순환 방지, 부모 우선 정렬. 새 그룹의 제목 여백 88px 확보.
- 실제 크기를 기존 ELK/fallback에 전달하여 새 resize 기능과 정렬의 충돌을 줄임. 새 엔진/방향/그룹 내부 정렬은 도입하지 않음.

### 저장 호환성 / 결정

- URL의 n/e 구조와 압축/치환을 유지하고 엣지 c/k/q/u 선택 필드만 추가. JSON은 edge.data.lineStyle/pathStyle/color/arrowStyle을 보존한다. 기본값은 기존 실선/SmoothStep/노드 색상/채운 화살표다. 크기는 기존 w/h 및 style.width/height를 재사용한다.
- JSON 신규 enum/hex와 비정상 치수를 검사한다. 기존 양수 크기를 상한만으로 거부하지 않으며 resize UI에만 제한을 적용한다. 버전 체계/전체 URL 검증/해제 상한은 Phase 4에 남김.
- 상태 관리는 기존 Store, 좌표/복사/부모/정렬 연산만 graphEditing으로 분리. ADR-008/009 참조.

### 검증 결과

- `npm run check`: ESLint/strict TS/production build 통과, **5개 파일 63개 테스트 통과** (기존 37개 + 신규 26개).
- `npm run format:check`, `git diff --check`: 통과. 문서 갱신 후 포맷을 재확인한다.
- 회귀: 원자적 다중 삭제/Undo, 그룹·중첩 자식 복제/새 ID/내부 엣지/외부 부모 분리, 그룹 생성/순환/해제/삭제, 이동+포함 전환/resize/배치 이동 히스토리, 크기 제한/no-op, 일괄 속성/정렬/간격, 새 필드 두 형식 왕복과 legacy 데이터, 스타일/마커/잘못된 데이터, 단축키 입력 보호, 크기·스타일·일괄 Inspector, 실제 치수를 쓰는 ELK 입력.
- Chromium 1280×900 실제 UI: Ctrl/Shift 선택, 영역 선택(2개 노드), 공통 부제목 적용, 메뉴 복사/붙여넣기 8→11노드/7→9엣지 및 단일 Undo, 그룹 생성/제목/크기/자식 해제, 그룹 단독 삭제 후 9→8노드 보존.
- 그룹 모서리 드래그 832×360→924×452→Undo 832×360, 일반 노드 320×180→398×258→Undo 320×180 확인. 그룹 해제 전후 DOM 좌표가 동일함을 확인.
- 실제 Ctrl+A/D/Z 및 Delete: 9노드 전체 복제 18노드/14엣지→Undo 9/7, 다중 삭제 0/0→Undo 9/7 확인.
- 새로고침 후 파선/직선/열린 화살표/#38bdf8, 일반 크기 320×180, VPC 소속 복원. SVG의 실제 stroke/dasharray/marker/path도 확인.
- 390×844 속성 패널에서 문서 폭=viewport 폭=390px 확인, 임시 viewport는 복원. screenshots/phase3-selection.jpg, phase3-edge.jpg, phase3-group.jpg, phase3-mobile.jpg 저장.
- JS 약 1,946.69KB/gzip 605.55KB, CSS 52.53KB. 큰 chunk 경고 유지. 라이브러리 추가/업데이트 없음.

### 발견 사항 / 제한

- 직선 SVG g의 높이가 0이라 자동화 selector.click이 실패했다. DOM과 스크린샷으로 확인 후 실제 포인터 클릭은 정상임을 검증했다. 처음에는 그룹 배경 간섭으로 추정했으나 확정 원인은 자동화 선택 영역이었다. 별도로 그룹/노드/엣지 레이어 정책을 명시하고 부모 선택 자동 승격을 껐다.
- 자동화 도구가 Ctrl+C/V를 자체 가상 clipboard로 처리해 실제 키 경로 테스트를 중단했다. 메뉴를 통한 같은 액션은 실제 브라우저에서 확인했고 키 이벤트 경로는 통합 테스트로 검증했다. 실제 OS clipboard 사용 검증으로 표기하지 않는다.
- color picker의 자동화 fill이 React change를 재현하지 못해 텍스트 색상 코드와 적용 버튼도 제공했다. 해당 경로의 렌더링/저장과 picker의 change 핸들러 회귀를 확인한다.
- Vite HMR로 Store 모듈을 교체하면 메모리 그래프가 초기화되어 URL에서 새로고침 복원이 필요했다. production 새로고침은 정상 확인했으며 dev HMR 상태 보존은 별도 개선 후보로 남긴다.
- 그룹 내부 자동 정렬, 새 방향/간격 옵션, 데이터 버전/URL 보안 상한은 Phase 4 범위. 일반/그룹 resize가 항상 다른 노드와의 겹침을 자동 해소하지는 않는다.
- 실제 파일 다운로드, OS/브라우저별 단축키, 휴대폰 터치와 스크린리더, 대량 그래프 성능, 배포 검증은 후속 단계 대상이다.

### 변경 파일

- 핵심: src/store/useGraphStore.ts, src/utils/graphEditing.ts(신규), src/types/graph.ts, utils/urlUtils.ts, jsonUtils.ts, edgeUtils.ts.
- UI: src/App.tsx, components/ArchitectureCanvas.tsx, EditorToolbar.tsx, Inspector.tsx, Sidebar.tsx, CustomNodes/ArchitectureNodeCard.tsx, GroupNodeCard.tsx, CustomEdges/ArchitectureEdge.tsx, src/styles.css.
- 신규 UI: components/SelectionInspector.tsx, NodeGeometryEditor.tsx, EdgeStyleEditor.tsx.
- 회귀: src/store/phase3.test.ts(신규), src/App.test.tsx, src/components/editor.test.tsx.
- 문서: AGENTS.md, PROJECT.md, README.md, docs/PROGRESS.md, docs/DECISIONS.md, docs/screenshots/phase3-*.jpg.

## Phase 4 구현 및 검증 (2026-10-15)

### 실제 상태와 문서 비교

시작 시 Phase 3 파일들이 미커밋 상태였고 모두 보존했다. 실제 ELK는 최상위 일반 노드만 LR 배치, URL/JSON 버전과 해제 상한 없음, 매 렌더/Store 변경 압축 및 Import/새 문서 즉시 교체 상태였다. 문서의 Phase 4 미완료 항목과 일치했다.

### 구현 기능

- 정렬 설정: LR/TB/RL/BT, 계층·노드 간격 20–500px. ELK를 유지하고 중첩 그룹 내부부터 실제 치수로 배치/그룹 크기 재산정. 그룹 외부 엣지는 형제 계층에 투영한다. 순환/비연결, 엔진 실패 방향별 fallback, 오버플로 거부. 자동 핸들은 절대 중심, 수동 면/스타일 유지. 전체 정렬 한 번 Undo/Redo. 의미 있는 편집/Undo/새 요청/진행 중 변환 후 오래된 결과 폐기.
- 데이터 버전: URL v:1과 JSON version:1, 버전 생략 legacy와 기존 edge.label 지원. 고정 fixture 추가. 공통 schema로 kind/category/enum/hex/유한값, 중복/참조/부모 순환/깊이를 검사하고 원자적 복원.
- 자원 상한: 노드 1,000/연결 5,000/문자열 10,000자/부모 32단계, JSON·해제 결과 5 MiB, 압축 hash 1 MiB. 16 KiB Inflate 청크에서 상한 검사. 파일 크기는 읽기 전/UTF-8 결과 양쪽 검사.
- URL: 8,000자 경고/64,000자 자동 기록·공유 복사 중단/JSON 안내. 선택·측정·드래그 중 압축 생략, 편집 완료 400ms debounce, Import 즉시 반영, StrictMode hydration 보호. hashchange 검증·작업 교체 확인·취소/오류 시 현재 주소 보존. 미저장 이탈 경고 요청.
- 작업 보호: 새 문서/샘플/JSON/외부 hash 적용 시 기존 그래프가 있으면 확인창, 취소 및 교체 Undo. 비동기 파일 읽기 중 작업 변경/이전 요청은 적용하지 않음. JSON 오류 사유 안내. JSON export version 필드를 실제 버튼 경로의 테스트로 확인.
- 테스트 중 JSON 다운로드용 MouseEvent의 jsdom window 변환 실패를 발견하여 표준 anchor.click()으로 수정했다. 현재 데이터와 JSON 링크 생성/취소 가능한 클릭 경로를 검증한다.

### 검증 결과

- 자동화: 6개 파일 **101개 테스트 통과** (Phase 3의 63개 + 38개). `npm run check`의 ESLint/strict TS/production build 통과. `npm run format:check`, `git diff --check` 통과.
- 고정 legacy fixture 두 형식, version 1 및 미지원 버전, 잘린/잘못된 URL·압축 폭탄·개수/문자/깊이 제한, 상세 필드 오류, 그룹/수동 연결 저장 왕복.
- 네 방향 실제 ELK: 크기 700px 노드, 중첩 그룹, 순환, 비연결, 부모 경계와 형제 비중첩. 방향/200px 간격 검증. 엔진 강제 실패 fallback/수동 면 보존. 단일 Undo/Redo와 편집+Undo 경쟁, 선택만 바뀐 요청 적용.
- App: StrictMode, 선택·측정·드래그 압축 호출 0회/완료 1회, debounce·즉시 Import·Undo, 잘못된 외부 hash/취소/승인/대기 편집 보존, 대용량 파일 읽기 전 거부, 파일 읽기 경쟁, URL 경고·저장 중단·미저장 이탈, version 1 JSON 생성.
- 실제 Chromium 1440×960: 기존 9노드/7연결 VPC를 TB/100/80 정렬하여 자식 배치와 그룹 크기 확인. Undo/Redo 전후 모든 노드 DOM transform/style 동일 확인. RL 배치, 새 문서 교체 확인창과 취소 확인. version 1 URL 새로고침 복원. screenshots/phase4-layout.jpg, phase4-protection.jpg 저장.
- 390×844에서 정렬 설정과 문서 폭 390px 확인. 첫 번째 행 메뉴가 다음 행 버튼 뒤에 보이는 문제를 발견하여 열린 메뉴의 z-index를 보완하고 브라우저에서 재확인했다. screenshots/phase4-mobile.jpg 저장 후 임시 viewport를 복원했다.
- JSON 다운로드 버튼은 성공 안내를 표시하지만 자동화 download 이벤트는 두 번 타임아웃되어 실제 파일 저장은 미확인이다. 단위/통합 테스트는 생성 JSON 내용과 version을 검증한다. 다운로드 성공으로 표기하지 않는다.
- 빌드 JS 약 1,956.27KB/gzip 608.86KB, CSS 약 52.89KB. 기존 큰 chunk 경고 유지. 패키지/lock 변경 없음.

### 남은 문제와 범위

- ELK의 형제 순서를 활용하지만 렌더 경로의 모든 노드 우회/교차 제거는 보장하지 않는다. 매우 큰 그룹은 UI resize 8000px보다 커질 수 있다. legacy 양수 치수/정렬 결과는 보존하고 사용자 resize에 UI 제한을 적용한다.
- 입력 상한은 성능 보장이 아니다. 10/50/100/300 실측, 대량 ELK 취소/Worker 및 번들 분리는 Phase 6에서 측정 후 결정한다. 현재 비동기 stale 결과는 폐기하지만 엔진 계산 자체를 중단하지 않는다.
- 입력 상한보다 큰 그래프도 JSON 백업은 허용한다. 재가져오기에는 분할/축소가 필요하다. 작업은 서버/localStorage에 자동 백업하지 않는다.
- Vite Store HMR 초기화, 실제 파일 다운로드·모바일 터치·다른 브라우저·스크린리더·배포 검증과 기존 Tailwind 도구 보안 경고는 남는다. production 새로고침 복원과 개발 HMR은 구분한다.

### 변경 파일 (Phase 4)

- 핵심: src/utils/layoutGraph.ts(신규), graphValidation.ts(신규), jsonUtils.ts, urlUtils.ts, types/graph.ts, store/useGraphStore.ts.
- UI/저장: src/hooks/useGraphPersistence.ts(신규), components/LayoutSettings.tsx(신규), ReplaceGraphDialog.tsx(신규), EditorToolbar.tsx, App.tsx, styles.css.
- 회귀: src/utils/phase4.test.ts(신규), src/test/fixtures/legacy-graph.json 및 legacy-hash.txt(신규), src/App.test.tsx.
- 문서/근거: AGENTS.md, PROJECT.md, README.md, docs/PROGRESS.md, docs/DECISIONS.md, docs/screenshots/phase4-*.jpg.

## 다음 작업 — Phase 5

기존 자산을 보존하면서 데이터 기반 자산 확장, 라이선스 확인, 즐겨찾기/최근 사용, 전체 영역 PNG 및 배율/배경/메모리 상한, 이후 SVG/PDF를 단계적으로 구현한다. 현재 Phase에서는 착수하지 않았다.

## 전체 단계

Phase 0 분석/문서 완료 → Phase 1 안정화/검증 기반 완료 → Phase 2 UI 완료 → Phase 3 편집 확장/명시 범위 검증 완료 → Phase 4 정렬/데이터·명시 범위 검증 완료 → Phase 5 자산/출력 대기 → Phase 6 성능/E2E 대기 → Phase 7 문서/배포 검증 대기.
