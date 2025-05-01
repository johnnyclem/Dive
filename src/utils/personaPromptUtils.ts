import { Persona } from '../types/Persona';

/**
 * Formats the persona information into a system prompt for the chat
 * @param persona The active persona to format
 * @returns Formatted system prompt string
 */
export const formatPersonaForSystemPrompt = (persona: Persona): string => {
  const parts: string[] = [];
  
  // Basic identity information
  parts.push(`You are role-playing as "${persona.name}".`);
  
  if (persona.age) {
    parts.push(`You are ${persona.age} years old.`);
  }
  
  if (persona.enneagramNumber) {
    parts.push(`Your personality aligns with Enneagram Type ${persona.enneagramNumber}.`);
  }
  
  // Character attributes
  if (Object.keys(persona.attributes).length > 0) {
    parts.push('\nCharacter attributes:');
    Object.entries(persona.attributes).forEach(([key, value]) => {
      parts.push(`- ${key}: ${value}`);
    });
  }
  
  // Backstory
  if (persona.backstory) {
    parts.push(`\nBackstory:\n${persona.backstory}`);
  }
  
  // Example responses
  if (persona.exampleResponses.length > 0) {
    parts.push('\nHere are examples of how you should respond:');
    persona.exampleResponses.forEach(response => {
      parts.push(`- "${response}"`);
    });
  }
  
  // Restricted topics and words
  if (persona.restrictedTopics.length > 0 || persona.restrictedWords.length > 0) {
    parts.push('\nRestrictions:');
    
    if (persona.restrictedTopics.length > 0) {
      parts.push('You must avoid discussing the following topics:');
      persona.restrictedTopics.forEach(topic => {
        parts.push(`- ${topic}`);
      });
    }
    
    if (persona.restrictedWords.length > 0) {
      parts.push('You must never use the following words or phrases:');
      persona.restrictedWords.forEach(word => {
        parts.push(`- ${word}`);
      });
    }
  }
  
  return parts.join('\n');
};

/**
 * Adapts the persona for specific inference model providers
 * Different providers might have different system prompt formats/requirements
 * @param persona The active persona
 * @param provider The inference model provider
 * @returns Provider-specific persona prompt
 */
export const adaptPersonaForProvider = (
  persona: Persona,
  provider: string
): string => {
  const basePrompt = formatPersonaForSystemPrompt(persona);
  
  // Adapt the prompt based on the provider
  switch (provider.toLowerCase()) {
    case 'openai':
      return basePrompt;
      
    case 'anthropic':
      return `<persona>\n${basePrompt}\n</persona>\n\nPlease respond to the user in accordance with the persona described above.`;
      
    case 'llama':
    case 'mistral':
      return `<system>\n${basePrompt}\n</system>`;
      
    default:
      return basePrompt;
  }
};

/**
 * Creates a system prompt that includes the active persona if one exists
 * @param baseSystemPrompt The base system prompt without persona customization
 * @param activePersona The currently active persona (if any)
 * @param provider The inference model provider
 * @returns Complete system prompt with persona information
 */
export const createSystemPromptWithPersona = (
  baseSystemPrompt: string,
  activePersona: Persona | null,
  provider: string
): string => {
  if (!activePersona) {
    return baseSystemPrompt;
  }
  
  const personaPrompt = adaptPersonaForProvider(activePersona, provider);
  
  return `${personaPrompt}\n\n${baseSystemPrompt}`;
}; 