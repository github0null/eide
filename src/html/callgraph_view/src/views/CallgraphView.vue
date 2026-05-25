<script setup lang="ts">
import {
  NCheckbox,
  NEmpty,
  NSelect,
  NSpace,
  NText,
  NTooltip,
  type SelectOption,
} from 'naive-ui';

const maxStackUsageTooltip =
  'Max Stack Usage = 本函数局部栈（GCC -fstack-usage）+ 被调用函数中最大的 Max Stack Usage。' +
  '仅沿当前调用图向下累计，不含调用方栈帧；多个被调函数取子链最大值（非相加）。';
import { computed, nextTick, ref, watch } from 'vue';
import CallgraphCanvas from '../components/callgraph/CallgraphCanvas.vue';
import {
  ALL_CALLGRAPH_GRAPHS,
  useBuildReport,
} from '../composables/useBuildReport';
import { useCallgraphKeyboard } from '../composables/useCallgraphKeyboard';
import { useCallgraphSearch } from '../composables/useCallgraphSearch';
import {
  callgraphSession,
  defaultCallgraphSourceApplied,
} from '../composables/usePageSessionState';
import { filterOrphanNodes, isOrphanNode } from '../utils/callgraph-orphan';
import {
  DEFAULT_CALLGRAPH_SOURCE_BASENAME,
  findCallgraphIndexByBasename,
} from '../utils/callgraph-source';
import { hostBridge } from '../host-bridge';
import { parseCallsiteLabel } from '../utils/callgraph-edge';
import { buildStackUsageIndex } from '../utils/stack-usage-lookup';
import { computeMaxStackUseByTitle } from '../utils/max-stack-usage';
import type { VcgEdge, VcgNode } from '../types/build-report';

interface GraphSelectOption extends SelectOption {
  value: number;
  fullLabel: string;
}

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
  hideOrphanNodes,
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
    if (!defaultCallgraphSourceApplied.value) {
      defaultCallgraphSourceApplied.value = true;
      const mainIndex = findCallgraphIndexByBasename(
        graphs,
        DEFAULT_CALLGRAPH_SOURCE_BASENAME,
      );
      selectedIndex.value = mainIndex ?? ALL_CALLGRAPH_GRAPHS;
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

watch([selectedIndex, layoutDirection, hideOrphanNodes], () => {
  selectedNodeId.value = null;
  selectedEdge.value = null;
  selectedEdgeFlowId.value = null;
});

const graphOptions = computed((): GraphSelectOption[] => {
  const mergedFull = `Merged (${mergedCallgraphGraph.value?.nodes.length ?? 0})`;
  const others = callgraphGraphs.value
    .map((g) => {
      const fullLabel = `${g.title} (${g.nodes.length})`;
      return {
        label: fullLabel,
        value: g.index,
        fullLabel,
      };
    })
    .sort((a, b) =>
      a.fullLabel.localeCompare(b.fullLabel, undefined, { sensitivity: 'base' }),
    );
  return [
    {
      label: mergedFull,
      value: ALL_CALLGRAPH_GRAPHS,
      fullLabel: mergedFull,
    },
    ...others,
  ];
});

const selectedGraphFullLabel = computed(() => {
  const opt = graphOptions.value.find((o) => o.value === selectedIndex.value);
  return opt?.fullLabel ?? '';
});

function graphOptionNodeProps(option: unknown) {
  const o = option as GraphSelectOption;
  const full =
    o.fullLabel ??
    (typeof o.label === 'string' ? o.label : '');
  return full ? { title: full } : {};
}

const currentGraphMeta = computed(() => {
  if (selectedIndex.value === ALL_CALLGRAPH_GRAPHS) {
    return mergedCallgraphGraph.value;
  }
  return callgraphGraphs.value[selectedIndex.value] ?? null;
});

const displayedGraphMeta = computed(() => {
  const meta = currentGraphMeta.value;
  if (!meta || !hideOrphanNodes.value) {
    return meta;
  }
  const { nodes, edges } = filterOrphanNodes(meta.nodes, meta.edges);
  return {
    ...meta,
    nodes,
    edges,
    isEmpty: nodes.length === 0,
  };
});

watch(
  [displayedGraphMeta, hasCallgraph],
  ([meta, hasGraph]) => {
    if (!hasGraph || !meta) {
      callgraphSession.graphStats.value = null;
      return;
    }
    callgraphSession.graphStats.value = {
      nodes: meta.nodes.length,
      edges: meta.edges.length,
    };
  },
  { immediate: true },
);

const graphCanvasKey = computed(() => {
  const base =
    selectedIndex.value === ALL_CALLGRAPH_GRAPHS
      ? '__merged__'
      : (currentGraphMeta.value?.title ?? String(selectedIndex.value));
  return hideOrphanNodes.value ? `${base}::no-orphan` : base;
});

const currentGraph = computed(() => {
  const meta = displayedGraphMeta.value;
  if (!meta) {
    return null;
  }
  return {
    graph: { title: meta.title },
    nodes: meta.nodes,
    edges: meta.edges,
  };
});

const currentGraphNodes = computed(() => displayedGraphMeta.value?.nodes ?? []);

watch([hideOrphanNodes, currentGraphMeta], () => {
  const meta = currentGraphMeta.value;
  if (!meta || !hideOrphanNodes.value) {
    return;
  }
  if (
    selectedNodeId.value &&
    isOrphanNode(selectedNodeId.value, meta.edges)
  ) {
    selectedNodeId.value = null;
  }
  if (selectedEdge.value) {
    const { sourcename, targetname } = selectedEdge.value;
    if (
      isOrphanNode(sourcename, meta.edges) ||
      isOrphanNode(targetname, meta.edges)
    ) {
      selectedEdge.value = null;
      selectedEdgeFlowId.value = null;
    }
  }
});

const {
  matches: searchMatches,
  activeIndex: searchActiveIndex,
  activeMatch: searchActiveMatch,
  hasMatches: hasSearchMatches,
  setActiveIndex: setSearchActiveIndex,
  goPrev: goSearchPrev,
  goNext: goSearchNext,
} = useCallgraphSearch(searchText, currentGraphNodes);

const keyboardPanTitle = ref<string | null>(null);

const focusNodeTitle = computed(() => {
  if (searchText.value.trim() && searchActiveMatch.value) {
    return searchActiveMatch.value.title;
  }
  return keyboardPanTitle.value;
});

watch(searchActiveMatch, (match) => {
  if (match) {
    selectedNodeId.value = match.title;
    selectedEdge.value = null;
    selectedEdgeFlowId.value = null;
    keyboardPanTitle.value = match.title;
  }
});

watch(searchActiveIndex, () => {
  void nextTick(() => {
    document
      .querySelector('.search-results-item.active')
      ?.scrollIntoView({ block: 'nearest' });
  });
});

function onSearchResultClick(index: number) {
  setSearchActiveIndex(index);
}

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
  // 鼠标点击不触发画布平移，仅搜索/键盘导航会设置 keyboardPanTitle
  if (!searchText.value.trim()) {
    keyboardPanTitle.value = null;
  }
}

function onEdgeSelect(payload: { edge: VcgEdge; flowId: string } | null) {
  selectedEdge.value = payload?.edge ?? null;
  selectedEdgeFlowId.value = payload?.flowId ?? null;
  selectedNodeId.value = null;
}

const currentGraphEdges = computed(() => currentGraph.value?.edges ?? []);

const paneVisibleRef = computed(() => props.paneVisible ?? true);

const { onSearchKeydown, clearLrStack } = useCallgraphKeyboard({
  paneVisible: paneVisibleRef,
  searchText,
  hasSearchMatches,
  goSearchPrev,
  goSearchNext,
  selectedNodeId,
  graphEdges: currentGraphEdges,
  graphNodes: currentGraphNodes,
  onSelectNode(title) {
    onNodeSelect(title);
  },
  onPanToNode(title) {
    keyboardPanTitle.value = title;
  },
});

function onNodeSelectByMouse(title: string | null) {
  clearLrStack();
  onNodeSelect(title);
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
    <div class="page-toolbar callgraph-toolbar">
      <div class="toolbar-start">
        <div class="graph-select-wrap" :title="selectedGraphFullLabel">
          <NSelect
            v-model:value="selectedIndex"
            class="graph-select"
            :options="graphOptions"
            :node-props="graphOptionNodeProps"
            :consistent-menu-width="false"
            size="small"
          />
        </div>
        <div class="search-block">
        <div class="search-row">
          <input
            v-model="searchText"
            class="search-input"
            type="text"
            placeholder="Search function ..."
            @keydown="onSearchKeydown"
          />
          <button
            :disabled="!searchText"
            type="button"
            class="btn-outline btn-outline--icon search-clear-btn"
            title="Clear search"
            aria-label="Clear search"
            @click="clearSearch"
          >
            ×
          </button>
          <button
            type="button"
            class="btn-outline btn-outline--icon"
            :disabled="!hasSearchMatches"
            title="Previous match"
            @click="goSearchPrev"
          >
            ‹
          </button>
          <button
            type="button"
            class="btn-outline btn-outline--icon"
            :disabled="!hasSearchMatches"
            title="Next match"
            @click="goSearchNext"
          >
            ›
          </button>
          <span v-if="hasSearchMatches" class="search-counter">
            {{ searchActiveIndex + 1 }} / {{ searchMatches.length }}
          </span>
        </div>
        <ul v-if="hasSearchMatches" class="search-results-dropdown">
          <li
            v-for="(match, index) in searchMatches"
            :key="match.title"
            class="search-results-item"
            :class="{ active: index === searchActiveIndex }"
            :title="match.label"
            @click="onSearchResultClick(index)"
          >
            {{ match.label }}
          </li>
        </ul>
        </div>
      </div>
      <div class="toolbar-end">
        <NCheckbox v-model:checked="hideOrphanNodes" size="large">
          Hide Orphan Nodes
        </NCheckbox>
        <NSelect
          v-model:value="layoutDirection"
          class="layout-select"
          :options="layoutOptions"
          size="small"
        />
      </div>
    </div>
    <div v-if="displayedGraphMeta?.isEmpty" class="empty-center">
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
        :focus-node-title="focusNodeTitle"
        :pane-visible="props.paneVisible ?? true"
        @node-select="onNodeSelectByMouse"
        @edge-select="onEdgeSelect"
      />
    </div>
    <div class="node-detail">
      <template v-if="selectedEdge">
        <NSpace align="center">
          <NText strong>
            {{ selectedEdgeSourceLabel }} → {{ selectedEdgeTargetLabel }}
          </NText>
          <button
            v-if="selectedEdgeCallsite"
            type="button"
            class="btn-outline btn-outline--tiny"
            @click="gotoSelectedEdge"
          >
            Go To Definition
          </button>
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
          <button
            type="button"
            class="btn-outline btn-outline--tiny"
            @click="gotoSelectedNode"
          >
            Go To Definition
          </button>
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

.search-block {
  position: relative;
  flex-shrink: 0;
  align-self: center;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
}

.search-input {
  padding: 4px 8px;
  border-radius: 2px;
  border: 1px solid var(--vscode-input-border, #3c3c3c);
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #f0f0f0);
  font-size: 12px;
  width: 180px;
  min-width: 140px;
}

.search-input:focus {
  outline: 1px solid var(--vscode-focusBorder, #007acc);
  outline-offset: -1px;
}

.search-counter {
  font-size: 11px;
  color: var(--vscode-descriptionForeground, #ccccccb3);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.search-results-dropdown {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  z-index: 100;
  list-style: none;
  margin: 0;
  padding: 0;
  min-width: 100%;
  width: max-content;
  max-width: min(420px, 50vw);
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--vscode-editorWidget-border, #3c3c3c);
  border-radius: 3px;
  background: var(--vscode-editorWidget-background, #252526);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.search-results-item {
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.search-clear-btn {
  font-size: 14px;
  line-height: 1;
}

.search-results-item:hover {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

.search-results-item.active {
  background: var(--vscode-list-activeSelectionBackground, #094771);
  color: var(--vscode-list-activeSelectionForeground, #ffffff);
}

.toolbar-end {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.toolbar-end :deep(.n-checkbox) {
  --n-color: var(--vscode-settings-checkboxBackground);
  --n-color-checked: var(--vscode-settings-checkboxBackground);
  --n-check-mark-color: var(--vscode-settings-checkboxForeground);
  --n-border: 1px solid var(--vscode-settings-checkboxBorder);
  --n-border-checked: 1px solid var(--vscode-settings-checkboxBorder);
  --n-border-focus: 1px solid var(--vscode-settings-checkboxBorder);
}

.toolbar-end :deep(.n-checkbox .n-checkbox__label) {
  white-space: nowrap;
}

</style>
