import type { VcgEdge, VcgLocation } from '../types/build-report';

/** 解析边上的 callsite 标签，如 ./foo.c:74:13 */
export function parseCallsiteLabel(label?: string): VcgLocation | undefined {
  if (!label?.trim()) {
    return undefined;
  }
  const m = label.trim().match(/^(.+):(\d+):(\d+)$/);
  if (!m) {
    return undefined;
  }
  return {
    file: m[1],
    line: Number(m[2]),
    column: Number(m[3]),
  };
}

export function edgeFlowId(
  index: number,
  sourceFlowId: string,
  targetFlowId: string,
): string {
  return `e-${index}-${sourceFlowId}-${targetFlowId}`;
}

/** 合并多图时用于边去重的稳定键（避免在字符串中拼接 NUL 等控制字符） */
export function vcgEdgeDedupKey(
  edge: Pick<VcgEdge, 'sourcename' | 'targetname' | 'label'>,
): string {
  return JSON.stringify({
    sourcename: edge.sourcename,
    targetname: edge.targetname,
    label: edge.label ?? '',
  });
}

export function sameVcgEdge(a: VcgEdge, b: VcgEdge): boolean {
  return vcgEdgeDedupKey(a) === vcgEdgeDedupKey(b);
}
