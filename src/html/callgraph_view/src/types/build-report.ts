export interface VcgLocation {
  file: string;
  line?: number;
  column?: number;
}

export interface VcgNode {
  title: string;
  label: string;
  location?: VcgLocation;
  shape?: string;
}

export interface VcgEdge {
  sourcename: string;
  targetname: string;
  label?: string;
}

export interface CallgraphVcg {
  graph: { title: string };
  nodes: VcgNode[];
  edges: VcgEdge[];
  warnings?: string[];
}

export interface StackUsageSourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface FunctionStackUsageEntry {
  location: StackUsageSourceLocation;
  functionName: string;
  stackBytes: number;
  allocationType: string;
}

export interface StackUsageDocument {
  entries: FunctionStackUsageEntry[];
  warnings?: string[];
}

export interface BuildReport {
  callgraph: CallgraphVcg[];
  stackusage: StackUsageDocument[];
}

export interface NormalizedCallgraphGraph {
  index: number;
  title: string;
  nodes: VcgNode[];
  edges: VcgEdge[];
  isEmpty: boolean;
}

export interface StackUsageRow {
  functionName: string;
  stackBytes: number;
  allocationType: string;
  locationText: string;
  file: string;
  line: number;
  column: number;
  sourceDoc: string;
}
