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

// Check for OAuth flag
const useOAuth = false; // process.argv.includes('--oauth');
const strictOAuth = false; // process.argv.includes('--oauth-strict');

// Create shared task store for demonstration
const taskStore = new InMemoryTaskStore();

// Create an MCP server with implementation details
const getServer = () => {
    const server = new McpServer(
        {
            name: 'eide-streamable-http-server',
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

    // Register a simple tool that returns a greeting
    server.registerTool(
        'greet',
        {
            title: 'Greeting Tool', // Display name for UI
            description: 'A simple greeting tool',
            inputSchema: {
                name: z.string().describe('Name to greet')
            }
        },
        async ({ name }): Promise<CallToolResult> => {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Hello, ${name}!`
                    }
                ]
            };
        }
    );

    // Register a tool that sends multiple greetings with notifications (with annotations)
    server.registerTool(
        'multi-greet',
        {
            description: 'A tool that sends different greetings with delays between them',
            inputSchema: {
                name: z.string().describe('Name to greet')
            },
            annotations: {
                title: 'Multiple Greeting Tool',
                readOnlyHint: true,
                openWorldHint: false
            }
        },
        async ({ name }, extra): Promise<CallToolResult> => {
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            await server.sendLoggingMessage(
                {
                    level: 'debug',
                    data: `Starting multi-greet for ${name}`
                },
                extra.sessionId
            );

            await sleep(1000); // Wait 1 second before first greeting

            await server.sendLoggingMessage(
                {
                    level: 'info',
                    data: `Sending first greeting to ${name}`
                },
                extra.sessionId
            );

            await sleep(1000); // Wait another second before second greeting

            await server.sendLoggingMessage(
                {
                    level: 'info',
                    data: `Sending second greeting to ${name}`
                },
                extra.sessionId
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: `Good morning, ${name}!`
                    }
                ]
            };
        }
    );
    // Register a tool that demonstrates form elicitation (user input collection with a schema)
    // This creates a closure that captures the server instance
    server.registerTool(
        'collect-user-info',
        {
            description: 'A tool that collects user information through form elicitation',
            inputSchema: {
                infoType: z.enum(['contact', 'preferences', 'feedback']).describe('Type of information to collect')
            }
        },
        async ({ infoType }, extra): Promise<CallToolResult> => {
            let message: string;
            let requestedSchema: {
                type: 'object';
                properties: Record<string, PrimitiveSchemaDefinition>;
                required?: string[];
            };

            switch (infoType) {
                case 'contact':
                    message = 'Please provide your contact information';
                    requestedSchema = {
                        type: 'object',
                        properties: {
                            name: {
                                type: 'string',
                                title: 'Full Name',
                                description: 'Your full name'
                            },
                            email: {
                                type: 'string',
                                title: 'Email Address',
                                description: 'Your email address',
                                format: 'email'
                            },
                            phone: {
                                type: 'string',
                                title: 'Phone Number',
                                description: 'Your phone number (optional)'
                            }
                        },
                        required: ['name', 'email']
                    };
                    break;
                case 'preferences':
                    message = 'Please set your preferences';
                    requestedSchema = {
                        type: 'object',
                        properties: {
                            theme: {
                                type: 'string',
                                title: 'Theme',
                                description: 'Choose your preferred theme',
                                enum: ['light', 'dark', 'auto'],
                                enumNames: ['Light', 'Dark', 'Auto']
                            },
                            notifications: {
                                type: 'boolean',
                                title: 'Enable Notifications',
                                description: 'Would you like to receive notifications?',
                                default: true
                            },
                            frequency: {
                                type: 'string',
                                title: 'Notification Frequency',
                                description: 'How often would you like notifications?',
                                enum: ['daily', 'weekly', 'monthly'],
                                enumNames: ['Daily', 'Weekly', 'Monthly']
                            }
                        },
                        required: ['theme']
                    };
                    break;
                case 'feedback':
                    message = 'Please provide your feedback';
                    requestedSchema = {
                        type: 'object',
                        properties: {
                            rating: {
                                type: 'integer',
                                title: 'Rating',
                                description: 'Rate your experience (1-5)',
                                minimum: 1,
                                maximum: 5
                            },
                            comments: {
                                type: 'string',
                                title: 'Comments',
                                description: 'Additional comments (optional)',
                                maxLength: 500
                            },
                            recommend: {
                                type: 'boolean',
                                title: 'Would you recommend this?',
                                description: 'Would you recommend this to others?'
                            }
                        },
                        required: ['rating', 'recommend']
                    };
                    break;
                default:
                    throw new Error(`Unknown info type: ${infoType}`);
            }

            try {
                // Use sendRequest through the extra parameter to elicit input
                const result = await extra.sendRequest(
                    {
                        method: 'elicitation/create',
                        params: {
                            mode: 'form',
                            message,
                            requestedSchema
                        }
                    },
                    ElicitResultSchema
                );

                if (result.action === 'accept') {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Thank you! Collected ${infoType} information: ${JSON.stringify(result.content, null, 2)}`
                            }
                        ]
                    };
                } else if (result.action === 'decline') {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `No information was collected. User declined ${infoType} information request.`
                            }
                        ]
                    };
                } else {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Information collection was cancelled by the user.`
                            }
                        ]
                    };
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error collecting ${infoType} information: ${error}`
                        }
                    ]
                };
            }
        }
    );

    // Register a tool that demonstrates bidirectional task support:
    // Server creates a task, then elicits input from client using elicitInputStream
    // Using the experimental tasks API - WARNING: may change without notice
    server.experimental.tasks.registerToolTask(
        'collect-user-info-task',
        {
            title: 'Collect Info with Task',
            description: 'Collects user info via elicitation with task support using elicitInputStream',
            inputSchema: {
                infoType: z.enum(['contact', 'preferences']).describe('Type of information to collect').default('contact')
            }
        },
        {
            async createTask({ infoType }, { taskStore: createTaskStore, taskRequestedTtl }) {
                // Create the server-side task
                const task = await createTaskStore.createTask({
                    ttl: taskRequestedTtl
                });

                // Perform async work that makes a nested elicitation request using elicitInputStream
                (async () => {
                    try {
                        const message = infoType === 'contact' ? 'Please provide your contact information' : 'Please set your preferences';

                        // Define schemas with proper typing for PrimitiveSchemaDefinition
                        const contactSchema: {
                            type: 'object';
                            properties: Record<string, PrimitiveSchemaDefinition>;
                            required: string[];
                        } = {
                            type: 'object',
                            properties: {
                                name: { type: 'string', title: 'Full Name', description: 'Your full name' },
                                email: { type: 'string', title: 'Email', description: 'Your email address' }
                            },
                            required: ['name', 'email']
                        };

                        const preferencesSchema: {
                            type: 'object';
                            properties: Record<string, PrimitiveSchemaDefinition>;
                            required: string[];
                        } = {
                            type: 'object',
                            properties: {
                                theme: { type: 'string', title: 'Theme', enum: ['light', 'dark', 'auto'] },
                                notifications: { type: 'boolean', title: 'Enable Notifications', default: true }
                            },
                            required: ['theme']
                        };

                        const requestedSchema = infoType === 'contact' ? contactSchema : preferencesSchema;

                        // Use elicitInputStream to elicit input from client
                        // This demonstrates the streaming elicitation API
                        // Access via server.server to get the underlying Server instance
                        const stream = server.server.experimental.tasks.elicitInputStream({
                            mode: 'form',
                            message,
                            requestedSchema
                        });

                        let elicitResult: ElicitResult | undefined;
                        for await (const msg of stream) {
                            if (msg.type === 'result') {
                                elicitResult = msg.result as ElicitResult;
                            } else if (msg.type === 'error') {
                                throw msg.error;
                            }
                        }

                        if (!elicitResult) {
                            throw new Error('No result received from elicitation');
                        }

                        let resultText: string;
                        if (elicitResult.action === 'accept') {
                            resultText = `Collected ${infoType} info: ${JSON.stringify(elicitResult.content, null, 2)}`;
                        } else if (elicitResult.action === 'decline') {
                            resultText = `User declined to provide ${infoType} information`;
                        } else {
                            resultText = 'User cancelled the request';
                        }

                        await taskStore.storeTaskResult(task.taskId, 'completed', {
                            content: [{ type: 'text', text: resultText }]
                        });
                    } catch (error) {
                        log_error('Error in collect-user-info-task:', error);
                        await taskStore.storeTaskResult(task.taskId, 'failed', {
                            content: [{ type: 'text', text: `Error: ${error}` }],
                            isError: true
                        });
                    }
                })();

                return { task };
            },
            async getTask(_args, { taskId, taskStore: getTaskStore }) {
                return await getTaskStore.getTask(taskId);
            },
            async getTaskResult(_args, { taskId, taskStore: getResultTaskStore }) {
                const result = await getResultTaskStore.getTaskResult(taskId);
                return result as CallToolResult;
            }
        }
    );

    // Register a simple prompt with title
    server.registerPrompt(
        'greeting-template',
        {
            title: 'Greeting Template', // Display name for UI
            description: 'A simple greeting prompt template',
            argsSchema: {
                name: z.string().describe('Name to include in greeting')
            }
        },
        async ({ name }): Promise<GetPromptResult> => {
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Please greet ${name} in a friendly manner.`
                        }
                    }
                ]
            };
        }
    );

    // Register a tool specifically for testing resumability
    server.registerTool(
        'start-notification-stream',
        {
            description: 'Starts sending periodic notifications for testing resumability',
            inputSchema: {
                interval: z.number().describe('Interval in milliseconds between notifications').default(100),
                count: z.number().describe('Number of notifications to send (0 for 100)').default(50)
            }
        },
        async ({ interval, count }, extra): Promise<CallToolResult> => {
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            let counter = 0;

            while (count === 0 || counter < count) {
                counter++;
                try {
                    await server.sendLoggingMessage(
                        {
                            level: 'info',
                            data: `Periodic notification #${counter} at ${new Date().toISOString()}`
                        },
                        extra.sessionId
                    );
                } catch (error) {
                    log_error('Error sending notification:', error);
                }
                // Wait for the specified interval
                await sleep(interval);
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Started sending periodic notifications every ${interval}ms`
                    }
                ]
            };
        }
    );

    // Create a simple resource at a fixed URI
    server.registerResource(
        'greeting-resource',
        'https://example.com/greetings/default',
        {
            title: 'Default Greeting', // Display name for UI
            description: 'A simple greeting resource',
            mimeType: 'text/plain'
        },
        async (): Promise<ReadResourceResult> => {
            return {
                contents: [
                    {
                        uri: 'https://example.com/greetings/default',
                        text: 'Hello, world!'
                    }
                ]
            };
        }
    );

    // Create additional resources for ResourceLink demonstration
    server.registerResource(
        'example-file-1',
        'file:///example/file1.txt',
        {
            title: 'Example File 1',
            description: 'First example file for ResourceLink demonstration',
            mimeType: 'text/plain'
        },
        async (): Promise<ReadResourceResult> => {
            return {
                contents: [
                    {
                        uri: 'file:///example/file1.txt',
                        text: 'This is the content of file 1'
                    }
                ]
            };
        }
    );

    server.registerResource(
        'example-file-2',
        'file:///example/file2.txt',
        {
            title: 'Example File 2',
            description: 'Second example file for ResourceLink demonstration',
            mimeType: 'text/plain'
        },
        async (): Promise<ReadResourceResult> => {
            return {
                contents: [
                    {
                        uri: 'file:///example/file2.txt',
                        text: 'This is the content of file 2'
                    }
                ]
            };
        }
    );

    // Register a tool that returns ResourceLinks
    server.registerTool(
        'list-files',
        {
            title: 'List Files with ResourceLinks',
            description: 'Returns a list of files as ResourceLinks without embedding their content',
            inputSchema: {
                includeDescriptions: z.boolean().optional().describe('Whether to include descriptions in the resource links')
            }
        },
        async ({ includeDescriptions = true }): Promise<CallToolResult> => {
            const resourceLinks: ResourceLink[] = [
                {
                    type: 'resource_link',
                    uri: 'https://example.com/greetings/default',
                    name: 'Default Greeting',
                    mimeType: 'text/plain',
                    ...(includeDescriptions && { description: 'A simple greeting resource' })
                },
                {
                    type: 'resource_link',
                    uri: 'file:///example/file1.txt',
                    name: 'Example File 1',
                    mimeType: 'text/plain',
                    ...(includeDescriptions && { description: 'First example file for ResourceLink demonstration' })
                },
                {
                    type: 'resource_link',
                    uri: 'file:///example/file2.txt',
                    name: 'Example File 2',
                    mimeType: 'text/plain',
                    ...(includeDescriptions && { description: 'Second example file for ResourceLink demonstration' })
                }
            ];

            return {
                content: [
                    {
                        type: 'text',
                        text: 'Here are the available files as resource links:'
                    },
                    ...resourceLinks,
                    {
                        type: 'text',
                        text: '\nYou can read any of these resources using their URI.'
                    }
                ]
            };
        }
    );

    // Register a long-running tool that demonstrates task execution
    // Using the experimental tasks API - WARNING: may change without notice
    server.experimental.tasks.registerToolTask(
        'delay',
        {
            title: 'Delay',
            description: 'A simple tool that delays for a specified duration, useful for testing task execution',
            inputSchema: {
                duration: z.number().describe('Duration in milliseconds').default(5000)
            }
        },
        {
            async createTask({ duration }, { taskStore, taskRequestedTtl }) {
                // Create the task
                const task = await taskStore.createTask({
                    ttl: taskRequestedTtl
                });

                // Simulate out-of-band work
                (async () => {
                    await new Promise(resolve => setTimeout(resolve, duration));
                    await taskStore.storeTaskResult(task.taskId, 'completed', {
                        content: [
                            {
                                type: 'text',
                                text: `Completed ${duration}ms delay`
                            }
                        ]
                    });
                })();

                // Return CreateTaskResult with the created task
                return {
                    task
                };
            },
            async getTask(_args, { taskId, taskStore }) {
                return await taskStore.getTask(taskId);
            },
            async getTaskResult(_args, { taskId, taskStore }) {
                const result = await taskStore.getTaskResult(taskId);
                return result as CallToolResult;
            }
        }
    );

    return server;
};


function log_info(msg: string) {
    //TODO
}

function log_error(msg: string, err?: Error) {
    //TODO
}
