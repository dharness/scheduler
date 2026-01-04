import React from 'react';
import './SettingsMenu.css';

interface SettingsMenuProps {
  onClearToken: (event: React.MouseEvent) => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClearToken }) => {
  return (
    <div className="settings-menu-popup">
      <button className="menu-item clear-token" onClick={onClearToken}>
        Clear Token
      </button>
    </div>
  );
};
