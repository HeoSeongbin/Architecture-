import { useEffect, useMemo, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Search, Star } from 'lucide-react';
import { allAssets as assets } from '../data/assets';
import { useAssetPreferences } from '../store/useAssetPreferences';
import { useGraphStore } from '../store/useGraphStore';
import { assetIcons, categoryLabels } from '../utils/assetPresentation';
import type { ArchitectureNodeData } from '../types/graph';

export function Sidebar({ onAdded }: { onAdded?: () => void }) {
  const preferences = useAssetPreferences();
  useEffect(() => useAssetPreferences.getState().load(), []);
  const [view, setView] = useState<'all' | 'favorites' | 'recent'>('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useGraphStore((state) => state.addNode);
  const filteredAssets = useMemo(
    () =>
      (view === 'recent' ? preferences.recent.flatMap((kind) => assets.filter((asset) => asset.kind === kind)) : assets)
        .filter((asset) => view !== 'favorites' || preferences.favorites.includes(asset.kind))
        .filter((asset) =>
          `${asset.label} ${asset.subtitle} ${asset.category} ${categoryLabels[asset.category]}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        ),
    [query, view, preferences.recent, preferences.favorites],
  );
  const categories = view === 'recent' ? ['recent'] : Array.from(new Set(filteredAssets.map((asset) => asset.category)));
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
    preferences.recordUse(asset.kind);
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
      <div className="asset-library-tabs" role="group" aria-label="자산 목록 필터">
        {(
          [
            ['all', '전체'],
            ['favorites', '즐겨찾기'],
            ['recent', '최근 사용'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} className="secondary-button" aria-pressed={view === key} onClick={() => setView(key)}>
            {label}
          </button>
        ))}
      </div>
      {preferences.storageUnavailable && (
        <p className="library-notice" role="status">
          브라우저 설정 저장이 불가능해 현재 페이지에서만 목록을 유지합니다.
        </p>
      )}
      <div className="asset-list">
        {!filteredAssets.length && (
          <p className="empty-search">
            {view === 'favorites' && !query
              ? '별 버튼으로 자산을 즐겨찾기에 추가하세요.'
              : view === 'recent' && !query
                ? '추가한 자산이 여기에 표시됩니다.'
                : '검색 결과가 없습니다. 다른 이름이나 분류를 입력하세요.'}
          </p>
        )}
        {categories.map((category) => {
          const expanded = query.trim() !== '' || !collapsed.has(category);
          const items = category === 'recent' ? filteredAssets : filteredAssets.filter((asset) => asset.category === category);
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
                <span>{category === 'recent' ? '최근 사용' : categoryLabels[category]}</span>
                <span>
                  {items.length} {expanded ? '−' : '+'}
                </span>
              </button>
              <div id={`category-${category}`} hidden={!expanded} className="asset-items">
                {items.map((asset) => {
                  const Icon = assetIcons[asset.kind];
                  return (
                    <div className="asset-row" key={asset.kind}>
                      <button
                        className="asset-button"
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
                      <button
                        className="asset-favorite icon-button"
                        aria-label={`${asset.label} 즐겨찾기 ${preferences.favorites.includes(asset.kind) ? '해제' : '추가'}`}
                        aria-pressed={preferences.favorites.includes(asset.kind)}
                        onClick={() => preferences.toggle(asset.kind)}
                      >
                        <Star size={16} fill={preferences.favorites.includes(asset.kind) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
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
