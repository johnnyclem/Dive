import { z } from "zod";
import logger from "./logger";

// Define the expected response schema
const ResponseContentSchema = z.union([
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("image"),
    data: z.string(),
    mimeType: z.string(),
  }),
  z.object({
    type: z.literal("audio"),
    data: z.string(),
    mimeType: z.string(),
  }),
  z.object({
    type: z.literal("resource"),
    resource: z.union([
      z.object({
        type: z.string(),
        data: z.unknown(),
      }),
      z.object({
        type: z.string(),
        url: z.string(),
      }),
    ]),
  }),
]);

export type ResponseContent = z.infer<typeof ResponseContentSchema>;

/**
 * Converts camelCase parameter names to kebab-case
 * @param params The object whose keys need to be converted from camelCase to kebab-case
 * @returns A new object with kebab-case parameter names
 */
export function convertCamelCaseToKebabCase(params: Record<string, unknown>): Record<string, unknown> {
  try {
    // Handle invalid input
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      logger.warn('Invalid input to convertCamelCaseToKebabCase, returning original params');
      return params as Record<string, unknown>;
    }
    
    const result: Record<string, unknown> = {};
    
    for (const key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        try {
          // Convert camelCase to kebab-case
          const kebabKey = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          
          // Handle nested objects recursively
          const value = params[key];
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            result[kebabKey] = convertCamelCaseToKebabCase(value as Record<string, unknown>);
          } else {
            result[kebabKey] = value;
          }
        } catch (keyError) {
          // If conversion for this key fails, use the original key
          logger.warn(`Error converting key "${key}": ${keyError}`);
          result[key] = params[key];
        }
      }
    }
    
    return result;
  } catch (error) {
    // If anything fails, just return the original params
    logger.error(`Error in convertCamelCaseToKebabCase: ${error}`);
    return params;
  }
}

/**
 * Adapts a tool response to the expected format
 * @param response The raw tool response
 * @returns A properly formatted response object
 */
export function adaptToolResponse(response: unknown): ResponseContent[] {
  try {
    logger.debug(`adaptToolResponse received: ${JSON.stringify(response)}`);

    // Handle special case for get_crypto_price and other similar tools
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      // Handle error responses
      if ('error' in response && response.error) {
        const errorMsg = 'message' in response ? String(response.message) : 'Unknown tool error';
        logger.warn(`Tool returned an error: ${errorMsg}`);
        return [{
          type: "text",
          text: `Tool Error: ${errorMsg}`,
        }];
      }

      // Handle crypto price responses
      if ('price' in response || 'value' in response || 'data' in response) {
        // Format the response based on available properties
        let formattedText = 'Tool Result:';
        const obj = response as Record<string, unknown>;
        
        if ('price' in obj) formattedText += ` Price: ${obj.price}`;
        if ('value' in obj) formattedText += ` Value: ${obj.value}`;
        if ('currency' in obj) formattedText += ` ${obj.currency}`;
        if ('symbol' in obj) formattedText += ` ${obj.symbol}`;
        if ('name' in obj) formattedText += ` for ${obj.name}`;
        
        logger.debug(`Formatted tool response as text: ${formattedText}`);
        return [{
          type: "text",
          text: formattedText,
        }];
      }
    }
    
    // If response is a string, wrap it as text content
    if (typeof response === "string") {
      // Return as regular text content
      return [{
        type: "text",
        text: response,
      }];
    }
    
    // If response is an object with imageUrl property
    if (response && typeof response === "object" && !Array.isArray(response) && "imageUrl" in response) {
      try {
        return [{
          type: "image",
          data: String((response as Record<string, unknown>).imageUrl),
          mimeType: "image/png",
        }];
      } catch (imageError) {
        logger.error(`Error handling image response: ${imageError}`);
        // Fallback to text
        return [{
          type: "text",
          text: JSON.stringify(response),
        }];
      }
    }

    // If response is an object that already matches our schema, return it as is
    try {
      const parsed = ResponseContentSchema.parse(response);
      return [parsed];
    } catch (parseError) {
      logger.warn(`Response didn't match schema, converting to string: ${parseError}`);
      // If parsing fails, convert to string and wrap as text
      return [{
        type: "text",
        text: typeof response === "string" ? response : JSON.stringify(response, null, 2),
      }];
    }
  } catch (error) {
    // Absolute fallback for any unexpected errors
    logger.error(`Unexpected error in adaptToolResponse: ${error}`);
    return [{
      type: "text",
      text: typeof response === "string" ? response : JSON.stringify(response),
    }];
  }
} 