import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Calendar } from '../../types/calendar';
import { Event } from '../../types/event';
import { gistService } from '../../services/gistService';
import { storageService } from '../../services/storageService';

interface CalendarState {
  calendars: Calendar[];
  selectedCalendarId: string | null;
  isLoading: boolean;
  error: string | null;
  isShiftPressed: boolean;
  nextEventColor: string; // Color for the next event to be created
}

const initialState: CalendarState = {
  calendars: [],
  selectedCalendarId: null,
  isLoading: true, // Start with true so we show loading on initial mount
  error: null,
  isShiftPressed: false,
  nextEventColor: '#4285f4', // Default blue color
};

// Async thunk to fetch calendars from Gist
export const fetchCalendars = createAsyncThunk(
  'calendar/fetchCalendars',
  async (_, { rejectWithValue }) => {
    try {
      const gistId = storageService.getGistId();
      const githubToken = storageService.getGithubToken();
      
      if (!gistId || !githubToken) {
        return rejectWithValue('GitHub token and Gist ID must be configured');
      }
      
      console.log('Fetching calendars from Gist...');
      const calendars = await gistService.fetchCalendars(gistId, githubToken);
      console.log('Fetched calendars:', calendars);
      return calendars;
    } catch (error) {
      console.error('Error in fetchCalendars thunk:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch calendars'
      );
    }
  }
);

// Helper function to format date as "Sat, Jan 24"
const formatDateAsCalendarName = (): string => {
  const date = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = dayNames[date.getDay()];
  const monthName = monthNames[date.getMonth()];
  const day = date.getDate();
  
  return `${dayName}, ${monthName} ${day}`;
};

// Async thunk to create a new calendar
export const createCalendar = createAsyncThunk(
  'calendar/createCalendar',
  async (name: string, { getState, rejectWithValue }) => {
    try {
      const gistId = storageService.getGistId();
      const githubToken = storageService.getGithubToken();
      
      if (!gistId || !githubToken) {
        return rejectWithValue('GitHub token and Gist ID must be configured');
      }
      
      const state = getState() as { calendar: CalendarState };
      const calendars = state.calendar.calendars;
      const newCalendar: Calendar = {
        id: Date.now().toString(),
        name: name || formatDateAsCalendarName(),
      };
      const updatedCalendars = [...calendars, newCalendar];
      await gistService.updateCalendars(updatedCalendars, gistId, githubToken);
      return newCalendar;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to create calendar'
      );
    }
  }
);

// Async thunk to delete a calendar
export const deleteCalendar = createAsyncThunk(
  'calendar/deleteCalendar',
  async (id: string, { getState, rejectWithValue }) => {
    try {
      const gistId = storageService.getGistId();
      const githubToken = storageService.getGithubToken();
      
      if (!gistId || !githubToken) {
        return rejectWithValue('GitHub token and Gist ID must be configured');
      }
      
      const state = getState() as { calendar: CalendarState };
      const calendars = state.calendar.calendars;
      const updatedCalendars = calendars.filter((cal) => cal.id !== id);
      await gistService.updateCalendars(updatedCalendars, gistId, githubToken);
      return id;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to delete calendar'
      );
    }
  }
);

// Async thunk to update calendars (for event changes)
export const updateCalendars = createAsyncThunk(
  'calendar/updateCalendars',
  async (calendars: Calendar[], { rejectWithValue }) => {
    try {
      const gistId = storageService.getGistId();
      const githubToken = storageService.getGithubToken();
      
      if (!gistId || !githubToken) {
        return rejectWithValue('GitHub token and Gist ID must be configured');
      }
      
      await gistService.updateCalendars(calendars, gistId, githubToken);
      return calendars;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to update calendars'
      );
    }
  }
);

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setSelectedCalendarId: (state, action: PayloadAction<string | null>) => {
      state.selectedCalendarId = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    addEvent: (state, action: PayloadAction<Event>) => {
      const calendar = state.calendars.find((cal) => cal.id === action.payload.calendarId);
      if (calendar) {
        if (!calendar.events) {
          calendar.events = [];
        }
        calendar.events.push(action.payload);
      }
    },
    updateEvent: (state, action: PayloadAction<Event>) => {
      const calendar = state.calendars.find((cal) => cal.id === action.payload.calendarId);
      if (calendar && calendar.events) {
        const index = calendar.events.findIndex((e) => e.id === action.payload.id);
        if (index !== -1) {
          calendar.events[index] = action.payload;
        }
      }
    },
    deleteEvent: (state, action: PayloadAction<{ calendarId: string; eventId: string }>) => {
      const calendar = state.calendars.find((cal) => cal.id === action.payload.calendarId);
      if (calendar && calendar.events) {
        calendar.events = calendar.events.filter((e) => e.id !== action.payload.eventId);
      }
    },
    setShiftPressed: (state, action: PayloadAction<boolean>) => {
      state.isShiftPressed = action.payload;
    },
    setNextEventColor: (state, action: PayloadAction<string>) => {
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
        state.calendars = action.payload;
        if (action.payload.length > 0 && !state.selectedCalendarId) {
          state.selectedCalendarId = action.payload[0].id;
        }
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
      })
      .addCase(deleteCalendar.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Update calendars (for event changes)
    builder
      .addCase(updateCalendars.fulfilled, (state, action) => {
        state.calendars = action.payload;
      });
  },
});

export const { setSelectedCalendarId, clearError, addEvent, updateEvent, deleteEvent, setShiftPressed, setNextEventColor } = calendarSlice.actions;
export default calendarSlice.reducer;

