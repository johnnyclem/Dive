import React from 'react';

interface SystemItem {
  name: string;
  icon?: React.ReactNode;
}

interface SystemProps {
  items?: SystemItem[];
  title?: string;
}

export const System: React.FC<SystemProps> = ({ 
  items = [], 
  title = "System" 
}) => {
  return (
    <div className="w-full max-w-[800px] min-h-[calc(100vh-85px)] flex flex-col">
      <h1 className="m-0 text-[28px]">{title}</h1>
      
      <div className="flex justify-between items-start mb-[34px] relative">
        {/* System header content */}
      </div>

      <div className="mb-4 rounded-lg overflow-hidden bg-bg-medium shadow-modal-light">
        {items.map((item, index) => (
          <div key={index} className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              {item.icon && (
                <div className="w-6 h-6 opacity-70">
                  {item.icon}
                </div>
              )}
              <span className="font-medium">{item.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default System; 