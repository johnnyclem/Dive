import React from 'react';
import './LoadingSplash.css';

const LoadingSplash: React.FC = () => {
  return (
    <div className="loading-splash">
      <div className="loading-spinner"></div>
      <p>Loading...</p>
    </div>
  );
};

export default LoadingSplash; 