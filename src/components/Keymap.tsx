import React from 'react';

interface KeymapItem {
  event: string;
  shortcut: string;
}

interface KeymapRow {
  items: KeymapItem[];
}

interface KeymapProps {
  rows: KeymapRow[];
  title?: string;
  className?: string;
}

export const Keymap: React.FC<KeymapProps> = ({
  rows,
  title,
  className = '',
}) => {
  return (
    <div className={`min-w-[720px] ${className}`}>
      {title && <h3 className="m-0">{title}</h3>}
      <div className="flex flex-col gap-3 py-2 max-h-[70vh] overflow-y-auto flex-1">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`flex gap-6 ${
              row.items.length === 1 ? 'single-item-row' : ''
            }`}
          >
            {row.items.map((item, itemIndex) => (
              <div
                key={itemIndex}
                className={`
                  flex flex-1 justify-between items-center gap-4 p-2 rounded-lg
                  hover:bg-bg-op-dark-extremeweak
                  ${row.items.length === 1 ? 'max-w-[calc(50%-12px)]' : ''}
                `}
              >
                <span className="text-sm text-justify">{item.event}</span>
                <div className="keymap-shortcut">
                  <kbd className="inline-block px-1.5 py-0.5 text-xs bg-bg-op-dark-ultraweak rounded shadow-[0_1px_0_var(--border-weak)] whitespace-nowrap">
                    {item.shortcut}
                  </kbd>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const KeymapPopup: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`bg-bg-medium ${className}`}>
      {children}
    </div>
  );
};

export const KeymapPopupHeader: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`bg-bg-ultraweak ${className}`}>
      {children}
    </div>
  );
};

export const KeymapPopupFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`bg-bg-ultraweak ${className}`}>
      {children}
    </div>
  );
};

export default Keymap; 