import React from 'react';

interface WelcomeProps {
  // Add any props you need
}

export const Welcome: React.FC<WelcomeProps> = () => {
  return (
    <div className="w-full max-w-[600px] text-center">
      <h1 className="text-3xl mb-2.5">Welcome</h1>
      <p className="text-base text-gray-600 dark:text-gray-300 mb-10">Get started with your journey</p>

      <div className="relative">
        {/* Drag Overlay */}
        <div className="hidden absolute inset-0 bg-white dark:bg-gray-800 border-4 border-dashed border-blue-500 rounded-xl overflow-hidden z-10">
          <div className="absolute inset-0 bg-blue-500 opacity-50"></div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 text-blue-600 pointer-events-none">
            Drop your files here
          </div>
        </div>

        {/* Chat Input Banner */}
        <div className="absolute -top-5 left-5 w-[calc(100%-20px)] px-3 py-2 bg-black/10 dark:bg-white/10 rounded-t-lg text-xs text-gray-500 dark:text-gray-400 z-10">
          Type your message here
        </div>

        {/* Welcome Input */}
        <div className="flex flex-col gap-2.5 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 shadow-md z-10 relative">
          <div className="flex flex-col gap-2">
            <textarea
              className="w-full border-none outline-none bg-transparent resize-none p-2 text-base leading-relaxed text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Type your message..."
              rows={3}
            />
          </div>

          {/* Uploaded Files */}
          <div className="mt-2 p-3 rounded-lg bg-black/5 dark:bg-white/5">
            <div className="flex items-center gap-2 p-2 mb-2 rounded-md bg-black/10 dark:bg-white/10 shadow-sm">
              <div className="w-6 h-6 flex items-center justify-center text-gray-500">
                {/* File icon */}
              </div>
              <span className="text-xs text-gray-700 dark:text-gray-300">file.pdf</span>
            </div>
          </div>

          {/* Input Actions */}
          <div className="flex justify-between gap-2.5 w-full">
            <div className="flex items-center gap-1">
              <button className="h-10 w-10 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {/* Button icon */}
              </button>
            </div>
            <button className="flex items-center gap-2 h-10 px-2 rounded-lg text-sm cursor-pointer bg-transparent border-none">
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Suggestions Grid */}
      <div className="grid grid-cols-3 gap-4 mt-2.5">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex flex-col p-4 rounded-lg cursor-pointer transition-all duration-200 text-left border border-gray-200 dark:border-gray-700 min-h-[100px] relative overflow-hidden justify-between bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <div className="flex-1">
              <strong className="block mb-2 text-sm leading-relaxed line-clamp-2">
                Suggestion Title
              </strong>
            </div>
            <div className="flex justify-between items-end mt-auto">
              <p className="m-0 text-xs text-gray-500 dark:text-gray-400">Click to use</p>
              <span className="text-base text-blue-600 opacity-50">→</span>
            </div>
          </div>
        ))}
      </div>

      {/* File Preview */}
      <div className="mt-5 pt-4.5 flex gap-2.5 w-full overflow-x-auto pb-2.5">
        <div className="relative rounded-lg bg-black/10 dark:bg-white/10 shadow-sm h-14 w-60 min-w-60 mt-2 flex items-end justify-start">
          <div className="flex items-center gap-2.5 p-3 h-full w-full text-left">
            <div className="flex-1 min-w-0">
              <div className="text-sm mb-1 truncate">filename.pdf</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">1.2 MB</div>
            </div>
          </div>
          <button className="absolute -top-2 -right-2 bg-black/20 dark:bg-white/20 p-1 rounded-full cursor-pointer text-white hover:bg-black/30 dark:hover:bg-white/30 transition-transform hover:scale-110">
            {/* Remove icon */}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Welcome; 