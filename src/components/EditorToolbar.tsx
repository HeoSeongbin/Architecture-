import { LayoutSettings } from './LayoutSettings';
import type { LayoutOptions } from '../utils/layoutGraph';
import { useReactFlow } from '@xyflow/react';
import {
  Copy,
  Download,
  FileDown,
  Grid3X3,
  Maximize,
  Moon,
  Network,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Sun,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { ArchitectureEdgeData } from '../types/graph';
import type { EditorTheme } from '../hooks/useEditorTheme';
import { useEffect } from 'react';
import { useGraphStore } from '../store/useGraphStore';
type LabelMode = NonNullable<ArchitectureEdgeData['labelMode']>;
interface Props {
  layoutOptions: LayoutOptions;
  setLayoutOptions: (value: LayoutOptions) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  sample: () => void;
  layout: () => void;
  copy: () => void;
  importJson: () => void;
  exportJson: () => void;
  exportPng: () => void;
  theme: EditorTheme;
  toggleTheme: () => void;
  grid: boolean;
  toggleGrid: () => void;
  labelMode: LabelMode | 'mixed';
  setLabelMode: (mode: LabelMode) => void;
  busy: boolean;
  narrow: boolean;
  activePanel: 'assets' | 'inspector' | null;
  togglePanel: (panel: 'assets' | 'inspector') => void;
}
export function EditorToolbar(p: Props) {
  const flow = useReactFlow();
  const hasNodes = useGraphStore((state) => Boolean(state.selectedNodeId) || state.nodes.some((node) => node.selected));
  const hasSelection = useGraphStore(
    (state) =>
      Boolean(state.selectedNodeId || state.selectedEdgeId) ||
      state.nodes.some((node) => node.selected) ||
      state.edges.some((edge) => edge.selected),
  );
  const canPaste = useGraphStore((state) => Boolean(state.clipboard?.nodes.length));
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      document.querySelectorAll<HTMLDetailsElement>('.tool-menu[open]').forEach((menu) => {
        if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
      });
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);
  return (
    <header className="editor-header">
      <div className="editor-brand">
        <span className="brand-mark">A</span>
        <div>
          <h1>아키텍처 에디터</h1>
          <p>설계하고, 연결하고, 공유하세요</p>
        </div>
      </div>
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label="다이어그램 도구"
        onClick={(event) => {
          if (!(event.target instanceof Element)) return;
          const button = event.target.closest('button');
          const menu = button?.closest('details');
          if (menu) {
            menu.open = false;
            menu.querySelector('summary')?.focus();
          }
        }}
      >
        <LayoutSettings value={p.layoutOptions} change={p.setLayoutOptions} apply={p.layout} busy={p.busy} />
        {p.narrow && (
          <button
            className="icon-button"
            aria-label="자산 패널"
            aria-controls="assets-panel"
            aria-expanded={p.activePanel === 'assets'}
            onClick={() => p.togglePanel('assets')}
          >
            <PanelLeft size={18} />
          </button>
        )}
        <div className="tool-group" role="group" aria-label="편집 기록">
          <button className="icon-button" aria-label="실행 취소" title="실행 취소 (Ctrl/⌘+Z)" disabled={!p.canUndo} onClick={p.undo}>
            <Undo2 size={17} />
          </button>
          <button className="icon-button" aria-label="다시 실행" title="다시 실행 (Ctrl/⌘+Shift+Z)" disabled={!p.canRedo} onClick={p.redo}>
            <Redo2 size={17} />
          </button>
        </div>
        <details className="tool-menu" name="editor-tools">
          <summary>파일</summary>
          <div className="tool-menu-content">
            <button onClick={p.clear}>
              <Plus size={16} />새 다이어그램
            </button>
            <button onClick={p.importJson}>
              <Upload size={16} />
              JSON 가져오기
            </button>
            <button onClick={p.exportJson}>
              <FileDown size={16} />
              JSON 내보내기
            </button>
            <button disabled={p.busy} onClick={p.exportPng}>
              <Download size={16} />
              {p.busy ? '이미지 생성 중…' : 'PNG 내보내기'}
            </button>
            <button className="menu-danger" onClick={p.clear}>
              <Trash2 size={16} />
              캔버스 비우기
            </button>
          </div>
        </details>
        <details className="tool-menu" name="editor-tools">
          <summary>편집</summary>
          <div className="tool-menu-content">
            <button onClick={() => useGraphStore.getState().selectAll()}>
              전체 선택 <kbd>Ctrl/⌘ A</kbd>
            </button>
            <button disabled={!hasNodes} onClick={() => useGraphStore.getState().copySelection()}>
              선택 복사 <kbd>Ctrl/⌘ C</kbd>
            </button>
            <button disabled={!canPaste} onClick={() => useGraphStore.getState().pasteSelection()}>
              붙여넣기 <kbd>Ctrl/⌘ V</kbd>
            </button>
            <button disabled={!hasNodes} onClick={() => useGraphStore.getState().duplicateSelection()}>
              선택 복제 <kbd>Ctrl/⌘ D</kbd>
            </button>
            <button disabled={!hasNodes} onClick={() => useGraphStore.getState().groupSelection()}>
              선택을 그룹으로
            </button>
            <button disabled={!hasSelection} onClick={() => useGraphStore.getState().deleteSelection()}>
              선택 삭제 <kbd>Delete</kbd>
            </button>
          </div>
        </details>
        {p.narrow ? (
          <details className="tool-menu" name="editor-tools">
            <summary>배치</summary>
            <div className="tool-menu-content">
              <button onClick={p.sample}>
                <Network size={16} />
                샘플
              </button>
              <button disabled={p.busy} onClick={p.layout}>
                <Wand2 size={16} />
                자동 정렬
              </button>
            </div>
          </details>
        ) : (
          <div className="tool-group" role="group" aria-label="다이어그램 배치">
            <button className="secondary-button" onClick={p.sample}>
              <Network size={16} />
              <span>샘플</span>
            </button>
            <button className="secondary-button" disabled={p.busy} onClick={p.layout}>
              <Wand2 size={16} />
              <span>자동 정렬</span>
            </button>
          </div>
        )}
        <details className="tool-menu" name="editor-tools">
          <summary>보기</summary>
          <div className="tool-menu-content">
            <button onClick={() => void flow.fitView({ padding: 0.25 })}>
              <Maximize size={16} />
              전체 보기
            </button>
            <button onClick={() => void flow.zoomIn()}>
              <ZoomIn size={16} />
              확대
            </button>
            <button onClick={() => void flow.zoomOut()}>
              <ZoomOut size={16} />
              축소
            </button>
            <button aria-pressed={p.grid} onClick={p.toggleGrid}>
              <Grid3X3 size={16} />
              {p.grid ? '격자 숨기기' : '격자 표시'}
            </button>
            <label htmlFor="global-label-mode">연결선 라벨</label>
            <select
              id="global-label-mode"
              className="field-input"
              value={p.labelMode}
              onChange={(event) => p.setLabelMode(event.target.value as LabelMode)}
            >
              {p.labelMode === 'mixed' && <option value="mixed">혼합</option>}
              <option value="hidden">숨김</option>
              <option value="protocol">프로토콜</option>
              <option value="compact">간략히</option>
              <option value="full">자세히</option>
            </select>
          </div>
        </details>
        <button className="primary-button" aria-label="링크 복사" title="공유 링크 복사" onClick={p.copy}>
          <Copy size={16} />
          {!p.narrow && <span>링크 복사</span>}
        </button>
        <button
          className="icon-button"
          aria-label={p.theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환'}
          onClick={p.toggleTheme}
        >
          {p.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        {p.narrow && (
          <button
            className="icon-button"
            aria-label="속성 패널"
            aria-controls="inspector-panel"
            aria-expanded={p.activePanel === 'inspector'}
            onClick={() => p.togglePanel('inspector')}
          >
            <PanelRight size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
