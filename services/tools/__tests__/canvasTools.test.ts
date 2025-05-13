import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { read_canvas } from '../canvasTools';
import { CanvasToolHandler } from '../../utils/canvasToolHandler';
import { CanvasInteraction, CanvasElement } from '../../utils/canvasInteraction';

interface CanvasToolResult {
  success: boolean;
  message: string;
  data?: CanvasElement | CanvasElement[] | string;
}

// Mock the CanvasToolHandler
jest.mock('../../utils/canvasToolHandler', () => ({
  CanvasToolHandler: {
    getInstance: jest.fn()
  }
}));

// Mock the CanvasInteraction
jest.mock('../../utils/canvasInteraction', () => ({
  CanvasInteraction: {
    getInstance: jest.fn()
  }
}));

describe('Canvas Tools', () => {
  let mockCanvasInteraction: jest.Mocked<CanvasInteraction>;
  let mockCanvasToolHandler: jest.Mocked<CanvasToolHandler>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup mock CanvasInteraction
    mockCanvasInteraction = {
      isInitialized: jest.fn().mockReturnValue(true),
      readCanvasContents: jest.fn(),
      setEditor: jest.fn(),
      resetEditor: jest.fn(),
      drawOnCanvas: jest.fn(),
      drawPrimitiveOnCanvas: jest.fn(),
      addImageToCanvas: jest.fn(),
      addURLToCanvas: jest.fn(),
      findInCanvas: jest.fn(),
      seeCanvas: jest.fn(),
      zoomIn: jest.fn(),
      zoomOut: jest.fn()
    } as unknown as jest.Mocked<CanvasInteraction>;

    // Setup mock CanvasToolHandler
    mockCanvasToolHandler = {
      handleCanvasQuery: jest.fn(),
      isCanvasQuery: jest.fn()
    } as unknown as jest.Mocked<CanvasToolHandler>;

    // Set up the mock instances
    (CanvasInteraction.getInstance as jest.Mock).mockReturnValue(mockCanvasInteraction);
    (CanvasToolHandler.getInstance as jest.Mock).mockReturnValue(mockCanvasToolHandler);
  });

  describe('read_canvas', () => {
    it('should successfully read canvas contents', () => {
      const mockData: CanvasElement[] = [
        { id: '1', type: 'primitive', data: { type: 'circle', position: { x: 100, y: 100 } } },
        { id: '2', type: 'primitive', data: { type: 'text', text: 'Hello', position: { x: 200, y: 200 } } },
        { id: '3', type: 'image', data: { src: 'test.jpg', position: { x: 300, y: 300 } } }
      ];

      const mockResult: CanvasToolResult = {
        success: true,
        message: 'Canvas contains 3 elements',
        data: mockData
      };

      // Mock successful canvas reading
      mockCanvasToolHandler.handleCanvasQuery.mockReturnValue(mockResult);

      const result = read_canvas();

      expect(result.result.success).toBe(true);
      expect(result.result.summary).toBe('Canvas contains 3 elements');
      expect(result.result.data).toHaveLength(3);
      expect(mockCanvasToolHandler.handleCanvasQuery).toHaveBeenCalledWith('read canvas');
    });

    it('should handle canvas not initialized', () => {
      const mockResult: CanvasToolResult = {
        success: false,
        message: 'Canvas editor is not initialized yet',
        data: null
      };

      // Mock canvas not initialized
      mockCanvasToolHandler.handleCanvasQuery.mockReturnValue(mockResult);

      const result = read_canvas();

      expect(result.result.success).toBe(false);
      expect(result.result.summary).toContain('Error reading canvas');
      expect(result.result.data).toBeNull();
    });

    it('should handle empty canvas', () => {
      const mockResult: CanvasToolResult = {
        success: true,
        message: 'Canvas is empty',
        data: []
      };

      // Mock empty canvas
      mockCanvasToolHandler.handleCanvasQuery.mockReturnValue(mockResult);

      const result = read_canvas();

      expect(result.result.success).toBe(true);
      expect(result.result.summary).toBe('Canvas is empty');
      expect(result.result.data).toEqual([]);
    });

    it('should handle errors gracefully', () => {
      // Mock an error
      mockCanvasToolHandler.handleCanvasQuery.mockImplementation(() => {
        throw new Error('Failed to access canvas');
      });

      const result = read_canvas();

      expect(result.result.success).toBe(false);
      expect(result.result.summary).toContain('Failed to read canvas');
      expect(result.result.data).toBeNull();
    });

    it('should handle canvas with mixed content types', () => {
      const mockData: CanvasElement[] = [
        { id: '1', type: 'primitive', data: { type: 'circle', position: { x: 100, y: 100 } } },
        { id: '2', type: 'image', data: { src: 'test.jpg', position: { x: 200, y: 200 } } },
        { id: '3', type: 'url', data: { url: 'https://example.com', position: { x: 300, y: 300 } } }
      ];

      const mockResult: CanvasToolResult = {
        success: true,
        message: 'Canvas contains mixed content',
        data: mockData
      };

      // Mock canvas with various content types
      mockCanvasToolHandler.handleCanvasQuery.mockReturnValue(mockResult);

      const result = read_canvas();

      expect(result.result.success).toBe(true);
      expect(result.result.data).toHaveLength(3);
      expect(result.result.data[0].type).toBe('primitive');
      expect(result.result.data[1].type).toBe('image');
      expect(result.result.data[2].type).toBe('url');
    });
  });
}); 