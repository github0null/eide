import { computed, ref, watch, type Ref } from 'vue';
import type { VcgNode } from '../types/build-report';

export interface CallgraphSearchMatch {
  title: string;
  label: string;
}

export function useCallgraphSearch(
  searchText: Ref<string>,
  nodes: Ref<VcgNode[]>,
) {
  const activeIndex = ref(0);

  const matches = computed((): CallgraphSearchMatch[] => {
    const q = searchText.value.trim().toLowerCase();
    if (!q) {
      return [];
    }
    return nodes.value
      .filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.title.toLowerCase().includes(q),
      )
      .map((n) => ({ title: n.title, label: n.label }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
      );
  });

  const activeMatch = computed(
    () => matches.value[activeIndex.value] ?? null,
  );

  const hasMatches = computed(() => matches.value.length > 0);

  watch(searchText, () => {
    activeIndex.value = 0;
  });

  watch(matches, (list) => {
    if (list.length === 0) {
      activeIndex.value = 0;
      return;
    }
    if (activeIndex.value >= list.length) {
      activeIndex.value = 0;
    }
  });

  function setActiveIndex(index: number): void {
    if (matches.value.length === 0) {
      activeIndex.value = 0;
      return;
    }
    const clamped = Math.max(0, Math.min(index, matches.value.length - 1));
    activeIndex.value = clamped;
  }

  function goPrev(): void {
    if (matches.value.length === 0) {
      return;
    }
    setActiveIndex(
      activeIndex.value <= 0
        ? matches.value.length - 1
        : activeIndex.value - 1,
    );
  }

  function goNext(): void {
    if (matches.value.length === 0) {
      return;
    }
    setActiveIndex(
      activeIndex.value >= matches.value.length - 1
        ? 0
        : activeIndex.value + 1,
    );
  }

  return {
    matches,
    activeIndex,
    activeMatch,
    hasMatches,
    setActiveIndex,
    goPrev,
    goNext,
  };
}
