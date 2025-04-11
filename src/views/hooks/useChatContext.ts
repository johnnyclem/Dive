import Debug from 'debug';
import useChatStore from 'stores/useChatStore';
import useSettingsStore from 'stores/useSettingsStore';
import { DEFAULT_MAX_TOKENS, NUM_CTX_MESSAGES, tempChatId } from 'consts';
import { useMemo } from 'react';
import { isNil, isNumber, isUndefined } from 'lodash';
import { isValidMaxTokens, isValidTemperature } from 'intellichat/validators';
import { TLShape, TLTextShape } from '@tldraw/tldraw';
import { IChat, IChatContext, IChatMessage, IPrompt } from 'intellichat/types';
import { IChatModel } from 'providers/types';
import useProvider from './useProvider';

const debug = Debug('souls:hooks:useChatContext');

// Helper function to extract text from Tldraw snapshot
const extractTextFromCanvas = (canvasData: string | null | undefined): string => {
  if (!canvasData) return '';
  try {
    const snapshot = JSON.parse(canvasData);
    const shapes = snapshot?.store ? Object.values(snapshot.store) as TLShape[] : [];
    let extractedText = '';
    for (const shape of shapes) {
      if (shape.type === 'text' && shape.props && 'text' in shape.props) {
        // Now TypeScript should be sure that shape.props.text exists
        const text = (shape.props as { text?: string }).text;
        if (text) {
            extractedText += text + '\n';
        }
      }
    }
    return extractedText.trim();
  } catch (error) {
    console.error('Failed to extract text from canvas data:', error);
    return '';
  }
};

export default function useChatContext(): IChatContext {
  const { getProvider: getChatProvider, getChatModel } = useProvider();

  const context = useMemo(() => {
    const getActiveChat = () => {
      const { chat } = useChatStore.getState();
      // const chatId = chat.id || 'temp';
      // debug(`Chat(${chatId}):getActiveChat: ${chat.summary || ''}`);
      return chat as IChat;
    };

    const getProvider = () => {
      const { api } = useSettingsStore.getState();
      return getChatProvider(api.provider);
    };

    const getModel = () => {
      const { api } = useSettingsStore.getState();
      const defaultModel = { name: api.model, label: api.model } as IChatModel;
      const provider = getChatProvider(api.provider);
      if (Object.keys(provider.chat.models).length === 0) {
        return defaultModel;
      }
      let model = getChatModel(api.provider, api.model, defaultModel);
      if (api.provider === 'Azure') {
        return model;
      }
      const { chat } = useChatStore.getState();
      if (chat?.model) {
        model = getChatModel(api.provider, chat.model, model);
      }
      // const chatId = chat.id || 'temp';
      // debug(`Chat(${chatId}):getModel: ${model.label || ''}`);
      return model;
    };

    const getSystemMessage = () => {
      const { chat } = useChatStore.getState();
      const prompt = chat.prompt as IPrompt | null;
      const systemMessage =
        prompt?.systemMessage || chat?.systemMessage || null;
      // const chatId = chat.id || 'temp';
      // debug(`Chat(${chatId}):getSystemMessage: ${systemMessage || ''}`);
      return systemMessage;
    };

    const getTemperature = (): number => {
      const { chat } = useChatStore.getState();
      const { api } = useSettingsStore.getState();
      let temperature = getChatProvider(api.provider).chat.temperature
        .default as number;
      const prompt = chat.prompt as IPrompt | null;
      if (isValidTemperature(prompt?.temperature, api.provider)) {
        temperature = prompt?.temperature as number;
      }
      if (isValidTemperature(chat?.temperature, api.provider)) {
        temperature = chat?.temperature as number;
      }
      // debug(`Chat(${chat.id}):getSystemMessage: ${temperature}`);
      return temperature;
    };

    const getMaxTokens = () => {
      const { chat } = useChatStore.getState();
      const { api } = useSettingsStore.getState();
      const model = getModel();
      let maxTokens =
        model.defaultMaxTokens || model.maxTokens || DEFAULT_MAX_TOKENS;
      const prompt = chat.prompt as IPrompt | null;
      if (
        prompt?.maxTokens != null &&
        isValidMaxTokens(prompt?.maxTokens, api.provider, model.name)
      ) {
        maxTokens = prompt?.maxTokens || (prompt?.maxTokens as number);
      }
      if (
        chat?.maxTokens != null &&
        isValidMaxTokens(chat?.maxTokens, api.provider, model.name)
      ) {
        maxTokens = chat?.maxTokens as number;
      }
      // debug(`Chat(${chat.id}):getMaxTokens: ${maxTokens}`);
      return maxTokens as number;
    };

    const getChatContext = () => {
      const { chat } = useChatStore.getState();
      const chatContext = chat?.context || '';
      // debug(`Chat(${chat.id}):getChatContext: ${chatContext}`);
      return chatContext;
    };

    const isStream = () => {
      const { chat } = useChatStore.getState();
      let stream = true;
      if (!isNil(chat?.stream)) {
        stream = chat.stream;
      }
      // debug(`Chat(${chat.id}):isStream: ${stream}`);
      return stream;
    };

    const isToolEnabled = () => {
      const { getToolState } = useSettingsStore.getState();
      const model = getModel();
      let toolEnabled = getToolState(getProvider().name, model.name);
      if (isUndefined(toolEnabled)) {
        toolEnabled = model.toolEnabled || false;
      }
      return toolEnabled;
    };

    const getCtxMessages = () => {
      const { chat } = useChatStore.getState();
      let ctxMessages: IChatMessage[] = [];
      const maxCtxMessages = isNumber(chat?.maxCtxMessages)
        ? chat?.maxCtxMessages
        : NUM_CTX_MESSAGES;
      if (maxCtxMessages > 0) {
        const messages = useChatStore.getState().messages || [];
        if (messages.length <= maxCtxMessages) {
          ctxMessages = messages.slice(0, -1);
        } else {
          // @NOTE: 去除最后一条外的最后的 maxCtxMessages 条 （最后一条是刚创建的）
          ctxMessages = messages.slice(
            -maxCtxMessages - 1,
            messages.length - 1,
          );
        }
      }
      // debug(`Chat(${chat.id}):getCtxMessages: ${ctxMessages.length} messages`);
      return ctxMessages;
    };

    const getCanvasTextContent = () => {
      const { chat } = useChatStore.getState();
      const text = extractTextFromCanvas(chat.canvasData);
      // const chatId = chat.id || 'temp';
      // debug(`Chat(${chatId}):getCanvasTextContent: ${text}`);
      return text;
    };

    const ctx = {
      getActiveChat,
      getProvider,
      getModel,
      getSystemMessage,
      getCtxMessages,
      getTemperature,
      getMaxTokens,
      getChatContext,
      getCanvasTextContent,
      isStream,
      isToolEnabled,
    };
    return ctx;
  }, []);

  return context;
}
