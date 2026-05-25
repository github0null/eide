import type { BuildReport } from './types/build-report';

export const HostMsg = {
  launched: 'eide.callgraph_view.launched',
  init: 'eide.callgraph_view.init',
  gotoDefinition: 'callgraph.gotoDefinition',
} as const;

export interface GotoDefinitionPayload {
  file: string;
  line?: number;
  column?: number;
}

export class HostBridgeError extends Error {
  constructor(
    public readonly code: 'NO_INLINE_DATA' | 'WEBVIEW_INIT_TIMEOUT' | 'INVALID_INIT',
    message: string,
  ) {
    super(message);
    this.name = 'HostBridgeError';
  }
}

const INIT_TIMEOUT_MS = 2000;

function isBuildReport(value: unknown): value is BuildReport {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return Array.isArray(r.callgraph) && Array.isArray(r.stackusage);
}

function isPlaceholderInit(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '$BUILD_REPORT' ||
    (typeof value === 'string' && value === '$BUILD_REPORT')
  );
}

export function readInlineInit(): BuildReport | undefined {
  const init = window.__CALLGRAPH_VIEW_INIT__;
  if (isPlaceholderInit(init) || !isBuildReport(init)) {
    return undefined;
  }
  return init;
}

export function isInVsCodeWebview(): boolean {
  try {
    return typeof window.acquireVsCodeApi === 'function';
  } catch {
    return false;
  }
}

function getVsCodeApi(): ReturnType<NonNullable<typeof window.acquireVsCodeApi>> | undefined {
  if (!isInVsCodeWebview()) {
    return undefined;
  }
  try {
    return window.acquireVsCodeApi?.();
  } catch {
    return undefined;
  }
}

export type HostBridge = {
  readonly inWebview: boolean;
  readonly hasInlineInit: boolean;
  ready(): Promise<void>;
  loadReport(): Promise<BuildReport>;
  gotoDefinition(payload: GotoDefinitionPayload): void;
  onReportUpdated(cb: (report: BuildReport) => void): () => void;
};

export function createHostBridge(): HostBridge {
  const vscode = getVsCodeApi();
  const inWebview = vscode !== undefined;

  let webviewReport: BuildReport | undefined;
  let webviewReadyResolve: (() => void) | undefined;
  let webviewReadyReject: ((err: Error) => void) | undefined;
  const updateListeners = new Set<(report: BuildReport) => void>();

  if (inWebview && vscode) {
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') {
        return;
      }
      const msg = data as { type?: string; id?: string; data?: unknown };
      const type = msg.type ?? msg.id;
      if (type === HostMsg.init) {
        const payload = msg.data ?? (data as { data?: unknown }).data;
        if (!isBuildReport(payload)) {
          return;
        }
        webviewReport = payload;
        updateListeners.forEach((cb) => cb(webviewReport!));
        webviewReadyResolve?.();
        webviewReadyResolve = undefined;
        webviewReadyReject = undefined;
      }
    });
  }

  return {
    inWebview,

    get hasInlineInit(): boolean {
      return readInlineInit() !== undefined;
    },

    ready(): Promise<void> {
      if (inWebview && vscode) {
        if (readInlineInit()) {
          return Promise.resolve();
        }
        return new Promise<void>((resolve, reject) => {
          if (webviewReport) {
            resolve();
            return;
          }
          webviewReadyResolve = resolve;
          webviewReadyReject = reject;
          vscode.postMessage({ id: HostMsg.launched });
          setTimeout(() => {
            if (!webviewReadyResolve) {
              return;
            }
            webviewReadyReject?.(
              new HostBridgeError(
                'WEBVIEW_INIT_TIMEOUT',
                'WEBVIEW INIT TIMEOUT',
              ),
            );
            webviewReadyResolve = undefined;
            webviewReadyReject = undefined;
          }, INIT_TIMEOUT_MS);
        });
      }
      if (readInlineInit()) {
        return Promise.resolve();
      }
      return Promise.reject(
        new HostBridgeError(
          'NO_INLINE_DATA',
          'NO INLINE DATA',
        ),
      );
    },

    loadReport(): Promise<BuildReport> {
      if (inWebview) {
        if (webviewReport) {
          return Promise.resolve(webviewReport);
        }
        const init = readInlineInit();
        if (init) {
          return Promise.resolve(init);
        }
        return Promise.reject(
          new HostBridgeError('INVALID_INIT', 'No data received from vscode webview'),
        );
      }
      const init = readInlineInit();
      if (init) {
        return Promise.resolve(init);
      }
      return Promise.reject(
        new HostBridgeError(
          'NO_INLINE_DATA',
          'NO INLINE DATA',
        ),
      );
    },

    gotoDefinition(payload: GotoDefinitionPayload): void {
      if (inWebview && vscode) {
        vscode.postMessage({
          id: HostMsg.gotoDefinition,
          data: payload,
        });
        return;
      }
      const loc =
        payload.line !== undefined
          ? `${payload.file}:${payload.line}`
          : payload.file;
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(loc);
      } else {
        console.info('[Callgraph View] Go to:', loc);
      }
    },

    onReportUpdated(cb: (report: BuildReport) => void): () => void {
      updateListeners.add(cb);
      return () => updateListeners.delete(cb);
    },
  };
}

export const hostBridge = createHostBridge();
