// eslint-disable @typescript-eslint/no-explicit-any
import { ipcMain } from 'electron';
import * as logging from './logging';
import axios, { AxiosResponse } from 'axios';

/**
 * Sets up the LLM IPC handlers
 */
export function ipcLlmHandler() {
  logging.info('Setting up LLM handlers');

  // OpenAI model list
  ipcMain.handle('llm:openaiModelList', async (_event, apiKey: string) => {
    try {
      const resp: AxiosResponse<{ data: Array<{ id: string }> }> = await axios.get(
        'https://api.openai.com/v1/models',
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      const list = resp.data.data;
      const models = list.map(m => ({ id: m.id, name: m.id }));
      return { models };
    } catch (error: any) {
      logging.error(`Failed to get OpenAI model list: ${error}`);
      return { models: [] };
    }
  });

  // OpenAI compatible model list
  ipcMain.handle('llm:openaiCompatibleModelList', async (_event, apiKey: string, baseURL: string) => {
    try {
      const url = `${baseURL.replace(/\/+$/, '')}/v1/models`;
      const resp: AxiosResponse<{ data: Array<{ id: string }> }> = await axios.get(
        url,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      const list = resp.data.data;
      const models = list.map(m => ({ id: m.id, name: m.id }));
      return { models };
    } catch (error: any) {
      logging.error(`Failed to get OpenAI compatible model list: ${error}`);
      return { models: [] };
    }
  });

  // Anthropic model list
  ipcMain.handle('llm:anthropicModelList', async (_event, apiKey: string, baseURL: string) => {
    try {
      const url = `${baseURL.replace(/\/+$/, '')}/v1/models`;
      const resp: AxiosResponse<{ models: Array<{ id: string }> }> = await axios.get(
        url,
        { headers: { 'x-api-key': apiKey } }
      );
      const list = resp.data.models;
      const models = list.map(m => ({ id: m.id, name: m.id }));
      return { models };
    } catch (error: any) {
      logging.error(`Failed to get Anthropic model list: ${error}`);
      return { models: [] };
    }
  });

  // Ollama model list
  ipcMain.handle('llm:ollamaModelList', async (_event, baseURL: string) => {
    try {
      const url = `${baseURL.replace(/\/+$/, '')}/v1/models`;
      const resp: AxiosResponse<unknown> = await axios.get(url);
      // Narrow response data
      const payload = resp.data as Record<string, unknown>;
      let list: Array<{ id: string }> = [];
      if (Array.isArray(payload)) {
        list = payload as Array<{ id: string }>;
      } else if (Array.isArray((payload.data))) {
        list = (payload.data as Array<{ id: string }>);
      } else if (Array.isArray((payload.models))) {
        list = (payload.models as Array<{ id: string }>);
      }
      const models = list.map(item => ({ id: item.id, name: item.id }));
      return { models };
    } catch (error) {
      logging.error(`Failed to get Ollama model list: ${String(error)}`);
      return { models: [] };
    }
  });

  // Google GenAI model list
  ipcMain.handle('llm:googleGenaiModelList', async (_event, apiKey: string) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
      const resp: AxiosResponse<{ models: Array<{ name: string }> }> = await axios.get(url);
      const list = resp.data.models;
      const models = list.map(m => ({ id: m.name, name: m.name }));
      return { models };
    } catch (error: any) {
      logging.error(`Failed to get Google GenAI model list: ${error}`);
      return { models: [] };
    }
  });

  // MistralAI model list (unsupported)
  ipcMain.handle('llm:mistralaiModelList', async () => {
    logging.error('MistralAI model listing not implemented');
    return { models: [] };
  });

  // AWS Bedrock model list (unsupported)
  ipcMain.handle('llm:bedrockModelList', async () => {
    logging.error('AWS Bedrock model listing not implemented');
    return { models: [] };
  });
}
