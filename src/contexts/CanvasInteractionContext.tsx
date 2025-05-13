import React, { createContext, useContext, useRef, useCallback } from "react";
// You may need to adjust this import if you move CanvasInteraction to a shared location or reimplement for frontend
// For now, we'll create a placeholder class for CanvasInteraction if not available

// Placeholder: Replace with your actual CanvasInteraction import or implementation
// class CanvasInteraction {
//   connectToChat(chatId: string) {}
// }

import { CanvasInteraction } from '../../services/utils/canvasInteraction';
import { Editor } from '@tldraw/tldraw';

type CanvasInteractionContextType = {
  getOrCreateCanvas: (chatId: string) => CanvasInteraction;
  setEditor: (chatId: string, editor: Editor) => void;
};

const CanvasInteractionContext = createContext<CanvasInteractionContextType | undefined>(undefined);

export const CanvasInteractionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const canvasMap = useRef(new Map<string, CanvasInteraction>());

  const getOrCreateCanvas = useCallback((chatId: string) => {
    if (!canvasMap.current.has(chatId)) {
      const canvas = new CanvasInteraction();
      canvasMap.current.set(chatId, canvas);
    }
    return canvasMap.current.get(chatId)!;
  }, []);

  const setEditor = useCallback((chatId: string, editor: Editor) => {
    const canvas = getOrCreateCanvas(chatId);
    canvas.setEditor(editor);
  }, [getOrCreateCanvas]);

  return (
    <CanvasInteractionContext.Provider value={{ getOrCreateCanvas, setEditor }}>
      {children}
    </CanvasInteractionContext.Provider>
  );
};

export function useCanvasInteraction() {
  const ctx = useContext(CanvasInteractionContext);
  if (!ctx) throw new Error("useCanvasInteraction must be used within CanvasInteractionProvider");
  return ctx;
} 