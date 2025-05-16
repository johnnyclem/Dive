import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Tldraw, Editor, createShapeId, TLShape, TLNoteShapeProps } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { CanvasContentData } from './CanvasStore';
import { useAtomValue } from 'jotai';
import { currentChatIdAtom } from '../../atoms/chatState';
import useCanvasStore from './CanvasStore';
import { debounce } from 'lodash';
import { CanvasToolHandler } from '../../../services/utils/canvasToolHandler';
import { CanvasInteraction, CanvasPosition, CanvasSize } from '../../../services/utils/canvasInteraction';

interface InfiniteCanvasComponentProps {
  data: CanvasContentData;
}

// Define a type for image add options
interface ImageAddOptions {
  size?: CanvasSize;
  rotation?: number;
  fileName?: string;
  mimeType?: string;
}

// Define a type for the queued image arguments
interface QueuedImageAddArgs {
  imageDataUrl: string;
  position?: CanvasPosition; // Updated type
  options?: ImageAddOptions;  // Updated type
  requestId: string;
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
  const queuedImageAddsRef = useRef<Array<{ args: QueuedImageAddArgs }>>([]); // Queue for image add requests

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

  // Original IPC Listener for canvas read requests - separated for clarity and correct lifecycle
  useEffect(() => {
    const handleIPCReadRequest = (_event: unknown, args: { requestId: string }) => {
      console.log(`[RendererIPC] Received canvas:read-contents-request-from-main for ID: ${args.requestId}`);
      const responseChannel = `canvas-read-response-${args.requestId}`;
      try {
        const ciInstance = CanvasInteraction.getInstance();
        if (!ciInstance.isEditorReady()) {
          console.error('[RendererIPC] Canvas editor not ready when read request received.');
          throw new Error('Canvas editor not ready in renderer for read.');
        }
        const contents = ciInstance.readCanvasContents();
        console.log(`[RendererIPC] Sending success response on ${responseChannel} with ${contents.length} elements.`);
        window.electron.ipcRenderer.send(responseChannel, { success: true, data: contents });
      } catch (error) {
        console.error('[RendererIPC] Error reading canvas contents for IPC request:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error reading canvas in renderer.';
        window.electron.ipcRenderer.send(responseChannel, { success: false, error: errorMessage });
      }
    };

    if (window.electron && window.electron.ipcRenderer) {
      console.log("[RendererIPC] Setting up listener for 'canvas:read-contents-request-from-main'");
      const ipcR = window.electron.ipcRenderer; // Capture ipcRenderer instance
      ipcR.on('canvas:read-contents-request-from-main', handleIPCReadRequest);
      
      return () => {
        if (ipcR) { // Check if ipcR was defined before trying to use it
          console.log("[RendererIPC] Cleaning up listener for 'canvas:read-contents-request-from-main'");
          ipcR.off('canvas:read-contents-request-from-main', handleIPCReadRequest);
        }
      };
    } else {
      console.error("[RendererIPC] window.electron.ipcRenderer not available to set up canvas read listener at this time.");
    }
    return undefined; // Explicitly return undefined if listener not set up, consistent with no cleanup needed
  }, [window.electron?.ipcRenderer]); // Dependency added here

  // IPC Listener for canvas add image requests from the main process
  useEffect(() => {
    // IPC Listener for canvas add image requests from the main process
    let imageAddHandler: ((_event: unknown, args: QueuedImageAddArgs) => Promise<void>) | null = null;

    if (window.electron && window.electron.ipcRenderer) {
      console.log("[RendererIPC] Setting up listener for 'canvas:add-image-request-from-main'");
      const ipcR = window.electron.ipcRenderer; // Capture for cleanup
      imageAddHandler = async (_event: unknown, args: QueuedImageAddArgs) => {
        const { requestId } = args;
        const responseChannel = `canvas:add-image-response-from-renderer-${requestId}`;
        const canvasInteraction = CanvasInteraction.getInstance();

        if (!canvasReady || !canvasInteraction.isEditorReady()) {
          console.log('[RendererIPC] Add image request received, but canvas not fully ready. Queueing:', args.requestId);
          queuedImageAddsRef.current.push({ args });
          return;
        }

        console.log('[RendererIPC] Processing add-image request immediately:', args.requestId);
        try {
          const canvasElement = canvasInteraction.insertGeneratedImage(
            args.imageDataUrl,
            args.position,
            args.options
          );
          ipcR.send(responseChannel, { success: true, data: canvasElement });
        } catch (error) {
          console.error('Error adding image to canvas in renderer (direct processing):', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error in renderer while adding image';
          ipcR.send(responseChannel, { success: false, error: errorMessage });
        }
      };
      ipcR.on('canvas:add-image-request-from-main', imageAddHandler);

      return () => {
        if (ipcR && imageAddHandler) {
          console.log("[RendererIPC] Cleaning up listener for 'canvas:add-image-request-from-main'");
          ipcR.off('canvas:add-image-request-from-main', imageAddHandler);
        }
      };
    } else {
      console.error("[RendererIPC] window.electron.ipcRenderer not available to set up canvas add image listener.");
    }
    return undefined;
  }, [window.electron?.ipcRenderer]); // Dependency added here

  // New useEffect to process queued image add requests when canvas becomes ready
  useEffect(() => {
    if (canvasReady && editorRef.current) { // editorRef.current check ensures Tldraw onMount has run
      const queue = queuedImageAddsRef.current;
      if (queue.length > 0) {
        console.log(`[RendererIPC] Canvas is ready. Processing ${queue.length} queued image add requests.`);
        const requestsToProcess = [...queue];
        queuedImageAddsRef.current = []; // Clear queue immediately

        requestsToProcess.forEach(requestItem => {
          const { args } = requestItem;
          const { imageDataUrl, position, options, requestId } = args;
          const responseChannel = `canvas:add-image-response-from-renderer-${requestId}`;
          try {
            const canvasInteraction = CanvasInteraction.getInstance();
            // Double check readiness, though it should be true here
            if (!canvasInteraction.isEditorReady()) {
                 console.error('[RendererIPC] Queued image: Editor still not ready! This should not happen.');
                 window.electron.ipcRenderer.send(responseChannel, { success: false, error: 'Editor not ready even after queue' });
                 return; // Skip this request
            }
            console.log('[RendererIPC] Processing queued add-image request:', requestId);
            const canvasElement = canvasInteraction.insertGeneratedImage(imageDataUrl, position, options);
            window.electron.ipcRenderer.send(responseChannel, { success: true, data: canvasElement });
          } catch (error) {
            console.error('[RendererIPC] Error processing queued image add:', requestId, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error processing queued image';
            window.electron.ipcRenderer.send(responseChannel, { success: false, error: errorMessage });
          }
        });
      }
    }
  }, [canvasReady]); // Dependency: runs when canvasReady changes

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
        const noteWithTextInProps: Partial<TLShape> & { type: 'note', props: Partial<TLNoteShapeProps> & { text: string } } = {
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
        
        console.log("ATTEMPT #2: Creating note with text at TOP level (corrected to be in props)");
        const id2 = createShapeId();
        const noteWithTextAlsoInProps: Partial<TLShape> & { type: 'note', props: Partial<TLNoteShapeProps> & { text: string } } = {
          id: id2,
          type: 'note',
          x: point.x + 300, 
          y: point.y,
          props: {
            text: text, 
            color: isUrl ? 'yellow' : 'light-blue',
            size: 'm'
          }
        }; 
        
        console.log("Creating note shape (text also IN props):", JSON.stringify(noteWithTextAlsoInProps));
        editor.mark('creating note - text also IN props');
        editor.createShape(noteWithTextAlsoInProps);
        console.log("Note with text also IN props created successfully!");
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