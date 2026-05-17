<script setup lang="ts">
import { Background } from '@vue-flow/background';
import CallgraphControls from './CallgraphControls.vue';
import CallgraphViewportSync from './CallgraphViewportSync.vue';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import { computed, markRaw, nextTick, ref, watch } from 'vue';
import type { Edge, Node } from '@vue-flow/core';
import { VueFlow } from '@vue-flow/core';
import type { CallgraphVcg, VcgEdge } from '../../types/build-report';
import { neighborhoodFromVcgEdges } from '../../utils/callgraph-highlight';
import { vcgToFlowElements } from '../../utils/graph-layout';
import CallgraphNode from './CallgraphNode.vue';

type HighlightRole = 'selected' | 'caller' | 'callee';

interface CallgraphNodeData {
  title?: string;
  dimmed?: boolean;
  highlighted?: boolean;
  highlightRole?: HighlightRole;
}

interface CallgraphEdgeData {
  sourceTitle?: string;
  targetTitle?: string;
  label?: string;
  vcgEdge?: VcgEdge;
}

const props = defineProps<{
  graph: CallgraphVcg | null;
  graphKey: string;
  searchText: string;
  layoutDirection: 'TB' | 'LR';
  selectedNodeTitle: string | null;
  selectedEdgeId: string | null;
  paneVisible?: boolean;
}>();

const emit = defineEmits<{
  nodeSelect: [nodeId: string | null];
  edgeSelect: [payload: { edge: VcgEdge; flowId: string } | null];
}>();

const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);

const nodeTypes = {
  callgraph: markRaw(CallgraphNode),
};

const flowInstanceKey = computed(
  () => `${props.graphKey}::${props.layoutDirection}`,
);

const vueFlowRef = ref<InstanceType<typeof VueFlow> | null>(null);
/** 仅在新图 / 新布局首次展示时 fit，切页返回不重置视口 */
const lastAutoFitKey = ref<string | null>(null);

function scheduleFitView(attempt = 0): void {
  if (attempt >= 12) {
    return;
  }
  const fitView = vueFlowRef.value?.fitView;
  if (!fitView) {
    window.setTimeout(() => scheduleFitView(attempt + 1), 80);
    return;
  }
  void fitView({
    padding: 0.12,
    minZoom: 0.12,
    maxZoom: 1.5,
    duration: 0,
  }).then((ok) => {
    if (ok) {
      lastAutoFitKey.value = flowInstanceKey.value;
    } else {
      scheduleFitView(attempt + 1);
    }
  });
}

function tryScheduleAutoFit(): void {
  if (lastAutoFitKey.value === flowInstanceKey.value) {
    return;
  }
  scheduleFitView();
}

const highlightedIds = computed(() => {
  const q = props.searchText.trim().toLowerCase();
  if (!q || !props.graph) {
    return new Set<string>();
  }
  const ids = new Set<string>();
  props.graph.nodes.forEach((n) => {
    if (
      n.label.toLowerCase().includes(q) ||
      n.title.toLowerCase().includes(q)
    ) {
      ids.add(n.title);
    }
  });
  return ids;
});

const hasSearchMatch = computed(() => {
  const q = props.searchText.trim();
  return !q || highlightedIds.value.size > 0;
});

const noEdges = computed(
  () => (props.graph?.edges.length ?? 0) === 0 && (props.graph?.nodes.length ?? 0) > 0,
);

function applyHighlights() {
  const q = props.searchText.trim();
  const title = props.selectedNodeTitle;
  const selectedEdgeId = props.selectedEdgeId;
  const neighborhood =
    title && props.graph
      ? neighborhoodFromVcgEdges(title, props.graph.edges)
      : null;

  let edgeEndpointTitles: { source: string; target: string } | null = null;
  if (selectedEdgeId) {
    for (const edge of edges.value) {
      if (edge.id !== selectedEdgeId) {
        continue;
      }
      const data = edge.data as CallgraphEdgeData | undefined;
      if (data?.sourceTitle && data?.targetTitle) {
        edgeEndpointTitles = {
          source: data.sourceTitle,
          target: data.targetTitle,
        };
      }
      break;
    }
  }

  for (const node of nodes.value) {
    const data = node.data as CallgraphNodeData;
    const nodeTitle = data.title ?? node.id;

    let dimmed = false;
    let highlighted = false;
    let highlightRole: HighlightRole | undefined;

    if (q) {
      highlighted = highlightedIds.value.has(nodeTitle);
      dimmed = !highlighted;
    }

    if (neighborhood) {
      if (nodeTitle === title) {
        highlightRole = 'selected';
        dimmed = false;
        highlighted = false;
      } else if (neighborhood.callers.has(nodeTitle)) {
        highlightRole = 'caller';
        dimmed = false;
      } else if (neighborhood.callees.has(nodeTitle)) {
        highlightRole = 'callee';
        dimmed = false;
      } else if (!q || !highlightedIds.value.has(nodeTitle)) {
        dimmed = true;
        highlightRole = undefined;
        highlighted = false;
      }
    } else if (edgeEndpointTitles) {
      const nodeTitle = data.title ?? node.id;
      if (
        nodeTitle === edgeEndpointTitles.source ||
        nodeTitle === edgeEndpointTitles.target
      ) {
        dimmed = false;
      } else if (!q || !highlightedIds.value.has(nodeTitle)) {
        dimmed = true;
      }
      highlightRole = undefined;
    } else {
      highlightRole = undefined;
    }

    data.dimmed = dimmed;
    data.highlighted = highlighted;
    data.highlightRole = highlightRole;
  }

  for (const edge of edges.value) {
    const edgeData = edge.data as CallgraphEdgeData;
    const src = edgeData?.sourceTitle ?? '';
    const tgt = edgeData?.targetTitle ?? '';
    const isSelectedEdge = !!selectedEdgeId && edge.id === selectedEdgeId;
    const isCallerEdge = !!neighborhood && !!title && tgt === title;
    const isCalleeEdge = !!neighborhood && !!title && src === title;
    const isRelatedToNode = isCallerEdge || isCalleeEdge;

    if (isSelectedEdge) {
      edge.class = 'edge-selected';
      edge.animated = true;
    } else if (isRelatedToNode) {
      edge.class = isCallerEdge ? 'edge-caller' : 'edge-callee';
      edge.animated = true;
    } else if (neighborhood && title) {
      edge.class = 'edge-dimmed';
      edge.animated = false;
    } else {
      edge.class = undefined;
      edge.animated = false;
    }
    edge.style = undefined;
  }
}

function applyGraph() {
  if (!props.graph?.nodes.length) {
    nodes.value = [];
    edges.value = [];
    return;
  }
  const elements = vcgToFlowElements(
    props.graph.nodes,
    props.graph.edges,
    props.layoutDirection,
  );
  nodes.value = elements.nodes;
  edges.value = elements.edges;
  applyHighlights();
  void nextTick(() => {
    tryScheduleAutoFit();
  });
}

watch(
  () => [props.graph, props.graphKey, props.layoutDirection] as const,
  () => {
    applyGraph();
  },
  { immediate: true, deep: true },
);

watch(
  () =>
    [props.searchText, props.selectedNodeTitle, props.selectedEdgeId] as const,
  () => {
    applyHighlights();
  },
);

watch(nodes, (next, prev) => {
  if (
    next.length === 0 &&
    prev.length > 0 &&
    (props.graph?.nodes.length ?? 0) > 0
  ) {
    applyGraph();
  }
});

function onNodeClick(ev: {
  node: { id: string; data?: { title?: string } };
}) {
  const title = ev.node.data?.title ?? ev.node.id;
  emit('edgeSelect', null);
  emit('nodeSelect', title);
}

function onEdgeClick(ev: { edge: { id: string; data?: CallgraphEdgeData } }) {
  const vcgEdge = ev.edge.data?.vcgEdge;
  if (!vcgEdge) {
    return;
  }
  emit('nodeSelect', null);
  emit('edgeSelect', { edge: vcgEdge, flowId: ev.edge.id });
}

function onPaneClick() {
  emit('nodeSelect', null);
  emit('edgeSelect', null);
}
</script>

<template>
  <div class="callgraph-canvas">
    <VueFlow
      ref="vueFlowRef"
      :key="flowInstanceKey"
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="true"
      :default-zoom="1"
      :min-zoom="0.05"
      :max-zoom="2"
      class="callgraph-flow"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
      @pane-click="onPaneClick"
      @nodes-initialized="tryScheduleAutoFit"
    >
      <Background
        :gap="16"
        pattern-color="var(--vscode-editorWidget-border, #3c3c3c)"
      />
      <CallgraphControls />
      <CallgraphViewportSync
        :flow-key="flowInstanceKey"
        :pane-visible="props.paneVisible ?? true"
      />
    </VueFlow>
    <div v-if="searchText.trim() && !hasSearchMatch" class="search-hint">
      No matched functions
    </div>
    <div v-if="noEdges" class="edge-hint">No matched callgraph</div>
  </div>
</template>

<style scoped>
.callgraph-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
}

.callgraph-flow {
  width: 100%;
  height: 100%;
}

.search-hint,
.edge-hint {
  position: absolute;
  z-index: 10;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 3px;
  background: var(--vscode-editorWidget-background, #252526);
  border: 1px solid var(--vscode-editorWidget-border, #3c3c3c);
}

.search-hint {
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
}

.edge-hint {
  top: 8px;
  right: 8px;
}

:deep(.vue-flow) {
  width: 100%;
  height: 100%;
}
</style>
