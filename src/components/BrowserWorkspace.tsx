import { useEffect, useState, useRef, FormEvent, MouseEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Search,
  Plus,
  X,
  Bookmark,
  BookmarkCheck,
  Download,
  History,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Tv,
  Eye,
  Settings,
  Flame,
  Globe,
  Youtube,
  Music,
  MousePointer,
  ChevronDown,
  Layout,
  Command,
  FileText,
  Volume2,
  VolumeX,
  Play,
  Pause,
  FastForward,
  Info,
  ExternalLink,
  Sliders,
  Sparkles
} from "lucide-react";
import { ShieldAlert, Monitor, CheckCircle2 } from "lucide-react";
import { BrowserEngine, BrowserTab, Bookmark as BookmarkType, DownloadItem, BrowserHistoryItem } from "../services/browserEngine";

interface BrowserWorkspaceProps {
  onSendSystemMsg: (text: string) => void;
  triggerOverlay: (text: string) => void;
  isVisionActive?: boolean;
  onToggleVision?: () => Promise<void> | void;
}

// Check if a URL belongs to a heavy/secured domain that blocks frames or benefits from local cookies/execution
const isHeavyOrSecuredDomain = (url: string): boolean => {
  if (!url) return false;
  try {
    let checkUrl = url;
    if (!/^https?:\/\//i.test(checkUrl)) {
      checkUrl = "https://" + checkUrl;
    }
    const parsed = new URL(checkUrl);
    const host = parsed.hostname.toLowerCase();
    const securedDomains = [
      "youtube.com", "youtu.be", "chatgpt.com", "openai.com", "github.com",
      "google.com", "gmail.com", "docs.google.com", "drive.google.com", "spotify.com",
      "soundcloud.com", "notion.so", "canva.com", "figma.com", "zoom.us", "microsoft.com",
      "slack.com", "netflix.com", "twitter.com", "x.com", "facebook.com", "instagram.com",
      "accounts.google.com", "login.microsoftonline.com", "github.com/login"
    ];
    return securedDomains.some(d => host === d || host.endsWith("." + d));
  } catch (e) {
    return false;
  }
};

export default function BrowserWorkspace({ 
  onSendSystemMsg, 
  triggerOverlay,
  isVisionActive = false,
  onToggleVision
}: BrowserWorkspaceProps) {
  const browserEngine = BrowserEngine.getInstance();

  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [history, setHistory] = useState<BrowserHistoryItem[]>([]);
  const [zoom, setZoom] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPip, setIsPip] = useState<boolean>(false);

  // Forced embedded mode states for selected tabs
  const [embeddedForcedTabs, setEmbeddedForcedTabs] = useState<Record<string, boolean>>({});

  // Dynamic show/hide of controls
  const [showControls, setShowControls] = useState<boolean>(true);
  const [addressBarInput, setAddressBarInput] = useState<string>("");

  // Sub-panels
  const [activePanel, setActivePanel] = useState<"none" | "bookmarks" | "downloads" | "history">("none");
  const [findInPageOpen, setFindInPageOpen] = useState<boolean>(false);
  const [findText, setFindText] = useState<string>("");

  // YouTube Helper state
  const [showYoutubeHelper, setShowYoutubeHelper] = useState<boolean>(false);
  const [ytVolume, setYtVolume] = useState<number>(80);
  const [ytSpeed, setYtSpeed] = useState<number>(1);
  const [ytMuted, setYtMuted] = useState<boolean>(false);
  const [ytPlaying, setYtPlaying] = useState<boolean>(true);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Load state and listen to updates
  useEffect(() => {
    const updateState = () => {
      setTabs([...browserEngine.getTabs()]);
      setActiveTabId(browserEngine.getActiveTabId());
      setBookmarks([...browserEngine.getBookmarks()]);
      setDownloads([...browserEngine.getDownloads()]);
      setHistory([...browserEngine.getHistory()]);
      setZoom(browserEngine.getZoom());
      setIsFullscreen(browserEngine.getFullscreenState());
      setIsPip(browserEngine.getPipState());

      const active = browserEngine.getActiveTab();
      if (active) {
        setAddressBarInput(active.url);
      }
    };

    const unsubscribe = browserEngine.registerListener(updateState);
    updateState();

    return () => {
      unsubscribe();
    };
  }, []);

  // Update URL input when active tab changes
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0] || null;
  useEffect(() => {
    if (activeTab) {
      setAddressBarInput(activeTab.url);
    }
  }, [activeTabId]);

  // Listen to frame navigation updates from the injected proxy script
  useEffect(() => {
    const handleFrameMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;

      const { type, url, title, text } = e.data;

      if (type === "HAYA_BROWSER_NAVIGATE") {
        if (activeTab && url) {
          browserEngine.navigateActiveTab(url, false);
        }
      } else if (type === "HAYA_BROWSER_LOADED") {
        if (activeTab) {
          browserEngine.handlePageLoaded(activeTab.id, title, text);
          // If loading YouTube, automatically pop up YouTube helper controls
          if (url.includes("youtube.com")) {
            setShowYoutubeHelper(true);
          }
        }
      }
    };

    window.addEventListener("message", handleFrameMessage);
    return () => {
      window.removeEventListener("message", handleFrameMessage);
    };
  }, [activeTabId, activeTab]);

  // Action handlers
  const handleNavigateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (addressBarInput.trim()) {
      browserEngine.navigateActiveTab(addressBarInput);
      triggerOverlay(`Navigating to ${addressBarInput}`);
    }
  };

  const handleNewTab = () => {
    browserEngine.createTab("https://en.wikipedia.org/wiki/Special:Random", "New Tab");
    triggerOverlay("New workspace tab created");
  };

  const handleCloseTab = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    browserEngine.closeTab(id);
    triggerOverlay("Tab closed");
  };

  const handleBookmarkToggle = () => {
    if (activeTab) {
      browserEngine.toggleBookmark(activeTab.title, activeTab.url);
      const isBookmarked = bookmarks.some((b) => b.url === activeTab.url);
      triggerOverlay(isBookmarked ? "Bookmark removed" : "Bookmark saved");
    }
  };

  // Find in page simulation
  const handleFind = (e: FormEvent) => {
    e.preventDefault();
    if (!findText) return;
    triggerOverlay(`Searching for: "${findText}"`);
    // In a real proxy engine, we post a message to search the DOM
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "FIND_IN_PAGE", text: findText }, "*");
    }
  };

  // YouTube player interface simulation triggers
  const sendYoutubeControl = (action: string, value?: any) => {
    triggerOverlay(`YouTube Control: ${action}`);
    if (action === "play") setYtPlaying(true);
    if (action === "pause") setYtPlaying(false);
    if (action === "mute") setYtMuted(!ytMuted);
    if (action === "volume") setYtVolume(value);
    if (action === "speed") setYtSpeed(value);

    // In a real browser context, we execute custom JavaScript inside the iframe or through proxy
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: "YT_MEDIA_CONTROL",
        action,
        value
      }, "*");
    }
  };

  const getProxyUrl = (targetUrl: string) => {
    if (!targetUrl) return undefined;
    return `/api/browser/proxy?url=${encodeURIComponent(targetUrl)}`;
  };

  const handleQuickLink = (url: string) => {
    browserEngine.navigateActiveTab(url);
    triggerOverlay(`Opening preset URL`);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#03060c] text-slate-300 relative select-none">
      
      {/* 1. AUTO-HIDE CHROME BAR FOR CINEMATIC IMMERSION */}
      <div 
        className="w-full transition-all duration-300 relative z-30"
        onMouseEnter={() => setShowControls(true)}
      >
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full bg-[#070b12] border-b border-white/5 flex flex-col p-2 gap-2"
            >
              {/* TABS HEADER BAR */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
                <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                  <Globe className="w-3 h-3 text-cyan-400" />
                  <span className="text-[9px] font-mono tracking-wider font-bold text-slate-400 uppercase">
                    Haya_Browser_Workspace
                  </span>
                </div>

                <div className="h-4 w-px bg-white/10 mx-1" />

                {/* Tab items list with simple interactive reordering buttons */}
                {tabs.map((tab, idx) => {
                  const isActive = tab.id === activeTabId;
                  return (
                    <div
                      key={tab.id}
                      onClick={() => browserEngine.setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-[10px] cursor-pointer transition-all duration-300 ${
                        isActive
                          ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)] font-bold"
                          : "bg-white/5 border-transparent text-slate-400 hover:bg-white/10 hover:text-slate-200"
                      }`}
                    >
                      <span className="max-w-[100px] truncate">{tab.title}</span>
                      {tab.isLoading && (
                        <RotateCw className="w-2.5 h-2.5 animate-spin text-cyan-400" />
                      )}
                      <button
                        onClick={(e) => handleCloseTab(tab.id, e)}
                        className="p-0.5 rounded-full hover:bg-white/10 text-slate-500 hover:text-slate-200 transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>

                      {/* Tab order shifters */}
                      <div className="flex flex-col gap-0.5 ml-1 opacity-0 hover:opacity-100 transition-opacity">
                        {idx > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); browserEngine.reorderTabs(idx, idx-1); }}
                            className="text-[6px] text-slate-500 hover:text-cyan-400"
                          >
                            ▲
                          </button>
                        )}
                        {idx < tabs.length - 1 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); browserEngine.reorderTabs(idx, idx+1); }}
                            className="text-[6px] text-slate-500 hover:text-cyan-400"
                          >
                            ▼
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={handleNewTab}
                  className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 cursor-pointer transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* CONTROLS & ADDRESS BAR */}
              <div className="flex items-center justify-between gap-3">
                {/* Back / Forward / Reload Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { browserEngine.goBack(); triggerOverlay("Back"); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-25 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { browserEngine.goForward(); triggerOverlay("Forward"); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-25 transition-all cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { browserEngine.refresh(); triggerOverlay("Refreshed Page"); }}
                    className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all cursor-pointer ${activeTab?.isLoading ? "animate-spin text-cyan-400" : ""}`}
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Main Address Input Box */}
                <form onSubmit={handleNavigateSubmit} className="flex-grow relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={addressBarInput}
                    onChange={(e) => setAddressBarInput(e.target.value)}
                    placeholder="Search or enter web address..."
                    className="w-full pl-9 pr-24 py-1.5 bg-[#030509] border border-white/5 rounded-xl font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10 transition-all select-text"
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                    {/* Bookmark star state */}
                    <button
                      type="button"
                      onClick={handleBookmarkToggle}
                      className="p-1 rounded text-slate-500 hover:text-yellow-400 transition-colors cursor-pointer"
                    >
                      {activeTab && bookmarks.some((b) => b.url === activeTab.url) ? (
                        <BookmarkCheck className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="text-[9px] font-mono text-slate-600 select-none hidden sm:inline">
                      PROXIED
                    </span>
                  </div>
                </form>

                {/* Sub features panel selectors */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActivePanel(activePanel === "bookmarks" ? "none" : "bookmarks")}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${activePanel === "bookmarks" ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
                    title="Bookmarks"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActivePanel(activePanel === "downloads" ? "none" : "downloads")}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${activePanel === "downloads" ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
                    title="Downloads"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActivePanel(activePanel === "history" ? "none" : "history")}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${activePanel === "history" ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
                    title="History"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setFindInPageOpen(!findInPageOpen)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all cursor-pointer"
                    title="Find in page"
                  >
                    <FileText className="w-4 h-4" />
                  </button>

                  <div className="h-5 w-px bg-white/10 mx-1" />

                  {/* Zoom controls */}
                  <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/5 px-1">
                    <button
                      onClick={() => browserEngine.setZoom(zoom - 10)}
                      className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
                    >
                      <ZoomOut className="w-3 h-3" />
                    </button>
                    <span className="text-[8px] font-mono font-bold text-slate-400 w-8 text-center select-none">
                      {zoom}%
                    </span>
                    <button
                      onClick={() => browserEngine.setZoom(zoom + 10)}
                      className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
                    >
                      <ZoomIn className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => browserEngine.toggleFullscreen()}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all cursor-pointer"
                    title="Fullscreen"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* BOOKMARKS QUICK LAUNCH BAR */}
              <div className="flex items-center gap-2 select-none overflow-x-auto pb-0.5 border-t border-white/5 pt-1.5 text-[9px] font-mono scrollbar-none">
                <span className="text-slate-600 tracking-wider">BOOKMARKS:</span>
                {bookmarks.map((bmk) => (
                  <button
                    key={bmk.id}
                    onClick={() => handleQuickLink(bmk.url)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 cursor-pointer transition-colors"
                  >
                    {bmk.url.includes("youtube.com") ? (
                      <Youtube className="w-2.5 h-2.5 text-rose-500" />
                    ) : bmk.url.includes("spotify.com") ? (
                      <Music className="w-2.5 h-2.5 text-green-500" />
                    ) : (
                      <Globe className="w-2.5 h-2.5 text-cyan-400" />
                    )}
                    <span>{bmk.title}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Toggle navigation bar handler on visual edge */}
        <div 
          onClick={() => setShowControls(!showControls)}
          className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 px-4 py-0.5 bg-[#070b12] border-x border-b border-white/10 rounded-b-xl flex items-center justify-center cursor-pointer opacity-40 hover:opacity-100 transition-opacity z-40"
        >
          <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-300 ${showControls ? "transform rotate-180" : ""}`} />
        </div>
      </div>

      {/* 2. FIND IN PAGE FLOATING PANEL */}
      <AnimatePresence>
        {findInPageOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 right-4 bg-[#0a0f1d] border border-white/10 rounded-xl p-2 shadow-2xl z-40 flex items-center gap-2"
          >
            <form onSubmit={handleFind} className="flex items-center gap-1.5">
              <input
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="Find in page..."
                className="px-2.5 py-1 bg-slate-950 border border-white/5 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-xs rounded-lg hover:bg-cyan-500/20 cursor-pointer"
              >
                Find
              </button>
            </form>
            <button
              onClick={() => setFindInPageOpen(false)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. SUB PANEL SLIDEOUT (Bookmarks, Downloads, History) */}
      <AnimatePresence>
        {activePanel !== "none" && (
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="absolute left-0 top-16 bottom-0 w-80 bg-[#060a12]/95 border-r border-white/10 backdrop-blur-3xl z-40 flex flex-col p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-200 tracking-wider">
                {activePanel}
              </span>
              <button
                onClick={() => setActivePanel("none")}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bookmarks Manager */}
            {activePanel === "bookmarks" && (
              <div className="flex-grow overflow-y-auto space-y-1.5">
                {bookmarks.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => { handleQuickLink(b.url); setActivePanel("none"); }}
                    className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors text-xs font-mono"
                  >
                    <div className="text-slate-200 truncate font-semibold">{b.title}</div>
                    <div className="text-slate-500 truncate text-[9px]">{b.url}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Downloads Manager */}
            {activePanel === "downloads" && (
              <div className="flex-grow overflow-y-auto space-y-2">
                {downloads.length > 0 ? (
                  downloads.map((dl) => (
                    <div key={dl.id} className="p-2.5 rounded-lg border border-white/5 bg-white/5 text-[10px] font-mono">
                      <div className="flex justify-between items-center text-slate-200 mb-1">
                        <span className="truncate font-semibold max-w-[150px]">{dl.filename}</span>
                        <span className="text-[8px] text-slate-500">{dl.size}</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1 mb-2">
                        <div
                          className="bg-cyan-400 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${dl.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] text-slate-500">
                        <span>{dl.progress}%</span>
                        <span className="uppercase text-cyan-400">{dl.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-600 italic text-xs py-8">No recent downloads.</div>
                )}
              </div>
            )}

            {/* History Manager */}
            {activePanel === "history" && (
              <div className="flex-grow overflow-y-auto space-y-1.5">
                {history.length > 0 ? (
                  history.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => { handleQuickLink(h.url); setActivePanel("none"); }}
                      className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors text-[10px] font-mono flex flex-col"
                    >
                      <div className="text-slate-200 truncate font-semibold">{h.title}</div>
                      <div className="text-slate-500 truncate text-[8px]">{h.url}</div>
                      <span className="text-[7px] text-slate-600 text-right mt-1">{h.timestamp}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-600 italic text-xs py-8">No recent history.</div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. REAL EMBEDDED WEB VIEWPORT */}
      <div className="flex-grow relative bg-slate-950 overflow-hidden flex items-center justify-center">
        {activeTab ? (
          isHeavyOrSecuredDomain(activeTab.url) && !embeddedForcedTabs[activeTab.id] ? (
            <div className="w-full h-full bg-[#050810] flex items-center justify-center p-6 md:p-12 relative overflow-hidden select-text">
              {/* Decorative cyber backdrop grid */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-purple-500/5 blur-[80px] rounded-full pointer-events-none animate-pulse" />

              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-xl w-full bg-[#090d16]/90 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl relative z-10"
              >
                {/* Header branding */}
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1.5 flex-grow">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
                        Hybrid Architecture
                      </span>
                    </div>
                    <h2 className="font-sans text-lg font-bold text-slate-100 tracking-tight">
                      Haya Hybrid Web Link Active
                    </h2>
                    <p className="font-sans text-xs text-slate-400 truncate max-w-[320px] sm:max-w-md">
                      {activeTab.url}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Explanation bullet points */}
                <div className="space-y-3.5">
                  <p className="font-sans text-[11px] text-slate-400 leading-relaxed">
                    This platform forces strict cross-origin security rules (<span className="font-mono text-cyan-400">SAMEORIGIN/CORS</span>) or requires active browser credentials to protect your privacy and sessions.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-sans">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-300">100% Native Playback & Audio</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-300">Your Cookies & Active Logins</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-300">Unrestricted GPT & Docs State</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-300">Zero Bot/CAPTCHA Checks</span>
                    </div>
                  </div>
                </div>

                {/* Main Action Buttons */}
                <div className="flex flex-col gap-2.5 mt-2">
                  <button
                    onClick={() => {
                      window.open(activeTab.url, "_blank");
                      triggerOverlay("Launching local tab");
                      onSendSystemMsg(`Opened hybrid link in external browser: ${activeTab.url}. I can assist you directly if you enable my Real-Time Vision Engine!`);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-slate-900 font-sans font-bold text-xs py-3 px-4 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] shadow-lg"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Local Browser (Default Chrome/Edge)
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    {onToggleVision && (
                      <button
                        onClick={() => {
                          onToggleVision();
                        }}
                        className={`flex items-center justify-center gap-1.5 font-mono text-[10px] border py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                          isVisionActive
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold"
                            : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        {isVisionActive ? "Vision Is Active" : "Sync Real-Time Vision"}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setEmbeddedForcedTabs(prev => ({ ...prev, [activeTab.id]: true }));
                        triggerOverlay("Bypassing sandboxed security");
                      }}
                      className="flex items-center justify-center gap-1.5 font-mono text-[10px] bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 py-2.5 px-3 rounded-xl cursor-pointer transition-all"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                      Force Embedded Mode
                    </button>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-[10px] font-mono text-slate-500">
                    💡 <span className="text-slate-400">Recommended Workspace Setup</span>: Click Launch, then click Sync Vision. I will watch your local Chrome browser and speak with you live!
                  </p>
                </div>
              </motion.div>
            </div>
          ) : (
            <div 
              className="w-full h-full transition-transform duration-300 relative"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left", width: `${10000 / zoom}%`, height: `${10000 / zoom}%` }}
            >
              <iframe
                ref={iframeRef}
                {...(getProxyUrl(activeTab.url) ? { src: getProxyUrl(activeTab.url) } : {})}
                className="w-full h-full border-0 select-text"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-storage-access-by-user-activation"
              />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-sm gap-4">
            <Globe className="w-12 h-12 text-slate-600 animate-pulse" />
            <div className="space-y-1">
              <h3 className="font-sans text-xs font-semibold text-slate-200">No active tab</h3>
              <p className="font-sans text-[11px] text-slate-500 leading-relaxed">
                Click the "+" button in the tabs bar to spin up a new visual browsing instance.
              </p>
            </div>
          </div>
        )}

        {/* 5. YOUTUBE / STREAMING HELPER PANEL */}
        <AnimatePresence>
          {showYoutubeHelper && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-[#090e18]/95 border border-white/10 rounded-2xl p-3 shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-40 max-w-md w-[90%] backdrop-blur-xl flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-1.5 select-none">
                <div className="flex items-center gap-1.5">
                  <Youtube className="w-4 h-4 text-rose-500" />
                  <span className="font-mono text-[9px] uppercase font-bold text-slate-200 tracking-wider">
                    Haya YouTube Experience Controller
                  </span>
                </div>
                <button
                  onClick={() => setShowYoutubeHelper(false)}
                  className="p-0.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4">
                {/* Media Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => sendYoutubeControl(ytPlaying ? "pause" : "play")}
                    className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/25 transition-all cursor-pointer"
                  >
                    {ytPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-cyan-400" />}
                  </button>
                  <button
                    onClick={() => sendYoutubeControl("next")}
                    className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                  >
                    <FastForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Volume slider */}
                <div className="flex items-center gap-2 flex-grow">
                  <button
                    onClick={() => sendYoutubeControl("mute")}
                    className="text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {ytMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={ytVolume}
                    onChange={(e) => sendYoutubeControl("volume", parseInt(e.target.value))}
                    className="flex-grow accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[8px] font-mono text-slate-500 w-6">{ytVolume}%</span>
                </div>

                {/* Playback speed multiplier */}
                <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/5 p-1 select-none">
                  {[1, 1.25, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => sendYoutubeControl("speed", speed)}
                      className={`px-1.5 py-0.5 rounded font-mono text-[8px] uppercase transition-colors cursor-pointer ${ytSpeed === speed ? "bg-cyan-400/25 text-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
