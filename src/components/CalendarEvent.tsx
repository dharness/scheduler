import React, { useEffect, useRef, useState } from "react";
import { useAppSelector } from "../store/hooks";
import { RootState } from "../store/store";
import { Event } from "../types/event";
import "./CalendarEvent.css";

interface CalendarEventProps {
  event: Event;
  onUpdate: (event: Event) => void; // Called during drag/resize for visual updates
  onUpdateEnd?: (event: Event) => void; // Called when drag/resize ends to save to Gist
  onUpdateMultiple?: (events: Event[]) => void; // Called during multi-select drag for visual updates
  onUpdateMultipleEnd?: (events: Event[]) => void; // Called when multi-select drag ends to save to Gist
  onDelete: (eventId: string) => void;
  slotHeight: number; // Height of each time slot in pixels
  minutesPerSlot: number; // Minutes per slot (60 minutes = 1 hour)
  left?: number; // Left position percentage for overlapping events
  width?: number; // Width percentage for overlapping events
  onDragStart?: () => void; // Callback when drag starts
  onDragEnd?: () => void; // Callback when drag ends
  forceEdit?: boolean; // Force the event into edit mode
  onEditEnd?: () => void; // Callback when editing ends
  isSelected?: boolean; // Whether this event is selected
  selectedEventIds?: Set<string>; // All selected event IDs (for multi-select drag)
  allEvents?: Event[]; // All events (needed for multi-select drag)
  onSelect?: () => void; // Callback when event is clicked (not dragged)
}

export const CalendarEvent: React.FC<CalendarEventProps> = ({
  event,
  onUpdate,
  onUpdateEnd,
  onUpdateMultiple,
  onUpdateMultipleEnd,
  onDelete,
  slotHeight,
  minutesPerSlot,
  left = 0,
  width = 100,
  onDragStart,
  onDragEnd,
  forceEdit = false,
  onEditEnd,
  isSelected = false,
  selectedEventIds = new Set(),
  allEvents = [],
  onSelect,
}) => {
  // Get Shift key state from Redux
  const isShiftPressed = useAppSelector(
    (state: RootState) => state.calendar.isShiftPressed
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, offsetY: 0 });
  const [resizeStart, setResizeStart] = useState({ y: 0, duration: 0 });
  const [mouseDownPos, setMouseDownPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const eventRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const latestEventRef = useRef<Event>(event); // Track latest event during drag/resize
  const originalEventRef = useRef<Event | null>(null); // Track original event state when drag/resize starts
  const originalSelectedEventsRef = useRef<Map<string, Event>>(new Map()); // Track original states of all selected events for multi-select

  // Calculate position and height based on event time
  // Calendar starts at 5am, so we need to adjust the position
  const calculatePosition = () => {
    let startMinutes = event.startHour * 60 + event.startMinute;

    // Adjust for calendar starting at 5am
    // Hours 5-23 are in the main section
    // Hours 0-4 are at the bottom
    let top: number;
    if (event.startHour >= 5) {
      // Main section: hours 5-23
      const minutesFrom5am = (event.startHour - 5) * 60 + event.startMinute;
      top = (minutesFrom5am / minutesPerSlot) * slotHeight;
    } else {
      // Bottom section: hours 0-4 (appears after 11pm)
      const minutesFrom5am =
        (24 - 5) * 60 + event.startHour * 60 + event.startMinute;
      top = (minutesFrom5am / minutesPerSlot) * slotHeight;
    }

    // Top aligns with time slot lines, no adjustment needed

    // Reduce height by 2px for bottom gap
    const height = (event.duration / minutesPerSlot) * slotHeight - 2;
    return { top, height };
  };

  const { top, height } = calculatePosition();

  // Update latest event ref when event prop changes
  useEffect(() => {
    latestEventRef.current = event;
  }, [event]);

  // Convert pixel position to time
  const pixelsToTime = (pixels: number) => {
    const slots = pixels / slotHeight;
    const totalMinutes = slots * minutesPerSlot;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes: Math.round(minutes) };
  };

  const handleMouseDown = (e: React.MouseEvent, isResize: boolean) => {
    e.stopPropagation();
    if (isResize) {
      setIsResizing(true);
      setResizeStart({ y: e.clientY, duration: event.duration });
      // Store original event state when resize starts
      originalEventRef.current = { ...event };
    } else {
      // Track mouse down position to detect click vs drag
      setMouseDownPos({ x: e.clientX, y: e.clientY });
      setIsDragging(true);
      onDragStart?.(); // Notify parent that drag started
      // Store original event state when drag starts
      originalEventRef.current = { ...event };

      // Store original states of all selected events for multi-select drag
      if (selectedEventIds.size > 1 && selectedEventIds.has(event.id)) {
        originalSelectedEventsRef.current.clear();
        allEvents
          .filter((e) => selectedEventIds.has(e.id))
          .forEach((e) => {
            originalSelectedEventsRef.current.set(e.id, { ...e });
          });
      }
      const container = eventRef.current?.closest(".calendar-events-column");
      if (container && eventRef.current) {
        const containerRect = container.getBoundingClientRect();
        const eventRect = eventRef.current.getBoundingClientRect();
        const initialY = e.clientY - containerRect.top + container.scrollTop;
        // Calculate offset from top of event to click position
        const offsetY = e.clientY - eventRect.top;
        setDragStart({ x: e.clientX, y: initialY, offsetY });
      }
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && eventRef.current) {
        const container = eventRef.current.closest(
          ".calendar-events-column"
        ) as HTMLElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const currentY = e.clientY - containerRect.top + container.scrollTop;

          // Adjust for the offset from where the user clicked within the event
          const adjustedY = currentY - dragStart.offsetY;

          // Convert pixel position to time, accounting for calendar starting at 5am
          const slots = adjustedY / slotHeight;
          const totalMinutes = slots * minutesPerSlot;

          let hours: number;
          let minutes: number;

          // Check if we're in the main section (5am-11pm) or bottom section (12am-4am)
          const minutesFrom5am = totalMinutes;
          const mainSectionMinutes = (24 - 5) * 60; // Minutes from 5am to 11pm

          if (minutesFrom5am < mainSectionMinutes) {
            // In main section (5am-11pm)
            hours = Math.floor(minutesFrom5am / 60) + 5;
            minutes = Math.round((minutesFrom5am % 60) / 15) * 15;
          } else {
            // In bottom section (12am-4am)
            const bottomMinutes = minutesFrom5am - mainSectionMinutes;
            hours = Math.floor(bottomMinutes / 60);
            minutes = Math.round((bottomMinutes % 60) / 15) * 15;
          }

          // Normalize
          if (hours < 0) hours = 0;
          if (hours > 23) hours = 23;
          if (minutes < 0) {
            minutes = 60 + minutes;
            hours = (hours - 1 + 24) % 24;
          }
          if (minutes >= 60) {
            minutes = 0;
            hours = (hours + 1) % 24;
          }

          const updatedEvent = {
            ...event,
            startHour: hours,
            startMinute: minutes,
          };
          latestEventRef.current = updatedEvent; // Track latest event

          // Check if this is a multi-select drag
          const isMultiSelect =
            selectedEventIds.size > 1 && selectedEventIds.has(event.id);

          if (
            isMultiSelect &&
            onUpdateMultiple &&
            originalEventRef.current &&
            originalSelectedEventsRef.current.size > 0
          ) {
            // Calculate the time delta for the dragged event in minutes from midnight
            const originalEvent = originalEventRef.current;
            const originalStartMinutes =
              originalEvent.startHour * 60 + originalEvent.startMinute;
            const newStartMinutes = hours * 60 + minutes;

            // Calculate delta, handling day wrap-around
            let deltaMinutes = newStartMinutes - originalStartMinutes;

            // If delta is very large (likely wrap-around), adjust it
            if (Math.abs(deltaMinutes) > 12 * 60) {
              if (deltaMinutes > 0) {
                deltaMinutes = deltaMinutes - 24 * 60;
              } else {
                deltaMinutes = deltaMinutes + 24 * 60;
              }
            }

            // Apply the same delta to all other selected events using their ORIGINAL positions
            const updatedEvents = Array.from(
              originalSelectedEventsRef.current.values()
            ).map((originalE) => {
              if (originalE.id === event.id) {
                return updatedEvent;
              }

              // Use the original position, not the current event state
              const originalStartMins =
                originalE.startHour * 60 + originalE.startMinute;
              let newStartMins = originalStartMins + deltaMinutes;

              // Normalize to 0-1439 (minutes in a day)
              while (newStartMins < 0) {
                newStartMins += 24 * 60;
              }
              newStartMins = newStartMins % (24 * 60);

              const newEHour = Math.floor(newStartMins / 60);
              const newEMinute = Math.round((newStartMins % 60) / 15) * 15;

              // Handle minute overflow
              let finalMinute = newEMinute;
              let finalHour = newEHour;
              if (finalMinute >= 60) {
                finalMinute = 0;
                finalHour = (finalHour + 1) % 24;
              }

              return {
                ...originalE,
                startHour: finalHour,
                startMinute: finalMinute,
              };
            });

            onUpdateMultiple(updatedEvents);
          } else {
            // Single event drag
            onUpdate(updatedEvent);
          }
        }
      } else if (isResizing) {
        const deltaY = e.clientY - resizeStart.y;
        const deltaMinutes = (deltaY / slotHeight) * minutesPerSlot;
        const newDuration = Math.max(
          15,
          Math.round((resizeStart.duration + deltaMinutes) / 15) * 15
        );

        const updatedEvent = {
          ...event,
          duration: newDuration,
        };
        latestEventRef.current = updatedEvent; // Track latest event
        onUpdate(updatedEvent);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isDragging) {
        // Check if this was a click (no movement) or a drag
        if (mouseDownPos) {
          const moveDistance = Math.sqrt(
            Math.pow(e.clientX - mouseDownPos.x, 2) +
              Math.pow(e.clientY - mouseDownPos.y, 2)
          );
          // If mouse moved less than 5px, consider it a click
          if (moveDistance < 5) {
            // This was a click, not a drag - select the event
            onSelect?.();
            setIsDragging(false);
            setMouseDownPos(null);
            onDragEnd?.();
            return;
          }
        }

        const originalEvent = originalEventRef.current;
        const currentEvent = latestEventRef.current;

        // Check if this is a multi-select drag
        const isMultiSelect =
          selectedEventIds.size > 1 && selectedEventIds.has(event.id);

        if (
          isMultiSelect &&
          onUpdateMultipleEnd &&
          originalEvent &&
          originalSelectedEventsRef.current.size > 0
        ) {
          // Check if any event actually moved
          const originalStartMinutes =
            originalEvent.startHour * 60 + originalEvent.startMinute;
          const newStartMinutes =
            currentEvent.startHour * 60 + currentEvent.startMinute;

          // Calculate delta, handling day wrap-around
          let deltaMinutes = newStartMinutes - originalStartMinutes;
          if (Math.abs(deltaMinutes) > 12 * 60) {
            if (deltaMinutes > 0) {
              deltaMinutes = deltaMinutes - 24 * 60;
            } else {
              deltaMinutes = deltaMinutes + 24 * 60;
            }
          }

          if (deltaMinutes !== 0) {
            // Calculate updated events for all selected events using their ORIGINAL positions
            const updatedEvents = Array.from(
              originalSelectedEventsRef.current.values()
            ).map((originalE) => {
              if (originalE.id === event.id) {
                return currentEvent;
              }

              // Use the original position, not the current event state
              const originalStartMins =
                originalE.startHour * 60 + originalE.startMinute;
              let newStartMins = originalStartMins + deltaMinutes;

              // Normalize to 0-1439 (minutes in a day)
              while (newStartMins < 0) {
                newStartMins += 24 * 60;
              }
              newStartMins = newStartMins % (24 * 60);

              const newEHour = Math.floor(newStartMins / 60);
              const newEMinute = Math.round((newStartMins % 60) / 15) * 15;

              // Handle minute overflow
              let finalMinute = newEMinute;
              let finalHour = newEHour;
              if (finalMinute >= 60) {
                finalMinute = 0;
                finalHour = (finalHour + 1) % 24;
              }

              return {
                ...originalE,
                startHour: finalHour,
                startMinute: finalMinute,
              };
            });

            onUpdateMultipleEnd(updatedEvents);
          }

          // Clear the original selected events ref
          originalSelectedEventsRef.current.clear();
        } else {
          // Single event drag - only save if position actually changed
          if (
            originalEvent &&
            (currentEvent.startHour !== originalEvent.startHour ||
              currentEvent.startMinute !== originalEvent.startMinute)
          ) {
            onUpdateEnd?.(currentEvent);
          }
        }

        onDragEnd?.(); // Notify parent that drag ended
        originalEventRef.current = null;
        setMouseDownPos(null);
      } else if (isResizing) {
        const originalEvent = originalEventRef.current;
        const currentEvent = latestEventRef.current;

        // Only save if duration actually changed
        if (originalEvent && currentEvent.duration !== originalEvent.duration) {
          onUpdateEnd?.(currentEvent);
        }
        originalEventRef.current = null;
      }
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [
    isDragging,
    isResizing,
    dragStart,
    resizeStart,
    event,
    onUpdate,
    onUpdateMultiple,
    onUpdateMultipleEnd,
    slotHeight,
    minutesPerSlot,
    onDragEnd,
    mouseDownPos,
    onSelect,
    selectedEventIds,
    allEvents,
  ]);

  const handleTitleClick = (e: React.MouseEvent) => {
    // If Shift is pressed, treat it as a selection click (multi-select mode)
    if (isShiftPressed) {
      e.stopPropagation();
      e.preventDefault();
      // Directly trigger selection
      onSelect?.();
      return;
    }

    e.stopPropagation();
    // Only allow editing if clicking directly on the text, not on padding/empty space
    const target = e.target as HTMLElement;
    // Check if the click is actually on the text content, not just the container
    if (
      target.textContent &&
      target.textContent.trim() &&
      !isDragging &&
      !isResizing
    ) {
      setIsEditing(true);
    }
  };

  const handleTitleBlur = () => {
    setIsEditing(false);
    if (titleRef.current) {
      const trimmedTitle = titleRef.current.textContent?.trim() || "New Event";
      if (trimmedTitle !== event.title) {
        const updatedEvent = { ...event, title: trimmedTitle };
        onUpdate(updatedEvent);
        // Save to Gist only if title actually changed
        onUpdateEnd?.(updatedEvent);
      } else {
        // Title didn't change, reset to original
        titleRef.current.textContent = event.title;
      }
    }
    onEditEnd?.(); // Notify parent that editing ended
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      titleRef.current?.blur(); // This will trigger handleTitleBlur which handles saving
    } else if (e.key === "Escape") {
      setIsEditing(false);
      if (titleRef.current) {
        titleRef.current.textContent = event.title; // Reset to original title
      }
      onEditEnd?.(); // Notify parent that editing ended
    }
  };

  const handleTitleInput = (e: React.FormEvent<HTMLDivElement>) => {
    // Allow the content to update naturally
    // No need to prevent default here
  };

  // Handle force edit mode (for newly created events)
  useEffect(() => {
    if (forceEdit && !isEditing) {
      setIsEditing(true);
    }
  }, [forceEdit, isEditing]);

  // Focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(titleRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing]);

  // Exit edit mode when clicking outside the input
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Exit edit mode if click is NOT on the input field
      // This includes clicks on the event itself, the drag area, or anywhere else
      if (titleRef.current && !titleRef.current.contains(target)) {
        // Use setTimeout to ensure this runs after other mousedown handlers
        setTimeout(() => {
          if (titleRef.current) {
            titleRef.current.blur();
          }
        }, 0);
      }
    };

    // Use mousedown instead of click to catch it before other handlers
    document.addEventListener("mousedown", handleClickOutside, true); // Use capture phase
    return () =>
      document.removeEventListener("mousedown", handleClickOutside, true);
  }, [isEditing]);

  // Note: Keyboard delete is now handled at the CalendarView level for multi-select support
  // Individual event delete handlers are no longer needed here

  return (
    <div
      ref={eventRef}
      className={`calendar-event ${isDragging ? "dragging" : ""} ${
        isResizing ? "resizing" : ""
      } ${width < 100 ? "overlapping" : ""} ${isSelected ? "selected" : ""} ${
        isShiftPressed ? "multiselect-mode" : ""
      }`}
      style={
        {
          top: `${top}px`,
          height: `${height}px`,
          left: `${left}%`,
          width: width < 100 ? `calc(${width}% - 2px)` : `${width}%`,
          backgroundColor: event.color || "#4285f4",
          "--event-color": event.color || "#4285f4",
        } as React.CSSProperties
      }
      onMouseDown={(e) => {
        e.stopPropagation();
        // Don't start drag if clicking on title with Shift pressed
        const target = e.target as HTMLElement;
        if (isShiftPressed && target.closest(".event-title")) {
          return; // Let the title click handler deal with it
        }
        handleMouseDown(e, false);
      }}
    >
      <div className="event-content">
        <div
          ref={titleRef}
          className="event-title"
          contentEditable={isEditing}
          suppressContentEditableWarning={true}
          onClick={handleTitleClick}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          onInput={handleTitleInput}
          onMouseDown={(e) => {
            // Always stop propagation to prevent drag from starting when clicking title
            e.stopPropagation();
            // If Shift is pressed, also prevent the event's main mousedown handler
            if (isShiftPressed) {
              // The click handler will handle the selection
            }
          }}
        >
          {event.title}
        </div>
        {(event.duration >= 120 || (event.duration >= 90 && width >= 100)) && (
          <div className="event-time">
            {formatTime(event.startHour, event.startMinute)} -{" "}
            {formatEndTime(event)}
          </div>
        )}
      </div>
      <div
        className="event-resize-handle"
        onMouseDown={(e) => handleMouseDown(e, true)}
      />
    </div>
  );
};

const formatTime = (hour: number, minute: number): string => {
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const period = hour < 12 ? "AM" : "PM";
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m} ${period}`;
};

const formatEndTime = (event: Event): string => {
  const totalMinutes =
    event.startHour * 60 + event.startMinute + event.duration;
  const endHour = Math.floor(totalMinutes / 60) % 24;
  const endMinute = totalMinutes % 60;
  return formatTime(endHour, endMinute);
};
