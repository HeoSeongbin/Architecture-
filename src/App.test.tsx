import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { sampleGraph } from './data/sampleGraph';
import { useGraphStore } from './store/useGraphStore';
import { decodeStateFromUrl, encodeStateToUrl } from './utils/urlUtils';
import { StrictMode } from 'react';
import * as urlUtils from './utils/urlUtils';

// Test shell lifecycle and shortcuts independently of browser geometry.
vi.mock('./components/ArchitectureCanvas', () => ({ ArchitectureCanvas: () => <div>Canvas</div> }));

it('does not rehydrate or erase edits under StrictMode and skips compression for selection and measurements', () => {
  window.history.replaceState(null, '', `#${encodeStateToUrl(sampleGraph)}`);
  const encode = vi.spyOn(urlUtils, 'encodeStateToUrl');
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  act(() => useGraphStore.getState().selectAll());
  act(() => useGraphStore.getState().onNodesChange([{ type: 'dimensions', id: 'react', dimensions: { width: 208, height: 112 } }]));
  act(() => vi.advanceTimersByTime(500));
  expect(encode).not.toHaveBeenCalled();
  act(() => useGraphStore.getState().onNodesChange([{ type: 'position', id: 'react', position: { x: 111, y: 222 }, dragging: true }]));
  act(() => vi.advanceTimersByTime(500));
  expect(encode).not.toHaveBeenCalled();
  act(() => useGraphStore.getState().onNodesChange([{ type: 'position', id: 'react', position: { x: 111, y: 222 }, dragging: false }]));
  act(() => vi.advanceTimersByTime(400));
  expect(encode).toHaveBeenCalledTimes(1);
  expect(decodeStateFromUrl(window.location.hash).state.nodes[0].position).toEqual({ x: 111, y: 222 });
  encode.mockRestore();
});

it('preserves current work for invalid external hash and confirms valid external replacement with undo', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '샘플' }));
  const originalHash = window.location.hash;
  const original = useGraphStore.getState().nodes;
  act(() => {
    window.history.replaceState(null, '', '#broken');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(useGraphStore.getState().nodes).toBe(original);
  expect(window.location.hash).toBe(originalHash);
  expect(screen.getByRole('alert')).toHaveTextContent('현재 작업은 유지');
  act(() => {
    window.history.replaceState(null, '', '/Architecture-/');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(screen.getByRole('alertdialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(useGraphStore.getState().nodes).toBe(original);
  act(() => {
    window.history.replaceState(null, '', '/Architecture-/');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  fireEvent.click(screen.getByRole('button', { name: '교체하기' }));
  expect(useGraphStore.getState().nodes).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
  act(() => vi.advanceTimersByTime(400));
  expect(decodeStateFromUrl(window.location.hash).state.nodes).toHaveLength(8);
});

it('rejects oversized files before reading and prevents a pending import from overwriting new edits', async () => {
  render(<App />);
  const text = vi.fn();
  await act(async () =>
    fireEvent.change(screen.getByLabelText('다이어그램 JSON 파일'), { target: { files: [{ size: 6 * 1024 * 1024, text }] } }),
  );
  expect(text).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('5 MiB');
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  fireEvent.change(screen.getByLabelText('다이어그램 JSON 파일'), { target: { files: [{ text: () => promise }] } });
  fireEvent.click(screen.getByRole('button', { name: '샘플' }));
  act(() => useGraphStore.getState().updateNodeData('react', { label: '읽는 동안 수정' }));
  await act(async () => resolve(JSON.stringify(sampleGraph)));
  expect(useGraphStore.getState().nodes[0].data.label).toBe('읽는 동안 수정');
  expect(screen.getByRole('alert')).toHaveTextContent('가져오기를 중단');
});

it('keeps a JSON import pending until replacement is confirmed and synchronizes it immediately', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '샘플' }));
  const graph = structuredClone(sampleGraph);
  graph.nodes[0].data.label = '가져온 문서';
  await act(async () =>
    fireEvent.change(screen.getByLabelText('다이어그램 JSON 파일'), {
      target: { files: [{ text: async () => JSON.stringify({ version: 1, ...graph }) }] },
    }),
  );
  expect(useGraphStore.getState().nodes[0].data.label).not.toBe('가져온 문서');
  fireEvent.click(screen.getByRole('button', { name: '교체하기' }));
  expect(decodeStateFromUrl(window.location.hash).state.nodes[0].data.label).toBe('가져온 문서');
});

it('warns for oversized URLs and allows JSON backup without overwriting a valid saved URL', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '샘플' }));
  const hash = window.location.hash;
  const encode = vi.spyOn(urlUtils, 'encodeStateToUrl').mockReturnValue('a'.repeat(65000));
  act(() => useGraphStore.getState().updateNodeData('react', { label: '크기 초과' }));
  act(() => vi.advanceTimersByTime(400));
  expect(window.location.hash).toBe(hash);
  expect(screen.getByRole('alert')).toHaveTextContent('JSON으로 내보내세요');
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  encode.mockRestore();
});

it('does not lose a pending URL save when external navigation is invalid', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '샘플' }));
  act(() => useGraphStore.getState().updateNodeData('react', { label: '저장 대기 중' }));
  act(() => {
    window.history.replaceState(null, '', '#broken');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(decodeStateFromUrl(window.location.hash).state.nodes[0].data.label).toBe('저장 대기 중');
  expect(screen.getByRole('alert')).toHaveTextContent('현재 작업은 유지');
});

it('exports versioned JSON, retains a retry link and releases its Blob URL', async () => {
  let exported!: Blob;
  const revoke = vi.fn();
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob: Blob) => {
      exported = blob;
      return 'blob:json-backup';
    }),
    revokeObjectURL: revoke,
  });
  const { unmount } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '샘플' }));
  let download = '';
  const capture = (event: MouseEvent) => {
    if (event.target instanceof HTMLAnchorElement && event.target.download.endsWith('.json')) {
      download = event.target.href;
      event.preventDefault();
    }
  };
  document.addEventListener('click', capture);
  fireEvent.click(screen.getByText('파일', { selector: 'summary' }));
  fireEvent.click(screen.getByRole('button', { name: 'JSON 내보내기' }));
  document.removeEventListener('click', capture);
  const graph = JSON.parse(await exported.text());
  expect(graph.version).toBe(1);
  expect(graph.nodes).toHaveLength(8);
  const backup = screen.getByRole('link', { name: 'JSON 백업 다운로드' });
  expect(backup.getAttribute('href')).toBe(download);
  expect(backup.getAttribute('download')).toMatch(/^architecture-diagram-.*\.json$/);
  act(() => useGraphStore.getState().updateNodeData('react', { label: '백업 이후 편집' }));
  expect(backup.getAttribute('href')).toBe(download);
  fireEvent.click(screen.getByRole('button', { name: 'JSON 백업 링크 닫기' }));
  expect(screen.queryByRole('link', { name: 'JSON 백업 다운로드' })).not.toBeInTheDocument();
  expect(revoke).toHaveBeenCalledWith('blob:json-backup');
  const encode = vi.spyOn(urlUtils, 'encodeStateToUrl').mockReturnValue('a'.repeat(8100));
  act(() => useGraphStore.getState().updateNodeData('react', { label: '공유 주의' }));
  act(() => vi.advanceTimersByTime(400));
  expect(screen.getByRole('alert')).toHaveTextContent('8,000자');
  encode.mockRestore();
  unmount();
});
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  window.history.replaceState(null, '', '/Architecture-/');
  useGraphStore.getState().setGraph({ nodes: [], edges: [] });
  useGraphStore.setState({ clipboard: null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('hydrates an existing link and updates it after an edit with debounce', () => {
  window.history.replaceState(null, '', `#${encodeStateToUrl(sampleGraph)}`);
  render(<App />);
  expect(useGraphStore.getState().nodes).toHaveLength(8);
  act(() => useGraphStore.getState().updateNodeData('react', { label: 'URL 변경' }));
  act(() => vi.advanceTimersByTime(400));
  expect(decodeStateFromUrl(window.location.hash).state.nodes[0].data.label).toBe('URL 변경');
});

it('supports editor undo while leaving input undo to the browser', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '샘플' }));
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(useGraphStore.getState().nodes).toHaveLength(0);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
  expect(useGraphStore.getState().nodes).toHaveLength(8);
  fireEvent.keyDown(screen.getByPlaceholderText('자산 검색'), { key: 'z', ctrlKey: true });
  expect(useGraphStore.getState().nodes).toHaveLength(8);
});

it('shows an error for a corrupt link without crashing', () => {
  window.history.replaceState(null, '', '#invalid');
  render(<App />);
  expect(screen.getByRole('alert')).toHaveTextContent('공유 URL을 복원하지 못했습니다');
  expect(useGraphStore.getState().nodes).toHaveLength(0);
});

it('switches and remembers theme without changing graph or shared data', () => {
  window.history.replaceState(null, '', `#${encodeStateToUrl(sampleGraph)}`);
  const view = render(<App />);
  const hash = window.location.hash;
  const graph = useGraphStore.getState().nodes;
  fireEvent.click(screen.getByRole('button', { name: '다크 모드로 전환' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('architecture-editor-theme')).toBe('dark');
  expect(useGraphStore.getState().nodes).toBe(graph);
  expect(window.location.hash).toBe(hash);
  view.unmount();
  render(<App />);
  expect(screen.getByRole('button', { name: '라이트 모드로 전환' })).toBeInTheDocument();
});

it('uses the system theme and tolerates disabled storage', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('disabled');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('disabled');
  });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-color'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  render(<App />);
  expect(screen.getByRole('button', { name: '라이트 모드로 전환' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '라이트 모드로 전환' }));
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('keeps narrow-screen panels out of the tab order and closes them with Escape', () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  render(<App />);
  expect(screen.queryByRole('complementary', { name: '아키텍처 자산' })).not.toBeInTheDocument();
  const opener = screen.getByRole('button', { name: '자산 패널' });
  opener.focus();
  fireEvent.click(opener);
  expect(opener).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('complementary', { name: '아키텍처 자산' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '속성 패널' }));
  expect(screen.queryByRole('complementary', { name: '아키텍처 자산' })).not.toBeInTheDocument();
  expect(screen.getByRole('complementary', { name: '선택 항목 속성' })).toBeVisible();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('complementary', { name: '선택 항목 속성' })).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

it('moves skip-link focus without replacing the diagram hash', () => {
  window.history.replaceState(null, '', `#${encodeStateToUrl(sampleGraph)}`);
  render(<App />);
  const hash = window.location.hash;
  fireEvent.click(screen.getByRole('link', { name: '캔버스로 건너뛰기' }));
  expect(screen.getByRole('main')).toHaveFocus();
  expect(window.location.hash).toBe(hash);
});

it('reports invalid JSON and preserves the current graph', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '샘플' }));
  const graph = useGraphStore.getState().nodes;
  await act(async () =>
    fireEvent.change(screen.getByLabelText('다이어그램 JSON 파일'), { target: { files: [{ text: async () => '{invalid' }] } }),
  );
  expect(screen.getByRole('alert')).toHaveTextContent('현재 작업은 유지됩니다');
  expect(useGraphStore.getState().nodes).toBe(graph);
});

it('imports existing JSON and restores the previous diagram through undo', async () => {
  render(<App />);
  await act(async () =>
    fireEvent.change(screen.getByLabelText('다이어그램 JSON 파일'), {
      target: { files: [{ text: async () => JSON.stringify(sampleGraph) }] },
    }),
  );
  expect(screen.getByRole('status')).toHaveTextContent('다이어그램을 불러왔습니다');
  expect(useGraphStore.getState().nodes).toHaveLength(8);
  fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
  expect(useGraphStore.getState().nodes).toHaveLength(0);
});

it('reports clipboard failure instead of claiming success', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
  });
  render(<App />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '링크 복사' })));
  expect(screen.getByRole('alert')).toHaveTextContent('링크를 복사하지 못했습니다');
});

it('adds assets by click with undo support and collapses categories', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /PostgreSQL.*Relational database/ }));
  expect(useGraphStore.getState().nodes).toHaveLength(1);
  expect(useGraphStore.getState().nodes[0].data.kind).toBe('postgresql');
  fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
  expect(useGraphStore.getState().nodes).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: /데이터베이스\s*8/ }));
  expect(screen.queryByRole('button', { name: /PostgreSQL.*Relational database/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('자산 검색'), { target: { value: 'PostgreSQL' } });
  expect(screen.getByRole('button', { name: /PostgreSQL.*Relational database/ })).toBeVisible();
});

it('edits global label display through the view menu and keeps URL compatibility', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '샘플' }));
  fireEvent.click(screen.getByText('보기', { selector: 'summary' }));
  fireEvent.change(screen.getByLabelText('연결선 라벨'), { target: { value: 'hidden' } });
  act(() => vi.advanceTimersByTime(400));
  expect(decodeStateFromUrl(window.location.hash).state.edges.every((edge) => edge.data?.labelMode === 'hidden')).toBe(true);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByText('보기', { selector: 'summary' }).closest('details')?.open).toBe(false);
});

it('starts a new diagram from the file menu without losing undo history', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '샘플' }));
  fireEvent.click(screen.getByText('파일', { selector: 'summary' }));
  fireEvent.click(screen.getByRole('button', { name: '새 다이어그램' }));
  expect(screen.getByRole('alertdialog')).toBeVisible();
  expect(useGraphStore.getState().nodes).toHaveLength(8);
  fireEvent.click(screen.getByRole('button', { name: '교체하기' }));
  expect(useGraphStore.getState().nodes).toHaveLength(0);
  expect(screen.getByText('파일', { selector: 'summary' }).closest('details')?.open).toBe(false);
  expect(screen.getByRole('status')).toHaveTextContent('실행 취소');
  fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
  expect(useGraphStore.getState().nodes).toHaveLength(8);
});

it('copies, pastes, duplicates and deletes multi-selections using editor shortcuts', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '샘플' }));
  fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
  fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
  fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
  expect(useGraphStore.getState().nodes).toHaveLength(16);
  expect(useGraphStore.getState().edges).toHaveLength(14);
  fireEvent.keyDown(window, { key: 'd', metaKey: true });
  expect(useGraphStore.getState().nodes).toHaveLength(24);
  fireEvent.keyDown(window, { key: 'Delete' });
  expect(useGraphStore.getState().nodes).toHaveLength(16);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(useGraphStore.getState().nodes).toHaveLength(24);
});

it('leaves copy/paste/select-all/delete shortcuts to text fields', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /PostgreSQL.*Relational database/ }));
  const input = screen.getByLabelText('이름');
  for (const key of ['a', 'c', 'v', 'd', 'Backspace', 'Delete']) fireEvent.keyDown(input, { key, ctrlKey: true });
  expect(useGraphStore.getState().nodes).toHaveLength(1);
  expect(useGraphStore.getState().clipboard).toBeNull();
});
