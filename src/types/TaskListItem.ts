export interface TaskListItem {
  id: string;
  title: string;
  description?: string;
  isComplete: boolean;
  createdAt: number;
  updatedAt: number;
} 