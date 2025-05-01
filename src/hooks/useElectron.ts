import { useEffect, useState } from 'react';

type IpcRenderer = {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, listener: (...args: any[]) => void) => void;
  removeListener: (channel: string, listener: (...args: any[]) => void) => void;
  port: () => Promise<number>;
  getPlatform: () => Promise<string>;
  showSelectionContextMenu: () => void;
  showInputContextMenu: () => void;
};

type KnowledgeAPI = {
  createCollection: (name: string, description?: string) => Promise<any>;
  listCollections: () => Promise<any[]>;
  listFiles: (knowledgeBaseId: number) => Promise<any[]>;
  getChunks: (knowledgeBaseId: number) => Promise<any[]>;
  importFile: ({ file, collectionId }: { file: any, collectionId: string }) => Promise<any>;
  selectFiles: () => Promise<any>;
  removeFile: (fileId: string) => Promise<boolean>;
};

type EmbeddingsAPI = {
  getModelFileStatus: () => Promise<{ [key: string]: boolean }>;
  removeModel: () => Promise<void>;
  saveModelFile: (fileName: string, filePath: string) => Promise<void>;
};

/**
 * Hook to access Electron API in React components
 * 
 * @returns Object containing Electron API interfaces
 */
export const useElectron = () => {
  const [api, setApi] = useState({
    ipc: null as IpcRenderer | null,
    knowledge: null as KnowledgeAPI | null,
    embeddings: null as EmbeddingsAPI | null
  });

  useEffect(() => {
    // Check if running in Electron and initialize API
    if (typeof window !== 'undefined' && 'electron' in window) {
      setApi({
        ipc: window.electron?.ipcRenderer || null,
        knowledge: window.electron?.knowledge || null,
        embeddings: window.electron?.embeddings || null
      });
    }
  }, []);

  return api;
};

// Add type for window.electron
declare global {
  interface Window {
    electron?: {
      ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
        on: (channel: string, listener: (...args: unknown[]) => void) => void;
        removeListener: (channel: string, listener: (...args: unknown[]) => void) => void;
        port: () => Promise<number>;
        getPlatform: () => Promise<string>;
        showSelectionContextMenu: () => void;
        showInputContextMenu: () => void;
      };
    };
    PLATFORM?: 'darwin' | 'win32' | 'linux';
  }
} 