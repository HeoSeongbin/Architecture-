import { useGraphPersistence } from './hooks/useGraphPersistence';
import { ReplaceGraphDialog } from './components/ReplaceGraphDialog';
import { DEFAULT_LAYOUT } from './utils/layoutGraph';
import { DATA_VERSION, GRAPH_LIMITS, URL_MAX_LENGTH } from './utils/graphValidation';
import type { GraphState } from './types/graph';
import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { ReactFlowProvider } from '@xyflow/react';
import { ArchitectureCanvas } from './components/ArchitectureCanvas';
import { Inspector } from './components/Inspector';
import { Sidebar } from './components/Sidebar';
import { sampleGraph } from './data/sampleGraph';
import { useGraphStore } from './store/useGraphStore';
import { parseImportedGraph, toExportableGraph } from './utils/jsonUtils';
import { encodeStateToUrl } from './utils/urlUtils';
import { EditorToolbar } from './components/EditorToolbar';
import { useEditorTheme } from './hooks/useEditorTheme';
import { useNarrowScreen } from './hooks/useNarrowScreen';

export default function App() {
  const persistence = useGraphPersistence();
  const [replacement, setReplacement] = useState<{ title: string; graph: GraphState } | null>(null);
  const [layoutOptions, setLayoutOptions] = useState(DEFAULT_LAYOUT);
  const importRequest = useRef(0);
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
    setFeedback({ text, error });
  };
  const [showCanvasGrid, setShowCanvasGrid] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const canUndo = useGraphStore((state) => state.canUndo);
  const canRedo = useGraphStore((state) => state.canRedo);
  const undo = useGraphStore((state) => state.undo);
  const redo = useGraphStore((state) => state.redo);
  const autoLayout = useGraphStore((state) => state.autoLayout);
  const setAllEdgeLabelModes = useGraphStore((state) => state.setAllEdgeLabelModes);
  const edgeLabelModes = new Set(edges.map((edge) => edge.data?.labelMode ?? (edge.data?.showEndpoints ? 'compact' : 'protocol')));
  const globalLabelMode = edgeLabelModes.size === 1 ? Array.from(edgeLabelModes)[0] : 'mixed';

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
      if (document.querySelector('[role="alertdialog"]')) return;
      const isModifierPressed = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      const target = event.target;
      const isEditing =
        target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
      if (isEditing) return;
      const store = useGraphStore.getState();
      if (key === 'delete' || key === 'backspace') {
        if (
          store.nodes.some((node) => node.selected) ||
          store.selectedNodeId ||
          store.edges.some((edge) => edge.selected) ||
          store.selectedEdgeId
        ) {
          event.preventDefault();
          store.deleteSelection();
        }
        return;
      }
      if (!isModifierPressed) return;
      if (['a', 'c', 'v', 'd'].includes(key)) {
        event.preventDefault();
        if (key === 'a') store.selectAll();
        if (key === 'c') store.copySelection();
        if (key === 'v') store.pasteSelection();
        if (key === 'd') store.duplicateSelection();
        return;
      }
      if (key !== 'z' && key !== 'y') return;

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

  const replace = (title: string, graph: GraphState) => {
    const current = useGraphStore.getState();
    if (current.nodes.length || current.edges.length) setReplacement({ title, graph });
    else {
      current.replaceGraph(graph);
      persistence.flush();
      notify('다이어그램을 불러왔습니다. 실행 취소로 복원할 수 있습니다.');
    }
  };
  const clearCanvas = () => replace('새 다이어그램으로 교체할까요?', { nodes: [], edges: [] });
  const loadSample = () => replace('샘플로 교체할까요?', sampleGraph);

  const copyShareLink = async () => {
    try {
      const encoded = encodeStateToUrl(useGraphStore.getState());
      const shareUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${encoded ? `#${encoded}` : ''}`;
      if (shareUrl.length > URL_MAX_LENGTH) {
        notify('공유 URL이 너무 깁니다. JSON으로 내보내세요.', true);
        return;
      }
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
    link.click();

    window.setTimeout(() => {
      link.remove();
      if (revokeUrl) URL.revokeObjectURL(href);
    }, 3000);
  };

  const exportJson = () => {
    try {
      const graph = toExportableGraph({ nodes: useGraphStore.getState().nodes, edges: useGraphStore.getState().edges });
      const json = JSON.stringify({ version: DATA_VERSION, ...graph }, null, 2);
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

    const request = ++importRequest.current;
    const before = JSON.stringify(toExportableGraph(useGraphStore.getState()));
    try {
      if (file.size > GRAPH_LIMITS.bytes) throw new Error('JSON 파일은 5 MiB 이하여야 합니다.');
      const text = await file.text();
      if (new TextEncoder().encode(text).length > GRAPH_LIMITS.bytes) throw new Error('JSON 파일은 5 MiB 이하여야 합니다.');
      const graph = parseImportedGraph(JSON.parse(text));
      if (request !== importRequest.current) return;
      if (before !== JSON.stringify(toExportableGraph(useGraphStore.getState()))) {
        notify('파일을 읽는 동안 작업이 변경되어 가져오기를 중단했습니다. 다시 가져오세요.', true);
        return;
      }
      replace('JSON 다이어그램으로 교체할까요?', graph);
    } catch (error) {
      if (request === importRequest.current)
        notify(`올바른 다이어그램 JSON이 아닙니다. ${error instanceof Error ? error.message : ''} 현재 작업은 유지됩니다.`, true);
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
      const result = await autoLayout(layoutOptions);
      notify(
        result === undefined
          ? '정렬할 노드가 없습니다.'
          : result === 'stale'
            ? '정렬 중 작업이 변경되어 결과를 적용하지 않았습니다.'
            : result === 'fallback'
              ? '정렬 엔진 오류로 기본 배치를 적용했습니다. 실행 취소할 수 있습니다.'
              : '자동 정렬을 적용했습니다. 전체 보기로 배치를 확인하세요.',
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : '자동 정렬을 완료하지 못했습니다.', true);
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
          layoutOptions={layoutOptions}
          setLayoutOptions={setLayoutOptions}
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
            {persistence.hydrated ? (
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
        {(replacement || persistence.external) && (
          <ReplaceGraphDialog
            title={replacement?.title ?? '다른 공유 URL을 불러올까요?'}
            cancel={() => {
              setReplacement(null);
              persistence.clearExternal();
            }}
            apply={() => {
              const graph = replacement?.graph ?? persistence.external;
              if (graph) useGraphStore.getState().replaceGraph(graph);
              persistence.flush();
              setReplacement(null);
              persistence.clearExternal();
              notify('다이어그램을 교체했습니다. 실행 취소로 복원할 수 있습니다.');
            }}
          />
        )}
        <footer className="editor-footer">
          {persistence.message ? (
            <p role="alert">{persistence.message}</p>
          ) : (
            <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'feedback-error' : ''}>
              {feedback.text}
            </p>
          )}
          <span className="diagram-stats">
            노드 {nodes.length} · 연결 {edges.length} · URL {persistence.urlSize.toLocaleString()}자
          </span>
        </footer>
      </div>
    </ReactFlowProvider>
  );
}
