import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { randomUUID } from "crypto";
import express from "express";
import { initChatModel } from "langchain/chat_models/universal";
import { ModelManager } from "../models/index.js";
import axios, { AxiosResponse } from "axios";
import { abortControllerMap, handleProcessQuery } from "../processQuery.js";
import { PromptManager } from "../prompt/index.js";
import logger from "../utils/logger.js";
import { MCPServerManager } from "../mcpServer/index.js";

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  system_fingerprint: string;
  choices: Array<{
    index: number;
    message?: {
      role: string;
      content: string;
      refusal: null;
    };
    delta?: {
      role?: string;
      content?: string;
    };
    logprobs: null;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export function compatibleRouter() {
  const router = express.Router();
  const modelManager = ModelManager.getInstance();
  const promptManager = PromptManager.getInstance();
  const serverManager = MCPServerManager.getInstance();

  router.get("/", (req, res) => {
    res.json({
      success: true,
      message: "Welcome to Souls Compatible API! 🚀",
    });
  });

  router.get("/models", async (_req, res) => {
    try {
      // Load configuration from file
      const config = await ModelManager.getInstance().getModelConfig();
      if (!config) throw new Error("Model configuration not found");
      const provider = config.activeProvider;
      const settings = (config as any).configs?.[provider];
      if (!settings) throw new Error(`No settings for provider ${provider}`);
      let list: string[] = [];
      switch (provider) {
        case 'openai':
        case 'openai_compatible': {
          const url = 'https://api.openai.com/v1/models';
          const resp: AxiosResponse<{ data: Array<{ id: string }> }> = await axios.get(url, {
            headers: { Authorization: `Bearer ${settings.apiKey}` }
          });
          list = resp.data.data.map(m => m.id);
          break;
        }
        case 'anthropic': {
          const url = `${settings.baseURL.replace(/\/+$/, '')}/v1/models`;
          const resp: AxiosResponse<{ models: Array<{ id: string }> }> = await axios.get(url, {
            headers: { 'x-api-key': settings.apiKey }
          });
          list = resp.data.models.map(m => m.id);
          break;
        }
        case 'ollama': {
          const url = `${settings.baseURL.replace(/\/+$/, '')}/models`;
          const resp: AxiosResponse<any> = await axios.get(url);
          const data = resp.data;
          list = Array.isArray(data)
            ? data.map((m: any) => (typeof m === 'string' ? m : m.id))
            : (data.models || []).map((m: any) => m.id);
          break;
        }
        case 'google_genai': {
          const url = `https://generativelanguage.googleapis.com/v1/models?key=${settings.apiKey}`;
          const resp: AxiosResponse<{ models: Array<{ name: string }> }> = await axios.get(url);
          list = resp.data.models.map(m => m.name);
          break;
        }
        default:
          // unsupported providers: mistralai, bedrock
          throw new Error(`Model listing not supported for provider ${provider}`);
      }
      res.json({ success: true, data: list });
    } catch (error: any) {
      logger.error(`Failed to list models: ${error.message}`);
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // compatible chat
  //@ts-ignore
  router.post("/chat/completions", async (req, res) => {
    try {
      const { messages, stream, tool_choice } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          message: "Parameter 'messages' must be an array",
        });
      }

      if (typeof stream !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Parameter 'stream' must be a boolean",
        });
      }
      if (tool_choice !== "auto" && tool_choice !== "none") {
        return res.status(400).json({
          success: false,
          message: "Parameter 'tool_choice' must be 'auto' or 'none'",
        });
      }

      const isValidMessage = messages.every(
        (msg) => msg.role && typeof msg.role === "string" && msg.content && typeof msg.content === "string"
      );

      if (!isValidMessage) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid message format. Each message must have 'role' and 'content' fields as string. Image URLs and other non-text content are not supported now.",
        });
      }

      // check model settings
      const modelSettings = modelManager.currentModelSettings;
      if (!modelSettings) {
        return res.status(500).json({
          success: false,
          message: "No model settings available",
        });
      }

      // create history
      let hasSystemMessage = false;
      let history = messages.slice(0, -1).map((msg) => {
        if (msg.role === "system") {
          hasSystemMessage = true;
          return new SystemMessage(msg.content);
        } else if (msg.role === "assistant") {
          return new AIMessage(msg.content);
        } else {
          return new HumanMessage(msg.content);
        }
      });

      // add system prompt if not exist, make sure LLM can run
      if (!hasSystemMessage) {
        const systemPrompt = promptManager.getPrompt("system");
        if (systemPrompt) {
          history = [new SystemMessage(systemPrompt), ...history];
        }
      }

      const input = messages[messages.length - 1]?.content;
      const availableTools = tool_choice === "auto" ? await serverManager.getAvailableTools() : [];

      const modelName = modelSettings.model;
      const baseUrl = modelSettings.configuration?.baseURL || modelSettings.baseURL || "";
      const model = await initChatModel(modelName, {
        ...modelSettings,
        baseUrl,
      });

      const chatId = randomUUID();

      // set stream response
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
      }

      // set abort handler
      const handleAbort = () => {
        const controller = abortControllerMap.get(chatId);
        if (controller) {
          logger.info(`[${chatId}][chat/completions] Chat abort signal sent`);
          controller.abort();
        }
      };

      req.on("close", handleAbort);
      req.on("aborted", handleAbort);
      res.on("close", handleAbort);

      logger.debug(`[${chatId}][chat/completions] Start chat`);

      try {
        const { result, tokenUsage } = await handleProcessQuery(
          modelManager.getToolToServerMap(),
          availableTools,
          model,
          input,
          history,
          stream
            ? (text: string) => {
                const streamData = JSON.parse(text);
                if (streamData.type === "text") {
                  const response: ChatCompletionResponse = {
                    id: `chatcmpl-${chatId}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelSettings.model,
                    system_fingerprint: "fp_souls",
                    choices: [
                      {
                        index: 0,
                        delta: !streamData.content
                          ? { role: "assistant", content: "" }
                          : { content: streamData.content },
                        logprobs: null,
                        finish_reason: null,
                      },
                    ],
                  };
                  res.write(`data: ${JSON.stringify(response)}\n\n`);
                }
              }
            : undefined,
          chatId
        );

        if (stream) {
          // send end response
          const endResponse: ChatCompletionResponse = {
            id: `chatcmpl-${chatId}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: modelSettings.model,
            system_fingerprint: "fp_souls",
            choices: [
              {
                index: 0,
                delta: {},
                logprobs: null,
                finish_reason: "stop",
              },
            ],
          };

          res.write(`data: ${JSON.stringify(endResponse)}\n\n`);
          res.end();
        } else {
          // send full response
          res.json({
            id: `chatcmpl-${chatId}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: modelSettings.model,
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: result,
                  refusal: null,
                },
                logprobs: null,
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: tokenUsage.totalInputTokens,
              completion_tokens: tokenUsage.totalOutputTokens,
              total_tokens: tokenUsage.totalTokens,
            },
            system_fingerprint: "fp_souls",
          });
        }
      } finally {
        logger.debug(`[${chatId}][chat/completions] End chat`);
        req.off("close", handleAbort);
        req.off("aborted", handleAbort);
        res.off("close", handleAbort);
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  return router;
}
