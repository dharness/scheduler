import { GIST_ID } from "../constants";

const STORAGE_PREFIX = "dh_scheduler_";
const STORAGE_KEY_TOKEN = `${STORAGE_PREFIX}github_token`;

export const storageService = {
  getGistId: () => {
    return GIST_ID;
  },
  getGithubToken: (): string | null => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    return token ? token.trim() : null;
  },
  saveGithubToken: (token: string): void => {
    localStorage.setItem(STORAGE_KEY_TOKEN, token.trim());
  },
  clearGithubToken: (): void => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  },
};
