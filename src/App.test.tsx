import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { sampleGraph } from './data/sampleGraph';
import { useGraphStore } from './store/useGraphStore';
import { decodeStateFromUrl, encodeStateToUrl } from './utils/urlUtils';

// Test shell lifecycle and shortcuts independently of browser geometry.
vi.mock('./components/ArchitectureCanvas', () => ({ ArchitectureCanvas: () => <div>Canvas</div> }));
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
  expect(screen.getByRole('status')).toHaveTextContent('JSON을 가져왔습니다');
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
  fireEvent.click(screen.getByRole('button', { name: /데이터베이스\s*6/ }));
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
  expect(useGraphStore.getState().nodes).toHaveLength(0);
  expect(screen.getByText('파일', { selector: 'summary' }).closest('details')?.open).toBe(false);
  expect(screen.getByRole('status')).toHaveTextContent('실행 취소');
  fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
  expect(useGraphStore.getState().nodes).toHaveLength(8);
});
