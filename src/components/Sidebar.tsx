import React from 'react';

interface SidebarProps {
  isVisible: boolean;
  children: React.ReactNode;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isVisible, children, onToggle }) => {
  return (
    <div 
      className={`
        flex-1 rounded-lg overflow-hidden max-w-[768px] transition-all duration-300 ease-in-out
        ${isVisible 
          ? 'translate-x-0 opacity-100 flex-1 w-auto mx-[15px]' 
          : 'translate-x-[50px] opacity-0 flex-0 w-0 m-0'
        }
      `}
    >
      <div className="h-full rounded-lg bg-[var(--bg)] border border-[var(--border-weak)]">
        {children}
      </div>
      
      <button
        className="absolute top-[15px] right-[15px] bg-transparent border-none cursor-pointer p-[5px] rounded-full hover:bg-[var(--bg-btn-hover)]"
        onClick={onToggle}
      >
        <svg 
          className="fill-[var(--stroke-extremestrong)]" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24"
        >
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
        </svg>
      </button>
    </div>
  );
};

export default Sidebar; 