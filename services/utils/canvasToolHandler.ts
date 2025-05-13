/**
 * Canvas Tool Handler
 * 
 * Handles routing queries related to canvas operations to the appropriate
 * canvas interaction methods.
 */

import { CanvasInteraction, CanvasPosition, CanvasElement } from './canvasInteraction';
import { summarizeCanvasContents } from './canvasContentExtractor';

interface CanvasToolResult {
  success: boolean;
  message: string;
  data?: CanvasElement | CanvasElement[] | string;
}

/**
 * Utility to format known data structures for user-friendly output
 */
function formatKnownData(data: unknown): string {
  // Handle forms structure
  if (
    typeof data === 'object' &&
    data !== null &&
    'forms' in data &&
    Array.isArray((data as { forms: unknown[] }).forms)
  ) {
    return (data as { forms: { name?: string; ID?: string; fields?: { label?: string; name?: string; type?: string }[] }[] }).forms
      .map((form) => {
        const fields = form.fields?.map((f) => `  - ${f.label || f.name} (${f.type})`).join('\n') || '  (No fields)';
        return `Form: ${form.name || form.ID || 'Unnamed'}\nFields:\n${fields}`;
      })
      .join('\n\n');
  }
  // Add more known structures as needed
  // Fallback: pretty-print JSON
  return 'Result:\n' + JSON.stringify(data, null, 2);
}

/**
 * Centralized handler for tool/MCP responses
 */
function parseToolResponse(response: unknown): { success: boolean; message: string; data?: unknown } {
  if (!response) {
    return { success: false, message: 'No response received from tool.' };
  }
  // If response is an array, handle first element (common for MCP tools)
  const res = Array.isArray(response) ? response[0] : response;
  if (typeof res === 'object' && res !== null && 'type' in res && (res as { type: string }).type === 'text') {
    try {
      const parsed = JSON.parse((res as { text: string }).text);
      // If the response has a success field and is true, treat as success
      if (parsed.success) {
        // Try to format known data structures
        let formatted = '';
        if (parsed.forms) {
          formatted = formatKnownData(parsed.forms);
        } else {
          formatted = formatKnownData(parsed);
        }
        return {
          success: true,
          message: formatted,
          data: parsed
        };
      } else {
        // If success is false or missing, but we have data, still show it
        if (parsed.forms || parsed.data) {
          return {
            success: true,
            message: formatKnownData(parsed.forms || parsed.data),
            data: parsed
          };
        }
        return {
          success: false,
          message: parsed.message || 'Operation failed.',
          data: parsed
        };
      }
    } catch {
      // Not JSON, just return the text
      return {
        success: false,
        message: 'Failed to parse tool response as JSON. Raw response: ' + (res as { text: string }).text
      };
    }
  }
  // Handle other response types if needed
  return {
    success: false,
    message: 'Unknown response type.'
  };
}

export class CanvasToolHandler {
  private static instance: CanvasToolHandler;
  private canvasInteraction: CanvasInteraction;

  // Keywords that trigger canvas-related actions
  private drawKeywords = ['draw', 'write', 'paint', 'sketch', 'doodle'];
  private canvasKeywords = ['canvas', 'tldraw', 'creative_space', 'drawing', 'whiteboard'];
  
  // Keywords for specific operations
  private primitiveKeywords = ['circle', 'square', 'rectangle', 'triangle', 'line', 'arrow', 'text'];
  private imageKeywords = ['image', 'picture', 'photo', 'graphic'];
  private urlKeywords = ['url', 'link', 'website'];
  private zoomKeywords = ['zoom in', 'zoom out', 'enlarge', 'reduce', 'magnify', 'shrink'];
  private readKeywords = ['read', 'contents', 'elements', 'list'];
  private findKeywords = ['find', 'search', 'locate'];
  private seeKeywords = ['see', 'view', 'show', 'display'];

  /**
   * Gets the singleton instance of the CanvasToolHandler
   */
  public static getInstance(canvasInteraction?: CanvasInteraction): CanvasToolHandler {
    if (!CanvasToolHandler.instance) {
      CanvasToolHandler.instance = new CanvasToolHandler(canvasInteraction);
    } else if (canvasInteraction) {
      CanvasToolHandler.instance.canvasInteraction = canvasInteraction;
    }
    return CanvasToolHandler.instance;
  }

  private constructor(canvasInteraction?: CanvasInteraction) {
    this.canvasInteraction = canvasInteraction || null;
  }

  /**
   * Determines if a query is related to canvas operations
   */
  public isCanvasQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Check if query contains both a draw-related keyword and a canvas-related keyword
    const hasDrawKeyword = this.drawKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasCanvasKeyword = this.canvasKeywords.some(keyword => lowerQuery.includes(keyword));
    
    // Also check for specific operation keywords
    const hasPrimitiveKeyword = this.primitiveKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasZoomKeyword = this.zoomKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasReadKeyword = this.readKeywords.some(keyword => lowerQuery.includes(keyword));
    
    return (hasDrawKeyword && (hasCanvasKeyword || hasPrimitiveKeyword)) || 
           (hasCanvasKeyword && (hasDrawKeyword || hasPrimitiveKeyword || hasZoomKeyword || hasReadKeyword));
  }

  /**
   * Check if the editor is ready for canvas operations
   */
  private checkEditorReady(): boolean {
    if (!this.canvasInteraction) {
      console.warn("CanvasInteraction instance not set in CanvasToolHandler!");
      return false;
    }
    console.log("CanvasToolHandler checking isInitialized:", this.canvasInteraction.isInitialized());
    return this.canvasInteraction.isInitialized();
  }

  /**
   * Handles a canvas-related query by routing to the appropriate method
   * Now also handles generic tool/MCP responses robustly.
   */
  public handleCanvasQuery(query: string, toolResponse?: unknown): CanvasToolResult {
    const lowerQuery = query.toLowerCase();

    // If a tool/MCP response is provided, parse and present it
    if (toolResponse) {
      const parsed = parseToolResponse(toolResponse);
      return {
        success: parsed.success,
        message: parsed.message,
        data: parsed.data as string | CanvasElement | CanvasElement[] | undefined
      };
    }

    // Check if the editor is initialized
    if (!this.checkEditorReady()) {
      return {
        success: false,
        message: "Canvas editor is not initialized yet. Please try again after the canvas is fully loaded."
      };
    }
    
    // Default position - center of canvas
    const position: CanvasPosition = { x: 500, y: 300 };
    
    try {
      // Handle primitive drawing
      for (const primitive of this.primitiveKeywords) {
        if (lowerQuery.includes(primitive)) {
          const element = this.canvasInteraction.drawPrimitiveOnCanvas(
            primitive as 'circle' | 'square' | 'rectangle' | 'triangle' | 'line' | 'arrow' | 'text',
            position,
            {
              color: this.extractColor(query) || 'black',
              text: this.extractText(query),
            }
          );
          return {
            success: true,
            message: `Drew a ${primitive} on the canvas`,
            data: element
          };
        }
      }
      
      // Handle image addition
      if (this.imageKeywords.some(keyword => lowerQuery.includes(keyword))) {
        // Extract image URL from query if present
        const urlMatch = query.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg)/i);
        // Placeholder image URL if none found
        const imageUrl = urlMatch ? urlMatch[0] : "https://placekitten.com/200/200";
        const element = this.canvasInteraction.addImageToCanvas(imageUrl, position);
        return {
          success: true,
          message: "Added image to canvas",
          data: element
        };
      }
      
      // Handle URL addition
      if (this.urlKeywords.some(keyword => lowerQuery.includes(keyword))) {
        // Extract URL from query or use placeholder
        const urlMatch = query.match(/https?:\/\/[^\s]+/);
        const url = urlMatch ? urlMatch[0] : "https://example.com";
        const element = this.canvasInteraction.addURLToCanvas(url, position);
        return {
          success: true,
          message: `Added URL ${url} to canvas`,
          data: element
        };
      }
      
      // Handle zoom operations
      if (lowerQuery.includes("zoom in")) {
        this.canvasInteraction.zoomIn();
        return {
          success: true,
          message: "Zoomed in on canvas"
        };
      }
      
      if (lowerQuery.includes("zoom out")) {
        this.canvasInteraction.zoomOut();
        return {
          success: true,
          message: "Zoomed out on canvas"
        };
      }
      
      // Handle read operations
      if (this.readKeywords.some(keyword => lowerQuery.includes(keyword))) {
        const contents = this.canvasInteraction.readCanvasContents();
        const summary = summarizeCanvasContents(contents);
        return {
          success: true,
          message: summary,
          data: contents // Still provide the raw data
        };
      }
      
      // Handle find operations
      if (this.findKeywords.some(keyword => lowerQuery.includes(keyword))) {
        // Extract search criteria from the query
        const criteria = {
          text: this.extractText(query),
          color: this.extractColor(query)
        };
        
        const elements = this.canvasInteraction.findInCanvas(criteria);
        return {
          success: true,
          message: `Found ${elements.length} elements in canvas`,
          data: elements
        };
      }
      
      // Handle see operations
      if (this.seeKeywords.some(keyword => lowerQuery.includes(keyword))) {
        const representation = this.canvasInteraction.seeCanvas();
        return {
          success: true,
          message: "Canvas representation",
          data: representation
        };
      }
      
      // Default drawing operation
      // Check if the query implies drawing but didn't match a specific primitive
      if (this.drawKeywords.some(keyword => lowerQuery.includes(keyword))) {
          const element = this.canvasInteraction.drawOnCanvas(position);
          return {
              success: true,
              message: "Drew on canvas",
              data: element
          };
      }


      // If no specific canvas command is matched, but it's a canvas query, return a default message
       if (this.canvasKeywords.some(keyword => lowerQuery.includes(keyword))) {
         return {
           success: true,
           message: "Acknowledged canvas query. Please specify an action like draw, add image, zoom, or read."
         };
       }


      return {
        success: false,
        message: "Could not understand the canvas operation requested."
      };

    } catch (error) {
      return {
        success: false,
        message: `Canvas operation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Extract color from a query
   */
  private extractColor(query: string): string | undefined {
    const colorRegex = /\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|cyan|teal|indigo|lime)\b/i;
    const colorMatch = query.match(colorRegex);
    return colorMatch ? colorMatch[0].toLowerCase() : undefined;
  }

  /**
   * Extract text content from a query
   */
  private extractText(query: string): string | undefined {
    // Look for text in quotes
    const quotedTextRegex = /"([^"]+)"|'([^']+)'/;
    const quotedMatch = query.match(quotedTextRegex);
    
    if (quotedMatch) {
      return quotedMatch[1] || quotedMatch[2];
    }
    
    // If no quoted text, extract text based on commands
    const textAfterWith = /\bwith\s+text\s+(.+?)(?:\s+in|\s+at|\s+on|\s+with|\s+using|$)/i;
    const textAfterSaying = /\bsaying\s+(.+?)(?:\s+in|\s+at|\s+on|\s+with|\s+using|$)/i;
    const textAfterContaining = /\bcontaining\s+(.+?)(?:\s+in|\s+at|\s+on|\s+with|\s+using|$)/i;
    
    const withMatch = query.match(textAfterWith);
    const sayingMatch = query.match(textAfterSaying);
    const containingMatch = query.match(textAfterContaining);
    
    return withMatch?.[1] || sayingMatch?.[1] || containingMatch?.[1];
  }

  private async readCanvas(): Promise<{ summary: string; data: CanvasElement[] | string; success: boolean }> {
    // This triggers the summarization logic
    const result = await CanvasToolHandler.getInstance().handleCanvasQuery("read canvas");
    return {
      summary: result.message,
      data: result.data as CanvasElement[] | string,
      success: result.success,
    };
  }
} 