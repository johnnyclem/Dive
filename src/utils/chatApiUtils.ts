import { usePersonaStore } from '../stores/personaStore';
import { createSystemPromptWithPersona } from './personaPromptUtils';

/**
 * Intercepts outgoing chat API requests to inject the active persona information
 * Can be used as middleware
 */
export const injectPersonaToRequest = async (
  url: string, 
  options: RequestInit = {}
): Promise<Response> => {
  // Only intercept chat API requests
  if (!url.includes('/api/chat')) {
    return fetch(url, options);
  }
  
  const { getActivePersona } = usePersonaStore.getState();
  const activePersona = getActivePersona();
  
  // If no active persona, proceed with the original request
  if (!activePersona) {
    return fetch(url, options);
  }

  try {
    // For POST requests (new messages, edits, retries)
    if (options.method === 'POST' && options.body) {
      // Get the provider from localStorage or a default
      const providerConfig = localStorage.getItem('modelConfig');
      const provider = providerConfig ? JSON.parse(providerConfig).provider : 'openai';
      
      // Generate the persona-enhanced system prompt
      const personaPrompt = createSystemPromptWithPersona('', activePersona, provider);
      
      // Handle FormData (new message with files)
      if (options.body instanceof FormData) {
        // FormData can't be directly modified, so we'll create a new one
        const originalFormData = options.body;
        const newFormData = new FormData();
        
        // Copy all entries from the original FormData
        for (const [key, value] of originalFormData.entries()) {
          newFormData.append(key, value);
        }
        
        // Add persona prompt to the request
        newFormData.append('personaPrompt', personaPrompt);
        
        // Create new request options with the modified FormData
        const newOptions = {
          ...options,
          body: newFormData,
        };
        
        return fetch(url, newOptions);
      } 
      // Handle JSON body (for edits, retries)
      else if (typeof options.body === 'string') {
        try {
          const requestData = JSON.parse(options.body);
          
          // Add the persona prompt to the request
          requestData.personaPrompt = personaPrompt;
          
          // Create new request options with the modified body
          const newOptions = {
            ...options,
            body: JSON.stringify(requestData),
          };
          
          return fetch(url, newOptions);
        } catch (parseError) {
          console.error('Error parsing request body:', parseError);
          return fetch(url, options);
        }
      }
    }
  } catch (error) {
    console.error('Error injecting persona to request:', error);
  }
  
  // Fallback to original request if anything goes wrong
  return fetch(url, options);
}; 