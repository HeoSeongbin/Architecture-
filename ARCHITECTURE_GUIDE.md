# Architecture Guide For Harnesses

This repository contains a serverless architecture diagram editor. The app itself is the product: users create infrastructure diagrams in the browser, and the entire graph state is compressed into the URL hash. There is no backend, database, auth service, or persistence layer outside the browser.

Use this guide when another harness or AI agent is asked to analyze this source code and draw its architecture.

## What To Draw

Draw the runtime architecture by responsibility, not by every file. The best diagram has 8 to 15 meaningful nodes plus group cards.

Recommended top-level groups:

1. User Interface
2. Diagram Canvas
3. State And History
4. URL Persistence
5. Import And Export
6. Layout And Edge Presentation

Recommended nodes:

- `App Shell`: `src/App.tsx`
- `Sidebar Assets`: `src/components/Sidebar.tsx`, `src/data/assets.ts`
- `React Flow Canvas`: `src/components/ArchitectureCanvas.tsx`
- `Architecture Node Card`: `src/components/CustomNodes/ArchitectureNodeCard.tsx`
- `Group Node Card`: `src/components/CustomNodes/GroupNodeCard.tsx`
- `Architecture Edge Renderer`: `src/components/CustomEdges/ArchitectureEdge.tsx`
- `Inspector`: `src/components/Inspector.tsx`
- `Zustand Graph Store`: `src/store/useGraphStore.ts`
- `URL Compression Engine`: `src/utils/urlUtils.ts`
- `JSON Import/Export Normalizer`: `src/utils/jsonUtils.ts`
- `Edge Presentation Engine`: `src/utils/edgeUtils.ts`
- `Sample Graph`: `src/data/sampleGraph.ts`
- `Styling System`: `src/styles.css`, `tailwind.config.js`

## Core Architecture

The app is a client-only React/Vite application.

Runtime flow:

```text
Browser user
-> React App shell
-> React Flow canvas
-> Zustand graph store
-> URL hash compression sync
```

Import/export flow:

```text
Zustand graph state
-> JSON normalizer
-> .json download/import
```

PNG export flow:

```text
React Flow DOM pane
-> html-to-image
-> PNG download
```

URL persistence flow:

```text
GraphState
-> minified graph
-> JSON.stringify
-> pako.deflate
-> Base64
-> URL-safe replacements
-> window.location.hash
```

Reverse URL persistence flow:

```text
window.location.hash
-> URL-safe restore
-> Base64 decode
-> pako.inflate
-> JSON.parse
-> GraphState
-> Zustand store
-> React Flow render
```

## Important Design Decisions

- The URL hash is the source of shareable persistence.
- `history.replaceState` is used with debounce so dragging nodes does not flood browser history.
- The graph is not saved to localStorage or a server.
- React Flow provides node, edge, selection, minimap, viewport, controls, and drag/drop behavior.
- Zustand owns the application graph, selection, undo/redo stacks, and graph editing actions.
- Edge styles are partly derived at render time so saved URLs stay compact.
- Group cards are real React Flow nodes with `type: "groupNode"`.
- Nodes can belong to group cards through `parentId`.
- Grid visibility is UI state, not serialized graph state.

## Feature Map

### App Shell

File: `src/App.tsx`

Responsibilities:

- Restore graph from `window.location.hash` on mount.
- Subscribe to Zustand and update the URL hash with debounce.
- Provide header controls.
- Handle Undo/Redo keyboard shortcuts.
- Copy share URL.
- Load sample graph.
- Run auto layout.
- Toggle canvas grid.
- Export JSON.
- Import JSON.
- Export PNG through `html-to-image`.

### Diagram Canvas

File: `src/components/ArchitectureCanvas.tsx`

Responsibilities:

- Render React Flow.
- Register custom node and edge types.
- Handle drag/drop from sidebar.
- Add architecture nodes and group nodes.
- Assign nodes to group cards when dropped or dragged into them.
- Render background grid only when grid state is enabled.
- Highlight edges connected to the selected node.

### Graph Store

File: `src/store/useGraphStore.ts`

Responsibilities:

- Store nodes and edges.
- Track selected node and selected edge.
- Track undo/redo history.
- Add, update, duplicate, delete nodes.
- Add, update, delete edges.
- Update edge connection handles.
- Apply global edge label mode.
- Run ELK-based auto layout.
- Maintain group-node ordering.
- Keep children when a group is deleted by converting child positions back to absolute canvas positions.

### URL Compression

File: `src/utils/urlUtils.ts`

Responsibilities:

- Convert `GraphState` to minified URL-safe hash.
- Restore `GraphState` from URL-safe hash.
- Preserve node group metadata, group size, edge direction, label mode, label orientation, manual handle choices, manual label offsets, and endpoint display flags.

### JSON Import/Export

File: `src/utils/jsonUtils.ts`

Responsibilities:

- Normalize imported JSON.
- Reject invalid edges that reference missing nodes.
- Export a human-readable graph format.
- Preserve group cards, group size, parent-child relationships, manual handles, label mode, label orientation, edge direction, and label offsets.

### Edge Presentation

File: `src/utils/edgeUtils.ts`

Responsibilities:

- Derive source-node edge colors.
- Derive arrow markers for direction.
- Generate displayed edge labels from protocol, compact, or full mode.
- Spread labels when many edges share the same source or target.
- Spread edge terminal points when many edges enter the same side of a node.
- Keep derived presentation fields out of the permanent JSON/URL format where possible.

### Custom Edge Renderer

File: `src/components/CustomEdges/ArchitectureEdge.tsx`

Responsibilities:

- Render custom smooth/orthogonal edge paths.
- Render two-line edge labels.
- Apply label position offsets.
- Apply label orientation:
  - `auto`
  - `horizontal`
  - `verticalClockwise`
  - `verticalCounterclockwise`
- Apply source/target terminal offsets to reduce overlaps.

### Inspector

File: `src/components/Inspector.tsx`

Responsibilities:

- Edit selected node label, subtitle, note, and accent.
- Duplicate or delete selected node.
- Edit selected edge label.
- Change edge label display mode.
- Change edge label orientation.
- Change edge direction.
- Change source and target connection sides.
- Adjust label x/y offset.
- Delete selected edge.

### Sidebar

Files:

- `src/components/Sidebar.tsx`
- `src/data/assets.ts`

Responsibilities:

- Show draggable diagram assets.
- Provide a group-card asset.
- Filter assets by search query.
- Transfer asset data to React Flow using HTML5 drag/drop.

## Drawing Rules For Harnesses

When drawing this project:

- Do not draw a backend, database, API server, or auth service unless describing what the app can diagram. This app does not run those services.
- Do not draw every component file as a separate node unless the user explicitly requests source-level detail.
- Prefer responsibility groups over folder groups.
- Show `Zustand Graph Store` as the central state node.
- Show `URL Compression Engine` as a first-class subsystem.
- Show `React Flow Canvas` as the main interaction surface.
- Show `JSON Import/Export` and `PNG Export` as separate output paths.
- Show `ELK Auto Layout` under `Layout And Edge Presentation`.
- Include group cards and edge presentation features because they are important UX behavior.

## Recommended Diagram Edges

Use these edges when generating an architecture diagram for this repository:

- `Browser User -> App Shell`: uses editor controls
- `App Shell -> URL Compression Engine`: restore and persist graph state
- `App Shell -> Zustand Graph Store`: dispatch graph actions
- `Sidebar Assets -> React Flow Canvas`: drag/drop assets
- `React Flow Canvas -> Zustand Graph Store`: node/edge changes
- `Inspector -> Zustand Graph Store`: edit selected item
- `Zustand Graph Store -> Edge Presentation Engine`: derive visual edges
- `Zustand Graph Store -> ELK Auto Layout`: compute layout
- `URL Compression Engine -> Browser URL Hash`: compressed shareable state
- `JSON Import/Export -> Zustand Graph Store`: import/export graph data
- `PNG Export -> React Flow DOM Pane`: capture image

## Expected Output Quality

A good harness-generated diagram should:

- Be readable at normal browser zoom.
- Have group cards for the major runtime responsibilities.
- Use concise labels.
- Include edge labels for important data/control flow.
- Avoid file-by-file clutter.
- Preserve this app's graph JSON format if asked to create an importable diagram.

