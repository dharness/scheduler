export interface Event {
  id: string;
  calendarId: string;
  title: string;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  duration: number; // duration in minutes
  color?: string; // optional color for the event
}

