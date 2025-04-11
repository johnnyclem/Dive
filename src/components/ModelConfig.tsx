import React from 'react';

interface ModelConfigProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onVerify: () => void;
  isLoading?: boolean;
  isVerifying?: boolean;
  className?: string;
}

export const ModelConfig: React.FC<ModelConfigProps> = ({
  isVisible,
  onClose,
  onSubmit,
  onVerify,
  isLoading = false,
  isVerifying = false,
  className = '',
}) => {
  return (
    <>
      {isVisible && (
        <div className="fixed inset-0 bg-bg-overlay z-[999]" />
      )}
      <div
        className={`
          fixed top-0 right-0 w-[450px] h-screen bg-bg-weak shadow-[0_2px_6px_var(--shadow)]
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-[1000] flex flex-col
          ${isVisible ? 'translate-x-0' : 'translate-x-[450px]'}
          ${className}
        `}
      >
        <div className="flex items-center justify-between p-6 border-b border-border-weak bg-bg-medium">
          <h2 className="m-0 text-xl font-medium">Model Configuration</h2>
          <button
            onClick={onClose}
            className="p-2 bg-transparent border-none rounded-lg cursor-pointer text-inherit
                     hover:bg-bg-op-dark-extremeweak flex items-center justify-center"
          >
            <svg
              className="w-5 h-5 fill-current"
              viewBox="0 0 24 24"
            >
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-bg-medium scrollbar">
          <div className="mb-6">
            <label className="block font-medium mb-2">Model</label>
            <select className="w-full px-3 py-2.5 rounded-lg border border-border transition-all duration-300
                           text-text bg-bg-select focus:outline-none focus:border-border-pri-blue
                           focus:shadow-[0_0_0_2px_var(--shadow-input)]">
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5">GPT-3.5</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block font-medium mb-2">Temperature</label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              className="w-full px-3 py-2.5 rounded-lg border border-border transition-all duration-300
                       text-text bg-bg-input focus:outline-none focus:border-border-pri-blue
                       focus:shadow-[0_0_0_2px_var(--shadow-input)]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 items-center">
            <div className="col-span-3">
              <label className="block font-medium mb-2">Max Tokens</label>
              <input
                type="number"
                className="w-full px-3 py-2.5 rounded-lg border border-border transition-all duration-300
                         text-text bg-bg-input focus:outline-none focus:border-border-pri-blue
                         focus:shadow-[0_0_0_2px_var(--shadow-input)]"
              />
            </div>
          </div>

          <div className="my-2.5 h-px bg-bg-op-dark-ultraweak" />

          <div className="mb-6">
            <h3 className="text-base font-medium mb-3">Custom Instructions</h3>
            <p className="mb-4 text-base text-text-ultraweak">
              Add custom instructions to guide the model's behavior.
            </p>
            <textarea
              className="w-full min-h-[120px] p-3 rounded-lg border border-border resize-y text-sm
                       leading-normal font-inherit transition-all duration-300 bg-bg-input text-text
                       placeholder-text-inverted-weak focus:outline-none focus:border-border-pri-blue
                       focus:shadow-[0_0_0_2px_var(--shadow-input)]"
              placeholder="Enter your custom instructions here..."
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onVerify}
              disabled={isVerifying}
              className="flex-1 h-9 px-4 border-none rounded-lg cursor-pointer flex items-center
                       justify-center text-sm transition-all duration-300 text-text-light
                       bg-bg-pri-blue hover:bg-bg-hover-blue active:bg-bg-active-blue
                       disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Verify'
              )}
            </button>
            <button
              onClick={onSubmit}
              disabled={isLoading}
              className="flex-1 h-9 px-4 border-none rounded-lg cursor-pointer flex items-center
                       justify-center text-sm transition-all duration-300 text-text-light
                       bg-bg-success hover:bg-bg-hover-success active:bg-bg-active-success
                       disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModelConfig; 