import { CanvasToolHandler } from '../utils/canvasToolHandler';

export function read_canvas() {
  try {
    // This triggers the summarization logic
    const result = CanvasToolHandler.getInstance().handleCanvasQuery("read canvas");
    console.log("read canvas result: ", result);
    if (!result.success) {
      return {
        result: {
          summary: `Error reading canvas: ${result.message}`,
          data: null,
          success: false
        }
      };
    }

    return {
      result: {
        summary: result.message,
        data: result.data,
        success: true
      }
    };
  } catch (error) {
    return {
      result: {
        summary: `Failed to read canvas: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: null,
        success: false
      }
    };
  }
}
