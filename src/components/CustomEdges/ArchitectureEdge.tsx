import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { ArchitectureEdge as ArchitectureEdgeType } from '../../types/graph';

const splitLabel = (label: string) => {
  const normalized = label.trim();
  if (!normalized) return [];

  const slashIndex = normalized.indexOf(' / ');
  if (slashIndex > -1) {
    return [normalized.slice(0, slashIndex), normalized.slice(slashIndex + 3)];
  }

  return [normalized];
};

export function ArchitectureEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  markerStart,
  pathOptions,
  selected,
  style,
}: EdgeProps<ArchitectureEdgeType>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 14,
    offset: pathOptions?.offset,
  });
  const lines = splitLabel(data?.renderLabel ?? data?.label ?? '');
  const translateX = labelX + (data?.labelOffsetX ?? 0);
  const translateY = labelY + (data?.labelOffsetY ?? 0);

  return (
    <>
      <BaseEdge
        id={id}
        interactionWidth={24}
        markerEnd={markerEnd}
        markerStart={markerStart}
        path={edgePath}
        style={style}
      />
      {lines.length > 0 ? (
        <EdgeLabelRenderer>
          <div
            className={`architecture-edge-label ${selected ? 'architecture-edge-label-selected' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${translateX}px, ${translateY}px)` }}
          >
            {lines.slice(0, 2).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
