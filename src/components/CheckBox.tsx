import React from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'default' | 's';
  label?: string;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'default',
  label,
  className = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <div className={`inline-block leading-none ${className}`}>
      <label 
        className={`
          cursor-pointer inline-flex items-center gap-2 m-0 leading-normal
          ${disabled ? 'cursor-default' : ''}
          ${size === 's' ? 'gap-2' : 'gap-2'}
        `}
      >
        <div className={`
          flex items-center justify-center
          ${size === 's' ? 'w-4 h-4' : 'w-[22px] h-[22px]'}
          ${disabled ? 'opacity-30' : ''}
        `}>
          <input
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            className="hidden"
          />
          <div 
            className={`
              flex items-center justify-center relative z-0
              ${size === 's' ? 'w-4 h-4 rounded-[2px]' : 'w-[22px] h-[22px] rounded'}
              ${checked 
                ? 'bg-pri-green border-2 border-pri-green' 
                : 'border-2 border-stroke-dark-weak'
              }
              ${!disabled && 'hover:border-stroke-dark-weak hover:before:content-[""] hover:before:block hover:before:bg-bg-inverted-op-dark-mediumweak hover:before:rounded-full hover:before:opacity-100 hover:before:cursor-pointer hover:before:z-[-1] hover:before:absolute hover:before:-top-[9px] hover:before:-left-[9px] hover:before:-right-[9px] hover:before:-bottom-[9px]'}
            `}
          >
            {checked && (
              <svg 
                className="text-stroke-light-extremestrong w-[22px] h-[22px]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
            )}
          </div>
        </div>
        {label && <span>{label}</span>}
      </label>
    </div>
  );
};

export default Checkbox;
