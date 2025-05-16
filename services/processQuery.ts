import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  MessageContentComplex,
  ToolMessage,
  SystemMessage
} from "@langchain/core/messages";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ModelManager } from "./models/index.js";
import { imageToBase64 } from "./utils/image.js";
import logger from "./utils/logger.js";
import { iQueryInput, iStreamMessage, ModelSettings } from "./utils/types.js";
import { openAIConvertToGeminiTools } from "./utils/toolHandler.js";
import { ToolDefinition } from "@langchain/core/language_models/base";
import { adaptToolResponse, convertCamelCaseToKebabCase } from "./utils/toolResponseAdapter.js";
import { ENSUtility } from './utils/ensUtility.js';
import * as KnowledgeStore from "../electron/main/knowledge-store.js";
import { TaskManager } from "./agent/taskManager.js";
import { taskManagementTools } from "./prompt/system.js";
import { canvasTools } from "./prompt/system.js";
import { read_canvas_tool_implementation, add_image_to_canvas_tool_implementation, add_url_to_canvas_tool_implementation, add_embed_to_canvas_tool_implementation } from "./tools/canvasTools.js";

// Map to store abort controllers
export const abortControllerMap = new Map<string, AbortController>();

// Map to store partial responses when aborted
export interface AbortedResponse {
  content: string;
}

export const abortedResponseMap = new Map<string, AbortedResponse>();

interface TokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
}

// Define an interface for the tool call chunks to resolve type errors
interface ToolCallChunk {
  index?: number;
  id?: string;
  name?: string;
  args?: string;
  input?: string;
}

export async function handleProcessQuery(
  toolToClientMap: Map<string, Client>,
  availableTools: ToolDefinition[],
  model: BaseChatModel | null,
  input: string | iQueryInput,
  history: BaseMessage[],
  onStream?: (text: string) => void,
  chatId?: string
) {
  // If chatId exists, create a new AbortController
  if (chatId) {
    const existingController = abortControllerMap.get(chatId);
    if (existingController) {
      existingController.abort();
      abortControllerMap.delete(chatId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      logger.debug(`[${chatId}] Abort previous chat and delete abortController`);
    }

    const controller = new AbortController();
    abortControllerMap.set(chatId, controller);
    logger.debug(`[${chatId}] Set new abortController`);
  }

  let finalResponse = "";

  const modelManager = ModelManager.getInstance();
  const originalModelSettings = modelManager.currentModelSettings;
  // Create a mutable copy for potential normalization
  const effectiveModelSettings = originalModelSettings ? { ...originalModelSettings } : null;

  if (effectiveModelSettings && effectiveModelSettings.modelProvider === 'venice') {
    logger.info(`[${chatId}] Normalizing modelProvider from 'venice' to 'openai' for handleProcessQuery context.`);
    effectiveModelSettings.modelProvider = 'openai';
  }

  const tokenUsage = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
  };

  try {
    // Handle input format
    const messages: BaseMessage[] = [...history]; // Copy the history array to avoid modifying the original

    // Extract query text for canvas detection and other analysis
    // let queryText = ""; // No longer needed
    // if (typeof input === "string") {
    //   queryText = input;
    // } else if (input && input.text) {
    //   queryText = input.text;
    // }

    // NEW CODE: Merge knowledge base instruction into existing system message or prepend if none
    const activeKnowledgeBaseId = KnowledgeStore.getActiveKnowledgeBase();
    if (activeKnowledgeBaseId) {
      const kb = KnowledgeStore.getCollection(activeKnowledgeBaseId);
      if (kb) {
        const kbInstructionText = `IMPORTANT: I have access to the knowledge base "${kb.name}". When I'm asked about topics that might be covered in this knowledge base, I should use the knowledge_search tool FIRST before using web_search or other tools. This knowledge base contains preferred, curated information that should be prioritized over external sources.`;
        const firstSystemIndex = messages.findIndex(msg => msg instanceof SystemMessage);
        if (firstSystemIndex >= 0) {
          const sysMsg = messages[firstSystemIndex] as SystemMessage;
          if (typeof sysMsg.content === 'string' && !sysMsg.content.includes(kbInstructionText)) {
            sysMsg.content = `${kbInstructionText}\n${sysMsg.content}`;
          }
        } else {
          logger.info(`Adding knowledge base instruction for active KB: ${kb.name}`);
          messages.unshift(new SystemMessage(kbInstructionText));
        }
      }
    }

    if (!model) {
      throw new Error("Model not initialized");
    }

    // if retry, then input is empty
    if (input) {
      if (typeof input === "string") {
        messages.push(new HumanMessage(input));
      } else {
        // Handle input with images
        const content: MessageContentComplex[] = [];

        // Add text content if exists
        if (input.text) {
          content.push({ type: "text", text: input.text });
        }

        // Add image content if exists
        if (input.images && input.images.length > 0) {
          for (const imagePath of input.images) {
            // Get actual file path from URL
            const localPath = `${imagePath}`;
            const base64Image = await imageToBase64(localPath);
            content.push({
              type: "text",
              text: `![Image](${localPath})`,
            });
            content.push({
              type: "image_url",
              image_url: {
                url: base64Image,
              },
            });
          }
        }

        // Add image content if exists
        if (input.documents && input.documents.length > 0) {
          for (const documentPath of input.documents) {
            const localPath = `${documentPath}`;
            content.push({
              type: "text",
              text: `![Document](${localPath})`,
            });
          }
        }

        messages.push(new HumanMessage({ content }));
      }
    }

    let hasToolCalls = true;

    // Check if the query is asking about available tools
    const isAskingAboutTools = typeof input === 'string' &&
      input.toLowerCase().match(/(what|which|list|show|tell me about).*(tools|functions|capabilities|can you use)/i);

    // Include built-in agent task management tools
    const combinedTools = [...availableTools, ...taskManagementTools, ...canvasTools];
    const tools = effectiveModelSettings?.modelProvider === "google-genai"
      ? openAIConvertToGeminiTools(combinedTools)
      : combinedTools;

    // --- Add logging for tools list ---
    logger.debug(`[${chatId}] Tools to be bound (before schema correction): ${JSON.stringify(tools, null, 2)}`);
    // --- End logging ---

    // --- Correct tool schemas before binding ---
    const correctedTools = tools.map(tool => {
      const params = tool.function?.parameters;
      // Check if parameters exist, are an object, have type 'object', and lack 'properties'
      if (params && typeof params === 'object' && !Array.isArray(params) &&
        'type' in params && params.type === 'object' &&
        !('properties' in params)) {

        // Deep copy to avoid modifying the original tool definition in availableTools
        const correctedTool = JSON.parse(JSON.stringify(tool));
        // Ensure parameters is still treated as an object for assignment
        if (correctedTool.function?.parameters && typeof correctedTool.function.parameters === 'object') {
          (correctedTool.function.parameters as Record<string, unknown>).properties = {};
        }
        return correctedTool;
      }
      return tool;
    });
    logger.debug(`[${chatId}] Tools to be bound (after schema correction): ${JSON.stringify(correctedTools, null, 2)}`);
    // --- End schema correction ---

    // Only bind tools if we're not asking about them and tools are enabled
    const runModel = (isAskingAboutTools || !modelManager.enableTools) ? model : (model.bindTools?.(correctedTools) || model);

    const isOllama = effectiveModelSettings?.modelProvider === "ollama";
    const isDeepseek =
      effectiveModelSettings?.configuration?.baseURL?.toLowerCase().includes("deepseek") ||
      effectiveModelSettings?.model?.toLowerCase().includes("deepseek");
    const isMistralai = effectiveModelSettings?.modelProvider === "mistralai";
    const isBedrock = effectiveModelSettings?.modelProvider === "bedrock";

    logger.debug(`[${chatId}] Start to process LLM query`);

    while (hasToolCalls) {
      const stream = await runModel.stream(messages, {
        signal: chatId ? abortControllerMap.get(chatId)?.signal : undefined,
      });

      let currentContent = "";
      let toolCalls: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }> = [];

      try {
        // Track token usage if available
        for await (const chunk of stream) {
          caculateTokenUsage(tokenUsage, chunk, effectiveModelSettings!);

          if (chunk.content) {
            let chunkMessage = "";
            if (Array.isArray(chunk.content)) {
              // compatible Anthropic response format
              const textContent = chunk.content.find((item) => item.type === "text" || item.type === "text_delta");
              if (textContent && 'text' in textContent) {
                chunkMessage = textContent.text;
              }
            } else {
              chunkMessage = chunk.content;
            }
            currentContent += chunkMessage;
            onStream?.(
              JSON.stringify({
                type: "text",
                content: chunkMessage,
              } as iStreamMessage)
            );
          }

          // Handle tool call stream
          /** Note: When using stream, read tool_call_chunks to get tool call results
           *  tool_calls arguments are empty.
           */
          if (
            chunk.tool_calls ||
            chunk.tool_call_chunks ||
            (Array.isArray(chunk.content) && chunk.content.some((item) => item.type === "tool_use"))
          ) {
            let toolCallChunks: ToolCallChunk[] = [];

            toolCallChunks = chunk.tool_call_chunks || [];

            for (const chunks of toolCallChunks) {
              let index = chunks.index;
              // Use index to find or create tool call record
              // Ollama have multiple tool_call with same index and diff id
              if (isOllama && index !== undefined && index >= 0 && toolCalls[index]) {
                index = toolCalls.findIndex((toolCall) => toolCall.id === chunks.id);
                if (index === undefined || index < 0) {
                  index = toolCalls.length;
                }
              }

              if (index !== undefined && index >= 0 && !toolCalls[index]) {
                toolCalls[index] = {
                  id: chunks.id,
                  type: "function",
                  function: {
                    name: chunks.name,
                    arguments: "",
                  },
                };
              }

              if (index !== undefined && index >= 0) {
                if (chunks.name) {
                  toolCalls[index].function.name = chunks.name;
                }

                if (chunks.args || chunks.input) {
                  const newArgs = chunks.args || chunks.input || "";
                  toolCalls[index].function.arguments += newArgs;
                }

                // Try to parse complete arguments
                try {
                  const args = toolCalls[index].function.arguments;
                  if (args.startsWith("{") && args.endsWith("}")) {
                    const parsedArgs = JSON.parse(args);
                    toolCalls[index].function.arguments = JSON.stringify(parsedArgs);
                  }
                } catch {
                  // If parsing fails, arguments are not complete, continue accumulating
                }
              }
            }
          }
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.message.toLowerCase().includes("abort")) {
          logger.info(`[${chatId}] Aborted when LLM response streaming`);
          finalResponse += currentContent;
          // Save current response state
          abortedResponseMap.set(chatId || "", {
            content: finalResponse,
          });
          throw error;
        }
        logger.error(`Error in stream processing: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }

      logger.debug(`[${chatId}] Chunk collected`);

      // filter empty tool calls
      toolCalls = toolCalls.filter((call) => call);

      // Update final response
      finalResponse += currentContent;

      // If no tool calls, end loop
      if (toolCalls.length === 0) {
        hasToolCalls = false;
        break;
      }

      logger.debug(`[${chatId}] Tool calls: ${JSON.stringify(toolCalls, null, 2)}`);

      // Prepare standardized tool_calls for AIMessage
      const aiMessageToolCalls = toolCalls.map(tc => {
        let parsedArgs: Record<string, unknown> = {};
        try {
          // Ensure tc.function.arguments is a string. If empty or not a string, default to {}.
          if (tc.function && tc.function.arguments && typeof tc.function.arguments === 'string' && tc.function.arguments.trim() !== '') {
            parsedArgs = JSON.parse(tc.function.arguments);
          }
        } catch (e) {
          logger.error(`[${chatId}] Error parsing tool call arguments for AIMessage.tool_calls ('${tc.function.name}'): "${tc.function.arguments}". Error: ${e}. Defaulting to empty args.`);
          // parsedArgs remains {}
        }
        return {
          name: tc.function.name,
          args: parsedArgs,
          id: tc.id,
        };
      }).filter(tc => tc.id && tc.name); // Ensure essential properties are present


      messages.push(
        new AIMessage({
          content: [
            {
              type: "text",
              // some model not allow empty content in text block
              text: currentContent || (aiMessageToolCalls.length > 0 ? "" : "."), // Allow empty content if tool calls exist
            },
            // Deepseek will recursive when tool_use exist in content
            // For Mistral (isMistralai = true), this part results in an empty array,
            // meaning no tool_use blocks are added to the content array itself.
            ...(isDeepseek || isMistralai || isBedrock
              ? []
              : toolCalls.map((toolCall) => {
                let parsedArgsForContent = {}
                try {
                  if (toolCall.function.arguments && typeof toolCall.function.arguments === 'string' && toolCall.function.arguments.trim() !== '') {
                    parsedArgsForContent = JSON.parse(toolCall.function.arguments);
                  }
                } catch {
                  // Avoid mutating original toolCall.function.arguments here
                  logger.error(`[${chatId}] Error parsing tool call ${toolCall.function.name} args for content block`);
                  parsedArgsForContent = {};
                }
                return {
                  type: "tool_use",
                  id: toolCall.id,
                  name: toolCall.function.name,
                  input: parsedArgsForContent,
                }
              })),
          ],
          // Add the standardized tool_calls property
          tool_calls: aiMessageToolCalls.length > 0 ? aiMessageToolCalls : undefined,
          
          // Keep existing additional_kwargs for potential backward compatibility or specific model needs
          additional_kwargs: {
            tool_calls: toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: "function",
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments, // Keep as string here for the original structure
              },
            })),
          },
        })
      );

      // Send call info before tool execution
      if (toolCalls.length > 0) {
        onStream?.(
          JSON.stringify({
            type: "tool_calls",
            content: toolCalls.map((call) => {
              logger.info(
                `[Tool Calls] [${call.function.name}] ${JSON.stringify(call.function.arguments || "{}", null, 2)}`
              );
              const parsedCallArgs: Record<string, unknown> = JSON.parse(call.function.arguments || "{}");
              return {
                name: call.function.name,
                arguments: parsedCallArgs,
              };
            }),
          } as iStreamMessage)
        );
      }

      logger.debug(`[${chatId}] Tool calls collected`);

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          try {
            // Check if already aborted
            if (chatId && abortControllerMap.has(chatId)) {
              const controller = abortControllerMap.get(chatId);
              if (controller?.signal.aborted) {
                logger.info(`[${chatId}] Aborted before tool call`);
                throw new Error("ABORTED");
              }
            }

            const toolName = toolCall.function.name;
            const toolArgs: Record<string, unknown> = JSON.parse(toolCall.function.arguments || "{}");
            const client = toolToClientMap.get(toolName);

            // Create an AbortSignal for this specific tool call
            const abortController = new AbortController();

            // If there's a chat ID, link this tool call's abort to the main abort
            let mainAbortListener: (() => void) | undefined;
            if (chatId && abortControllerMap.has(chatId)) {
              const mainController = abortControllerMap.get(chatId);
              if (mainController) {
                // If already aborted, throw immediately
                if (mainController.signal.aborted) {
                  throw new Error("ABORTED");
                }
                // Listen for abort
                mainAbortListener = () => {
                  logger.info(`[${chatId}] Aborting tool call [${toolName}]`);
                  abortController.abort();
                };
                mainController.signal.addEventListener("abort", mainAbortListener);
              }
            }

            // Handle ENS utility tools if needed
            const ensTools = ['resolve_ens', 'lookup_address'];
            if (ensTools.includes(toolName)) {
              try {
                const ensUtility = ENSUtility.getInstance();
                const ensClient = ensUtility.createClient();

                // Use the client's callTool method instead of direct method access
                const result = await ensClient.callTool({
                  name: toolName,
                  arguments: toolArgs
                });

                // Log the result
                logger.info(`[ENS Tool Result] [${toolName}] ${JSON.stringify(result, null, 2)}`);

                onStream?.(
                  JSON.stringify({
                    type: "tool_result",
                    content: {
                      name: toolName,
                      result: adaptToolResponse(result),
                    },
                  } as iStreamMessage)
                );

                return {
                  tool_call_id: toolCall.id,
                  name: toolName,
                  content: JSON.stringify(adaptToolResponse(result)),
                };
              } catch (error) {
                logger.error(`Error in ENS tool ${toolName}:`, error);
                throw error;
              }
            }

            // Custom agent tasks handling
            if (toolName === 'add_task') {
              const description = (toolArgs as { description: string }).description;
              if (!description) throw new Error('Task description is required');
              const task = await TaskManager.getInstance().addTask(description);
              const result = { success: true, taskId: task.id };
              onStream?.(
                JSON.stringify({ type: 'tool_result', content: { name: toolName, result } })
              );
              return { tool_call_id: toolCall.id, name: toolName, content: JSON.stringify(result) };
            } else if (toolName === 'list_tasks') {
              const tasks = await TaskManager.getInstance().getActiveTasks();
              const summarized = tasks.map(t => ({ id: t.id, description: t.description, status: t.status }));
              const result = { tasks: summarized };
              onStream?.(
                JSON.stringify({ type: 'tool_result', content: { name: toolName, result } })
              );
              return { tool_call_id: toolCall.id, name: toolName, content: JSON.stringify(result) };
            } else if (toolName === 'complete_task') {
              const taskId = (toolArgs as { task_id: string }).task_id;
              const summary = (toolArgs as { result_summary: string }).result_summary;
              if (!taskId || !summary) throw new Error('Task ID and result summary are required');
              await TaskManager.getInstance().handleTaskCompletion(taskId, summary);
              const result = { success: true, message: `Task ${taskId} marked complete.` };
              onStream?.(
                JSON.stringify({ type: 'tool_result', content: { name: toolName, result } })
              );
              return { tool_call_id: toolCall.id, name: toolName, content: JSON.stringify(result) };
            } else if (toolName === 'read_canvas') {
              logger.info(`[Tool Execution] Calling read_canvas_tool_implementation for tool call ID: ${toolCall.id}`);
              const canvasResult = await read_canvas_tool_implementation();
              logger.info(`[Tool Execution] Result from read_canvas_tool_implementation:`, canvasResult);
              onStream?.(
                JSON.stringify({ type: 'tool_result', content: { name: toolName, result: canvasResult } })
              );
              return {
                tool_call_id: toolCall.id,
                name: toolName,
                content: JSON.stringify(canvasResult)
              };
            } else if (toolName === 'add_image_to_canvas') {
              logger.info(`[Tool Execution] Calling add_image_to_canvas_tool_implementation with args: ${JSON.stringify(toolArgs)} for tool call ID: ${toolCall.id}`);
              const addImageResult = await add_image_to_canvas_tool_implementation(toolArgs as any); // Cast to any for now, refine if specific type is available for toolArgs
              logger.info(`[Tool Execution] Result from add_image_to_canvas_tool_implementation:`, addImageResult);
              onStream?.(
                JSON.stringify({ type: 'tool_result', content: { name: toolName, result: addImageResult } })
              );
              return {
                tool_call_id: toolCall.id,
                name: toolName,
                content: JSON.stringify(addImageResult)
              };
            } else if (toolName === 'add_url_to_canvas') {
              logger.info(`[Tool Execution] Calling add_url_to_canvas_tool_implementation with args: ${JSON.stringify(toolArgs)} for tool call ID: ${toolCall.id}`);
              const addUrlResult = await add_url_to_canvas_tool_implementation(toolArgs as any); // Cast to any for now, refine if specific type is available for toolArgs
              logger.info(`[Tool Execution] Result from add_url_to_canvas_tool_implementation:`, addUrlResult);
              onStream?.(
                JSON.stringify({ type: 'tool_result', content: { name: toolName, result: addUrlResult } })
              );
              return {
                tool_call_id: toolCall.id,
                name: toolName,
                content: JSON.stringify(addUrlResult)
              };
            } else if (toolName === 'add_embed_to_canvas') {
              logger.info(`[Tool Execution] Calling add_embed_to_canvas_tool_implementation with args: ${JSON.stringify(toolArgs)} for tool call ID: ${toolCall.id}`);
              const addEmbedResult = await add_embed_to_canvas_tool_implementation(toolArgs as any); // Cast to any for now, refine if specific type is available for toolArgs
              logger.info(`[Tool Execution] Result from add_embed_to_canvas_tool_implementation:`, addEmbedResult);
              onStream?.(
                JSON.stringify({ type: 'tool_result', content: { name: toolName, result: addEmbedResult } })
              );
              return {
                tool_call_id: toolCall.id,
                name: toolName,
                content: JSON.stringify(addEmbedResult)
              };
            }

            try {
              const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
                const executeToolCall = async () => {
                  try {
                    const abortListener = () => {
                      logger.info(`[${chatId}] Tool call [${toolName}] has been aborted`);
                      reject(new Error("ABORTED"));
                    };

                    abortController.signal.addEventListener("abort", abortListener);

                    try {
                      const result = await client?.callTool(
                        {
                          name: toolName,
                          // Convert camelCase to kebab-case for tool arguments with error handling
                          arguments: ((): Record<string, unknown> => {
                            if (toolName === 'think') {
                              return toolArgs;
                            }
                            try {
                              return convertCamelCaseToKebabCase(toolArgs);
                            } catch (conversionError) {
                              logger.error(`Error converting tool args to kebab-case for tool ${toolName}: ${conversionError}`);
                              // Fall back to original args if conversion fails
                              return toolArgs;
                            }
                          })(),
                        },
                        undefined,
                        {
                          signal: abortController.signal,
                          timeout: 99999000,
                        }
                      );

                      resolve(result);
                    } catch (error) {
                      reject(error);
                    } finally {
                      abortController.signal.removeEventListener("abort", abortListener);
                    }
                  } catch (error) {
                    reject(error);
                  }
                };

                setImmediate(executeToolCall);
              });

              if (result && 'isError' in result && result.isError) {
                logger.error(`[Tool Result] [${toolName}] ${JSON.stringify(result, null, 2)}`);
              } else {
                logger.info(`[Tool Result] [${toolName}] ${JSON.stringify(result, null, 2)}`);
              }

              onStream?.(
                JSON.stringify({
                  type: "tool_result",
                  content: {
                    name: toolName,
                    result: adaptToolResponse(result),
                  },
                } as iStreamMessage)
              );

              return {
                tool_call_id: toolCall.id,
                name: toolName,
                content: JSON.stringify(adaptToolResponse(result)),
              };
            } finally {
              if (mainAbortListener && chatId && abortControllerMap.has(chatId)) {
                const mainController = abortControllerMap.get(chatId);
                mainController?.signal.removeEventListener("abort", mainAbortListener);
              }
            }
          } catch (error) {
            if (error instanceof Error && error.message === "ABORTED") {
              // logger.info(`[${chatId}] Tool call has been aborted`);
              throw error; // Re-throw to be caught by the outer try-catch
            }
            throw error;
          }
        })
      );

      logger.debug(`[${chatId}] Tool results collected`);

      // Add tool results to conversation
      if (toolResults.length > 0) {
        messages.push(...toolResults.map((result) => new ToolMessage(result)));
      }

      logger.debug(`[${chatId}] Messages collected and ready to next round`);
    }

    // Log token usage at the end of processing
    logger.debug(
      `[${chatId}] Input tokens: ${tokenUsage.totalInputTokens}, Output tokens: ${tokenUsage.totalOutputTokens}, Total tokens: ${tokenUsage.totalTokens}`
    );

    return { result: finalResponse, tokenUsage };
  } catch (error) {
    const err = error as Error;
    if (err.message.toLowerCase().includes("abort")) {
      // If aborted, return saved response
      logger.info(`[${chatId}] has been aborted`);
      const abortedResponse = abortedResponseMap.get(chatId || "");
      const response = abortedResponse?.content || finalResponse || "";
      onStream?.(JSON.stringify({
        type: "text",
        content: response,
      } as iStreamMessage));
      return { result: response, tokenUsage };
    }

    // Handle invalid tool errors gracefully
    if (err.message.includes("Invalid schema for function")) {
      const toolName = err.message.match(/function '([^']+)'/)?.[1];
      const userFriendlyError = `I apologize, but I tried to use a tool called "${toolName}" that isn't available. Let me help you with what I can do instead.`;
      logger.error(`Error in handleProcessQuery: ${err.message}`);
      onStream?.(JSON.stringify({
        type: "text",
        content: userFriendlyError,
      } as iStreamMessage));
      return { result: userFriendlyError, tokenUsage };
    }

    // For other errors, provide a generic but helpful message
    const genericError = "I encountered an error while processing your request. Could you please rephrase your question or try a different approach?";
    logger.error(`Error in handleProcessQuery: ${err.message}`);
    onStream?.(JSON.stringify({
      type: "text",
      content: genericError,
    } as iStreamMessage));
    return {
      result: genericError,
      tokenUsage
    };
  } finally {
    // Clean up AbortController
    if (chatId) {
      abortedResponseMap.delete(chatId);
    }
  }
}

function caculateTokenUsage(tokenUsage: TokenUsage, chunk: AIMessageChunk, currentModelSettings: ModelSettings) {
  if (!currentModelSettings) {
    return;
  }

  if (currentModelSettings.configuration?.baseURL?.toLowerCase().includes("silicon")) {
    const usage = chunk.response_metadata.usage;
    tokenUsage.totalInputTokens = usage?.prompt_tokens || 0;
    tokenUsage.totalOutputTokens = usage?.completion_tokens || 0;
    tokenUsage.totalTokens = usage?.total_tokens || 0;
    return;
  }

  switch (currentModelSettings.modelProvider) {
    case "openai":
      if (chunk.response_metadata?.usage) {
        const usage = chunk.response_metadata.usage;
        tokenUsage.totalInputTokens += usage?.prompt_tokens || 0;
        tokenUsage.totalOutputTokens += usage?.completion_tokens || 0;
        tokenUsage.totalTokens += usage?.total_tokens || 0;
      }
      break;
    case "anthropic":
    case "ollama":
      if (chunk.usage_metadata) {
        const usage = chunk.usage_metadata;
        tokenUsage.totalInputTokens += usage?.input_tokens || 0;
        tokenUsage.totalOutputTokens += usage?.output_tokens || 0;
        tokenUsage.totalTokens += usage?.total_tokens || 0;
      }
      break;
    default:
      break;
  }
}