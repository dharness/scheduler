import { Event } from "./event";

export interface Calendar {
  id: string;
  name: string;
  events?: Event[];
}
