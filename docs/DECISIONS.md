# 기술 결정

## ADR-001 — 기존 아키텍처와 데이터 형식 보존

- 날짜: 2026-10-15
- 문제: 고도화 중 기존 URL/JSON과 편집 동작 회귀 위험.
- 대안: 새 템플릿/Store 분할/새 저장 포맷 또는 기존 구조의 점진적 개선.
- 결정: React Flow + Zustand 단일 Store, DEFLATE/Base64 hash와 JSON 구조를 유지한다. Phase 1에서는 테스트와 오류 수정에 집중한다.
- 이유/영향: 호환성을 보호하고 검증 단위를 작게 유지한다. 버전/압축 상한은 Phase 4에서 설계한다.
- 호환성: 기존 선택 필드는 기본값을 유지한다. legacy URL과 JSON edge.label 회귀 테스트를 추가한다.
- 관련: PROJECT.md, src/utils/serialization.test.ts, src/types/graph.ts.

## ADR-002 — 테스트와 개발 도구

- 날짜: 2026-10-15
- 문제: 기존 저장소는 build 외 lint/test 명령이 없었다.
- 대안: Jest 또는 Vite와 연결되는 Vitest; 실제 브라우저 E2E 우선 또는 핵심 로직/컴포넌트 우선.
- 결정: Vitest/jsdom, Testing Library, ESLint flat config와 TypeScript/React hooks 규칙, Prettier를 도입한다. 기존 strict TS를 유지한다. 의존성 직접 버전을 설치된 값으로 고정한다.
- 이유/영향: 기존 Vite/TS 구조에 적합하고 순수 로직과 Inspector/Sidebar/App 이벤트를 빠르게 검증한다. 기하와 다운로드는 jsdom으로 검증했다고 주장하지 않는다.
- 호환성: 런타임 데이터 계약은 바꾸지 않는다. lock 파일을 유지하고 npm ci 재현성을 확인한다.
- 관련: package.json, eslint.config.js, vitest.config.ts, src/test/setup.ts.

## ADR-003 — 히스토리와 비동기 정렬 보호

- 날짜: 2026-10-15
- 문제: 드래그 종료 시점의 좌표를 저장하여 Undo가 원위치로 복원되지 않으며 ELK 대기 중 편집이 덮어써질 수 있다.
- 대안: 드래그 전체 이벤트를 기록하거나 시작 스냅샷 하나를 기록; 정렬 중 잠금 또는 오래된 결과 폐기.
- 결정: 첫 dragging 이벤트 이전 스냅샷으로 종료 히스토리를 생성한다. ELK 요청 이후 노드/엣지 참조가 달라지면 성공/실패 결과 모두 폐기한다. 교체/Undo/Redo 시 이동 스냅샷을 초기화한다.
- 이유/영향: 80단계 정책을 보존하면서 편집을 잠그지 않는다. 측정/선택 이벤트만 있어도 정렬이 폐기될 수 있는 보수적 정책이다.
- 호환성: 저장 형식 변경 없음. 그룹 포함 전환과 크기 변경 히스토리는 후속 회귀 확장 대상이다.
- 관련: src/store/useGraphStore.ts, src/store/useGraphStore.test.ts.

## ADR-004 — JSON 원자적 검증과 그룹 삭제 정책

- 날짜: 2026-10-15
- 문제: 잘못된 항목을 filter로 버리고 성공 처리하면 사용자 데이터가 조용히 손실된다. 잘못된 parentId는 재귀 계산 오류를 유발한다.
- 대안: 일부 복원 후 경고 또는 전체 거부.
- 결정: 필수 데이터, 좌표, 중복 ID, 노드 참조, 부모 존재/그룹 타입/순환을 검증하고 오류 시 null을 반환한다. App은 교체 전 실패하므로 기존 작업을 유지한다. 키보드 그룹 삭제도 Inspector 삭제와 같이 자식을 보존하고 절대 좌표로 변환한다.
- 이유/영향: 손상을 조용히 성공 처리하지 않는다. 오류 상세와 파일 제한은 Phase 4 범위다.
- 호환성: 정상 기존 JSON은 유지하고 최상위 edge.label도 수용한다. 예전의 부분 수용 동작은 의도적으로 전체 거부로 바뀐다.
- 관련: src/utils/jsonUtils.ts, src/utils/serialization.test.ts, src/store/useGraphStore.ts.

## ADR-005 — 기존 ELK와 Tailwind 유지

- 날짜: 2026-10-15
- 문제: README는 자체 정렬로 설명하지만 코드는 ELK를 사용하며, 의존성 감사에서 Tailwind 3 전이 의존성 경고가 나온다.
- 대안: Dagre로 교체/ELK 유지, Tailwind 4 즉시 이전/별도 이전.
- 결정: ELK layered와 fallback을 유지하고 그룹/방향/크기 개선은 Phase 4에서 검증한다. 호환 범위 audit fix만 적용하고 Tailwind major 이전은 별도 검토한다.
- 이유/영향: 대규모 CSS/정렬 재작성으로 기존 동작을 훼손하지 않는다. 알려진 빌드 도구 취약점은 잔여 위험으로 기록한다.
- 호환성: UI/URL/JSON 계약 보존. 강제 보안 업데이트는 실행하지 않는다.
- 관련: docs/PROGRESS.md, package-lock.json, src/store/useGraphStore.ts.

## ADR-006 — 테마와 반응형 UI를 그래프 데이터에서 분리

- 날짜: 2026-10-15
- 문제: 테마/패널 변경이 공유 링크와 Undo/Redo 데이터에 섞이면 기존 URL과 JSON의 계약이 달라진다.
- 대안: Zustand 그래프 Store에 UI 필드 추가, 별도 전역 Store 추가, 지역 상태와 전용 hook.
- 결정: App의 지역 상태와 useEditorTheme/useNarrowScreen을 사용한다. 테마는 `architecture-editor-theme` 키에 저장하고 첫 방문에는 시스템 테마를 읽는다. storage 접근이 막혀도 메모리 상태로 동작한다. CSS 토큰을 기존 컴포넌트와 React Flow에 적용한다.
- 이유/영향: 새로운 Store나 데이터 버전을 도입하지 않는다. 테마 변경은 그래프 히스토리를 생성하지 않고, URL/JSON에는 테마와 패널 상태가 들어가지 않는다. PNG 배경은 현재 테마에 맞춘다.
- 호환성: urlUtils/jsonUtils/types의 저장 계약은 변경하지 않았다. 기존 직렬화 회귀와 테마 전환 시 그래프·hash 불변 테스트로 확인한다.
- 관련: src/hooks, src/styles.css, src/App.tsx, src/App.test.tsx.

## ADR-007 — 기존 편집 이벤트를 활용한 Phase 2 UI

- 날짜: 2026-10-15
- 문제: 좁은 화면에서 양쪽 패널과 많은 툴바 버튼이 작업 공간을 차지한다. 기존 자산 버튼은 키보드 클릭으로 추가할 수 없었다.
- 대안: 새로운 UI 프레임워크/모달 메뉴 또는 기존 버튼·native details와 반응형 패널.
- 결정: EditorToolbar를 추출하고 파일/보기 메뉴와 모바일 배치 메뉴를 native details로 구성한다. 900px 이하는 한 번에 하나의 비모달 패널을 열며 Escape/닫기로 복귀한다. hidden 패널은 탭 이동에서도 제외한다. 화면 중앙 클릭 추가는 React Flow screenToFlowPosition과 기존 addNode 액션을 재사용한다.
- 이유/영향: 기존 드래그와 선택 이벤트를 보존하고 키보드 사용 경로를 제공한다. 클릭 추가 후 모바일 패널을 닫는다. Fit View를 위해 minZoom을 0.1로 낮추며 사용자 viewport를 화면 크기 변경만으로 자동 리셋하지 않는다.
- 호환성: 추가 노드의 ID/kind/category와 그룹 크기/parentId 형식은 기존 계약을 따른다. addNode는 기존 선택을 해제하고 새 노드를 selected로 표시하도록 보완했다. 이는 Inspector 선택 ID와 React Flow 선택 상태의 불일치 수정이며 Undo 한 단계 정책을 유지한다.
- 관련: src/components/EditorToolbar.tsx, Sidebar.tsx, ArchitectureCanvas.tsx, src/store/useGraphStore.ts.

## ADR-008 — 선택과 내부 클립보드, 편집 트랜잭션

- 날짜: 2026-10-15
- 문제: 단일 선택 ID만으로는 다중 복제/삭제를 원자적으로 처리할 수 없고, 그룹 드래그와 크기 변경은 여러 이벤트로 쪼개진다.
- 대안: 새 상태 관리 라이브러리/OS 클립보드 직렬화, 기존 Zustand와 React Flow 선택 및 지역 클립보드 활용.
- 결정: nodes/edges의 selected를 다중 선택의 기준으로 사용하고 단일 ID는 Inspector 호환용으로 유지한다. copySubgraph/pasteSubgraph/정렬/부모 변환을 graphEditing 순수 함수로 분리한다. 클립보드는 Store의 메모리 상태이며 같은 페이지 내 편집/새 문서에 사용할 수 있다. OS clipboard와 공유 데이터에는 쓰지 않는다.
- 이유/영향: 권한 없이 복사/붙여넣기 가능하며 내부 엣지와 그룹의 암묵적 자식을 함께 복제한다. UUID/parentId/edge endpoint를 재매핑하고, 원본 그룹 없이 복사한 자식은 절대 좌표로 분리한다. 붙여넣기 선택은 복제한 루트만 활성화해 부모/자식 중복 이동을 피한다.
- 히스토리: 첫 이동/resize 전 snapshot 하나를 잡고 마지막 이벤트에서 commit한다. 드래그에 따른 그룹 전환도 같은 commit에 포함한다. 일괄 삭제/속성/정렬/간격/그룹 생성은 한 단계이며 측정·선택·무변경 작업은 기록하지 않는다. 기존 80단계 정책을 유지한다.
- 호환성: 클립보드/선택은 URL/JSON 스키마를 변경하지 않는다. 기존 단일 노드 복제도 동일한 서브그래프 로직을 재사용한다.
- 관련: src/store/useGraphStore.ts, src/utils/graphEditing.ts, src/store/phase3.test.ts, src/App.test.tsx.

## ADR-009 — 크기 및 연결선 스타일의 선택 필드 확장

- 날짜: 2026-10-15
- 문제: 새 크기와 엣지 UI를 저장하고 구버전 다이어그램도 읽어야 한다.
- 대안: 새 포맷 전환 또는 기존 선택 필드 확장.
- 결정: 기존 노드 w/h와 JSON style.width/height를 재사용한다. 엣지 data에 lineStyle/pathStyle/color/arrowStyle을 추가하고 URL에서는 k/q/c/u 선택 키로 저장한다. 기존 방향/핸들/라벨 필드는 유지한다.
- 이유/영향: 기본 실선/SmoothStep/노드 색상/채운 화살표는 생략 가능하다. 신규 선택 필드가 없는 이전 URL/JSON은 기존 모습으로 복원한다. 새 JSON 필드의 enum/hex와 유한 양수 치수를 검증한다. 기존 앱은 새 필드를 무시할 수 있으나 새 스타일 보존은 보장하지 않는다.
- 크기 정책: 일반 160×112–800×600, 그룹 280×180–8000×8000. 기존 파일의 양수 치수는 상한 때문에 거부하지 않으며 사용자가 다시 resize할 때 한도를 적용한다. 새 그룹은 제목 여백 88px을 확보한다.
- 렌더링: 그룹 0/일반 노드 2, 엣지 기본 1로 파생 zIndex를 지정하고 선택한 부모의 자동 승격을 끈다. React Flow가 내부 엣지를 추가 승격할 수 있다. 저장 데이터에 이 레이어 정책을 넣지 않는다.
- 연관 수정: 기존 ELK 및 fallback은 새 노드의 실제 크기를 입력받도록 조정한다. 엔진/방향/그룹 정렬 개선은 Phase 4에 유지한다.
- 호환성: 이전 기본값/한글/300노드/그룹·수동 엣지 회귀와 새 스타일·크기·부모 관계의 두 형식 왕복 테스트를 통과한다. 포맷 버전과 압축 상한은 Phase 4에서 별도로 설계한다.
- 관련: src/types/graph.ts, src/utils/urlUtils.ts, jsonUtils.ts, edgeUtils.ts, CustomEdges/ArchitectureEdge.tsx, NodeGeometryEditor.tsx.

## ADR-010 — 버전과 입력 상한, legacy 마이그레이션

- 날짜: 2026-10-15
- 결정: URL은 v:1을 n/e에 추가, 파일 내보내기는 version:1을 nodes/edges에 추가한다. 버전 생략은 legacy이며 기존 기본값과 edge.label을 정규화한다. 미지원 버전은 명시적 오류로 거부한다. Store/히스토리용 toExportableGraph는 그래프만 반환하고 파일 경계에서 버전을 붙인다.
- 검증: 두 입력 경로가 parseImportedGraph/graphValidation을 공유하고 URL 축약 enum도 확장 전에 검사한다. 필드 경로 또는 참조/부모 오류를 사용자에게 표시한다. 부모는 렌더 전에 우선 정렬한다. 잘못된 일부 항목을 버리는 부분 Import는 허용하지 않는다.
- 제한: 노드 1,000 / 연결 5,000 / 문자열 10,000자 / 부모 깊이 32. JSON 파일 및 UTF-8 해제 결과 5 MiB, 압축 URL 문자 1 MiB. pako Inflate onData에서 16 KiB마다 누적 검사하여 전체 결과를 먼저 할당하지 않는다. 실제 안전 성능 목표가 아닌 입력 자원 상한이며 Phase 6 벤치마크로 조정한다.
- 호환성: 압축·Base64 치환·n/e·선택 필드는 그대로다. 버전 없는 유효한 기존 링크/파일은 복원한다. 잘못된 enum/색/참조나 상한 초과는 이전 앱이 관대하게 읽었더라도 거부한다. 양수 legacy 크기에 UI resize 상한을 소급하지 않는다. 고정 JSON/hash fixture를 보존한다.

## ADR-011 — 계층별 ELK 유지와 그룹 배치

- 날짜: 2026-10-15
- 대안: Dagre 신규 도입, 자체 전체 배치, ELK compound graph, 기존 ELK layered를 계층별 적용.
- 결정: ELK 유지, 그룹 내부부터 배치하고 실제 자식 bounding box에 제목 88px/측면·하단 32px 여백을 적용한다. 각 계층에서 하위 노드 사이 연결을 해당 형제 그룹으로 투영하여 외부 연결도 순서 결정에 반영한다. LR/TB/RL/BT, 계층/노드 간격 20–500px, 기본 LR/130/70을 제공한다.
- 이유: 새 의존성 없이 순환·비연결 그래프와 실제 치수를 처리하며 React Flow parentId/상대 좌표를 보존한다. Dagre로 변경할 근거가 없고 자체 배치는 교차 최소화 기능을 잃는다. compound 경로와 UI 수동 핸들 좌표의 결합 대신 계층별 배치를 선택한다.
- 실패 정책: 해당 계층 ELK 실패 시 같은 방향·실제 크기의 일렬 배치로 겹침을 방지하고 사용자에게 fallback을 알린다. 좌표 오버플로는 적용하지 않는다. fallback은 의미 계층보다 안전한 비중첩 배치를 우선한다.
- 연결선: 기존 생성 routePoints는 제거하고 절대 중심 좌표로 자동 핸들을 지정한다. 수동 면/스타일은 보존한다. 렌더러의 경로가 모든 노드를 우회하거나 교차를 없애는 것은 보장하지 않는다.
- 경쟁/히스토리: 요청 번호, 영속 그래프 signature, past 참조 및 진행 중 변환으로 오래된 결과를 폐기한다. 선택/측정만 바뀌면 허용한다. 배치+그룹 치수 변경은 한 번 commit하여 Undo/Redo한다.

## ADR-012 — URL 동기화 및 작업 교체 보호

- 날짜: 2026-10-15
- 결정: useGraphPersistence로 초기 복원/구독/오류를 분리한다. StrictMode에서도 초기 복원은 한 번, 영속 필드 signature가 바뀐 경우에만 편집 완료 후 400ms 압축한다. 선택/측정/드래그 중간에는 압축하지 않으며 Import/교체 적용은 즉시 기록한다. replaceState를 유지한다.
- 용량: 전체 URL 8,000자부터 경고, 64,000자 초과는 마지막 주소와 현재 그래프를 보존하고 자동 기록/링크 복사를 중단한다. JSON 백업을 안내한다. 미기록 변경이 있으면 beforeunload 경고를 요청한다. 이는 서버 백업이나 브라우저별 주소 길이 보장이 아니다.
- 외부 hashchange: 검증 후 현재 주소를 복구하고 현재 문서가 있으면 교체 확인창을 연다. 취소/오류는 작업을 유지한다. 승인 시 replaceGraph로 교체하여 Undo 가능하게 한다. 탐색 때문에 취소한 debounce가 미저장 상태로 남지 않도록 최신 작업도 flush한다.
- 샘플/새 문서/Import: 현재 그래프가 있으면 native modal dialog로 확인하고 키보드 편집을 막는다. 파일 상한을 읽기 전에 검사하고 요청 번호 및 읽기 전후 signature로 오래된 읽기를 폐기한다. 파일 검증 실패 시 교체하지 않는다.
- 제한: 새 URL로 전체 페이지 이동/브라우저 종료의 복구는 주소와 JSON 백업에 의존한다. 개발 HMR Store 초기화 상태 보존은 별도 개선 후보다. localStorage에 다이어그램을 추가 저장하지 않는다.

## ADR-013 — 자산 확장과 지역 라이브러리 설정

- 날짜: 2026-10-16
- 결정: 기존 20개 kind/그룹을 유지하고 대표 자산 12개를 추가한다. architectureNodeKinds로 TypeScript와 입력 검증 허용 목록을 공유하고 allAssets/getAsset으로 검색/클릭/drag 데이터를 관리한다. 임의 drop payload의 label/isGroup을 신뢰하지 않고 등록된 kind의 template만 사용한다. 잘못된 JSON/drop은 그래프를 바꾸지 않는다.
- 아이콘: 기존 Lucide 일반 아이콘을 재사용하고 공급자 공식 로고를 추가하지 않는다. 설치된 lucide-react 1.18.0 LICENSE와 Feather MIT 부분까지 docs/licenses/lucide.txt에 보존하고 ASSET_LICENSES에 출처를 기록한다. 추가 의존성/원격 이미지가 없다.
- UI 상태: 즐겨찾기와 최근 사용은 작은 별도 preferences Store이며 그래프 Store를 분할하지 않는다. 브라우저 localStorage의 architecture-editor-assets-v1에 종류만 저장한다. 최근 목록은 실제 클릭/드래그 추가 시 갱신, 중복 제거/최대 8개/최신순이며 Undo로 지우지 않는다. 즐겨찾기 변경은 편집 히스토리·URL·JSON을 바꾸지 않는다.
- 실패/호환성: 읽기 시 중복/삭제된 종류를 걸러내고 저장 실패 시 메모리 상태를 유지하며 안내한다. 탭 간 실시간 동기화는 제공하지 않는다. URL/JSON 버전 1과 기존 구조/압축을 유지하며 신규 kind는 Phase 5 이상 소비자가 필요하다. 기존 fixture/자산은 계속 복원한다.

## ADR-014 — 복제본 캡처와 단계적 이미지 출력

- 날짜: 2026-10-16
- 대안: 라이브 viewport를 이동하고 복원, 별도 그래프 렌더러 재작성, React Flow DOM 복제본 캡처.
- 결정: 화면 밖 비상호작용 DOM 복제본을 같은 테마 아래 배치하고 html-to-image를 재사용한다. 현재 화면은 viewport를 보존, 전체 영역은 실제 노드/그룹/엣지/라벨 DOM rect를 줌·이동 역변환하여 계산하고 64px 여백을 더한다. 모든 노드가 DOM에 있는 현재 React Flow 설정이 전제다. 격자/미니맵/버튼/핸들/선택/resize UI는 제외한다.
- 잘림 수정: 최초 실제 PNG에서 fractional 글자/테두리 치수 때문에 라벨이 말줄임표가 됨을 발견했다. 출력 복제본의 라벨을 320px 안에서 줄바꿈하고 약간의 반올림 여백을 주며 전체 영역을 재측정한다. 원본 카드의 생략된 제목/메모를 확장하는 기능은 아니다.
- 한도/실패: PNG/PDF 배율 1–4, 최대 한 변 8192px 및 16Mi픽셀을 할당 전에 검사한다. SVG는 1배 논리 크기다. 전체 복제본 재측정 후 다시 검사하며 실제 canvas 크기와 결과 blob도 확인한다. 생성 실패/닫기 시 host를 제거하고 교체/닫기 때 object URL을 해제한다. 생성 중 닫으면 나중 결과를 표시하지 않는다. 계산을 강제 취소하는 엔진은 아니며 상한 이하 성공도 보장하지 않는다.
- 형식: PNG는 RGBA, SVG는 html-to-image foreignObject 기반 브라우저 이미지, PDF는 JPEG를 넣은 단일 페이지 PDF 1.4다. PDF 출력은 DOM canvas에 렌더된 한글을 보존하며 텍스트 검색/선택은 없다. CSS px×0.75의 MediaBox와 byte 단위 xref를 작성하고 strict 파싱/Poppler 렌더로 검증한다. 새 PDF 의존성을 넣지 않는다.
- 다운로드: 파일 생성 후 크기/미리보기와 명시적 파일 링크를 제공한다. 파일이 저장됐다고 자동으로 주장하지 않는다. 실제 Chromium downloadMedia 경로로 세 형식 저장을 확인했다. SVG의 Office 등 문서 앱 호환, PDF 다중 페이지/벡터화는 별도 후속 범위다.
- 불변성: 그래프/선택/viewport/history를 바꾸지 않으며 URL/JSON 계약도 유지한다. 현재 화면은 화면 밖 요소를 포함하지 않는다. 기존 레이아웃의 겹침은 출력 기능이 해소하지 않는다.

## ADR-015 — 측정에 따른 참조 보존과 ELK Worker (2026-10-16)

- 근거: dense300 core 선택30회22.02ms/drag30회34.86ms, 브라우저 drag p95 104.1ms 및 메인 초기 JS1970.46KB를 측정했다. 엣지 전체 재생성과 E×N 조회, 매 선택/드래그의 서명 계산, 정렬 메인 스레드 실행을 우선 개선했다.
- 선택: Map 조회와 변경 없는 참조 보존, 카드/엣지 memo, App 노드 개수 selector, UI 상태 변경은 저장 fast path로 제외. 드래그 종료 후 debounce 시점에만 서명/압축. 경로가 실제로 있으면 이동 첫 회에 제거하며 history 단위는 유지한다.
- 정렬: 공식 elk-api와 worker.min을 지연 로드한다. Vite ?url asset의 classic Worker로 ELK의 message protocol을 그대로 사용한다. 취소/오류/messageerror/30초 timeout은 Worker를 종료하고 generation 및 pending 요청을 무효화한다. 취소 오류는 fallback 배치를 적용하지 않는다. 늦은 이전 Worker 오류는 새 Worker에 영향을 주지 않는다. Worker 없는 Node 환경은 bundled 엔진을 지연 사용한다.
- 교환: 초기 JS542.16KB로 감소하지만 Worker1593.71KB/API4.44KB 요청과 첫 정렬 지연이 생긴다. fallback chunk1432.24KB도 배포한다. 총 배포 크기 감소나 모든 정렬 속도 개선을 주장하지 않는다. 다른 브라우저/Pages의 Worker 로드는 Phase 7 검증 대상이다.
- 호환: URL/JSON 압축·버전·노드/엣지 필드는 그대로다. 표시 이름/애니메이션 생략은 Canvas 파생 값으로만 적용한다. 200연결 초과 애니메이션 중단은 저장 데이터에 넣지 않는다.

## ADR-016 — 출력 비용 제한과 검증 범위 (2026-10-16)

- 근거: baseline dense300 현재/전체 PNG 약7.9/8.1초. html-to-image가 모든 자손의 수백 CSS 속성을 복사하는 비용과 화면 밖 clone이 병목이었다.
- 선택: 앱 노드/엣지 템플릿에서 사용하는 CSS 속성 목록을 명시한다. flex/grid 정렬(place-items 포함), 폰트/줄바꿈, SVG stroke/marker/transform 등을 보존한다. 현재 화면만 clone의 viewport 밖 요소를32px 여유로 제외하고 교차하는 선/큰 그룹/marker 정의는 보존한다. 전체 출력 경계/16MP/8192px 정책은 유지한다. 템플릿 CSS를 확장하면 출력 목록과 실제 출력도 함께 검증한다.
- 결과: dense300 현재PNG595.7ms/전체2742.9ms, 그러나 chain100은7192.7ms이고 반복에도7156.7ms가 재현된다. 편차를 숨기지 않고 원자료/진단 목표/미달을 docs/benchmarks에 기록한다. JS heap 스냅샷은 native/peak/retained 메모리 지표가 아니다.
- 접근성: 노드/연결 이름과 React Flow 한국어 키보드 안내, 주요 테마 대비/조작 이름 검사를 추가한다. production minifier가 #ffffff를 #fff로 줄이는 것을 발견해 색상 검사가 두 형식을 처리하게 하고 회귀 테스트를 추가했다. 명칭/토큰 검사만으로 WCAG 전체 준수를 주장하지 않는다.
- 범위: 측정 도구는 별도 Vite entry/config이고 정상 build에서 제외한다. CI 시간 assertion은 기기 차이로 불안정하므로 기능 회귀와 수치 보고를 분리한다. GitHub Actions/배포 및 다른 엔진 검증은 Phase 7이다.

## ADR-017 — 배포 전 품질 검사와 권한 범위 (2026-10-16)

- 기존 main push/수동 Pages 배포를 유지하고 main 대상 PR 검사도 추가한다. 설치는 npm ci로 lock 기준 재현성을 확보한다. lint/Vitest/format/build(strict TS)를 통과한 artifact만 deploy한다.
- PR은 configure-pages/Pages artifact 업로드/deploy를 실행하지 않는다. contents:read와 Pages 구성 조회용 pages:read는 build, pages:write/id-token:write는 deploy job에만 둔다. 기존 배포 권한을 확대하지 않는다. production 실행은 같은 concurrency 그룹, PR은 번호별 그룹을 사용한다.
- Node24와 기존 Actions major를 유지한다. 무관한 도구 업그레이드/전체 재작성은 하지 않는다. 새 workflow의 실제 원격 성공과 기존 배포본 브라우저 검증은 각각 기록한다.
- URL/JSON v1/압축/base는 변경하지 않는다. 정상 build는 benchmark entry를 포함하지 않는다.
- 첫 run38854733158에서 npm11.19가 기존 lock의 @emnapi/core/runtime root optional peer 누락으로 ci를 거부했다. 로컬 npm11.6의 성공으로 원격 성공을 추정하지 않는다. 동일 npm으로 lock을 보완하고 기존 고정/전이 패키지 버전이 바뀌지 않음을 비교했다. 버전 누락을 해결하며 npm install로 CI를 되돌리지 않는다.

## ADR-018 — JSON 파일 저장 재시도와 수명 (2026-10-16)

- 배포 검증 중 기존 data URL 자동 다운로드를 자동화 도구가 감지하지 못했고 실제 저장 파일도 확인되지 않았다. 이것을 모든 브라우저의 실패로 단정하지 않되, 큰 JSON의 data URL 팽창과 브라우저 저장 차이를 줄이기 위해 PNG와 같은 Blob URL을 사용한다.
- 기존 자동 다운로드 요청을 유지하고 하단에 명시적인 JSON 백업 다운로드 링크를 남긴다. 링크는 생성 시점의 snapshot이며 이후 수정분을 포함하지 않음을 tooltip/README로 설명한다. 새 export에서 교체, 링크 닫기/컴포넌트 unmount에서 URL을 해제한다. 현재 그래프/히스토리/공유 데이터에는 영향을 주지 않는다.
- 실제 로컬 Blob 링크 저장에 성공하여 v1/8노드/7연결을 확인했다. 테스트는 자동 다운로드 payload, 재시도 href/파일명, 이후 편집으로 snapshot 불변, 닫기와 URL 해제를 검증한다. 원격 반영 후 실제 Pages에서도 별도로 확인한다.
