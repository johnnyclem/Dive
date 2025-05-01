/**
 * Canvas Interaction Utility Class
 * 
 * Handles interactions with the canvas component including drawing,
 * adding images, zooming and other operations.
 * Now connected to TLDraw for actual functionality.
 */

import { Editor, TLShape, createShapeId, TLGeoShape, TLImageShape, TLArrowShape } from '@tldraw/tldraw';

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasPrimitive {
  type: 'circle' | 'square' | 'rectangle' | 'triangle' | 'line' | 'arrow' | 'text';
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
}

export interface CanvasElement {
  id: string;
  type: 'primitive' | 'image' | 'url';
  data: CanvasPrimitive | CanvasImage | CanvasURL;
}

// Map of colors to TLDraw color values
const COLOR_MAP: Record<string, string> = {
  'black': 'black',
  'blue': 'blue',
  'green': 'green',
  'gray': 'grey',
  'grey': 'grey',
  'orange': 'orange',
  'pink': 'pink',
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
  private static instance: CanvasInteraction;
  private editorRef: Editor | null = null;
  private initialized = false;

  /**
   * Gets the singleton instance of the CanvasInteraction class
   */
  public static getInstance(): CanvasInteraction {
    if (!CanvasInteraction.instance) {
      CanvasInteraction.instance = new CanvasInteraction();
    }
    return CanvasInteraction.instance;
  }

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Check if the editor is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && this.editorRef !== null;
  }

  /**
   * Set the TLDraw editor reference
   */
  public setEditor(editor: Editor): void {
    this.editorRef = editor;
    this.initialized = true;
    console.log('TLDraw editor connected to CanvasInteraction');
  }

  /**
   * Reset the editor reference (useful when the editor is unmounted)
   */
  public resetEditor(): void {
    this.editorRef = null;
    this.initialized = false;
  }

  /**
   * Get the TLDraw editor reference
   */
  private getEditor(): Editor {
    if (!this.editorRef || !this.initialized) {
      throw new Error('TLDraw editor not initialized');
    }
    return this.editorRef;
  }

  /**
   * Map a color string to a TLDraw color
   */
  private mapColor(color: string | undefined): string {
    if (!color) return 'black';
    
    const lowerColor = color.toLowerCase();
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
      // Create a geo shape (rectangle, circle, etc.)
      editor.createShape<TLGeoShape>({
        id,
        type: shapeType,
        x: position.x,
        y: position.y,
        props: {
          geo: this.mapGeoType(type),
          color: colorValue,
          text: options.text || '',
          size: 'l',
          w: options.size?.width || 100,
          h: options.size?.height || 100,
          fill: options.fillOpacity === 0 ? 'none' : 'solid',
          dash: 'draw',
        },
      });
    } else if (shapeType === 'line') {
      // Create a line
      editor.createShape({
        id,
        type: shapeType,
        x: position.x,
        y: position.y,
        props: {
          color: colorValue,
          size: 'l',
          // Create a line with start and end points
          handles: {
            start: { x: 0, y: 0 },
            end: { x: options.size?.width || 100, y: options.size?.height || 0 },
          },
        },
      });
    } else if (shapeType === 'arrow') {
      // Create an arrow
      editor.createShape<TLArrowShape>({
        id,
        type: shapeType,
        x: position.x,
        y: position.y,
        props: {
          color: colorValue,
          size: 'l',
          // Create a line with start and end points
          handles: {
            start: { x: 0, y: 0 },
            end: { x: options.size?.width || 100, y: options.size?.height || 0 },
          },
        },
      });
    } else if (shapeType === 'text') {
      // Create a text shape
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
    const id = createShapeId();
    
    // First create the asset
    const assetId = editor.createAssets([
      {
        type: 'image',
        src: src,
        size: [size?.width || 200, size?.height || 200],
        isCopying: false
      }
    ])[0];
    
    // Then create the image shape with the asset ID
    editor.createShape<TLImageShape>({
      id,
      type: 'image',
      x: position.x,
      y: position.y,
      props: {
        w: size?.width || 200,
        h: size?.height || 200,
        assetId,
        rotation: rotation || 0,
      },
    });

    return {
      id: id.toString(),
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
    const editor = this.getEditor();
    const shapes = editor.getCurrentPageShapesSorted();
    
    return shapes.map(shape => this.convertShapeToCanvasElement(shape));
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
  public zoomIn(factor: number = 1.2): void {
    const editor = this.getEditor();
    const currentZoom = editor.getZoomLevel();
    editor.setZoomLevel(currentZoom * factor);
  }

  /**
   * Zoom out on the canvas
   */
  public zoomOut(factor: number = 0.8): void {
    const editor = this.getEditor();
    const currentZoom = editor.getZoomLevel();
    editor.setZoomLevel(currentZoom * factor);
  }

  /**
   * Convert a TLDraw shape to our CanvasElement format
   */
  private convertShapeToCanvasElement(shape: TLShape): CanvasElement {
    let type: 'primitive' | 'image' | 'url' = 'primitive';
    let data: CanvasPrimitive | CanvasImage | CanvasURL;
    
    const position: CanvasPosition = { x: shape.x, y: shape.y };
    
    if (shape.type === 'image' && typeof shape.props === 'object' && shape.props !== null) {
      type = 'image';
      data = {
        src: 'asset_id:' + shape.props.assetId,
        position,
        size: { 
          width: typeof shape.props.w === 'number' ? shape.props.w : 100, 
          height: typeof shape.props.h === 'number' ? shape.props.h : 100 
        },
        rotation: typeof shape.props.rotation === 'number' ? shape.props.rotation : 0,
      };
    } else if (shape.type === 'note' && typeof shape.props === 'object' && shape.props !== null) {
      type = 'url';
      
      // Try to extract URL from note text
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
      };
    } else {
      // Handle primitive shapes
      let primitiveType: 'circle' | 'square' | 'rectangle' | 'triangle' | 'line' | 'arrow' | 'text' = 'rectangle';
      
      if (shape.type === 'geo' && typeof shape.props === 'object' && shape.props !== null && 'geo' in shape.props) {
        const geo = shape.props.geo as string;
        if (geo === 'ellipse') {
          primitiveType = 'circle';
        } else if (geo === 'rectangle') {
          primitiveType = 'rectangle';
        } else if (geo === 'triangle') {
          primitiveType = 'triangle';
        }
      } else if (shape.type === 'line') {
        primitiveType = 'line';
      } else if (shape.type === 'arrow') {
        primitiveType = 'arrow';
      } else if (shape.type === 'text') {
        primitiveType = 'text';
      }
      
      let textContent = '';
      let colorValue = '#000000';
      let width = 100;
      let height = 100;
      
      if (typeof shape.props === 'object' && shape.props !== null) {
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
        text: textContent,
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