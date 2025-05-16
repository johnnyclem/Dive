/**
 * Canvas Interaction Utility Class
 * 
 * Handles interactions with the canvas component including drawing,
 * adding images, zooming and other operations.
 * Now connected to TLDraw for actual functionality.
 */

import { Editor, TLShape, createShapeId, TLGeoShape, TLImageShape, TLArrowShape, TLImageAsset, TLDefaultColorStyle, TLAssetId, TLBookmarkShape } from '@tldraw/tldraw';

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasPrimitive {
  type: string;
  position: CanvasPosition;
  size?: CanvasSize;
  radius?: number;
  text?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  fillOpacity?: number;
  rotation?: number;
  points?: CanvasPosition[]; // For polygons/lines
}

export interface CanvasImage {
  src: string;
  position: CanvasPosition;
  size?: CanvasSize;
  rotation?: number;
}

export interface CanvasURL {
  url: string;
  position: CanvasPosition;
  title?: string;
  description?: string;
  imageSrc?: string;
  text?: string;
}

// Define interfaces for richText structure
interface RichTextContentItem {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>; // Can be further specified if needed
  content?: RichTextContentItem[];
}

interface RichTextRoot {
  type: string;
  content?: RichTextContentItem[];
}

interface TLBookmarkProps {
  src?: string;
  title?: string;
  description?: string;
  assetId?: TLAssetId;
  url?:string;
}

export interface CanvasElement {
  id: string;
  type: 'primitive' | 'image' | 'url';
  data: CanvasPrimitive | CanvasImage | CanvasURL;
}

// Map of colors to TLDraw color values
const COLOR_MAP: Record<string, TLDefaultColorStyle> = {
  'black': 'black',
  'blue': 'blue',
  'green': 'green',
  'gray': 'grey',
  'grey': 'grey',
  'orange': 'orange',
  'pink': 'light-red',
  'purple': 'violet',
  'red': 'red',
  'white': 'white',
  'yellow': 'yellow',
  'indigo': 'light-violet',
  'cyan': 'light-blue',
  'teal': 'green',
  'lime': 'light-green'
};

// Implementation that now connects to TLDraw editor
export class CanvasInteraction {
  private static instance: CanvasInteraction | null = null;
  private _debugId = Math.random().toString(36).substring(2, 10);
  private editorRef: Editor | null = null;
  private initialized = false;

  private constructor() {
    console.log(`[CanvasInteraction] Created new instance`, this._debugId);
  }

  public static getInstance(): CanvasInteraction {
    if (!CanvasInteraction.instance) {
      CanvasInteraction.instance = new CanvasInteraction();
    }
    console.log('[CanvasInteraction] getInstance:', CanvasInteraction.instance._debugId);
    return CanvasInteraction.instance;
  }

  /**
   * Check if the editor is initialized
   */
  public isInitialized(): boolean {
    const result = this.initialized && this.editorRef !== null;
    if (!result && this.editorRef) {
      console.log("have editor but not initialized");
      this.setEditor(this.editorRef);
      const newResult = this.initialized && this.editorRef !== null;
      return newResult;
    };
    console.log(`[CanvasInteraction] isInitialized called: ${result}`);
    return result;
  }

  /**
   * Set the TLDraw editor reference
   */
  public setEditor(editor: Editor): void {
    if (!editor) {
      console.error('[CanvasInteraction] Attempted to set null editor');
      return;
    }
    this.editorRef = editor;
    this.initialized = true;
    console.log(`[CanvasInteraction] Editor initialized successfully`);
  }

  /**
   * Check if the editor is ready for operations
   */
  public isEditorReady(): boolean {
    if (!this.editorRef) {
      console.log('[CanvasInteraction] Editor reference is null');
      return false;
    }
    if (!this.initialized) {
      console.log('[CanvasInteraction] Editor not initialized');
      return false;
    }
    try {
      // Try a simple operation to verify editor is ready
      this.editorRef.getViewportPageBounds();
      return true;
    } catch (error) {
      console.error('[CanvasInteraction] Editor check failed:', error);
      return false;
    }
  }

  /**
   * Reset the editor reference (useful when the editor is unmounted)
   */
  public resetEditor(): void {
    this.editorRef = null;
    this.initialized = false;
    console.log('TLDraw editor reference reset in CanvasInteraction');
  }

  /**
   * Get the TLDraw editor reference
   */
  private getEditor(): Editor {
    if (!this.isEditorReady()) {
      throw new Error('TLDraw editor not ready for operations');
    }
    return this.editorRef!;
  }

  /**
   * Map a color string to a TLDraw color
   */
  private mapColor(color: string | undefined): TLDefaultColorStyle {
    if (!color) return 'black';
    
    const lowerColor = color.toLowerCase() as keyof typeof COLOR_MAP;
    return COLOR_MAP[lowerColor] || 'black';
  }

  /**
   * Map a shape type to TLDraw geo type
   */
  private mapGeoType(type: string): "rectangle" | "triangle" | "ellipse" {
    switch(type) {
      case 'circle':
        return 'ellipse';
      case 'square':
      case 'rectangle':
        return 'rectangle';
      case 'triangle':
        return 'triangle';
      default:
        return 'rectangle';
    }
  }

  /**
   * Draw on the canvas at a specific position
   */
  public drawOnCanvas(position: CanvasPosition, color: string = '#000000', size: number = 2): CanvasElement {
    const editor = this.getEditor();
    const id = createShapeId();
    
    // Create a line shape (using drawShape is simpler than complex draw tool)
    editor.createShape({
      id,
      type: 'line',
      x: position.x,
      y: position.y,
      props: {
        color: this.mapColor(color),
        size: 'm',
        // Start and end point at the same position (effectively a dot)
        handles: {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
        },
      },
    });

    return {
      id: id.toString(),
      type: 'primitive',
      data: {
        type: 'line',
        position,
        color,
        borderWidth: size
      }
    };
  }

  /**
   * Draw a primitive shape on the canvas
   */
  public drawPrimitiveOnCanvas(
    type: 'circle' | 'square' | 'rectangle' | 'triangle' | 'line' | 'arrow' | 'text',
    position: CanvasPosition,
    options: {
      size?: CanvasSize;
      radius?: number;
      text?: string;
      color?: string;
      borderColor?: string;
      borderWidth?: number;
      fillOpacity?: number;
      rotation?: number;
      points?: CanvasPosition[];
    } = {}
  ): CanvasElement {
    const editor = this.getEditor();
    const id = createShapeId();
    
    // Map the primitive type to TLDraw shape type
    let shapeType: 'geo' | 'line' | 'arrow' | 'text' = 'geo';
    
    switch(type) {
      case 'line':
        shapeType = 'line';
        break;
      case 'arrow':
        shapeType = 'arrow';
        break;
      case 'text':
        shapeType = 'text';
        break;
      default:
        shapeType = 'geo';
    }
    
    const colorValue = this.mapColor(options.color || 'black');
    
    if (shapeType === 'geo') {
      editor.createShape<TLGeoShape>({
        id,
        type: shapeType,
        x: position.x,
        y: position.y,
        props: {
          geo: this.mapGeoType(type),
          color: colorValue,
          size: 'l',
          w: options.size?.width || 100,
          h: options.size?.height || 100,
          fill: options.fillOpacity === 0 ? 'none' : 'solid',
          dash: 'draw',
        },
      });
    } else if (shapeType === 'line') {
      editor.createShape({
        id,
        type: shapeType,
        x: position.x,
        y: position.y,
        props: {
          color: colorValue,
          size: 'l',
          points: options.points ? options.points.map(p => ({ x: p.x - position.x, y: p.y - position.y, z:0.5 })) : [{x:0,y:0,z:0.5}, {x:options.size?.width || 100, y:options.size?.height || 0, z:0.5}]
        },
      });
    } else if (shapeType === 'arrow') {
      editor.createShape<TLArrowShape>({
        id,
        type: shapeType,
        x: position.x,
        y: position.y,
        props: {
          color: colorValue,
          size: 'l',
          start: { x: 0, y: 0 },
          end: { x: options.size?.width || 100, y: options.size?.height || 0 },
        },
      });
    } else if (shapeType === 'text') {
      editor.createShape({
        id,
        type: 'text',
        x: position.x,
        y: position.y,
        props: {
          color: colorValue,
          size: 'l',
          text: options.text || 'Text',
          w: options.size?.width || 200,
          autoSize: true,
        },
      });
    }

    return {
      id: id.toString(),
      type: 'primitive',
      data: {
        type,
        position,
        ...options
      }
    };
  }

  /**
   * Add an image to the canvas
   */
  public addImageToCanvas(
    src: string,
    position: CanvasPosition,
    size?: CanvasSize,
    rotation?: number
  ): CanvasElement {
    const editor = this.getEditor();
    const imageShapeId = createShapeId();
    const assetId = createShapeId() as unknown as TLAssetId;

    const imageAsset: TLImageAsset = {
      id: assetId,
      type: 'image',
      typeName: 'asset',
      props: {
        name: src.substring(src.lastIndexOf('/') + 1) || 'image.png',
        src: src,
        w: size?.width || 200,
        h: size?.height || 200,
        mimeType: 'image/png',
        isAnimated: false,
      },
      meta: {},
    };
    editor.createAssets([imageAsset]);
    
    editor.createShape<TLImageShape>({
      id: imageShapeId,
      type: 'image',
      x: position.x,
      y: position.y,
      props: {
        w: size?.width || 200,
        h: size?.height || 200,
        assetId: assetId, 
      },
      rotation: rotation || 0,
    });

    return {
      id: imageShapeId.toString(),
      type: 'image',
      data: {
        src,
        position,
        size,
        rotation
      }
    };
  }

  /**
   * Add an image to the canvas using a data URL (e.g., base64 encoded string)
   */
  public insertGeneratedImage(
    imageDataUrl: string, // Can be a full data URI, a regular web URL, or raw base64 data
    positionInput: CanvasPosition | undefined, // Changed parameter name and type
    options: {
      size?: CanvasSize;
      rotation?: number;
      fileName?: string;
      mimeType?: string; // Important if imageDataUrl is raw base64
    } = {}
  ): CanvasElement {
    const editor = this.getEditor();
    let actualPosition: CanvasPosition;

    if (positionInput && typeof positionInput.x === 'number' && typeof positionInput.y === 'number') {
      actualPosition = positionInput;
    } else {
      try {
        const viewport = editor.getViewportPageBounds();
        actualPosition = { x: viewport.midX, y: viewport.midY };
        console.log('[CanvasInteraction] No/invalid position provided for image, defaulting to viewport center:', actualPosition);
      } catch (e) {
        console.warn('[CanvasInteraction] Could not get viewport center, defaulting image position to (100,100). Error:', e);
        actualPosition = { x: 100, y: 100 }; // Fallback default
      }
    }

    const imageShapeId = createShapeId();
    const assetId = `asset:${createShapeId()}` as TLAssetId;

    const fileName = options.fileName || 'generated_image.png';
    let effectiveMimeType = options.mimeType;
    let imageSrcForAsset: string;

    if (imageDataUrl.startsWith('data:')) {
      // Input is already a data URI
      imageSrcForAsset = imageDataUrl;
      if (!effectiveMimeType) {
        // Try to parse mimeType from the data URI if not provided in options
        const match = imageDataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
        if (match && match[1]) {
          effectiveMimeType = match[1];
        }
      }
    } else if (imageDataUrl.startsWith('http://') || imageDataUrl.startsWith('https://')) {
      // Input is a regular web URL
      imageSrcForAsset = imageDataUrl;
      // For web URLs, mimeType can often be inferred by the browser or tldraw;
      // options.mimeType will be used if provided.
    } else {
      // Assume input is raw base64 data
      // Use options.mimeType or default to 'image/png'
      effectiveMimeType = effectiveMimeType || 'image/png';
      imageSrcForAsset = `data:${effectiveMimeType};base64,${imageDataUrl}`;
    }
    
    // Ensure a mimeType is set for the asset properties, defaulting if necessary
    effectiveMimeType = effectiveMimeType || 'image/png';

    const imageAsset: TLImageAsset = {
      id: assetId,
      type: 'image',
      typeName: 'asset',
      props: {
        name: fileName,
        src: imageSrcForAsset, // Use the correctly formatted src
        w: options.size?.width || 200,
        h: options.size?.height || 200,
        mimeType: effectiveMimeType,
        isAnimated: false, // Assume not animated for generated images
      },
      meta: {},
    };
    editor.createAssets([imageAsset]);

    editor.createShape<TLImageShape>({
      id: imageShapeId,
      type: 'image',
      x: actualPosition.x, // Use actualPosition
      y: actualPosition.y, // Use actualPosition
      props: {
        w: options.size?.width || 200,
        h: options.size?.height || 200,
        assetId: assetId,
      },
      rotation: options.rotation || 0,
    });

    return {
      id: imageShapeId.toString(),
      type: 'image',
      data: {
        src: imageDataUrl, // Store the original imageDataUrl
        position: actualPosition, // Return the actual position used
        size: options.size,
        rotation: options.rotation,
      }
    };
  }

  /**
   * Add a URL to the canvas
   */
  public addURLToCanvas(
    url: string,
    position: CanvasPosition,
    title?: string,
    description?: string
  ): CanvasElement {
    const editor = this.getEditor();
    const id = createShapeId();
    
    // Create a note with URL
    editor.createShape({
      id,
      type: 'note',
      x: position.x,
      y: position.y,
      props: {
        color: 'yellow',
        size: 'l',
        text: `${title || 'Link'}\n${url}\n${description || ''}`,
      },
    });

    return {
      id: id.toString(),
      type: 'url',
      data: {
        url,
        position,
        title,
        description
      }
    };
  }

  /**
   * Read the contents of the canvas
   */
  public readCanvasContents(): CanvasElement[] {
    if (!this.isEditorReady()) {
      console.error('[CanvasInteraction] Cannot read canvas contents - editor not ready');
      return [];
    }

    try {
      const editor = this.getEditor();
      const shapes = editor.getCurrentPageShapes();
      
      if (!shapes || shapes.length === 0) {
        console.log('[CanvasInteraction] Canvas is empty');
        return [];
      }

      return shapes.map(shape => this.convertShapeToCanvasElement(shape));
    } catch (error) {
      console.error('[CanvasInteraction] Error reading canvas contents:', error);
      return [];
    }
  }

  /**
   * Find elements on the canvas matching a criteria
   */
  public findInCanvas(criteria: {
    type?: 'primitive' | 'image' | 'url';
    text?: string;
    color?: string;
  }): CanvasElement[] {
    const editor = this.getEditor();
    const shapes = editor.getCurrentPageShapesSorted();
    
    // Filter shapes based on criteria
    const filteredShapes = shapes.filter(shape => {
      // Match by shape type
      if (criteria.type === 'primitive' && 
         (shape.type === 'geo' || shape.type === 'line' || shape.type === 'arrow' || shape.type === 'text')) {
        return true;
      }
      
      if (criteria.type === 'image' && shape.type === 'image') {
        return true;
      }
      
      if (criteria.type === 'url' && shape.type === 'note') {
        // Check if the note contains a URL
        if (typeof shape.props === 'object' && shape.props !== null && 'text' in shape.props) {
          const text = shape.props.text as string;
          return text.includes('http');
        }
        return false;
      }
      
      // Match by text content
      if (criteria.text && typeof shape.props === 'object' && shape.props !== null && 'text' in shape.props) {
        const text = shape.props.text as string;
        return text.includes(criteria.text);
      }
      
      // Match by color
      if (criteria.color && typeof shape.props === 'object' && shape.props !== null && 'color' in shape.props) {
        const color = shape.props.color as string;
        return color === this.mapColor(criteria.color);
      }
      
      return false;
    });
    
    return filteredShapes.map(shape => this.convertShapeToCanvasElement(shape));
  }

  /**
   * Get a screenshot or representation of the current canvas
   */
  public seeCanvas(): string {
    const editor = this.getEditor();
    
    // Get a summary of the canvas contents
    const shapes = editor.getCurrentPageShapesSorted();
    const shapeTypes = new Set(shapes.map(s => s.type));
    
    return `Canvas contains ${shapes.length} elements (${Array.from(shapeTypes).join(', ')})`;
  }

  /**
   * Zoom in on the canvas
   */
  public zoomIn(): void {
    const editor = this.getEditor();
    editor.zoomIn();
  }

  /**
   * Zoom out on the canvas
   */
  public zoomOut(): void {
    const editor = this.getEditor();
    editor.zoomOut();
  }

  /**
   * Convert a TLDraw shape to our CanvasElement format
   */
  private convertShapeToCanvasElement(shape: TLShape): CanvasElement {
    // Log the raw shape object from TLDraw
    console.log('[CanvasInteraction] convertShapeToCanvasElement - Raw TLDraw Shape:', JSON.stringify(shape, null, 2));

    let type: 'primitive' | 'image' | 'url' = 'primitive';
    let data: CanvasPrimitive | CanvasImage | CanvasURL;
    
    const position: CanvasPosition = { x: shape.x, y: shape.y };
    
    if (shape.type === 'image' && typeof shape.props === 'object' && shape.props !== null) {
      type = 'image';
      const imageProps = shape.props as TLImageShape['props'];
      const asset = this.editorRef?.getAsset(imageProps.assetId);
      data = {
        src: asset && asset.type === 'image' ? asset.props.src : 'asset_id:' + imageProps.assetId,
        position,
        size: { 
          width: imageProps.w || 100, 
          height: imageProps.h || 100 
        },
        rotation: shape.rotation || 0,
      };
    } else if (shape.type === 'bookmark' && typeof shape.props === 'object' && shape.props !== null) {
      type = 'url'; // Treat bookmarks primarily as URLs
      const bookmarkShapeProps = shape.props as TLBookmarkShape['props']; // Standard tldraw props
      const customBookmarkProps = shape.props as TLBookmarkProps; // Our extended/expected direct props
      
      const asset = bookmarkShapeProps.assetId ? this.editorRef?.getAsset(bookmarkShapeProps.assetId) : undefined;
      
      let url = 'unknown_url';
      let title = '';
      let description = '';
      let assetImageSrc: string | undefined = undefined;

      if (asset && asset.type === 'bookmark') {
        url = asset.props.src || url;
        title = asset.props.title || title;
        description = asset.props.description || description;
        assetImageSrc = asset.props.image;
      }

      // Override with direct props from shape if they exist (custom or convenience)
      url = customBookmarkProps.url || url;
      title = customBookmarkProps.title || title;
      description = customBookmarkProps.description || description;

      const imageSrcFromDirectProps = customBookmarkProps.src; // Might be on customBookmarkProps
      // If asset itself was an image type (e.g. linked image instead of bookmark asset, less common for a bookmark shape)
      const imageSrcFromImageAsset = (asset && asset.type === 'image' ? asset.props.src : undefined);

      data = {
        url,
        position,
        title,
        description,
        imageSrc: imageSrcFromDirectProps || assetImageSrc || imageSrcFromImageAsset,
        text: description || title || '', // Populate CanvasURL.text from description or title
      };
    } else if (shape.type === 'note' && typeof shape.props === 'object' && shape.props !== null) {
      type = 'url'; // Assuming notes with URLs are the primary use case for 'note' to 'url'
      let noteText = '';
      if ('text' in shape.props && typeof shape.props.text === 'string') {
        noteText = shape.props.text;
      }
      const urlMatch = noteText.match(/https?:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : 'https://example.com';
      data = {
        url,
        position,
        title: noteText.split('\n')[0] || '',
        description: noteText.substring(noteText.indexOf('\n') + 1) || '', // Text after the first line as description
      };
    } else if (shape.type === 'text' && typeof shape.props === 'object' && shape.props !== null) {
      type = 'primitive';
      // More specific cast based on tldraw's typical text props
      const textProps = shape.props as {
        text: string; // Expect text to be a string
        color?: TLDefaultColorStyle | string;
        size?: string; // e.g., 's', 'm', 'l', 'xl'
        font?: string; // e.g., 'draw', 'sans', 'serif', 'mono'
        align?: string; // e.g., 'start', 'middle', 'end'
        w?: number;
        h?: number;
        autoSize?: boolean;
        richText?: RichTextRoot; // Use the new interface
      };

      // Log specifically what we see for textProps.text
      console.log(`[CanvasInteraction] Text shape processing: ID=${shape.id}, props.text=${JSON.stringify(textProps.text)}`);
      // Log richText if available
      if (textProps.richText) {
        console.log(`[CanvasInteraction] Text shape richText: ID=${shape.id}, richText=${JSON.stringify(textProps.richText)}`);
      }

      let actualText = textProps.text || '';
      if (textProps.richText && 
          textProps.richText.content && 
          textProps.richText.content[0] &&
          textProps.richText.content[0].content &&
          textProps.richText.content[0].content[0] &&
          textProps.richText.content[0].content[0].text) {
        actualText = textProps.richText.content[0].content[0].text;
        console.log(`[CanvasInteraction] Extracted text from richText: ID=${shape.id}, actualText=${actualText}`);
      } else if (textProps.richText && textProps.richText.content && textProps.richText.content[0] && textProps.richText.content[0].text) {
        // Fallback for slightly different structures if the primary path fails
        actualText = textProps.richText.content[0].text;
        console.log(`[CanvasInteraction] Extracted text from richText (fallback): ID=${shape.id}, actualText=${actualText}`);
      }

      data = {
        type: 'text', // Our internal type for the primitive
        position,
        color: String(textProps.color || 'black'), // Ensure color is a string, default from tldraw is black
        text: actualText,     // Assign text
        size: { width: textProps.w || 100, height: textProps.h || (textProps.autoSize ? 50 : 100) }, // Estimate height if autoSize
      };
    }
     else { // Handles 'geo', 'line', 'arrow', and other potential primitives
      type = 'primitive';
      let primitiveType: string = 'rectangle'; // Default, will be overridden by geo
      
      if (shape.type === 'geo' && typeof shape.props === 'object' && shape.props !== null && 'geo' in shape.props) {
        primitiveType = shape.props.geo as string; // Use the actual geo type (star, heart, etc.)
      } else if (shape.type === 'line') {
        primitiveType = 'line';
      } else if (shape.type === 'arrow') {
        primitiveType = 'arrow';
      }
      // Note: 'text' type is handled in its own block now.
      
      let textContent = '';
      let colorValue = '#000000';
      let width = 100;
      let height = 100;
      
      if (typeof shape.props === 'object' && shape.props !== null) {
        // For geo shapes, text might be directly in props.text
        if ('text' in shape.props && typeof shape.props.text === 'string') {
          textContent = shape.props.text;
        }
        if ('color' in shape.props && typeof shape.props.color === 'string') {
          colorValue = shape.props.color;
        }
        if ('w' in shape.props && typeof shape.props.w === 'number') {
          width = shape.props.w;
        }
        if ('h' in shape.props && typeof shape.props.h === 'number') {
          height = shape.props.h;
        }
      }
      
      data = {
        type: primitiveType,
        position,
        color: colorValue,
        text: textContent, // Include text for geo shapes if present
        size: { width, height },
      };
    }
    
    return {
      id: shape.id,
      type,
      data,
    };
  }
} 