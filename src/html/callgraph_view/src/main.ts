import { createApp } from 'vue';
import App from './App.vue';
import { initBuildReport } from './composables/useBuildReport';
import { isInVsCodeWebview, readInlineInit } from './host-bridge';
import type { BuildReport } from './types/build-report';
import './styles/vscode-theme.css';
import './styles/naive-vscode-bridge.css';
import './styles/symbol-table.css';

function isBuildReport(value: unknown): value is BuildReport {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return Array.isArray(r.callgraph) && Array.isArray(r.stackusage);
}

/** 本地预览 / 构建产物：无 Webview 注入时加载打包进来的样例数据 */
async function ensureFallbackInlineData(): Promise<void> {
  if (readInlineInit() || isInVsCodeWebview()) {
    return;
  }
  try {
    if (import.meta.env.DEV) {
      const mod = await import('../fixtures/statistic.json');
      const data = (mod as { default?: BuildReport }).default ?? mod;
      if (isBuildReport(data)) {
        window.__CALLGRAPH_VIEW_INIT__ = data;
      }
    } else {
      console.warn('[Callgraph View] No local test data');
    }
  } catch (err) {
    console.warn('[Callgraph View] Failed to load local test data:', err);
  }
}

async function bootstrap(): Promise<void> {
  try {
    await ensureFallbackInlineData();
  } catch (err) {
    console.warn('[Callgraph View] Failed to load fallback data:', err);
  }

  const app = createApp(App);
  app.mount('#app');

  try {
    await initBuildReport();
  } catch (err) {
    console.error('[Callgraph View] Failed to init:', err);
  }
}

void bootstrap();
