import { useMemo, useState } from 'react';
import { Box, Cloud, Database, Layers3, Network, Search, Server } from 'lucide-react';
import { architectureAssets } from '../data/assets';
import type { ArchitectureNodeData } from '../types/graph';

const categoryIcon = {
  Database,
  Server,
  Application: Layers3,
  Cloud: Cloud,
  Network: Network,
  Group: Layers3,
};

const blockAsset: ArchitectureNodeData = {
  kind: 'block',
  label: 'Block Card',
  subtitle: 'Label area without connection lines',
  category: 'Group',
  accent: '#334155',
  isBlock: true,
  note: 'Use this as a freeform block, lane label, note, or visual boundary without edge handles.',
};

const groupAsset: ArchitectureNodeData = {
  kind: 'group',
  label: 'Group Card',
  subtitle: 'Drag nodes into this area',
  category: 'Group',
  accent: '#475569',
  isGroup: true,
  note: 'Use this to mark client, gateway, backend, event, data, or any custom boundary.',
};

export function Sidebar() {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAssets = useMemo(
    () =>
      architectureAssets.filter((asset) => {
        const searchable = `${asset.label} ${asset.subtitle} ${asset.category}`.toLowerCase();
        return searchable.includes(normalizedQuery);
      }),
    [normalizedQuery],
  );
  const groupedAssets = filteredAssets.reduce<Record<string, ArchitectureNodeData[]>>((groups, asset) => {
    groups[asset.category] = [...(groups[asset.category] ?? []), asset];
    return groups;
  }, {});

  const onDragStart = (event: React.DragEvent<HTMLButtonElement>, asset: ArchitectureNodeData) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(asset));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="app-sidebar flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded bg-cyan-600 text-white">
            <Box size={17} aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Architecture Assets</h2>
            <p className="text-xs text-slate-500">Drag items onto the canvas</p>
          </div>
        </div>
        <label className="relative mt-4 block" htmlFor="asset-search">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden />
          <input
            className="field-input h-9 pl-9"
            id="asset-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search assets"
            value={query}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <section className="mb-5">
          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Layers3 size={14} aria-hidden />
            <span>Diagram Groups</span>
          </div>
          <div className="space-y-2">
            <button
              className="asset-button group-asset-button"
              draggable
              onDragStart={(event) => onDragStart(event, groupAsset)}
              style={{ borderLeftColor: groupAsset.accent }}
              type="button"
            >
              <span className="asset-swatch group-asset-swatch" style={{ backgroundColor: groupAsset.accent }} />
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium">{groupAsset.label}</span>
                <span className="block truncate text-xs text-slate-500">{groupAsset.subtitle}</span>
              </span>
            </button>
            <button
              className="asset-button block-asset-button"
              draggable
              onDragStart={(event) => onDragStart(event, blockAsset)}
              style={{ borderLeftColor: blockAsset.accent }}
              type="button"
            >
              <span className="asset-swatch block-asset-swatch" style={{ backgroundColor: blockAsset.accent }} />
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium">{blockAsset.label}</span>
                <span className="block truncate text-xs text-slate-500">{blockAsset.subtitle}</span>
              </span>
            </button>
          </div>
        </section>

        {filteredAssets.length === 0 ? (
          <div className="px-2 py-8 text-center text-sm text-slate-500">No matching assets.</div>
        ) : null}
        {Object.entries(groupedAssets).map(([category, assets]) => {
          const Icon = categoryIcon[category as keyof typeof categoryIcon] ?? Server;
          return (
            <section className="mb-5" key={category}>
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Icon size={14} aria-hidden />
                <span>{category}</span>
              </div>
              <div className="space-y-2">
                {assets.map((asset) => (
                  <button
                    className="asset-button"
                    draggable
                    key={asset.kind}
                    onDragStart={(event) => onDragStart(event, asset)}
                    style={{ borderLeftColor: asset.accent }}
                    type="button"
                  >
                    <span className="asset-swatch" style={{ backgroundColor: asset.accent }} />
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-sm font-medium">{asset.label}</span>
                      <span className="block truncate text-xs text-slate-500">{asset.subtitle}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}

