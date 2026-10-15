import type { ArchitectureEdge, ArchitectureEdgeData } from '../types/graph';
import { useGraphStore } from '../store/useGraphStore';
import { useState } from 'react';

export function EdgeStyleEditor({ edge }: { edge: ArchitectureEdge }) {
  const update = (data: Partial<ArchitectureEdgeData>) => useGraphStore.getState().updateEdgeData(edge.id, data);
  const [color, setColor] = useState(edge.data?.color ?? String(edge.style?.stroke ?? '#475569'));
  return (
    <section className="edge-style-editor">
      <label className="field-label" htmlFor="edge-line-style">
        선 종류
      </label>
      <select
        id="edge-line-style"
        className="field-input"
        value={edge.data?.lineStyle ?? 'solid'}
        onChange={(event) => update({ lineStyle: event.target.value as ArchitectureEdgeData['lineStyle'] })}
      >
        <option value="solid">실선</option>
        <option value="dashed">파선</option>
        <option value="dotted">점선</option>
      </select>
      <label className="field-label" htmlFor="edge-path-style">
        경로 모양
      </label>
      <select
        id="edge-path-style"
        className="field-input"
        value={edge.data?.pathStyle ?? 'smoothstep'}
        onChange={(event) => update({ pathStyle: event.target.value as ArchitectureEdgeData['pathStyle'] })}
      >
        <option value="smoothstep">둥근 직각 (SmoothStep)</option>
        <option value="step">직각 (Step)</option>
        <option value="straight">직선 (Straight)</option>
      </select>
      <label className="field-label" htmlFor="edge-arrow-style">
        화살표 모양
      </label>
      <select
        id="edge-arrow-style"
        className="field-input"
        value={edge.data?.arrowStyle ?? 'closed'}
        onChange={(event) => update({ arrowStyle: event.target.value as ArchitectureEdgeData['arrowStyle'] })}
      >
        <option value="closed">채운 화살표</option>
        <option value="open">열린 화살표</option>
        <option value="none">화살표 없음</option>
      </select>
      <label className="field-label" htmlFor="edge-color">
        연결선 색상
      </label>
      <input
        id="edge-color"
        type="color"
        value={edge.data?.color ?? String(edge.style?.stroke ?? '#475569')}
        onChange={(event) => update({ color: event.target.value })}
      />
      <button className="secondary-button" onClick={() => update({ color: undefined })}>
        노드 색상 따르기
      </button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (/^#[\da-f]{6}$/i.test(color)) update({ color });
        }}
      >
        <label className="field-label" htmlFor="edge-color-code">
          연결선 색상 코드
        </label>
        <input
          id="edge-color-code"
          className="field-input"
          type="text"
          required
          pattern="#[0-9a-fA-F]{6}"
          title="#RRGGBB 형식"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
        <button className="secondary-button" type="submit">
          색상 적용
        </button>
      </form>
    </section>
  );
}
