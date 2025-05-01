import React, { useEffect, useState } from 'react';
import './ToastNotifications.css';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: Date;
}

interface ToastNotificationsProps {
  notifications: Notification[];
}

const ToastNotifications: React.FC<ToastNotificationsProps> = ({ notifications }) => {
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // When new notifications come in, add them to visible notifications
    if (notifications.length > 0) {
      const latestNotification = notifications[notifications.length - 1];
      setVisibleNotifications(prev => [...prev, latestNotification]);
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setVisibleNotifications(prev => 
          prev.filter(n => n.id !== latestNotification.id)
        );
      }, 5000);
    }
  }, [notifications]);

  return (
    <div className="toast-container">
      {visibleNotifications.map(notification => (
        <div 
          key={notification.id} 
          className={`toast-notification toast-${notification.type}`}
        >
          <div className="toast-content">
            <span className="toast-message">{notification.message}</span>
          </div>
          <button 
            className="toast-close" 
            onClick={() => {
              setVisibleNotifications(prev => 
                prev.filter(n => n.id !== notification.id)
              );
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastNotifications; 