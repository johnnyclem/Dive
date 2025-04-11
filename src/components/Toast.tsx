import React from 'react';

interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose?: () => void;
}

interface ToastContainerProps {
  children: React.ReactNode;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ children }) => {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 pointer-events-none">
      {children}
    </div>
  );
};

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-[rgba(40,167,69,0.9)]';
      case 'warning':
        return 'bg-[rgba(255,193,7,0.9)]';
      case 'error':
        return 'bg-[rgba(220,53,69,0.9)]';
      default:
        return 'bg-[rgba(0,0,0,0.8)]';
    }
  };

  return (
    <div 
      className={`
        px-6 py-3 rounded-lg text-white text-sm animate-[toastIn_0.3s_ease] pointer-events-auto
        ${getBackgroundColor()}
      `}
    >
      <div className="flex items-center gap-2">
        <span>{message}</span>
        {onClose && (
          <button
            className="bg-transparent border-none p-1 cursor-pointer text-white opacity-70 hover:opacity-100 flex items-center justify-center transition-opacity duration-200"
            onClick={onClose}
          >
            <svg 
              className="fill-current" 
              width="16" 
              height="16" 
              viewBox="0 0 16 16"
            >
              <path d="M8 6.586L3.707 2.293 2.293 3.707 6.586 8l-4.293 4.293 1.414 1.414L8 9.414l4.293 4.293 1.414-1.414L9.414 8l4.293-4.293-1.414-1.414L8 6.586z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast; 