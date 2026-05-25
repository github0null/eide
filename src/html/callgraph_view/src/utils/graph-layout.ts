import dagre from 'dagre';
import { MarkerType, Position, type Edge, type Node } from '@vue-flow/core';
import { edgeFlowId } from './callgraph-edge';
import type { VcgEdge, VcgNode } from '../types/build-report';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 48;

function handlePositions(direction: 'TB' | 'LR'): {
  source: Position;
  target: Position;
} {
  if (direction === 'LR') {
    return { source: Position.Right, target: Position.Left };
  }
  return { source: Position.Bottom, target: Position.Top };
}

/** Vue Flow DOM id 不能含 `.` `:` 等，否则节点无法渲染 */
export function toFlowNodeId(title: string): string {
  return `n_${title.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function layoutGraph(
  nodes: VcgNode[],
  edges: VcgEdge[],
  titleToFlowId: Map<string, string>,
  direction: 'TB' | 'LR',
): dagre.graphlib.Graph {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 24, ranksep: 72 });
  nodes.forEach((n) => {
    g.setNode(titleToFlowId.get(n.title)!, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((e) => {
    const src = titleToFlowId.get(e.sourcename);
    const tgt = titleToFlowId.get(e.targetname);
    if (src && tgt) {
      g.setEdge(src, tgt);
    }
  });
  dagre.layout(g);
  return g;
}

export function vcgToFlowElements(
  nodes: VcgNode[],
  edges: VcgEdge[],
  direction: 'TB' | 'LR' = 'TB',
): { nodes: Node[]; edges: Edge[] } {
  const titleToFlowId = new Map<string, string>();
  nodes.forEach((n) => {
    titleToFlowId.set(n.title, toFlowNodeId(n.title));
  });

  const g = layoutGraph(nodes, edges, titleToFlowId, direction);

  const { source: sourcePosition, target: targetPosition } =
    handlePositions(direction);
  const nodeWidth = NODE_WIDTH;
  const nodeHeight = NODE_HEIGHT;
  const padding = 40;

  let minX = Infinity;
  let minY = Infinity;
  for (const n of nodes) {
    const flowId = titleToFlowId.get(n.title);
    if (!flowId) {
      continue;
    }
    const pos = g.node(flowId);
    if (!pos) {
      continue;
    }
    minX = Math.min(minX, pos.x - nodeWidth / 2);
    minY = Math.min(minY, pos.y - nodeHeight / 2);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
  }
  if (!Number.isFinite(minY)) {
    minY = 0;
  }

  const flowNodes: Node[] = nodes.map((n) => {
    const flowId = titleToFlowId.get(n.title)!;
    const pos = g.node(flowId);
    return {
      id: flowId,
      position: {
        x: (pos?.x ?? 0) - nodeWidth / 2 - minX + padding,
        y: (pos?.y ?? 0) - nodeHeight / 2 - minY + padding,
      },
      width: nodeWidth,
      height: nodeHeight,
      style: {
        width: `${nodeWidth}px`,
        height: `${nodeHeight}px`,
      },
      class: 'callgraph-flow-node',
      sourcePosition,
      targetPosition,
      data: {
        label: n.label,
        shape: n.shape,
        location: n.location,
        title: n.title,
      },
      type: 'callgraph',
    };
  });

  const flowEdges: Edge[] = edges
    .filter((e) => titleToFlowId.has(e.sourcename) && titleToFlowId.has(e.targetname))
    .map((e, i) => {
      const source = titleToFlowId.get(e.sourcename)!;
      const target = titleToFlowId.get(e.targetname)!;
      return {
        id: edgeFlowId(i, source, target),
        source,
        target,
        animated: false,
        markerEnd: MarkerType.ArrowClosed,
        data: {
          sourceTitle: e.sourcename,
          targetTitle: e.targetname,
          label: e.label,
          vcgEdge: e,
        },
      };
    });

  return { nodes: flowNodes, edges: flowEdges };
}
