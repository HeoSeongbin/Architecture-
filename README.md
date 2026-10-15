# Serverless Architecture Diagram Editor

URL 하나로 공유할 수 있는 서버리스 아키텍처 다이어그램 편집기입니다.  
별도의 백엔드, 데이터베이스, 로그인, 파일 저장 서버 없이 브라우저 안에서만 동작하며, 다이어그램의 전체 상태를 압축해서 URL hash에 저장합니다.

이 README는 코드를 직접 분석하지 않아도 프로젝트의 목적, 기술 스택, 주요 기능, 상태 저장 방식, 파일 구조, 실행 방법을 이해할 수 있도록 작성되었습니다.

## 1. 프로젝트 목적

이 프로젝트는 시스템/서버리스/인프라 아키텍처를 빠르게 그려 보고, 결과물을 URL 또는 파일로 공유하기 위한 웹 기반 다이어그램 에디터입니다.

일반적인 다이어그램 도구는 서버 저장소, 계정, 프로젝트 파일이 필요하지만, 이 앱은 다음 흐름을 목표로 합니다.

1. 브라우저에서 아키텍처 노드를 배치한다.
2. 노드와 엣지를 연결한다.
3. 노드/연결 정보를 수정한다.
4. 앱이 현재 상태를 압축해 URL hash에 자동 저장한다.
5. URL을 복사하면 같은 다이어그램을 그대로 복원할 수 있다.

즉, 이 앱의 핵심 아이디어는 **"다이어그램 파일 자체를 URL 안에 넣는다"** 입니다.

## 2. 핵심 특징

- 백엔드가 없는 완전한 프론트엔드 앱
- 다이어그램 상태를 URL hash에 압축 저장
- React Flow 기반 노드/엣지 편집
- 드래그 앤 드롭으로 아키텍처 자산 추가
- 노드/연결선 Inspector 편집
- Undo / Redo 지원
- 자동 레이아웃 정렬
- JSON import/export 지원
- PNG 이미지 export 지원
- 샘플 아키텍처 즉시 로딩
- URL 복원 실패 시 안전하게 빈 캔버스로 fallback
- 한국어 기본 UI와 라이트/다크 테마
- 자산 클릭 추가, 카테고리 접기/펼치기
- 좁은 화면의 자산/속성 패널 전환과 파일/보기 메뉴

## 3. 기술 스택

### Core

- React 18+
- TypeScript
- Vite

### UI / Styling

- Tailwind CSS
- lucide-react 아이콘

### Diagram Engine

- `@xyflow/react`
  - React Flow의 최신 패키지 계열입니다.
  - 노드, 엣지, 미니맵, 컨트롤, 드래그 앤 드롭, 선택 이벤트를 처리합니다.

### State Management

- Zustand
  - nodes, edges, 선택 상태, 히스토리, 편집 액션을 관리합니다.

### URL Compression

- pako
  - JSON 상태를 DEFLATE 압축합니다.
- base-64
  - 압축된 binary 데이터를 Base64 문자열로 변환합니다.

### Export

- html-to-image
  - React Flow 캔버스를 PNG 이미지로 변환합니다.

## 4. 주요 기능 상세

### 4.1 URL 기반 저장/복원

앱은 서버나 localStorage가 아니라 `window.location.hash`에 현재 다이어그램 상태를 저장합니다.

저장 흐름:

```text
Graph State
-> minified JSON
-> JSON.stringify
-> pako.deflate
-> Base64 encode
-> URL-safe 문자 치환
-> window.location.hash
```

복원 흐름:

```text
window.location.hash
-> URL-safe 문자 복원
-> Base64 decode
-> pako.inflate
-> JSON.parse
-> React Flow nodes / edges 복원
```

URL-safe 치환 규칙:

```text
+ -> -
/ -> _
= -> ~
```

이 방식 덕분에 URL만 복사해도 다이어그램 전체 상태를 공유할 수 있습니다.

### 4.2 Minified Data Structure

URL 길이를 줄이기 위해 저장용 구조는 짧은 키를 사용합니다.

노드 저장 구조:

```ts
interface MinifiedNode {
  i: string; // node id
  t: string; // node type
  p: [number, number]; // position [x, y]
  d: ArchitectureNodeData; // node data
}
```

엣지 저장 구조:

```ts
interface MinifiedEdge {
  i: string; // edge id
  s: string; // source node id
  t: string; // target node id
  l?: string; // edge label
}
```

전체 저장 구조:

```ts
interface MinifiedGraph {
  n: MinifiedNode[];
  e: MinifiedEdge[];
}
```

구현 위치:

- `src/utils/urlUtils.ts`

### 4.3 Debounced URL Sync

상태가 바뀔 때마다 URL을 즉시 업데이트하면 브라우저 history가 과도하게 쌓이고 성능도 나빠질 수 있습니다.

그래서 이 앱은 Zustand store 변경을 구독하고, 약 400ms debounce 후 `window.history.replaceState`를 사용해 URL을 갱신합니다.

특징:

- `pushState`가 아니라 `replaceState` 사용
- 브라우저 뒤로가기 히스토리를 불필요하게 늘리지 않음
- 노드 이동/편집/삭제/연결 등 상태 변경이 URL에 자동 반영됨

구현 위치:

- `src/App.tsx`

### 4.4 아키텍처 자산 Sidebar

왼쪽 Sidebar에는 드래그해서 캔버스에 추가할 수 있는 아키텍처 자산이 있습니다.

현재 제공되는 자산:

#### Database

- MSSQL
- Oracle
- MariaDB
- PostgreSQL
- MongoDB
- Redis

#### Server

- Docker
- Nginx
- WSL Ubuntu
- Node.js
- Python

#### Application

- Spring Boot
- ASP.NET
- React

#### Cloud

- AWS
- Azure
- Google Cloud

#### Network

- Load Balancer
- Firewall
- Message Queue

Sidebar 기능:

- 자산 검색/필터
- 카테고리별 그룹 표시
- HTML5 drag and drop으로 React Flow 캔버스에 노드 생성
- 클릭 또는 키보드 Enter로 현재 캔버스 중앙에 노드 추가
- 한국어 분류 검색, 분류별 접기/펼치기, 아이콘 미리보기와 설명 툴팁

구현 위치:

- `src/components/Sidebar.tsx`
- `src/data/assets.ts`

### 4.5 React Flow Canvas

중앙 캔버스는 React Flow 기반입니다.

지원 기능:

- 노드 드래그
- 노드 연결
- 엣지 선택
- 노드 선택
- 배경 점 grid
- MiniMap
- Zoom / Fit View / Interactivity controls
- Delete / Backspace 삭제

구현 위치:

- `src/components/ArchitectureCanvas.tsx`

### 4.6 Custom Architecture Node

모든 아키텍처 자산은 커스텀 노드 컴포넌트로 렌더링됩니다.

노드에 표시되는 정보:

- 아이콘
- label
- subtitle
- category
- active 상태 badge
- note 일부 표시
- accent color

노드 연결 handle:

- 상/우/하/좌 네 면에 연결 handle 제공
- React Flow `ConnectionMode.Loose`로 각 면에서 연결 가능

구현 위치:

- `src/components/CustomNodes/ArchitectureNodeCard.tsx`

### 4.7 Inspector

오른쪽 Inspector는 선택한 대상에 따라 다르게 동작합니다.

#### 노드 선택 시

수정 가능 항목:

- Label
- Subtitle
- Note
- Accent color

지원 액션:

- Duplicate
- Delete

Duplicate는 선택한 노드를 약간 오른쪽 아래로 복제하고 새 노드를 선택합니다.

Delete는 해당 노드를 삭제하며, 연결된 엣지도 함께 제거합니다.

#### 엣지 선택 시

수정 가능 항목:

- Edge label
- 방향(정방향/역방향/양방향), 라벨 표시 모드와 회전 방향
- 연결 면 자동/수동 선택, 라벨 X/Y 위치

지원 액션:

- Delete edge

구현 위치:

- `src/components/Inspector.tsx`

### 4.8 Undo / Redo

Zustand store에 자체 history stack을 구현했습니다.

지원 단축키:

- `Ctrl + Z`: Undo
- `Ctrl + Y`: Redo
- `Ctrl + Shift + Z`: Redo

히스토리에 기록되는 작업:

- 노드 추가
- 노드 이동 완료
- 노드 데이터 수정
- 노드 복제
- 노드 삭제
- 엣지 연결
- 엣지 삭제
- 엣지 라벨 수정
- 자동 레이아웃
- 그래프 교체

히스토리에 기록하지 않는 작업:

- 단순 선택 변경
- React Flow 내부 dimensions 측정 변경
- 드래그 중간 상태

히스토리 최대 크기:

- 80 steps

구현 위치:

- `src/store/useGraphStore.ts`

### 4.9 Sample Diagram

`샘플` 버튼을 누르면 기본 샘플 아키텍처가 로드됩니다. 900px 이하에서는 `배치` 메뉴에 있습니다.

샘플 구성:

- React
- Nginx
- Docker
- Spring Boot
- ASP.NET
- MSSQL
- MariaDB
- WSL Ubuntu

샘플 엣지 라벨:

- HTTPS
- Proxy
- REST
- gRPC
- JDBC
- SQL
- Dev runtime

구현 위치:

- `src/data/sampleGraph.ts`

### 4.10 Auto Layout

`자동 정렬` 버튼은 ELK.js layered 엔진으로 최상위 일반 노드를 좌에서 우로 자동 배치합니다.

동작 방식:

- ELK layered 알고리즘과 직교 경로 사용
- 실패 시 depth와 자산 의미 계층을 기준으로 자체 열 배치 fallback
- 순환 그래프 depth cap 적용
- 그룹과 그룹 내부 노드는 자동 배치 대상에서 제외
- 정렬 도중 그래프가 변경되면 오래된 결과를 폐기

구현 위치:

- `src/store/useGraphStore.ts`

### 4.11 JSON Import / Export

#### JSON Export

`파일 → JSON 내보내기`에서 현재 그래프 상태를 `.json` 파일로 다운로드합니다.

파일명 형식:

```text
architecture-diagram-YYYY-MM-DD.json
```

내보내는 데이터:

- nodes
- edges
- position
- node data
- edge label
- React Flow 렌더링에 필요한 기본 edge style

#### JSON Import

`파일 → JSON 가져오기`에서 `.json` 파일을 선택하면 다이어그램을 복원합니다.

Import 시 검증:

- nodes 배열 존재 여부
- edges 배열 존재 여부
- node id / position / data 필드 유효성
- edge source / target이 실제 node id를 참조하는지 확인
- 중복/빈 ID, 비정상 좌표, 존재하지 않는 부모와 부모 순환 거부
- 일부 항목이 잘못되어도 전체 Import를 거부하여 조용한 데이터 누락 방지

잘못된 JSON이면 하단에 오류 안내가 표시되며 현재 작업을 유지합니다.

구현 위치:

- `src/utils/jsonUtils.ts`
- `src/App.tsx`

### 4.12 PNG Export

`파일 → PNG 내보내기`에서 현재 React Flow 캔버스를 PNG 이미지로 다운로드합니다.

파일명 형식:

```text
architecture-diagram-YYYY-MM-DD.png
```

구현 방식:

- `html-to-image`의 `toPng` 사용
- React Flow panel UI는 이미지에서 제외
- 배경색은 라이트 `#f8fafc`, 다크 `#111827`
- pixel ratio는 2로 설정

주의:

- Codex in-app Browser는 실제 파일 다운로드를 지원하지 않습니다.
- 실제 다운로드 테스트는 Chrome, Edge 등 일반 브라우저에서 해야 합니다.

구현 위치:

- `src/App.tsx`

## 5. 화면 구성

앱은 3영역 레이아웃입니다.

```text
+--------------------+--------------------------------+----------------------+
| Sidebar            | Canvas                         | Inspector            |
|                    |                                |                      |
| Architecture Assets| React Flow diagram editor      | Selected item editor |
| Search             | Nodes / Edges / MiniMap        | Node or Edge form    |
+--------------------+--------------------------------+----------------------+
```

상단 Toolbar에는 실행 취소/다시 실행, 샘플/자동 정렬, 링크 복사, 테마 전환이 있습니다. `파일` 메뉴에서 새 다이어그램·JSON 입출력·PNG·캔버스 비우기를, `보기` 메뉴에서 전체 보기·확대/축소·격자·연결선 라벨 표시를 조절합니다. 새 다이어그램과 캔버스 비우기는 그래프를 비우며 이전 작업은 실행 취소로 복원할 수 있습니다.

900px 이하에서는 자산/속성 패널 버튼으로 한 패널씩 열고, 샘플/자동 정렬은 `배치` 메뉴에서 실행합니다. 패널 닫기 버튼이나 Escape로 닫을 수 있습니다. 자산을 클릭하여 추가하면 패널이 닫힙니다. 테마 설정은 브라우저에 기억되며 다이어그램의 URL/JSON 데이터에 포함되지 않습니다. 초기 테마는 시스템 설정을 따릅니다.

화면 예시: [라이트](docs/screenshots/phase2-light.jpg), [다크](docs/screenshots/phase2-dark.jpg), [모바일](docs/screenshots/phase2-mobile.jpg).

![다크 테마 편집기](docs/screenshots/phase2-dark.jpg)

## 6. 주요 폴더 / 파일 구조

```text
Architecture
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tailwind.config.js
├─ postcss.config.js
├─ tsconfig.json
├─ src
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ styles.css
│  ├─ types
│  │  └─ graph.ts
│  ├─ store
│  │  └─ useGraphStore.ts
│  ├─ utils
│  │  ├─ urlUtils.ts
│  │  └─ jsonUtils.ts
│  ├─ data
│  │  ├─ assets.ts
│  │  └─ sampleGraph.ts
│  └─ components
│     ├─ ArchitectureCanvas.tsx
│     ├─ Sidebar.tsx
│     ├─ Inspector.tsx
│     └─ CustomNodes
│        └─ ArchitectureNodeCard.tsx
```

### 파일별 역할

#### `src/App.tsx`

앱 최상위 컴포넌트입니다.

담당 역할:

- URL hash 초기 복원
- Zustand store 변경 구독
- URL debounce sync
- Header 버튼 렌더링
- Copy link
- JSON export/import
- PNG export
- Undo/Redo keyboard shortcut
- 전체 레이아웃 구성

#### `src/store/useGraphStore.ts`

앱의 핵심 상태 저장소입니다.

관리하는 상태:

- nodes
- edges
- selectedNodeId
- selectedEdgeId
- undo past stack
- redo future stack
- canUndo
- canRedo

제공하는 주요 액션:

- setGraph
- replaceGraph
- addNode
- selectNode
- selectEdge
- updateNodeData
- updateEdgeData
- duplicateNode
- deleteNode
- deleteEdge
- autoLayout
- undo
- redo
- onNodesChange
- onEdgesChange
- onConnect

#### `src/utils/urlUtils.ts`

URL hash 저장/복원을 담당합니다.

주요 함수:

- `encodeStateToUrl(state)`
- `decodeStateFromUrl(hash)`

#### `src/utils/jsonUtils.ts`

JSON import/export용 데이터 정규화를 담당합니다.

주요 함수:

- `normalizeImportedGraph(value)`
- `toExportableGraph(graph)`

#### `src/components/ArchitectureCanvas.tsx`

React Flow 캔버스입니다.

담당 역할:

- nodes / edges 렌더링
- Drag and drop node 생성
- Node / edge selection
- React Flow controls
- MiniMap
- Background

#### `src/components/Sidebar.tsx`

왼쪽 자산 패널입니다.

담당 역할:

- 아키텍처 자산 목록 표시
- 검색 필터
- Drag and drop 시작 처리

#### `src/components/Inspector.tsx`

오른쪽 속성 편집 패널입니다.

담당 역할:

- 선택한 노드 편집
- 선택한 엣지 편집
- 노드 복제/삭제
- 엣지 삭제

#### `src/components/CustomNodes/ArchitectureNodeCard.tsx`

React Flow custom node renderer입니다.

담당 역할:

- 노드 카드 UI
- 노드별 아이콘
- accent color
- connection handles

## 7. 설치 및 실행

### 요구사항

- Node.js
- npm

현재 개발 환경에서는 Node.js 24.x에서 빌드 및 테스트를 확인했습니다. 의존성 버전은 package.json과 package-lock.json에 고정합니다.

### 설치

```bash
npm ci
```

Windows PowerShell에서 `npm.ps1` 실행 정책 문제가 발생하면 다음처럼 실행할 수 있습니다.

```bash
npm.cmd ci
```

### 개발 서버 실행

```bash
npm run dev
```

또는 Windows에서:

```bash
npm.cmd run dev
```

기본 Vite URL:

```text
http://localhost:5173
```

### 프로덕션 빌드

```bash
npm run build
```

또는 Windows에서:

```bash
npm.cmd run build
```

### 빌드 결과 미리보기

```bash
npm run preview
```

또는 Windows에서:

```bash
npm.cmd run preview
```

## 8. GitHub 업로드 전 권장 사항

이 프로젝트는 GitHub에 올릴 때 다음 파일/폴더를 제외하는 것이 좋습니다.

- `node_modules`
- `dist`
- local log files
- OS/editor temporary files

이 저장소에는 `.gitignore`를 포함해 위 항목들이 제외되도록 구성합니다.

업로드 예시:

```bash
git init
git branch -M main
git remote add origin https://github.com/HeoSeongbin/Architecture-.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

이미 원격 저장소가 연결되어 있다면 remote add는 생략하거나 URL을 확인합니다.

```bash
git remote -v
```

## 9. 설계상 중요한 점

### 백엔드가 없는 이유

이 앱은 공유 가능한 작은 다이어그램을 빠르게 만들기 위한 도구입니다.  
서버 저장소를 두면 계정, 인증, DB, 배포, API가 필요해지므로 URL hash 기반 저장 방식을 선택했습니다.

### URL 길이 제한

다이어그램이 매우 커지면 URL 길이가 길어질 수 있습니다.  
이를 줄이기 위해:

- 저장 구조의 key를 짧게 유지
- JSON stringify 후 DEFLATE 압축
- Base64 URL-safe encoding
- edge style 등 복원 가능한 값은 저장 최소화

그래도 아주 큰 다이어그램은 JSON export를 사용하는 것이 좋습니다.

### Import/Export와 URL 저장의 차이

URL hash 저장:

- 공유가 빠름
- 별도 파일 필요 없음
- URL 길이 제한 존재

JSON export:

- 큰 다이어그램에 유리
- 파일로 백업 가능
- Git 등에 저장하기 좋음

PNG export:

- 문서/보고서/공유 이미지로 사용
- 다시 편집 가능한 데이터는 아님

## 10. 현재 한계 및 개선 후보

현재 구현은 MVP를 넘어 실제 사용 가능한 편집기 수준의 기능을 포함하지만, 다음 개선 여지가 있습니다.

- 그룹과 다양한 크기를 고려한 자동 정렬 및 방향 선택
- 기존 그룹/영역 박스의 포함 관리와 히스토리 보완
- 일반 노드 크기 조절 (그룹 드래그 크기 조절은 구현됨)
- 엣지 스타일 선택
- 더 많은 클라우드 리소스 아이콘
- 다중 선택 후 일괄 편집
- 키보드 기반 복사/붙여넣기
- 더 강한 모바일 UI
- 브라우저 E2E와 다운로드/대량 그래프 검증 확장
- GitHub Pages 배포 설정

## 11. 현재 그룹 기능

Sidebar의 Group Card를 드래그하여 영역을 생성하고 선택한 그룹의 크기를 조절할 수 있습니다. 일반 노드를 그룹에 드래그하면 parentId 기반으로 포함되며 그룹 이동 시 함께 이동합니다. 그룹을 삭제하면 내부 노드는 절대 위치를 유지한 채 남습니다. 그룹 제목/설명/색은 Inspector로 편집하며 크기와 포함 관계는 JSON/URL에 저장됩니다.

## 12. 개발 검증

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run format:check
```

`npm run check`는 lint → test → build를 실행합니다. `npm run test:watch`는 테스트 감시, `npm run format`은 Prettier 정렬입니다. Vitest와 Testing Library로 Store, URL/JSON 왕복 및 구형 형식, Inspector/Sidebar, App 복원/단축키/URL 동기화를 검증합니다. 실제 브라우저의 포인터 조작과 파일 다운로드는 별도 검증 대상입니다.

## 13. 브라우저, 배포 및 알려진 제한

대상 브라우저는 최신 데스크톱 Chrome/Edge/Firefox/Safari입니다. Codex 내장 Chromium 브라우저에서 1280×720 및 390×844 화면, 클릭 추가·선택·속성 편집·테마·전체 보기·URL 새로고침 복원을 확인했습니다. 실제 휴대폰 터치 조작, 파일 다운로드와 다른 브라우저는 별도 검증 대상입니다.

- PNG는 현재 보이는 캔버스를 저장하므로 화면 밖 요소가 잘릴 수 있습니다. 전체 영역/배율/투명 옵션과 SVG/PDF는 후속 작업입니다.
- URL은 브라우저 주소에 저장되며 서버 백업이 아닙니다. 큰 그래프는 JSON으로 백업하세요. 현재 압축 해제 크기 상한과 외부 hash 변경 처리는 미구현입니다.
- Import와 Clear/Sample은 현재 그래프를 교체합니다. 필요하면 먼저 JSON으로 백업하세요. 교체 후 Undo도 가능합니다.
- 일반 노드 크기 조절, 복사/붙여넣기, 일괄 편집, 즐겨찾기와 최근 사용 자산은 후속 개발 대상입니다.
- 빌드의 큰 번들 경고와 Tailwind 3 도구 체인의 의존성 보안 경고가 남아 있습니다. 상세 내용은 docs/PROGRESS.md를 참조하세요.

Vite의 GitHub Pages base는 `/Architecture-/`로 설정되어 있으며 `.github/workflows/deploy.yml`에 기존 build/deploy workflow가 있습니다. 현재 workflow에는 lint/test gate가 없습니다. 실제 배포 주소/Pages 활성화 여부는 확인되지 않았고, workflow 개선과 배포 환경 검증은 Phase 7에서 진행합니다.

관리 문서: [요구사항](PROJECT.md), [작업 규칙](AGENTS.md), [진행 상태](docs/PROGRESS.md), [기술 결정](docs/DECISIONS.md).
