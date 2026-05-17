<script setup lang="ts">
import {
  NButton,
  NEmpty,
  NSelect,
  NSpace,
  NText,
  NTooltip,
} from 'naive-ui';

const maxStackUsageTooltip =
  'Max Stack Usage = 本函数局部栈（GCC -fstack-usage）+ 被调用函数中最大的 Max Stack Usage。' +
  '仅沿当前调用图向下累计，不含调用方栈帧；多个被调函数取子链最大值（非相加）。';
import { computed, watch } from 'vue';
import CallgraphCanvas from '../components/callgraph/CallgraphCanvas.vue';
import {
  ALL_CALLGRAPH_GRAPHS,
  useBuildReport,
} from '../composables/useBuildReport';
import { callgraphSession } from '../composables/usePageSessionState';
import { hostBridge } from '../host-bridge';
import { parseCallsiteLabel } from '../utils/callgraph-edge';
import { buildStackUsageIndex } from '../utils/stack-usage-lookup';
import { computeMaxStackUseByTitle } from '../utils/max-stack-usage';
import type { VcgEdge, VcgNode } from '../types/build-report';

const props = defineProps<{
  paneVisible?: boolean;
}>();

const {
  hasCallgraph,
  hasStackUsage,
  callgraphGraphs,
  mergedCallgraphGraph,
  allStackEntries,
} = useBuildReport();

const stackUsageIndex = computed(() =>
  buildStackUsageIndex(allStackEntries.value),
);

const {
  selectedIndex,
  searchText,
  layoutDirection,
  selectedNodeId,
  selectedEdge,
  selectedEdgeFlowId,
} = callgraphSession;

watch(
  callgraphGraphs,
  (graphs) => {
    if (graphs.length === 0) {
      return;
    }
    if (
      selectedIndex.value !== ALL_CALLGRAPH_GRAPHS &&
      selectedIndex.value >= graphs.length
    ) {
      selectedIndex.value = ALL_CALLGRAPH_GRAPHS;
    }
  },
  { immediate: true },
);

watch([selectedIndex, layoutDirection], () => {
  selectedNodeId.value = null;
  selectedEdge.value = null;
  selectedEdgeFlowId.value = null;
});

const graphOptions = computed(() => [
  {
    label: `Merged (${mergedCallgraphGraph.value?.nodes.length ?? 0})`,
    value: ALL_CALLGRAPH_GRAPHS,
  },
  ...callgraphGraphs.value.map((g) => ({
    label: `${g.title} (${g.nodes.length})`,
    value: g.index,
  })),
]);

const currentGraphMeta = computed(() => {
  if (selectedIndex.value === ALL_CALLGRAPH_GRAPHS) {
    return mergedCallgraphGraph.value;
  }
  return callgraphGraphs.value[selectedIndex.value] ?? null;
});

const graphCanvasKey = computed(() =>
  selectedIndex.value === ALL_CALLGRAPH_GRAPHS
    ? '__merged__'
    : (currentGraphMeta.value?.title ?? String(selectedIndex.value)),
);

const currentGraph = computed(() => {
  const meta = currentGraphMeta.value;
  if (!meta) {
    return null;
  }
  return {
    graph: { title: meta.title },
    nodes: meta.nodes,
    edges: meta.edges,
  };
});

const selectedNode = computed((): VcgNode | null => {
  if (!selectedNodeId.value || !currentGraph.value) {
    return null;
  }
  return (
    currentGraph.value.nodes.find((n) => n.title === selectedNodeId.value) ?? null
  );
});

const maxStackUseByTitle = computed(() => {
  const graph = currentGraph.value;
  if (!graph || !hasStackUsage.value) {
    return new Map<string, number>();
  }
  return computeMaxStackUseByTitle(graph, stackUsageIndex.value);
});

const selectedNodeMaxStackUse = computed(() => {
  const node = selectedNode.value;
  if (!node || !hasStackUsage.value) {
    return null;
  }
  const value = maxStackUseByTitle.value.get(node.title);
  return value === undefined ? null : value;
});

function nodeLabel(title: string): string {
  const node = currentGraph.value?.nodes.find((n) => n.title === title);
  return node?.label ?? title;
}

const selectedEdgeSourceLabel = computed(() =>
  selectedEdge.value ? nodeLabel(selectedEdge.value.sourcename) : '',
);

const selectedEdgeTargetLabel = computed(() =>
  selectedEdge.value ? nodeLabel(selectedEdge.value.targetname) : '',
);

const selectedEdgeCallsite = computed(() =>
  parseCallsiteLabel(selectedEdge.value?.label),
);

function onNodeSelect(title: string | null) {
  selectedNodeId.value = title;
  selectedEdge.value = null;
  selectedEdgeFlowId.value = null;
}

function onEdgeSelect(payload: { edge: VcgEdge; flowId: string } | null) {
  selectedEdge.value = payload?.edge ?? null;
  selectedEdgeFlowId.value = payload?.flowId ?? null;
  selectedNodeId.value = null;
}

const layoutOptions = [
  { label: 'Top → Bottom', value: 'TB' },
  { label: 'Left → Right', value: 'LR' },
];

function clearSearch() {
  searchText.value = '';
}

function gotoNode(node: VcgNode) {
  if (node.location?.file) {
    hostBridge.gotoDefinition({
      file: node.location.file,
      line: node.location.line,
      column: node.location.column,
    });
  }
}

function gotoSelectedNode() {
  const n = selectedNode.value;
  if (n) {
    gotoNode(n);
  }
}

function gotoSelectedEdge() {
  const loc = selectedEdgeCallsite.value;
  if (loc?.file) {
    hostBridge.gotoDefinition({
      file: loc.file,
      line: loc.line,
      column: loc.column,
    });
  }
}
</script>

<template>
  <div v-if="!hasCallgraph" class="page-view empty-center">
    <NEmpty description="No callgraph data">
      <template #extra>
        <NText depth="3" style="font-size: 12px">
          Please enable -fcallgraph-info in the build options and rebuild the project.
        </NText>
      </template>
    </NEmpty>
  </div>
  <div v-else class="page-view callgraph-page">
    <div class="page-toolbar">
      <NSelect
        v-model:value="selectedIndex"
        :options="graphOptions"
        style="min-width: 280px; max-width: 480px"
        size="small"
      />
      <input
        v-model="searchText"
        class="search-input"
        type="text"
        placeholder="Search function ..."
      />
      <NSelect
        v-model:value="layoutDirection"
        :options="layoutOptions"
        style="width: 140px"
        size="small"
      />
      <NButton v-if="searchText" size="small" @click="clearSearch">Clear filter</NButton>
      <span class="badge">
        {{ currentGraphMeta?.nodes.length ?? 0 }} nodes ·
        {{ currentGraphMeta?.edges.length ?? 0 }} edges
      </span>
    </div>
    <div v-if="currentGraphMeta?.isEmpty" class="empty-center">
      <NEmpty description="No callgraph data" />
    </div>
    <div v-else class="callgraph-flow-wrap">
      <CallgraphCanvas
        :graph="currentGraph"
        :graph-key="graphCanvasKey"
        :search-text="searchText"
        :layout-direction="layoutDirection"
        :selected-node-title="selectedNodeId"
        :selected-edge-id="selectedEdgeFlowId"
        :pane-visible="props.paneVisible ?? true"
        @node-select="onNodeSelect"
        @edge-select="onEdgeSelect"
      />
    </div>
    <div class="node-detail">
      <template v-if="selectedEdge">
        <NSpace align="center">
          <NText strong>
            {{ selectedEdgeSourceLabel }} → {{ selectedEdgeTargetLabel }}
          </NText>
          <NButton
            v-if="selectedEdgeCallsite"
            size="tiny"
            @click="gotoSelectedEdge"
          >
            Go To Definition
          </NButton>
        </NSpace>
        <NText v-if="selectedEdge.label" depth="3" style="font-size: 11px">
          {{ selectedEdge.label }}
        </NText>
        <NText v-else depth="3" style="font-size: 11px">
          {{ selectedEdge.sourcename }} → {{ selectedEdge.targetname }}
        </NText>
      </template>
      <template v-else-if="selectedNode">
        <NSpace align="center" :wrap="false">
          <NText strong>{{ selectedNode.label }}</NText>
          <NTooltip
            v-if="selectedNodeMaxStackUse !== null"
            trigger="hover"
            :style="{ maxWidth: '360px' }"
          >
            <template #trigger>
              <span class="max-stack-badge" tabindex="0">
                Max Stack Usage: {{ selectedNodeMaxStackUse }} B
              </span>
            </template>
            {{ maxStackUsageTooltip }}
          </NTooltip>
          <NButton size="tiny" @click="gotoSelectedNode">Go To Definition</NButton>
        </NSpace>
        <NText v-if="selectedNode.location" depth="3" style="font-size: 12px; padding: 4px 0px;">
          {{ selectedNode.location.file }}
          <template v-if="selectedNode.location.line !== undefined">
            :{{ selectedNode.location.line }}:{{ selectedNode.location.column }}
          </template>
        </NText>
      </template>
      <NText v-else depth="3" class="node-detail-empty">No data</NText>
    </div>
  </div>
</template>

<style scoped>
.node-detail {
  grid-row: 3;
  flex-shrink: 0;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid var(--vscode-editorWidget-border, #3c3c3c);
  border-radius: 3px;
  background: var(--vscode-editorWidget-background, #252526);
  min-height: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.node-detail-empty {
  font-size: 12px;
}

.max-stack-badge {
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid var(--vscode-editorWidget-border, #3c3c3c);
  border-radius: 4px;
  background: var(--vscode-editor-inactiveSelectionBackground, #3a3d41);
  color: var(--vscode-foreground, #cccccc);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  cursor: help;
  white-space: nowrap;
}

.max-stack-badge:focus-visible {
  outline: 1px solid var(--vscode-focusBorder, #007acc);
  outline-offset: 1px;
}

.search-input {
  padding: 4px 8px;
  border-radius: 2px;
  border: 1px solid var(--vscode-input-border, #3c3c3c);
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #f0f0f0);
  font-size: 12px;
  min-width: 180px;
}
</style>
