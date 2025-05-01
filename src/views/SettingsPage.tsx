import React, { useEffect, useState } from 'react';

const SettingsPage: React.FC = () => {
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [minimalToTray, setMinimalToTray] = useState(false);
  const [autoDownload, setAutoDownload] = useState(false);

  useEffect(() => {
    window.electron.ipcRenderer.getAutoLaunch()
      .then(setAutoLaunch)
      .catch(() => setAutoLaunch(false));
    window.electron.ipcRenderer.getMinimalToTray()
      .then(setMinimalToTray)
      .catch(() => setMinimalToTray(false));
    setAutoDownload(getAutoDownload());
  }, []);

  return (
    <div>
      {/* Render your component content here */}
    </div>
  );
};

export default SettingsPage; 