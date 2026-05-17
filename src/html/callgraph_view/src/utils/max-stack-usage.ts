import type { CallgraphVcg } from '../types/build-report';
import {
  buildStackUsageIndex,
  lookupStackUsageForNode,
  type StackUsageIndex,
} from './stack-usage-lookup';

/**
 * 从该节点沿调用链向下：local(node) + max(子节点 max stack use)。
 * 不含调用方（父节点）栈帧；叶节点即为自身 local。
 */
export function computeMaxStackUseByTitle(
  graph: CallgraphVcg,
  stackIndex: StackUsageIndex,
): Map<string, number> {
  const nodeTitles = new Set(graph.nodes.map((n) => n.title));
  const localByTitle = new Map<string, number>();

  for (const node of graph.nodes) {
    const match = lookupStackUsageForNode(node, stackIndex);
    localByTitle.set(node.title, match?.stackBytes ?? 0);
  }

  const outgoing = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!nodeTitles.has(edge.sourcename) || !nodeTitles.has(edge.targetname)) {
      continue;
    }
    const out = outgoing.get(edge.sourcename) ?? [];
    out.push(edge.targetname);
    outgoing.set(edge.sourcename, out);
  }

  const memo = new Map<string, number>();

  function maxDown(title: string, visiting: Set<string>): number {
    const cached = memo.get(title);
    if (cached !== undefined) {
      return cached;
    }
    if (visiting.has(title)) {
      return localByTitle.get(title) ?? 0;
    }
    visiting.add(title);
    const local = localByTitle.get(title) ?? 0;
    let maxChild = 0;
    for (const tgt of outgoing.get(title) ?? []) {
      maxChild = Math.max(maxChild, maxDown(tgt, visiting));
    }
    visiting.delete(title);
    const total = local + maxChild;
    memo.set(title, total);
    return total;
  }

  const result = new Map<string, number>();
  for (const node of graph.nodes) {
    result.set(node.title, maxDown(node.title, new Set()));
  }
  return result;
}

export function computeMaxStackUseForGraph(
  graph: CallgraphVcg,
  entries: Parameters<typeof buildStackUsageIndex>[0],
): Map<string, number> {
  if (entries.length === 0) {
    return new Map();
  }
  return computeMaxStackUseByTitle(graph, buildStackUsageIndex(entries));
}
