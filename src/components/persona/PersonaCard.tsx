import React from 'react';
import { useTranslation } from 'react-i18next';
import { Persona } from '../../types/Persona';

interface PersonaCardProps {
  persona: Persona;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onActivate: (id: string) => void;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({
  persona,
  onEdit,
  onDelete,
  onActivate,
}) => {
  const { t } = useTranslation();
  
  return (
    <div className={`p-4 rounded-lg border ${persona.isActive ? 'border-primary bg-primary/10' : 'border-border bg-card'} shadow-sm transition-all`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-medium">{persona.name}</h3>
          <div className="text-sm text-muted-foreground">
            {persona.age && <span className="mr-2">{t('personas.age')}: {persona.age}</span>}
            {persona.enneagramNumber && <span>{t('personas.enneagram')}: {persona.enneagramNumber}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onEdit(persona.id)}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            aria-label={t('common.edit')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button 
            onClick={() => onDelete(persona.id)}
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            aria-label={t('common.delete')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      
      <div className="mb-3">
        <div className="text-sm font-medium mb-1">{t('personas.backstory')}</div>
        <p className="text-sm text-muted-foreground line-clamp-2">{persona.backstory}</p>
      </div>
      
      {Object.keys(persona.attributes).length > 0 && (
        <div className="mb-3">
          <div className="text-sm font-medium mb-1">{t('personas.attributes')}</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(persona.attributes).slice(0, 3).map(([key, value]) => (
              <span key={key} className="text-xs px-2 py-1 bg-accent rounded-full">
                {key}: {value}
              </span>
            ))}
            {Object.keys(persona.attributes).length > 3 && (
              <span className="text-xs px-2 py-1 bg-accent rounded-full">
                +{Object.keys(persona.attributes).length - 3}
              </span>
            )}
          </div>
        </div>
      )}
      
      <button
        onClick={() => onActivate(persona.id)}
        className={`w-full py-2 px-3 rounded-md text-sm font-medium ${
          persona.isActive
            ? 'bg-primary/80 text-primary-foreground'
            : 'bg-accent hover:bg-accent/80 text-accent-foreground'
        }`}
      >
        {persona.isActive ? t('personas.active') : t('personas.activate')}
      </button>
    </div>
  );
};

export default PersonaCard; 