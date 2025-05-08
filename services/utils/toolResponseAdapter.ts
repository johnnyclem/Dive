import { z } from "zod";
import logger from "./logger";

// Define the expected response schema
const BaseResponseContentSchema = z.union([
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("image"),
    data: z.string(), // Could be URL or base64
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

// New schema for in-app URL display
const InAppUrlContentSchema = z.object({
  type: z.literal("in_app_url"),
  url: z.string(),
  displayText: z.string().optional(),
  messageText: z.string().optional(), // The rest of the original message, cleaned up
});

// Extended schema including the new type
const ExtendedResponseContentSchema = z.union([
  BaseResponseContentSchema.options[0], // text
  BaseResponseContentSchema.options[1], // image
  BaseResponseContentSchema.options[2], // audio
  BaseResponseContentSchema.options[3], // resource
  InAppUrlContentSchema,
]);

export type ResponseContent = z.infer<typeof ExtendedResponseContentSchema>; // Export the extended type

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
export function adaptToolResponse(rawResponse: unknown): ResponseContent[] {
  try {
    logger.debug(`adaptToolResponse received raw: ${JSON.stringify(rawResponse)}`);

    let currentResponse = rawResponse;

    // Check for the nested structure like {"content": [{...}]}
    if (
      rawResponse &&
      typeof rawResponse === 'object' &&
      'content' in rawResponse &&
      Array.isArray((rawResponse as { content: unknown[] }).content) &&
      (rawResponse as { content: unknown[] }).content.length > 0
    ) {
      // Use the first element of the 'content' array
      currentResponse = (rawResponse as { content: unknown[] }).content[0];
      logger.debug(`Unwrapped response from content array: ${JSON.stringify(currentResponse)}`);
    }

    let textToParse: string | null = null;
    let originalTextObject: ResponseContent | null = null;

    if (typeof currentResponse === "string") {
      textToParse = currentResponse;
    } else if (currentResponse && typeof currentResponse === 'object' && 'type' in currentResponse && currentResponse.type === 'text' && 'text' in currentResponse && typeof (currentResponse as { text: unknown }).text === 'string') {
      textToParse = (currentResponse as {text: string}).text;
      originalTextObject = currentResponse as ResponseContent; // Save the original text object
    }

    if (textToParse) {
      const imageUrlRegex = /(?:Image URL:|URL:)\\s*(https?:\/\/[^\\s\\n]+)/i; // Made regex case-insensitive and more general
      const match = textToParse.match(imageUrlRegex);
      if (match && match[1]) {
        logger.info(`Found URL for in-app display: ${match[1]}`);
        let messageText = textToParse
          .replace(imageUrlRegex, "") // Remove the "Image URL: <url>" line
          .replace(/\\n?The image has been opened in your default browser\\.\\n?/gi, '\\n') // Remove browser opening message
          .replace(/\\n?You can also click the URL above to view the image again\\.\\n?/gi, '\\n') // Remove redundant click message
          .replace(/Image generated successfully!\\n*/i, '') // Remove success prefix if it was just for the image
          .trim();
        
        // If the messageText becomes empty or too short, provide a default.
        if (messageText.length < 20 && !messageText.includes("Generation details")) {
            messageText = "Image generation details below.";
        }
        // Ensure generation details are preserved if they exist
        const generationDetailsMatch = textToParse.match(/Generation details:[\\s\\S]*/i);
        if (generationDetailsMatch && !messageText.includes(generationDetailsMatch[0])) {
            messageText = `${messageText.trim()}\\n\\n${generationDetailsMatch[0].trim()}`.trim();
        }

        return [{
          type: "in_app_url",
          url: match[1],
          displayText: "View Generated Content",
          messageText: messageText.trim(),
        }];
      }
      // If no image URL was found, return the original text content
      if (originalTextObject) { // This was an original {type: "text", ...} object
        return [originalTextObject];
      }
      if (typeof currentResponse === "string") { // This was an original plain string
        return [{ type: "text", text: currentResponse }];
      }
    }
    
    // Handle special case for get_crypto_price and other similar tools (operating on unwrapped 'currentResponse')
    if (currentResponse && typeof currentResponse === 'object' && !Array.isArray(currentResponse)) {
      // Handle error responses
      if ('error' in currentResponse && currentResponse.error) {
        const errorMsg = 'message' in currentResponse ? String(currentResponse.message) : 'Unknown tool error';
        logger.warn(`Tool returned an error: ${errorMsg}`);
        return [{
          type: "text",
          text: `Tool Error: ${errorMsg}`,
        }];
      }

      // Handle crypto price responses
      if ('price' in currentResponse || 'value' in currentResponse || 'data' in currentResponse) {
        // Format the response based on available properties
        let formattedText = 'Tool Result:';
        const obj = currentResponse as Record<string, unknown>;
        
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
    
    // If response is an object with imageUrl property (direct image, not text)
    if (currentResponse && typeof currentResponse === "object" && !Array.isArray(currentResponse) && "imageUrl" in currentResponse) {
      try {
        // This could also become an "in_app_url" if desired for consistency
        return [{
          type: "image", // For now, keep as image. Could be in_app_url too.
          data: String((currentResponse as Record<string, unknown>).imageUrl),
          mimeType: "image/png", // Assuming png, might need to be more dynamic
        }];
      } catch (imageError) {
        logger.error(`Error handling image response: ${imageError}`);
        // Fallback to text
        return [{
          type: "text",
          text: JSON.stringify(currentResponse),
        }];
      }
    }

    // If response is an object that already matches our schema, return it as is
    try {
      // Use the extended schema for parsing
      const parsed = ExtendedResponseContentSchema.parse(currentResponse); // Parse the unwrapped response
      return [parsed];
    } catch (parseError) {
      logger.warn(`Response didn't match schema after unwrapping and specific checks, converting to string: ${parseError}`);
      // If parsing fails, convert to string and wrap as text
      return [{
        type: "text",
        text: typeof currentResponse === "string" ? currentResponse : JSON.stringify(currentResponse, null, 2),
      }];
    }
  } catch (error) {
    // Absolute fallback for any unexpected errors
    logger.error(`Unexpected error in adaptToolResponse: ${error}`);
    return [{
      type: "text",
      text: typeof currentResponse === "string" ? currentResponse : JSON.stringify(currentResponse),
    }];
  }
} 