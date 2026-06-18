import { MarkerType } from '@xyflow/react';
import type { ArchitectureEdge, ArchitectureEdgeData } from '../types/graph';

export const edgeDefaults = {
  animated: true,
  type: 'smoothstep',
  labelBgPadding: [8, 4] as [number, number],
  labelBgBorderRadius: 4,
  labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
  labelStyle: { fill: '#334155', fontSize: 12, fontWeight: 600 },
  style: { stroke: '#475569', strokeWidth: 2 },
};

const arrowMarker = {
  type: MarkerType.ArrowClosed,
  width: 12,
  height: 12,
  color: '#475569',
};

export const getEdgeDirection = (data?: ArchitectureEdgeData) => data?.direction ?? 'forward';

export const getEdgeVisuals = (data?: ArchitectureEdgeData): Partial<ArchitectureEdge> => {
  const direction = getEdgeDirection(data);

  return {
    ...edgeDefaults,
    markerStart: direction === 'reverse' || direction === 'bidirectional' ? arrowMarker : undefined,
    markerEnd: direction === 'forward' || direction === 'bidirectional' ? arrowMarker : undefined,
  };
};
