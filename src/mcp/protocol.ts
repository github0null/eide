export interface ProjectInfo {
    uid: string;
    name: string;
    rootPath: string;
    wsPath: string;
}

export interface RegisterMessage {
    type: 'register';
    instanceId: string;
    projects: ProjectInfo[];
}

export interface RegistryUpdateMessage {
    type: 'registryUpdate';
    instanceId: string;
    projects: ProjectInfo[];
}

export interface HttpRequestMessage {
    type: 'httpRequest';
    requestId: string;
    method: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    body?: unknown;
}

export interface HttpResponseMessage {
    type: 'httpResponse';
    requestId: string;
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    body?: string;
}

export interface HttpChunkMessage {
    type: 'httpChunk';
    requestId: string;
    chunk: string;
}

export interface HttpEndMessage {
    type: 'httpEnd';
    requestId: string;
}

export type BackendToProxyMessage =
    | RegisterMessage
    | RegistryUpdateMessage
    | HttpResponseMessage
    | HttpChunkMessage
    | HttpEndMessage;

export type ProxyToBackendMessage = HttpRequestMessage;

export type WsMessage = BackendToProxyMessage | ProxyToBackendMessage;

export function parseWsMessage(data: string): WsMessage | undefined {
    try {
        return JSON.parse(data) as WsMessage;
    } catch {
        return undefined;
    }
}
