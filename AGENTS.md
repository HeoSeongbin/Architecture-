# 에이전트 작업 규칙

1. 작업 시작 전에 `docs/PROGRESS.md`, `PROJECT.md`, `docs/DECISIONS.md`, 이 파일과 관련 소스를 읽는다.
2. `git status --short`와 diff로 기존 변경을 확인하고 보존한다. 현재 Phase와 승인된 작업 범위를 확인한 뒤 구현한다.
3. 상세 기능 명세는 PROJECT.md를 기준으로 한다. 첫 실행은 Phase 0–1, 후속 실행은 Phase 2를 진행했다. 다음 미완료 단계는 docs/PROGRESS.md를 기준으로 확인하고 사용자가 승인한 현재 Phase만 진행한다.
4. React/TypeScript, React Flow, Zustand와 브라우저 전용 구조를 유지한다. 분석 없이 전체를 재작성하지 않는다.
5. 변경 전 영향 범위를 분석한다. 기존 편집, 선택, Undo/Redo, URL/JSON 호환성을 검토하고 회귀 테스트를 작성한다.
6. 사용자 데이터 가져오기에 실패하면 현재 그래프를 교체하지 않는다. 기존 URL 압축 형식의 무단 변경을 금지한다.
7. 구현 단위마다 필요한 테스트를 실행한다. 완료 시 `npm run lint`, `npm test`, `npm run build`, `npm run format:check`를 확인한다.
8. 테스트 실패를 수정하고 재검증한다. 브라우저/다운로드/배포를 직접 검증하지 않았다면 완료라고 기록하지 않는다.
9. 완료 작업, 오류, 테스트 결과, 차단 요인과 다음 작업을 docs/PROGRESS.md에 갱신한다. 핵심 기술 결정은 날짜와 호환성 영향을 docs/DECISIONS.md에 기록한다.
10. README는 사용자 설명서로 유지한다. 진행 로그와 상세 요구사항은 각각 PROGRESS.md와 PROJECT.md에 기록한다.
11. 기존 작업 삭제, force push, 임의 원격 변경을 금지한다. 커밋을 작성할 때는 작업 단위와 목적을 드러내는 메시지를 사용한다.
12. 새 기능과 데이터 필드는 기본값, 구버전 호환성, 저장/복원, Undo/Redo를 함께 검증한다. 측정하지 않은 성능 개선을 완료 처리하지 않는다.
