import React, { createContext, useContext, ReactNode } from 'react';

// Define the context type
interface ElectronContextType {
  ipc: any | null;
}

// Create the context with a default value
const ElectronContext = createContext<ElectronContextType>({ ipc: null });

// Provider props type
interface ElectronProviderProps {
  children: ReactNode;
  value: ElectronContextType;
}

// Provider component
export const ElectronProvider: React.FC<ElectronProviderProps> = ({ children, value }) => {
  return (
    <ElectronContext.Provider value={value}>
      {children}
    </ElectronContext.Provider>
  );
};

// Hook to use the electron context
export const useElectronContext = () => useContext(ElectronContext); 