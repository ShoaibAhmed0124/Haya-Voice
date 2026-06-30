import { ChatSession, ChatMessage } from "../components/ChatWorkspace";

export interface HayaStorageInterface {
  getSessions(): Promise<ChatSession[]>;
  saveSessions(sessions: ChatSession[]): Promise<void>;
  getLastActiveSessionId(): Promise<string | null>;
  saveLastActiveSessionId(id: string): Promise<void>;
}

export class HayaLocalStorage implements HayaStorageInterface {
  private SESSIONS_KEY = "haya_chat_sessions";
  private ACTIVE_ID_KEY = "haya_last_active_chat_id";

  async getSessions(): Promise<ChatSession[]> {
    const data = localStorage.getItem(this.SESSIONS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse sessions from local storage", e);
      return [];
    }
  }

  async saveSessions(sessions: ChatSession[]): Promise<void> {
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
  }

  async getLastActiveSessionId(): Promise<string | null> {
    return localStorage.getItem(this.ACTIVE_ID_KEY);
  }

  async saveLastActiveSessionId(id: string): Promise<void> {
    if (id) {
      localStorage.setItem(this.ACTIVE_ID_KEY, id);
    } else {
      localStorage.removeItem(this.ACTIVE_ID_KEY);
    }
  }
}

export const hayaStorage = new HayaLocalStorage();
