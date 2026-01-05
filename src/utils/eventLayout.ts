import { Event } from "../types/event";

/**
 * Check if two events overlap in time
 */
export const eventsOverlap = (event1: Event, event2: Event): boolean => {
  const start1 = event1.startHour * 60 + event1.startMinute;
  const end1 = start1 + event1.duration;
  const start2 = event2.startHour * 60 + event2.startMinute;
  const end2 = start2 + event2.duration;

  // Events overlap if they share any time
  return end1 > start2 && end2 > start1;
};

export interface EventLayoutParams {
  /** The event to calculate layout for */
  event: Event;
  /** All events in the calendar */
  allEvents: Event[];
  /** ID of the event currently being dragged (null if none) */
  draggingEventId: string | null;
  /** ID of the event that was just dropped (null if none) */
  lastDraggedEventId: string | null;
  /** Map of event IDs to their original column assignments before drag started */
  originalOverlapPositions: Map<string, number>;
}

export interface EventLayout {
  /** Left position as a percentage (0-100) */
  left: number;
  /** Width as a percentage (0-100) */
  width: number;
}

/**
 * Calculate the maximum number of simultaneous overlapping events in a region
 */
const calculateMaxSimultaneous = (events: Event[]): number => {
  if (events.length === 0) return 0;

  // Find all unique time points (start and end times)
  const timePoints = new Set<number>();
  events.forEach((e) => {
    const start = e.startHour * 60 + e.startMinute;
    const end = start + e.duration;
    timePoints.add(start);
    timePoints.add(end);
  });

  // For each time point, count how many events are active
  let maxSimultaneous = 0;
  for (const timePoint of Array.from(timePoints)) {
    let count = 0;
    for (const e of events) {
      const start = e.startHour * 60 + e.startMinute;
      const end = start + e.duration;
      if (timePoint >= start && timePoint < end) {
        count++;
      }
    }
    maxSimultaneous = Math.max(maxSimultaneous, count);
  }

  return maxSimultaneous;
};

/**
 * Find all events in the overlap region (events that overlap with any event in the initial group)
 */
export const findOverlapRegion = (
  event: Event,
  allEvents: Event[]
): Event[] => {
  const overlappingEvents = allEvents.filter(
    (e) => e.id !== event.id && eventsOverlap(event, e)
  );

  if (overlappingEvents.length === 0) {
    return [event];
  }

  // Expand to include all events that overlap with any event in the group
  const region = new Set<string>([event.id]);
  overlappingEvents.forEach((e) => region.add(e.id));

  let changed = true;
  while (changed) {
    changed = false;
    for (const e of allEvents) {
      if (!region.has(e.id)) {
        // Check if this event overlaps with any event in the region
        for (const id of Array.from(region)) {
          const otherEvent = allEvents.find((ev) => ev.id === id);
          if (otherEvent && eventsOverlap(e, otherEvent)) {
            region.add(e.id);
            changed = true;
            break;
          }
        }
      }
    }
  }

  return Array.from(region)
    .map((id) => allEvents.find((e) => e.id === id)!)
    .filter(Boolean);
};

/**
 * Assign events to columns using a greedy algorithm
 */
export const assignColumns = (
  events: Event[],
  originalColumnAssignments: Map<string, number>
): Map<string, number> => {
  const eventToColumn = new Map<string, number>();
  const columns: Event[][] = [];

  // Sort events: those with original column assignments first (by their original column),
  // then others by start time
  const sortedEvents = [...events].sort((a, b) => {
    const aOrigCol = originalColumnAssignments.get(a.id);
    const bOrigCol = originalColumnAssignments.get(b.id);

    // Both have original columns - use them
    if (aOrigCol !== undefined && bOrigCol !== undefined) {
      return aOrigCol - bOrigCol;
    }

    // Only one has original column - it comes first
    if (aOrigCol !== undefined) return -1;
    if (bOrigCol !== undefined) return 1;

    // Neither has original column - sort by start time
    const startA = a.startHour * 60 + a.startMinute;
    const startB = b.startHour * 60 + b.startMinute;
    if (startA !== startB) {
      return startA - startB;
    }
    return a.id.localeCompare(b.id);
  });

  // Assign columns
  for (const e of sortedEvents) {
    const origCol = originalColumnAssignments.get(e.id);

    // If event has an original column assignment, try to use it
    if (origCol !== undefined) {
      // Check if we can use the original column
      if (origCol < columns.length) {
        const columnEvents = columns[origCol];
        const overlaps = columnEvents.some((existingEvent) =>
          eventsOverlap(e, existingEvent)
        );
        if (!overlaps) {
          // Can use original column
          columns[origCol].push(e);
          eventToColumn.set(e.id, origCol);
          continue;
        }
      }
      // Original column doesn't work, fall through to greedy assignment
    }

    // Greedy assignment: find leftmost column where this event doesn't overlap
    let assignedColumn = -1;
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const columnEvents = columns[colIndex];
      const overlaps = columnEvents.some((existingEvent) =>
        eventsOverlap(e, existingEvent)
      );
      if (!overlaps) {
        assignedColumn = colIndex;
        break;
      }
    }

    if (assignedColumn === -1) {
      // Need a new column
      assignedColumn = columns.length;
      columns.push([]);
    }

    columns[assignedColumn].push(e);
    eventToColumn.set(e.id, assignedColumn);
  }

  return eventToColumn;
};

/**
 * Calculate the drop position and width for an event.
 * This function determines:
 * 1) How wide the event should be (based on maximum simultaneous overlaps)
 * 2) In which horizontal position it should be (based on column assignment)
 *
 * @param params - Parameters for layout calculation
 * @returns The layout (left position and width) for the event
 */
export const calculateEventLayout = (
  params: EventLayoutParams
): EventLayout => {
  const {
    event,
    allEvents,
    draggingEventId,
    lastDraggedEventId,
    originalOverlapPositions,
  } = params;

  // Determine if this event is being dragged
  const isEventDragging = draggingEventId === event.id;

  // If this is the dragged event, check if it overlaps with other events
  // If it doesn't overlap, calculate its normal layout (which will be full width on left)
  // If it does overlap, make it full width and left-aligned so it can be positioned properly
  if (isEventDragging) {
    // Check if the dragged event overlaps with any other events at its current position
    const overlappingEvents = allEvents.filter(
      (e) => e.id !== event.id && eventsOverlap(event, e)
    );

    // If no overlaps, calculate normal layout (will be full width, left-aligned)
    if (overlappingEvents.length === 0) {
      return { left: 0, width: 100 };
    }

    // If it overlaps, return full width and left-aligned
    // The dragged event floats above and doesn't affect other events' layouts
    return { left: 0, width: 100 };
  }

  // For non-dragged events, exclude the currently dragging event from calculations
  // This ensures the dragged event doesn't displace other events
  const eventsExcludingDragged = draggingEventId
    ? allEvents.filter((e) => e.id !== draggingEventId)
    : allEvents;

  // Find all events that overlap with this event (excluding the dragged event)
  const overlappingEvents = eventsExcludingDragged.filter(
    (e) => e.id !== event.id && eventsOverlap(event, e)
  );

  if (overlappingEvents.length === 0) {
    // No overlaps, full width
    return { left: 0, width: 100 };
  }

  // Find the entire overlap region (excluding the dragged event)
  const eventsInOverlapRegion = findOverlapRegion(
    event,
    eventsExcludingDragged
  );

  // Calculate maximum simultaneous overlaps to determine width
  const maxSimultaneous = calculateMaxSimultaneous(eventsInOverlapRegion);
  const totalColumns = maxSimultaneous;

  // Calculate width
  const baseWidthPercent = 100 / totalColumns;
  const widthPercent = Math.max(
    baseWidthPercent - totalColumns * 0.3,
    baseWidthPercent * 0.97
  );

  // Determine if this event was just dropped
  const isLastDraggedEvent = lastDraggedEventId === event.id;
  const isDropped = isLastDraggedEvent;

  // Check if this event was in the original overlap group when drag started
  // originalOverlapPositions stores the column assignments from when drag started
  const wasInOriginalOverlapGroup = originalOverlapPositions.has(event.id);

  // Build original column assignments map - these are the actual column numbers from when drag started
  // We restore original positions for all events in the overlap region if any of them were in the original group
  // This ensures that when an event is dropped back, all events try to return to their original positions
  const originalColumnAssignments = new Map<string, number>();

  // Check if any event in the overlap region was in the original overlap group
  const hasOriginalOverlapEvents = eventsInOverlapRegion.some((e) =>
    originalOverlapPositions.has(e.id)
  );

  // If we have original positions and we're not currently dragging (or just dropped),
  // restore original positions for all events in the region
  if (hasOriginalOverlapEvents && !draggingEventId) {
    // Restore original column assignments for all events that are still in the overlap region
    originalOverlapPositions.forEach((originalColumn, eventId) => {
      // Only include if the event is still in the overlap region
      if (eventsInOverlapRegion.some((e) => e.id === eventId)) {
        originalColumnAssignments.set(eventId, originalColumn);
      }
    });
  }

  // Assign columns to all events in the overlap region
  const eventToColumn = assignColumns(
    eventsInOverlapRegion,
    originalColumnAssignments
  );

  // If this is a dropped event that wasn't in the original overlap group, place it in the rightmost column
  if (isDropped && !wasInOriginalOverlapGroup) {
    const maxColumn = Math.max(...Array.from(eventToColumn.values()), 0);
    eventToColumn.set(event.id, maxColumn);
  }

  // Get the column for this event
  const eventColumn = eventToColumn.get(event.id) ?? 0;
  const leftPercent = eventColumn * baseWidthPercent;

  return { left: leftPercent, width: widthPercent };
};
