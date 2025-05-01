import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Persona, PersonaFormData } from '../types/Persona';
import { createSystemPromptWithPersona } from '../utils/personaPromptUtils';

interface PersonaStore {
  personas: Persona[];
  activePersonaId: string | null;
  
  // Actions
  addPersona: (personaData: PersonaFormData) => void;
  updatePersona: (id: string, personaData: Partial<PersonaFormData>) => void;
  deletePersona: (id: string) => void;
  activatePersona: (id: string) => void;
  deactivatePersona: () => void;
  getActivePersona: () => Persona | null;
  importFromTweets: (tweets: string[]) => void;
}

// Helper function to update localStorage when active persona changes
const updateActivePersonaInLocalStorage = (activePersona: Persona | null) => {
  if (activePersona) {
    try {
      // Get current provider from localStorage
      const configStr = localStorage.getItem('modelConfig');
      const provider = configStr ? JSON.parse(configStr).provider : 'openai';
      
      // Create a system prompt with the persona and store it
      const personaPrompt = createSystemPromptWithPersona('', activePersona, provider);
      localStorage.setItem('activePersonaPrompt', personaPrompt);
      
      // Also store the active persona ID for quick access
      localStorage.setItem('activePersonaId', activePersona.id);
    } catch (error) {
      console.error('Failed to update active persona in localStorage:', error);
    }
  } else {
    // Clear persona data if no active persona
    localStorage.removeItem('activePersonaPrompt');
    localStorage.removeItem('activePersonaId');
  }
};

export const usePersonaStore = create<PersonaStore>()(
  persist(
    (set, get) => ({
      personas: [],
      activePersonaId: null,
      
      addPersona: (personaData: PersonaFormData) => {
        const newPersona: Persona = {
          id: uuidv4(),
          ...personaData,
          isActive: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        
        set((state) => ({
          personas: [...state.personas, newPersona],
        }));
      },
      
      updatePersona: (id: string, personaData: Partial<PersonaFormData>) => {
        set((state) => {
          const updatedPersonas = state.personas.map((persona) => 
            persona.id === id 
              ? { ...persona, ...personaData, updatedAt: Date.now() } 
              : persona
          );
          
          // If we're updating the active persona, update localStorage
          const activePersona = updatedPersonas.find(p => p.id === state.activePersonaId);
          if (activePersona) {
            updateActivePersonaInLocalStorage(activePersona);
          }
          
          return {
            personas: updatedPersonas,
          };
        });
      },
      
      deletePersona: (id: string) => {
        set((state) => {
          // If deleting the active persona, clear localStorage
          if (state.activePersonaId === id) {
            updateActivePersonaInLocalStorage(null);
          }
          
          return {
            personas: state.personas.filter((persona) => persona.id !== id),
            activePersonaId: state.activePersonaId === id ? null : state.activePersonaId,
          };
        });
      },
      
      activatePersona: (id: string) => {
        set((state) => {
          const updatedPersonas = state.personas.map((persona) => ({
            ...persona,
            isActive: persona.id === id,
          }));
          
          // Get the newly activated persona and update localStorage
          const activePersona = updatedPersonas.find(p => p.id === id) || null;
          updateActivePersonaInLocalStorage(activePersona);
          
          return {
            personas: updatedPersonas,
            activePersonaId: id,
          };
        });
      },
      
      deactivatePersona: () => {
        set((state) => {
          // Clear localStorage when deactivating
          updateActivePersonaInLocalStorage(null);
          
          return {
            personas: state.personas.map((persona) => ({
              ...persona,
              isActive: false,
            })),
            activePersonaId: null,
          };
        });
      },
      
      getActivePersona: () => {
        const { personas, activePersonaId } = get();
        return personas.find((persona) => persona.id === activePersonaId) || null;
      },
      
      importFromTweets: (tweets: string[]) => {
        // This will be implemented to use LLM to analyze tweets
        // and create a persona based on the content
        console.log('Import from tweets functionality will be implemented', tweets);
      },
    }),
    {
      name: 'persona-storage',
    }
  )
); 