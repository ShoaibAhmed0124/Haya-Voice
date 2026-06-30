/**
 * HAYA Browser Engine - Services
 * Manages multi-tab states, bookmarks, downloads, history, zoom levels,
 * picture-in-picture hooks, search engines, and Haya's interaction hooks.
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
  progress: number; // 0 - 100
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

  private tabs: BrowserTab[] = [];
  private activeTabId: string = "";
  private bookmarks: Bookmark[] = [];
  private downloads: DownloadItem[] = [];
  private history: BrowserHistoryItem[] = [];
  private isBrowserVisible: boolean = false;
  
  // Custom Zoom per tab or globally (percentage, e.g. 100, 110, 120, etc.)
  private zoomLevel: number = 100;
  private isFullscreen: boolean = false;
  private isPipActive: boolean = false;

  // Listeners
  private listeners: (() => void)[] = [];

  private constructor() {
    // Initial standard fallback tabs
    this.createTab("https://en.wikipedia.org/wiki/Special:Random", "Wikipedia");
    this.createTab("https://www.youtube.com", "YouTube");

    // Seed default bookmarks
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

  // --- TAB MANAGMENT ---
  
  public getTabs(): BrowserTab[] {
    return this.tabs;
  }

  public getActiveTab(): BrowserTab | null {
    return this.tabs.find((t) => t.id === this.activeTabId) || this.tabs[0] || null;
  }

  public getActiveTabId(): string {
    return this.activeTabId;
  }

  public setActiveTab(tabId: string): void {
    if (this.tabs.some((t) => t.id === tabId)) {
      this.activeTabId = tabId;
      this.notify();
    }
  }

  public createTab(url: string, title: string = "New Tab"): string {
    const id = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const fixedUrl = this.sanitizeUrl(url);
    const newTab: BrowserTab = {
      id,
      url: fixedUrl,
      title,
      isLoading: false,
      historyStack: [fixedUrl],
      historyIndex: 0,
    };
    
    this.tabs.push(newTab);
    this.activeTabId = id;
    this.notify();
    return id;
  }

  public closeTab(tabId: string): void {
    if (this.tabs.length <= 1) {
      // Keep at least 1 tab
      this.createTab("https://en.wikipedia.org");
    }

    const index = this.tabs.findIndex((t) => t.id === tabId);
    this.tabs = this.tabs.filter((t) => t.id !== tabId);

    if (this.activeTabId === tabId) {
      // Select neighboring tab
      const nextActiveIndex = Math.max(0, index - 1);
      this.activeTabId = this.tabs[nextActiveIndex].id;
    }
    this.notify();
  }

  public reorderTabs(fromIdx: number, toIdx: number): void {
    if (fromIdx < 0 || fromIdx >= this.tabs.length || toIdx < 0 || toIdx >= this.tabs.length) return;
    const item = this.tabs.splice(fromIdx, 1)[0];
    this.tabs.splice(toIdx, 0, item);
    this.notify();
  }

  // --- NAVIGATION ---

  public navigateActiveTab(url: string, isFromHistory: boolean = false): void {
    const tab = this.getActiveTab();
    if (!tab) return;

    const sanitized = this.sanitizeUrl(url);
    tab.url = sanitized;
    tab.isLoading = true;

    if (!isFromHistory) {
      // Truncate forward history and push
      tab.historyStack = tab.historyStack.slice(0, tab.historyIndex + 1);
      tab.historyStack.push(sanitized);
      tab.historyIndex = tab.historyStack.length - 1;
    }

    // Add to historic log
    this.addHistoryItem(tab.title || sanitized, sanitized);
    this.notify();
  }

  public handlePageLoaded(tabId: string, title: string, bodyText?: string): void {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (tab) {
      tab.isLoading = false;
      tab.title = title || tab.title || "Loaded Page";
      if (bodyText) {
        tab.textContent = bodyText;
      }
      this.notify();
    }
  }

  public getActiveTabText(): string {
    const tab = this.getActiveTab();
    return tab?.textContent || "No text content loaded or webpage is currently loading. Wait a moment or reload.";
  }

  public goBack(): void {
    const tab = this.getActiveTab();
    if (tab && tab.historyIndex > 0) {
      tab.historyIndex--;
      this.navigateActiveTab(tab.historyStack[tab.historyIndex], true);
    }
  }

  public goForward(): void {
    const tab = this.getActiveTab();
    if (tab && tab.historyIndex < tab.historyStack.length - 1) {
      tab.historyIndex++;
      this.navigateActiveTab(tab.historyStack[tab.historyIndex], true);
    }
  }

  public refresh(): void {
    const tab = this.getActiveTab();
    if (tab) {
      tab.isLoading = true;
      this.notify();
      // Trigger update on React side
      setTimeout(() => {
        tab.isLoading = false;
        this.notify();
      }, 800);
    }
  }

  // --- BOOKMARKS ---

  public getBookmarks(): Bookmark[] {
    return this.bookmarks;
  }

  public toggleBookmark(title: string, url: string): void {
    const exists = this.bookmarks.find((b) => b.url === url);
    if (exists) {
      this.bookmarks = this.bookmarks.filter((b) => b.id !== exists.id);
    } else {
      this.bookmarks.push({
        id: `bmk_${Date.now()}`,
        title: title || "Bookmark",
        url,
      });
    }
    this.notify();
  }

  // --- DOWNLOADS ---

  public getDownloads(): DownloadItem[] {
    return this.downloads;
  }

  public triggerDownload(filename: string, url: string, size: string = "1.2 MB"): void {
    const id = `dl_${Date.now()}`;
    const newItem: DownloadItem = {
      id,
      filename,
      url,
      progress: 0,
      status: "downloading",
      size,
      timestamp: new Date().toLocaleTimeString(),
    };

    this.downloads = [newItem, ...this.downloads];
    this.notify();

    // Simulate download progress
    const interval = setInterval(() => {
      const dl = this.downloads.find((item) => item.id === id);
      if (dl) {
        if (dl.progress >= 100) {
          dl.status = "completed";
          clearInterval(interval);
        } else {
          dl.progress += Math.floor(Math.random() * 20) + 10;
          if (dl.progress > 100) dl.progress = 100;
        }
        this.notify();
      } else {
        clearInterval(interval);
      }
    }, 400);
  }

  // --- HISTORY ---

  public getHistory(): BrowserHistoryItem[] {
    return this.history;
  }

  private addHistoryItem(title: string, url: string): void {
    const existsIdx = this.history.findIndex((h) => h.url === url);
    if (existsIdx !== -1) {
      this.history.splice(existsIdx, 1);
    }
    this.history = [
      {
        id: `hist_${Date.now()}`,
        title,
        url,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...this.history,
    ].slice(0, 50); // limit to last 50 items
  }

  public clearHistory(): void {
    this.history = [];
    this.notify();
  }

  // --- VIEWPORT CONFIG ---

  public isVisible(): boolean {
    return this.isBrowserVisible;
  }

  public setVisible(visible: boolean): void {
    this.isBrowserVisible = visible;
    this.notify();
  }

  public getZoom(): number {
    return this.zoomLevel;
  }

  public setZoom(zoom: number): void {
    this.zoomLevel = Math.max(50, Math.min(200, zoom));
    this.notify();
  }

  public toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    this.notify();
  }

  public getFullscreenState(): boolean {
    return this.isFullscreen;
  }

  public togglePip(): void {
    this.isPipActive = !this.isPipActive;
    this.notify();
  }

  public getPipState(): boolean {
    return this.isPipActive;
  }

  // --- UTILS ---

  private sanitizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return "https://en.wikipedia.org";

    // Handle standard Google search query
    if (!trimmed.includes(".") || trimmed.includes(" ")) {
      return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }
}
