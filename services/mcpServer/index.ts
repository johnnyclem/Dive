import { ToolDefinition } from "@langchain/core/language_models/base";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import path from "path";
import { handleConnectToServer } from "../connectServer.js";
import logger from "../utils/logger.js";
import { convertToOpenAITools, loadConfigAndServers } from "../utils/toolHandler.js";
import { iConfig, iServerConfig, iTool } from "../utils/types.js";
import { IMCPServerManager } from "./interface.js";
import { ipcMain } from "electron";
import fs from "fs/promises";

// Add the new import for accessing knowledge base API
import * as KnowledgeStore from "../../electron/main/knowledge-store.js";

export class MCPServerManager implements IMCPServerManager {
  private static instance: MCPServerManager;
  private servers: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport | SSEClientTransport | WebSocketClientTransport> = new Map();
  private toolToServerMap: Map<string, Client> = new Map();
  private availableTools: ToolDefinition[] = [];
  private toolInfos: iTool[] = [];
  // SSE/Websocket 開起來的Client
  private tempClients: Map<string, Client> = new Map();
  private prevConfig: Record<string, iServerConfig> = {};
  public configPath: string;

  private constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), "config.json");
    
    // Set up event listeners for knowledge base changes
    this.setupEventListeners();
  }

  public static getInstance(configPath?: string): MCPServerManager {
    if (!MCPServerManager.instance) {
      MCPServerManager.instance = new MCPServerManager(configPath);
    } else if (configPath && configPath !== MCPServerManager.instance.configPath) {
      // If a new config path is provided and different from current, update config and reinitialize
      MCPServerManager.instance.configPath = configPath;
      MCPServerManager.instance.initialize().catch((error) => {
        logger.error("Failed to reinitialize MCPServerManager:", error);
      });
    }
    return MCPServerManager.instance;
  }

  async initialize(): Promise<void> {
    // Clear all states
    this.servers.clear();
    this.transports.clear();
    this.toolToServerMap.clear();
    this.availableTools = [];
    this.toolInfos = [];
    this.tempClients.clear();

    // Add web search with knowledge base tool
    this.addWebSearchWithKnowledgeBase();

    // Load and connect all servers
    await this.connectAllServers();
    
    // Add dedicated knowledge search tool if active KB exists
    await this.addKnowledgeSearchTool();
    
    // Ensure our wrapper is the only web_search tool available
    this.ensureUniqueWebSearchTool();
  }

  // Add a new method to register the modified web search tool
  private addWebSearchWithKnowledgeBase() {
    // Define the web search with knowledge base tool
    const webSearchWithKB: ToolDefinition = {
      type: "function",
      function: {
        name: "web_search",
        description: "Search the web for information, or use the active knowledge base if one exists",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            }
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    };

    // Add it to available tools
    this.availableTools.push(webSearchWithKB);

    // Add tool info
    this.toolInfos.push({
      name: "webSearchWithKB",
      description: "Web search with knowledge base integration",
      tools: [{
        name: "web_search",
        description: "Search the web or knowledge base",
      }],
      enabled: true,
      icon: "",
    });

    // Register the tool handler
    const fakeClient = {
      async callTool(args: any) {
        try {
          // Extract query robustly from args
          let query: string | undefined;
          const rawArgs = args.arguments;
          if (rawArgs && typeof rawArgs === 'object' && 'query' in rawArgs) {
            query = rawArgs.query;
          } else if (typeof rawArgs === 'string') {
            // Handle concatenated JSON strings
            const matches = rawArgs.match(/{[^}]+}/g);
            if (matches && matches.length > 0) {
              try {
                const parsed = JSON.parse(matches[0]);
                query = parsed.query;
              } catch {}
            }
          } else if ('query' in args) {
            query = args.query;
          }
          const searchQuery = query || '';
          logger.info(`*** WEB SEARCH WRAPPER CALLED: "${searchQuery}" ***`);
          
          // Check if there's an active knowledge base
          const activeKBId = KnowledgeStore.getActiveKnowledgeBase();
          
          // If active knowledge base exists, perform RAG lookup
          if (activeKBId) {
            logger.info(`Web search wrapper: Using active knowledge base for query: ${searchQuery}`);
            
            // Use our improved semantic search function
            const searchResults = KnowledgeStore.searchKnowledgeBase(searchQuery, activeKBId, 3);
            
            // Check if there are search results
            if (searchResults && searchResults.length > 0) {
              // Format the results for display
              const formattedResults = searchResults.map(result => ({
                id: result.document.id,
                content: result.document.content,
                name: result.document.name,
                source: `Knowledge Base: ${result.document.name}`,
                relevance: `Score: ${result.score}`,
                snippet: result.document.content.substring(0, 200) + "..."
              }));
              
              logger.info(`Web search wrapper: Found ${formattedResults.length} results in knowledge base`);
              return {
                results: formattedResults,
                source: "knowledge_base",
                knowledge_base_id: activeKBId
              };
            }
            
            logger.info(`Web search wrapper: No results found in knowledge base, falling back to web search`);
          }
          
          // Fall back to web search if no KB results or no active KB
          logger.info(`Web search wrapper: Using web search for: ${searchQuery}`);
          
          // Simply pass through to web search
          return {
            query: searchQuery,
            fallback_to_web: true
          };
        } catch (error) {
          logger.error(`Error in webSearchWithKB tool: ${error}`);
          throw error;
        }
      }
    };
    
    // Register the tool
    this.toolToServerMap.set("web_search", fakeClient as unknown as Client);
    logger.info("Added web search wrapper that prioritizes knowledge base results");
  }

  // 連接所有 MCP 伺服器，不檢查是否已經開啟，執行前請確保 mcpServers 都已關閉
  async connectAllServers(): Promise<{ serverName: string; error: unknown }[]> {
    const errorArray: { serverName: string; error: unknown }[] = [];
    const { config, servers } = await loadConfigAndServers(this.configPath);
    this.prevConfig = config.mcpServers;
    // only connect enabled servers
    const enabledServers = Object.keys(config.mcpServers).filter((serverName) => config.mcpServers[serverName].enabled);
    logger.info(`Connect to ${enabledServers.length} enabled servers...`);

    const allEnabledSpecificEnv = enabledServers.reduce((acc, serverName) => {
      return { ...acc, ...config.mcpServers[serverName].env };
    }, {});

    // async connect all servers
    const connectionResults = await Promise.allSettled(
      enabledServers.map((serverName) =>
        this.connectSingleServer(serverName, config.mcpServers[serverName], allEnabledSpecificEnv)
      )
    );

    // collect error
    connectionResults.forEach((result) => {
      if (result.status === "rejected") {
        errorArray.push({
          serverName: "unknown",
          error: result.reason,
        });
      } else if (!result.value.success) {
        errorArray.push({
          serverName: result.value.serverName,
          error: result.value.error,
        });
      }
    });

    logger.info("Connect all MCP servers completed");
    logger.info("All available tools:");
    for (const [serverName, client] of this.servers) {
      const toolInfo = this.toolInfos.find((info) => info.name === serverName);
      if (toolInfo?.enabled) {
        logger.info(`${serverName}:`);
        toolInfo.tools.forEach((tool) => {
          logger.info(`  - ${tool.name}`);
        });
      }
    }

    return errorArray;
  }

  async connectSingleServer(
    serverName: string,
    config: iServerConfig,
    allSpecificEnv: any
  ): Promise<{ success: boolean; serverName: string; error?: unknown }> {
    try {
      const updatedConfig = { ...config };
      if (!updatedConfig.transport) {
        updatedConfig.transport = "command";
        logger.debug(`No transport specified for server ${serverName}, defaulting to "command" transport`);
      }

      const { client, transport, tempClient } = await handleConnectToServer(serverName, updatedConfig, allSpecificEnv);
      this.servers.set(serverName, client);
      this.transports.set(serverName, transport);
      tempClient && this.tempClients.set(serverName, tempClient)

      // Load server tools and capabilities
      const response = await client.listTools();
      const capabilities = await client.getServerCapabilities();

      // Create tool information
      const tools_ = response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      }));

      // Update toolInfos
      this.toolInfos.push({
        name: serverName,
        description: (capabilities?.description as string) || "",
        tools: tools_,
        enabled: config.enabled || false,
        icon: (capabilities?.icon as string) || "",
      });

      // Load tools if server is enabled
      if (config.enabled) {
        const langChainTools = convertToOpenAITools(response.tools);
        this.availableTools.push(...langChainTools);

        // Record tool to server mapping
        response.tools.forEach((tool) => {
          this.toolToServerMap.set(tool.name, client);
        });
      }

      logger.info(`Add new server completed: ${serverName}`);

      return {
        success: true,
        serverName,
      };
    } catch (error: any) {
      return {
        success: false,
        serverName,
        error: error.message,
      };
    }
  }

  async syncServersWithConfigForce(): Promise<{ serverName: string; error: unknown }[]> {
    logger.info("Syncing servers with configuration...");
    let errorArray: { serverName: string; error: unknown }[] = [];
    await this.disconnectAllServers();
    errorArray = await this.connectAllServers();
    return errorArray;
  }

  async syncServersWithConfig(): Promise<{ serverName: string; error: unknown }[]> {
    logger.info("Syncing servers with configuration...");
    const errorArray: { serverName: string; error: unknown }[] = [];
    let newConfig: iConfig | undefined;

    try {
      // Get configuration differences
      const { config: newConfig_ } = await loadConfigAndServers(this.configPath);
      newConfig = newConfig_;
      const currentRunningServers = new Set(this.servers.keys());
      const configuredServers = new Set(Object.keys(newConfig.mcpServers || {}));

      // Handle servers to be removed
      for (const serverName of currentRunningServers) {
        // 設定中沒有此 server 或 有此 server 但設定中 disabled
        if (!configuredServers.has(serverName) || !newConfig.mcpServers[serverName].enabled) {
          logger.info(`Removing server: ${serverName}`);
          await this.disconnectSingleServer(serverName);
        }
      }

      // Handle new or updated servers
      for (const serverName of configuredServers) {
        try {
          const serverConfig = newConfig.mcpServers[serverName];
          // 設定中 disabled 則不處理
          if (!serverConfig.enabled) continue;

          if (!serverConfig.transport) serverConfig.transport = "command";

          // 該 Server 還沒有執行
          if (!currentRunningServers.has(serverName)) {
            // New server
            logger.info(`Adding new server: ${serverName}`);
            const result = await this.connectSingleServer(serverName, serverConfig, {});
            if (!result.success) {
              errorArray.push({
                serverName,
                error: result.error,
              });
            }
          } else {
            // 該 Server 已經執行，確認設定是否變更
            // check command, args(string[]), env(Record<string, string>)
            const isPropertiesChanged = this.checkPropertiesChanged(serverName, serverConfig);
            if (isPropertiesChanged) {
              logger.info(`Properties changed and Restart server: ${serverName}`);
              await this.disconnectSingleServer(serverName);
              const result = await this.connectSingleServer(serverName, serverConfig, {});
              if (!result.success) {
                errorArray.push({
                  serverName,
                  error: result.error,
                });
              }
            } else {
              // check enabled
              const isCurrentlyEnabled = this.toolInfos.find((info) => info.name === serverName)?.enabled;
              if (serverConfig.enabled && !isCurrentlyEnabled) {
                logger.info(`Enabling server: ${serverName}`);
                await this.updateServerEnabledState(serverName, true);
              } else if (!serverConfig.enabled && isCurrentlyEnabled) {
                logger.info(`Disabling server: ${serverName}`);
                await this.updateServerEnabledState(serverName, false);
              }
            }
          }
        } catch (error) {
          logger.error(`Error during server configuration sync: ${error}`);
          errorArray.push({
            serverName,
            error: error,
          });
        }
      }

      logger.info("Server configuration sync completed");
      return errorArray;
    } catch (error) {
      logger.error("Error during server configuration sync:", error);
      throw error;
    } finally {
      if (newConfig) {
        this.prevConfig = newConfig.mcpServers;
      }
    }
  }

  async disconnectSingleServer(serverName: string): Promise<void> {
    try {
      const client = this.servers.get(serverName);
      if (client) {
        // Get tools list before disconnecting
        try {
          const response = await client.listTools();
          const toolsToRemove = new Set(response.tools.map((tool) => tool.name));

          // Remove tools from availableTools
          this.availableTools = this.availableTools.filter((tool) => !toolsToRemove.has(tool.function.name));

          // Clean up tool to server mapping
          toolsToRemove.forEach((toolName) => {
            this.toolToServerMap.delete(toolName);
          });
        } catch (error) {
          logger.error(`Error getting tools list for server ${serverName}:`, error);
        }

        // Close transport and clean up server
        const transport = this.transports.get(serverName);
        if (transport) {
          await transport.close();
        }
        const tempClient = this.tempClients.get(serverName)
        if (tempClient){
          await tempClient.close()
        }
        this.transports.delete(serverName);
        this.servers.delete(serverName);

        // Remove from toolInfos
        this.toolInfos = this.toolInfos.filter((info) => info.name !== serverName);

        logger.info(`Remove server completed: ${serverName}`);
      }
    } catch (error) {
      logger.error(`Error disconnecting server ${serverName}:`, error);
    }
  }

  async updateServerEnabledState(serverName: string, enabled: boolean): Promise<void> {
    // Update enabled status in tool info
    const toolInfo = this.toolInfos.find((info) => info.name === serverName);
    if (!toolInfo) {
      logger.warn(`Cannot update state for server ${serverName}: tool info not found`);
      return;
    }
    toolInfo.enabled = enabled;

    // Get all tool names for this server
    const serverTools = new Set(toolInfo.tools.map((tool) => tool.name));

    // Update availableTools
    if (enabled) {
      // If enabling, add server's tools to availableTools
      const client = this.servers.get(serverName);
      if (client) {
        const response = await client.listTools();
        const langChainTools = convertToOpenAITools(response.tools);
        this.availableTools.push(...langChainTools);
      }
    } else {
      // If disabling, remove server's tools from availableTools
      this.availableTools = this.availableTools.filter((tool) => !serverTools.has(tool.function.name));
    }
  }

  checkPropertiesChanged(serverName: string, config: iServerConfig) {
    const currentParams = this.prevConfig[serverName] as iServerConfig;

    if (!currentParams || !config) return true;
    if (JSON.stringify(currentParams) !== JSON.stringify(config)) return true;
    else return false;
  }

  // Update the getAvailableTools method to be async and properly filter tools
  public async getAvailableTools(): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];
    
    // Get tools from all connected and enabled servers
    for (const [serverName, server] of this.servers.entries()) {
      if (server.isConnected() && server.isEnabled()) {
        const serverTools = this.pendingToolCache.get(serverName) || [];
        tools.push(...serverTools);
      }
    }

    // Filter out disabled sub-tools
    try {
      const config = await this.loadSubToolConfig();
      const disabledSubTools = config.disabledSubTools || [];
      
      if (disabledSubTools.length === 0) {
        return tools; // No filtering needed
      }
      
      return tools.filter(tool => {
        // Skip if no function name (shouldn't happen)
        if (!tool.function?.name) return true;
        
        // Extract server name and function name
        const parts = tool.function.name.split('.');
        if (parts.length !== 2) return true;
        
        const [toolName, subToolName] = parts;
        
        // Check if this specific sub-tool is disabled
        const isDisabled = disabledSubTools.some(
          item => item.toolName === toolName && item.subToolName === subToolName
        );
        
        return !isDisabled;
      });
    } catch (error) {
      logger.error(`Error filtering disabled sub-tools: ${error}`);
      return tools; // Return unfiltered tools on error
    }
  }

  getToolInfos(): iTool[] {
    return this.toolInfos;
  }

  getToolToServerMap(): Map<string, Client> {
    return this.toolToServerMap;
  }

  async disconnectAllServers(): Promise<void> {
    logger.info("Disconnect all MCP servers...");
    for (const serverName of this.servers.keys()) {
      const transport = this.transports.get(serverName);
      if (transport) {
        await transport.close();
      }
    }
    for (const serverName of this.tempClients.keys()){
      logger.debug(`[${serverName}] Disconnecting temp client`);
      const client = this.tempClients.get(serverName)
      if (client){
        await client.close()
      }
    }
    this.servers.clear();
    this.transports.clear();
    this.toolToServerMap.clear();
    this.availableTools = [];
    this.toolInfos = [];
    logger.info("Disconnect all MCP servers completed");
  }

  // async reconnectServers(): Promise<{ serverName: string; error: unknown }[]> {
  //   logger.info("Reconnect all MCP servers...");
  //   await this.disconnectAllServers();
  //   const errorArray = await this.connectAllServers();
  //   logger.info("Reconnect all MCP servers completed");
  //   return errorArray;
  // }

  // Ensure our wrapped web_search tool is the only one
  private ensureUniqueWebSearchTool(): void {
    // Get our wrapped web_search tool, which we added first
    const ourWebSearchTool = this.availableTools.find(
      tool => tool.function?.name === 'web_search' && 
      tool.function?.description?.includes('active knowledge base')
    );
    
    // Filter out any other web_search tools
    this.availableTools = this.availableTools.filter(
      tool => tool.function?.name !== 'web_search' || 
      tool === ourWebSearchTool
    );
    
    logger.info('Ensured our wrapped web_search tool is the only web_search tool available');
  }

  // Add a dedicated knowledge search tool if an active knowledge base exists
  private async addKnowledgeSearchTool(): Promise<void> {
    // Check if there's an active knowledge base
    const activeKBId = KnowledgeStore.getActiveKnowledgeBase();
    
    if (!activeKBId) {
      logger.info('No active knowledge base, skipping dedicated knowledge_search tool');
      return;
    }
    
    // Get the knowledge base info for the description
    const kb = KnowledgeStore.getCollection(activeKBId);
    if (!kb) {
      logger.warn(`Active knowledge base ${activeKBId} not found, skipping dedicated knowledge_search tool`);
      return;
    }
    
    // Define the dedicated knowledge search tool
    const knowledgeSearchTool: ToolDefinition = {
      type: "function",
      function: {
        name: "knowledge_search",
        description: `Search the active knowledge base "${kb.name}" for information before using any other tool`,
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for the knowledge base",
            }
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    };
    
    // Add tool to available tools at the BEGINNING of the array to prioritize it
    this.availableTools.unshift(knowledgeSearchTool);
    
    // Add tool info
    this.toolInfos.push({
      name: "knowledgeSearch",
      description: `Knowledge base search for "${kb.name}"`,
      tools: [{
        name: "knowledge_search",
        description: `Search the active knowledge base "${kb.name}"`,
      }],
      enabled: true,
      icon: "",
    });
    
    // Register the tool handler
    const knowledgeSearchClient = {
      async callTool(args: {arguments: {query: string}}) {
        try {
          const query = args.arguments.query;
          
          logger.info(`Using dedicated knowledge_search for query: ${query}`);
          
          // Use our semantic search function
          const searchResults = KnowledgeStore.searchKnowledgeBase(query, activeKBId, 5);
          
          // Check if there are search results
          if (searchResults && searchResults.length > 0) {
            // Format the results for display
            const formattedResults = searchResults.map(result => ({
              id: result.document.id,
              content: result.document.content,
              name: result.document.name,
              source: `Knowledge Base: ${result.document.name}`,
              relevance: `Score: ${result.score}`,
              snippet: result.document.content.substring(0, 200) + "..."
            }));
            
            logger.info(`Found ${formattedResults.length} results in knowledge base through knowledge_search tool`);
            return {
              results: formattedResults,
              source: "knowledge_base",
              knowledge_base_id: activeKBId
            };
          }
          
          // If no results, tell the user we didn't find anything
          logger.info(`No results found in knowledge base for query: ${query}`);
          return {
            results: [],
            source: "knowledge_base",
            knowledge_base_id: activeKBId,
            message: `No relevant information found in knowledge base "${kb.name}" for query: "${query}"`
          };
        } catch (error) {
          logger.error(`Error in knowledge_search tool: ${error}`);
          throw error;
        }
      }
    };
    
    // Register the tool
    this.toolToServerMap.set("knowledge_search", knowledgeSearchClient as unknown as Client);
    
    logger.info(`Added dedicated knowledge_search tool for active knowledge base: ${kb.name}`);
  }

  // Set up event listeners
  private setupEventListeners(): void {
    // Listen for knowledge base activation/deactivation
    ipcMain.on('model:reconfigure-tools', async (_event, data) => {
      if (data.reason === 'knowledge_base_change') {
        logger.info(`Reconfiguring tools due to knowledge base change: ${data.activeKnowledgeBaseId}`);
        await this.reconfigureKnowledgeTools();
      }
    });
    
    // Also listen for direct knowledge base changes
    ipcMain.on('knowledge:active-changed', async (_event, data) => {
      logger.info(`Knowledge base active state changed: ${data.id}`);
      await this.reconfigureKnowledgeTools();
    });
  }
  
  // Reconfigure knowledge tools based on active knowledge base
  public async reconfigureKnowledgeTools(): Promise<void> {
    logger.info('Reconfiguring knowledge tools...');
    
    // Remove any existing knowledge_search tool
    this.availableTools = this.availableTools.filter(
      tool => tool.function?.name !== 'knowledge_search'
    );
    
    // Remove from tool map
    this.toolToServerMap.delete('knowledge_search');
    
    // Remove from tool infos
    this.toolInfos = this.toolInfos.filter(
      info => info.name !== 'knowledgeSearch'
    );
    
    // Add knowledge search tool if there's an active KB
    await this.addKnowledgeSearchTool();
    
    // Ensure web search wrapper is the only web_search tool
    this.ensureUniqueWebSearchTool();
    
    logger.info('Knowledge tools reconfigured successfully');
  }

  // Add function to load sub-tool config
  private async loadSubToolConfig() {
    try {
      const configDir = process.env.CONFIG_DIR || path.join(process.cwd(), 'config');
      const configPath = path.join(configDir, 'subtool-config.json');
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      
      if (configExists) {
        const configData = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(configData);
      } else {
        return { disabledSubTools: [] };
      }
    } catch (error) {
      logger.error(`Error loading sub-tool config: ${error}`);
      return { disabledSubTools: [] };
    }
  }
}