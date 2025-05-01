import { useEffect, useState } from 'react';
import { usePersonaStore } from '../stores/personaStore';
import { createSystemPromptWithPersona } from '../utils/personaPromptUtils';

/**
 * Hook to get the current persona-enhanced system prompt
 * This can be used when making API calls to the backend
 */
export const usePersonaPrompt = () => {
  const { getActivePersona } = usePersonaStore();
  const [personaPrompt, setPersonaPrompt] = useState<string | null>(null);
  
  useEffect(() => {
    const activePersona = getActivePersona();
    if (!activePersona) {
      setPersonaPrompt(null);
      return;
    }
    
    try {
      // Get current provider from localStorage
      const configStr = localStorage.getItem('modelConfig');
      const provider = configStr ? JSON.parse(configStr).provider : 'openai';
      
      // Create a system prompt with the persona
      const prompt = createSystemPromptWithPersona('', activePersona, provider);
      setPersonaPrompt(prompt);
    } catch (error) {
      console.error('Failed to generate persona prompt:', error);
      setPersonaPrompt(null);
    }
  }, [getActivePersona]);
  
  return personaPrompt;
};

/**
 * When we don't have access to directly replace the system prompt,
 * this function can be called to make the persona information available
 * to the backend via the localStorage
 */
export const savePersonaToLocalStorage = (): void => {
  const { getActivePersona } = usePersonaStore.getState();
  const activePersona = getActivePersona();
  
  if (activePersona) {
    // Get current provider 
    const configStr = localStorage.getItem('modelConfig');
    const provider = configStr ? JSON.parse(configStr).provider : 'openai';
    
    // Create a system prompt with the persona
    const personaPrompt = createSystemPromptWithPersona('', activePersona, provider);
    
    // Save to localStorage for the backend to access
    localStorage.setItem('activePersonaPrompt', personaPrompt);
  } else {
    // Clear the persona prompt if no active persona
    localStorage.removeItem('activePersonaPrompt');
  }
};

// Run this when the application loads to ensure the persona is available
savePersonaToLocalStorage(); 