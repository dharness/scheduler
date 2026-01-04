import React, { useEffect, useState } from "react";
import "./App.css";
import { CalendarView } from "./components/CalendarView";
import { Sidebar } from "./components/Sidebar";
import { TokenSetup } from "./components/TokenSetup";
import { storageService } from "./services/storageService";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import {
  clearError,
  createCalendar,
  deleteCalendar,
  fetchCalendars,
  setSelectedCalendarId,
} from "./store/slices/calendarSlice";
import { RootState } from "./store/store";
import { Calendar } from "./types/calendar";

function App() {
  const dispatch = useAppDispatch();
  const { calendars, selectedCalendarId, isLoading, error } = useAppSelector(
    (state: RootState) => state.calendar
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showTokenSetup, setShowTokenSetup] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);

  // Check if token is configured on mount
  useEffect(() => {
    const token = storageService.getGithubToken();
    if (!token) {
      setShowTokenSetup(true);
    } else {
      console.log("App mounted, dispatching fetchCalendars");
      dispatch(fetchCalendars());
    }
  }, [dispatch]);

  const handleTokenSave = (token: string) => {
    storageService.saveGithubToken(token);
    setShowTokenSetup(false);
    // Load calendars after saving token
    dispatch(fetchCalendars());
  };

  const handleClearToken = (event: React.MouseEvent) => {
    event.stopPropagation();
    storageService.clearGithubToken();
    setIsSettingsMenuOpen(false);
    setShowTokenSetup(true);
  };

  const handleSettingsMenuClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsSettingsMenuOpen(!isSettingsMenuOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const menuPopup = target.closest(".calendar-menu-popup");
      const menuButton = target.closest(".calendar-menu-btn");
      const settingsMenuPopup = target.closest(".settings-menu-popup");
      const settingsButton = target.closest(".settings-btn");

      // Close calendar menu if clicking outside
      if (openMenuId && !menuPopup && !menuButton) {
        setOpenMenuId(null);
      }

      // Close settings menu if clicking outside
      if (isSettingsMenuOpen && !settingsMenuPopup && !settingsButton) {
        setIsSettingsMenuOpen(false);
      }
    };

    if (openMenuId || isSettingsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId, isSettingsMenuOpen]);

  const handleCreateCalendar = () => {
    dispatch(createCalendar(""));
  };

  const handleDeleteCalendar = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    dispatch(deleteCalendar(id));
    setOpenMenuId(null);
  };

  const handleMenuClick = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const selectedCalendar = calendars.find(
    (cal: Calendar) => cal.id === selectedCalendarId
  );

  // Show token setup modal if not configured
  if (showTokenSetup) {
    return <TokenSetup onSave={handleTokenSave} />;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="App">
        <div className="loading-container">
          <p>Loading calendars...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => dispatch(clearError())}>×</button>
        </div>
      )}
      <div className="app-container">
        <Sidebar
          calendars={calendars}
          selectedCalendarId={selectedCalendarId}
          openMenuId={openMenuId}
          onCreateCalendar={handleCreateCalendar}
          onSelectCalendar={(id) => dispatch(setSelectedCalendarId(id))}
          onMenuClick={handleMenuClick}
          onDeleteCalendar={handleDeleteCalendar}
          isSettingsMenuOpen={isSettingsMenuOpen}
          onSettingsMenuClick={handleSettingsMenuClick}
          onClearToken={handleClearToken}
        />
        <main className="main-content">
          <CalendarView calendar={selectedCalendar || null} />
        </main>
      </div>
    </div>
  );
}

export default App;
