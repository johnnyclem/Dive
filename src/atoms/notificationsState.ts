import { atom } from 'jotai';
import { Notification } from '../components/ToastNotifications';

// Atom to store notifications
export const notificationsAtom = atom<Notification[]>([]);

// Atom for showing a toast notification
export const showToastAtom = atom(
  null,
  (get, set, notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const notifications = get(notificationsAtom);
    const id = Math.random().toString(36).substring(2, 9);
    const timestamp = new Date();
    
    set(notificationsAtom, [
      ...notifications,
      { ...notification, id, timestamp }
    ]);
  }
); 