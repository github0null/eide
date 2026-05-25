import { vcgEdgeDedupKey } from './callgraph-edge';
import type { VcgEdge, VcgNode } from '../types/build-report';

export function mergeCallgraphGraphs(
  graphs: { nodes: VcgNode[]; edges: VcgEdge[] }[],
): { nodes: VcgNode[]; edges: VcgEdge[] } {
  const nodeMap = new Map<string, VcgNode>();
  const edgeKeys = new Set<string>();
  const edges: VcgEdge[] = [];

  for (const g of graphs) {
    for (const node of g.nodes) {
      if (!nodeMap.has(node.title)) {
        nodeMap.set(node.title, node);
      }
    }
    for (const edge of g.edges) {
      const key = vcgEdgeDedupKey(edge);
      if (edgeKeys.has(key)) {
        continue;
      }
      edgeKeys.add(key);
      edges.push(edge);
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}
