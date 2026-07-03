/**
 * HAYA Browser Engine - Services
 * Manages simplified state, launcher bookmarks, history, and visibility hooks
 * in perfect alignment with the new Workspace Hub.
 */

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
  historyStack: string[];
  historyIndex: number;
  textContent?: string;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  category?: string;
}

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  progress: number;
  status: "downloading" | "completed" | "failed";
  size?: string;
  timestamp: string;
}

export interface BrowserHistoryItem {
  id: string;
  title: string;
  url: string;
  timestamp: string;
}

export class BrowserEngine {
  private static instance: BrowserEngine | null = null;

  private isBrowserVisible: boolean = false;
  private tabs: BrowserTab[] = [];
  private activeTabId: string = "tab_default";
  private bookmarks: Bookmark[] = [];
  private downloads: DownloadItem[] = [];
  private history: BrowserHistoryItem[] = [];

  // Listeners
  private listeners: (() => void)[] = [];

  private constructor() {
    this.tabs = [
      {
        id: "tab_default",
        url: "https://www.google.com",
        title: "Google Search",
        isLoading: false,
        historyStack: ["https://www.google.com"],
        historyIndex: 0,
        textContent: "Google Search Launcher Node Active."
      }
    ];

    this.bookmarks = [
      { id: "b1", title: "Wikipedia", url: "https://en.wikipedia.org" },
      { id: "b2", title: "YouTube", url: "https://www.youtube.com" },
      { id: "b3", title: "GitHub", url: "https://github.com" },
      { id: "b4", title: "ChatGPT", url: "https://chatgpt.com" },
      { id: "b5", title: "Google News", url: "https://news.google.com" },
    ];
  }

  public static getInstance(): BrowserEngine {
    if (!BrowserEngine.instance) {
      BrowserEngine.instance = new BrowserEngine();
    }
    return BrowserEngine.instance;
  }

  public registerListener(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  // --- PUBLIC API COMPATIBILITY ---
  
  public isVisible(): boolean {
    return this.isBrowserVisible;
  }

  public setVisible(visible: boolean): void {
    this.isBrowserVisible = visible;
    this.notify();
  }

  public getTabs(): BrowserTab[] {
    return this.tabs;
  }

  public getActiveTab(): BrowserTab | null {
    return this.tabs[0];
  }

  public getActiveTabId(): string {
    return this.activeTabId;
  }

  public getActiveTabText(): string {
    return this.tabs[0]?.textContent || "Google Search Engine Active. Real browser launcher active.";
  }

  public getBookmarks(): Bookmark[] {
    return this.bookmarks;
;
  }

  public getDownloads(): DownloadItem[] {
    return this.downloads;
  }

  public getHistory(): BrowserHistoryItem[] {
    return this.history;
  }

  public navigateActiveTab(url: string): void {
    if (this.tabs[0]) {
      this.tabs[0].url = url;
      this.tabs[0].title = url.includes(".") ? url.split(".")[1]?.toUpperCase() || "Webpage" : "Webpage";
      this.notify();
    }
  }
}
