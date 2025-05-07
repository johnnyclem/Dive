export const EMPTY_PROVIDER = "none"

export type BaseProvider = "openai" | "ollama" | "anthropic" | "mistralai" | "bedrock"
export type ModelProvider = BaseProvider | "google-genai"
export type InterfaceProvider = BaseProvider | "openai_compatible" | "google_genai" | "venice"
export const PROVIDERS: InterfaceProvider[] = ["openai", "openai_compatible", "ollama", "anthropic", "google_genai", "mistralai", "bedrock", "venice"] as const

export const PROVIDER_LABELS: Record<InterfaceProvider, string> = {
  openai: "OpenAI",
  openai_compatible: "OpenAI Compatible",
  ollama: "Ollama",
  anthropic: "Anthropic",
  google_genai: "Google Gemini",
  mistralai: "Mistral AI",
  bedrock: "AWS Bedrock",
  venice: "Venice",
}

export const PROVIDER_ICONS: Record<InterfaceProvider, string> = {
  ollama: "img://model_ollama.svg",
  openai_compatible: "img://model_openai_compatible.svg",
  openai: "img://model_openai.svg",
  anthropic: "img://model_anthropic.svg",
  google_genai: "img://model_gemini.svg",
  mistralai: "img://model_mistral-ai.svg",
  bedrock: "img://model_bedrock.svg",
  venice: "img://model_openai_compatible.svg",
}

export type InputType = "text" | "password"

export interface FieldDefinition {
  type: string | "list"
  inputType?: InputType
  description: string
  required: boolean
  default: string | number | boolean | null
  placeholder?: string | number | boolean | null
  label: string
  listCallback?: (deps: Record<string, string>) => Promise<string[]>
  listDependencies?: string[]
}

// Define interfaces for IPC responses and model items
interface RawModelListItem {
  id: string;
  name?: string;
}

interface RawIpcModelListResponse {
  models?: RawModelListItem[];
  // 'results' can be string[] as hinted by linter, or another format.
  // We will prioritize 'models' and handle it carefully.
  results?: RawModelListItem[] | string[]; 
  error?: string;
}

export type InterfaceDefinition = Record<string, FieldDefinition>

export const defaultInterface: Record<InterfaceProvider, InterfaceDefinition> = {
  openai: {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "OpenAI API Key",
      required: true,
      default: "",
      placeholder: "YOUR_API_KEY"
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        if (window.electron?.ipcRenderer?.openaiModelList) {
          const resp = await window.electron.ipcRenderer.openaiModelList(deps.apiKey) as RawIpcModelListResponse;
          if (resp.error) throw new Error(resp.error);
          const modelItems = resp.models;
          if (modelItems) {
            return modelItems.map((m: RawModelListItem) => m.name || m.id).filter(Boolean);
          }
          // Fallback or alternative handling for resp.results if necessary and if its structure is known
          // For now, assume 'models' is the primary source or return empty if not found.
          return []; 
        }
        const response = await fetch('/api/v1/models');
        const json = await response.json() as { success: boolean; data: Array<{ id: string }>; message?: string };
        if (!json.success) throw new Error(json.message || 'Failed to fetch models');
        return json.data.map(m => m.id);
      },
      listDependencies: ["apiKey"]
    }
  },
  openai_compatible: {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "",
      required: false,
      default: "",
      placeholder: "YOUR_API_KEY"
    },
    baseURL: {
      type: "string",
      inputType: "text",
      label: "Base URL",
      description: "Base URL for API calls",
      required: false,
      default: "",
      placeholder: ""
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Default model",
      listCallback: async (deps) => {
        if (window.electron?.ipcRenderer?.openaiCompatibleModelList) {
          const resp = await window.electron.ipcRenderer.openaiCompatibleModelList(deps.apiKey, deps.baseURL) as RawIpcModelListResponse;
          if (resp.error) throw new Error(resp.error);
          const modelItems = resp.models;
          if (modelItems) {
            return modelItems.map((m: RawModelListItem) => m.name || m.id).filter(Boolean);
          }
          return [];
        }
        const response = await fetch('/api/v1/models');
        const json = await response.json() as { success: boolean; data: Array<{ id: string }>; message?: string };
        if (!json.success) throw new Error(json.message || 'Failed to fetch models');
        return json.data.map(m => m.id);
      },
      listDependencies: ["apiKey", "baseURL"]
    }
  },
  venice: {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "Venice API Key (from VENICE_API_KEY env var)",
      required: true,
      default: "",
      placeholder: "Set via VENICE_API_KEY"
    },
    baseURL: {
      type: "string",
      inputType: "text",
      label: "Base URL",
      description: "Venice Endpoint (from VENICE_ENDPOINT env var)",
      required: true,
      default: "",
      placeholder: "Set via VENICE_ENDPOINT"
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model or enter custom ID",
      listCallback: async (deps) => {
        if (window.electron?.ipcRenderer?.openaiCompatibleModelList) {
          const resp = await window.electron.ipcRenderer.openaiCompatibleModelList(deps.apiKey, deps.baseURL) as RawIpcModelListResponse;
          if (resp.error) throw new Error(resp.error);
          const modelItems = resp.models;
          if (modelItems) {
            return modelItems.map((m: RawModelListItem) => m.name || m.id).filter(Boolean);
          }
          return []; 
        }
        const response = await fetch('/api/v1/models');
        const json = await response.json() as { success: boolean; data: Array<{ id: string }>; message?: string };
        if (!json.success) throw new Error(json.message || 'Failed to fetch models');
        return json.data.map(m => m.id);
      },
      listDependencies: ["apiKey", "baseURL"]
    }
  },
  ollama: {
    baseURL: {
      type: "string",
      inputType: "text",
      label: "Base URL",
      description: "Base URL for API calls",
      required: true,
      default: "http://localhost:11434",
      placeholder: "http://localhost:11434"
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescription",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        if (window.electron?.ipcRenderer?.ollamaModelList) {
          const resp = await window.electron.ipcRenderer.ollamaModelList(deps.baseURL) as RawIpcModelListResponse;
          if (resp.error) throw new Error(resp.error);
          const modelItems = resp.models;
          if (modelItems) {
            return modelItems.map((m: RawModelListItem) => m.name || m.id).filter(Boolean);
          }
          return [];
        }
        const response = await fetch('/api/v1/models');
        const json = await response.json() as { success: boolean; data: Array<{ id: string }>; message?: string };
        if (!json.success) throw new Error(json.message || 'Failed to fetch models');
        return json.data.map(m => m.id);
      },
      listDependencies: ["baseURL"]
    }
  },
  anthropic: {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "Anthropic API Key",
      required: false,
      default: "",
      placeholder: "YOUR_API_KEY"
    },
    baseURL: {
      type: "string",
      inputType: "text",
      label: "Base URL",
      description: "Base URL for API calls",
      required: false,
      default: "https://api.anthropic.com",
      placeholder: "https://api.anthropic.com"
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        if (window.electron?.ipcRenderer?.anthropicModelList) {
          const resp = await window.electron.ipcRenderer.anthropicModelList(deps.apiKey, deps.baseURL) as RawIpcModelListResponse;
          if (resp.error) throw new Error(resp.error);
          const modelItems = resp.models;
          if (modelItems) {
            return modelItems.map((m: RawModelListItem) => m.name || m.id).filter(Boolean);
          }
          return [];
        }
        const response = await fetch('/api/v1/models');
        const json = await response.json() as { success: boolean; data: Array<{ id: string }>; message?: string };
        if (!json.success) throw new Error(json.message || 'Failed to fetch models');
        return json.data.map(m => m.id);
      },
      listDependencies: ["apiKey", "baseURL"]
    }
  },
  google_genai: {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "Google Gemini API Key",
      required: false,
      default: "",
      placeholder: "YOUR_API_KEY"
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        if (window.electron?.ipcRenderer?.googleGenaiModelList) {
          const resp = await window.electron.ipcRenderer.googleGenaiModelList(deps.apiKey) as RawIpcModelListResponse;
          if (resp.error) throw new Error(resp.error);
          const modelItems = resp.models;
          if (modelItems) {
            return modelItems.map((m: RawModelListItem) => m.name || m.id).filter(Boolean);
          }
          return [];
        }
        const response = await fetch('/api/v1/models');
        const json = await response.json() as { success: boolean; data: Array<{ id: string }>; message?: string };
        if (!json.success) throw new Error(json.message || 'Failed to fetch models');
        return json.data.map(m => m.id);
      },
      listDependencies: ["apiKey"]
    }
  },
  mistralai: {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "Mistral AI API Key",
      required: false,
      default: "",
      placeholder: "YOUR_API_KEY"
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        if (window.electron?.ipcRenderer?.mistralaiModelList) {
          const resp = await window.electron.ipcRenderer.mistralaiModelList(deps.apiKey) as RawIpcModelListResponse;
          if (resp.error) throw new Error(resp.error);
          const modelItems = resp.models;
          if (modelItems) {
            return modelItems.map((m: RawModelListItem) => m.name || m.id).filter(Boolean);
          }
          return [];
        }
        const response = await fetch('/api/v1/models');
        const json = await response.json() as { success: boolean; data: Array<{ id: string }>; message?: string };
        if (!json.success) throw new Error(json.message || 'Failed to fetch models');
        return json.data.map(m => m.id);
      },
      listDependencies: ["apiKey"]
    }
  },
  bedrock: {
    accessKeyId: {
      type: "string",
      inputType: "password",
      label: "AWS Access Key ID",
      description: "",
      required: true,
      default: "",
      placeholder: "YOUR_AWS_ACCESS_KEY_ID"
    },
    secretAccessKey: {
      type: "string",
      inputType: "password",
      label: "AWS Secret Access Key",
      description: "",
      required: true,
      default: "",
      placeholder: "YOUR_AWS_SECRET_ACCESS_KEY"
    },
    sessionToken: {
      type: "string",
      inputType: "password",
      label: "AWS Session Token",
      description: "",
      required: false,
      default: "",
      placeholder: "YOUR_AWS_SESSION_TOKEN"
    },
    region: {
      type: "string",
      inputType: "text",
      label: "Region",
      description: "",
      required: false,
      placeholder: "e.g. us-east-1",
      default: "us-east-1",
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        if (window.electron?.ipcRenderer?.bedrockModelList) {
          const resp = await window.electron.ipcRenderer.bedrockModelList(deps.accessKeyId, deps.secretAccessKey, deps.sessionToken, deps.region) as RawIpcModelListResponse;
          if (resp.error) throw new Error(resp.error);
          const modelItems = resp.models;
          if (modelItems) {
            return modelItems.map((m: RawModelListItem) => m.name || m.id).filter(Boolean);
          }
          return [];
        }
        const response = await fetch('/api/v1/models');
        const json = await response.json() as { success: boolean; data: Array<{ id: string }>; message?: string };
        if (!json.success) throw new Error(json.message || 'Failed to fetch models');
        return json.data.map(m => m.id);
      },
      listDependencies: ["accessKeyId", "secretAccessKey", "sessionToken", "region"]
    },
    customModelId: {
      type: "string",
      label: "Custom Model ID",
      description: "",
      required: true,
      default: ""
    }
  }
}
