# Diagram JSON Format

This document describes the JSON format accepted by the app's Import feature and produced by the JSON Export feature.

The import/export JSON is intentionally more readable than the compressed URL hash format. Use this format when another harness generates diagrams for this app.

## Top-Level Shape

```json
{
  "nodes": [],
  "edges": []
}
```

Both arrays are required.

## Node Shape

Normal architecture node:

```json
{
  "id": "url-compression-engine",
  "type": "architectureNode",
  "position": { "x": 100, "y": 120 },
  "parentId": "group-persistence",
  "data": {
    "kind": "nodejs",
    "label": "URL Compression Engine",
    "subtitle": "pako + base-64 hash state",
    "category": "Application",
    "accent": "#f97316",
    "note": "Minifies, deflates, encodes, decodes, and restores the diagram graph."
  }
}
```

Group card:

```json
{
  "id": "group-persistence",
  "type": "groupNode",
  "position": { "x": 40, "y": 80 },
  "style": { "width": 460, "height": 300 },
  "data": {
    "kind": "group",
    "label": "Persistence And Sharing",
    "subtitle": "URL hash and import/export paths",
    "category": "Group",
    "accent": "#f97316",
    "isGroup": true,
    "note": "All durable diagram state is represented in the URL hash or exported JSON."
  }
}
```

### Node Fields

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Stable unique string. Prefer kebab-case. |
| `type` | yes | `"architectureNode"` or `"groupNode"`. |
| `position.x` | yes | Number. For child nodes, this is relative to the parent group. |
| `position.y` | yes | Number. For child nodes, this is relative to the parent group. |
| `parentId` | no | Use for nodes inside a group card. |
| `style.width` | group only | Group card width. |
| `style.height` | group only | Group card height. |
| `data.kind` | yes | One of the supported node kinds. |
| `data.label` | yes | Display label. |
| `data.subtitle` | yes | Short descriptive subtitle. |
| `data.category` | yes | Display category. |
| `data.accent` | yes | Hex color string. |
| `data.isGroup` | group only | Must be `true` for group cards. |
| `data.note` | no | Longer detail text. |

## Supported Node Kinds

Use these values for `data.kind`:

- `mssql`
- `oracle`
- `mariadb`
- `postgresql`
- `mongodb`
- `redis`
- `docker`
- `nginx`
- `wsl`
- `nodejs`
- `python`
- `spring`
- `aspnet`
- `react`
- `aws`
- `azure`
- `gcp`
- `loadbalancer`
- `firewall`
- `queue`
- `group`

## Supported Categories

Use these values for `data.category`:

- `Database`
- `Server`
- `Application`
- `Cloud`
- `Network`
- `Group`

## Edge Shape

```json
{
  "id": "edge-app-to-store",
  "source": "app-shell",
  "target": "zustand-graph-store",
  "sourceHandle": "right",
  "targetHandle": "left",
  "data": {
    "direction": "forward",
    "handleMode": "manual",
    "label": "dispatch graph actions",
    "labelMode": "protocol",
    "labelOrientation": "auto",
    "manualLabelOffsetX": 0,
    "manualLabelOffsetY": 0,
    "showEndpoints": false
  },
  "label": "dispatch graph actions"
}
```

### Edge Fields

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Stable unique string. Prefer `edge-source-target`. |
| `source` | yes | Existing source node id. |
| `target` | yes | Existing target node id. |
| `sourceHandle` | no | `top`, `right`, `bottom`, or `left`. |
| `targetHandle` | no | `top`, `right`, `bottom`, or `left`. |
| `data.direction` | no | Defaults to `forward`. |
| `data.handleMode` | no | `auto` or `manual`. |
| `data.label` | no | Main edge label. |
| `data.labelMode` | no | `hidden`, `protocol`, `compact`, or `full`. |
| `data.labelOrientation` | no | `auto`, `horizontal`, `verticalClockwise`, or `verticalCounterclockwise`. |
| `data.manualLabelOffsetX` | no | Number of pixels. |
| `data.manualLabelOffsetY` | no | Number of pixels. |
| `data.showEndpoints` | no | Boolean. Usually true for compact/full endpoint labels. |
| `label` | no | Can duplicate `data.label` for compatibility. |

### Edge Direction

Use `data.direction`:

- `forward`: arrow from source to target
- `reverse`: arrow from target to source
- `bidirectional`: arrows on both ends

### Edge Label Mode

Use `data.labelMode`:

- `hidden`: no label
- `protocol`: show only `data.label`
- `compact`: show source and target labels plus protocol
- `full`: show source and target labels with subtitles plus protocol

### Edge Label Orientation

Use `data.labelOrientation`:

- `auto`: app decides based on edge direction
- `horizontal`: force horizontal label
- `verticalClockwise`: rotate label 90 degrees
- `verticalCounterclockwise`: rotate label -90 degrees

## Handle Rules

For readable left-to-right diagrams:

- Use `sourceHandle: "right"` and `targetHandle: "left"` for normal left-to-right flow.
- Use `sourceHandle: "bottom"` and `targetHandle: "top"` for top-to-bottom flow.
- Use `handleMode: "manual"` when handles are explicitly chosen.
- Use `handleMode: "auto"` when the app may recalculate handles during layout.

## Group Layout Rules

When using group cards:

- Put group nodes before child nodes in the `nodes` array.
- Give every group a `style.width` and `style.height`.
- Child node positions should be relative to the group's top-left corner.
- Do not set `extent: "parent"` unless you intentionally want React Flow to constrain movement.
- Use group cards for conceptual areas, not decorative backgrounds.

## Minimal Importable Example

```json
{
  "nodes": [
    {
      "id": "group-ui",
      "type": "groupNode",
      "position": { "x": 40, "y": 80 },
      "style": { "width": 420, "height": 260 },
      "data": {
        "kind": "group",
        "label": "User Interface",
        "subtitle": "React controls and editor panels",
        "category": "Group",
        "accent": "#0891b2",
        "isGroup": true,
        "note": "Controls that users interact with directly."
      }
    },
    {
      "id": "app-shell",
      "type": "architectureNode",
      "position": { "x": 48, "y": 88 },
      "parentId": "group-ui",
      "data": {
        "kind": "react",
        "label": "App Shell",
        "subtitle": "src/App.tsx",
        "category": "Application",
        "accent": "#0891b2",
        "note": "Restores URL state, renders layout, and owns header controls."
      }
    },
    {
      "id": "zustand-graph-store",
      "type": "architectureNode",
      "position": { "x": 560, "y": 168 },
      "data": {
        "kind": "nodejs",
        "label": "Zustand Graph Store",
        "subtitle": "src/store/useGraphStore.ts",
        "category": "Application",
        "accent": "#7c3aed",
        "note": "Owns nodes, edges, selection, history, and graph actions."
      }
    }
  ],
  "edges": [
    {
      "id": "edge-app-store",
      "source": "app-shell",
      "target": "zustand-graph-store",
      "sourceHandle": "right",
      "targetHandle": "left",
      "data": {
        "direction": "forward",
        "handleMode": "manual",
        "label": "dispatch actions",
        "labelMode": "protocol",
        "labelOrientation": "auto",
        "manualLabelOffsetX": 0,
        "manualLabelOffsetY": 0,
        "showEndpoints": false
      },
      "label": "dispatch actions"
    }
  ]
}
```

## URL Hash Format

The URL hash format is different from this import/export JSON. It is minified and compressed.

Minified graph shape:

```ts
interface MinifiedGraph {
  n: MinifiedNode[];
  e: MinifiedEdge[];
}
```

Minified node keys:

- `i`: id
- `t`: type
- `p`: position tuple
- `d`: data
- `g`: parent id
- `e`: parent extent flag
- `w`: width
- `h`: height

Minified edge keys:

- `i`: id
- `s`: source
- `t`: target
- `l`: label
- `d`: direction, where `r` is reverse and `b` is bidirectional
- `h`: manual handle flag
- `m`: label mode, where `h` is hidden, `c` is compact, and `f` is full
- `r`: label orientation, where `h` is horizontal, `v` is vertical clockwise, and `w` is vertical counterclockwise
- `ox`: manual label x offset
- `oy`: manual label y offset
- `a`: source handle
- `z`: target handle
- `x`: show endpoints flag

Do not ask harnesses to hand-author compressed URL hashes. Ask them to generate import/export JSON unless compression is explicitly required.

