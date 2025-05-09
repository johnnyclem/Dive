import { CanvasToolHandler } from '../utils/canvasToolHandler';

export async function read_canvas() {
  // This triggers the summarization logic
  const result = CanvasToolHandler.getInstance().handleCanvasQuery("read canvas");
  return {
    summary: result.message,
    data: result.data,
    success: result.success,
  };
}
