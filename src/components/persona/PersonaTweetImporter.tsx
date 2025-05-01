import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PersonaFormData } from '../../types/Persona';

interface PersonaTweetImporterProps {
  onComplete: (data: PersonaFormData) => void;
  onCancel: () => void;
}

export const PersonaTweetImporter: React.FC<PersonaTweetImporterProps> = ({
  onComplete,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      // Check if the file is JSON
      if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json')) {
        setError(t('personas.importer.invalidFileType'));
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError(null);
    }
  };
  
  const handleImport = async () => {
    if (!file) return;
    
    setIsLoading(true);
    setProgress(0);
    
    try {
      // Read the file
      const text = await readFileAsText(file, (progress) => {
        setProgress(Math.round(progress * 30)); // First 30% is reading the file
      });
      
      // Parse the JSON to validate it's valid
      // In a real implementation, we would use the tweets data for analysis
      JSON.parse(text);
      
      // Simulate processing tweets (would be replaced with actual LLM call)
      let processingProgress = 0;
      const interval = setInterval(() => {
        processingProgress += 5;
        setProgress(30 + Math.min(processingProgress, 70)); // Remaining 70% for processing
        
        if (processingProgress >= 70) {
          clearInterval(interval);
          
          // Create a sample persona from tweets
          const samplePersona: PersonaFormData = {
            name: 'Twitter Persona',
            age: undefined,
            enneagramNumber: undefined,
            attributes: {
              'tweeting style': 'Casual and informative',
              'interests': 'Technology, AI, and design'
            },
            backstory: 'Generated from Twitter activity patterns spanning several years. This persona represents your online presence.',
            exampleResponses: [
              "I'm excited about the future of AI!",
              "Just launched a new project today.",
              "What are your thoughts on this design?"
            ],
            restrictedTopics: ['Politics', 'Religion'],
            restrictedWords: [],
          };
          
          setIsLoading(false);
          onComplete(samplePersona);
        }
      }, 100);
      
    } catch (error) {
      // Log error in development
      console.error("Error parsing tweet data:", error);
      setError(t('personas.importer.parseError'));
      setIsLoading(false);
    }
  };
  
  const readFileAsText = (file: File, onProgress: (progress: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = event.loaded / event.total;
          onProgress(progress);
        }
      };
      
      reader.onload = (event) => {
        if (event.target) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      
      reader.onerror = () => {
        reject(reader.error);
      };
      
      reader.readAsText(file);
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-lg font-medium mb-2">{t('personas.importer.title')}</h2>
        <p className="text-muted-foreground mb-6">{t('personas.importer.description')}</p>
        
        {isLoading ? (
          <div className="text-center p-6">
            <div className="h-4 w-full bg-accent rounded-full overflow-hidden mb-4">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p>{t('personas.importer.analyzing')}</p>
          </div>
        ) : (
          <div>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 mx-auto mb-2 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              
              <p className="mb-2 text-sm text-foreground">
                <span className="font-medium">{t('personas.importer.dragDrop')}</span> {t('personas.importer.dragDropOr')}
              </p>
              
              <input
                id="tweet-file"
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
              />
              
              <label
                htmlFor="tweet-file"
                className="inline-block px-4 py-2 bg-primary rounded-md text-primary-foreground text-sm font-medium cursor-pointer"
              >
                {t('personas.importer.selectFile')}
              </label>
              
              {file && (
                <div className="mt-3 px-3 py-1 bg-accent rounded-full text-sm inline-block">
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </div>
              )}
            </div>
            
            {error && (
              <div className="mt-3 p-2 bg-destructive/10 text-destructive rounded text-sm">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="flex justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-md border border-border"
        >
          {t('common.cancel')}
        </button>
        
        <button
          onClick={handleImport}
          disabled={!file || isLoading}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          {t('personas.importer.import')}
        </button>
      </div>
    </div>
  );
};

export default PersonaTweetImporter; 