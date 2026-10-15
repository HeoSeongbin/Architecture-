import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { ReactFlowProvider } from '@xyflow/react';
import { ArchitectureCanvas } from './components/ArchitectureCanvas';
import { Inspector } from './components/Inspector';
import { Sidebar } from './components/Sidebar';
import { sampleGraph } from './data/sampleGraph';
import { useGraphStore } from './store/useGraphStore';
import { normalizeImportedGraph, toExportableGraph } from './utils/jsonUtils';
import { decodeStateFromUrl, encodeStateToUrl } from './utils/urlUtils';
import { EditorToolbar } from './components/EditorToolbar';
import { useEditorTheme } from './hooks/useEditorTheme';
import { useNarrowScreen } from './hooks/useNarrowScreen';

export default function App() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [urlError, setUrlError] = useState(false);
  const [feedback, setFeedback] = useState({
    text: '변경 내용은 URL에 자동 반영됩니다. 파일 백업은 JSON 내보내기를 이용하세요.',
    error: false,
  });
  const [busy, setBusy] = useState(false);
  const [activePanel, setActivePanel] = useState<'assets' | 'inspector' | null>(null);
  const { theme, toggleTheme } = useEditorTheme();
  const narrow = useNarrowScreen();
  const panelOpener = useRef<HTMLElement | null>(null);
  const notify = (text: string, error = false) => {
    setUrlError(false);
    setFeedback({ text, error });
  };
  const [showCanvasGrid, setShowCanvasGrid] = useState(true);
  const replaceTimer = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const canUndo = useGraphStore((state) => state.canUndo);
  const canRedo = useGraphStore((state) => state.canRedo);
  const undo = useGraphStore((state) => state.undo);
  const redo = useGraphStore((state) => state.redo);
  const autoLayout = useGraphStore((state) => state.autoLayout);
  const setAllEdgeLabelModes = useGraphStore((state) => state.setAllEdgeLabelModes);
  const encodedState = encodeStateToUrl({ nodes, edges });
  const urlSize = encodedState.length;
  const edgeLabelModes = new Set(edges.map((edge) => edge.data?.labelMode ?? (edge.data?.showEndpoints ? 'compact' : 'protocol')));
  const globalLabelMode = edgeLabelModes.size === 1 ? Array.from(edgeLabelModes)[0] : 'mixed';

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
      if (event.key === 'Escape') {
        document.querySelectorAll<HTMLDetailsElement>('.tool-menu[open]').forEach((menu) => {
          menu.open = false;
          menu.querySelector('summary')?.focus();
        });
        setActivePanel(null);
        if (narrow && activePanel) panelOpener.current?.focus();
      }
      const isModifierPressed = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (!isModifierPressed || (key !== 'z' && key !== 'y')) return;

      const target = event.target;
      const isEditing = target instanceof Element && target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])');
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
  }, [narrow, activePanel]);

  const clearCanvas = () => {
    useGraphStore.getState().replaceGraph({ nodes: [], edges: [] });
    setUrlError(false);
    notify('캔버스를 비웠습니다. 실행 취소로 이전 작업을 복원할 수 있습니다.');
  };

  const loadSample = () => {
    useGraphStore.getState().replaceGraph(sampleGraph);
    setUrlError(false);
    notify('샘플을 불러왔습니다. 기존 작업은 실행 취소로 복원할 수 있습니다.');
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
        const focused = document.activeElement;
        document.body.append(textarea);
        textarea.select();
        try {
          if (!document.execCommand('copy')) throw new Error('Copy failed');
        } finally {
          textarea.remove();
          if (focused instanceof HTMLElement) focused.focus();
        }
      }

      notify('공유 링크를 복사했습니다.');
    } catch {
      notify('링크를 복사하지 못했습니다. 주소를 직접 복사하거나 JSON을 내보내세요.', true);
    }
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
      notify('JSON 다운로드를 요청했습니다. 브라우저 다운로드 목록을 확인하세요.');
    } catch {
      notify('JSON을 내보내지 못했습니다.', true);
    }
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
      notify('JSON을 가져왔습니다. 이전 작업은 실행 취소로 복원할 수 있습니다.');
      setUrlError(false);
    } catch {
      notify('올바른 다이어그램 JSON이 아닙니다. 현재 작업은 유지됩니다.', true);
    }
  };

  const downloadImage = async () => {
    setBusy(true);
    try {
      const flowPane = document.querySelector<HTMLElement>('.react-flow');
      if (!flowPane) throw new Error('React Flow pane not found');

      notify('현재 화면을 PNG로 만드는 중입니다…');
      const dataUrl = await toPng(flowPane, {
        backgroundColor: theme === 'dark' ? '#111827' : '#f8fafc',
        cacheBust: true,
        pixelRatio: 2,
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains('react-flow__panel')),
      });

      triggerDownload(dataUrl, `architecture-diagram-${new Date().toISOString().slice(0, 10)}.png`);
      notify('PNG 다운로드를 요청했습니다. 현재 화면 밖의 요소는 포함되지 않습니다.');
    } catch {
      notify('PNG를 만들지 못했습니다. 다시 시도하거나 JSON으로 백업하세요.', true);
    } finally {
      setBusy(false);
    }
  };

  const togglePanel = (panel: 'assets' | 'inspector') => {
    panelOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActivePanel((value) => (value === panel ? null : panel));
  };
  const closePanel = () => {
    setActivePanel(null);
    panelOpener.current?.focus();
  };
  const layout = async () => {
    setBusy(true);
    try {
      await autoLayout();
      notify('자동 정렬 요청을 처리했습니다. 전체 보기로 배치를 확인하세요.');
    } catch {
      notify('자동 정렬을 완료하지 못했습니다.', true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ReactFlowProvider>
      <div className="editor-shell" data-theme={theme}>
        <a
          className="skip-link"
          href="#diagram-workspace"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById('diagram-workspace')?.focus();
          }}
        >
          캔버스로 건너뛰기
        </a>
        <EditorToolbar
          canUndo={canUndo}
          canRedo={canRedo}
          undo={undo}
          redo={redo}
          clear={clearCanvas}
          sample={loadSample}
          layout={() => void layout()}
          copy={() => void copyShareLink()}
          importJson={() => fileInputRef.current?.click()}
          exportJson={exportJson}
          exportPng={() => void downloadImage()}
          theme={theme}
          toggleTheme={toggleTheme}
          grid={showCanvasGrid}
          toggleGrid={() => setShowCanvasGrid((value) => !value)}
          labelMode={globalLabelMode}
          setLabelMode={setAllEdgeLabelModes}
          busy={busy}
          narrow={narrow}
          activePanel={activePanel}
          togglePanel={togglePanel}
        />
        <input
          aria-label="다이어그램 JSON 파일"
          accept="application/json,.json"
          className="hidden"
          onChange={importJson}
          ref={fileInputRef}
          type="file"
        />
        <div className="editor-body">
          <div id="assets-panel" className="editor-panel assets-panel" hidden={narrow && activePanel !== 'assets'}>
            {narrow && (
              <button className="panel-close secondary-button" onClick={closePanel}>
                자산 패널 닫기
              </button>
            )}
            <Sidebar onAdded={narrow ? closePanel : undefined} />
          </div>
          <main id="diagram-workspace" className="editor-workspace" tabIndex={-1} aria-label="다이어그램 캔버스">
            {isHydrated ? (
              <ArchitectureCanvas showGrid={showCanvasGrid} theme={theme} />
            ) : (
              <div className="canvas-loading">다이어그램을 불러오는 중…</div>
            )}
          </main>
          <div id="inspector-panel" className="editor-panel inspector-panel" hidden={narrow && activePanel !== 'inspector'}>
            {narrow && (
              <button className="panel-close secondary-button" onClick={closePanel}>
                속성 패널 닫기
              </button>
            )}
            <Inspector />
          </div>
        </div>
        <footer className="editor-footer">
          {urlError ? (
            <p role="alert">공유 URL을 복원하지 못했습니다. 링크를 확인하거나 JSON 백업을 가져오세요.</p>
          ) : (
            <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'feedback-error' : ''}>
              {feedback.text}
            </p>
          )}
          <span className="diagram-stats">
            노드 {nodes.length} · 연결 {edges.length} · URL {urlSize.toLocaleString()}자
          </span>
        </footer>
      </div>
    </ReactFlowProvider>
  );
}
