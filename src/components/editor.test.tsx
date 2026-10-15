import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { sampleGraph } from '../data/sampleGraph';
import { useGraphStore } from '../store/useGraphStore';
import { Inspector } from './Inspector';
import { Sidebar } from './Sidebar';
import { ReactFlowProvider } from '@xyflow/react';

beforeEach(() => useGraphStore.getState().setGraph(structuredClone(sampleGraph)));

describe('existing editor integration', () => {
  it('filters assets and supplies the drag payload', () => {
    render(
      <ReactFlowProvider>
        <Sidebar />
      </ReactFlowProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText('자산 검색'), { target: { value: 'PostgreSQL' } });
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.queryByText('MSSQL')).not.toBeInTheDocument();
    const payload = new Map<string, string>();
    fireEvent.dragStart(screen.getByRole('button', { name: /PostgreSQL/ }), {
      dataTransfer: { setData: (key: string, value: string) => payload.set(key, value) },
    });
    expect(JSON.parse(payload.get('application/reactflow')!).kind).toBe('postgresql');
  });
  it('edits a selected node and supports duplicate/delete', () => {
    useGraphStore.getState().selectNode('react');
    render(<Inspector />);
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '한국어 프론트엔드' } });
    expect(useGraphStore.getState().nodes.find((node) => node.id === 'react')?.data.label).toBe('한국어 프론트엔드');
    fireEvent.click(screen.getByRole('button', { name: '복제' }));
    expect(useGraphStore.getState().nodes).toHaveLength(9);
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(useGraphStore.getState().nodes).toHaveLength(8);
  });
  it('edits the selected edge label and direction', () => {
    useGraphStore.getState().selectEdge(sampleGraph.edges[0].id);
    render(<Inspector />);
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'WSS' } });
    fireEvent.click(screen.getByRole('button', { name: '양방향' }));
    expect(useGraphStore.getState().edges[0].data).toMatchObject({ label: 'WSS', direction: 'bidirectional' });
  });
});
