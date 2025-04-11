import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

interface ResponsiveSidebarProps {
  menuItems: MenuItem[];
}

const ResponsiveSidebar: React.FC<ResponsiveSidebarProps> = ({ menuItems }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={`
        fixed 
        top-0 
        left-0 
        h-screen 
        bg-white 
        dark:bg-gray-800 
        shadow-lg 
        transition-all 
        duration-300 
        ease-in-out
        ${isExpanded ? 'w-64' : 'min-w-[50px] w-[50px]'}
      `}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="
          absolute 
          -right-3 
          top-4 
          bg-white 
          dark:bg-gray-800 
          rounded-full 
          p-1.5 
          shadow-md 
          hover:bg-gray-100 
          dark:hover:bg-gray-700 
          focus:outline-none 
          focus:ring-2 
          focus:ring-blue-500
        "
        aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        aria-expanded={isExpanded}
      >
        <svg
          className={`
            w-4 
            h-4 
            text-gray-600 
            dark:text-gray-300 
            transform 
            transition-transform 
            duration-300
            ${isExpanded ? 'rotate-180' : ''}
          `}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      {/* Menu Items */}
      <nav className="h-full pt-16">
        <ul className="space-y-2 px-2">
          {menuItems.map((item, index) => (
            <li key={index}>
              <Link
                to={item.path}
                className={`
                  flex 
                  items-center 
                  px-2 
                  py-3 
                  rounded-lg 
                  transition-colors 
                  duration-200
                  ${location.pathname === item.path
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                aria-label={isExpanded ? item.label : `${item.label} menu item`}
              >
                <div className="min-w-[24px] flex items-center justify-center">
                  {item.icon}
                </div>
                {isExpanded && (
                  <span className="ml-3 text-sm font-medium">
                    {item.label}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default ResponsiveSidebar; 