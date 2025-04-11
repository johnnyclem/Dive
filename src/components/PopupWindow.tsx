import React from 'react';

interface PopupWindowProps {
  children: React.ReactNode;
  isVisible: boolean;
  variant?: 'default' | 'transparent' | 'overlay';
  fullWidth?: boolean;
  isSidebarVisible?: boolean;
  className?: string;
}

export const PopupWindow: React.FC<PopupWindowProps> = ({
  children,
  isVisible,
  variant = 'default',
  fullWidth = false,
  isSidebarVisible = false,
  className = '',
}) => {
  if (!isVisible) return null;

  const getContainerClasses = () => {
    const baseClasses = 'fixed flex justify-center items-center inset-0';
    
    switch (variant) {
      case 'transparent':
        return `${baseClasses} bg-transparent pointer-events-none [&>div]:pointer-events-auto`;
      case 'overlay':
        return `
          ${baseClasses} bg-bg-op-dark-ultrastrong z-[900]
          ${isSidebarVisible && !fullWidth
            ? 'left-[300px] w-[calc(100vw-300px)] md:left-0 md:w-full'
            : 'left-0 w-full'
          }
          transition-all duration-300 ease-in-out
          [&>div]:w-full [&>div]:h-full
        `;
      default:
        return `${baseClasses} bg-bg-overlay pointer-events-auto`;
    }
  };

  return (
    <div className={`${getContainerClasses()} ${className}`}>
      {children}
    </div>
  );
};

export default PopupWindow;
