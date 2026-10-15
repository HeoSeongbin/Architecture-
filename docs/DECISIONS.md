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
