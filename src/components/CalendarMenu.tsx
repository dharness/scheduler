import React from 'react';
import './CalendarMenu.css';

interface CalendarMenuProps {
  onDelete: (event: React.MouseEvent) => void;
}

export const CalendarMenu: React.FC<CalendarMenuProps> = ({ onDelete }) => {
  return (
    <div className="calendar-menu-popup">
      <button className="menu-item delete" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
};


