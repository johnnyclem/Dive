import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { ScheduledItem } from '../types/ScheduledItem';

interface ScheduledItemStore {
  scheduledItems: ScheduledItem[];
  addScheduledItem: (data: { description: string; type: ScheduledItem['type']; schedule: string; createdBy?: 'user' | 'agent' }) => void;
  updateScheduledItem: (id: string, data: Partial<Omit<ScheduledItem, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteScheduledItem: (id: string) => void;
  getAllScheduledItems: () => ScheduledItem[];
}

export const useScheduledItemStore = create<ScheduledItemStore>()(
  persist(
    (set, get) => ({
      scheduledItems: [],
      addScheduledItem: (data) => {
        const now = Date.now();
        const newItem: ScheduledItem = {
          id: uuidv4(),
          description: data.description,
          type: data.type,
          schedule: data.schedule,
          status: 'active',
          nextRunTime: now,
          lastRunTime: undefined,
          createdAt: now,
          updatedAt: now,
          createdBy: data.createdBy ?? 'user',
          failReason: undefined,
        };
        set((state) => ({ scheduledItems: [...state.scheduledItems, newItem] }));
      },
      updateScheduledItem: (id, data) => {
        set((state) => ({
          scheduledItems: state.scheduledItems.map((item) =>
            item.id === id ? { ...item, ...data, updatedAt: Date.now() } : item
          ),
        }));
      },
      deleteScheduledItem: (id) => {
        set((state) => ({ scheduledItems: state.scheduledItems.filter((item) => item.id !== id) }));
      },
      getAllScheduledItems: () => get().scheduledItems,
    }),
    {
      name: 'scheduled-item-storage',
    }
  )
); 