import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PersonaFormData, EnneagramNumber } from '../../types/Persona';

interface PersonaAICreatorProps {
  onComplete: (data: PersonaFormData) => void;
  onCancel: () => void;
}

export const PersonaAICreator: React.FC<PersonaAICreatorProps> = ({
  onComplete,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [userResponses, setUserResponses] = useState<Record<string, string>>({});
  const [currentResponse, setCurrentResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Example questions to ask the user
  const questions = [
    { id: 'name', text: t('personas.creator.nameQuestion') },
    { id: 'age', text: t('personas.creator.ageQuestion') },
    { id: 'enneagram', text: t('personas.creator.enneagramQuestion') },
    { id: 'personality', text: t('personas.creator.personalityQuestion') },
    { id: 'backstory', text: t('personas.creator.backstoryQuestion') },
    { id: 'speaking', text: t('personas.creator.speakingStyleQuestion') },
    { id: 'avoid', text: t('personas.creator.avoidTopicsQuestion') },
  ];
  
  const handleNextQuestion = () => {
    if (currentResponse.trim()) {
      setUserResponses({
        ...userResponses,
        [questions[step].id]: currentResponse.trim(),
      });
      setCurrentResponse('');
      
      if (step < questions.length - 1) {
        setStep(step + 1);
      } else {
        // Process all responses and generate the persona
        generatePersona();
      }
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNextQuestion();
    }
  };
  
  const generatePersona = async () => {
    setIsProcessing(true);
    
    // TODO: Replace with actual LLM integration
    // This would be a call to your inference API with the user responses
    
    // Simulate API delay for now
    setTimeout(() => {
      // Generate a sample persona based on the responses
      const samplePersona: PersonaFormData = {
        name: userResponses.name || 'Unnamed Persona',
        age: userResponses.age ? parseInt(userResponses.age) : undefined,
        enneagramNumber: userResponses.enneagram ? parseInt(userResponses.enneagram) as EnneagramNumber : undefined,
        attributes: {
          'personality': userResponses.personality || 'Not specified',
          'speaking style': userResponses.speaking || 'Not specified',
        },
        backstory: userResponses.backstory || 'No backstory provided',
        exampleResponses: [],
        restrictedTopics: userResponses.avoid 
          ? userResponses.avoid.split(',').map(topic => topic.trim()) 
          : [],
        restrictedWords: [],
      };
      
      setIsProcessing(false);
      onComplete(samplePersona);
    }, 2000);
  };
  
  const currentQuestion = step < questions.length ? questions[step] : null;
  
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-lg font-medium mb-2">{t('personas.creator.title')}</h2>
        <p className="text-muted-foreground mb-6">{t('personas.creator.description')}</p>
        
        {isProcessing ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>{t('personas.creator.generating')}</p>
          </div>
        ) : currentQuestion ? (
          <div>
            <div className="mb-6">
              <div className="bg-accent/30 rounded-lg p-3 mb-4">
                <p className="font-medium">{currentQuestion.text}</p>
              </div>
              
              <div className="space-y-2">
                {Object.entries(userResponses).map(([id, response]) => (
                  <div key={id} className="flex">
                    <div className="bg-primary/10 rounded-l-lg p-2 flex items-center">
                      <span className="text-sm font-medium">{t(`personas.creator.${id}Label`)}</span>
                    </div>
                    <div className="bg-card rounded-r-lg border-y border-r border-border p-2 flex-1">
                      <p className="text-sm">{response}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <textarea
                value={currentResponse}
                onChange={(e) => setCurrentResponse(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={t('personas.creator.responsePlaceholder')}
                className="flex-1 px-3 py-2 rounded-md border border-border bg-background min-h-[80px]"
              />
              <button
                onClick={handleNextQuestion}
                disabled={!currentResponse.trim()}
                className="px-4 self-end py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              >
                {step === questions.length - 1 ? t('common.finish') : t('common.next')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      
      <div className="flex justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-md border border-border"
        >
          {t('common.cancel')}
        </button>
        
        <div className="text-sm text-muted-foreground">
          {t('personas.creator.stepIndicator', { current: step + 1, total: questions.length })}
        </div>
      </div>
    </div>
  );
};

export default PersonaAICreator; 