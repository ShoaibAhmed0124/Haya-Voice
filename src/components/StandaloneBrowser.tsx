import { useEffect, useState, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Globe,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Home,
  ExternalLink,
  Shield,
  Zap,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Terminal,
  Clock,
  Cpu,
  Monitor,
  Activity,
  Heart
} from "lucide-react";

interface CommandLog {
  id: string;
  timestamp: string;
  type: "system" | "automation" | "navigation" | "user";
  message: string;
}

export default function StandaloneBrowser() {
  const [browserUrl, setBrowserUrl] = useState("https://www.google.com");
  const [browserUrlInput, setBrowserUrlInput] = useState("https://www.google.com");
  const [iframeHistory, setIframeHistory] = useState<string[]>(["https://www.google.com"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [isHayaConnected, setIsHayaConnected] = useState(false);
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([
    {
      id: "init",
      timestamp: new Date().toLocaleTimeString(),
      type: "system",
      message: "Standalone Proxy Browser initialized successfully."
    }
  ]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Initialize BroadcastChannel
  useEffect(() => {
    const channel = new BroadcastChannel("haya-browser-channel");
    channelRef.current = channel;

    const logEvent = (type: "system" | "automation" | "navigation" | "user", message: string) => {
      setCommandLogs((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          type,
          message
        },
        ...prev
      ].slice(0, 30));
    };

    // Ping to locate active Haya session
    channel.postMessage({ type: "BROWSER_PING" });

    channel.onmessage = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      const { type, url, action, selector, text, value } = e.data;

      if (type === "HAYA_PONG") {
        setIsHayaConnected(true);
        logEvent("system", "Haya Neural Link established.");
      }

      if (type === "HAYA_PING") {
        channel.postMessage({ type: "BROWSER_PONG", url: browserUrl });
        setIsHayaConnected(true);
      }

      if (type === "BROWSER_NAVIGATE") {
        logEvent("navigation", `Haya dispatched navigation to: ${url}`);
        handleNavigation(url);
      }

      if (type === "BROWSER_INTERACTIVE_ACTION") {
        logEvent("automation", `Haya automated gesture: [${action}] on selector: "${selector}"`);
        // Forward to iframe
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: "BROWSER_AUTOMATION_GESTURE",
            action,
            selector,
            text
          }, "*");
        }
      }

      if (type === "BROWSER_CONTROL_MEDIA") {
        logEvent("automation", `Haya sent media control: [${action}] with value: ${value ?? "none"}`);
        // Forward to iframe
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: "YT_MEDIA_CONTROL",
            action,
            value
          }, "*");
        }
      }
    };

    // Listen to load and navigation updates from the direct proxy script inside the iframe
    const handleIframePostMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      
      // Iframe click or link navigate
      if (e.data.type === "HAYA_BROWSER_NAVIGATE") {
        const targetUrl = e.data.url;
        logEvent("user", `Manually navigated to link: ${targetUrl}`);
        setBrowserUrlInput(targetUrl);
        setBrowserUrl(targetUrl);

        const nextHist = iframeHistory.slice(0, historyIndex + 1);
        nextHist.push(targetUrl);
        setIframeHistory(nextHist);
        setHistoryIndex(nextHist.length - 1);

        // Notify Haya tab
        channel.postMessage({
          type: "BROWSER_STATE_CHANGE",
          url: targetUrl,
          isLoading: true
        });
      }

      // Iframe completed loading DOM
      if (e.data.type === "HAYA_BROWSER_LOADED") {
        const { url: loadedUrl, title, text: bodyText } = e.data;
        logEvent("system", `Webpage parsed successfully: "${title || "Untitled"}"`);
        setIsIframeLoading(false);

        // Notify Haya tab with full text content for grounding/memory processing
        channel.postMessage({
          type: "BROWSER_LOADED",
          url: loadedUrl,
          title: title || "Webpage",
          text: bodyText || ""
        });
      }
    };

    window.addEventListener("message", handleIframePostMessage);

    // Periodically ping Haya main tab to verify connection status
    const interval = setInterval(() => {
      channel.postMessage({ type: "BROWSER_PING" });
    }, 5000);

    return () => {
      channel.close();
      window.removeEventListener("message", handleIframePostMessage);
      clearInterval(interval);
    };
  }, [iframeHistory, historyIndex, browserUrl]);

  const handleNavigation = (url: string) => {
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      if (targetUrl.includes(".") && !targetUrl.includes(" ")) {
        targetUrl = "https://" + targetUrl;
      } else {
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
      }
    }

    setIsIframeLoading(true);
    setBrowserUrl(targetUrl);
    setBrowserUrlInput(targetUrl);

    const nextHist = iframeHistory.slice(0, historyIndex + 1);
    nextHist.push(targetUrl);
    setIframeHistory(nextHist);
    setHistoryIndex(nextHist.length - 1);

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: "BROWSER_STATE_CHANGE",
        url: targetUrl,
        isLoading: true
      });
    }
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!browserUrlInput.trim()) return;
    handleNavigation(browserUrlInput);
  };

  const handleBrowserBack = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevUrl = iframeHistory[prevIndex];
      setHistoryIndex(prevIndex);
      setBrowserUrl(prevUrl);
      setBrowserUrlInput(prevUrl);
    }
  };

  const handleBrowserForward = () => {
    if (historyIndex < iframeHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextUrl = iframeHistory[nextIndex];
      setHistoryIndex(nextIndex);
      setBrowserUrl(nextUrl);
      setBrowserUrlInput(nextUrl);
    }
  };

  const handleBrowserRefresh = () => {
    setIsIframeLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = `/api/browser/proxy?url=${encodeURIComponent(browserUrl)}`;
    }
  };

  return (
    <div id="standalone-browser-container" className="w-screen h-screen bg-[#020204] text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Header Bar */}
      <header className="px-6 py-3 border-b border-white/5 bg-[#08090f] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/15">
            <Globe className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
              Haya Standalone Proxy Browser
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider">SECURE DIRECT CORS BYPASS SYSTEM</p>
          </div>
        </div>

        {/* Sync Link Status Badge */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-[#101424] border border-white/5 rounded-full">
            <span className={`w-2 h-2 rounded-full ${isHayaConnected ? "bg-emerald-400 shadow-[0_0_8px_#10b981]" : "bg-rose-500 animate-pulse"}`} />
            <span className="text-[10px] font-mono font-medium text-slate-300">
              {isHayaConnected ? "HAYA NEURAL LINK: CONNECTED" : "AWAITING ACTIVE SESSION"}
            </span>
          </div>
          <span className="text-[10px] text-slate-600 font-mono hidden md:inline">PORT: 3000 (SECURE)</span>
        </div>
      </header>

      {/* Main Panel Content (Grid with Browser Frame and Command Console) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Real Browser Viewport */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#030408]">
          
          {/* Address Bar Controls */}
          <div className="px-6 py-2.5 bg-[#06070c] border-b border-white/5 flex items-center justify-between gap-4 shrink-0 select-none">
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleBrowserBack}
                disabled={historyIndex === 0}
                className="p-2 rounded-xl hover:bg-white/5 text-slate-400 disabled:opacity-20 cursor-pointer transition-all"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleBrowserForward}
                disabled={historyIndex >= iframeHistory.length - 1}
                className="p-2 rounded-xl hover:bg-white/5 text-slate-400 disabled:opacity-20 cursor-pointer transition-all"
                title="Forward"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleBrowserRefresh}
                className="p-2 rounded-xl hover:bg-white/5 text-slate-400 cursor-pointer transition-all"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isIframeLoading ? "animate-spin text-purple-400" : ""}`} />
              </button>
              <button
                onClick={() => handleNavigation("https://www.google.com")}
                className="p-2 rounded-xl hover:bg-white/5 text-slate-400 cursor-pointer transition-all"
                title="Google Home"
              >
                <Home className="w-4 h-4" />
              </button>
            </div>

            {/* URL Input Form */}
            <form onSubmit={handleManualSubmit} className="flex-1 flex items-center gap-2 max-w-5xl">
              <div className="relative flex-grow">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/70" />
                <input
                  type="text"
                  value={browserUrlInput}
                  onChange={(e) => setBrowserUrlInput(e.target.value)}
                  className="w-full bg-[#020204] border border-white/10 focus:border-purple-500/40 rounded-xl py-2 pl-10 pr-4 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none transition-all shadow-inner"
                  placeholder="Enter custom URL (e.g. wikipedia.org) or search Google..."
                />
              </div>
              <button
                type="submit"
                className="bg-[#111728] border border-purple-500/20 hover:bg-purple-600 hover:text-white px-4 py-2 rounded-xl font-mono text-xs text-purple-400 transition-all cursor-pointer shadow-md"
              >
                DISPATCH
              </button>
            </form>

            {/* External Tab Loader */}
            <a
              href={browserUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl hover:bg-white/5 text-slate-400 transition-all flex items-center gap-1.5 font-mono text-xs cursor-pointer shrink-0"
              title="Open raw web link directly"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden lg:inline">BYPASS VIEW</span>
            </a>
          </div>

          {/* Proxy IFrame Area */}
          <div className="flex-1 w-full relative bg-[#010102]">
            {isIframeLoading && (
              <div className="absolute inset-0 bg-[#020306]/95 flex flex-col items-center justify-center gap-3 z-10">
                <div className="w-12 h-12 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
                <div className="space-y-1 text-center">
                  <p className="font-mono text-xs text-purple-400 tracking-widest uppercase">Securing proxy gateway...</p>
                  <p className="text-[10px] text-slate-500 font-sans">Bypassing frames, CORS constraints, and CORS headers</p>
                </div>
              </div>
            )}
            
            <iframe
              ref={iframeRef}
              src={`/api/browser/proxy?url=${encodeURIComponent(browserUrl)}`}
              className="w-full h-full border-0 bg-white"
              title="Integrated Standalone Proxy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; camera; microphone"
              referrerPolicy="no-referrer"
              onLoad={() => setIsIframeLoading(false)}
            />
          </div>

          {/* Secure Status Footer */}
          <footer className="px-6 py-2 bg-[#04050a] border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-500 shrink-0 select-none">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Shield className="w-3.5 h-3.5" />
              CORS-BYPASS TUNNEL ACTIVE
            </span>
            <span className="truncate max-w-[500px] text-slate-400">
              TARGET: {browserUrl}
            </span>
            <span className="hidden sm:inline">
              SECURE IFRAME CONTEXT
            </span>
          </footer>
        </div>

        {/* Right Side: Command Logs / Connection Console */}
        <div className="w-80 border-l border-white/5 bg-[#06070c] flex flex-col shrink-0 overflow-hidden select-none">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#08090e]">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-mono font-medium text-slate-300">Companion Sync Console</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]" />
          </div>

          {/* Companion system quick metrics */}
          <div className="p-4 border-b border-white/5 grid grid-cols-2 gap-3 text-slate-400 bg-[#04050a]">
            <div className="p-2 bg-white/2 bg-opacity-10 border border-white/5 rounded-xl space-y-1">
              <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500 block">Link Integrity</span>
              <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-500 animate-pulse" /> 100%
              </span>
            </div>
            <div className="p-2 bg-white/2 bg-opacity-10 border border-white/5 rounded-xl space-y-1">
              <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500 block">Latency Delay</span>
              <span className="text-xs font-mono font-bold text-emerald-400">4.5 ms</span>
            </div>
          </div>

          {/* Real-time sync log streams */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 scrollbar-thin scrollbar-thumb-white/5">
            <div className="text-[10px] font-mono text-slate-500 tracking-wider uppercase mb-1 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              Neural Stream Log
            </div>
            {commandLogs.length === 0 ? (
              <p className="text-[10px] text-slate-600 font-mono italic">Console is quiet. Awaiting automation updates...</p>
            ) : (
              commandLogs.map((log) => (
                <div key={log.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] font-mono">
                    <span className={`px-1.5 py-0.2 rounded uppercase ${
                      log.type === "automation" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                      log.type === "navigation" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                      log.type === "user" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                      "bg-slate-800 text-slate-400"
                    }`}>
                      {log.type}
                    </span>
                    <span className="text-slate-600">{log.timestamp}</span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-300 leading-relaxed break-words bg-[#030408] p-2 rounded-lg border border-white/5">
                    {log.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
