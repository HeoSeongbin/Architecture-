import { ArrowLeft, ArrowLeftRight, ArrowRight, CopyPlus, GitBranch, Palette, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { categoryLabels } from '../utils/assetPresentation';
import { useGraphStore } from '../store/useGraphStore';

const accentOptions = ['#2563eb', '#dc2626', '#0f766e', '#0284c7', '#16a34a', '#ea580c', '#65a30d', '#7c3aed', '#0891b2'];

const directionOptions = [
  { value: 'forward', label: '정방향', Icon: ArrowRight },
  { value: 'reverse', label: '역방향', Icon: ArrowLeft },
  { value: 'bidirectional', label: '양방향', Icon: ArrowLeftRight },
] as const;

const labelModeOptions = [
  { value: 'hidden', label: '숨김' },
  { value: 'protocol', label: '프로토콜' },
  { value: 'compact', label: '간략히' },
  { value: 'full', label: '자세히' },
] as const;

const labelOrientationOptions = [
  { value: 'auto', label: '자동' },
  { value: 'horizontal', label: '가로' },
  { value: 'verticalClockwise', label: '세로 시계방향' },
  { value: 'verticalCounterclockwise', label: '세로 반시계방향' },
] as const;

const handleSideOptions = [
  { value: 'top', label: '위' },
  { value: 'right', label: '오른쪽' },
  { value: 'bottom', label: '아래' },
  { value: 'left', label: '왼쪽' },
] as const;

export function Inspector() {
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const selectedEdgeId = useGraphStore((state) => state.selectedEdgeId);
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const updateNodeData = useGraphStore((state) => state.updateNodeData);
  const updateEdgeData = useGraphStore((state) => state.updateEdgeData);
  const updateEdgeConnection = useGraphStore((state) => state.updateEdgeConnection);
  const duplicateNode = useGraphStore((state) => state.duplicateNode);
  const deleteNode = useGraphStore((state) => state.deleteNode);
  const deleteEdge = useGraphStore((state) => state.deleteEdge);
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId), [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find((edge) => edge.id === selectedEdgeId), [edges, selectedEdgeId]);
  const sourceNode = useMemo(() => nodes.find((node) => node.id === selectedEdge?.source), [nodes, selectedEdge?.source]);
  const targetNode = useMemo(() => nodes.find((node) => node.id === selectedEdge?.target), [nodes, selectedEdge?.target]);

  return (
    <aside aria-label="선택 항목 속성" className="app-inspector flex h-full w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <h2 className="text-sm font-semibold">
          {selectedNode?.type === 'groupNode' ? '그룹 속성' : selectedNode ? '노드 속성' : selectedEdge ? '연결선 속성' : '속성'}
        </h2>
        <p className="text-xs text-slate-500">선택한 노드 또는 연결선 편집</p>
      </div>

      {selectedNode ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {categoryLabels[selectedNode.data.category] ?? selectedNode.data.category}
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-950">{selectedNode.id}</div>
          </div>

          <label className="field-label" htmlFor="node-label">
            이름
          </label>
          <input
            className="field-input"
            id="node-label"
            onChange={(event) => updateNodeData(selectedNode.id, { label: event.target.value })}
            value={selectedNode.data.label}
          />

          <label className="field-label" htmlFor="node-subtitle">
            부제목
          </label>
          <input
            className="field-input"
            id="node-subtitle"
            onChange={(event) => updateNodeData(selectedNode.id, { subtitle: event.target.value })}
            value={selectedNode.data.subtitle}
          />

          <label className="field-label" htmlFor="node-note">
            메모
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
              <span>강조색</span>
            </div>
            <div className="grid grid-cols-9 gap-2">
              {accentOptions.map((accent) => (
                <button
                  aria-label={`강조색 ${accent} 선택`}
                  aria-pressed={selectedNode.data.accent === accent}
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
              <span>복제</span>
            </button>
            <button className="danger-button" onClick={() => deleteNode(selectedNode.id)} type="button">
              <Trash2 size={17} aria-hidden />
              <span>삭제</span>
            </button>
          </div>
        </div>
      ) : selectedEdge ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <GitBranch size={14} aria-hidden />
              <span>연결선</span>
            </div>
            <div className="truncate text-sm font-semibold text-slate-950">
              {sourceNode?.data.label ?? selectedEdge.source} → {targetNode?.data.label ?? selectedEdge.target}
            </div>
            <div className="mt-1 truncate text-xs text-slate-500">{selectedEdge.id}</div>
          </div>

          <label className="field-label" htmlFor="edge-label">
            이름
          </label>
          <input
            className="field-input"
            id="edge-label"
            onChange={(event) => updateEdgeData(selectedEdge.id, { label: event.target.value })}
            placeholder="HTTP, JDBC, Queue, Proxy"
            value={selectedEdge.data?.label ?? ''}
          />

          <div className="field-label">라벨 표시</div>
          <div className="grid grid-cols-3 gap-2">
            {labelModeOptions.map(({ value, label }) => {
              const currentMode = selectedEdge.data?.labelMode ?? (selectedEdge.data?.showEndpoints ? 'compact' : 'protocol');
              const isSelected = currentMode === value;

              return (
                <button
                  className={`secondary-button justify-center px-2 ${isSelected ? 'border-slate-900 bg-slate-100 text-slate-950' : ''}`}
                  key={value}
                  aria-pressed={isSelected}
                  onClick={() =>
                    updateEdgeData(selectedEdge.id, { labelMode: value, showEndpoints: value === 'compact' || value === 'full' })
                  }
                  type="button"
                >
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="field-label">라벨 방향</div>
          <div className="grid grid-cols-2 gap-2">
            {labelOrientationOptions.map(({ value, label }) => {
              const isSelected = (selectedEdge.data?.labelOrientation ?? 'auto') === value;

              return (
                <button
                  className={`secondary-button justify-center px-2 ${isSelected ? 'border-slate-900 bg-slate-100 text-slate-950' : ''}`}
                  key={value}
                  aria-pressed={isSelected}
                  onClick={() => updateEdgeData(selectedEdge.id, { labelOrientation: value })}
                  type="button"
                >
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="field-label">연결 방향</div>
          <div className="grid grid-cols-3 gap-2">
            {directionOptions.map(({ value, label, Icon }) => {
              const isSelected = (selectedEdge.data?.direction ?? 'forward') === value;

              return (
                <button
                  className={`secondary-button justify-center px-2 ${isSelected ? 'border-slate-900 bg-slate-100 text-slate-950' : ''}`}
                  key={value}
                  aria-pressed={isSelected}
                  onClick={() => updateEdgeData(selectedEdge.id, { direction: value })}
                  type="button"
                >
                  <Icon size={16} aria-hidden />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="field-label">연결 면</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-slate-500" htmlFor="edge-source-handle">
              시작점
            </label>
            <label className="text-xs font-medium text-slate-500" htmlFor="edge-target-handle">
              도착점
            </label>
            <select
              className="field-input h-9"
              id="edge-source-handle"
              onChange={(event) =>
                updateEdgeConnection(selectedEdge.id, {
                  sourceHandle: event.target.value,
                  targetHandle: selectedEdge.targetHandle ?? 'left',
                })
              }
              value={selectedEdge.sourceHandle ?? 'right'}
            >
              {handleSideOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="field-input h-9"
              id="edge-target-handle"
              onChange={(event) =>
                updateEdgeConnection(selectedEdge.id, {
                  sourceHandle: selectedEdge.sourceHandle ?? 'right',
                  targetHandle: event.target.value,
                })
              }
              value={selectedEdge.targetHandle ?? 'left'}
            >
              {handleSideOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="secondary-button mt-2 w-full justify-center"
            onClick={() => updateEdgeConnection(selectedEdge.id, { handleMode: 'auto' })}
            type="button"
          >
            <RotateCcw size={15} aria-hidden />
            <span>연결 면 자동 선택</span>
          </button>

          <div className="field-label">라벨 위치</div>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-500" htmlFor="edge-label-offset-x">
              X 이동: {selectedEdge.data?.manualLabelOffsetX ?? 0}px
            </label>
            <input
              className="w-full"
              id="edge-label-offset-x"
              max={140}
              min={-140}
              onChange={(event) => updateEdgeData(selectedEdge.id, { manualLabelOffsetX: Number(event.target.value) })}
              step={5}
              type="range"
              value={selectedEdge.data?.manualLabelOffsetX ?? 0}
            />
            <label className="block text-xs font-medium text-slate-500" htmlFor="edge-label-offset-y">
              Y 이동: {selectedEdge.data?.manualLabelOffsetY ?? 0}px
            </label>
            <input
              className="w-full"
              id="edge-label-offset-y"
              max={140}
              min={-140}
              onChange={(event) => updateEdgeData(selectedEdge.id, { manualLabelOffsetY: Number(event.target.value) })}
              step={5}
              type="range"
              value={selectedEdge.data?.manualLabelOffsetY ?? 0}
            />
          </div>
          <button
            className="secondary-button mt-2 w-full justify-center"
            onClick={() => updateEdgeData(selectedEdge.id, { manualLabelOffsetX: 0, manualLabelOffsetY: 0 })}
            type="button"
          >
            <RotateCcw size={15} aria-hidden />
            <span>라벨 위치 초기화</span>
          </button>

          <div className="mt-6">
            <button className="danger-button w-full" onClick={() => deleteEdge(selectedEdge.id)} type="button">
              <Trash2 size={17} aria-hidden />
              <span>연결선 삭제</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
          <div className="inspector-help">
            <span className="help-symbol">↖</span>
            <h3>설계를 시작해 보세요</h3>
            <p>캔버스에서 노드나 연결선을 선택하면 이곳에서 편집할 수 있습니다.</p>
            <dl>
              <dt>노드 추가</dt>
              <dd>왼쪽 자산을 클릭하거나 드래그</dd>
              <dt>연결</dt>
              <dd>노드 가장자리의 점에서 드래그</dd>
              <dt>실행 취소</dt>
              <dd>Ctrl/⌘ + Z</dd>
              <dt>파일 백업</dt>
              <dd>파일 → JSON 내보내기</dd>
            </dl>
          </div>
        </div>
      )}
    </aside>
  );
}
