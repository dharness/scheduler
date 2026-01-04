import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Calendar } from '../types/calendar';
import { Event } from '../types/event';
import { CalendarEvent } from './CalendarEvent';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addEvent, updateEvent, deleteEvent, updateCalendars, setShiftPressed, setNextEventColor } from '../store/slices/calendarSlice';
import { RootState } from '../store/store';
import './CalendarView.css';

interface CalendarViewProps {
  calendar: Calendar | null;
}

// Generate hours array (24-hour format, starting at 5am, then 11pm-5am next day at bottom)
const generateHours = () => {
  const hours = [];
  
  // First, add hours 5am to 11pm (5-23)
  for (let i = 5; i < 24; i++) {
    const hour12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
    const period = i < 12 ? 'AM' : 'PM';
    hours.push({
      hour24: i,
      hour12,
      period,
      display: `${hour12}:00 ${period}`,
    });
  }
  
  // Then add hours 12am to 4am (0-4) at the bottom
  for (let i = 0; i < 5; i++) {
    const hour12 = i === 0 ? 12 : i;
    hours.push({
      hour24: i,
      hour12,
      period: 'AM',
      display: `${hour12}:00 AM`,
    });
  }
  
  return hours;
};

export const CalendarView: React.FC<CalendarViewProps> = ({ calendar }) => {
  const dispatch = useAppDispatch();
  const calendars = useAppSelector((state: RootState) => state.calendar.calendars);
  const nextEventColor = useAppSelector((state: RootState) => state.calendar.nextEventColor);
  const hours = generateHours();
  const today = new Date();
  const currentHour = today.getHours();
  const currentMinute = today.getMinutes();
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const eventsColumnRef = useRef<HTMLDivElement>(null);
  const slotHeight = 30; // Each hour slot is 30px tall
  const minutesPerSlot = 60; // Each slot represents 1 hour (60 minutes)
  
  // State to force re-render for current time tracking
  const [, setCurrentTime] = useState(new Date());
  
  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // State for drag-to-create preview
  const [previewEvent, setPreviewEvent] = useState<{
    startY: number;
    currentY: number;
  } | null>(null);
  
  // Track initial mouse position when mousedown happens (before showing preview)
  const [dragStartState, setDragStartState] = useState<{
    startY: number;
    initialMousePos: { x: number; y: number };
  } | null>(null);
  
  // Track which event is currently being dragged
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  
  // Store original overlap positions when drag starts
  const originalOverlapPositionsRef = useRef<Map<string, number>>(new Map());
  
  // Track which event should be in edit mode (for newly created events)
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  // Track which events are selected (using Set for efficient lookups)
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

  // Track color picker menu visibility
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Get Shift key state from Redux
  const isShiftPressed = useAppSelector((state: RootState) => state.calendar.isShiftPressed);

  // Track Shift key and update Redux
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        dispatch(setShiftPressed(true));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        dispatch(setShiftPressed(false));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [dispatch]);

  // Deselect when clicking outside events
  useEffect(() => {
    let isClickingEvent = false;
    
    // Track when clicking on an event
    const handleEventMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.calendar-event')) {
        isClickingEvent = true;
        // Reset flag after a short delay
        setTimeout(() => {
          isClickingEvent = false;
        }, 100);
      }
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      // Don't deselect if we just clicked on an event
      if (isClickingEvent) return;
      
      const target = e.target as HTMLElement;
      
      // Close color picker if clicking outside
      if (showColorPicker && !target.closest('.color-picker-menu') && !target.closest('.color-picker-button')) {
        setShowColorPicker(false);
      }
      
      // Don't deselect if clicking on:
      // - An event
      // - The delete button flyout
      // - Time slots (drag area)
      // - The tools menu (so delete button works)
      if (!target.closest('.calendar-event') && 
          !target.closest('.event-delete-flyout') && 
          !target.closest('.time-slot') &&
          !target.closest('.calendar-tools-menu')) {
        setSelectedEventIds(new Set());
      }
    };

    // Listen for mousedown on events first (capture phase)
    document.addEventListener('mousedown', handleEventMouseDown, true);
    // Then listen for clicks outside (bubble phase)
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleEventMouseDown, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedEventIds, showColorPicker]);

  // Get events for the current calendar
  const currentCalendar = calendars.find((cal) => cal.id === calendar?.id);
  const events = currentCalendar?.events || [];

  // Check if two events overlap in time
  const eventsOverlap = (event1: Event, event2: Event): boolean => {
    const start1 = event1.startHour * 60 + event1.startMinute;
    const end1 = start1 + event1.duration;
    const start2 = event2.startHour * 60 + event2.startMinute;
    const end2 = start2 + event2.duration;
    
    // Events overlap if they share any time
    // If one ends exactly when another starts, they don't overlap (end1 <= start2 means no overlap)
    // But if they start at the same time, they do overlap (start1 === start2 means overlap)
    // So we check: end1 > start2 AND end2 > start1
    return end1 > start2 && end2 > start1;
  };

  // Calculate layout for overlapping events
  const calculateEventLayout = (event: Event, allEvents: Event[]) => {
    // Find all events that overlap with this event
    const overlappingEvents = allEvents.filter((e) => 
      e.id !== event.id && eventsOverlap(event, e)
    );
    
    if (overlappingEvents.length === 0) {
      // No overlaps, full width
      return { left: 0, width: 100 };
    }

    // Create a group of all overlapping events including this one
    const group = [event, ...overlappingEvents];
    
    const isEventDragging = draggingEventId === event.id;
    
    // Check if this event was already overlapping before the drag started
    const hadOriginalPosition = originalOverlapPositionsRef.current.has(event.id);
    const originalPosition = originalOverlapPositionsRef.current.get(event.id);
    
    if (isEventDragging && !hadOriginalPosition) {
      // Event is being dragged and newly overlaps - place it on the right
      // Sort stationary events by start time, then add dragged event at the end
      const stationaryEvents = group.filter((e) => e.id !== event.id);
      stationaryEvents.sort((a, b) => {
        const startA = a.startHour * 60 + a.startMinute;
        const startB = b.startHour * 60 + b.startMinute;
        if (startA !== startB) {
          return startA - startB;
        }
        return a.id.localeCompare(b.id);
      });
      group.length = 0;
      group.push(...stationaryEvents, event);
    } else if (isEventDragging && hadOriginalPosition && originalPosition !== undefined) {
      // Event is being dragged and was already overlapping - maintain relative position
      // Sort by original position, then by start time for events without original position
      group.sort((a, b) => {
        const posA = originalOverlapPositionsRef.current.get(a.id);
        const posB = originalOverlapPositionsRef.current.get(b.id);
        
        if (posA !== undefined && posB !== undefined) {
          return posA - posB;
        }
        if (posA !== undefined) return -1;
        if (posB !== undefined) return 1;
        
        // Both don't have original position, sort by start time
        const startA = a.startHour * 60 + a.startMinute;
        const startB = b.startHour * 60 + b.startMinute;
        if (startA !== startB) {
          return startA - startB;
        }
        return a.id.localeCompare(b.id);
      });
    } else {
      // Not dragging or stationary event - sort by start time, then by ID
      group.sort((a, b) => {
        const startA = a.startHour * 60 + a.startMinute;
        const startB = b.startHour * 60 + b.startMinute;
        if (startA !== startB) {
          return startA - startB;
        }
        return a.id.localeCompare(b.id);
      });
    }

    // Find position of this event in the group
    const position = group.findIndex((e) => e.id === event.id);
    const totalOverlapping = group.length;
    
    // Calculate width and left position
    // For overlapping events, we need to account for 2px gaps between them
    // Since we're using percentage widths, we'll approximate by reducing width slightly
    // and using margin-right in CSS
    const baseWidthPercent = 100 / totalOverlapping;
    // Reduce width slightly to account for margins (roughly 0.3% per overlapping event)
    const widthPercent = Math.max(baseWidthPercent - (totalOverlapping * 0.3), baseWidthPercent * 0.97);
    // Calculate left position - need to account for margins of previous events
    const leftPercent = position * baseWidthPercent;
    
    return { left: leftPercent, width: widthPercent };
  };

  // Track the previous calendar ID to detect when it changes
  const prevCalendarIdRef = useRef<string | null>(null);
  
  // Scroll to 9am (hour 9) only when calendar is first selected or changes
  useEffect(() => {
    const currentCalendarId = calendar?.id || null;
    const prevCalendarId = prevCalendarIdRef.current;
    
    // Only scroll if:
    // 1. Calendar is selected and we haven't scrolled for this calendar yet (prevCalendarId is null)
    // 2. Calendar changed to a different one (currentCalendarId !== prevCalendarId)
    if (calendar && calendarContainerRef.current && currentCalendarId !== prevCalendarId) {
      // 9am is hour 9, calendar starts at 5am, so 9am is at position (9-5) = 4 slots
      // Each time slot is 30px tall
      const scrollPosition = (9 - 5) * 30;
      calendarContainerRef.current.scrollTop = scrollPosition;
      prevCalendarIdRef.current = currentCalendarId;
    }
  }, [calendar]);

  // Convert Y position to hour and minute
  const yToTime = (y: number): { hour: number; minute: number } => {
    const slots = y / slotHeight;
    const totalMinutes = slots * minutesPerSlot;
    
    let hour: number;
    let minute: number;
    
    // Check if we're in the main section (5am-11pm) or bottom section (12am-4am)
    const mainSectionMinutes = (24 - 5) * 60; // Minutes from 5am to 11pm
    
    if (totalMinutes < mainSectionMinutes) {
      // In main section (5am-11pm)
      hour = Math.floor(totalMinutes / 60) + 5;
      minute = Math.round((totalMinutes % 60) / 15) * 15;
    } else {
      // In bottom section (12am-4am)
      const bottomMinutes = totalMinutes - mainSectionMinutes;
      hour = Math.floor(bottomMinutes / 60);
      minute = Math.round((bottomMinutes % 60) / 15) * 15;
    }
    
    // Normalize
    if (hour < 0) hour = 0;
    if (hour > 23) hour = 23;
    if (minute < 0) {
      minute = 60 + minute;
      hour = (hour - 1 + 24) % 24;
    }
    if (minute >= 60) {
      minute = 0;
      hour = (hour + 1) % 24;
    }
    
    return { hour, minute };
  };

  // Handle mousedown on time slot to start creating event
  const handleTimeSlotMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!calendar) return;
    e.preventDefault();
    e.stopPropagation();
    
    // Exit any event edit mode when starting to create a new event
    setEditingEventId(null);
    // Deselect any selected events
    setSelectedEventIds(new Set());
    
    const container = eventsColumnRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const startY = e.clientY - containerRect.top + container.scrollTop;
    
    // Store initial state but don't show preview yet
    setDragStartState({ 
      startY, 
      initialMousePos: { x: e.clientX, y: e.clientY }
    });
  };

  // Handle mousemove to show preview and update it
  useEffect(() => {
    if (!dragStartState) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Check if mouse has moved enough to start showing preview
      const moveDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartState.initialMousePos.x, 2) + 
        Math.pow(e.clientY - dragStartState.initialMousePos.y, 2)
      );
      
      // Only show preview if mouse moved at least 5px
      if (moveDistance >= 5) {
        const container = eventsColumnRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const currentY = e.clientY - containerRect.top + container.scrollTop;
        
        // Show preview if not already shown
        if (!previewEvent) {
          setPreviewEvent({ 
            startY: dragStartState.startY, 
            currentY 
          });
        } else {
          // Update preview
          setPreviewEvent((prev) => prev ? { ...prev, currentY } : null);
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragStartState || !calendar) {
        setDragStartState(null);
        setPreviewEvent(null);
        return;
      }
      
      // Check if mouse actually moved (not just a click)
      const moveDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartState.initialMousePos.x, 2) + 
        Math.pow(e.clientY - dragStartState.initialMousePos.y, 2)
      );
      
      // If mouse moved less than 5px, it was just a click - don't create event
      if (moveDistance < 5) {
        setDragStartState(null);
        setPreviewEvent(null);
        return;
      }
      
      // If preview wasn't shown, don't create event
      if (!previewEvent) {
        setDragStartState(null);
        setPreviewEvent(null);
        return;
      }
      
      const container = eventsColumnRef.current;
      if (!container) {
        setPreviewEvent(null);
        return;
      }

      const startTime = yToTime(previewEvent.startY);
      const endTime = yToTime(previewEvent.currentY);
      
      // Determine actual start and end (handle drag up or down)
      let startHour: number;
      let startMinute: number;
      let endHour: number;
      let endMinute: number;
      
      if (previewEvent.currentY >= previewEvent.startY) {
        // Dragging down
        startHour = startTime.hour;
        startMinute = startTime.minute;
        endHour = endTime.hour;
        endMinute = endTime.minute;
      } else {
        // Dragging up
        startHour = endTime.hour;
        startMinute = endTime.minute;
        endHour = startTime.hour;
        endMinute = startTime.minute;
      }
      
      // Calculate duration
      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;
      let duration = endTotalMinutes - startTotalMinutes;
      
      // Handle wrap-around (e.g., 11pm to 1am next day)
      if (duration < 0) {
        duration = (24 * 60) + duration;
      }
      
      // Minimum duration of 15 minutes
      if (duration < 15) {
        duration = 15;
      }
      
      // Round to nearest 15 minutes
      duration = Math.round(duration / 15) * 15;
      
      // Round start minute to nearest 15 minutes
      startMinute = Math.round(startMinute / 15) * 15;
      if (startMinute >= 60) {
        startMinute = 0;
        startHour = (startHour + 1) % 24;
      }

      // Create the event
      const newEventId = Date.now().toString();
      const newEvent: Event = {
        id: newEventId,
        calendarId: calendar.id,
        title: 'New Event',
        startHour: startHour,
        startMinute: startMinute,
        duration: duration,
        color: nextEventColor,
      };
      
      dispatch(addEvent(newEvent));
      // Save to Gist
      const updatedCalendars = calendars.map((cal) =>
        cal.id === calendar.id
          ? { ...cal, events: [...(cal.events || []), newEvent] }
          : cal
      );
      dispatch(updateCalendars(updatedCalendars));
      
      // Set the new event to edit mode
      setEditingEventId(newEventId);
      
      setDragStartState(null);
      setPreviewEvent(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragStartState, previewEvent, calendar, dispatch, calendars]);

  // Update event in Redux state only (for visual updates during drag/resize)
  const handleEventUpdate = (event: Event) => {
    dispatch(updateEvent(event));
  };

  // Update multiple events in Redux state (for multi-select drag)
  const handleEventUpdateMultiple = (events: Event[]) => {
    events.forEach((event) => {
      dispatch(updateEvent(event));
    });
  };

  // Save event changes to Gist (called on drag/resize end)
  const handleEventUpdateEnd = (event: Event) => {
    // Save to Gist
    const updatedCalendars = calendars.map((cal) =>
      cal.id === event.calendarId
        ? {
            ...cal,
            events: cal.events?.map((e) => (e.id === event.id ? event : e)) || [],
          }
        : cal
    );
    dispatch(updateCalendars(updatedCalendars));
  };

  // Save multiple event changes to Gist (called on multi-select drag end)
  const handleEventUpdateMultipleEnd = (events: Event[]) => {
    if (!calendar || events.length === 0) return;
    
    // Update all events in the calendar
    const updatedCalendars = calendars.map((cal) =>
      cal.id === calendar.id
        ? {
            ...cal,
            events: cal.events?.map((e) => {
              const updatedEvent = events.find((ue) => ue.id === e.id);
              return updatedEvent || e;
            }) || [],
          }
        : cal
    );
    dispatch(updateCalendars(updatedCalendars));
  };

  const handleEventDelete = (eventId: string) => {
    if (!calendar) return;
    dispatch(deleteEvent({ calendarId: calendar.id, eventId }));
    // Save to Gist
    const updatedCalendars = calendars.map((cal) =>
      cal.id === calendar.id
        ? { ...cal, events: cal.events?.filter((e) => e.id !== eventId) || [] }
        : cal
    );
    dispatch(updateCalendars(updatedCalendars));
    // Remove from selection after deletion
    setSelectedEventIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(eventId);
      return newSet;
    });
  };

  // Handle event selection (with multi-select support)
  const handleEventSelect = (eventId: string) => {
    if (isShiftPressed) {
      // Multi-select mode: toggle this event in the selection
      setSelectedEventIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(eventId)) {
          newSet.delete(eventId);
        } else {
          newSet.add(eventId);
        }
        return newSet;
      });
    } else {
      // Single select mode: toggle selection (if already selected, deselect; otherwise select)
      setSelectedEventIds((prev) => {
        if (prev.has(eventId)) {
          // Already selected - deselect it
          const newSet = new Set(prev);
          newSet.delete(eventId);
          return newSet;
        } else {
          // Not selected - replace selection with just this event
          return new Set([eventId]);
        }
      });
    }
  };

  // Predefined colors for events
  const predefinedColors = [
    '#4285f4', // Blue
    '#34a853', // Green
    '#fbbc04', // Yellow
    '#ea4335', // Red
    '#9c27b0', // Purple
    '#ff9800', // Orange
  ];

  // Get the current color to display in the color picker
  const getColorPickerColor = () => {
    // If events are selected, show the color of the first selected event
    if (selectedEventIds.size > 0 && calendar) {
      const events = calendar.events?.filter((e) => selectedEventIds.has(e.id)) || [];
      if (events.length > 0) {
        return events[0].color || nextEventColor;
      }
    }
    // Otherwise, show the next event color
    return nextEventColor;
  };

  // Handle color change
  const handleColorChange = useCallback((color: string) => {
    // Always update the next event color
    dispatch(setNextEventColor(color));

    // If events are selected, also update their colors
    if (selectedEventIds.size > 0 && calendar) {
      const updatedEvents = calendar.events?.map((e) => {
        if (selectedEventIds.has(e.id)) {
          return { ...e, color };
        }
        return e;
      }) || [];

      // Dispatch updates for each event
      updatedEvents.forEach((event) => {
        if (selectedEventIds.has(event.id)) {
          dispatch(updateEvent(event));
        }
      });

      // Update Gist with all color changes
      const updatedCalendars = calendars.map((cal) =>
        cal.id === calendar.id
          ? { ...cal, events: updatedEvents }
          : cal
      );
      dispatch(updateCalendars(updatedCalendars));
    }

    // Close the color picker menu
    setShowColorPicker(false);
  }, [selectedEventIds, calendar, calendars, dispatch]);

  // Helper function to delete all selected events (used by both keyboard and button)
  const handleDeleteSelectedEvents = useCallback(() => {
    if (selectedEventIds.size === 0 || !calendar) return;

    // Delete all selected events
    const selectedIdsArray = Array.from(selectedEventIds);
    selectedIdsArray.forEach((eventId) => {
      dispatch(deleteEvent({ calendarId: calendar.id, eventId }));
    });

    // Update Gist with all deletions
    const updatedCalendars = calendars.map((cal) =>
      cal.id === calendar.id
        ? { ...cal, events: cal.events?.filter((e) => !selectedEventIds.has(e.id)) || [] }
        : cal
    );
    dispatch(updateCalendars(updatedCalendars));

    // Clear selection after deletion
    setSelectedEventIds(new Set());
  }, [selectedEventIds, calendar, calendars, dispatch]);

  // Handle keyboard delete for all selected events
  useEffect(() => {
    if (selectedEventIds.size === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if Delete or Backspace is pressed and no input is focused
      if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        handleDeleteSelectedEvents();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventIds, handleDeleteSelectedEvents]);

  if (!calendar) {
    return (
      <div className="empty-content">
        <p>Select a calendar or create a new one</p>
      </div>
    );
  }

  return (
    <div className="calendar-view">
      <div className="calendar-card">
        <div className="calendar-header">
          <h1>{calendar.name}</h1>
          <ul className="calendar-tools-menu">
            <li>
              <div className="color-picker-container" ref={colorPickerRef}>
                <button
                  className="calendar-tools-menu-item color-picker-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(!showColorPicker);
                  }}
                  aria-label="Change event color"
                  title="Change event color"
                >
                  <div 
                    className="color-picker-circle"
                    style={{ backgroundColor: getColorPickerColor() }}
                  />
                </button>
                {showColorPicker && (
                  <div className="color-picker-menu">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        className="color-picker-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleColorChange(color);
                        }}
                        aria-label={`Change color to ${color}`}
                        title={`Change color to ${color}`}
                      >
                        <div 
                          className="color-picker-circle"
                          style={{ backgroundColor: color }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
            <li>
              <button
                className={`calendar-tools-menu-item delete ${selectedEventIds.size === 0 ? 'disabled' : ''}`}
                onClick={handleDeleteSelectedEvents}
                disabled={selectedEventIds.size === 0}
                aria-label="Delete selected events"
                title="Delete selected events"
              >
                <svg viewBox="0 0 96 96" fill="currentColor">
                  <path d="M0 0 C0.71929687 -0.00338379 1.43859375 -0.00676758 2.1796875 -0.01025391 C2.96859375 -0.01412109 3.7575 -0.01798828 4.5703125 -0.02197266 C5.39015625 -0.01037109 6.21 0.00123047 7.0546875 0.01318359 C8.28445312 -0.00421875 8.28445312 -0.00421875 9.5390625 -0.02197266 C10.72242187 -0.01617188 10.72242187 -0.01617188 11.9296875 -0.01025391 C12.64898437 -0.00687012 13.36828125 -0.00348633 14.109375 0 C16.0546875 0.38818359 16.0546875 0.38818359 17.52075195 1.88110352 C19.58195537 3.90622029 20.87092512 3.80908288 23.72265625 3.89990234 C24.61533203 3.93535156 25.50800781 3.97080078 26.42773438 4.00732422 C27.35650391 4.02988281 28.28527344 4.05244141 29.2421875 4.07568359 C30.65274414 4.12692383 30.65274414 4.12692383 32.09179688 4.17919922 C34.41264143 4.26166578 36.73310898 4.33081763 39.0546875 4.38818359 C39.0546875 7.02818359 39.0546875 9.66818359 39.0546875 12.38818359 C37.7346875 12.38818359 36.4146875 12.38818359 35.0546875 12.38818359 C35.0546875 25.58818359 35.0546875 38.78818359 35.0546875 52.38818359 C32.4146875 52.38818359 29.7746875 52.38818359 27.0546875 52.38818359 C27.0546875 39.18818359 27.0546875 25.98818359 27.0546875 12.38818359 C13.8546875 12.38818359 0.6546875 12.38818359 -12.9453125 12.38818359 C-12.9453125 32.18818359 -12.9453125 51.98818359 -12.9453125 72.38818359 C-2.3853125 72.38818359 8.1746875 72.38818359 19.0546875 72.38818359 C19.0546875 75.02818359 19.0546875 77.66818359 19.0546875 80.38818359 C14.00103458 80.4871554 8.94794726 80.55969962 3.89355469 80.60791016 C2.17470471 80.62800987 0.45592298 80.65529448 -1.26269531 80.68994141 C-3.73519739 80.73853393 -6.2067946 80.76116794 -8.6796875 80.77880859 C-9.82990387 80.80977631 -9.82990387 80.80977631 -11.00335693 80.84136963 C-14.32048686 80.84276069 -16.4438484 80.75926037 -19.15185547 78.75537109 C-21.48574273 75.67486866 -21.42966203 73.90057368 -21.39941406 70.05908203 C-21.39911194 68.77805603 -21.39880981 67.49703003 -21.39849854 66.17718506 C-21.37807345 64.78396989 -21.35720949 63.39076109 -21.3359375 61.99755859 C-21.32847381 60.56838777 -21.32278148 59.1392067 -21.31878662 57.71002197 C-21.30354 53.95491097 -21.26426766 50.20042234 -21.2199707 46.44555664 C-21.17899637 42.61141377 -21.16077106 38.77716997 -21.140625 34.94287109 C-21.09777153 27.4243587 -21.02953317 19.90635847 -20.9453125 12.38818359 C-22.2653125 12.38818359 -23.5853125 12.38818359 -24.9453125 12.38818359 C-24.9453125 9.74818359 -24.9453125 7.10818359 -24.9453125 4.38818359 C-24.06008911 4.36630981 -24.06008911 4.36630981 -23.15698242 4.34399414 C-20.48160021 4.26949516 -17.80746358 4.17284364 -15.1328125 4.07568359 C-13.7396582 4.0418457 -13.7396582 4.0418457 -12.31835938 4.00732422 C-11.42568359 3.971875 -10.53300781 3.93642578 -9.61328125 3.89990234 C-8.79110107 3.87371826 -7.9689209 3.84753418 -7.12182617 3.82055664 C-3.94286986 3.1890444 -3.11133989 0.62086225 0 0 Z " fill="currentColor" transform="translate(40.9453125,7.61181640625)"/>
                  <path d="M0 0 C0.45890625 0.433125 0.9178125 0.86625 1.390625 1.3125 C2.31101562 2.1478125 2.31101562 2.1478125 3.25 3 C3.85328125 3.556875 4.4565625 4.11375 5.078125 4.6875 C7.162653 6.37597443 7.162653 6.37597443 11 6 C12.9792785 4.7167443 12.9792785 4.7167443 14.75 3 C16.35875 1.515 16.35875 1.515 18 0 C19.98 2.31 21.96 4.62 24 7 C21.69 9.31 19.38 11.62 17 14 C18.48868286 16.97736572 19.53878822 18.83438636 21.625 21.25 C22.40875 22.1575 23.1925 23.065 24 24 C21.75 26.5625 21.75 26.5625 19 29 C17 29.125 17 29.125 15 28 C12.25 25.4375 12.25 25.4375 10 23 C7.39619281 24.11591737 5.93900464 25.06671367 4 27.1875 C2 29 2 29 0 29.0625 C-2.7697841 27.5910522 -4.19083529 25.51990799 -6 23 C-2.535 19.535 -2.535 19.535 1 16 C-0.48868286 13.02263428 -1.53878822 11.16561364 -3.625 8.75 C-4.800625 7.38875 -4.800625 7.38875 -6 6 C-4.02 4.02 -2.04 2.04 0 0 Z " fill="currentColor" transform="translate(71,67)"/>
                  <path d="M0 0 C2.64 0 5.28 0 8 0 C8 14.52 8 29.04 8 44 C5.36 44 2.72 44 0 44 C0 29.48 0 14.96 0 0 Z " fill="currentColor" transform="translate(52,28)"/>
                  <path d="M0 0 C2.64 0 5.28 0 8 0 C8 14.52 8 29.04 8 44 C5.36 44 2.72 44 0 44 C0 29.48 0 14.96 0 0 Z " fill="currentColor" transform="translate(36,28)"/>
                </svg>
              </button>
            </li>
          </ul>
        </div>
        <div className="calendar-day-container" ref={calendarContainerRef}>
          <div className="calendar-time-column">
            {hours.map((hour) => {
              const isGreyedOut = hour.hour24 >= 2 && hour.hour24 <= 7;
              return (
                <div
                  key={hour.hour24}
                  className={`time-slot-label ${
                    isGreyedOut ? 'greyed-out' : ''
                  }`}
                >
                  {hour.display}
                </div>
              );
            })}
          </div>
          <div className="calendar-events-column" ref={eventsColumnRef}>
            {/* Current time indicator */}
            {(() => {
              const now = new Date();
              const currentHour24 = now.getHours();
              const currentMinute24 = now.getMinutes();
              
              // Calculate the exact position of the current time
              let currentTimeTop: number;
              if (currentHour24 >= 5) {
                const minutesFrom5am = (currentHour24 - 5) * 60 + currentMinute24;
                currentTimeTop = (minutesFrom5am / minutesPerSlot) * slotHeight;
              } else {
                const minutesFrom5am = (24 - 5) * 60 + currentHour24 * 60 + currentMinute24;
                currentTimeTop = (minutesFrom5am / minutesPerSlot) * slotHeight;
              }
              
              return (
                <div
                  className="current-time-indicator"
                  style={{
                    top: `${currentTimeTop}px`,
                  }}
                >
                  <div className="current-time-arrow"></div>
                  <div className="current-time-line"></div>
                </div>
              );
            })()}
            {hours.map((hour) => {
              const isGreyedOut = hour.hour24 >= 2 && hour.hour24 <= 7;
              return (
                <div
                  key={hour.hour24}
                  className={`time-slot ${
                    isGreyedOut ? 'greyed-out' : ''
                  }`}
                  data-hour={hour.hour24}
                  onMouseDown={handleTimeSlotMouseDown}
                />
              );
            })}
            {/* Render preview event */}
            {previewEvent && (() => {
              // Convert Y positions to time, then snap to 15-minute increments
              const startTime = yToTime(previewEvent.startY);
              const endTime = yToTime(previewEvent.currentY);
              
              // Determine actual start and end (handle drag up or down)
              let startHour: number;
              let startMinute: number;
              let endHour: number;
              let endMinute: number;
              
              if (previewEvent.currentY >= previewEvent.startY) {
                // Dragging down
                startHour = startTime.hour;
                startMinute = startTime.minute;
                endHour = endTime.hour;
                endMinute = endTime.minute;
              } else {
                // Dragging up
                startHour = endTime.hour;
                startMinute = endTime.minute;
                endHour = startTime.hour;
                endMinute = startTime.minute;
              }
              
              // Snap to 15-minute increments
              startMinute = Math.round(startMinute / 15) * 15;
              if (startMinute >= 60) {
                startMinute = 0;
                startHour = (startHour + 1) % 24;
              }
              
              endMinute = Math.round(endMinute / 15) * 15;
              if (endMinute >= 60) {
                endMinute = 0;
                endHour = (endHour + 1) % 24;
              }
              
              // Calculate duration
              const startTotalMinutes = startHour * 60 + startMinute;
              const endTotalMinutes = endHour * 60 + endMinute;
              let duration = endTotalMinutes - startTotalMinutes;
              
              // Handle wrap-around
              if (duration < 0) {
                duration = (24 * 60) + duration;
              }
              
              // Minimum duration of 15 minutes
              if (duration < 15) {
                duration = 15;
              }
              
              // Round to nearest 15 minutes
              duration = Math.round(duration / 15) * 15;
              
              // Convert back to pixel positions for rendering
              let startTop: number;
              if (startHour >= 5) {
                const minutesFrom5am = (startHour - 5) * 60 + startMinute;
                startTop = (minutesFrom5am / minutesPerSlot) * slotHeight;
              } else {
                const minutesFrom5am = (24 - 5) * 60 + startHour * 60 + startMinute;
                startTop = (minutesFrom5am / minutesPerSlot) * slotHeight;
              }
              
              const height = (duration / minutesPerSlot) * slotHeight;
              const top = startTop + 1; // Add 1px for top gap
              const snappedHeight = Math.max(height - 2, 15); // Subtract 2px for gaps, min 15px
              
              // Convert hex color to rgba with opacity for preview
              const hexToRgba = (hex: string, alpha: number) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
              };
              
              return (
                <div
                  className="event-preview"
                  style={{
                    top: `${top}px`,
                    height: `${snappedHeight}px`,
                    left: '0%',
                    width: '100%',
                    backgroundColor: hexToRgba(nextEventColor, 0.3),
                    borderColor: nextEventColor,
                  }}
                />
              );
            })()}
            {/* Render events */}
            {events.map((event) => {
              const layout = calculateEventLayout(event, events);
              return (
                <CalendarEvent
                  key={event.id}
                  event={event}
                  onUpdate={handleEventUpdate}
                  onUpdateEnd={handleEventUpdateEnd}
                  onUpdateMultiple={handleEventUpdateMultiple}
                  onUpdateMultipleEnd={handleEventUpdateMultipleEnd}
                  onDelete={handleEventDelete}
                  slotHeight={slotHeight}
                  minutesPerSlot={minutesPerSlot}
                  left={layout.left}
                  width={layout.width}
                  forceEdit={editingEventId === event.id}
                  isSelected={selectedEventIds.has(event.id)}
                  selectedEventIds={selectedEventIds}
                  allEvents={events}
                  onSelect={() => handleEventSelect(event.id)}
                  onEditEnd={() => {
                    if (editingEventId === event.id) {
                      setEditingEventId(null);
                    }
                  }}
                  onDragStart={() => {
                    // Store original overlap positions when drag starts
                    const overlappingEvents = events.filter((e) => 
                      e.id !== event.id && eventsOverlap(event, e)
                    );
                    if (overlappingEvents.length > 0) {
                      const group = [event, ...overlappingEvents];
                      group.sort((a, b) => {
                        const startA = a.startHour * 60 + a.startMinute;
                        const startB = b.startHour * 60 + b.startMinute;
                        if (startA !== startB) {
                          return startA - startB;
                        }
                        return a.id.localeCompare(b.id);
                      });
                      group.forEach((e, index) => {
                        originalOverlapPositionsRef.current.set(e.id, index);
                      });
                    }
                    setDraggingEventId(event.id);
                    // Don't deselect when dragging starts - allow multi-select to persist
                  }}
                  onDragEnd={() => {
                    setDraggingEventId(null);
                    originalOverlapPositionsRef.current.clear();
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

