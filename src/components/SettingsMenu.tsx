import React from 'react';
import './SettingsMenu.css';

interface SettingsMenuProps {
  onClearToken: (event: React.MouseEvent) => void;
  onOpenGist: (event: React.MouseEvent) => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClearToken, onOpenGist }) => {
  return (
    <div className="settings-menu-popup">
      <button className="menu-item" onClick={onOpenGist}>
        Open Gist
      </button>
      <button className="menu-item clear-token" onClick={onClearToken}>
        Clear Token
      </button>
    </div>
  );
};
