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
  i: string;        // node id
  t: string;        // node type
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

- 상단/좌측: target
- 우측/하단: source

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

`Sample` 버튼을 누르면 기본 샘플 아키텍처가 로드됩니다.

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

`Layout` 버튼은 현재 연결 방향을 기준으로 노드를 좌에서 우로 자동 배치합니다.

동작 방식:

- incoming edge가 없는 노드를 시작점으로 판단
- edge 방향을 따라 depth 계산
- depth별 column 배치
- 같은 column 내에서는 row 간격을 두고 배치
- 순환 그래프에서 무한 루프가 발생하지 않도록 depth cap 적용

구현 위치:

- `src/store/useGraphStore.ts`

### 4.11 JSON Import / Export

#### JSON Export

`JSON` 버튼을 누르면 현재 그래프 상태를 `.json` 파일로 다운로드합니다.

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

`Import` 버튼으로 `.json` 파일을 선택하면 다이어그램을 복원합니다.

Import 시 검증:

- nodes 배열 존재 여부
- edges 배열 존재 여부
- node id / position / data 필드 유효성
- edge source / target이 실제 node id를 참조하는지 확인

잘못된 JSON이면 버튼 상태가 `Invalid JSON`으로 표시됩니다.

구현 위치:

- `src/utils/jsonUtils.ts`
- `src/App.tsx`

### 4.12 PNG Export

`PNG` 버튼을 누르면 현재 React Flow 캔버스를 PNG 이미지로 다운로드합니다.

파일명 형식:

```text
architecture-diagram-YYYY-MM-DD.png
```

구현 방식:

- `html-to-image`의 `toPng` 사용
- React Flow panel UI는 이미지에서 제외
- 배경색은 `#f8fafc`
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

상단 Header에는 다음 버튼이 있습니다.

- Undo
- Redo
- Sample
- Copy link
- Layout
- JSON
- Import
- Clear
- PNG

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

현재 개발 환경에서는 Node.js 24.x와 npm 11.x에서 빌드 확인되었습니다.

### 설치

```bash
npm install
```

Windows PowerShell에서 `npm.ps1` 실행 정책 문제가 발생하면 다음처럼 실행할 수 있습니다.

```bash
npm.cmd install
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

- 더 정교한 auto layout 알고리즘
- 그룹/서브넷/영역 박스 기능
- 노드 크기 조절
- 엣지 스타일 선택
- 더 많은 클라우드 리소스 아이콘
- 다중 선택 후 일괄 편집
- 키보드 기반 복사/붙여넣기
- 더 강한 모바일 UI
- 테스트 코드 추가
- GitHub Pages 배포 설정

## 11. 라이선스

현재 별도 라이선스 파일은 포함되어 있지 않습니다.  
공개 저장소로 운영할 경우 MIT License 등 원하는 라이선스를 추가하는 것을 권장합니다.

