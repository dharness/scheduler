import React from 'react';
import { Calendar } from '../types/calendar';
import { CalendarMenu } from './CalendarMenu';
import './CalendarItem.css';

interface CalendarItemProps {
  calendar: Calendar;
  isSelected: boolean;
  isMenuOpen: boolean;
  onSelect: () => void;
  onMenuClick: (event: React.MouseEvent) => void;
  onDelete: (event: React.MouseEvent) => void;
}

export const CalendarItem: React.FC<CalendarItemProps> = ({
  calendar,
  isSelected,
  isMenuOpen,
  onSelect,
  onMenuClick,
  onDelete,
}) => {
  return (
    <div
      className={`calendar-item ${isSelected ? 'active' : ''}`}
      data-calendar-id={calendar.id}
      onClick={onSelect}
    >
      <span className="calendar-name">{calendar.name}</span>
      <div className="calendar-menu-container">
        <button
          className="calendar-menu-btn"
          onClick={onMenuClick}
          aria-label="Menu"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.5"/>
            <circle cx="8" cy="8" r="1.5"/>
            <circle cx="8" cy="13" r="1.5"/>
          </svg>
        </button>
        {isMenuOpen && <CalendarMenu onDelete={onDelete} />}
      </div>
    </div>
  );
};


