export type EnneagramNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Persona {
  id: string;
  name: string;
  age?: number;
  enneagramNumber?: EnneagramNumber;
  attributes: { [key: string]: string };
  backstory: string;
  exampleResponses: string[];
  restrictedTopics: string[];
  restrictedWords: string[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PersonaFormData {
  name: string;
  age?: number;
  enneagramNumber?: EnneagramNumber;
  attributes: { [key: string]: string };
  backstory: string;
  exampleResponses: string[];
  restrictedTopics: string[];
  restrictedWords: string[];
} 