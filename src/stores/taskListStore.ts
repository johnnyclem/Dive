import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { TaskListItem } from '../types/TaskListItem';

interface TaskListStore {
  tasks: TaskListItem[];
  addTask: (data: { title: string; description?: string }) => void;
  updateTask: (id: string, data: Partial<Pick<TaskListItem, 'title' | 'description'>>) => void;
  toggleComplete: (id: string) => void;
  deleteTask: (id: string) => void;
  getAllTasks: () => TaskListItem[];
}

export const useTaskListStore = create<TaskListStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      addTask: (data) => {
        const now = Date.now();
        const newTask: TaskListItem = {
          id: uuidv4(),
          title: data.title,
          description: data.description,
          isComplete: false,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
      },
      updateTask: (id, data) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...data, updatedAt: Date.now() } : t
          ),
        }));
      },
      toggleComplete: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? { ...t, isComplete: !t.isComplete, updatedAt: Date.now() }
              : t
          ),
        }));
      },
      deleteTask: (id) => {
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
      },
      getAllTasks: () => get().tasks,
    }),
    {
      name: 'task-list-storage',
    }
  )
); 