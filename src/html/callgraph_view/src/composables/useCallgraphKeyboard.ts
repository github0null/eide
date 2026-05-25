import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import {
  inverseNeighborAxis,
  sortedLevelPeerTitles,
  sortedNeighborTitles,
  type GraphNavMode,
  type NeighborAxis,
} from '../utils/callgraph-neighbors';
import type { VcgEdge, VcgNode } from '../types/build-report';

/** 跨层跳转前压栈：记录返回地址与离开方向（← callers / → callees） */
interface LrFrame {
  returnTo: string;
  via: NeighborAxis;
}

function isGraphNavigationKey(key: string): boolean {
  return (
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight'
  );
}

/** 上下：同层；左右：前级/后级（callers / callees） */
function keyToNavMode(key: string): { mode: GraphNavMode; delta: 1 | -1 } | null {
  if (key === 'ArrowUp') {
    return { mode: 'level', delta: -1 };
  }
  if (key === 'ArrowDown') {
    return { mode: 'level', delta: 1 };
  }
  if (key === 'ArrowLeft') {
    return { mode: 'callers', delta: -1 };
  }
  if (key === 'ArrowRight') {
    return { mode: 'callees', delta: 1 };
  }
  return null;
}

function shouldIgnoreGlobalKeyboard(): boolean {
  const el = document.activeElement;
  if (!el) {
    return false;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return true;
  }
  if (el.closest('.n-base-select-menu, .n-base-selection')) {
    return true;
  }
  return false;
}

export function useCallgraphKeyboard(options: {
  paneVisible: Ref<boolean>;
  searchText: Ref<string>;
  hasSearchMatches: Ref<boolean>;
  goSearchPrev: () => void;
  goSearchNext: () => void;
  selectedNodeId: Ref<string | null>;
  graphEdges: Ref<VcgEdge[]>;
  graphNodes: Ref<VcgNode[]>;
  onSelectNode: (title: string) => void;
  onPanToNode: (title: string) => void;
}) {
  const graphNavMode = ref<GraphNavMode | null>(null);
  const graphNavIndex = ref(0);
  const lrStack = ref<LrFrame[]>([]);
  let suppressNavStateReset = false;

  function clearLrStack(): void {
    lrStack.value = [];
  }

  watch(options.selectedNodeId, () => {
    if (suppressNavStateReset) {
      return;
    }
    graphNavMode.value = null;
    graphNavIndex.value = 0;
  });

  watch(options.searchText, (q) => {
    if (q.trim()) {
      graphNavMode.value = null;
      graphNavIndex.value = 0;
      clearLrStack();
    }
  });

  function applyNavigation(nextTitle: string): void {
    suppressNavStateReset = true;
    options.onSelectNode(nextTitle);
    options.onPanToNode(nextTitle);
    void nextTick(() => {
      suppressNavStateReset = false;
    });
  }

  function navigateList(list: string[], mode: GraphNavMode, delta: 1 | -1): void {
    if (list.length === 0) {
      return;
    }

    if (graphNavMode.value !== mode) {
      graphNavMode.value = mode;
      const current = options.selectedNodeId.value;
      const idx = current ? list.indexOf(current) : -1;
      graphNavIndex.value =
        idx >= 0 ? idx : delta > 0 ? 0 : list.length - 1;
    }

    if (list.length === 1) {
      graphNavIndex.value = 0;
    } else {
      graphNavIndex.value =
        (graphNavIndex.value + delta + list.length) % list.length;
    }

    applyNavigation(list[graphNavIndex.value]!);
  }

  function tryPopLr(axis: NeighborAxis): boolean {
    const top = lrStack.value[lrStack.value.length - 1];
    if (!top || top.via !== inverseNeighborAxis(axis)) {
      return false;
    }
    const frame = lrStack.value.pop()!;
    graphNavMode.value = axis;
    const list = sortedNeighborTitles(
      options.selectedNodeId.value!,
      options.graphEdges.value,
      options.graphNodes.value,
      axis,
    );
    graphNavIndex.value = list.indexOf(frame.returnTo);
    applyNavigation(frame.returnTo);
    return true;
  }

  function navigateDepthAxis(axis: NeighborAxis, delta: 1 | -1): void {
    const current = options.selectedNodeId.value;
    if (!current) {
      return;
    }

    if (tryPopLr(axis)) {
      return;
    }

    const edges = options.graphEdges.value;
    const nodes = options.graphNodes.value;
    const list = sortedNeighborTitles(current, edges, nodes, axis);
    if (list.length === 0) {
      return;
    }

    if (graphNavMode.value !== axis) {
      graphNavMode.value = axis;
      const idx = list.indexOf(current);
      graphNavIndex.value =
        idx >= 0 ? idx : delta > 0 ? 0 : list.length - 1;
    }

    if (list.length === 1) {
      graphNavIndex.value = 0;
    } else {
      graphNavIndex.value =
        (graphNavIndex.value + delta + list.length) % list.length;
    }

    const nextTitle = list[graphNavIndex.value]!;
    if (nextTitle !== current) {
      lrStack.value.push({ returnTo: current, via: axis });
    }
    applyNavigation(nextTitle);
  }

  function navigateGraph(mode: GraphNavMode, delta: 1 | -1): void {
    const title = options.selectedNodeId.value;
    if (!title) {
      return;
    }

    if (mode === 'level') {
      const list = sortedLevelPeerTitles(
        title,
        options.graphEdges.value,
        options.graphNodes.value,
      );
      navigateList(list, mode, delta);
      return;
    }

    navigateDepthAxis(mode as NeighborAxis, delta);
  }

  function onSearchKeydown(event: KeyboardEvent): void {
    if (!options.hasSearchMatches.value) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      options.goSearchNext();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      options.goSearchPrev();
    }
  }

  function onWindowKeydown(event: KeyboardEvent): void {
    if (!options.paneVisible.value) {
      return;
    }
    if (shouldIgnoreGlobalKeyboard()) {
      return;
    }

    if (options.searchText.value.trim()) {
      return;
    }

    if (!isGraphNavigationKey(event.key)) {
      return;
    }
    if (!options.selectedNodeId.value) {
      return;
    }

    const mapped = keyToNavMode(event.key);
    if (!mapped) {
      return;
    }

    event.preventDefault();
    navigateGraph(mapped.mode, mapped.delta);
  }

  onMounted(() => {
    window.addEventListener('keydown', onWindowKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', onWindowKeydown);
  });

  return {
    onSearchKeydown,
    clearLrStack,
  };
}
