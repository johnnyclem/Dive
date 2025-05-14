import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Tldraw, Editor, createShapeId } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { CanvasContentData } from './CanvasStore';
import { useAtomValue } from 'jotai';
import { currentChatIdAtom } from '../../atoms/chatState';
import useCanvasStore from './CanvasStore';
import { debounce } from 'lodash';
import { CanvasToolHandler } from '../../../services/utils/canvasToolHandler';
import { CanvasInteraction } from '../../../services/utils/canvasInteraction';

interface InfiniteCanvasComponentProps {
  data: CanvasContentData;
}

const InfiniteCanvasComponent: React.FC<InfiniteCanvasComponentProps> = () => {
  const currentChatId = useAtomValue(currentChatIdAtom);
  const contentData = useCanvasStore((state) => state.contentData);
  const [persistenceKey, setPersistenceKey] = useState<string>('');
  const editorRef = useRef<Editor | null>(null);
  
  const tempIdRef = useRef<string>(Date.now().toString());
  const previousChatIdRef = useRef<string | null>(null);
  const forceNewCanvasRef = useRef<boolean>(false);
  
  const canvasInteraction = CanvasInteraction.getInstance();

  const [canvasReady, setCanvasReady] = useState(false);
  const queuedDropRef = useRef<{ text: string; timestamp: number } | null>(null);

  useEffect(() => {
    if (previousChatIdRef.current !== currentChatId) {
      if (previousChatIdRef.current && !currentChatId) {
        forceNewCanvasRef.current = true;
        tempIdRef.current = Date.now().toString();
        console.log("New chat detected, creating fresh canvas with ID:", tempIdRef.current);
      }
      previousChatIdRef.current = currentChatId;
    }
    const key = currentChatId
      ? `tldraw-chat-${currentChatId}`
      : `tldraw-temp-${tempIdRef.current}`;
    setPersistenceKey(key);
    if (editorRef.current) {
      console.log('Chat ID changed, canvas will be remounted:', currentChatId || 'new chat');
    }
  }, [currentChatId]);

  useEffect(() => {
    return () => {
      canvasInteraction.resetEditor();
      setCanvasReady(false);
      console.log("Canvas component unmounted, editor reference reset");
    };
  }, [canvasInteraction]);

  // IPC Listener for canvas read requests from the main process
  useEffect(() => {
    const handleIPCReadRequest = (_event, args: { requestId: string }) => {
      console.log(`[RendererIPC] Received canvas:read-contents-request-from-main for ID: ${args.requestId}`);
      const responseChannel = `canvas-read-response-${args.requestId}`;
      try {
        const ciInstance = CanvasInteraction.getInstance(); // Ensure we use the singleton
        if (!ciInstance.isEditorReady()) {
          console.error('[RendererIPC] Canvas editor not ready when read request received.');
          throw new Error('Canvas editor not ready in renderer.');
        }
        const contents = ciInstance.readCanvasContents();
        console.log(`[RendererIPC] Sending success response on ${responseChannel} with ${contents.length} elements.`);
        window.electron.ipcRenderer.send(responseChannel, { success: true, data: contents });
      } catch (error) {
        console.error('[RendererIPC] Error reading canvas contents for IPC request:', error);
        window.electron.ipcRenderer.send(responseChannel, { success: false, error: error.message });
      }
    };

    if (window.electron && window.electron.ipcRenderer) {
      console.log("[RendererIPC] Setting up listener for 'canvas:read-contents-request-from-main'");
      window.electron.ipcRenderer.on('canvas:read-contents-request-from-main', handleIPCReadRequest);
    } else {
      console.error("[RendererIPC] window.electron.ipcRenderer not available to set up canvas read listener.");
    }

    return () => {
      if (window.electron && window.electron.ipcRenderer) {
        console.log("[RendererIPC] Cleaning up listener for 'canvas:read-contents-request-from-main'");
        window.electron.ipcRenderer.off('canvas:read-contents-request-from-main', handleIPCReadRequest);
        // Note: For 'off' to work correctly with named functions, the exact same function reference must be passed.
        // If handleIPCReadRequest was defined inline in .on(), this .off() wouldn't work as expected without storing the ref.
      }
    };
  }, []); // Empty dependency array: setup on mount, cleanup on unmount

  useEffect(() => {
    if (
      editorRef.current &&
      contentData.droppedText &&
      contentData.timestamp
    ) {
      if (!canvasReady) {
        queuedDropRef.current = {
          text: contentData.droppedText,
          timestamp: contentData.timestamp,
        };
        return;
      }
      const { width, height } = editorRef.current.getViewportPageBounds();
      const point = {
        x: width / 2,
        y: height / 2,
      };
      try {
        canvasInteraction.drawPrimitiveOnCanvas(
          'rectangle',
          point,
          {
            color: 'yellow',
            text: contentData.droppedText,
            size: { width: 200, height: 100 },
          }
        );
      } catch (err) {
        console.error('Failed to use CanvasInteraction:', err);
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
      queuedDropRef.current = null;
    }
  }, [contentData.droppedText, contentData.timestamp, canvasReady, currentChatId, canvasInteraction]);

  useEffect(() => {
    if (canvasReady && queuedDropRef.current && editorRef.current) {
      const { text } = queuedDropRef.current; // timestamp was unused
      const { width, height } = editorRef.current.getViewportPageBounds();
      const point = {
        x: width / 2,
        y: height / 2,
      };
      try {
        canvasInteraction.drawPrimitiveOnCanvas(
          'rectangle',
          point,
          {
            color: 'yellow',
            text,
            size: { width: 200, height: 100 },
          }
        );
      } catch (err) {
        console.error('Failed to use CanvasInteraction (queued):', err);
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
            text,
            fill: 'solid',
          },
        });
      }
      queuedDropRef.current = null;
    }
  }, [canvasReady, canvasInteraction]);

  const debouncedSave = useCallback(
    debounce(() => {
      console.log('Canvas state auto-saved for chat:', currentChatId || 'new chat', 'with key:', persistenceKey);
    }, 1000),
    [persistenceKey, currentChatId]
  );

  const handleMount = useCallback((editor: Editor) => {
    console.log("TLDraw mounted for chat:", currentChatId || 'new chat', "with key:", persistenceKey);
    editorRef.current = editor;
    
    const ciInstance = CanvasInteraction.getInstance();
    ciInstance.setEditor(editor);
    CanvasToolHandler.getInstance(ciInstance);
    
    setCanvasReady(true);
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

      try {
        console.log("ATTEMPT #1: Creating note with text IN props");
        const id1 = createShapeId();
        const noteWithTextInProps: any = { // Reverted 'as any' for linter, use proper typing if possible
          id: id1,
          type: 'note',
          x: point.x,
          y: point.y,
          props: {
            text: text,
            color: isUrl ? 'yellow' : 'light-blue',
            size: 'm'
          }
        }; 
        
        console.log("Creating note shape (text IN props):", JSON.stringify(noteWithTextInProps));
        editor.mark('creating note - text IN props');
        editor.createShape(noteWithTextInProps);
        editor.select(id1);
        editor.complete();
        console.log("Note with text IN props created successfully!");
        
        console.log("ATTEMPT #2: Creating note with text at TOP level");
        const id2 = createShapeId();
        const noteWithTextAtTopLevel: any = { // Reverted 'as any' for linter, use proper typing if possible
          id: id2,
          type: 'note',
          x: point.x + 300, 
          y: point.y,
          text: text, 
          props: {
            color: isUrl ? 'yellow' : 'light-blue',
            size: 'm'
          }
        }; 
        
        console.log("Creating note shape (text at TOP level):", JSON.stringify(noteWithTextAtTopLevel));
        editor.mark('creating note - text at TOP level');
        editor.createShape(noteWithTextAtTopLevel);
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
      // canvasInteraction.resetEditor(); // This was already in the component's main unmount effect
    };
  }, [debouncedSave, currentChatId, persistenceKey, canvasInteraction]);

  const tldrawKey = currentChatId
    ? `chat-${currentChatId}`
    : `new-chat-${tempIdRef.current}-${forceNewCanvasRef.current ? 'fresh' : 'existing'}`;

  return (
    <div className="w-full h-full" style={{ position: 'relative' }}>
      <Tldraw
        key={tldrawKey}
        persistenceKey={persistenceKey}
        onMount={handleMount}
        autoFocus
        inferDarkMode
      />
      {!canvasReady && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(30,30,30,0.7)',
            zIndex: 10
          }}
        >
          <span style={{ color: '#fff' }}>Loading canvas...</span>
        </div>
      )}
    </div>
  );
};

export default InfiniteCanvasComponent;