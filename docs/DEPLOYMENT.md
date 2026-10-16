# GitHub Pages 운영과 검증

배포 주소: https://heoseongbin.github.io/Architecture-/

Vite base `/Architecture-/`와 URL hash 공유를 유지한다. Pages는 저장소 Settings → Pages → Source가 GitHub Actions인 구성이 필요하다. 권한 설정을 임의로 바꾸지 않는다.

## workflow

`.github/workflows/deploy.yml`은 main push/수동 실행에서 검사 후 Pages에 배포한다. main 대상 pull request는 검사만 실행하며 배포/Pages artifact 업로드를 하지 않는다.

1. checkout, Node24 및 npm cache.
2. `npm ci`로 lock 파일 기준 설치.
3. lint → Vitest → format:check → build(strict TypeScript 포함).
4. 모든 검사 성공 후 Pages 구성 확인과 dist artifact 업로드.
5. deploy job에서만 pages:write/id-token:write를 사용한다. PR마다 독립 검사를 하고 production 배포는 같은 concurrency 그룹으로 직렬화/이전 실행 취소한다.

검사 실패 시 deploy는 실행하지 않는다. 새 workflow의 실제 Actions 성공 여부와 현재 배포본 검증은 별개로 기록한다. 로컬에서 파일을 수정한 것만으로 원격 workflow가 바뀌지 않는다.

## 배포 smoke 시나리오

테스트용 탭에서 샘플을 사용하고 사용자 문서를 덮어쓰지 않는다.

| 항목          | 확인                                                                       |
| ------------- | -------------------------------------------------------------------------- |
| 로드          | 제목/라이브러리/샘플8노드7연결, JS/CSS 오류 없음                           |
| 편집/히스토리 | 한글 이름 변경, 방향키 이동, Undo/Redo 결과                                |
| 공유          | 링크 복사, 새 탭에서 동일 노드/연결/한글 복원, 새로고침 유지               |
| JSON          | export 파일 실제 저장, v1 확인, import 확인 후 교체/Undo, 손상 입력은 보존 |
| 출력          | PNG 생성/실제 저장/로컬 이미지 확인, SVG/PDF 회귀 범위 구분                |
| ELK           | Pages 하위 경로의 Worker/API가 로드되고 기본 배치가 아닌 정렬 적용         |
| 취소          | 대량 fixture 정렬→취소 후 원래 좌표 유지, 다음 정렬 재시작                 |
| 모바일        | 좁은 화면의 자산/속성/출력 모달, 가로 overflow/닫기·포커스                 |

실제 결과와 증거/미검증 항목은 PROGRESS의 Phase7에 기록한다. 브라우저 오류/다운로드 차단·권한 부족을 성공으로 표시하지 않는다.

## 실패 진단과 복구

- 흰 화면/asset404: base와 `/Architecture-/assets/` 요청 및 대소문자를 확인한다. hash 라우팅이므로 별도 서버 rewrite를 추가하지 않는다.
- Worker 오류: asset 경로/HTTP 성공 여부와 브라우저 console을 확인한다. 안전한 fallback이 나왔다고 Worker 성공으로 간주하지 않는다.
- npm ci 실패: package.json/lock 불일치를 점검하고 로컬 검증 후 lock을 함께 변경한다. install로 CI 실패를 숨기지 않는다.
- Pages 권한 오류: Actions run의 build/deploy job 및 Pages Source/환경 승인을 저장소 관리자가 확인한다.
- 회귀 배포: 정상 커밋을 확인하여 새 revert 커밋으로 복구하거나 검증된 커밋을 다시 배포한다. force push나 기존 사용자 변경 삭제로 복구하지 않는다.

배포 직전/직후 JSON 백업을 권장하며 테마/즐겨찾기는 origin별 설정이다. localhost와 github.io의 설정은 공유되지 않는다.
