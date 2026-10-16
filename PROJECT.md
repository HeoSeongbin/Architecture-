# Architecture Diagram Editor 고도화 명세

## 목적과 범위

기존 Serverless Architecture Diagram Editor를 개발자 포트폴리오에 공개할 수 있는 아키텍처 편집기로 점진적으로 개선한다. 시스템·서버·DB·네트워크·클라우드를 브라우저에서 설계하고 URL/파일로 공유한다. 백엔드, 계정, 서버 저장소를 추가하지 않는다. Phase 0–6을 진행했으며 현재 구현/검증 상태와 다음 실행 범위는 진행 문서를 따른다. 완료/검증 상태와 다음 단계는 docs/PROGRESS.md를 기준으로 한다.

## 기준 아키텍처와 현재 구현

- React + TypeScript(strict) + Vite + Tailwind CSS, lucide-react.
- React Flow의 커스텀 노드/엣지와 parentId 그룹, Zustand 단일 Store.
- pako DEFLATE + base-64의 URL hash 직렬화, 400ms debounce + history.replaceState.
- ELK.js layered 자동 정렬 및 자체 fallback. html-to-image의 PNG 출력.
- 자산 검색/드래그, Inspector, 복제/삭제, 80단계 Undo/Redo, 샘플, JSON 입출력, URL 복원, Grid/MiniMap/Controls가 구현되어 있다.
- 그룹 크기 변경, 자동 그룹 포함/해제, 엣지 방향/라벨 모드/방향/위치/연결 면 편집도 구현되어 있다. 실제 검증 수준은 docs/PROGRESS.md를 참조한다.
- Phase 2에서 한국어 UI, 테마 설정, 반응형 패널, 파일/보기/배치 메뉴, 클릭 추가와 카테고리 접기, 작업 결과 안내를 구현했다. 테마는 localStorage의 UI 설정이며 그래프 저장 형식에는 포함되지 않는다.
- Phase 3에서 다중 선택·일괄 속성·정렬/간격, 내부 클립보드와 단축키, 일반/그룹 노드 크기, 연결선 스타일, 그룹 생성/소속 관리와 편집 트랜잭션을 구현했다. 실제 검증 범위는 PROGRESS.md를 따른다.

## 구조와 책임

`App.tsx`는 초기 복원·URL 동기화·단축키·파일 입출력과 헤더를 담당한다. `ArchitectureCanvas`는 React Flow 이벤트를, `Sidebar`는 자산을, `Inspector`는 속성 편집을 담당한다. `useGraphStore`는 그래프·선택·히스토리·그룹·정렬을 관리한다. `urlUtils`/`jsonUtils`는 저장 형식, `edgeUtils`는 표시용 파생값을 담당한다. `data`는 자산/샘플, `types`는 데이터 계약이다.

기능 추가 시 UI와 핵심 로직을 분리하되 무분별하게 Store를 나누지 않는다. Graph/Selection/History/UI/Export/Share의 책임을 논리적으로 분리하고 실제 복잡도에 따라 모듈을 추출한다.

## 데이터 저장과 호환성

- URL 흐름: Graph → 짧은 키 JSON → DEFLATE → Base64 → `+/-`, `//_`, `=/~` 치환 → hash. 서버 영구 저장으로 표현하지 않는다.
- 기존 `{n,e}`를 유지한다. 노드는 i/t/p/d 및 선택적 g/e/w/h, 엣지는 i/s/t/l 및 방향·라벨·핸들·오프셋 필드를 사용한다. 필드 생략 시 기존 기본값으로 복원한다.
- Phase 3 엣지 선택 필드 c/k/q/u는 색상/선 종류/경로/화살표다. 생략하면 기존 노드 색상/실선/SmoothStep/채운 화살표로 동작한다. 버전 필드/마이그레이션은 Phase 4에서 도입했다(아래 구현 계약 참조).
- JSON은 기존 `{nodes,edges}` 및 구형 최상위 edge.label을 읽는다. Import는 원자적으로 검증하여 중복 ID, 잘못된 참조, 비정상 좌표, 부모 순환을 거부한다.
- Phase 4에서 버전 필드/마이그레이션, 미지원 버전 오류, 구버전 고정 fixture, 상세 오류 사유, 노드/엣지/파일 크기 제한과 스트리밍 압축 해제 상한을 구현했다.
- URL 길이를 감지하고 공유가 어려운 크기에는 JSON 백업을 안내한다. 복원 실패·Import·새 문서·초기화 시 작업 유실을 방지한다.
- URL 동기화는 드래그/선택에 불필요한 압축을 줄이고 Import·Undo/Redo 후 반영한다. 초기 hydration/StrictMode 경쟁과 잘못된 URL 반복을 방지한다. 외부 hashchange 정책을 명시하고 테스트한다.

## UI/UX 요구사항 (Phase 2)

한국어 기본, Dark/Light, 일관된 색상·버튼·아이콘, 명확한 선택과 피드백, 충분한 캔버스, 최소 애니메이션, 반응형과 키보드 접근성을 제공한다. 기존 편집기 제품은 정보 구조만 참고한다.

- Toolbar: 새 문서, Undo/Redo, Sample, Layout, Fit View/Zoom, 링크 복사, Import/Export/PNG, Clear, Theme. 기능별 그룹과 좁은 화면 메뉴.
- Sidebar: 검색/분류/접기, 드래그와 클릭 추가, 아이콘/설명 툴팁, 즐겨찾기와 최근 사용.
- Canvas: Grid/MiniMap/Controls, 선택·이동·연결·다중 선택·그룹, 복사/붙여넣기, 정렬/간격 조절.
- Inspector: Label/Subtitle/Note/Accent/크기/복제/삭제와 필요 시 자산 변경. 엣지 라벨·선 종류·색·화살표. 그룹 제목·색·크기·포함 노드. 무선택 시 도움말/정보.

이 목록은 최종 UI 요구사항이다. Phase 2는 기존 기능의 UI와 클릭 추가/분류 접기/테마/반응형에 집중한다. 노드 크기·일괄 편집·복사/붙여넣기·새 엣지 스타일·그룹 관리는 Phase 3, 즐겨찾기/최근 사용은 Phase 5에서 구현한다.

## 편집 요구사항 (Phase 3)

- Ctrl/Shift 및 영역 다중 선택, 일괄 이동/삭제/공통 속성/정렬/간격.
- Ctrl/Cmd+C/V/D/A, Delete/Backspace. 입력 중에는 브라우저 텍스트 동작 보존. 복제 시 새 ID, 선택 내부 연결과 그룹 참조 재매핑.
- 노드 드래그/Inspector 크기 조절, 최소/최대 크기, Undo/Redo 및 JSON/URL. 구버전 기본 크기 보존.
- 엣지 Solid/Dashed/Dotted와 Straight/Step/SmoothStep, 색상/화살표/라벨 편집.
- VPC/Subnet/DMZ/Internal/Production/Development/DB/Application 영역 생성·이동·크기·제목·색·포함 관리. 그룹 삭제는 자식 보존과 절대 위치 유지 정책을 따른다.

## 정렬과 데이터 관리 (Phase 4)

ELK를 우선 유지하고 LR/TB/RL/BT 방향, 간격과 실제 노드 크기, 그룹, 순환·비연결 그래프를 처리한다. 노드 겹침과 엣지 교차를 줄인다. 비동기 결과가 최신 편집을 덮어쓰지 않아야 한다. 정렬은 Undo/Redo 가능해야 한다. Dagre/자체 알고리즘 대비 변경 근거와 회귀 사례를 기록한다. 위 데이터 검증·버전·용량 요구사항을 완성한다.

## 자산과 출력 (Phase 5)

기존 20개 자산과 그룹을 보존하고 데이터 중심으로 확장한다. 후보는 MySQL/SQLite/Valkey/Elasticsearch, Kubernetes/Linux/Windows/Docker Compose/Reverse Proxy/API Gateway, RabbitMQ/Kafka/Redis Streams/Broker, FastAPI/.NET/Next.js/Vue/Java, AWS EC2/S3/RDS/Lambda/VPC/SQS, Azure VM/Storage, Google Compute다. 한 번에 모두 구현하지 않고 필요에 따라 선택한다. 아이콘 출처와 라이선스를 확인한다. 즐겨찾기/최근 사용을 제공한다.

PNG는 현재 영역과 전체 영역, 배율/배경/투명/고해상도, 메모리 상한과 실패 안내를 제공한다. 텍스트·노드·아이콘·연결선이 잘리지 않는지 확인한 후 SVG/PDF를 단계적으로 추가한다.

## 품질·성능 기준 (Phase 1, 6)

- ESLint/Prettier, Vitest/Testing Library, strict TypeScript와 production build를 통과한다. 브라우저 E2E는 Playwright 도입 가능성과 실행 환경을 확인한 뒤 확장한다.
- Store: 추가/삭제/이동/복제/연결/선택/다중 선택/그룹/정렬/히스토리 회귀.
- URL: 빈 값/손상/기존 형식/한글/특수문자/대형 그래프와 압축 상한. JSON: 필수 필드/중복/참조/이전 버전/왕복.
- UI: 드래그·선택·Inspector·단축키·테마. 출력: PNG 파일 생성/전체 범위/오류, 후속 SVG/PDF.
- 10/50/100/300개 노드와 복잡한 연결에서 드래그·선택·정렬·입출력·URL의 시간/메모리를 측정한다. 측정 환경과 결과를 기록한 후 성능 목표를 수치로 확정한다. 현재 300개 직렬화 테스트는 성능 검증이 아니다.
- Selector/memo/압축 빈도/드래그 이벤트/정렬 비용/이미지 메모리는 측정된 병목부터 개선한다. 측정 없이 개선 완료로 표시하지 않는다.

## 단계와 완료 조건

| Phase | 작업                                                   | 완료 조건                             |
| ----- | ------------------------------------------------------ | ------------------------------------- |
| 0     | 코드/README/Git/의존성 분석, 관리 문서와 부채 목록     | 현재 상태와 목표 문서화               |
| 1     | 코드 안정화, TS/ESLint/Prettier/Vitest, 핵심 회귀      | 기존 기능 보존 및 검증 환경 구축      |
| 2     | 한국어 UI, Toolbar/Sidebar/Inspector/노드, 테마/반응형 | 편집 유지 및 UI 통합 검증             |
| 3     | 다중 선택/복사/단축키/크기/엣지/그룹                   | Undo/Redo와 저장 왕복 검증            |
| 4     | 정렬 방향/그룹/데이터 버전/호환/검증/용량              | 복잡한 그래프 편집·저장 안정성        |
| 5     | 자산/즐겨찾기/최근/PNG/SVG/PDF                         | 설계와 외부 공유 기능 검증            |
| 6     | 대량 성능/렌더링/직렬화/브라우저/접근성                | 측정과 핵심 시나리오·테스트 통과      |
| 7     | 사용법/스크린샷/아키텍처/Actions/Pages/소개            | 배포 환경에서 편집·공유·다운로드 확인 |

## 배포 전략과 최종 완료

GitHub Pages 정적 배포, 현재 Vite base `/Architecture-/`와 hash 공유를 유지한다. 기존 `.github/workflows/deploy.yml`은 npm install → build → Pages 배포만 수행한다. Phase 7에 npm ci → lint → test → typecheck/build → Pages 업로드/배포로 개선한다. 저장소 권한/Pages 설정과 실제 배포 URL을 확인한다. 편집, 복사 링크 재접속, JSON/PNG, 정렬, Undo/Redo를 배포 환경에서 검증해야 완료다. 현재 배포 상태는 미확인이다.

최종적으로 전체 Phase의 검증 근거, 사용자 문서/화면 예시, 포트폴리오 소개, 알려진 제한을 공개한다. 테스트하지 않은 기능이나 원격 배포를 성공 처리하지 않는다.

Phase 7에서 아키텍처/운영·복구/소개 문서를 docs/ARCHITECTURE.md, DEPLOYMENT.md, SHOWCASE.md로 제공한다. CI는 main push/수동 배포와 main PR 검사를 구분하며 npm ci→lint→test→format→build gate를 사용한다. 실제 배포본과 새 workflow 실행 결과는 PROGRESS의 Phase7을 따른다. JSON 저장은 v1 payload를 Blob URL로 제공하고 마지막 생성본의 재시도 링크를 유지한다. 저장 형식/URL 압축은 그대로다.

## Phase 4 구현 계약 (2026-10-15)

URL `{v:1,n,e}` / JSON `{version:1,nodes,edges}`를 쓰며 버전 생략은 legacy로 읽는다. node 1,000 / edge 5,000 / 문자열 10,000자 / 부모 32단계 / JSON·해제 데이터 5 MiB / 압축 hash 입력 1 MiB 제한. 전체 공유 URL 8,000자 경고, 64,000자 자동 저장·복사 중단 및 JSON 안내. 기존 DEFLATE/Base64 치환과 선택 필드 유지. ADR-010–012와 PROGRESS의 Phase 4 검증/제한을 따른다.

## Phase 5 구현 계약 (2026-10-16)

기존 자산 20개+그룹을 유지하고 대표 12개를 추가했다. 종류 목록을 type/검증에서 공유하며 기존 URL/JSON v1을 유지한다. 브라우저 설정에 즐겨찾기와 최근 8종류를 저장하고 그래프/히스토리에는 넣지 않는다. 새 종류가 포함된 데이터는 Phase 5 이상 앱에서 읽는다.

PNG/SVG/PDF는 전체/현재 영역, PNG/PDF 배율 1–4, 테마/흰색/어두운색/투명(PDF 흰색) 배경을 제공한다. 한 변 8192px/16,777,216픽셀 상한이며 실제 메모리 성능 보장은 아니다. SVG는 HTML foreignObject 기반, PDF는 단일 이미지 페이지다. 완전한 편집용 SVG/검색 가능한 PDF/다중 페이지는 후속 후보이며 현재 지원으로 표시하지 않는다. ADR-013/014와 PROGRESS의 검증·제한을 따른다.

## Phase 6 구현 계약 (2026-10-16)

10/50/100/300 chain/dense의 core/production 브라우저 측정과 원자료는 docs/benchmarks에 보존한다. 수치 목표와 실패 사례도 해당 보고서를 기준으로 한다. 정렬은 지연 로드하는 ELK classic Worker에서 실행하며 취소 시 Worker를 종료한다. 오류/30초 timeout 후 다시 시작할 수 있고 취소는 그래프/Undo를 변경하지 않는다. Worker 없는 환경은 지연 bundled fallback을 사용한다.

드래그·선택 중 불필요한 참조 변경/직렬화를 줄이고 출력 CSS 복사와 화면 밖 clone을 제한한다. 200개 초과 연결은 표시 애니메이션만 중단한다. URL/JSON v1 및 압축 형식은 유지한다. 명칭·한국어 키보드 안내·테마 토큰 대비와 Chromium 핵심 흐름을 확인한다. 다른 브라우저/스크린리더/터치/배포와 간헐적인 전체 PNG 지연은 미완료 검증으로 구분한다. 모든 상황의 60fps나 시간/메모리 상한을 보장하지 않는다.
