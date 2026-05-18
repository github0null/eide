import { ref } from 'vue';
import type { ViewportTransform } from '@vue-flow/core';
import { ALL_CALLGRAPH_GRAPHS } from './useBuildReport';
import type { VcgEdge } from '../types/build-report';

/** 跨侧栏切换保留的 Callgraph UI 状态（模块级，不随组件卸载丢失） */
export const callgraphSession = {
  selectedIndex: ref<number>(ALL_CALLGRAPH_GRAPHS),
  searchText: ref(''),
  layoutDirection: ref<'TB' | 'LR'>('LR'),
  selectedNodeId: ref<string | null>(null),
  selectedEdge: ref<VcgEdge | null>(null),
  selectedEdgeFlowId: ref<string | null>(null),
  /** 标题栏右侧展示的当前图统计 */
  graphStats: ref<{ nodes: number; edges: number } | null>(null),
};

/** flowInstanceKey → 画布视口 */
export const callgraphViewportByFlowKey = new Map<string, ViewportTransform>();

/** scrollKey（文档 id）→ 表格 scrollTop */
export const stackUsageScrollByKey = new Map<string, number>();
