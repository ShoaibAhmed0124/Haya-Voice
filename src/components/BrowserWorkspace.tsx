import { useEffect, useState, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Plus,
  X,
  History,
  Settings,
  Flame,
  Globe,
  Youtube,
  Music,
  ChevronDown,
  Layout,
  Command,
  FileText,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Info,
  ExternalLink,
  Sliders,
  Sparkles,
  Lock,
  Home,
  CheckCircle2,
  Cpu,
  Bookmark,
  Activity,
  User,
  Zap,
  Navigation,
  Database,
  RefreshCw,
  Clock,
  Eye,
  ArrowLeft,
  ArrowRight
} from "lucide-react";
import { BrowserEngine } from "../services/browserEngine";

interface HayaMessage {
  id: string;
  sender: "user" | "haya";
  text: string;
  timestamp: string;
}

interface BrowserWorkspaceProps {
  onSendSystemMsg: (text: string) => void;
  triggerOverlay: (text: string) => void;
  isVisionActive?: boolean;
  visionSource?: "screen" | "front_camera" | "back_camera";
  onToggleVision?: (source: "screen" | "front_camera" | "back_camera") => Promise<void> | void;
  
  // Live sync states
  secretChats?: HayaMessage[];
  selectedPersona?: string;
  selectedVoice?: string;
  state?: string;
}

// Pre-defined premium launcher applications (always launches in REAL browser)
const PREMIUM_APPS = [
  {
    name: "Google Search",
    url: "https://www.google.com",
    category: "Search",
    icon: Globe,
    desc: "Scan the universal web indexes instantly in a new secure tab.",
    color: "from-blue-500/10 to-emerald-500/10 border-blue-500/20 text-blue-400",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]"
  },
  {
    name: "YouTube",
    url: "https://www.youtube.com",
    category: "Media",
    icon: Youtube,
    desc: "Stream visual guides, developer logs, or background lofi directly.",
    color: "from-red-500/10 to-orange-500/10 border-red-500/20 text-red-400",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]"
  },
  {
    name: "GitHub Developer",
    url: "https://github.com",
    category: "Development",
    icon: Command,
    desc: "Manage repositories, pull requests, and commit pipelines natively.",
    color: "from-slate-500/10 to-purple-500/10 border-slate-500/20 text-slate-300",
    glow: "shadow-[0_0_20px_rgba(100,116,139,0.15)]"
  },
  {
    name: "ChatGPT",
    url: "https://chatgpt.com",
    category: "AI Node",
    icon: Sparkles,
    desc: "Quick companion reasoning checks or boilerplate generations.",
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-400",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]"
  },
  {
    name: "Claude AI",
    url: "https://claude.ai",
    category: "AI Node",
    icon: Flame,
    desc: "Long-form drafting, architectural planning, and source auditing.",
    color: "from-amber-600/10 to-orange-500/10 border-amber-500/20 text-amber-400",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]"
  },
  {
    name: "Notion",
    url: "https://www.notion.so",
    category: "Knowledge",
    icon: FileText,
    desc: "Sync workbooks, design docs, and personal workspace boards.",
    color: "from-slate-700/20 to-zinc-900/40 border-slate-700/30 text-zinc-100",
    glow: "shadow-[0_0_20px_rgba(255,255,255,0.05)]"
  },
  {
    name: "Gmail Inbox",
    url: "https://mail.google.com",
    category: "Workspace",
    icon: Navigation,
    desc: "Review secure communication logs and incoming dispatches.",
    color: "from-red-600/10 to-purple-600/10 border-red-500/20 text-red-400",
    glow: "shadow-[0_0_20px_rgba(220,38,38,0.12)]"
  },
  {
    name: "Spotify Player",
    url: "https://open.spotify.com",
    category: "Acoustic",
    icon: Music,
    desc: "Inject high-fidelity flow music to optimize session focus.",
    color: "from-green-500/10 to-emerald-600/10 border-green-500/20 text-green-400",
    glow: "shadow-[0_0_20px_rgba(34,197,94,0.15)]"
  },
  {
    name: "Google Maps",
    url: "https://maps.google.com",
    category: "Grounding",
    icon: Home,
    desc: "Geospatial queries, route planning, and local mapping nodes.",
    color: "from-teal-500/10 to-cyan-500/10 border-teal-500/20 text-teal-400",
    glow: "shadow-[0_0_20px_rgba(20,184,166,0.15)]"
  },
  {
    name: "Twitter / X",
    url: "https://x.com",
    category: "Social Feed",
    icon: Globe,
    desc: "Analyze real-time global news streams, trends, and posts.",
    color: "from-zinc-950 to-zinc-900 border-zinc-800 text-zinc-300",
    glow: "shadow-[0_0_20px_rgba(255,255,255,0.03)]"
  }
];

export default function BrowserWorkspace({
  onSendSystemMsg,
  triggerOverlay,
  isVisionActive = false,
  visionSource = "screen",
  onToggleVision,
  secretChats = [],
  selectedPersona = "assistant",
  selectedVoice = "Aoede",
  state = "disconnected"
}: BrowserWorkspaceProps) {
  const [viewMode, setViewMode] = useState<"launcher" | "browser">("launcher");
  const [urlInput, setUrlInput] = useState("");
  const [launchHistory, setLaunchHistory] = useState<Array<{ name: string; url: string; time: string }>>(() => {
    const saved = localStorage.getItem("haya_launch_history");
    return saved ? JSON.parse(saved) : [];
  });

  // Integrated In-App Browser States
  const [browserUrl, setBrowserUrl] = useState("https://www.google.com");
  const [browserUrlInput, setBrowserUrlInput] = useState("https://www.google.com");
  const [iframeHistory, setIframeHistory] = useState<string[]>(["https://www.google.com"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // YouTube Integrated States & Helper
  const [ytSearchQuery, setYtSearchQuery] = useState("");
  const [ytVideos, setYtVideos] = useState<any[]>([]);
  const [isYtSearching, setIsYtSearching] = useState(false);

  const extractYoutubeVideoId = (url: string): string | null => {
    try {
      const trimmed = url.trim();
      if (!trimmed) return null;
      
      // Handle youtu.be/xxxx
      if (trimmed.includes("youtu.be/")) {
        return trimmed.split("youtu.be/")[1]?.split("?")[0] || null;
      }
      
      // Handle youtube.com/watch?v=xxxx
      if (trimmed.includes("v=")) {
        const urlParams = new URLSearchParams(trimmed.substring(trimmed.indexOf("?")));
        return urlParams.get("v");
      }
      
      // Handle youtube.com/embed/xxxx
      if (trimmed.includes("/embed/")) {
        return trimmed.split("/embed/")[1]?.split("?")[0] || null;
      }
    } catch (e) {
      console.error("YouTube parsing failed", e);
    }
    return null;
  };

  const YOUTUBE_RECOMMENDED_VIDEOS = [
    {
      videoId: "jfKfPfyJRdk",
      title: "lofi hip hop radio 📚 beats to relax/study to",
      thumbnail: "https://img.youtube.com/vi/jfKfPfyJRdk/0.jpg",
      author: "Lofi Girl",
      duration: "LIVE",
      views: "20K watching"
    },
    {
      videoId: "4xDzrJKXOOY",
      title: "Synthwave Radio 🌌 beats to chill/game to",
      thumbnail: "https://img.youtube.com/vi/4xDzrJKXOOY/0.jpg",
      author: "Lofi Girl",
      duration: "LIVE",
      views: "3K watching"
    },
    {
      videoId: "f02mOEt11gI",
      title: "1 A.M Study Session 📚 [lofi hip hop/chill beats]",
      thumbnail: "https://img.youtube.com/vi/f02mOEt11gI/0.jpg",
      author: "Lofi Girl",
      duration: "1:00:23",
      views: "42M views"
    },
    {
      videoId: "tNtFo7cAzR4",
      title: "Relaxing Coding Music 💻 Minimal Techno / Ambient Beats",
      thumbnail: "https://img.youtube.com/vi/tNtFo7cAzR4/0.jpg",
      author: "Lofi Records",
      duration: "2:15:40",
      views: "2.1M views"
    }
  ];

  const handleYoutubeSearch = async (queryStr: string) => {
    if (!queryStr.trim()) return;
    setIsYtSearching(true);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(queryStr)}`);
      if (res.ok) {
        const data = await res.json();
        setYtVideos(data.videos || []);
      }
    } catch (e) {
      console.error("YouTube search error:", e);
    } finally {
      setIsYtSearching(false);
    }
  };

  // Grounding controls inside Workspace
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"search" | "maps">("search");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState("");
  const [searchSources, setSearchSources] = useState<any[]>([]);

  // System Diagnostics
  const [cpuUsage, setCpuUsage] = useState(12);
  const [memoryUsage, setMemoryUsage] = useState(4.2);
  const [latency, setLatency] = useState(115);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Sync postMessage navigation from Iframe Proxy
  useEffect(() => {
    const handleIframeNav = (e: MessageEvent) => {
      if (e.data && e.data.type === "HAYA_BROWSER_NAVIGATE") {
        const targetUrl = e.data.url;
        setBrowserUrlInput(targetUrl);
        setBrowserUrl(targetUrl);
        
        // Update custom history array
        const nextHist = iframeHistory.slice(0, historyIndex + 1);
        nextHist.push(targetUrl);
        setIframeHistory(nextHist);
        setHistoryIndex(nextHist.length - 1);
      }
    };
    window.addEventListener("message", handleIframeNav);
    return () => window.removeEventListener("message", handleIframeNav);
  }, [iframeHistory, historyIndex]);

  useEffect(() => {
    // Scroll transcript feed to bottom on new chats
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [secretChats]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage((prev) => Math.max(4, Math.min(48, prev + (Math.random() > 0.5 ? 2 : -2))));
      setLatency((prev) => Math.max(90, Math.min(180, prev + (Math.random() > 0.5 ? 5 : -5))));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Helper to trigger haptics
  const playHaptic = (ms = 15) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  };

  // Launch URL natively in new real browser tab/window OR integrated browser based on tab mode
  const handleLaunch = (name: string, url: string, forceExternal = false) => {
    playHaptic(20);
    
    // Auto prefix protocol if missing
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      if (targetUrl.includes(".") && !targetUrl.includes(" ")) {
        targetUrl = "https://" + targetUrl;
      } else {
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
      }
    }

    // Add to launcher dispatch history
    const newHistory = [
      { name, url: targetUrl, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
      ...launchHistory.filter((item) => item.url !== targetUrl)
    ].slice(0, 15);
    
    setLaunchHistory(newHistory);
    localStorage.setItem("haya_launch_history", JSON.stringify(newHistory));

    if (viewMode === "browser" || !forceExternal) {
      // Load in integrated browser!
      setBrowserUrl(targetUrl);
      setBrowserUrlInput(targetUrl);
      
      const nextHist = iframeHistory.slice(0, historyIndex + 1);
      nextHist.push(targetUrl);
      setIframeHistory(nextHist);
      setHistoryIndex(nextHist.length - 1);
      
      setViewMode("browser");
      triggerOverlay(`Loaded: ${name}`);
    } else {
      // Launch in REAL browser
      try {
        const win = window.open(targetUrl, "_blank");
        if (win) {
          triggerOverlay(`Launched: ${name}`);
        } else {
          triggerOverlay("Popup Blocked! Please click link card.");
        }
      } catch (e) {
        console.error("Launcher failed:", e);
        triggerOverlay("Failed to open real browser tab.");
      }
    }
  };

  const clearHistory = () => {
    setLaunchHistory([]);
    localStorage.removeItem("haya_launch_history");
    triggerOverlay("Launcher History Cleared");
  };

  // Handle manual url input launch from launcher
  const handleUrlSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    
    let label = urlInput.trim();
    if (label.length > 25) {
      label = label.substring(0, 22) + "...";
    }
    handleLaunch(label, urlInput, false);
    setUrlInput("");
  };

  // Handle integrated browser address input
  const handleBrowserSubmit = (e: FormEvent) => {
    e.preventDefault();
    let query = browserUrlInput.trim();
    if (!query) return;

    if (!/^https?:\/\//i.test(query)) {
      if (query.includes(".") && !query.includes(" ")) {
        query = "https://" + query;
      } else {
        query = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
    }

    setBrowserUrl(query);
    setBrowserUrlInput(query);
    
    // Add to history
    const nextHist = iframeHistory.slice(0, historyIndex + 1);
    nextHist.push(query);
    setIframeHistory(nextHist);
    setHistoryIndex(nextHist.length - 1);
    
    triggerOverlay(`Navigating to target...`);
  };

  const handleBrowserBack = () => {
    if (historyIndex > 0) {
      playHaptic(10);
      const prevIndex = historyIndex - 1;
      const prevUrl = iframeHistory[prevIndex];
      setHistoryIndex(prevIndex);
      setBrowserUrl(prevUrl);
      setBrowserUrlInput(prevUrl);
    }
  };

  const handleBrowserForward = () => {
    if (historyIndex < iframeHistory.length - 1) {
      playHaptic(10);
      const nextIndex = historyIndex + 1;
      const nextUrl = iframeHistory[nextIndex];
      setHistoryIndex(nextIndex);
      setBrowserUrl(nextUrl);
      setBrowserUrlInput(nextUrl);
    }
  };

  const handleBrowserRefresh = () => {
    playHaptic(10);
    setIsIframeLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = `/api/browser/proxy?url=${encodeURIComponent(browserUrl)}`;
    }
    setTimeout(() => setIsIframeLoading(false), 800);
  };

  // Execute Grounding Search Widget call
  const handleGroundingSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults("");
    setSearchSources([]);
    triggerOverlay("Querying Grounding Node...");
    playHaptic(25);

    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (searchType === "maps" && navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { timeout: 3500 }
          );
        });
        if (pos) {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      }

      const response = await fetch("/api/gemini/grounded-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          type: searchType,
          latitude: lat,
          longitude: lng,
          personaId: selectedPersona
        })
      });

      if (!response.ok) throw new Error("Grounded query node failed");
      const data = await response.json();
      setSearchResults(data.text || "No results returned.");
      setSearchSources(data.sources || []);
      triggerOverlay("Information Retrieved! ✨");
    } catch (err) {
      console.error(err);
      setSearchResults("Retrieval failed. Please ensure system keys are verified and retry.");
      triggerOverlay("Search Retrieval Error ⚠️");
    } finally {
      setIsSearching(false);
    }
  };

  const handleWorkspaceClick = (e: any) => {
    const target = (e.target as HTMLElement).closest("[data-workspace-action]");
    if (!target) return;

    // Explicitly prevent parent click capture or dragging during browser activity
    e.stopPropagation();

    const action = target.getAttribute("data-workspace-action");
    if (!action) return;

    playHaptic(15);

    switch (action) {
      case "set-mode-launcher":
        setViewMode("launcher");
        break;
      case "set-mode-browser":
        setViewMode("browser");
        if (!browserUrl) {
          setBrowserUrl("https://www.google.com");
          setBrowserUrlInput("https://www.google.com");
        }
        break;
      case "open-standalone":
        window.open("/browser", "_blank");
        triggerOverlay("Opened Standalone Browser in a separate tab!");
        break;
      case "minimize":
        BrowserEngine.getInstance().setVisible(false);
        triggerOverlay("Workspace Suspended");
        break;
      case "browser-back":
        handleBrowserBack();
        break;
      case "browser-forward":
        handleBrowserForward();
        break;
      case "browser-refresh":
        handleBrowserRefresh();
        break;
      case "browser-home":
        setBrowserUrl("https://www.google.com");
        setBrowserUrlInput("https://www.google.com");
        break;
      case "launch-app": {
        const appUrl = target.getAttribute("data-url");
        const appName = target.getAttribute("data-name");
        if (appUrl && appName) {
          handleLaunch(appName, appUrl, false);
        }
        break;
      }
      case "pop-window":
        handleLaunch("External Portal", browserUrl, true);
        break;
      case "clear-history":
        clearHistory();
        break;
      case "set-search-type-web":
        setSearchType("search");
        break;
      case "set-search-type-maps":
        setSearchType("maps");
        break;
      case "play-video": {
        const vidId = target.getAttribute("data-video-id");
        if (vidId) {
          setBrowserUrl(`https://www.youtube.com/watch?v=${vidId}`);
          setBrowserUrlInput(`https://www.youtube.com/watch?v=${vidId}`);
          setViewMode("browser");
          triggerOverlay("Loading video stream...");
        }
        break;
      }
    }
  };

  return (
    <div 
      onClick={handleWorkspaceClick}
      className="w-full h-full flex flex-col bg-[#05060c] text-slate-100 font-sans relative overflow-hidden select-text pointer-events-auto"
    >
      
      {/* 1. COMPONENT HEADER BAR */}
      <header className="px-6 py-3 border-b border-white/5 bg-[#080b13]/80 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xs font-semibold tracking-wider font-mono text-white flex items-center gap-2">
              HAYA COGNITIVE WORKSPACE
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-sans tracking-wide">
              Integrated Iframe Web Browser & Grounding Launcher Node
            </p>
          </div>
        </div>

        {/* View Mode Switcher tabs */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900/85 p-0.5 rounded-xl border border-white/5">
            <button
              data-workspace-action="set-mode-launcher"
              className={`px-3 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "launcher" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layout className="w-3.5 h-3.5 pointer-events-none" />
              LAUNCHER DECK
            </button>
            <button
              data-workspace-action="set-mode-browser"
              className={`px-3 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "browser" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe className="w-3.5 h-3.5 pointer-events-none" />
              INTEGRATED BROWSER
            </button>
          </div>

          <button
            data-workspace-action="open-standalone"
            className="px-3.5 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-cyan-500/20 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-500/15 hover:border-cyan-500/40 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5 pointer-events-none" />
            STANDALONE BROWSER TAB
          </button>

          {/* Diagnostic Stats */}
          <div className="hidden lg:flex items-center gap-3 bg-slate-900/30 px-3 py-1 rounded-xl border border-white/5 text-[9px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <Activity className="w-2.5 h-2.5 text-cyan-400" />
              <span>{latency}ms</span>
            </div>
            <div className="h-2.5 w-[1px] bg-white/10" />
            <div className="flex items-center gap-1.5">
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              <span>{cpuUsage}% CPU</span>
            </div>
          </div>

          <button
            data-workspace-action="minimize"
            className="p-1.5 rounded-lg bg-slate-900/50 border border-white/5 hover:border-white/20 hover:text-white transition-all cursor-pointer"
            title="Minimize Workspace"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTAINER AREA */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          
          {/* A. LAUNCHER DECK */}
          {viewMode === "launcher" && (
            <motion.div
              key="launcher"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {/* Top Row Launcher Deck content */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Apps & Direct inputs (7 cols) */}
                <div className="lg:col-span-7 flex flex-col space-y-6">
                  {/* URL Input Form */}
                  <div className="bg-[#090c15] border border-white/5 rounded-2xl p-4.5 shadow-xl flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-mono font-medium text-slate-200">Interactive Dispatch Console</span>
                      </div>
                      <span className="text-[9px] font-mono text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/10">
                        INTEGRATED OR NATIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Type any destination link below. Clicking "Dispatch" will open it inside our integrated in-app browser tab instantly with safe proxy bypass headers!
                    </p>
                    
                    <form onSubmit={handleUrlSubmit} className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search google or enter URL (e.g. youtube.com, wikipedia.org)..."
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          className="w-full bg-[#030408] border border-white/5 focus:border-purple-500/40 rounded-xl py-2 pl-10 pr-4 text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs px-4 rounded-xl cursor-pointer transition-all flex items-center gap-2 border border-purple-500/20 active:scale-95 shadow-lg shadow-purple-600/10"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Dispatch
                      </button>
                    </form>
                  </div>

                  {/* Launcher Grid */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-mono font-medium text-slate-200">Interactive Launcher Board</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans">Click to launch in-app!</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {PREMIUM_APPS.map((app) => {
                        const IconComp = app.icon;
                        return (
                          <button
                            key={app.name}
                            onClick={() => handleLaunch(app.name, app.url, false)}
                            className={`text-left p-4 rounded-xl bg-[#090b14] border hover:border-white/10 transition-all group cursor-pointer duration-300 relative overflow-hidden flex flex-col justify-between h-[100px] ${app.color} ${app.glow}`}
                          >
                            <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-white/5 to-transparent rounded-tr-xl pointer-events-none" />
                            
                            <div className="flex items-start justify-between">
                              <span className="text-[9px] tracking-wider font-mono font-bold uppercase opacity-60">
                                {app.category}
                              </span>
                              <IconComp className="w-4 h-4 transition-transform group-hover:scale-110 group-hover:text-white" />
                            </div>
                            
                            <div className="space-y-1">
                              <div className="text-xs font-bold font-mono text-white flex items-center gap-1.5 group-hover:text-purple-300 transition-colors">
                                {app.name}
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                              </div>
                              <p className="text-[10px] text-slate-400 line-clamp-1 font-sans">
                                {app.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Dialog Timeline Transcript (5 cols) */}
                <div className="lg:col-span-5 flex flex-col space-y-6">
                  <div className="bg-[#090c15] border border-white/5 rounded-2xl p-4.5 shadow-xl flex-1 flex flex-col min-h-[360px] max-h-[420px]">
                    <div className="flex items-center justify-between shrink-0 border-b border-white/5 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-mono font-medium text-slate-200">Live Companion Transcript</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${
                        state === "speaking" ? "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse" :
                        state === "listening" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        "bg-slate-800 text-slate-500"
                      }`}>
                        {state.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-white/5">
                      {secretChats.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-45">
                          <User className="w-8 h-8 text-slate-600" />
                          <p className="text-[10px] font-mono text-slate-500">
                            Waiting for dialogue activity. Start speaking with Haya to stream real-time visual subtitles...
                          </p>
                        </div>
                      ) : (
                        secretChats.map((msg, index) => (
                          <div
                            key={msg.id || index}
                            className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                              msg.sender === "user"
                                ? "bg-slate-900/40 border-slate-800 text-slate-300 ml-4"
                                : "bg-purple-500/5 border-purple-500/10 text-purple-200 mr-4"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono font-semibold tracking-wider flex items-center gap-1 uppercase">
                                {msg.sender === "user" ? "COMMANDER" : "HAYA (COMPANION)"}
                              </span>
                              <span className="text-[8px] font-mono text-slate-600">
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                              </span>
                            </div>
                            <p className="text-xs font-sans leading-relaxed break-words whitespace-pre-line">
                              {msg.text}
                            </p>
                          </div>
                        ))
                      )}
                      <div ref={transcriptEndRef} />
                    </div>

                    <div className="shrink-0 pt-3 border-t border-white/5 mt-3 flex items-center justify-between text-[9px] font-mono text-slate-500">
                      <span>Voice: <strong>{selectedVoice}</strong></span>
                      <span>Persona: <strong className="text-purple-400 uppercase">{selectedPersona}</strong></span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottom Grounding Search Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-[#090c15] border border-white/5 rounded-2xl p-5.5 shadow-xl flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-mono font-medium text-slate-200">Google Search Grounding Center</span>
                    </div>
                    <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-white/5">
                      <button
                        type="button"
                        onClick={() => setSearchType("search")}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          searchType === "search" ? "bg-purple-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        Web Index
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchType("maps")}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          searchType === "maps" ? "bg-purple-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        Maps Grounding
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    Execute grounded queries to verify live Google results. This fetches active real-time indices to bypass any model age constraints!
                  </p>

                  <form onSubmit={handleGroundingSearch} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={searchType === "maps" ? "Search physical places (e.g. 'Halal restaurants in Tokyo')..." : "Ask a query needing active search data (e.g. 'current BTC price')..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-[#030408] border border-white/5 focus:border-emerald-500/40 rounded-xl py-2 px-4 text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs px-4 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 border border-emerald-500/20 active:scale-95 shadow-lg shadow-emerald-600/10"
                    >
                      {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      Query
                    </button>
                  </form>

                  <AnimatePresence mode="wait">
                    {(isSearching || searchResults) && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 bg-slate-950/80 border border-white/5 rounded-xl space-y-3 max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/5"
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-[9px] font-mono text-slate-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            SEARCH RESULT INDEX NODE
                          </span>
                        </div>
                        {isSearching ? (
                          <div className="flex flex-col items-center justify-center py-4 space-y-2">
                            <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                            <p className="text-[9px] font-mono text-slate-500">Retrieving active world state data...</p>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                              {searchResults}
                            </p>
                            {searchSources.length > 0 && (
                              <div className="space-y-1.5 pt-2 border-t border-white/5">
                                <div className="flex flex-wrap gap-2">
                                  {searchSources.map((src, i) => (
                                    <button
                                      key={i}
                                      onClick={() => handleLaunch(src.title || "Source", src.url, false)}
                                      className="px-2 py-0.5 text-[9px] font-mono bg-slate-900 border border-white/5 hover:border-emerald-500/30 text-emerald-400 rounded-lg flex items-center gap-1 hover:text-white cursor-pointer transition-all"
                                    >
                                      <span>[{i + 1}]</span>
                                      <span className="max-w-[120px] truncate">{src.title || "Citation"}</span>
                                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Dispatch history (4 cols) */}
                <div className="lg:col-span-4 bg-[#090c15] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col justify-between min-h-[200px]">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-mono font-medium text-slate-200">Workspace History</span>
                    </div>
                    {launchHistory.length > 0 && (
                      <button onClick={clearHistory} className="text-[9px] font-mono text-slate-500 hover:text-red-400 cursor-pointer">
                        CLEAR
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 max-h-[140px] scrollbar-thin scrollbar-thumb-white/5">
                    {launchHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-6 opacity-35">
                        <Globe className="w-5 h-5 text-slate-600 mb-1" />
                        <p className="text-[9px] font-mono text-slate-500">History is currently clear.</p>
                      </div>
                    ) : (
                      launchHistory.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => handleLaunch(item.name, item.url, false)}
                          className="w-full text-left p-2 rounded-lg bg-slate-950 border border-white/5 hover:border-white/10 flex items-center justify-between group cursor-pointer transition-all text-xs"
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-mono text-white truncate group-hover:text-purple-300">{item.name}</span>
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-white" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* B. INTEGRATED BROWSER */}
          {viewMode === "browser" && (
            <motion.div
              key="browser"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col overflow-hidden bg-[#020306]"
            >
              {/* Browser Address Controls Bar */}
              <div className="px-6 py-2 bg-[#080a10] border-b border-white/5 flex items-center justify-between gap-3 shrink-0 select-none">
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleBrowserBack}
                    disabled={historyIndex === 0}
                    className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white text-slate-400 disabled:opacity-20 cursor-pointer transition-all"
                    title="Back"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleBrowserForward}
                    disabled={historyIndex >= iframeHistory.length - 1}
                    className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white text-slate-400 disabled:opacity-20 cursor-pointer transition-all"
                    title="Forward"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleBrowserRefresh}
                    className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white text-slate-400 cursor-pointer transition-all"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isIframeLoading ? "animate-spin text-purple-400" : ""}`} />
                  </button>
                  <button
                    onClick={() => handleLaunch("Home", "https://www.google.com")}
                    className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white text-slate-400 cursor-pointer transition-all"
                    title="Home Dashboard"
                  >
                    <Home className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Main Address Input Bar */}
                <form onSubmit={handleBrowserSubmit} className="flex-1 flex items-center gap-2 max-w-4xl">
                  <div className="relative flex-grow">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400/80" />
                    <input
                      type="text"
                      value={browserUrlInput}
                      onChange={(e) => setBrowserUrlInput(e.target.value)}
                      className="w-full bg-[#030408] border border-white/10 focus:border-purple-500/40 rounded-xl py-1.5 pl-9 pr-4 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
                      placeholder="Search Google or enter destination URL (e.g. youtube.com)..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-[#111728] border border-purple-500/20 hover:bg-purple-600 hover:text-white px-3.5 py-1.5 rounded-xl font-mono text-xs text-purple-400 transition-all cursor-pointer"
                  >
                    NAVIGATE
                  </button>
                </form>

                {/* External launch option */}
                <button
                  onClick={() => handleLaunch("External Portal", browserUrl, true)}
                  className="px-3 py-1.5 rounded-xl border border-white/5 bg-slate-900/40 hover:text-white text-slate-400 font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  title="Open in Native Real Browser Window"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="hidden sm:inline">POP WINDOW</span>
                </button>
              </div>

              {/* Real working iframe viewport using the bypass proxy */}
              <div className="flex-grow w-full relative bg-black overflow-y-auto">
                {(() => {
                  const isYoutube = browserUrl.includes("youtube.com") || browserUrl.includes("youtu.be");
                  const ytVideoId = isYoutube ? extractYoutubeVideoId(browserUrl) : null;

                  if (isYoutube) {
                    if (ytVideoId) {
                      return (
                        <div className="w-full h-full bg-black relative flex flex-col justify-between">
                          <div className="flex-1 w-full relative">
                            <iframe
                              src={`https://www.youtube.com/embed/${ytVideoId}?autoplay=1&enablejsapi=1`}
                              className="w-full h-full border-0 bg-black"
                              title="Haya YouTube Player"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </div>
                          
                          <div className="p-3 bg-[#090b14] border-t border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                              <Youtube className="w-4 h-4 text-red-500 animate-pulse" />
                              <span className="text-[10px] font-mono font-medium text-slate-300">Streaming: watch?v={ytVideoId}</span>
                            </div>
                            <button
                              onClick={() => {
                                setBrowserUrl("https://www.youtube.com");
                                setBrowserUrlInput("https://www.youtube.com");
                              }}
                              className="px-3 py-1 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 text-[10px] font-mono border border-red-500/20 cursor-pointer transition-all"
                            >
                              ← Back to YouTube Media Center
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="w-full h-full bg-[#05060b] flex flex-col overflow-y-auto p-6 space-y-6 select-text pointer-events-auto">
                          <div className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-red-600/10 via-purple-600/5 to-slate-950 border border-red-500/10 shadow-lg shadow-red-500/5 gap-3 shrink-0">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 rounded-xl bg-red-600/10 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                                <Youtube className="w-5 h-5 text-red-500 animate-pulse" />
                              </div>
                              <div>
                                <h2 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                                  HAYA YOUTUBE MEDIA STREAMER
                                </h2>
                                <p className="text-[10px] text-slate-400 font-sans tracking-wide">
                                  Direct cloud scraper with latency-free high-fidelity HTML5 native streaming enclaves.
                                </p>
                              </div>
                            </div>
                            <span className="text-[9px] font-mono text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/10">
                              CORS BYPASSED
                            </span>
                          </div>

                          <div className="bg-[#090c15] border border-white/5 rounded-2xl p-4.5 shadow-xl flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                              <Search className="w-4 h-4 text-red-400" />
                              <span className="text-xs font-mono font-medium text-slate-200">Search Videos & Channels</span>
                            </div>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleYoutubeSearch(ytSearchQuery);
                              }}
                              className="flex gap-2"
                            >
                              <input
                                type="text"
                                placeholder="Enter keyword or search query (e.g. 'coding lofi', 'tech reviews')..."
                                value={ytSearchQuery}
                                onChange={(e) => setYtSearchQuery(e.target.value)}
                                className="flex-1 bg-[#030408] border border-white/5 focus:border-red-500/40 rounded-xl py-2 px-4 text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-all"
                              />
                              <button
                                type="submit"
                                disabled={isYtSearching}
                                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-mono text-xs px-4 rounded-xl cursor-pointer transition-all flex items-center gap-2 border border-red-500/20 active:scale-95 shadow-lg shadow-red-600/10"
                              >
                                {isYtSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                Search
                              </button>
                            </form>
                          </div>

                          {ytVideos.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 px-1 text-slate-200">
                                <Search className="w-4 h-4 text-red-400" />
                                <span className="text-xs font-mono font-medium">Search Results</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {ytVideos.map((video) => (
                                  <div
                                    key={video.videoId}
                                    data-workspace-action="play-video"
                                    data-video-id={video.videoId}
                                    className="p-3 bg-[#090b14] border border-white/5 hover:border-red-500/20 rounded-xl flex flex-col justify-between cursor-pointer transition-all duration-300 group hover:shadow-lg hover:shadow-red-500/2"
                                  >
                                    <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950 mb-3">
                                      <img
                                        src={video.thumbnail}
                                        alt={video.title}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                      />
                                      {video.duration && (
                                        <span className="absolute bottom-1.5 right-1.5 bg-slate-950/80 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-white tracking-wider border border-white/5">
                                          {video.duration}
                                        </span>
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <h3 className="text-xs font-bold font-mono text-white leading-snug line-clamp-2 group-hover:text-red-400 transition-colors">
                                        {video.title}
                                      </h3>
                                      <p className="text-[10px] text-slate-400 font-sans line-clamp-1">
                                        {video.author} • {video.views}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="space-y-3">
                            <div className="flex items-center gap-2 px-1 text-slate-200">
                              <Music className="w-4 h-4 text-purple-400" />
                              <span className="text-xs font-mono font-medium">Premium Focus Radios & Streams</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {YOUTUBE_RECOMMENDED_VIDEOS.map((video) => (
                                <div
                                  key={video.videoId}
                                  data-workspace-action="play-video"
                                  data-video-id={video.videoId}
                                  className="p-3 bg-[#090b14] border border-white/5 hover:border-purple-500/20 rounded-xl flex flex-col justify-between cursor-pointer transition-all duration-300 group hover:shadow-lg hover:shadow-purple-500/2"
                                >
                                  <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950 mb-3">
                                    <img
                                      src={video.thumbnail}
                                      alt={video.title}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                    />
                                    {video.duration && (
                                      <span className="absolute bottom-1.5 right-1.5 bg-purple-950/80 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-purple-300 tracking-wider border border-purple-500/20">
                                        {video.duration}
                                      </span>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <h3 className="text-xs font-bold font-mono text-white leading-snug line-clamp-2 group-hover:text-purple-400 transition-colors">
                                      {video.title}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-sans line-clamp-1">
                                      {video.author} • {video.views}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  } else {
                    return (
                      <>
                        {isIframeLoading && (
                          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
                            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
                            <p className="font-mono text-xs text-purple-400 tracking-wider">LOADING SECURE DIRECT ENCLAVE...</p>
                          </div>
                        )}
                        
                        <iframe
                          ref={iframeRef}
                          src={`/api/browser/proxy?url=${encodeURIComponent(browserUrl)}`}
                          className="w-full h-full border-0 bg-white"
                          title="Integrated Proxy Browser"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; camera; microphone"
                          referrerPolicy="no-referrer"
                          onLoad={() => {
                            setIsIframeLoading(false);
                          }}
                        />
                      </>
                    );
                  }
                })()}
              </div>

              {/* Status bar */}
              <div className="px-6 py-1 bg-[#04060b] border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-slate-500 shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  SECURE PROXY LINK ACTIVE
                </span>
                <span className="truncate max-w-[400px]">
                  SRC: {browserUrl}
                </span>
                <span>
                  RESTRICTIONS BYPASSED: CORS, FRAME-OPTIONS, CSP
                </span>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
