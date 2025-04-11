import React from 'react';

interface InfoTooltipProps {
  children: React.ReactNode;
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  children,
  content,
  side = 'top',
  className = '',
}) => {
  const getAnimationClass = () => {
    switch (side) {
      case 'top':
        return 'animate-slideDownAndFade';
      case 'right':
        return 'animate-slideLeftAndFade';
      case 'bottom':
        return 'animate-slideUpAndFade';
      case 'left':
        return 'animate-slideRightAndFade';
      default:
        return 'animate-slideDownAndFade';
    }
  };

  return (
    <div className="relative inline-block group">
      {children}
      <div
        className={`
          absolute z-[2500] flex items-center gap-1 p-4 rounded text-sm leading-5
          bg-bg-weak text-text-medium select-none whitespace-pre-line
          shadow-[0px_3px_7px_var(--shadow)]
          will-change-transform-opacity
          ${getAnimationClass()}
          ${className}
          ${side === 'top' ? 'bottom-full mb-2' : ''}
          ${side === 'right' ? 'left-full ml-2' : ''}
          ${side === 'bottom' ? 'top-full mt-2' : ''}
          ${side === 'left' ? 'right-full mr-2' : ''}
        `}
      >
        {content}
        <div
          className={`
            absolute w-2 h-2 rotate-45
            ${side === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2 bg-bg-weak' : ''}
            ${side === 'right' ? 'left-[-4px] top-1/2 -translate-y-1/2 bg-bg-weak' : ''}
            ${side === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2 bg-bg-weak' : ''}
            ${side === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2 bg-bg-weak' : ''}
          `}
        />
      </div>
    </div>
  );
};

export default InfoTooltip;
