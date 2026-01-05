// Event colors are now defined in CSS as --color-event-{1-6}-{light|medium|dark|darkest}
// JavaScript only works with indices (0-5)
export const DEFAULT_EVENT_COLOR_INDEX = 0; // Index 0 = event color 1

export const PREDEFINED_COLOR_INDICES = [0, 1, 2, 3, 4, 5] as const;

// Helper to normalize color value (handles migration from string hex to numeric index)
export const normalizeEventColor = (
  color: string | number | undefined | null
): number => {
  // If it's undefined or null, use default
  if (color === undefined || color === null) {
    return DEFAULT_EVENT_COLOR_INDEX;
  }
  // If it's a number, clamp it to valid range (0-5)
  if (typeof color === "number") {
    if (color >= 0 && color <= 5) {
      return color;
    }
    // Clamp to valid range
    return Math.min(Math.max(color, 0), 5);
  }
  // If it's a string (old format), try to map it to an index
  // This handles migration from old hex color strings
  // Map old hex colors to new 6-color system (0-5)
  if (typeof color === "string") {
    const colorMap: Record<string, number> = {
      "#4285f4": 0, // Blue -> Color 1
      "#34a853": 1, // Green -> Color 2
      "#fbbc04": 2, // Yellow -> Color 3
      "#ea4335": 3, // Red -> Color 4
      "#9c27b0": 4, // Purple -> Color 5
      "#ff9800": 5, // Orange -> Color 6
    };
    return colorMap[color.toLowerCase()] ?? DEFAULT_EVENT_COLOR_INDEX;
  }
  // Fallback to default
  return DEFAULT_EVENT_COLOR_INDEX;
};

// Helper to get CSS variable name for event background color (light) from index
export const getEventColorVar = (index: number): string => {
  const normalizedIndex = normalizeEventColor(index);
  return `var(--color-event-${normalizedIndex + 1}-light)`;
};

// Helper to get CSS variable name for event text color (darkest) from index
export const getEventTextColorVar = (index: number): string => {
  const normalizedIndex = normalizeEventColor(index);
  return `var(--color-event-${normalizedIndex + 1}-darkest)`;
};

// Helper to get CSS variable name for event border color (medium) from index
export const getEventBorderColorVar = (index: number): string => {
  const normalizedIndex = normalizeEventColor(index);
  return `var(--color-event-${normalizedIndex + 1}-medium)`;
};

// Helper to get CSS variable name for event time range color (dark) from index
export const getEventTimeColorVar = (index: number): string => {
  const normalizedIndex = normalizeEventColor(index);
  return `var(--color-event-${normalizedIndex + 1}-dark)`;
};

// Helper to get CSS variable name for event darkest color from index
export const getEventDarkestColorVar = (index: number): string => {
  const normalizedIndex = normalizeEventColor(index);
  return `var(--color-event-${normalizedIndex + 1}-darkest)`;
};

// UI Colors
export const UI_COLORS = {
  PRIMARY: "#1976d2",
  PRIMARY_HOVER: "#1565c0",
  PRIMARY_ACTIVE: "#0d47a1",
  PRIMARY_LIGHT: "#4285f4",
  PRIMARY_LIGHT_HOVER: "#357ae8",
  PRIMARY_LIGHT_ACTIVE: "#2968d1",
  PRIMARY_IOS: "#007AFF",
  PRIMARY_IOS_HOVER: "#0056b3",
  PRIMARY_IOS_ACTIVE: "#004085",

  // Text
  TEXT_PRIMARY: "#333",
  TEXT_SECONDARY: "#666",
  TEXT_TERTIARY: "#999",
  TEXT_WHITE: "#ffffff",

  // Borders
  BORDER_LIGHT: "#e0e0e0",
  BORDER_LIGHTER: "#f0f0f0",
  BORDER_MEDIUM: "#ddd",

  // Backgrounds
  BG_WHITE: "#ffffff",
  BG_LIGHT: "#f5f5f5",
  BG_LIGHTER: "#f8f8f8",
  BG_HOVER: "#e8e8e8",
  BG_ERROR: "#ffebee",
  BG_DISABLED: "#e0e0e0",

  // Error
  ERROR: "#d32f2f",
  ERROR_DARK: "#c62828",
  ERROR_LIGHT: "#ffebee",

  // Success
  SUCCESS: "#4caf50",

  // Unsaved indicator
  UNSAVED: "#f44336",
} as const;

// RGBA values for overlays and shadows
export const OVERLAYS = {
  BLACK_10: "rgba(0, 0, 0, 0.1)",
  BLACK_20: "rgba(0, 0, 0, 0.2)",
  BLACK_30: "rgba(0, 0, 0, 0.3)",
  BLACK_40: "rgba(0, 0, 0, 0.4)",
  BLACK_50: "rgba(0, 0, 0, 0.5)",
  BLACK_80: "rgba(0, 0, 0, 0.8)",
  WHITE_15: "rgba(255, 255, 255, 0.15)",
  WHITE_20: "rgba(255, 255, 255, 0.2)",
  WHITE_50: "rgba(255, 255, 255, 0.5)",
  WHITE_60: "rgba(255, 255, 255, 0.6)",
  WHITE_70: "rgba(255, 255, 255, 0.7)",
} as const;
