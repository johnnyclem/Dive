export interface ScheduledItem {
  id: string;
  description: string;
  type: 'once' | 'recurring' | 'interval' | 'heartbeat' | 'runloop';
  schedule: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  nextRunTime: number;
  lastRunTime?: number;
  createdAt: number;
  updatedAt: number;
  createdBy: 'user' | 'agent';
  failReason?: string;
} 