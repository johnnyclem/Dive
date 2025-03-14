#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
const ECHO_TOOL = {
    name: "echo",
    description: "A simple echo tool to verify if the MCP server is working properly. It returns a characteristic response containing the input message.",
    inputSchema: {
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "Message to be echoed back",
            },
        },
        required: ["message"],
    },
};
// Server implementation
const server = new Server({
    name: "biggo-mcp-server/echo",
    version: "0.1.0",
}, {
    capabilities: {
        description: "A basic MCP echo server for system operation verification",
        tools: {},
    },
});
function isEchoArgs(args) {
    return (typeof args === "object" &&
        args !== null &&
        "message" in args &&
        typeof args.message === "string");
}
// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [ECHO_TOOL],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;
        if (!args) {
            throw new Error("No parameters provided");
        }
        if (name === "echo") {
            if (!isEchoArgs(args)) {
                throw new Error("Invalid echo tool parameters");
            }
            const { message } = args;
            const response = `[MCP-ECHO] Received message: ${message}`;
            return {
                content: [{ type: "text", text: response }],
                isError: false,
            };
        }
        return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
});
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP Echo Server is running");
}
runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});