<script setup lang="ts">
import { NDropdown } from 'naive-ui';
import { computed, nextTick, ref, watch } from 'vue';
import type { StackUsageRow } from '../../types/build-report';
import { stackUsageScrollByKey } from '../../composables/usePageSessionState';
import { hostBridge } from '../../host-bridge';

const props = defineProps<{
  rows: StackUsageRow[];
  showSourceColumn: boolean;
  /** 不同文档各自记住滚动位置 */
  scrollKey?: string;
  paneVisible?: boolean;
}>();

const scrollEl = ref<HTMLElement | null>(null);

function scrollSessionKey(): string {
  return props.scrollKey ?? 'default';
}

function saveScrollPosition(): void {
  if (!scrollEl.value) {
    return;
  }
  stackUsageScrollByKey.set(scrollSessionKey(), scrollEl.value.scrollTop);
}

function restoreScrollPosition(): void {
  void nextTick(() => {
    if (!scrollEl.value) {
      return;
    }
    scrollEl.value.scrollTop = stackUsageScrollByKey.get(scrollSessionKey()) ?? 0;
  });
}

function onTableScroll(): void {
  saveScrollPosition();
}

watch(
  () => props.scrollKey,
  (_next, prev) => {
    if (prev !== undefined) {
      stackUsageScrollByKey.set(String(prev), scrollEl.value?.scrollTop ?? 0);
    }
    restoreScrollPosition();
  },
);

watch(
  () => props.paneVisible,
  (visible, wasVisible) => {
    if (wasVisible && !visible) {
      saveScrollPosition();
    } else if (visible && !wasVisible) {
      restoreScrollPosition();
    }
  },
);

type SortKey = 'stackBytes' | 'functionName' | 'locationText' | 'allocationType' | 'sourceDoc';
type SortDir = 'asc' | 'desc';

const filterText = ref('');
const sortKey = ref<SortKey>('stackBytes');
const sortDir = ref<SortDir>('desc');
const selectedRow = ref<number | null>(null);

const contextMenu = ref({ show: false, x: 0, y: 0, row: null as StackUsageRow | null });

const maxStack = computed(() =>
  props.rows.reduce((m, r) => Math.max(m, r.stackBytes), 0),
);

const filtered = computed(() => {
  const t = filterText.value.trim().toLowerCase();
  if (!t) {
    return props.rows;
  }
  return props.rows.filter(
    (r) =>
      r.functionName.toLowerCase().includes(t) ||
      r.locationText.toLowerCase().includes(t) ||
      r.allocationType.toLowerCase().includes(t) ||
      r.sourceDoc.toLowerCase().includes(t),
  );
});

const sorted = computed(() => {
  const list = [...filtered.value];
  const dir = sortDir.value === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    let av: string | number;
    let bv: string | number;
    switch (sortKey.value) {
      case 'stackBytes':
        av = a.stackBytes;
        bv = b.stackBytes;
        break;
      case 'functionName':
        return a.functionName.localeCompare(b.functionName) * dir;
      case 'locationText':
        return a.locationText.localeCompare(b.locationText) * dir;
      case 'allocationType':
        return a.allocationType.localeCompare(b.allocationType) * dir;
      case 'sourceDoc':
        return a.sourceDoc.localeCompare(b.sourceDoc) * dir;
      default:
        return 0;
    }
    if (av === bv) {
      return 0;
    }
    return av > bv ? dir : -dir;
  });
  return list;
});

const totalStack = computed(() =>
  props.rows.reduce((s, r) => s + r.stackBytes, 0),
);

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = key === 'stackBytes' ? 'desc' : 'asc';
  }
}

function sortIndicator(key: SortKey): string {
  if (sortKey.value !== key) {
    return '↕';
  }
  return sortDir.value === 'asc' ? '↑' : '↓';
}

function onContextMenu(ev: MouseEvent, row: StackUsageRow, index: number) {
  ev.preventDefault();
  selectedRow.value = index;
  contextMenu.value = { show: true, x: ev.clientX, y: ev.clientY, row };
}

function hideMenu() {
  contextMenu.value.show = false;
}

function gotoDefinition() {
  const row = contextMenu.value.row;
  if (row) {
    hostBridge.gotoDefinition({
      file: row.file,
      line: row.line,
      column: row.column,
    });
  }
  hideMenu();
}

const menuOptions = [{ label: 'Go To Definition', key: 'goto' }];

function onMenuSelect(key: string) {
  if (key === 'goto') {
    gotoDefinition();
  }
}

defineExpose({ filterText });
</script>

<template>
  <div class="table-wrapper" @click="hideMenu">
    <div class="page-toolbar" style="padding: 8px 10px">
      <input
        v-model="filterText"
        class="search-input"
        type="text"
        placeholder="Filter by function, file, type ..."
      />
      <span class="badge">{{ filtered.length }} functions</span>
    </div>
    <div ref="scrollEl" class="table-scroll" @scroll="onTableScroll">
      <table v-if="sorted.length > 0" class="stack-table">
        <thead>
          <tr>
            <th
              class="sortable"
              :class="{ sorted: sortKey === 'stackBytes' }"
              @click="toggleSort('stackBytes')"
            >
              Stack <span class="sort-indicator">{{ sortIndicator('stackBytes') }}</span>
            </th>
            <th
              class="sortable"
              :class="{ sorted: sortKey === 'functionName' }"
              @click="toggleSort('functionName')"
            >
              Function <span class="sort-indicator">{{ sortIndicator('functionName') }}</span>
            </th>
            <th
              class="sortable"
              :class="{ sorted: sortKey === 'locationText' }"
              @click="toggleSort('locationText')"
            >
              Location <span class="sort-indicator">{{ sortIndicator('locationText') }}</span>
            </th>
            <th
              class="sortable"
              :class="{ sorted: sortKey === 'allocationType' }"
              @click="toggleSort('allocationType')"
            >
              Type <span class="sort-indicator">{{ sortIndicator('allocationType') }}</span>
            </th>
            <th
              v-if="showSourceColumn"
              class="sortable"
              :class="{ sorted: sortKey === 'sourceDoc' }"
              @click="toggleSort('sourceDoc')"
            >
              Source <span class="sort-indicator">{{ sortIndicator('sourceDoc') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in sorted"
            :key="`${row.functionName}-${row.locationText}-${idx}`"
            :class="{ selected: selectedRow === idx }"
            @contextmenu="onContextMenu($event, row, idx)"
          >
            <td
              class="col-stack"
              :style="{
                '--size-fill': maxStack > 0 ? row.stackBytes / maxStack : 0,
              }"
            >
              <span>{{ row.stackBytes }} B</span>
            </td>
            <td class="col-fn" :title="row.functionName">{{ row.functionName }}</td>
            <td class="col-loc" :title="row.locationText">{{ row.locationText }}</td>
            <td class="col-type" :title="row.allocationType">{{ row.allocationType }}</td>
            <td v-if="showSourceColumn" class="col-src" :title="row.sourceDoc">
              {{ row.sourceDoc }}
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-center">
        <slot name="empty">No matched results</slot>
      </div>
    </div>
    <div class="table-footer">
      <span>Max stack: {{ maxStack }} B · Total: {{ totalStack }} B</span>
      <span class="muted"
        >Sort: {{ sortKey }} ({{ sortDir }}), Filter: "{{ filterText.trim() }}"</span
      >
    </div>
    <NDropdown
      :show="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :options="menuOptions"
      placement="bottom-start"
      @select="onMenuSelect"
      @clickoutside="hideMenu"
    />
  </div>
</template>

<style scoped>
.table-wrapper {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.search-input {
  padding: 4px 8px;
  border-radius: 2px;
  border: 1px solid var(--vscode-input-border, #3c3c3c);
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #f0f0f0);
  font-size: 12px;
  min-width: 200px;
}

.search-input:focus {
  outline: 1px solid var(--vscode-focusBorder, #007acc);
  outline-offset: -1px;
}

.muted {
  opacity: 0.6;
}
</style>
