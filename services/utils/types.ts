export interface iQueryInput {
  text?: string;
  images?: string[];
  documents?: string[];
}

export interface iTool {
  name: string;
  tools: any[];
  description: string;
  enabled: boolean;
  icon: string;
}

export interface iStreamMessage {
  type: "text" | "tool_calls" | "tool_result" | "error" | "chat_info" | "message_info";
  content:
    | iTextContent
    | iErrorContent
    | iToolCallsContent
    | iToolResultContent
    | iChatInfoContent
    | iMessageInfoContent;
}

export type iTextContent = string;
export type iErrorContent = string;
export type iToolCallsContent = {
  name: string;
  arguments: any;
}[];
export type iToolResultContent = {
  name: string;
  result: any;
};
export type iChatInfoContent = {
  id: string;
  title: string;
};

export type iMessageInfoContent = {
  userMessageId: string;
  assistantMessageId: string;
};

export interface iServerConfig {
  enabled?: boolean;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface iConfig {
  mcpServers: {
    [key: string]: iServerConfig;
  };
}

export interface iOldModelConfig {
  model_settings: ModelSettings;
}

export interface iModelConfig {
  activeProvider: string;
  enableTools: boolean;
  configs: {
    [key: string]: ModelSettings;
  };
}

export interface ModelSettings {
  // Required parameters
  model: string; // e.g., "gpt-4", "claude-3-opus-20240229"
  modelProvider: string; // e.g., "openai", "anthropic", "google-vertexai" etc.
  apiKey?: string; // API key
  configuration?: {
    baseURL: string;
  };
  // Common optional parameters
  temperature?: number; // Between 0-1, controls output randomness
  topP?: number; // Between 0-1
  maxTokens?: number; // Maximum output tokens
  // Support dynamic access
  [key: string]: string | number | undefined | { baseURL: string } | undefined;
}
