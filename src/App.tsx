import React, { useEffect, useState } from "react";
import "./App.css";
import { CalendarView } from "./components/CalendarView";
import { Sidebar } from "./components/Sidebar";
import { TokenSetup } from "./components/TokenSetup";
import { storageService } from "./services/storageService";
import { GIST_ID } from "./constants";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import {
  clearError,
  createCalendar,
  deleteCalendar,
  fetchCalendars,
  saveCalendarsToGist,
  setSelectedCalendarId,
} from "./store/slices/calendarSlice";
import { RootState } from "./store/store";
import { Calendar } from "./types/calendar";

const AUTO_SAVE_INTERVAL = 300000; // 5 minutes in milliseconds

function App() {
  const dispatch = useAppDispatch();
  const { calendars, selectedCalendarId, isLoading, error, hasUnsavedChanges } = useAppSelector(
    (state: RootState) => state.calendar
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showTokenSetup, setShowTokenSetup] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [timeUntilAutoSave, setTimeUntilAutoSave] = useState(AUTO_SAVE_INTERVAL);
  const [lastSaveTime, setLastSaveTime] = useState<number>(Date.now());
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

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

  // Auto-save to Gist every 5 minutes
  useEffect(() => {
    const token = storageService.getGithubToken();
    if (!token) {
      return; // Don't auto-save if no token
    }

    const autoSaveInterval = setInterval(() => {
      // Only save if there are calendars to save
      if (calendars.length > 0) {
        dispatch(saveCalendarsToGist())
          .then(() => {
            setLastSaveTime(Date.now());
            setTimeUntilAutoSave(AUTO_SAVE_INTERVAL);
            setShowSaveToast(true);
            setTimeout(() => setShowSaveToast(false), 3000); // Fade away after 3 seconds
          })
          .catch((error) => {
            console.error("Auto-save failed:", error);
          });
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      clearInterval(autoSaveInterval);
    };
  }, [dispatch, calendars.length]);

  // Countdown timer for auto-save
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - lastSaveTime;
      const remaining = Math.max(0, AUTO_SAVE_INTERVAL - elapsed);
      setTimeUntilAutoSave(remaining);
    }, 1000); // Update every second

    return () => {
      clearInterval(countdownInterval);
    };
  }, [lastSaveTime]);

  // Handle unsaved changes modal
  const handleSaveAndClose = async () => {
    try {
      await dispatch(saveCalendarsToGist()).unwrap();
      setLastSaveTime(Date.now());
      setTimeUntilAutoSave(AUTO_SAVE_INTERVAL);
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
      setShowUnsavedChangesModal(false);
      if (pendingNavigation) {
        pendingNavigation();
        setPendingNavigation(null);
      }
    } catch (error) {
      console.error("Failed to save before closing:", error);
    }
  };

  const handleDontSave = () => {
    setShowUnsavedChangesModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  // Save on page close with confirmation if unsaved changes
  useEffect(() => {
    const token = storageService.getGithubToken();
    if (!token) {
      return; // Don't save if no token
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show confirmation if there are unsaved changes
      if (hasUnsavedChanges && calendars.length > 0) {
        // Show browser's confirmation dialog as fallback
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
        return ''; // Required for some browsers
      }
    };

    const handleVisibilityChange = async () => {
      // Save when page is about to be hidden (user switching tabs, closing, etc.)
      if (document.visibilityState === "hidden" && calendars.length > 0 && hasUnsavedChanges) {
        // Try to save before page is hidden
        try {
          await dispatch(saveCalendarsToGist()).unwrap();
          setLastSaveTime(Date.now());
          setTimeUntilAutoSave(AUTO_SAVE_INTERVAL);
        } catch (error) {
          console.error("Save on page close failed:", error);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dispatch, calendars.length, hasUnsavedChanges]);

  // Handle manual save to Gist
  const handleSaveToGist = async () => {
    try {
      await dispatch(saveCalendarsToGist()).unwrap();
      console.log("Calendars saved to Gist successfully");
      setLastSaveTime(Date.now());
      setTimeUntilAutoSave(AUTO_SAVE_INTERVAL);
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000); // Fade away after 3 seconds
    } catch (error) {
      console.error("Failed to save calendars to Gist:", error);
    }
  };


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

  const handleOpenGist = (event: React.MouseEvent) => {
    event.stopPropagation();
    const gistUrl = `https://gist.github.com/${GIST_ID}`;
    window.open(gistUrl, '_blank', 'noopener,noreferrer');
    setIsSettingsMenuOpen(false);
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
          onOpenGist={handleOpenGist}
          onSave={handleSaveToGist}
          timeUntilAutoSave={timeUntilAutoSave}
          hasUnsavedChanges={hasUnsavedChanges}
        />
        <main className="main-content">
          <CalendarView calendar={selectedCalendar || null} />
        </main>
      </div>
      {showSaveToast && (
        <div className="save-toast">
          Saved successfully
        </div>
      )}
      {showUnsavedChangesModal && (
        <div className="modal-overlay" onClick={handleDontSave}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Unsaved Changes</h2>
            <p>You have unsaved changes. Do you want to save before closing?</p>
            <div className="modal-buttons">
              <button className="modal-button save" onClick={handleSaveAndClose}>
                Save
              </button>
              <button className="modal-button cancel" onClick={handleDontSave}>
                Don't Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
