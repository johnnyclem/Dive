import React from 'react';

interface ModelSelectProps {
  isSidebarVisible: boolean;
  isDisabled?: boolean;
  selectedModel?: {
    id: string;
    name: string;
    icon?: string;
  };
  onAddClick?: () => void;
  onSelect?: (modelId: string) => void;
  className?: string;
}

export const ModelSelect: React.FC<ModelSelectProps> = ({
  isSidebarVisible,
  isDisabled = false,
  selectedModel,
  onAddClick,
  onSelect,
  className = '',
}) => {
  return (
    <div
      className={`
        flex items-center justify-start gap-2.5 h-10 absolute
        transition-all duration-300 ease-in-out
        ${isSidebarVisible
          ? 'left-[305px] w-[calc(100%-36px-16px-5px-20px-300px)] md:left-[141px] md:w-[calc(100%-125px-36px-32px-40px)]'
          : 'left-[141px] w-[calc(100%-125px-36px-32px-40px)]'
        }
        ${className}
      `}
    >
      <button
        className={`
          w-full max-w-[475px] h-full rounded-lg
          ${isDisabled ? 'pointer-events-none bg-bg-op-dark-ultraweak' : ''}
        `}
        onClick={() => onSelect?.(selectedModel?.id || '')}
        disabled={isDisabled}
      >
        <div className="flex items-center gap-2.5 w-full">
          {selectedModel?.icon && (
            <img
              src={selectedModel.icon}
              alt={selectedModel.name}
              className="w-[22px] h-[22px]"
            />
          )}
          <span className="flex-1 max-w-[420px] truncate break-all">
            {selectedModel?.name || 'Select Model'}
          </span>
        </div>
      </button>

      <button
        onClick={onAddClick}
        className="w-10 h-10 p-2 rounded-xl bg-transparent border-2 border-border-weak
                 hover:border-border-weak hover:bg-bg-op-dark-ultraweak hover:shadow-none
                 transition-all duration-200"
      >
        <svg
          className="w-4 h-4 fill-stroke-op-dark-extremestrong"
          viewBox="0 0 24 24"
        >
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </button>
    </div>
  );
};

export const ModelSelectContent: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`min-w-[475px] scrollbar ${className}`}>
      {children}
    </div>
  );
};

export const ModelSelectLabel: React.FC<{
  icon?: string;
  text: string;
  className?: string;
}> = ({ icon, text, className = '' }) => {
  return (
    <div className={`flex items-center gap-2.5 w-full ${className}`}>
      {icon && (
        <img
          src={icon}
          alt=""
          className="w-[22px] h-[22px] filter-dark"
        />
      )}
      <span className="flex-1 max-w-[420px] truncate break-all">
        {text}
      </span>
    </div>
  );
};

export default ModelSelect;
