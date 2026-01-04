import { Calendar } from "../types/calendar";

const FILE_NAME = "schedules.json";

interface GistFile {
  content: string;
}

interface GistResponse {
  files: {
    [key: string]: GistFile;
  };
}

interface GistData {
  calendars: Calendar[];
}

export const gistService = {
  /**
   * Fetch calendars from the Gist
   */
  fetchCalendars: async (
    gistId: string,
    githubToken: string
  ): Promise<Calendar[]> => {
    const token = githubToken;

    try {
      const response = await fetch(
        `https://api.github.com/gists/${gistId}?t=${new Date().getTime()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid GitHub token. Please check your token.");
        }
        if (response.status === 404) {
          throw new Error("Gist not found. Please check the Gist ID.");
        }
        throw new Error(`Failed to fetch Gist: ${response.statusText}`);
      }

      const data: GistResponse = await response.json();
      const file = data.files[FILE_NAME];

      if (!file) {
        // If file doesn't exist, return empty array
        console.log("Gist file not found, returning empty array");
        return [];
      }

      console.log("Raw Gist file content:", file.content);
      const parsedData: GistData = JSON.parse(file.content);
      console.log("Parsed Gist data:", parsedData);
      console.log("Calendars array:", parsedData.calendars);
      console.log("Number of calendars:", parsedData.calendars?.length || 0);
      return parsedData.calendars || [];
    } catch (error) {
      console.error("Error fetching calendars from Gist:", error);
      throw error;
    }
  },

  /**
   * Update calendars in the Gist
   */
  updateCalendars: async (
    calendars: Calendar[],
    gistId: string,
    githubToken: string
  ): Promise<void> => {
    const token = githubToken;

    try {
      console.log("Updating Gist with calendars:", calendars);
      console.log("Number of calendars to save:", calendars.length);
      const data: GistData = {
        calendars,
      };

      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: {
            [FILE_NAME]: {
              content: JSON.stringify(data, null, 2),
            },
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid GitHub token. Please check your token.");
        }
        throw new Error(`Failed to update Gist: ${response.statusText}`);
      }

      await response.json();
    } catch (error) {
      console.error("Error updating Gist:", error);
      throw error;
    }
  },
};
