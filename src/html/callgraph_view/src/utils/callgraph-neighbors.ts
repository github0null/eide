import type { VcgEdge, VcgNode } from '../types/build-report';
import { neighborhoodFromVcgEdges } from './callgraph-highlight';

export type NeighborAxis = 'callers' | 'callees';

export type GraphNavMode = 'level' | NeighborAxis;

function sortByNodeLabel(titles: string[], nodes: VcgNode[]): string[] {
  const labelByTitle = new Map(nodes.map((n) => [n.title, n.label]));
  return titles.sort((a, b) =>
    (labelByTitle.get(a) ?? a).localeCompare(
      labelByTitle.get(b) ?? b,
      undefined,
      { sensitivity: 'base' },
    ),
  );
}

/** 同层节点：与当前节点共享至少一个调用者的兄弟（同一父节点下的被调函数） */
export function sortedLevelPeerTitles(
  centerTitle: string,
  edges: VcgEdge[],
  nodes: VcgNode[],
): string[] {
  const { callers } = neighborhoodFromVcgEdges(centerTitle, edges);
  const peers = new Set<string>();

  if (callers.size > 0) {
    peers.add(centerTitle);
    for (const parent of callers) {
      for (const e of edges) {
        if (e.sourcename === parent) {
          peers.add(e.targetname);
        }
      }
    }
  } else {
    const hasIncoming = new Set(edges.map((e) => e.targetname));
    for (const n of nodes) {
      if (!hasIncoming.has(n.title)) {
        peers.add(n.title);
      }
    }
    if (peers.size === 0) {
      peers.add(centerTitle);
    }
  }

  return sortByNodeLabel(Array.from(peers), nodes);
}

export function sortedNeighborTitles(
  centerTitle: string,
  edges: VcgEdge[],
  nodes: VcgNode[],
  axis: NeighborAxis,
): string[] {
  const { callers, callees } = neighborhoodFromVcgEdges(centerTitle, edges);
  const set = axis === 'callers' ? callers : callees;
  return sortByNodeLabel(Array.from(set), nodes);
}

export function inverseNeighborAxis(axis: NeighborAxis): NeighborAxis {
  return axis === 'callers' ? 'callees' : 'callers';
}
