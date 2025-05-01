import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Persona, PersonaFormData } from '../types/Persona';
import { usePersonaStore } from '../stores/personaStore';
import PersonaCard from '../components/persona/PersonaCard';
import PersonaForm from '../components/persona/PersonaForm';
import PersonaAICreator from '../components/persona/PersonaAICreator';
import PersonaTweetImporter from '../components/persona/PersonaTweetImporter';

enum CreationMode {
  NONE,
  MANUAL,
  AI_ASSISTED,
  TWEET_IMPORT
}

const PersonasPage: React.FC = () => {
  const { t } = useTranslation();
  const [creationMode, setCreationMode] = useState<CreationMode>(CreationMode.NONE);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [personaToDelete, setPersonaToDelete] = useState<string | null>(null);
  
  const {
    personas,
    addPersona,
    updatePersona,
    deletePersona,
    activatePersona,
    deactivatePersona,
  } = usePersonaStore();
  
  const handleCreatePersona = () => {
    setCreationMode(CreationMode.MANUAL);
    setEditingPersona(null);
  };
  
  const handleCreateWithAI = () => {
    setCreationMode(CreationMode.AI_ASSISTED);
    setEditingPersona(null);
  };
  
  const handleImportFromTweets = () => {
    setCreationMode(CreationMode.TWEET_IMPORT);
    setEditingPersona(null);
  };
  
  const handleEditPersona = (id: string) => {
    const persona = personas.find(p => p.id === id);
    if (persona) {
      setEditingPersona(persona);
      setCreationMode(CreationMode.MANUAL);
    }
  };
  
  const handleDeletePersona = (id: string) => {
    setPersonaToDelete(id);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (personaToDelete) {
      deletePersona(personaToDelete);
      setIsDeleteDialogOpen(false);
      setPersonaToDelete(null);
    }
  };
  
  const handlePersonaActivation = (id: string) => {
    const persona = personas.find(p => p.id === id);
    if (persona) {
      if (persona.isActive) {
        deactivatePersona();
      } else {
        activatePersona(id);
      }
    }
  };
  
  const handleFormSubmit = (data: PersonaFormData) => {
    if (editingPersona) {
      updatePersona(editingPersona.id, data);
    } else {
      addPersona(data);
    }
    setCreationMode(CreationMode.NONE);
    setEditingPersona(null);
  };
  
  const handleCancelCreation = () => {
    setCreationMode(CreationMode.NONE);
    setEditingPersona(null);
  };
  
  const renderContent = () => {
    switch (creationMode) {
      case CreationMode.MANUAL:
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-medium mb-4">
              {editingPersona ? t('personas.edit') : t('personas.create')}
            </h2>
            <PersonaForm
              persona={editingPersona || undefined}
              onSubmit={handleFormSubmit}
              onCancel={handleCancelCreation}
            />
          </div>
        );
        
      case CreationMode.AI_ASSISTED:
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-medium mb-4">{t('personas.createWithAI')}</h2>
            <PersonaAICreator
              onComplete={handleFormSubmit}
              onCancel={handleCancelCreation}
            />
          </div>
        );
        
      case CreationMode.TWEET_IMPORT:
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-medium mb-4">{t('personas.importFromTweets')}</h2>
            <PersonaTweetImporter
              onComplete={handleFormSubmit}
              onCancel={handleCancelCreation}
            />
          </div>
        );
        
      default:
        return (
          <>
            <header className="mb-6 flex justify-between items-center">
              <h1 className="text-2xl font-semibold">{t("personas.title")}</h1>
              
              <div className="flex gap-2">
                <div className="relative">
                  <button
                    onClick={handleCreatePersona}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    {t('personas.create')}
                  </button>
                  
                  <div className="absolute right-0 mt-1 z-10 w-48 bg-card rounded-md shadow-lg border border-border overflow-hidden">
                    <button
                      onClick={handleCreateWithAI}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Z"/><path d="M2 12h1a2 2 0 0 1 2 2v1a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-1a2 2 0 0 1 2-2h1"/></svg>
                      {t('personas.createWithAI')}
                    </button>
                    <button
                      onClick={handleImportFromTweets}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" x2="22" y1="5" y2="5"/><line x1="19" x2="19" y1="2" y2="8"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                      {t('personas.importFromTweets')}
                    </button>
                  </div>
                </div>
              </div>
            </header>
            
            {personas.length === 0 ? (
              <div className="p-8 text-center bg-card rounded-lg border border-border shadow-sm">
                <div className="mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                </div>
                <h3 className="text-lg font-medium mb-1">{t('personas.noPersonas')}</h3>
                <p className="text-muted-foreground mb-4">{t('personas.createPrompt')}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={handleCreatePersona}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
                  >
                    {t('personas.create')}
                  </button>
                  <button
                    onClick={handleCreateWithAI}
                    className="px-4 py-2 bg-accent text-accent-foreground rounded-md"
                  >
                    {t('personas.createWithAI')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {personas.map(persona => (
                  <PersonaCard
                    key={persona.id}
                    persona={persona}
                    onEdit={handleEditPersona}
                    onDelete={handleDeletePersona}
                    onActivate={handlePersonaActivation}
                  />
                ))}
              </div>
            )}
          </>
        );
    }
  };
  
  // Delete confirmation dialog
  const renderDeleteDialog = () => {
    if (!isDeleteDialogOpen) return null;
    
    const persona = personas.find(p => p.id === personaToDelete);
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background rounded-lg shadow-lg max-w-md w-full p-6">
          <h3 className="text-lg font-medium mb-4">{t('personas.deleteConfirmTitle')}</h3>
          <p className="mb-6">{t('personas.deleteConfirmText', { name: persona?.name })}</p>
          
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsDeleteDialogOpen(false)}
              className="px-4 py-2 rounded-md border border-border"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground"
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      {renderContent()}
      {renderDeleteDialog()}
    </div>
  );
};

export default PersonasPage;