/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

interface Window {
  __CALLGRAPH_VIEW_INIT__?: import('./types/build-report').BuildReport;
  acquireVsCodeApi?: () => VsCodeApi;
}
