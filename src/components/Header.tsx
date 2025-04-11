import React from 'react';

interface HeaderProps {
  title: string;
  isSidebarVisible?: boolean;
  onMenuClick?: () => void;
  onHelpClick?: () => void;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  isSidebarVisible = false,
  onMenuClick,
  onHelpClick,
  leftContent,
  rightContent,
  className = '',
}) => {
  return (
    <header 
      className={`
        absolute left-0 w-full bg-inherit transition-all duration-300 ease-in-out
        ${isSidebarVisible ? 'w-[calc(100%+300px)] -left-[300px] md:w-full md:left-0' : ''}
        ${className}
      `}
    >
      <div className="mx-auto px-5 py-[50px] flex items-center justify-between gap-4 mt-[5px]">
        <div className="flex items-center gap-4">
          <div className={`
            flex items-center gap-4 whitespace-nowrap
            ${isSidebarVisible ? 'static' : ''}
          `}>
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="bg-transparent border-none cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-bg-op-dark-ultraweak"
              >
                <svg 
                  className="fill-current"
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24"
                >
                  <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                </svg>
              </button>
            )}
            {leftContent}
          </div>
        </div>

        <h1 className="m-0 text-xl">{title}</h1>

        <div className="flex items-center">
          {onHelpClick && (
            <button
              onClick={onHelpClick}
              className="bg-transparent border-none cursor-pointer p-2 rounded-full flex items-center justify-center text-text-weak hover:bg-bg-op-dark-ultraweak hover:text-text"
            >
              <svg 
                className="fill-current"
                width="24" 
                height="24" 
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
              </svg>
            </button>
          )}
          {rightContent}
        </div>
      </div>
    </header>
  );
};

export default Header; 