import React, { createContext, useState, useContext, useEffect } from 'react';

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface KnowledgeBaseContextType {
  knowledgeBases: KnowledgeBase[];
  activeKnowledgeBase: KnowledgeBase | null;
  isLoading: boolean;
  setActiveKnowledgeBase: (kb: KnowledgeBase | null) => void;
  refreshKnowledgeBases: () => Promise<KnowledgeBase[]>;
  importDocumentToActiveKnowledgeBase: (filePath: string) => Promise<boolean>;
}

const KnowledgeBaseContext = createContext<KnowledgeBaseContextType | undefined>(undefined);

export const KnowledgeBaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [activeKnowledgeBase, setActiveKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshKnowledgeBases = async (): Promise<KnowledgeBase[]> => {
    setIsLoading(true);
    try {
      const bases = await window.electron.ipcRenderer.invoke('knowledge:list') as KnowledgeBase[];
      setKnowledgeBases(bases);
      
      // If there's no active knowledge base but we have knowledge bases, set the first one as active
      if (!activeKnowledgeBase && bases.length > 0) {
        setActiveKnowledgeBase(bases[0]);
      }
      
      return bases;
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const importDocumentToActiveKnowledgeBase = async (filePath: string): Promise<boolean> => {
    if (!activeKnowledgeBase) {
      console.error('No active knowledge base');
      return false;
    }

    setIsLoading(true);
    try {
      const processResult = await window.electron.ipcRenderer.invoke(
        'document:process', 
        filePath, 
        activeKnowledgeBase.id
      );
      
      return processResult?.success || false;
    } catch (error) {
      console.error('Failed to import document:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Load knowledge bases on mount
  useEffect(() => {
    refreshKnowledgeBases();
  }, []);

  return (
    <KnowledgeBaseContext.Provider
      value={{
        knowledgeBases,
        activeKnowledgeBase,
        isLoading,
        setActiveKnowledgeBase,
        refreshKnowledgeBases,
        importDocumentToActiveKnowledgeBase
      }}
    >
      {children}
    </KnowledgeBaseContext.Provider>
  );
};

export const useKnowledgeBase = (): KnowledgeBaseContextType => {
  const context = useContext(KnowledgeBaseContext);
  if (context === undefined) {
    throw new Error('useKnowledgeBase must be used within a KnowledgeBaseProvider');
  }
  return context;
}; 