import { useEffect, useRef, useState } from 'react';
import { Copy, Download, FileDown, Link2, Network, Redo2, Trash2, Undo2, Upload, Wand2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { ReactFlowProvider } from '@xyflow/react';
import { ArchitectureCanvas } from './components/ArchitectureCanvas';
import { Inspector } from './components/Inspector';
import { Sidebar } from './components/Sidebar';
import { sampleGraph } from './data/sampleGraph';
import { useGraphStore } from './store/useGraphStore';
import { normalizeImportedGraph, toExportableGraph } from './utils/jsonUtils';
import { decodeStateFromUrl, encodeStateToUrl } from './utils/urlUtils';

export default function App() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [urlError, setUrlError] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy link');
  const [importLabel, setImportLabel] = useState('Import');
  const [jsonLabel, setJsonLabel] = useState('JSON');
  const [imageLabel, setImageLabel] = useState('PNG');
  const replaceTimer = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const canUndo = useGraphStore((state) => state.canUndo);
  const canRedo = useGraphStore((state) => state.canRedo);
  const undo = useGraphStore((state) => state.undo);
  const redo = useGraphStore((state) => state.redo);
  const autoLayout = useGraphStore((state) => state.autoLayout);
  const encodedState = encodeStateToUrl({ nodes, edges });
  const urlSize = encodedState.length;

  useEffect(() => {
    const decoded = decodeStateFromUrl(window.location.hash);

    if (decoded.ok) {
      useGraphStore.getState().setGraph(decoded.state);
      setUrlError(false);
    } else {
      useGraphStore.getState().setGraph({ nodes: [], edges: [] });
      setUrlError(true);
    }
    setIsHydrated(true);

    const unsubscribe = useGraphStore.subscribe((state) => {
      window.clearTimeout(replaceTimer.current);
      replaceTimer.current = window.setTimeout(() => {
        const encoded = encodeStateToUrl({ nodes: state.nodes, edges: state.edges });
        const nextUrl = `${window.location.pathname}${window.location.search}${encoded ? `#${encoded}` : ''}`;
        window.history.replaceState(null, '', nextUrl);
      }, 400);
    });

    return () => {
      window.clearTimeout(replaceTimer.current);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (!isModifierPressed || (key !== 'z' && key !== 'y')) return;

      const target = event.target as HTMLElement | null;
      const isEditing = target?.matches('input, textarea, [contenteditable="true"]');
      if (isEditing) return;

      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        useGraphStore.getState().redo();
        return;
      }

      if (key === 'z') {
        event.preventDefault();
        useGraphStore.getState().undo();
        return;
      }

      event.preventDefault();
      useGraphStore.getState().redo();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const clearCanvas = () => {
    useGraphStore.getState().replaceGraph({ nodes: [], edges: [] });
    setUrlError(false);
  };

  const loadSample = () => {
    useGraphStore.getState().replaceGraph(sampleGraph);
    setUrlError(false);
  };

  const copyShareLink = async () => {
    const encoded = encodeStateToUrl({ nodes: useGraphStore.getState().nodes, edges: useGraphStore.getState().edges });
    const shareUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${encoded ? `#${encoded}` : ''}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.append(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }

      setCopyLabel('Copied');
    } catch {
      setCopyLabel('Copy failed');
    }

    window.setTimeout(() => setCopyLabel('Copy link'), 1400);
  };

  const triggerDownload = (href: string, filename: string, revokeUrl = false) => {
    const link = document.createElement('a');
    link.setAttribute('download', filename);
    link.href = href;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.append(link);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

    window.setTimeout(() => {
      link.remove();
      if (revokeUrl) URL.revokeObjectURL(href);
    }, 3000);
  };

  const exportJson = () => {
    try {
      const graph = toExportableGraph({ nodes: useGraphStore.getState().nodes, edges: useGraphStore.getState().edges });
      const json = JSON.stringify(graph, null, 2);
      const filename = `architecture-diagram-${new Date().toISOString().slice(0, 10)}.json`;
      const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
      triggerDownload(dataUrl, filename);
      setJsonLabel('Saved');
    } catch {
      setJsonLabel('Failed');
    }

    window.setTimeout(() => setJsonLabel('JSON'), 1600);
  };

  const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const graph = normalizeImportedGraph(parsed);
      if (!graph) throw new Error('Invalid graph');

      useGraphStore.getState().replaceGraph(graph);
      setImportLabel('Imported');
      setUrlError(false);
    } catch {
      setImportLabel('Invalid JSON');
    }

    window.setTimeout(() => setImportLabel('Import'), 1600);
  };

  const downloadImage = async () => {
    try {
      const flowPane = document.querySelector<HTMLElement>('.react-flow');
      if (!flowPane) throw new Error('React Flow pane not found');

      setImageLabel('Saving');
      const dataUrl = await toPng(flowPane, {
        backgroundColor: '#f8fafc',
        cacheBust: true,
        pixelRatio: 2,
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains('react-flow__panel')),
      });

      triggerDownload(dataUrl, `architecture-diagram-${new Date().toISOString().slice(0, 10)}.png`);
      setImageLabel('Saved');
    } catch {
      setImageLabel('Failed');
    }

    window.setTimeout(() => setImageLabel('PNG'), 1800);
  };

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
            <input
              accept="application/json,.json"
              className="hidden"
              onChange={importJson}
              ref={fileInputRef}
              type="file"
            />
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded bg-slate-900 text-white">
                <Link2 size={17} aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold">Serverless Architecture Diagram Editor</h1>
                <p className="truncate text-xs text-slate-500">State is compressed into the URL hash</p>
              </div>
            </div>

            {urlError && (
              <div className="mx-4 hidden rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 md:block">
                Corrupted URL state was ignored.
              </div>
            )}

            <div className="header-actions flex min-w-0 flex-wrap items-center justify-end gap-2">
              <div className="hidden items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 lg:flex">
                <span>{nodes.length} nodes</span>
                <span className="h-3 w-px bg-slate-300" />
                <span>{edges.length} edges</span>
                <span className="h-3 w-px bg-slate-300" />
                <span>{urlSize.toLocaleString()} hash chars</span>
              </div>
              <button className="icon-button" disabled={!canUndo} type="button" title="Undo" onClick={undo}>
                <Undo2 size={17} aria-hidden />
              </button>
              <button className="icon-button" disabled={!canRedo} type="button" title="Redo" onClick={redo}>
                <Redo2 size={17} aria-hidden />
              </button>
              <button className="secondary-button" type="button" onClick={loadSample}>
                <Network size={17} aria-hidden />
                <span>Sample</span>
              </button>
              <button className="secondary-button" type="button" onClick={copyShareLink}>
                <Copy size={17} aria-hidden />
                <span>{copyLabel}</span>
              </button>
              <button className="secondary-button" type="button" onClick={autoLayout}>
                <Wand2 size={17} aria-hidden />
                <span className="optional-button-text">Layout</span>
              </button>
              <button className="secondary-button" type="button" onClick={exportJson}>
                <FileDown size={17} aria-hidden />
                <span>{jsonLabel}</span>
              </button>
              <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
                <Upload size={17} aria-hidden />
                <span className="optional-button-text">{importLabel}</span>
              </button>
              <button className="icon-button" type="button" title="Clear canvas" onClick={clearCanvas}>
                <Trash2 size={17} aria-hidden />
              </button>
              <button className="primary-button" type="button" onClick={downloadImage}>
                <Download size={17} aria-hidden />
                <span>{imageLabel}</span>
              </button>
            </div>
          </header>
          {isHydrated ? (
            <ArchitectureCanvas />
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center bg-slate-50 text-sm text-slate-500">
              Loading diagram
            </div>
          )}
        </main>
        <Inspector />
      </div>
    </ReactFlowProvider>
  );
}
