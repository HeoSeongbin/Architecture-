import { useState } from 'react';
import type { ArchitectureNode } from '../types/graph';
import { nodeSize, nodeLimits, isGroup } from '../utils/graphEditing';
import { useGraphStore } from '../store/useGraphStore';

export function NodeGeometryEditor({ node }: { node: ArchitectureNode }) {
  const size = nodeSize(node);
  const [width, setWidth] = useState(size.width);
  const [height, setHeight] = useState(size.height);
  const limits = nodeLimits(node);
  const nodes = useGraphStore((state) => state.nodes);
  const children = nodes.filter((item) => item.parentId === node.id);
  return (
    <section className="geometry-editor">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          useGraphStore.getState().resizeNode(node.id, width, height);
        }}
      >
        <h3>크기 (px)</h3>
        <div className="size-fields">
          <label>
            너비
            <input
              aria-label="노드 너비"
              className="field-input"
              type="number"
              min={limits.minWidth}
              max={limits.maxWidth}
              required
              value={Number.isFinite(width) ? width : ''}
              onChange={(event) => setWidth(event.target.valueAsNumber)}
            />
          </label>
          <label>
            높이
            <input
              aria-label="노드 높이"
              className="field-input"
              type="number"
              min={limits.minHeight}
              max={limits.maxHeight}
              required
              value={Number.isFinite(height) ? height : ''}
              onChange={(event) => setHeight(event.target.valueAsNumber)}
            />
          </label>
        </div>
        <button type="submit" className="secondary-button">
          크기 적용
        </button>
      </form>
      <label className="field-label" htmlFor="node-parent">
        소속 그룹
      </label>
      <select
        id="node-parent"
        className="field-input"
        value={node.parentId ?? ''}
        onChange={(event) => useGraphStore.getState().setNodeParent(node.id, event.target.value || undefined)}
      >
        <option value="">그룹 없음</option>
        {nodes
          .filter((item) => isGroup(item) && item.id !== node.id)
          .map((group) => (
            <option key={group.id} value={group.id}>
              {group.data.label}
            </option>
          ))}
      </select>
      <p className="geometry-hint">그룹을 변경해도 캔버스의 현재 위치를 유지합니다. 순환 관계는 적용하지 않습니다.</p>
      {isGroup(node) && (
        <>
          <label className="field-label" htmlFor="group-preset">
            영역 이름 예시
          </label>
          <select
            id="group-preset"
            className="field-input"
            value=""
            onChange={(event) => {
              if (event.target.value) useGraphStore.getState().updateNodeData(node.id, { label: event.target.value });
            }}
          >
            <option value="">영역 이름 선택</option>
            {['VPC', 'Subnet', 'DMZ', 'Internal Network', 'Production', 'Development', 'Database Zone', 'Application Zone'].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <h3>포함 노드 {children.length}개</h3>
          <p className="geometry-hint">그룹 삭제 시 포함 노드는 현재 위치에 남습니다.</p>
          <ul className="group-members">
            {children.map((child) => (
              <li key={child.id}>
                <span>{child.data.label}</span>
                <button
                  className="secondary-button"
                  aria-label={`${child.data.label} 그룹에서 해제`}
                  onClick={() => useGraphStore.getState().setNodeParent(child.id)}
                >
                  해제
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
