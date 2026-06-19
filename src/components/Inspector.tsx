import { ArrowLeft, ArrowLeftRight, ArrowRight, CopyPlus, GitBranch, Palette, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useGraphStore } from '../store/useGraphStore';

const accentOptions = ['#2563eb', '#dc2626', '#0f766e', '#0284c7', '#16a34a', '#ea580c', '#65a30d', '#7c3aed', '#0891b2'];

const directionOptions = [
  { value: 'forward', label: 'Forward', Icon: ArrowRight },
  { value: 'reverse', label: 'Reverse', Icon: ArrowLeft },
  { value: 'bidirectional', label: 'Both', Icon: ArrowLeftRight },
] as const;

const labelModeOptions = [
  { value: 'protocol', label: 'Protocol' },
  { value: 'compact', label: 'Compact' },
  { value: 'full', label: 'Full' },
] as const;

export function Inspector() {
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const selectedEdgeId = useGraphStore((state) => state.selectedEdgeId);
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const updateNodeData = useGraphStore((state) => state.updateNodeData);
  const updateEdgeData = useGraphStore((state) => state.updateEdgeData);
  const duplicateNode = useGraphStore((state) => state.duplicateNode);
  const deleteNode = useGraphStore((state) => state.deleteNode);
  const deleteEdge = useGraphStore((state) => state.deleteEdge);
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId), [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find((edge) => edge.id === selectedEdgeId), [edges, selectedEdgeId]);
  const sourceNode = useMemo(() => nodes.find((node) => node.id === selectedEdge?.source), [nodes, selectedEdge?.source]);
  const targetNode = useMemo(() => nodes.find((node) => node.id === selectedEdge?.target), [nodes, selectedEdge?.target]);

  return (
    <aside className="app-inspector flex h-screen w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <h2 className="text-sm font-semibold">Inspector</h2>
        <p className="text-xs text-slate-500">Selected item properties</p>
      </div>

      {selectedNode ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{selectedNode.data.category}</div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-950">{selectedNode.id}</div>
          </div>

          <label className="field-label" htmlFor="node-label">
            Label
          </label>
          <input
            className="field-input"
            id="node-label"
            onChange={(event) => updateNodeData(selectedNode.id, { label: event.target.value })}
            value={selectedNode.data.label}
          />

          <label className="field-label" htmlFor="node-subtitle">
            Subtitle
          </label>
          <input
            className="field-input"
            id="node-subtitle"
            onChange={(event) => updateNodeData(selectedNode.id, { subtitle: event.target.value })}
            value={selectedNode.data.subtitle}
          />

          <label className="field-label" htmlFor="node-note">
            Note
          </label>
          <textarea
            className="field-textarea"
            id="node-note"
            onChange={(event) => updateNodeData(selectedNode.id, { note: event.target.value })}
            rows={4}
            value={selectedNode.data.note ?? ''}
          />

          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Palette size={14} aria-hidden />
              <span>Accent</span>
            </div>
            <div className="grid grid-cols-9 gap-2">
              {accentOptions.map((accent) => (
                <button
                  aria-label={`Set accent ${accent}`}
                  className={`color-swatch ${selectedNode.data.accent === accent ? 'color-swatch-selected' : ''}`}
                  key={accent}
                  onClick={() => updateNodeData(selectedNode.id, { accent })}
                  style={{ backgroundColor: accent }}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button className="secondary-button justify-center" onClick={() => duplicateNode(selectedNode.id)} type="button">
              <CopyPlus size={17} aria-hidden />
              <span>Duplicate</span>
            </button>
            <button className="danger-button" onClick={() => deleteNode(selectedNode.id)} type="button">
              <Trash2 size={17} aria-hidden />
              <span>Delete</span>
            </button>
          </div>
        </div>
      ) : selectedEdge ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <GitBranch size={14} aria-hidden />
              <span>Connection</span>
            </div>
            <div className="truncate text-sm font-semibold text-slate-950">
              {sourceNode?.data.label ?? selectedEdge.source} to {targetNode?.data.label ?? selectedEdge.target}
            </div>
            <div className="mt-1 truncate text-xs text-slate-500">{selectedEdge.id}</div>
          </div>

          <label className="field-label" htmlFor="edge-label">
            Label
          </label>
          <input
            className="field-input"
            id="edge-label"
            onChange={(event) => updateEdgeData(selectedEdge.id, { label: event.target.value })}
            placeholder="HTTP, JDBC, Queue, Proxy"
            value={selectedEdge.data?.label ?? ''}
          />

          <div className="field-label">Label display</div>
          <div className="grid grid-cols-3 gap-2">
            {labelModeOptions.map(({ value, label }) => {
              const currentMode = selectedEdge.data?.labelMode ?? (selectedEdge.data?.showEndpoints ? 'compact' : 'protocol');
              const isSelected = currentMode === value;

              return (
                <button
                  className={`secondary-button justify-center px-2 ${isSelected ? 'border-slate-900 bg-slate-100 text-slate-950' : ''}`}
                  key={value}
                  onClick={() => updateEdgeData(selectedEdge.id, { labelMode: value, showEndpoints: value !== 'protocol' })}
                  type="button"
                >
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="field-label">Direction</div>
          <div className="grid grid-cols-3 gap-2">
            {directionOptions.map(({ value, label, Icon }) => {
              const isSelected = (selectedEdge.data?.direction ?? 'forward') === value;

              return (
                <button
                  className={`secondary-button justify-center px-2 ${isSelected ? 'border-slate-900 bg-slate-100 text-slate-950' : ''}`}
                  key={value}
                  onClick={() => updateEdgeData(selectedEdge.id, { direction: value })}
                  type="button"
                >
                  <Icon size={16} aria-hidden />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <button className="danger-button w-full" onClick={() => deleteEdge(selectedEdge.id)} type="button">
              <Trash2 size={17} aria-hidden />
              <span>Delete edge</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
          <p className="text-sm text-slate-500">Select a node or connection to edit its properties.</p>
        </div>
      )}
    </aside>
  );
}
