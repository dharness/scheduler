export interface Event {
  id: string;
  calendarId: string;
  title: string;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  duration: number; // duration in minutes
  color?: number; // optional color index (0-5) for the event
}
