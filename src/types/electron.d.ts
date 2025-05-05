export {};

declare global {
  // Mirror the shape of AgentTask from backend
  export interface AgentTask {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    sequence: number;
    resultSummary?: string;
    failReason?: string;
  }

  interface ElectronTasksAPI {
    list(status?: string): Promise<AgentTask[]>;
    add(description: string): Promise<AgentTask>;
    complete(id: string, resultSummary?: string): Promise<AgentTask>;
    fail(id: string, reason: string): Promise<AgentTask>;
  }

  interface CustomIpcRenderer extends Electron.IpcRenderer {
    // Agent Task management API
    tasks: ElectronTasksAPI;
  }

  interface ElectronAPI {
    ipcRenderer: CustomIpcRenderer;
    // ...other exposed APIs...
  }

  interface Window {
    electron: ElectronAPI;
  }
} 