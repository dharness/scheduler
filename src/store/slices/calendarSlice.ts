import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_EVENT_COLOR_INDEX,
  normalizeEventColor,
} from "../../constants/colors";
import { gistService } from "../../services/gistService";
import { storageService } from "../../services/storageService";
import { Calendar } from "../../types/calendar";
import { Event } from "../../types/event";

interface CalendarState {
  calendars: Calendar[];
  selectedCalendarId: string | null;
  isLoading: boolean;
  error: string | null;
  isShiftPressed: boolean;
  nextEventColor: number; // Color index (0-5) for the next event to be created
  hasUnsavedChanges: boolean; // Track if there are unsaved changes
}

const initialState: CalendarState = {
  calendars: [],
  selectedCalendarId: null,
  isLoading: true, // Start with true so we show loading on initial mount
  error: null,
  isShiftPressed: false,
  nextEventColor: DEFAULT_EVENT_COLOR_INDEX,
  hasUnsavedChanges: false,
};

// Async thunk to fetch calendars from Gist
export const fetchCalendars = createAsyncThunk(
  "calendar/fetchCalendars",
  async (_, { rejectWithValue }) => {
    try {
      const gistId = storageService.getGistId();
      const githubToken = storageService.getGithubToken();

      if (!gistId || !githubToken) {
        return rejectWithValue("GitHub token and Gist ID must be configured");
      }

      console.log("Fetching calendars from Gist...");
      const calendars = await gistService.fetchCalendars(gistId, githubToken);
      console.log("Fetched calendars:", calendars);
      return calendars;
    } catch (error) {
      console.error("Error in fetchCalendars thunk:", error);
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch calendars"
      );
    }
  }
);

// Helper function to format date as "Sat, Jan 24"
const formatDateAsCalendarName = (): string => {
  const date = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const dayName = dayNames[date.getDay()];
  const monthName = monthNames[date.getMonth()];
  const day = date.getDate();

  return `${dayName}, ${monthName} ${day}`;
};

// Async thunk to create a new calendar
export const createCalendar = createAsyncThunk(
  "calendar/createCalendar",
  async (name: string, { getState, rejectWithValue }) => {
    try {
      const gistId = storageService.getGistId();
      const githubToken = storageService.getGithubToken();

      if (!gistId || !githubToken) {
        return rejectWithValue("GitHub token and Gist ID must be configured");
      }

      const state = getState() as { calendar: CalendarState };
      const calendars = state.calendar.calendars;
      const newCalendar: Calendar = {
        id: Date.now().toString(),
        name: name || formatDateAsCalendarName(),
      };
      // Don't save to Gist here - auto-save will handle it
      return newCalendar;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to create calendar"
      );
    }
  }
);

// Async thunk to delete a calendar
export const deleteCalendar = createAsyncThunk(
  "calendar/deleteCalendar",
  async (id: string, { getState, rejectWithValue }) => {
    try {
      const gistId = storageService.getGistId();
      const githubToken = storageService.getGithubToken();

      if (!gistId || !githubToken) {
        return rejectWithValue("GitHub token and Gist ID must be configured");
      }

      // Don't save to Gist here - auto-save will handle it
      return id;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to delete calendar"
      );
    }
  }
);

// Async thunk to save calendars to Gist (reads from current state)
export const saveCalendarsToGist = createAsyncThunk(
  "calendar/saveCalendarsToGist",
  async (_, { getState, rejectWithValue }) => {
    try {
      const gistId = storageService.getGistId();
      const githubToken = storageService.getGithubToken();

      if (!gistId || !githubToken) {
        return rejectWithValue("GitHub token and Gist ID must be configured");
      }

      const state = getState() as { calendar: CalendarState };
      const calendars = state.calendar.calendars;

      await gistService.updateCalendars(calendars, gistId, githubToken);
      return calendars;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to save calendars to Gist"
      );
    }
  }
);

const calendarSlice = createSlice({
  name: "calendar",
  initialState,
  reducers: {
    setSelectedCalendarId: (state, action: PayloadAction<string | null>) => {
      state.selectedCalendarId = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    addEvent: (state, action: PayloadAction<Event>) => {
      const calendar = state.calendars.find(
        (cal) => cal.id === action.payload.calendarId
      );
      if (calendar) {
        if (!calendar.events) {
          calendar.events = [];
        }
        calendar.events.push(action.payload);
        state.hasUnsavedChanges = true;
      }
    },
    updateEvent: (state, action: PayloadAction<Event>) => {
      const calendar = state.calendars.find(
        (cal) => cal.id === action.payload.calendarId
      );
      if (calendar && calendar.events) {
        const index = calendar.events.findIndex(
          (e) => e.id === action.payload.id
        );
        if (index !== -1) {
          calendar.events[index] = action.payload;
          state.hasUnsavedChanges = true;
        }
      }
    },
    deleteEvent: (
      state,
      action: PayloadAction<{ calendarId: string; eventId: string }>
    ) => {
      const calendar = state.calendars.find(
        (cal) => cal.id === action.payload.calendarId
      );
      if (calendar && calendar.events) {
        calendar.events = calendar.events.filter(
          (e) => e.id !== action.payload.eventId
        );
        state.hasUnsavedChanges = true;
      }
    },
    setShiftPressed: (state, action: PayloadAction<boolean>) => {
      state.isShiftPressed = action.payload;
    },
    setNextEventColor: (state, action: PayloadAction<number>) => {
      state.nextEventColor = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch calendars
    builder
      .addCase(fetchCalendars.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCalendars.fulfilled, (state, action) => {
        state.isLoading = false;
        // Normalize event colors (migrate from string hex to numeric indices)
        const normalizedCalendars = action.payload.map((calendar) => ({
          ...calendar,
          events: calendar.events?.map((event) => ({
            ...event,
            color: normalizeEventColor(event.color),
          })),
        }));
        state.calendars = normalizedCalendars;
        if (normalizedCalendars.length > 0) {
          // Always select the newest calendar (sorted by ID descending, so first one)
          // Sort calendars by ID (timestamp) descending to get newest first
          const sortedCalendars = [...normalizedCalendars].sort((a, b) => {
            return parseInt(b.id) - parseInt(a.id);
          });
          state.selectedCalendarId = sortedCalendars[0].id;
        } else {
          state.selectedCalendarId = null;
        }
        state.hasUnsavedChanges = false; // Reset after fetching
      })
      .addCase(fetchCalendars.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create calendar
    builder
      .addCase(createCalendar.pending, (state) => {
        state.error = null;
      })
      .addCase(createCalendar.fulfilled, (state, action) => {
        state.calendars.push(action.payload);
        state.selectedCalendarId = action.payload.id;
        state.hasUnsavedChanges = true;
      })
      .addCase(createCalendar.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Delete calendar
    builder
      .addCase(deleteCalendar.pending, (state) => {
        state.error = null;
      })
      .addCase(deleteCalendar.fulfilled, (state, action) => {
        state.calendars = state.calendars.filter(
          (cal) => cal.id !== action.payload
        );
        if (state.selectedCalendarId === action.payload) {
          state.selectedCalendarId =
            state.calendars.length > 0 ? state.calendars[0].id : null;
        }
        state.hasUnsavedChanges = true;
      })
      .addCase(deleteCalendar.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Save calendars to Gist
    builder
      .addCase(saveCalendarsToGist.pending, (state) => {
        // Could add a saving state here if needed
      })
      .addCase(saveCalendarsToGist.fulfilled, (state) => {
        // State is already up to date, just mark as saved
        state.hasUnsavedChanges = false;
      })
      .addCase(saveCalendarsToGist.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  setSelectedCalendarId,
  clearError,
  addEvent,
  updateEvent,
  deleteEvent,
  setShiftPressed,
  setNextEventColor,
} = calendarSlice.actions;
export default calendarSlice.reducer;
