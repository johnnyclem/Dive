import React, { useEffect } from 'react';

/**
 * A component that handles global hotkeys.
 * This is a non-visual component that just registers event handlers.
 */
const HotKeyController: React.FC = () => {
  useEffect(() => {
    // Event handler function for keydown events
    function handleKeyDown() {
      // Global hotkey handling logic would be implemented here
    }

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // This component doesn't render anything
  return null;
};

export default HotKeyController; 