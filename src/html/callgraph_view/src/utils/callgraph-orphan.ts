import type { VcgEdge, VcgNode } from '../types/build-report';

/** 在任意边的端点中出现过的节点 title */
export function connectedNodeTitles(edges: VcgEdge[]): Set<string> {
  const titles = new Set<string>();
  for (const edge of edges) {
    titles.add(edge.sourcename);
    titles.add(edge.targetname);
  }
  return titles;
}

/** 保留至少参与一条边的节点 */
export function filterOrphanNodes(
  nodes: VcgNode[],
  edges: VcgEdge[],
): { nodes: VcgNode[]; edges: VcgEdge[] } {
  const connected = connectedNodeTitles(edges);
  const visibleNodes = nodes.filter((n) => connected.has(n.title));
  const visibleTitles = new Set(visibleNodes.map((n) => n.title));
  const visibleEdges = edges.filter(
    (e) => visibleTitles.has(e.sourcename) && visibleTitles.has(e.targetname),
  );
  return { nodes: visibleNodes, edges: visibleEdges };
}

export function isOrphanNode(title: string, edges: VcgEdge[]): boolean {
  return !connectedNodeTitles(edges).has(title);
}
