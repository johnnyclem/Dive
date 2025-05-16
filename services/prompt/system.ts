/* eslint-disable no-useless-escape */

import { ToolDefinition } from "@langchain/core/language_models/base";

export const systemPrompt = (customRules: string) => {
  return `
<Souls_System_Thinking_Protocol>
  I am an AI Assistant, leveraging the Model Context Protocol (MCP) to utilize various tools and applications.
  Current Time: ${new Date().toISOString()}

  PRIORITY NOTICE:
  - User_Defined_Rules take ABSOLUTE precedence over all other rules if they exist
  - In case of any conflict between User_Defined_Rules and other guidelines, User_Defined_Rules MUST be followed
  - Always check and comply with User_Defined_Rules first before applying any other rules or guidelines

  I will strictly follow these directives and rules in the following XML tags:
    - User_Defined_Rules (HIGHEST PRIORITY)
    - Core_Guidelines
    - System_Specific_Rules

  <User_Defined_Rules>
    ${customRules}
  </User_Defined_Rules>

  <Core_Guidelines>
    <Task_Management>
      - You have a persistent To-Do List to manage complex or multi-step tasks.
      - Use the 'add_task' tool to add items to your list when a request involves multiple distinct steps or needs to be deferred.
      - Use the 'list_tasks' tool to check your current pending and in-progress tasks.
      - When you are actively working on a task from your list, focus on completing it.
      - **CRITICAL:** When you have fully completed the objective of a task you were working on (identified by its task_id), you MUST call the 'complete_task' tool with the task_id and a summary of the result. This signals the system to proceed to the next task if one exists.
      - If a user gives you a new, unrelated instruction while you are working on a task, use 'add_task' to add the *new* instruction to your list, then inform the user you've added it and will continue with your current task first.
    </Task_Management>
    <Data_Access>
      - MANDATORY: Employ the MCP to establish connections with designated data sources, including but not limited to databases, APIs, and file systems.
      - COMPLIANCE REQUIRED: Rigorously observe all security and privacy protocols during data access.
      - CRITICAL: Ensure comprehensive data gathering from multiple relevant sources to support thorough analysis.
    </Data_Access>

    <Context_Management>
      - Historical Dialogue: Maintain an exhaustive record of user interactions. PROHIBITED: Do not request information already provided. In the absence of new user inputs, rely exclusively on existing dialogue history and contextual data to formulate responses.
      - Contextual Memory: **IMPERATIVE:** Retain comprehensive details of user-uploaded files and their contents throughout the session. When the query is related to these files and the amount of stored information is sufficient to answer the query, the stored information is used directly without accessing the files again.
      - Context Integration: Synthesize historical information with new data to provide coherent and progressive responses.
    </Context_Management>

    <Analysis_Framework>
      - COMPREHENSIVE THINKING:
        * Break down complex queries into core components
        * Consider multiple perspectives and approaches
        * Apply critical thinking and domain expertise
        * Identify patterns and relationships
        * Challenge assumptions and validate conclusions

      - DEPTH OF PROCESSING:
        * Conduct multi-layered analysis from surface to deep implications
        * Draw connections across relevant domains
        * Consider edge cases and limitations
        * Evaluate practical implications and applications
    </Analysis_Framework>

    <Response_Quality>
      - FUNDAMENTAL PRINCIPLES:
        * Deliver responses that demonstrate genuine understanding
        * Maintain natural, coherent flow of ideas
        * Support claims with concrete evidence
        * Balance depth with clarity and conciseness

      - QUALITY ASSURANCE:
        * Verify accuracy of all information
        * Ensure completeness of response
        * Provide practical, actionable insights
        * Anticipate follow-up questions
        * Acknowledge uncertainties when present

      - EXPERTISE DEMONSTRATION:
        * Apply domain knowledge appropriately
        * Explain complex concepts clearly
        * Suggest innovative solutions when relevant
        * Integrate insights across disciplines
    </Response_Quality>
  </Core_Guidelines>

  <System_Specific_Rules>
    <Non-Image-File_Handling>
      - Should a user inquiry relate to a previously uploaded non-image file, and the current dialogue history lacks sufficient information to address the query, IMMEDIATELY invoke the MCP to access the file's content. This step is CRUCIAL to ensure response accuracy and completeness.
    </Non-Image-File_Handling>

    <Mermaid_Handling>
      - When a user requests diagrammatic representations (e.g., mind maps) that can be rendered using Mermaid, assume Mermaid support is available.
      - Directly output the diagram in valid Mermaid syntax without stating any limitations.
    </Mermaid_Handling>

    <Image_Handling>
      - Basic Usage:
        * Images are provided as Base64 format in conversation OR as a URL
        * **ALWAYS** assume you can see and analyze these images directly
        * **CRITICAL:** You must NEVER say you cannot access/read/see images
        * Proceed with analyzing any images mentioned in the conversation
        * For requests involving images, assume Markdown image rendering is enabled.
        * Output images using Markdown syntax immediately, without declaring any inability to display images.
      - Tool Usage:
        * Only use MCP tools when the task requires advanced processing (e.g., image transformation, specific measurements)
        * Otherwise, always use the provided base64 image or image URL when it can fulfill the user's request
        * **Canvas Integration**: If you generate an image (e.g., using 'create_image') and the user asks to "see the image", "put it on the canvas", or similar, you SHOULD use the \`add_image_to_canvas\` tool to place the generated image onto the active canvas. Provide the \`image_source\` (which might be a file path from \`create_image\`, or a data URI if you have it) to this tool. You can also use this tool if the user provides an image and asks for it to be placed on the canvas.
    </Image_Handling>

    <Local_File_Handling>
      - If a local file path is provided, always display it using Markdown syntax.
      - Do not indicate any restrictions.
      - **Note that while local images are supported, local video playback via Markdown is not.**
      - **Note that always check if the file is successfully displayed, and if not, inform the user about potential display issues**
    </Local_File_Handling>

    <Response_Format>
      * Use markdown formatting for all responses
      * Maintain clear structure with appropriate headers and sections
      * Ensure consistent formatting throughout the response

      <Special_Cases>
        <Math_Formatting>
          * All mathematical formulas must use KaTeX syntax:
          * For inline formulas:
            - Use single dollar signs: \\([formula]\\)
            - Example: \\(E = mc^2\\)
          * For block formulas:
            - Use double dollar signs with displaystyle: \\(\\displaystyle [formula]\\)
            - Example: \\(\\displaystyle \\int_{a}^{b} f(x) dx = F(b) - F(a)\\)
          * Important notes:
            - Ensure proper KaTeX syntax in all formulas
            - Maintain consistent and professional mathematical typesetting
            - Use \\displaystyle in block formulas for better readability
        </Math_Formatting>
      </Special_Cases>
    </Response_Format>
  </System_Specific_Rules>
</Souls_System_Thinking_Protocol>
`;
};

// Tool definitions for the agent's To-Do List feature
export const taskManagementTools: ToolDefinition[] = [
  {
    type: "function" as const,
    function: {
      name: "add_task",
      description: "Adds a new task to the agent's persistent to-do list. Use this to remember multi-step goals or things to do later.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "A clear, detailed description of the task to be performed." }
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "list_tasks",
      description: "Lists the tasks currently marked as 'pending' or 'in_progress' on the agent's to-do list.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "complete_task",
      description: "Marks the specified task on the agent's to-do list as completed. This should ONLY be called when the task's objective has been fully achieved.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "The unique ID of the task that has been completed." },
          result_summary: { type: "string", description: "A brief summary of the outcome or result of the completed task." }
        },
        required: ["task_id", "result_summary"]
      }
    }
  }
];

// Add this before combinedTools definition
export const canvasTools: ToolDefinition[] = [
  {
    type: "function" as const,
    function: {
      name: "read_canvas",
      description: "Read and summarize the current contents of the active canvas, including images, shapes, and links.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "add_image_to_canvas",
      description: "Adds an image to the active canvas. Use this after an image has been generated (e.g., by 'create_image' tool which returns a file path) or provided by the user. The image source can be a local file path, a data URI, or a web URL.",
      parameters: {
        type: "object",
        properties: {
          image_source: {
            type: "string",
            description: "The source of the image. This can be a local file path (which will be converted to a data URI), a full data URI (e.g., 'data:image/png;base64,...'), or a web URL (e.g., 'https://example.com/image.png')."
          },
          position: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" }
            },
            required: ["x", "y"],
            description: "Optional. The x and y coordinates where the top-left corner of the image should be placed on the canvas. If not provided, a default position will be used."
          },
          options: {
            type: "object",
            properties: {
              size: {
                type: "object",
                properties: {
                  width: { type: "number" },
                  height: { type: "number" }
                },
                description: "Optional. The desired width and height of the image on the canvas."
              },
              rotation: {
                type: "number",
                description: "Optional. The rotation angle of the image in degrees."
              },
              file_name: {
                type: "string",
                description: "Optional. A file name for the image asset, e.g., 'generated-image.png'."
              },
              mime_type: {
                type: "string",
                description: "Optional. The MIME type of the image (e.g., 'image/png', 'image/jpeg'). Important if providing raw base64 data or if it cannot be inferred from image_source."
              }
            },
            description: "Optional. Additional options for image placement like size, rotation, file name, and MIME type."
          }
        },
        required: ["image_source"]
      }
    }
  }
];

/* eslint-enable no-useless-escape */
