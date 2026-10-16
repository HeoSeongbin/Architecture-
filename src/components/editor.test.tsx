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
    fireEvent.dragStart(screen.getByRole('button', { name: 'PostgreSQL — Relational database' }), {
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
  it('edits node dimensions through Inspector and restores them through undo', () => {
    useGraphStore.getState().selectNode('react');
    render(<Inspector />);
    fireEvent.change(screen.getByLabelText('노드 너비'), { target: { value: '320' } });
    fireEvent.change(screen.getByLabelText('노드 높이'), { target: { value: '180' } });
    fireEvent.click(screen.getByRole('button', { name: '크기 적용' }));
    expect(useGraphStore.getState().nodes[0].style).toMatchObject({ width: 320, height: 180 });
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().nodes[0].style).toBeUndefined();
  });
  it('edits line, path, color and arrow properties through Inspector', () => {
    useGraphStore.getState().selectEdge(sampleGraph.edges[0].id);
    render(<Inspector />);
    fireEvent.change(screen.getByLabelText('선 종류'), { target: { value: 'dashed' } });
    fireEvent.change(screen.getByLabelText('경로 모양'), { target: { value: 'straight' } });
    fireEvent.change(screen.getByLabelText('화살표 모양'), { target: { value: 'none' } });
    fireEvent.change(screen.getByLabelText('연결선 색상 코드'), { target: { value: '#ff0000' } });
    fireEvent.click(screen.getByRole('button', { name: '색상 적용' }));
    expect(useGraphStore.getState().edges[0].data).toMatchObject({
      lineStyle: 'dashed',
      pathStyle: 'straight',
      arrowStyle: 'none',
      color: '#ff0000',
    });
    expect(useGraphStore.getState().edges[0].markerEnd).toBeUndefined();
    fireEvent.change(screen.getByLabelText('연결선 색상'), { target: { value: '#00ff00' } });
    expect(useGraphStore.getState().edges[0].data?.color).toBe('#00ff00');
  });
  it('applies common node properties once for multi-selection', () => {
    useGraphStore.getState().onNodesChange([
      { type: 'select', id: 'react', selected: true },
      { type: 'select', id: 'nginx', selected: true },
    ]);
    render(<Inspector />);
    expect(screen.getByRole('heading', { name: '다중 선택' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('공통 부제목'), { target: { value: '일괄 수정' } });
    fireEvent.click(screen.getByRole('button', { name: '공통 속성 적용' }));
    expect(
      useGraphStore
        .getState()
        .nodes.slice(0, 2)
        .every((item) => item.data.subtitle === '일괄 수정'),
    ).toBe(true);
    expect(useGraphStore.getState().past).toHaveLength(1);
  });
});
