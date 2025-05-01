import React from 'react';

interface CodeWrapperProps {
  children: React.ReactNode;
  language?: string;
  className?: string;
}

/**
 * A safe wrapper around code rendering to prevent undefined component errors
 * This catches errors that might occur when tool calls are trying to render code
 */
const CodeWrapper: React.FC<CodeWrapperProps> = ({ children, language, className }) => {
  try {
    // Simple pre-styled code block
    return (
      <pre className={`rounded-md p-4 bg-gray-900 text-gray-100 overflow-auto ${className || ''}`}>
        <code className={language ? `language-${language}` : ''}>
          {children}
        </code>
      </pre>
    );
  } catch (error) {
    // Fallback rendering if there's an error
    console.error('Error rendering code component:', error);
    return (
      <pre className="rounded-md p-4 bg-gray-900 text-gray-100 overflow-auto">
        <code>
          {typeof children === 'string' ? children : '[Code content could not be displayed]'}
        </code>
      </pre>
    );
  }
};

export default CodeWrapper; 