import type { VcgEdge } from '../types/build-report';

export interface NodeNeighborhood {
  callers: Set<string>;
  callees: Set<string>;
}

export function neighborhoodFromVcgEdges(
  title: string,
  edges: VcgEdge[],
): NodeNeighborhood {
  const callers = new Set<string>();
  const callees = new Set<string>();

  for (const e of edges) {
    if (e.targetname === title) {
      callers.add(e.sourcename);
    }
    if (e.sourcename === title) {
      callees.add(e.targetname);
    }
  }

  return { callers, callees };
}
