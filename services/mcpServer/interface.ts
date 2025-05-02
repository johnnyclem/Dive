import { ToolDefinition } from "@langchain/core/language_models/base";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { iServerConfig, iTool } from "../utils/types.js";
import { ITool, ITransport } from "./transport/index.js";

export interface IMCPServerManager {
  // Initialization
  initialize(): Promise<void>;

  // Server connection management
  connectAllServers(): Promise<{ serverName: string; error: unknown }[]>;
  connectSingleServer(
    serverName: string,
    config: iServerConfig,
    allSpecificEnv: any
  ): Promise<{ success: boolean; serverName: string; error?: unknown }>;
  syncServersWithConfig(): Promise<{ serverName: string; error: unknown }[]>;

  // Tool management
  getAvailableTools(): Promise<ToolDefinition[]>;
  getToolToServerMap(): Map<string, Client>;
  getToolInfos(): iTool[];

  // Disconnect and clean up resources
  disconnectAllServers(): Promise<void>;

  addServer(
    name: string,
    command: string,
    args: string[],
    generateTools: boolean,
    id?: string
  ): Promise<string>;
  addSSEServer(name: string, url: string, generateTools: boolean, id?: string): Promise<string>;
  getServer(id: string): ITool | null;
  removeServer(id: string): Promise<boolean>;
  connectServer(id: string): Promise<ITool>;
  disconnectServer(id: string): Promise<boolean>;
}

export interface ServerConfig {
  transport: "command" | "sse" | "websocket";
  enabled?: boolean;
  command?: string;
  cwd?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface ServerOptions {
  command?: string;
  args?: string[];
  url?: string;
  transport?: string;
  enabled?: boolean;
}
