import express from "express";
import { MCPServerManager } from "../mcpServer/index.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ServerError extends Error {
  message: string;
}

interface SubToolConfig {
  toolName: string;
  subToolName: string;
  enabled: boolean;
}

// Path to store sub-tool configurations
const getSubToolConfigPath = () => {
  const configDir = process.env.CONFIG_DIR || path.join(process.cwd(), 'config');
  return path.join(configDir, 'subtool-config.json');
};

// Load existing sub-tool configurations or create empty one
async function loadSubToolConfig() {
  try {
    const configPath = getSubToolConfigPath();
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

// Save sub-tool configuration
async function saveSubToolConfig(config) {
  try {
    const configPath = getSubToolConfigPath();
    const configDir = path.dirname(configPath);
    
    // Ensure directory exists
    await fs.mkdir(configDir, { recursive: true });
    
    // Save config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    logger.error(`Error saving sub-tool config: ${error}`);
    return false;
  }
}

export function toolsRouter() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const tools = MCPServerManager.getInstance().getToolInfos();
      
      // Apply disabled sub-tool configuration
      const subToolConfig = await loadSubToolConfig();
      const disabledSubTools = subToolConfig.disabledSubTools || [];
      
      // Mark disabled sub-tools
      const toolsWithConfig = tools.map(tool => {
        if (tool.tools && tool.tools.length > 0) {
          return {
            ...tool,
            tools: tool.tools.map(subTool => {
              const isDisabled = disabledSubTools.some(
                item => item.toolName === tool.name && item.subToolName === subTool.name
              );
              return {
                ...subTool,
                enabled: !isDisabled
              };
            })
          };
        }
        return tool;
      });
      
      res.json({
        success: true,
        tools: toolsWithConfig,
      });
    } catch (error) {
      const serverError = error as ServerError;
      res.json({
        success: false,
        message: serverError.message,
      });
    }
  });

  router.post("/config", async (req, res) => {
    try {
      const { toolName, subToolName, enabled } = req.body as SubToolConfig;
      
      if (!toolName || !subToolName || typeof enabled !== 'boolean') {
        res.status(400).json({
          success: false,
          message: "Invalid request. Required: toolName, subToolName, enabled",
        });
        return;
      }
      
      // Load existing config
      const config = await loadSubToolConfig();
      const disabledSubTools = config.disabledSubTools || [];
      
      // Update config based on enabled flag
      if (!enabled) {
        // Add to disabled list if not already there
        const alreadyDisabled = disabledSubTools.some(
          item => item.toolName === toolName && item.subToolName === subToolName
        );
        
        if (!alreadyDisabled) {
          disabledSubTools.push({ toolName, subToolName });
        }
      } else {
        // Remove from disabled list
        config.disabledSubTools = disabledSubTools.filter(
          item => !(item.toolName === toolName && item.subToolName === subToolName)
        );
      }
      
      // Save updated config
      const saveResult = await saveSubToolConfig(config);
      
      if (saveResult) {
        res.json({
          success: true,
          message: `Sub-tool ${subToolName} for ${toolName} ${enabled ? 'enabled' : 'disabled'} successfully`,
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to save sub-tool configuration",
        });
      }
    } catch (error) {
      const serverError = error as ServerError;
      res.status(500).json({
        success: false,
        message: serverError.message,
      });
    }
  });

  router.post("/restore", async (req, res) => {
    try {
      // Read default servers configuration (source JSON under services/routes)
      const repoRoot = path.join(__dirname, '..', '..')
      const defaultConfigPath = path.join(repoRoot, 'services', 'routes', 'default-servers.json')
      const defaultConfig = JSON.parse(await fs.readFile(defaultConfigPath, 'utf-8'));

      // Update config file
      await fs.writeFile(MCPServerManager.getInstance().configPath, JSON.stringify(defaultConfig, null, 2));

      // Sync servers with new config
      const manager = MCPServerManager.getInstance();
      const errors = await manager.syncServersWithConfig();

      // Handle any sync errors
      if (errors.length > 0) {
        res.json({
          success: false,
          message: "Failed to sync some servers",
          errors: errors
        });
        return;
      }

      // Get updated tools
      const tools = manager.getToolInfos();

      res.json({
        success: true,
        tools: tools,
      });
    } catch (error) {
      const serverError = error as ServerError;
      res.json({
        success: false,
        message: serverError.message,
      });
    }
  });

  return router;
}
