import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
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

const getAutoOrientation = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  routePoints: Array<{ x: number; y: number }>,
) => {
  if (routePoints.length > 1) {
    const centerIndex = Math.max(0, Math.floor(routePoints.length / 2) - 1);
    const first = routePoints[centerIndex];
    const second = routePoints[centerIndex + 1] ?? routePoints[centerIndex];
    return Math.abs(second.y - first.y) > Math.abs(second.x - first.x) ? 'vertical' : 'horizontal';
  }

  return Math.abs(targetY - sourceY) > Math.abs(targetX - sourceX) ? 'vertical' : 'horizontal';
};

const getLabelRotation = (orientation: string) => {
  if (orientation === 'verticalCounterclockwise') return ' rotate(-90deg)';
  if (orientation === 'vertical' || orientation === 'verticalClockwise') return ' rotate(90deg)';
  return '';
};

const applyTerminalOffset = (x: number, y: number, position: Position, offset = 0) => {
  if (!offset) return { x, y };
  if (position === Position.Top || position === Position.Bottom) return { x: x + offset, y };
  return { x, y: y + offset };
};

const getOffsetRoutePoints = (
  points: Array<{ x: number; y: number }>,
  sourcePosition: Position,
  targetPosition: Position,
  sourceOffset = 0,
  targetOffset = 0,
) => {
  if (points.length < 2) return points;

  return points.map((point, index) => {
    if (index === 0) return applyTerminalOffset(point.x, point.y, sourcePosition, sourceOffset);
    if (index === points.length - 1) return applyTerminalOffset(point.x, point.y, targetPosition, targetOffset);
    return point;
  });
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
  const adjustedSource = applyTerminalOffset(sourceX, sourceY, sourcePosition, data?.sourceTerminalOffset);
  const adjustedTarget = applyTerminalOffset(targetX, targetY, targetPosition, data?.targetTerminalOffset);
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: adjustedSource.x,
    sourceY: adjustedSource.y,
    sourcePosition,
    targetX: adjustedTarget.x,
    targetY: adjustedTarget.y,
    targetPosition,
    borderRadius: 14,
    offset: pathOptions?.offset,
  });
  const routePoints = getOffsetRoutePoints(
    data?.routePoints ?? [],
    sourcePosition,
    targetPosition,
    data?.sourceTerminalOffset,
    data?.targetTerminalOffset,
  );
  const routedPath =
    routePoints.length > 1
      ? routePoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
      : edgePath;
  const centerPoint = routePoints[Math.floor(routePoints.length / 2)];
  const lines = splitLabel(data?.renderLabel ?? data?.label ?? '');
  const translateX = (centerPoint?.x ?? labelX) + (data?.labelOffsetX ?? 0);
  const translateY = (centerPoint?.y ?? labelY) + (data?.labelOffsetY ?? 0);
  const labelOrientation =
    data?.labelOrientation && data.labelOrientation !== 'auto'
      ? data.labelOrientation
      : getAutoOrientation(sourceX, sourceY, targetX, targetY, routePoints);
  const rotation = getLabelRotation(labelOrientation);

  return (
    <>
      <BaseEdge
        id={id}
        interactionWidth={24}
        markerEnd={markerEnd}
        markerStart={markerStart}
        path={routedPath}
        style={style}
      />
      {lines.length > 0 ? (
        <EdgeLabelRenderer>
          <div
            className={`architecture-edge-label ${selected ? 'architecture-edge-label-selected' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${translateX}px, ${translateY}px)${rotation}` }}
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
