import { useMemo, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Search } from 'lucide-react';
import { architectureAssets } from '../data/assets';
import { useGraphStore } from '../store/useGraphStore';
import { assetIcons, categoryLabels } from '../utils/assetPresentation';
import type { ArchitectureNodeData } from '../types/graph';

const groupAsset: ArchitectureNodeData = {
  kind: 'group',
  label: '그룹 영역',
  subtitle: '노드를 드래그하여 영역에 포함',
  category: 'Group',
  accent: '#475569',
  isGroup: true,
  note: 'VPC, 서브넷, 서비스 경계 등 논리적 영역을 표시하세요.',
};
const assets = [groupAsset, ...architectureAssets];

export function Sidebar({ onAdded }: { onAdded?: () => void }) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useGraphStore((state) => state.addNode);
  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) =>
        `${asset.label} ${asset.subtitle} ${asset.category} ${categoryLabels[asset.category]}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [query],
  );
  const categories = Array.from(new Set(filteredAssets.map((asset) => asset.category)));
  const addAsset = (asset: ArchitectureNodeData) => {
    const bounds = document.getElementById('diagram-workspace')?.getBoundingClientRect();
    if (!bounds) return;
    const position = screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
    const count = useGraphStore.getState().nodes.length;
    const offset = (count % 5) * 24;
    addNode({
      id: `${asset.kind}-${crypto.randomUUID().slice(0, 8)}`,
      type: asset.isGroup ? 'groupNode' : 'architectureNode',
      position: { x: position.x - (asset.isGroup ? 260 : 104) + offset, y: position.y - 56 + offset },
      data: { ...asset },
      zIndex: asset.isGroup ? 0 : 1,
      ...(asset.isGroup ? { style: { width: 520, height: 320 } } : {}),
    });
    onAdded?.();
  };
  return (
    <aside className="app-sidebar" aria-label="아키텍처 자산">
      <div className="panel-heading">
        <span className="eyebrow">리소스 라이브러리</span>
        <h2>아키텍처 자산</h2>
        <p>클릭하거나 캔버스로 드래그하세요</p>
        <label className="asset-search" htmlFor="asset-search">
          <Search size={16} aria-hidden />
          <span className="sr-only">자산 검색</span>
          <input
            id="asset-search"
            className="field-input"
            placeholder="자산 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="asset-list">
        {!filteredAssets.length && <p className="empty-search">검색 결과가 없습니다. 다른 이름이나 분류를 입력하세요.</p>}
        {categories.map((category) => {
          const expanded = query.trim() !== '' || !collapsed.has(category);
          const items = filteredAssets.filter((asset) => asset.category === category);
          return (
            <section className="asset-category" key={category}>
              <button
                className="category-toggle"
                aria-expanded={expanded}
                aria-controls={`category-${category}`}
                onClick={() =>
                  setCollapsed((previous) => {
                    const next = new Set(previous);
                    if (next.has(category)) next.delete(category);
                    else next.add(category);
                    return next;
                  })
                }
              >
                <span>{categoryLabels[category]}</span>
                <span>
                  {items.length} {expanded ? '−' : '+'}
                </span>
              </button>
              <div id={`category-${category}`} hidden={!expanded} className="asset-items">
                {items.map((asset) => {
                  const Icon = assetIcons[asset.kind];
                  return (
                    <button
                      className="asset-button"
                      key={asset.kind}
                      aria-label={`${asset.label} — ${asset.subtitle}`}
                      draggable
                      title={`${asset.label} · ${asset.subtitle} · 클릭 또는 드래그하여 추가`}
                      onClick={() => addAsset(asset)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/reactflow', JSON.stringify(asset));
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      style={{ '--node-accent': asset.accent } as React.CSSProperties}
                      type="button"
                    >
                      <span className="asset-preview">
                        <Icon size={20} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{asset.label}</span>
                        <span className="block truncate text-xs text-slate-500">{asset.subtitle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <div className="panel-hint">Ctrl/Shift+클릭 또는 드래그 영역 선택 · Delete로 삭제</div>
    </aside>
  );
}
