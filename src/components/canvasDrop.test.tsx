import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ArchitectureCanvas } from './ArchitectureCanvas';
import { useGraphStore } from '../store/useGraphStore';
import { useAssetPreferences } from '../store/useAssetPreferences';
import { groupAsset } from '../data/assets';

vi.mock('@xyflow/react', async (original) => {
  const module = await original<typeof import('@xyflow/react')>();
  return {
    ...module,
    useReactFlow: () => ({ screenToFlowPosition: (point: { x: number; y: number }) => point }),
    ReactFlow: ({ onDrop }: { onDrop: React.DragEventHandler }) => <div data-testid="drop-target" onDrop={onDrop} />,
  };
});
beforeEach(() => {
  localStorage.clear();
  useAssetPreferences.setState({ favorites: [], recent: [] });
  useGraphStore.getState().setGraph({
    nodes: [{ id: 'group', type: 'groupNode', position: { x: 20, y: 30 }, style: { width: 520, height: 320 }, data: { ...groupAsset } }],
    edges: [],
  });
});
it('records a new asset drop in a group, trusts the registry and supports undo', () => {
  render(<ArchitectureCanvas showGrid theme="light" />);
  const event = new MouseEvent('drop', { bubbles: true, cancelable: true, clientX: 120, clientY: 130 });
  Object.defineProperty(event, 'dataTransfer', {
    value: { getData: () => JSON.stringify({ kind: 'mysql', label: 'injected', isGroup: true }) },
  });
  fireEvent(screen.getByTestId('drop-target'), event);
  expect(useGraphStore.getState().nodes[1]).toMatchObject({
    type: 'architectureNode',
    parentId: 'group',
    position: { x: 100, y: 100 },
    data: { kind: 'mysql', label: 'MySQL' },
  });
  expect(useAssetPreferences.getState().recent).toEqual(['mysql']);
  useGraphStore.getState().undo();
  expect(useGraphStore.getState().nodes).toHaveLength(1);
});
it.each(['{broken', 'null', '{}', '{"kind":"unknown"}'])('ignores malformed or foreign drop data atomically: %s', (payload) => {
  render(<ArchitectureCanvas showGrid theme="light" />);
  fireEvent.drop(screen.getByTestId('drop-target'), { clientX: 120, clientY: 130, dataTransfer: { getData: () => payload } });
  expect(useGraphStore.getState().nodes).toHaveLength(1);
  expect(useGraphStore.getState().past).toHaveLength(0);
  expect(useAssetPreferences.getState().recent).toHaveLength(0);
});
