<script setup lang="ts">
import {
  NConfigProvider,
  NIcon,
  NMenu,
  NResult,
  type MenuOption,
} from 'naive-ui';
import { GraphIcon, TableIcon } from './icons';
import { computed, h, ref } from 'vue';
import { useBuildReport } from './composables/useBuildReport';
import { callgraphSession } from './composables/usePageSessionState';
import { useVscodeNaiveTheme } from './composables/useVscodeNaiveTheme';
import CallgraphView from './views/CallgraphView.vue';
import StackUsageView from './views/StackUsageView.vue';

const { theme, overrides } = useVscodeNaiveTheme();
const { loading, loadError } = useBuildReport();

type PageKey = 'callgraph' | 'stackusage';
const activePage = ref<PageKey>('callgraph');
const menuCollapsed = ref(true);

const menuOptions: MenuOption[] = [
  {
    label: 'Callgraph',
    key: 'callgraph',
    icon: () => h(NIcon, null, { default: () => h(GraphIcon) }),
  },
  {
    label: 'Stack Usage',
    key: 'stackusage',
    icon: () => h(NIcon, null, { default: () => h(TableIcon) }),
  },
];

const pageTitle = computed(() =>
  activePage.value === 'callgraph' ? 'Callgraph' : 'Stack Usage',
);

const callgraphGraphStats = computed(
  () => callgraphSession.graphStats.value,
);
</script>

<template>
  <NConfigProvider
    :theme="theme"
    :theme-overrides="overrides"
    inline-theme-disabled
    preflight-style-disabled
  >
    <div class="app-root" :class="{ 'app-root--sider-collapsed': menuCollapsed }">
      <aside class="app-sider">
        <NMenu
          v-model:value="activePage"
          :collapsed="menuCollapsed"
          :collapsed-width="48"
          :options="menuOptions"
        />
        <button
          type="button"
          class="sider-toggle"
          :title="menuCollapsed ? 'Expand' : 'Collapse'"
          @click="menuCollapsed = !menuCollapsed"
        >
          {{ menuCollapsed ? '»' : '«' }}
        </button>
      </aside>
      <div class="app-main">
        <header class="page-header">
          <span class="page-title">{{ pageTitle }}</span>
          <span
            v-if="activePage === 'callgraph' && callgraphGraphStats"
            class="badge page-header-stats"
          >
            {{ callgraphGraphStats.nodes }} nodes ·
            {{ callgraphGraphStats.edges }} edges
          </span>
        </header>
        <main class="app-body">
          <NResult
            v-if="loadError"
            status="error"
            title="Cannot load data"
            :description="loadError.message"
          />
          <div v-else class="app-pages">
            <template v-if="!loading">
              <CallgraphView
                v-show="activePage === 'callgraph'"
                class="app-page"
                :pane-visible="activePage === 'callgraph'"
              />
              <StackUsageView
                v-show="activePage === 'stackusage'"
                class="app-page"
                :pane-visible="activePage === 'stackusage'"
              />
            </template>
            <div
              v-if="loading"
              class="app-pages-overlay"
              role="status"
              aria-live="polite"
              aria-label="Loading"
            >
              <div class="app-loading-spinner" />
              <span class="app-loading-text">Loading…</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  </NConfigProvider>
</template>

<style scoped>
.app-root {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  transition: grid-template-columns 0.2s ease;
}

.app-root--sider-collapsed {
  grid-template-columns: 48px minmax(0, 1fr);
}

.app-sider {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid var(--vscode-editorWidget-border, #3c3c3c);
  background: var(--vscode-sideBar-background, #252526);
  overflow: hidden;
}

.app-sider :deep(.n-menu) {
  flex: 1;
  min-height: 0;
}

.sider-toggle {
  flex-shrink: 0;
  margin: 4px;
  padding: 4px 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--vscode-foreground, #cccccc);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.sider-toggle:hover {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

.app-main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.app-body {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 8px 12px 12px;
}

.app-pages {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: grid;
  grid-template: 1fr / 1fr;
}

.app-page {
  grid-area: 1 / 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.app-pages-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: color-mix(
    in srgb,
    var(--vscode-editor-background, #1e1e1e) 72%,
    transparent
  );
}

.app-loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--vscode-editorWidget-border, #3c3c3c);
  border-top-color: var(
    --vscode-progressBar-background,
    var(--vscode-focusBorder, #007acc)
  );
  border-radius: 50%;
  animation: app-loading-spin 0.75s linear infinite;
}

.app-loading-text {
  font-size: 12px;
  color: var(--vscode-descriptionForeground, #ccccccb3);
}

@keyframes app-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
