import { Request, Response, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import * as z from 'zod/v4';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { getOAuthProtectedResourceMetadataUrl, mcpAuthMetadataRouter } from '@modelcontextprotocol/sdk/server/auth/router';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express';
import {
    CallToolResult,
    ElicitResult,
    ElicitResultSchema,
    GetPromptResult,
    isInitializeRequest,
    PrimitiveSchemaDefinition,
    ReadResourceResult,
    ResourceLink
} from '@modelcontextprotocol/sdk/types';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore';
import { InMemoryTaskStore, InMemoryTaskMessageQueue } from '@modelcontextprotocol/sdk/experimental/tasks/stores/in-memory';
import { setupAuthServer } from '@modelcontextprotocol/sdk/examples/server/demoInMemoryOAuthProvider';
import { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth';
import { checkResourceAllowed } from '@modelcontextprotocol/sdk/shared/auth-utils';
import { GlobalEvent } from './GlobalEvents';
import { ProjectExplorer } from './EIDEProjectExplorer';
import { AbstractProject } from './EIDEProject';
import { CodeBuilder } from './CodeBuilder';
import { StatusBarManager } from './StatusBarManager';

let projectExplorer: ProjectExplorer;

// Check for OAuth flag
const useOAuth = false; // process.argv.includes('--oauth');
const strictOAuth = false; // process.argv.includes('--oauth-strict');

// Create shared task store for demonstration
const taskStore = new InMemoryTaskStore();

// Create an MCP server with implementation details
const getServer = () => {

    const server = new McpServer(
        {
            name: 'eide mcp server',
            version: '1.0.0',
            icons: [{ src: './mcp.svg', sizes: ['512x512'], mimeType: 'image/svg+xml' }],
            websiteUrl: 'https://github.com/modelcontextprotocol/typescript-sdk'
        },
        {
            capabilities: { logging: {}, tasks: { requests: { tools: { call: {} } } } },
            taskStore, // Enable task support
            taskMessageQueue: new InMemoryTaskMessageQueue()
        }
    );

    // build
    server.registerTool(
        'build',
        {
            title: 'Build Project', // Display name for UI
            description: 'Build your eide project.',
            inputSchema: {
                uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.')
            }
        },
        async ({ uid }): Promise<CallToolResult> => {

            let prj: AbstractProject | undefined;

            if (uid) {
                prj = projectExplorer.getProjectByUid(uid);
            } else {
                prj = projectExplorer.getActiveProject();
            }

            if (!prj) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: uid ? `Error. Not such project (uid=${uid}).` : `Error. No any active project.`
                        }
                    ]
                };
            }

            const res = await projectExplorer.buildProject(prj, { notRebuild: true, otherArgs: ['--no-color'] }, true);

            return {
                isError: !res.success,
                content: [
                    {
                        type: 'text',
                        text: res.message
                    }
                ]
            };
        }
    );

    // rebuild
    server.registerTool(
        'rebuild',
        {
            title: 'Rebuild Project', // Display name for UI
            description: 'Rebuild your eide project.',
            inputSchema: {
                uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.')
            }
        },
        async ({ uid }): Promise<CallToolResult> => {

            let prj: AbstractProject | undefined;

            if (uid) {
                prj = projectExplorer.getProjectByUid(uid);
            } else {
                prj = projectExplorer.getActiveProject();
            }

            if (!prj) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: uid ? `Error. Not such project (uid=${uid}).` : `Error. No any active project.`
                        }
                    ]
                };
            }

            const res = await projectExplorer.buildProject(prj, { otherArgs: ['--no-color'] }, true);

            return {
                isError: !res.success,
                content: [
                    {
                        type: 'text',
                        text: res.message
                    }
                ]
            };
        }
    );

    // clean
    server.registerTool(
        'clean',
        {
            title: 'Clean Project', // Display name for UI
            description: `Clean up the generated products in the "build" directory.`,
            inputSchema: {
                uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.')
            }
        },
        async ({ uid }): Promise<CallToolResult> => {

            let prj: AbstractProject | undefined;

            if (uid) {
                prj = projectExplorer.getProjectByUid(uid);
            } else {
                prj = projectExplorer.getActiveProject();
            }

            if (!prj) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: uid ? `Error. Not such project (uid=${uid}).` : `Error. No any active project.`
                        }
                    ]
                };
            }

            const res = await projectExplorer.cleanProject(prj, true);

            return {
                isError: !res.success,
                content: [
                    {
                        type: 'text',
                        text: res.message
                    }
                ]
            };
        }
    );

    // flash
    server.registerTool(
        'flash',
        {
            title: 'Program Flash', // Display name for UI
            description: 'Perform flash memory programming on your MCU',
            inputSchema: {
                uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.'),
                eraseAll: z.boolean().describe('Determine whether to perform a chip erase of the mcu.')
            }
        },
        async ({ uid, eraseAll }): Promise<CallToolResult> => {

            let prj: AbstractProject | undefined;

            if (uid) {
                prj = projectExplorer.getProjectByUid(uid);
            } else {
                prj = projectExplorer.getActiveProject();
            }

            if (!prj) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: uid ? `Error. Not such project (uid=${uid}).` : `Error. No any active project.`
                        }
                    ]
                };
            }

            if (eraseAll) {
                await projectExplorer.programFlashProject(prj, true, true);
            }

            const res = await projectExplorer.programFlashProject(prj, false, true);
            if (res) {
                return {
                    isError: !res.success,
                    content: [
                        {
                            type: 'text',
                            text: res.message + (res.error ? '\n\nError: ' + res.error?.message : '')
                        }
                    ]
                };
            } else {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: 'Unknown Error.'
                        }
                    ]
                };
            }
        }
    );

    // reload
    server.registerTool(
        'reload',
        {
            title: 'Reload Project', // Display name for UI
            description: `Reload the project. After you manually modify the project file, you should call this method to reload the project.`,
            inputSchema: {
                uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.')
            }
        },
        async ({ uid }): Promise<CallToolResult> => {

            let prj: AbstractProject | undefined;

            if (uid) {
                prj = projectExplorer.getProjectByUid(uid);
            } else {
                prj = projectExplorer.getActiveProject();
            }

            if (!prj) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: uid ? `Error. Not such project (uid=${uid}).` : `Error. No any active project.`
                        }
                    ]
                };
            }

            const ok = await projectExplorer.reloadProject(prj.getUid(), false);

            return new Promise((resolve) => {
                const result: CallToolResult = {
                    isError: !ok,
                    content: [
                        {
                            type: 'text',
                            text: ok ? 'Succeed.' : 'Failed.'
                        }
                    ]
                };
                if (ok) {
                    setTimeout(() => {
                        resolve(result);
                    }, 3000);
                } else {
                    setTimeout(() => {
                        resolve(result);
                    }, 500);
                }
            });
        }
    );

    // switch target
    server.registerTool(
        'switchTarget',
        {
            title: 'Switch Target', // Display name for UI
            description: `Select active build target for eide project.`,
            inputSchema: {
                uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.'),
                targetName: z.string().describe('Target Name.')
            }
        },
        async ({ uid, targetName }): Promise<CallToolResult> => {

            let prj: AbstractProject | undefined;

            if (uid) {
                prj = projectExplorer.getProjectByUid(uid);
            } else {
                prj = projectExplorer.getActiveProject();
            }

            if (!prj) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: uid ? `Error. Not such project (uid=${uid}).` : `Error. No any active project.`
                        }
                    ]
                };
            }

            const targets = prj.getTargets();
            if (!targets.includes(targetName)) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `Project '${prj.getProjectName()}' (uid=${uid}) not have this target: '${targetName}'`
                        }
                    ]
                };
            }

            return new Promise(async (resolve) => {
                await prj.switchTarget(targetName);
                setTimeout(() => {
                    resolve({
                        isError: false,
                        content: [
                            {
                                type: 'text',
                                text: 'Succeed.'
                            }
                        ]
                    });
                }, 1500);
            });
        }
    );

    return server;
};

const app = createMcpExpressApp();

// Set up OAuth if enabled
let authMiddleware: RequestHandler | null;

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

function log_info(msg: string) {
    GlobalEvent.log_info(msg);
}

function log_error(msg: string, err?: Error) {
    GlobalEvent.log_error(msg);
    if (err)
        GlobalEvent.log_error(err);
}

export function mcpServerInit(mcp_port: number, prjExplorer: ProjectExplorer) {

    const MCP_PORT = mcp_port;
    const AUTH_PORT = mcp_port + 1;

    projectExplorer = prjExplorer;

    GlobalEvent.log_info('Init mcp server.');

    if (useOAuth) {
        // Create auth middleware for MCP endpoints
        const mcpServerUrl = new URL(`http://localhost:${MCP_PORT}/mcp`);
        const authServerUrl = new URL(`http://localhost:${AUTH_PORT}`);

        const oauthMetadata: OAuthMetadata = setupAuthServer({ authServerUrl, mcpServerUrl, strictResource: strictOAuth });

        const tokenVerifier = {
            verifyAccessToken: async (token: string) => {
                const endpoint = oauthMetadata.introspection_endpoint;

                if (!endpoint) {
                    throw new Error('No token verification endpoint available in metadata');
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        token: token
                    }).toString()
                });

                if (!response.ok) {
                    const text = await response.text().catch(() => null);
                    throw new Error(`Invalid or expired token: ${text}`);
                }

                const data: any = await response.json();

                if (strictOAuth) {
                    if (!data.aud) {
                        throw new Error(`Resource Indicator (RFC8707) missing`);
                    }
                    if (!checkResourceAllowed({ requestedResource: data.aud, configuredResource: mcpServerUrl })) {
                        throw new Error(`Expected resource indicator ${mcpServerUrl}, got: ${data.aud}`);
                    }
                }

                // Convert the response to AuthInfo format
                return {
                    token,
                    clientId: data.client_id,
                    scopes: data.scope ? data.scope.split(' ') : [],
                    expiresAt: data.exp
                };
            }
        };
        // Add metadata routes to the main MCP server
        app.use(
            mcpAuthMetadataRouter({
                oauthMetadata,
                resourceServerUrl: mcpServerUrl,
                scopesSupported: ['mcp:tools'],
                resourceName: 'MCP Demo Server'
            })
        );

        authMiddleware = requireBearerAuth({
            verifier: tokenVerifier,
            requiredScopes: [],
            resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl)
        });
    }

    // MCP POST endpoint with optional auth
    const mcpPostHandler = async (req: Request, res: Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (sessionId) {
            log_info(`Received MCP request for session: ${sessionId}`);
        } else {
            log_info('Request body:' + JSON.stringify(req.body));
        }

        if (useOAuth && req.auth) {
            log_info('Authenticated user:' + JSON.stringify(req.auth));
        }
        try {
            let transport: StreamableHTTPServerTransport;
            if (sessionId && transports[sessionId]) {
                // Reuse existing transport
                transport = transports[sessionId];
            } else if (!sessionId && isInitializeRequest(req.body)) {
                // New initialization request
                const eventStore = new InMemoryEventStore();
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    eventStore, // Enable resumability
                    onsessioninitialized: sessionId => {
                        // Store the transport by session ID when session is initialized
                        // This avoids race conditions where requests might come in before the session is stored
                        log_info(`Session initialized with ID: ${sessionId}`);
                        transports[sessionId] = transport;
                    }
                });

                // Set up onclose handler to clean up transport when closed
                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid && transports[sid]) {
                        log_info(`Transport closed for session ${sid}, removing from transports map`);
                        delete transports[sid];
                    }
                };

                // Connect the transport to the MCP server BEFORE handling the request
                // so responses can flow back through the same transport
                const server = getServer();
                await server.connect(transport);

                await transport.handleRequest(req, res, req.body);
                return; // Already handled
            } else {
                // Invalid request - no session ID or not initialization request
                res.status(400).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32000,
                        message: 'Bad Request: No valid session ID provided'
                    },
                    id: null
                });
                return;
            }

            // Handle the request with existing transport - no need to reconnect
            // The existing transport is already connected to the server
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            log_error('Error handling MCP request:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal server error'
                    },
                    id: null
                });
            }
        }
    };

    // Set up routes with conditional auth middleware
    if (useOAuth && authMiddleware) {
        app.post('/mcp', authMiddleware, mcpPostHandler);
    } else {
        app.post('/mcp', mcpPostHandler);
    }

    // Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
    const mcpGetHandler = async (req: Request, res: Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }

        if (useOAuth && req.auth) {
            log_info('Authenticated SSE connection from user:' + JSON.stringify(req.auth));
        }

        // Check for Last-Event-ID header for resumability
        const lastEventId = req.headers['last-event-id'] as string | undefined;
        if (lastEventId) {
            log_info(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
        } else {
            log_info(`Establishing new SSE stream for session ${sessionId}`);
        }

        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
    };

    // Set up GET route with conditional auth middleware
    if (useOAuth && authMiddleware) {
        app.get('/mcp', authMiddleware, mcpGetHandler);
    } else {
        app.get('/mcp', mcpGetHandler);
    }

    // Handle DELETE requests for session termination (according to MCP spec)
    const mcpDeleteHandler = async (req: Request, res: Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }

        log_info(`Received session termination request for session ${sessionId}`);

        try {
            const transport = transports[sessionId];
            await transport.handleRequest(req, res);
        } catch (error) {
            log_error('Error handling session termination:', error);
            if (!res.headersSent) {
                res.status(500).send('Error processing session termination');
            }
        }
    };

    // Set up DELETE route with conditional auth middleware
    if (useOAuth && authMiddleware) {
        app.delete('/mcp', authMiddleware, mcpDeleteHandler);
    } else {
        app.delete('/mcp', mcpDeleteHandler);
    }
}

export function mcpServerStart(mcp_port: number) {

    const MCP_PORT = mcp_port;

    GlobalEvent.log_info('Start mcp server.');

    if (!app) {
        throw new Error('mcp server is not inited.');
    }

    app.listen(MCP_PORT, error => {
        if (error) {
            log_error('Failed to start server:', error);
        } else {
            log_info(`MCP Streamable HTTP Server listening on port ${MCP_PORT}`);
        }
    });

    // Handle server shutdown
    process.on('SIGINT', () => mcpServerStop());
}

export async function mcpServerStop() {
    log_info('Shutting down server...');
    // Close all active transports to properly clean up resources
    for (const sessionId in transports) {
        try {
            log_info(`Closing transport for session ${sessionId}`);
            await transports[sessionId].close();
            delete transports[sessionId];
        } catch (error) {
            log_error(`Error closing transport for session ${sessionId}:`, error);
        }
    }
    log_info('Server shutdown complete');
}
