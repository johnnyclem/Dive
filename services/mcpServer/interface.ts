import { ToolDefinition } from "@langchain/core/language_models/base";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { iServerConfig, iTool } from "../utils/types.js";

export interface ServerConfig {
  enabled: boolean;
  command: string;
  cwd?: string;
  args?: string[];
}

export interface IMCPServerManager {
  // Initialization
  initialize(): Promise<void>;

  // Server connection management
  connectAllServers(): Promise<{ serverName: string; error: unknown }[]>;
  connectSingleServer(
    serverName: string,
    config: iServerConfig,
    allSpecificEnv: any,
  ): Promise<{ success: boolean; serverName: string; error?: unknown }>;
  syncServersWithConfig(): Promise<{ serverName: string; error: unknown }[]>;

  // Tool management
  getAvailableTools(): ToolDefinition[];
  getToolToServerMap(): Map<string, Client>;
  getToolInfos(): iTool[];

  // Disconnect and clean up resources
  disconnectAllServers(): Promise<void>;
}
