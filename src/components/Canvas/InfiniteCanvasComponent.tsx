import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Tldraw, Editor, createShapeId, TLNoteShape } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { CanvasContentData } from './CanvasStore';
import { useAtomValue } from 'jotai';
import { currentChatIdAtom } from '../../atoms/chatState';
import useCanvasStore from './CanvasStore';
import { debounce } from 'lodash';
// Import the CanvasInteraction class
import { CanvasInteraction } from '../../../services/utils/canvasInteraction';

interface InfiniteCanvasComponentProps {
  // data prop might be deprecated if we solely rely on chatStore
  data: CanvasContentData;
}

const InfiniteCanvasComponent: React.FC<InfiniteCanvasComponentProps> = () => {
  const currentChatId = useAtomValue(currentChatIdAtom);
  const contentData = useCanvasStore((state) => state.contentData);
  const [persistenceKey, setPersistenceKey] = useState<string>('');
  const editorRef = useRef<Editor | null>(null);
  
  // Use a ref to track if this is a new instance to ensure a unique temp key
  const tempIdRef = useRef<string>(Date.now().toString());
  const previousChatIdRef = useRef<string | null>(null);
  const forceNewCanvasRef = useRef<boolean>(false);
  
  // Get CanvasInteraction instance
  const canvasInteraction = CanvasInteraction.getInstance();

  // Set persistence key when chat ID changes
  useEffect(() => {
    // Check if we switched to a new chat or cleared the chat ID (new chat)
    if (previousChatIdRef.current !== currentChatId) {
      // If we switched from a chat to a new chat (empty chatId), force new canvas
      if (previousChatIdRef.current && !currentChatId) {
        forceNewCanvasRef.current = true;
        // Generate a new temp ID for the new chat to ensure a fresh canvas
        tempIdRef.current = Date.now().toString();
        console.log("New chat detected, creating fresh canvas with ID:", tempIdRef.current);
      }

      previousChatIdRef.current = currentChatId;
    }

    // For a chat with ID, use that ID for persistence
    // For a new chat without ID, use a unique temporary key
    const key = currentChatId
      ? `tldraw-chat-${currentChatId}`
      : `tldraw-temp-${tempIdRef.current}`;

    setPersistenceKey(key);

    // Force a remount of the Tldraw component by changing the key
    if (editorRef.current) {
      console.log('Chat ID changed, canvas will be remounted:', currentChatId || 'new chat');
    }
  }, [currentChatId]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      // Reset the canvas interaction when component unmounts
      canvasInteraction.resetEditor();
      console.log("Canvas component unmounted, editor reference reset");
    };
  }, []);

  // Handle dropped text when contentData changes
  useEffect(() => {
    if (editorRef.current && contentData.droppedText && contentData.timestamp) {
      if (!canvasInteraction.isInitialized()) {
        canvasInteraction.setEditor(editorRef.current);
      }
      
      // Get the center of the viewport
      const { width, height } = editorRef.current.getViewportPageBounds();
      const point = {
        x: width / 2,
        y: height / 2,
      };

      // Create a note shape with the dropped text through CanvasInteraction
      try {
        canvasInteraction.drawPrimitiveOnCanvas(
          'rectangle', 
          point, 
          {
            color: 'yellow',
            text: contentData.droppedText,
            size: { width: 200, height: 100 }
          }
        );
      } catch (err) {
        console.error("Failed to use CanvasInteraction:", err);
        // If CanvasInteraction fails, fallback to direct method
        const editor = editorRef.current;
        editor.createShape({
          id: createShapeId(),
          type: 'geo',
          x: point.x,
          y: point.y,
          props: {
            geo: 'rectangle',
            color: 'yellow',
            size: 'l',
            text: contentData.droppedText,
            fill: 'solid',
          },
        });
      }
    }
  }, [contentData.droppedText, contentData.timestamp]);

  // Debounced function - no longer needs to explicitly save if relying on tldraw persistence
  const debouncedSave = useCallback(
    debounce(() => {
      // tldraw automatically persists changes to localStorage based on persistenceKey
      console.log('Canvas state auto-saved for chat:', currentChatId || 'new chat', 'with key:', persistenceKey);
    }, 1000),
    [persistenceKey, currentChatId]
  );

  // Callback for when the editor mounts
  const handleMount = useCallback((editor: Editor) => {
    console.log("TLDraw mounted for chat:", currentChatId || 'new chat', "with key:", persistenceKey);
    editorRef.current = editor;
    
    canvasInteraction.setEditor(editor);
    console.log("Canvas interaction connected to editor");

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const text = e.dataTransfer?.getData('text/plain');
      if (!text) return;

      const point = editor.screenToPage({
        x: e.clientX,
        y: e.clientY,
      });

      const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
      const isUrl = urlRegex.test(text);

      console.log(`Attempting to create a note for dropped ${isUrl ? 'URL' : 'text'}: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);

      // Skip custom CanvasInteraction for debugging purposes
      // This direct approach enables us to test exactly how notes should be created
      try {
        console.log("ATTEMPT #1: Creating note with text IN props");
        const id1 = createShapeId();
        // Use type assertion to bypass TypeScript checking
        const noteWithTextInProps = {
          id: id1,
          type: 'note',
          x: point.x,
          y: point.y,
          props: {
            text: text,
            color: isUrl ? 'yellow' : 'light-blue',
            size: 'm'
          }
        } as any; // Type assertion to bypass TS checking
        
        console.log("Creating note shape (text IN props):", JSON.stringify(noteWithTextInProps));
        editor.mark('creating note - text IN props');
        editor.createShape(noteWithTextInProps);
        editor.select(id1);
        editor.complete();
        console.log("Note with text IN props created successfully!");
        
        // If the first attempt works, we can return here
        // But for debugging, let's try the other approach in a separate position
        
        console.log("ATTEMPT #2: Creating note with text at TOP level");
        const id2 = createShapeId();
        // Try alternative structure with text at top level
        const noteWithTextAtTopLevel = {
          id: id2,
          type: 'note',
          x: point.x + 300, // Offset position for clarity
          y: point.y,
          text: text, // Text at TOP LEVEL
          props: {
            color: isUrl ? 'yellow' : 'light-blue',
            size: 'm'
          }
        } as any; // Type assertion to bypass TS checking
        
        console.log("Creating note shape (text at TOP level):", JSON.stringify(noteWithTextAtTopLevel));
        editor.mark('creating note - text at TOP level');
        editor.createShape(noteWithTextAtTopLevel);
        // Uncomment the following lines to select the second note instead
        // editor.select(id2);
        // editor.complete();
        console.log("Note with text at TOP level created successfully!");
      } catch (err) {
        console.error("Error creating notes:", err);
      }
    };

    const container = editor.getContainer();
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });

    const handleChange = () => {
      debouncedSave();
    };
    editor.on('change', handleChange);

    return () => {
      console.log("Cleaning up Tldraw editor instance for key:", persistenceKey);
      container.removeEventListener('drop', handleDrop);
      container.removeEventListener('dragover', (e) => { 
        e.preventDefault(); 
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
      });
      editor.off('change', handleChange);
      canvasInteraction.resetEditor();
    };
  }, [debouncedSave, currentChatId, persistenceKey, canvasInteraction]);

  // useEffect for top-level component unmount cleanup (might be redundant now but safe)
  useEffect(() => {
    return () => {
      // This resetEditor call might be redundant if handleMount cleanup always fires,
      // but it's a safeguard for the entire InfiniteCanvasComponent unmounting.
      console.log("InfiniteCanvasComponent unmounting, attempting resetEditor as safeguard.");
      canvasInteraction.resetEditor();
    };
  }, [canvasInteraction]); // Depends only on canvasInteraction instance

  // Generate a unique key for both the component and the persistence to ensure proper remounting
  // For existing chats, use the chat ID
  // For new chats, use a unique temporary ID that changes each time a new chat is created
  const tldrawKey = currentChatId
    ? `chat-${currentChatId}`
    : `new-chat-${tempIdRef.current}-${forceNewCanvasRef.current ? 'fresh' : 'existing'}`;

  return (
    <div className="w-full h-full">
      <Tldraw
        key={tldrawKey} // Force re-mount on chat change with a truly unique key
        persistenceKey={persistenceKey} // Let tldraw handle load/save via this key
        onMount={handleMount}
        autoFocus
        inferDarkMode
      />
    </div>
  );
};

export default InfiniteCanvasComponent;