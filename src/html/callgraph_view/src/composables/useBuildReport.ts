import { computed, ref, shallowRef } from 'vue';
import { hostBridge, HostBridgeError } from '../host-bridge';
import { mergeCallgraphGraphs } from '../utils/merge-callgraph';
import type {
  BuildReport,
  CallgraphVcg,
  FunctionStackUsageEntry,
  NormalizedCallgraphGraph,
  StackUsageDocument,
  StackUsageRow,
} from '../types/build-report';

/** 与 Stack Usage「全部合并」一致，用于下拉选项 value */
export const ALL_CALLGRAPH_GRAPHS = -1;

function normalizeCallgraph(raw: unknown): CallgraphVcg[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((g) => {
    const graph = g as CallgraphVcg;
    return {
      graph: graph.graph ?? { title: '' },
      nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
      edges: Array.isArray(graph.edges) ? graph.edges : [],
      warnings: graph.warnings,
    };
  });
}

function normalizeStackusage(raw: unknown): StackUsageDocument[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((doc) => {
    const d = doc as StackUsageDocument;
    return {
      entries: Array.isArray(d.entries) ? d.entries : [],
      warnings: d.warnings,
    };
  });
}

function formatLocation(file: string, line?: number, column?: number): string {
  if (line !== undefined && column !== undefined) {
    return `${file}:${line}:${column}`;
  }
  if (line !== undefined) {
    return `${file}:${line}`;
  }
  return file;
}

const report = shallowRef<BuildReport | null>(null);
const loadError = ref<HostBridgeError | null>(null);
const loading = ref(true);

export async function initBuildReport(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    await hostBridge.ready();
    report.value = await hostBridge.loadReport();
    hostBridge.onReportUpdated((next) => {
      report.value = next;
    });
  } catch (err) {
    report.value = null;
    loadError.value =
      err instanceof HostBridgeError
        ? err
        : new HostBridgeError('INVALID_INIT', String(err));
  } finally {
    loading.value = false;
  }
}

export function useBuildReport() {
  const callgraph = computed(() =>
    report.value ? normalizeCallgraph(report.value.callgraph) : [],
  );

  const stackusage = computed(() =>
    report.value ? normalizeStackusage(report.value.stackusage) : [],
  );

  const hasCallgraph = computed(() => callgraph.value.length > 0);
  const hasStackUsage = computed(() => stackusage.value.length > 0);

  const callgraphGraphs = computed((): NormalizedCallgraphGraph[] =>
    callgraph.value.map((g, index) => ({
      index,
      title: g.graph?.title || `Graph ${index + 1}`,
      nodes: g.nodes,
      edges: g.edges,
      isEmpty: g.nodes.length === 0,
    })),
  );

  const mergedCallgraphGraph = computed((): NormalizedCallgraphGraph | null => {
    const graphs = callgraphGraphs.value;
    if (graphs.length === 0) {
      return null;
    }
    const { nodes, edges } = mergeCallgraphGraphs(graphs);
    return {
      index: ALL_CALLGRAPH_GRAPHS,
      title: 'Merged',
      nodes,
      edges,
      isEmpty: nodes.length === 0,
    };
  });

  const stackDocuments = computed(() =>
    stackusage.value.map((doc, index) => ({
      index,
      title: `Document ${index + 1}`,
      entries: doc.entries,
      isEmpty: doc.entries.length === 0,
    })),
  );

  const allStackEntries = computed((): FunctionStackUsageEntry[] =>
    stackusage.value.flatMap((doc) => doc.entries),
  );

  const allStackRows = computed((): StackUsageRow[] => {
    const rows: StackUsageRow[] = [];
    stackDocuments.value.forEach((doc) => {
      doc.entries.forEach((e) => {
        rows.push({
          functionName: e.functionName,
          stackBytes: e.stackBytes,
          allocationType: e.allocationType,
          locationText: formatLocation(
            e.location.file,
            e.location.line,
            e.location.column,
          ),
          file: e.location.file,
          line: e.location.line,
          column: e.location.column,
          sourceDoc: doc.title,
        });
      });
    });
    return rows;
  });

  const isFullyEmpty = computed(
    () =>
      !loading.value &&
      !loadError.value &&
      !hasCallgraph.value &&
      !hasStackUsage.value,
  );

  return {
    loading,
    loadError,
    report,
    callgraph,
    stackusage,
    hasCallgraph,
    hasStackUsage,
    callgraphGraphs,
    mergedCallgraphGraph,
    stackDocuments,
    allStackRows,
    allStackEntries,
    isFullyEmpty,
    hostBridge,
  };
}
