import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EnneagramNumber, Persona, PersonaFormData } from '../../types/Persona';

interface PersonaFormProps {
  persona?: Persona;
  onSubmit: (data: PersonaFormData) => void;
  onCancel: () => void;
}

const emptyFormData: PersonaFormData = {
  name: '',
  age: undefined,
  enneagramNumber: undefined,
  attributes: {},
  backstory: '',
  exampleResponses: [],
  restrictedTopics: [],
  restrictedWords: [],
};

export const PersonaForm: React.FC<PersonaFormProps> = ({
  persona,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<PersonaFormData>(emptyFormData);
  const [newAttribute, setNewAttribute] = useState({ key: '', value: '' });
  const [newResponse, setNewResponse] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [newWord, setNewWord] = useState('');
  
  // Initialize form with existing persona data if editing
  useEffect(() => {
    if (persona) {
      setFormData({
        name: persona.name,
        age: persona.age,
        enneagramNumber: persona.enneagramNumber,
        attributes: { ...persona.attributes },
        backstory: persona.backstory,
        exampleResponses: [...persona.exampleResponses],
        restrictedTopics: [...persona.restrictedTopics],
        restrictedWords: [...persona.restrictedWords],
      });
    }
  }, [persona]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'age') {
      setFormData({ ...formData, [name]: value ? parseInt(value, 10) : undefined });
    } else if (name === 'enneagramNumber') {
      setFormData({ ...formData, [name]: value ? parseInt(value, 10) as EnneagramNumber : undefined });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  
  // Handle attribute operations
  const addAttribute = () => {
    if (newAttribute.key.trim() && newAttribute.value.trim()) {
      setFormData({
        ...formData,
        attributes: {
          ...formData.attributes,
          [newAttribute.key.trim()]: newAttribute.value.trim(),
        },
      });
      setNewAttribute({ key: '', value: '' });
    }
  };
  
  const removeAttribute = (key: string) => {
    const updatedAttributes = { ...formData.attributes };
    delete updatedAttributes[key];
    setFormData({ ...formData, attributes: updatedAttributes });
  };
  
  // Handle example responses
  const addResponse = () => {
    if (newResponse.trim()) {
      setFormData({
        ...formData,
        exampleResponses: [...formData.exampleResponses, newResponse.trim()],
      });
      setNewResponse('');
    }
  };
  
  const removeResponse = (index: number) => {
    setFormData({
      ...formData,
      exampleResponses: formData.exampleResponses.filter((_, i) => i !== index),
    });
  };
  
  // Handle restricted topics
  const addTopic = () => {
    if (newTopic.trim()) {
      setFormData({
        ...formData,
        restrictedTopics: [...formData.restrictedTopics, newTopic.trim()],
      });
      setNewTopic('');
    }
  };
  
  const removeTopic = (index: number) => {
    setFormData({
      ...formData,
      restrictedTopics: formData.restrictedTopics.filter((_, i) => i !== index),
    });
  };
  
  // Handle restricted words
  const addWord = () => {
    if (newWord.trim()) {
      setFormData({
        ...formData,
        restrictedWords: [...formData.restrictedWords, newWord.trim()],
      });
      setNewWord('');
    }
  };
  
  const removeWord = (index: number) => {
    setFormData({
      ...formData,
      restrictedWords: formData.restrictedWords.filter((_, i) => i !== index),
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          {t('personas.form.name')}
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-md border border-border bg-background"
          required
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="age" className="block text-sm font-medium mb-1">
            {t('personas.form.age')}
          </label>
          <input
            type="number"
            id="age"
            name="age"
            value={formData.age || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-md border border-border bg-background"
            min="1"
          />
        </div>
        
        <div>
          <label htmlFor="enneagramNumber" className="block text-sm font-medium mb-1">
            {t('personas.form.enneagram')}
          </label>
          <select
            id="enneagramNumber"
            name="enneagramNumber"
            value={formData.enneagramNumber || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-md border border-border bg-background"
          >
            <option value="">{t('common.select')}</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div>
        <label htmlFor="backstory" className="block text-sm font-medium mb-1">
          {t('personas.form.backstory')}
        </label>
        <textarea
          id="backstory"
          name="backstory"
          value={formData.backstory}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-md border border-border bg-background min-h-[100px]"
          required
        />
      </div>
      
      {/* Attributes section */}
      <div>
        <label className="block text-sm font-medium mb-1">
          {t('personas.form.attributes')}
        </label>
        
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newAttribute.key}
            onChange={(e) => setNewAttribute({ ...newAttribute, key: e.target.value })}
            placeholder={t('personas.form.attributeKey')}
            className="flex-1 px-3 py-2 rounded-md border border-border bg-background"
          />
          <input
            type="text"
            value={newAttribute.value}
            onChange={(e) => setNewAttribute({ ...newAttribute, value: e.target.value })}
            placeholder={t('personas.form.attributeValue')}
            className="flex-1 px-3 py-2 rounded-md border border-border bg-background"
          />
          <button
            type="button"
            onClick={addAttribute}
            className="px-3 py-2 rounded-md bg-accent text-accent-foreground"
          >
            +
          </button>
        </div>
        
        <div className="flex flex-wrap gap-1">
          {Object.entries(formData.attributes).map(([key, value]) => (
            <div key={key} className="flex items-center bg-accent rounded-full px-3 py-1 text-sm">
              <span>{key}: {value}</span>
              <button
                type="button"
                onClick={() => removeAttribute(key)}
                className="ml-1 text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Example Responses section */}
      <div>
        <label className="block text-sm font-medium mb-1">
          {t('personas.form.exampleResponses')}
        </label>
        
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newResponse}
            onChange={(e) => setNewResponse(e.target.value)}
            placeholder={t('personas.form.addResponse')}
            className="flex-1 px-3 py-2 rounded-md border border-border bg-background"
          />
          <button
            type="button"
            onClick={addResponse}
            className="px-3 py-2 rounded-md bg-accent text-accent-foreground"
          >
            +
          </button>
        </div>
        
        <ul className="space-y-1">
          {formData.exampleResponses.map((response, index) => (
            <li key={index} className="flex items-center bg-accent/50 rounded px-3 py-1 text-sm">
              <span className="flex-1">{response}</span>
              <button
                type="button"
                onClick={() => removeResponse(index)}
                className="ml-1 text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Restricted Topics section */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('personas.form.restrictedTopics')}
          </label>
          
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder={t('personas.form.addTopic')}
              className="flex-1 px-3 py-2 rounded-md border border-border bg-background"
            />
            <button
              type="button"
              onClick={addTopic}
              className="px-3 py-2 rounded-md bg-accent text-accent-foreground"
            >
              +
            </button>
          </div>
          
          <ul className="space-y-1">
            {formData.restrictedTopics.map((topic, index) => (
              <li key={index} className="flex items-center bg-destructive/10 text-destructive rounded px-3 py-1 text-sm">
                <span className="flex-1">{topic}</span>
                <button
                  type="button"
                  onClick={() => removeTopic(index)}
                  className="ml-1"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Restricted Words section */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('personas.form.restrictedWords')}
          </label>
          
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder={t('personas.form.addWord')}
              className="flex-1 px-3 py-2 rounded-md border border-border bg-background"
            />
            <button
              type="button"
              onClick={addWord}
              className="px-3 py-2 rounded-md bg-accent text-accent-foreground"
            >
              +
            </button>
          </div>
          
          <ul className="space-y-1">
            {formData.restrictedWords.map((word, index) => (
              <li key={index} className="flex items-center bg-destructive/10 text-destructive rounded px-3 py-1 text-sm">
                <span className="flex-1">{word}</span>
                <button
                  type="button"
                  onClick={() => removeWord(index)}
                  className="ml-1"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md border border-border"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
        >
          {persona ? t('common.update') : t('common.create')}
        </button>
      </div>
    </form>
  );
};

export default PersonaForm; 