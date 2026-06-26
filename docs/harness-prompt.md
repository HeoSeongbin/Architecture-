# Harness Prompt

Use this prompt when asking another harness or AI agent to analyze this repository and create an architecture diagram for the Serverless Architecture Diagram Editor.

## Prompt

You are analyzing a React/TypeScript/Vite repository for a browser-only architecture diagram editor.

Read these files first:

- `ARCHITECTURE_GUIDE.md`
- `docs/diagram-json-format.md`
- `package.json`
- `src/types/graph.ts`
- `src/App.tsx`
- `src/store/useGraphStore.ts`
- `src/components/ArchitectureCanvas.tsx`
- `src/components/Inspector.tsx`
- `src/components/Sidebar.tsx`
- `src/components/CustomEdges/ArchitectureEdge.tsx`
- `src/components/CustomNodes/ArchitectureNodeCard.tsx`
- `src/components/CustomNodes/GroupNodeCard.tsx`
- `src/utils/urlUtils.ts`
- `src/utils/jsonUtils.ts`
- `src/utils/edgeUtils.ts`

Your task:

Create an architecture diagram that can be imported into this app using its JSON import feature.

Important constraints:

- This application is serverless and browser-only.
- Do not invent a backend, API service, database, login service, or cloud runtime for this app.
- Draw responsibility-level architecture, not every source file.
- Use group cards for major responsibilities.
- Keep the diagram readable.
- Prefer 8 to 15 architecture nodes, plus group cards.
- Use edge labels to explain meaningful data/control flows.
- Use the JSON shape documented in `docs/diagram-json-format.md`.

Required groups:

- `User Interface`
- `Diagram Canvas`
- `State And History`
- `Persistence And Sharing`
- `Import And Export`
- `Layout And Presentation`

Required architecture nodes:

- `App Shell`
- `Sidebar Assets`
- `React Flow Canvas`
- `Inspector`
- `Architecture Node Card`
- `Group Node Card`
- `Architecture Edge Renderer`
- `Zustand Graph Store`
- `URL Compression Engine`
- `JSON Import/Export`
- `PNG Export`
- `ELK Auto Layout`
- `Edge Presentation Engine`
- `Styling System`

Required edges:

- `Browser User -> App Shell`
- `App Shell -> Zustand Graph Store`
- `App Shell -> URL Compression Engine`
- `Sidebar Assets -> React Flow Canvas`
- `React Flow Canvas -> Zustand Graph Store`
- `Inspector -> Zustand Graph Store`
- `Zustand Graph Store -> Edge Presentation Engine`
- `Zustand Graph Store -> ELK Auto Layout`
- `URL Compression Engine -> Browser URL Hash`
- `JSON Import/Export -> Zustand Graph Store`
- `PNG Export -> React Flow DOM Pane`

Output requirements:

- Return only valid JSON.
- The JSON must have top-level `nodes` and `edges` arrays.
- Use `type: "groupNode"` for groups.
- Use `type: "architectureNode"` for normal nodes.
- Use `parentId` on normal nodes that belong to a group.
- Use `style.width` and `style.height` for group card size.
- Use node `data.kind`, `data.label`, `data.subtitle`, `data.category`, `data.accent`, and optional `data.note`.
- Use edge `data.label`, `data.direction`, `data.labelMode`, and optional `data.labelOrientation`.
- Keep all IDs stable, lowercase, and kebab-case.

Recommended color palette:

- UI: `#0891b2`
- Canvas: `#0ea5e9`
- State: `#7c3aed`
- Persistence: `#f97316`
- Import/export: `#16a34a`
- Layout/presentation: `#475569`

Do not include markdown fences around the JSON.

## Optional Follow-Up Prompt

If the generated diagram is too crowded:

Simplify the diagram. Keep only the major subsystems and the most important edges. Preserve the app's JSON import format.

## Optional Source-Level Prompt

If a source-level diagram is requested:

Create a second diagram showing source modules and dependencies. Group by folder, but still avoid drawing every trivial file. Include only files that own meaningful behavior.

