import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

interface DropdownProps {
  items: DropdownItem[];
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  fill?: boolean;
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  items,
  trigger,
  align = 'start',
  side = 'bottom',
  fill = false,
  className = '',
}) => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={`
            bg-bg-medium text-text-medium shadow-modal rounded-md py-2 z-[2500] overflow-y-auto
            min-w-[250px] max-w-[300px]
            ${fill ? 'w-[var(--radix-popper-anchor-width)] max-w-none' : ''}
            ${className}
          `}
          align={align}
          side={side}
          sideOffset={5}
        >
          {items.map((item, index) => (
            <DropdownMenu.Item
              key={index}
              className="outline-none data-[highlighted]:bg-bg-op-dark-ultraweak"
              disabled={item.disabled}
              onSelect={item.onClick}
            >
              <div className="flex items-center gap-3 px-2 py-1.5 cursor-pointer select-none">
                {item.icon && (
                  <div className="m-0">
                    {item.icon}
                  </div>
                )}
                <span className="flex-1">{item.label}</span>
              </div>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default Dropdown;
