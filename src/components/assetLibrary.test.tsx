import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import { allAssets, architectureAssets } from '../data/assets';
import { architectureNodeKinds } from '../types/graph';
import { assetIcons } from '../utils/assetPresentation';
import { ASSET_PREFERENCES_KEY, useAssetPreferences } from '../store/useAssetPreferences';
import { useGraphStore } from '../store/useGraphStore';
import { encodeStateToUrl, decodeStateFromUrl } from '../utils/urlUtils';
import { parseImportedGraph, toExportableGraph } from '../utils/jsonUtils';
beforeEach(() => {
  localStorage.clear();
  useAssetPreferences.setState({ favorites: [], recent: [], storageUnavailable: false });
  useGraphStore.getState().setGraph({ nodes: [], edges: [] });
});
afterEach(() => vi.restoreAllMocks());
it('keeps the original assets and registers every new kind with an icon and two-format roundtrip', () => {
  expect(architectureAssets).toHaveLength(32);
  expect(allAssets).toHaveLength(33);
  expect(new Set(allAssets.map((asset) => asset.kind)).size).toBe(33);
  for (const asset of allAssets) {
    expect(architectureNodeKinds).toContain(asset.kind);
    expect(assetIcons[asset.kind]).toBeDefined();
    useGraphStore
      .getState()
      .addNode({ id: asset.kind, type: asset.isGroup ? 'groupNode' : 'architectureNode', position: { x: 0, y: 0 }, data: { ...asset } });
  }
  const graph = useGraphStore.getState();
  expect(decodeStateFromUrl(encodeStateToUrl(graph)).state.nodes).toHaveLength(33);
  expect(parseImportedGraph(toExportableGraph(graph)).nodes).toHaveLength(33);
  graph.undo();
  expect(useGraphStore.getState().nodes).toHaveLength(32);
  useGraphStore.getState().redo();
  expect(useGraphStore.getState().nodes).toHaveLength(33);
});
it('toggles favorites without adding nodes or touching history/hash and restores them after remount', () => {
  const view = render(
    <ReactFlowProvider>
      <Sidebar />
    </ReactFlowProvider>,
  );
  fireEvent.change(screen.getByPlaceholderText('자산 검색'), { target: { value: 'MySQL' } });
  const hash = window.location.hash;
  fireEvent.click(screen.getByRole('button', { name: 'MySQL 즐겨찾기 추가' }));
  expect(useGraphStore.getState().nodes).toHaveLength(0);
  expect(useGraphStore.getState().past).toHaveLength(0);
  expect(window.location.hash).toBe(hash);
  expect(JSON.parse(localStorage.getItem(ASSET_PREFERENCES_KEY)!).favorites).toEqual(['mysql']);
  view.unmount();
  useAssetPreferences.setState({ favorites: [] });
  render(
    <ReactFlowProvider>
      <Sidebar />
    </ReactFlowProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: '즐겨찾기' }));
  expect(screen.getByRole('button', { name: 'MySQL — Relational database' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Oracle — Enterprise database' })).toBeNull();
});
it('records only actual additions as recent, deduplicates, caps at eight and supports recent search', () => {
  const bounds = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) });
  const main = document.createElement('main');
  main.id = 'diagram-workspace';
  document.body.append(main);
  render(
    <ReactFlowProvider>
      <Sidebar />
    </ReactFlowProvider>,
  );
  fireEvent.change(screen.getByPlaceholderText('자산 검색'), { target: { value: 'MySQL' } });
  fireEvent.click(screen.getByRole('button', { name: 'MySQL — Relational database' }));
  expect(useAssetPreferences.getState().recent).toEqual(['mysql']);
  act(() => {
    for (const asset of architectureAssets.slice(0, 10)) useAssetPreferences.getState().recordUse(asset.kind);
    useAssetPreferences.getState().recordUse('mysql');
    useAssetPreferences.getState().recordUse('mysql');
  });
  expect(useAssetPreferences.getState().recent).toHaveLength(8);
  expect(useAssetPreferences.getState().recent[0]).toBe('mysql');
  fireEvent.click(screen.getByRole('button', { name: '최근 사용' }));
  expect(screen.getByRole('button', { name: 'MySQL — Relational database' })).toBeVisible();
  main.remove();
  bounds.mockRestore();
});
it('filters stale/duplicate storage entries and survives blocked or corrupt storage', () => {
  localStorage.setItem(
    ASSET_PREFERENCES_KEY,
    JSON.stringify({ favorites: ['mysql', 'removed', 'mysql', null], recent: ['awss3', 'awss3', 'nope'] }),
  );
  useAssetPreferences.getState().load();
  expect(useAssetPreferences.getState().favorites).toEqual(['mysql']);
  expect(useAssetPreferences.getState().recent).toEqual(['awss3']);
  localStorage.setItem(ASSET_PREFERENCES_KEY, '{broken');
  useAssetPreferences.getState().load();
  expect(useAssetPreferences.getState().storageUnavailable).toBe(true);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  useAssetPreferences.getState().toggle('sqlite');
  expect(useAssetPreferences.getState().favorites).toContain('sqlite');
  expect(useAssetPreferences.getState().storageUnavailable).toBe(true);
});
