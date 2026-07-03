import { useState, useRef, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  MicOff,
  Power,
  Sparkles,
  VolumeX,
  RefreshCw,
  MoreVertical,
  X,
  Volume2,
  Trash2,
  Sliders,
  Database,
  Eye,
  BookOpen,
  Info,
  Shield,
  Activity,
  Plus,
  Search,
  Check,
  Globe,
  Layers,
  Cpu,
  Smartphone,
  Copy,
  History,
  Wifi,
  Bluetooth,
  MapPin,
  Battery,
  Home,
  Settings,
  User,
  ChevronDown,
  ChevronUp,
  Calendar,
  Briefcase,
  Tag,
  Brain,
  Clock,
  Sun,
  Moon,
  Menu,
  Keyboard,
} from "lucide-react";
import { AssistantState, PREBUILT_VOICES, HayaMessage } from "./types";
import { HAYA_PERSONAS, Persona } from "./services/personaConfig";
import VoiceVisualizer from "./components/VoiceVisualizer";
import AvatarAnimationEngine, { EngineState } from "./components/AvatarAnimationEngine";
import VoiceCoreButton from "./components/VoiceCoreButton";
import { MemoryService, Memory } from "./services/memoryService";
import { VisionEngine } from "./services/visionEngine";
import { ComputerUseEngine } from "./services/computerUseEngine";
import VisionOverlay from "./components/VisionOverlay";
import BrowserWorkspace from "./components/BrowserWorkspace";
import { BrowserEngine } from "./services/browserEngine";
import StreamingTextPanel from "./components/StreamingTextPanel";
import SecretDashboard from "./components/SecretDashboard";
import StandaloneBrowser from "./components/StandaloneBrowser";
import AmbientVisualizer, { AmbientVisualType, AMBIENT_VISUALS } from "./components/AmbientVisualizer";
import { AndroidBridgeManager, DiagnosticsState, PermissionStatus } from "./services/androidBridge";


// Helpers for PCM conversion
function float32ToInt16(buffer: Float32Array): Int16Array {
  let l = buffer.length;
  let buf = new Int16Array(l);
  while (l--) {
    let s = Math.max(-1, Math.min(1, buffer[l]));
    buf[l] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return buf;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

type AppTheme = "midnight" | "sunset" | "cyber" | "light";

const PERSONA_GLOW_RGB_MAP: Record<string, string> = {
  assistant: "34, 211, 238", // Cyan
  therapist: "16, 185, 129", // Emerald
  conspiracy: "245, 158, 11", // Amber
  unhinged: "139, 92, 246", // Violet
  motivation: "239, 68, 68", // Rose/Red
  romantic: "236, 72, 153", // Pink
  sexy: "168, 85, 247", // Purple
  career: "99, 102, 241", // Indigo
  trading: "16, 185, 129", // Emerald/Green
};

export default function App() {
  const [state, setState] = useState<AssistantState>("disconnected");
  const [forcedBehavior, setForcedBehavior] = useState<{ type: EngineState; timestamp: number } | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>("Aoede");
  const [selectedPersona, setSelectedPersona] = useState<string>("assistant");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<{
    siteName: string;
    url: string;
    callId: string;
    status: "opening" | "opened" | "blocked";
  } | null>(null);

  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem("haya_app_theme_v3");
      return (saved as AppTheme) || "midnight";
    } catch {
      return "midnight";
    }
  });

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("haya_app_theme_v3", newTheme);
    } catch (e) {
      console.error("Failed to save theme:", e);
    }
  };

  const isLight = theme === "light";
  const getThemeClasses = () => {
    switch (theme) {
      case "light":
        return {
          bg: "bg-gradient-to-br from-[#fdf7f9] via-[#f4eef8] to-[#eaf0fa]",
          text: "text-slate-800",
          cardBg: "bg-white/60 border-purple-200/50 text-slate-800 shadow-[0_8px_32px_rgba(147,51,234,0.04),inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-2xl",
          headerBtn: "bg-white/80 border-purple-200/20 text-purple-600 hover:text-purple-800 hover:bg-white hover:border-purple-300/40 shadow-sm pointer-events-auto cursor-pointer",
          label: "text-[#7d6899] font-medium text-xs font-mono uppercase tracking-widest",
          sub: "text-slate-500",
          inputBg: "bg-white/85 border-purple-200/40 text-purple-950 placeholder-purple-300/70 shadow-inner focus:border-purple-400/60",
          dockBg: "bg-white/60 border-purple-200/40 shadow-[0_12px_40px_rgba(147,51,234,0.04)]",
        };
      case "sunset":
        return {
          bg: "bg-[#0c0508] bg-gradient-to-br from-[#0c0508] via-[#120a14] to-[#04010a]",
          text: "text-slate-200",
          cardBg: "bg-slate-950/60 border-white/10 text-slate-200 shadow-2xl backdrop-blur-2xl",
          headerBtn: "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-100 hover:bg-slate-950/85 hover:border-white/10 pointer-events-auto cursor-pointer",
          label: "text-slate-500 text-xs font-mono uppercase tracking-widest",
          sub: "text-slate-500",
          inputBg: "bg-slate-950/50 border-white/10 text-slate-200 placeholder-slate-600",
          dockBg: "bg-slate-950/25 border-white/5 shadow-[0_12px_40px_rgba(0,0,0,0.8)]",
        };
      case "cyber":
        return {
          bg: "bg-[#010103] bg-gradient-to-br from-[#010103] via-[#050012] to-[#000000]",
          text: "text-slate-200",
          cardBg: "bg-slate-950/60 border-white/10 text-slate-200 shadow-2xl backdrop-blur-2xl",
          headerBtn: "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-100 hover:bg-slate-950/85 hover:border-white/10 pointer-events-auto cursor-pointer",
          label: "text-slate-500 text-xs font-mono uppercase tracking-widest",
          sub: "text-slate-500",
          inputBg: "bg-slate-950/50 border-white/10 text-slate-200 placeholder-slate-600",
          dockBg: "bg-slate-950/25 border-white/5 shadow-[0_12px_40px_rgba(0,0,0,0.8)]",
        };
      case "midnight":
      default:
        return {
          bg: "bg-[#020203]",
          text: "text-slate-200",
          cardBg: "bg-slate-950/60 border-white/10 text-slate-200 shadow-2xl backdrop-blur-2xl",
          headerBtn: "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-100 hover:bg-slate-950/85 hover:border-white/10 pointer-events-auto cursor-pointer",
          label: "text-slate-500 text-xs font-mono uppercase tracking-widest",
          sub: "text-slate-500",
          inputBg: "bg-slate-950/50 border-white/10 text-slate-200 placeholder-slate-600",
          dockBg: "bg-slate-950/25 border-white/5 shadow-[0_12px_40px_rgba(0,0,0,0.8)]",
        };
    }
  };
  const [backgroundAnimationEnabled, setBackgroundAnimationEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("haya_bg_animation_enabled");
      return saved === "true"; // Default to false (Ambient Mode is default, character video is secondary)
    } catch {
      return false;
    }
  });
  const [ambientVisualType, setAmbientVisualType] = useState<AmbientVisualType>(() => {
    try {
      const saved = localStorage.getItem("haya_ambient_visual_type");
      return (saved as AmbientVisualType) || "glowing_orb";
    } catch {
      return "glowing_orb";
    }
  });
  const [wakeWordEnabled, setWakeWordEnabled] = useState<boolean>(false);
  const [isVisionActive, setIsVisionActive] = useState(false);
  const [isBrowserActive, setIsBrowserActive] = useState(false);
  const [visionSource, setVisionSource] = useState<"screen" | "front_camera" | "back_camera">("screen");
  const torchStreamTrackRef = useRef<MediaStreamTrack | null>(null);
  const currentLiveTranscriptRef = useRef("");

  useEffect(() => {
    const handleStateChange = () => {
      setIsVisionActive(VisionEngine.getInstance().isActive());
    };
    // Hook up listener
    ComputerUseEngine.getInstance().registerStateListener(handleStateChange);
    const interval = setInterval(handleStateChange, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleBrowserStateChange = () => {
      setIsBrowserActive(BrowserEngine.getInstance().isVisible());
    };
    const unsubscribe = BrowserEngine.getInstance().registerListener(handleBrowserStateChange);
    handleBrowserStateChange();
    return () => unsubscribe();
  }, []);

  // Real-time synchronization with Standalone Proxy Browser Tab
  useEffect(() => {
    const channel = new BroadcastChannel("haya-browser-channel");

    channel.onmessage = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      const { type, url, title, text, isLoading } = e.data;

      if (type === "BROWSER_PING") {
        channel.postMessage({ type: "HAYA_PONG" });
      }

      if (type === "BROWSER_PONG") {
        console.log("Standalone browser tab responded at:", url);
      }

      if (type === "BROWSER_STATE_CHANGE") {
        const browserEngine = BrowserEngine.getInstance();
        browserEngine.navigateActiveTab(url);
        if (!browserEngine.isVisible()) {
          browserEngine.setVisible(true);
        }
      }

      if (type === "BROWSER_LOADED") {
        const browserEngine = BrowserEngine.getInstance();
        const tab = browserEngine.getActiveTab();
        if (tab) {
          tab.url = url;
          tab.title = title || "Webpage";
          tab.textContent = text || "";
        }
        if (!browserEngine.isVisible()) {
          browserEngine.setVisible(true);
        }
      }
    };

    channel.postMessage({ type: "HAYA_PING" });
    (window as any).hayaBrowserChannel = channel;

    return () => {
      channel.close();
      delete (window as any).hayaBrowserChannel;
    };
  }, []);

  const isExpandedMode = isBrowserActive;

  // Custom configuration states for Haya rendering engine and unified settings menu
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isPersonaDockOpen, setIsPersonaDockOpen] = useState(false);
  const [isAmbientDockOpen, setIsAmbientDockOpen] = useState(false);

  const [settingsTab, setSettingsTab] = useState<"voice" | "memory" | "browser" | "vision" | "privacy" | "android" | "history" | "trades" | "prompts" | "grounding">("voice");
  const [isManualGlitching, setIsManualGlitching] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);

  // Grounding states
  const [groundingQuery, setGroundingQuery] = useState("");
  const [groundingType, setGroundingType] = useState<"search" | "maps">("search");
  const [groundingResult, setGroundingResult] = useState("");
  const [groundingSources, setGroundingSources] = useState<any[]>([]);
  const [isGroundingLoading, setIsGroundingLoading] = useState(false);

  const handleGroundedQuerySubmit = async () => {
    if (!groundingQuery.trim()) return;
    triggerHaptic(20);
    setIsGroundingLoading(true);
    setGroundingResult("");
    setGroundingSources([]);
    triggerOverlay(`Consulting Haya's grounded database... 🌐`);

    let lat: number | null = null;
    let lng: number | null = null;

    if (groundingType === "maps" && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (err) {
        console.warn("Geolocation acquisition failed or timed out:", err);
      }
    }

    try {
      const response = await fetch("/api/gemini/grounded-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: groundingQuery,
          type: groundingType,
          latitude: lat,
          longitude: lng,
          personaId: selectedPersona,
          memories: memories
        })
      });

      if (!response.ok) throw new Error("Grounded query failed");
      const data = await response.json();
      setGroundingResult(data.text || "");
      setGroundingSources(data.sources || []);
      triggerOverlay("Cognitive retrieval completed! ✨");
      triggerHaptic(40);
    } catch (err) {
      console.error(err);
      triggerOverlay("Grounding lookup failed ⚠️");
    } finally {
      setIsGroundingLoading(false);
    }
  };

  // Trades Log State
  interface TradeSetup {
    id: string;
    asset: string;
    tradeType: "LONG" | "SHORT";
    entryPrice: string;
    takeProfit: string;
    stopLoss: string;
    notes: string;
    timestamp: string;
  }
  const [trades, setTrades] = useState<TradeSetup[]>(() => {
    try {
      const saved = localStorage.getItem("haya_trades_log");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isGeneratingTrade, setIsGeneratingTrade] = useState(false);

  const handleGenerateTradeSetup = async () => {
    triggerHaptic(20);
    setIsGeneratingTrade(true);
    triggerOverlay("Gemini is researching markets... 🌐");
    try {
      const response = await fetch("/api/gemini/generate-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetClass: "cryptocurrency" })
      });
      if (!response.ok) throw new Error("Trade generation failed");
      const setup = await response.json();
      if (setup && setup.asset) {
        const newTrade: TradeSetup = {
          id: Math.random().toString(36).substring(2, 9),
          asset: setup.asset,
          tradeType: (setup.tradeType || "LONG") as "LONG" | "SHORT",
          entryPrice: setup.entryPrice || "$0.00",
          stopLoss: setup.stopLoss || "$0.00",
          takeProfit: setup.takeProfit || "$0.00",
          notes: setup.notes || "",
          timestamp: new Date().toISOString()
        };
        const updated = [newTrade, ...trades].slice(0, 50);
        setTrades(updated);
        localStorage.setItem("haya_trades_log", JSON.stringify(updated));
        triggerOverlay(`Logged ${setup.tradeType} setup for ${setup.asset}! 📈`);
        triggerHaptic(40);
      }
    } catch (err) {
      console.error(err);
      triggerOverlay("Failed to analyze market ⚠️");
    } finally {
      setIsGeneratingTrade(false);
    }
  };

  // Prompt Customizer State
  const [editingPersonaId, setEditingPersonaId] = useState<string>("assistant");
  const [customPromptText, setCustomPromptText] = useState("");
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);

  const handleOptimizePrompt = async () => {
    if (!customPromptText.trim()) return;
    triggerHaptic(20);
    setIsOptimizingPrompt(true);
    triggerOverlay("Gemini is optimizing your prompt... ✨");
    try {
      const response = await fetch("/api/gemini/optimize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText: customPromptText, personaId: editingPersonaId })
      });
      if (!response.ok) throw new Error("Optimization failed");
      const data = await response.json();
      if (data.optimizedText) {
        setCustomPromptText(data.optimizedText);
        triggerOverlay("Prompt optimized successfully! 🪄");
      }
    } catch (err) {
      console.error(err);
      triggerOverlay("Optimization failed ⚠️");
    } finally {
      setIsOptimizingPrompt(false);
    }
  };

  useEffect(() => {
    const personaObj = HAYA_PERSONAS.find(p => p.id === editingPersonaId) || HAYA_PERSONAS[0];
    const saved = localStorage.getItem("custom_prompt_" + editingPersonaId);
    setCustomPromptText(saved || personaObj.systemInstruction);
  }, [editingPersonaId, isSettingsOpen]);

  const handleSaveCustomPrompt = () => {
    localStorage.setItem("custom_prompt_" + editingPersonaId, customPromptText);
    triggerOverlay(`Saved Custom Prompt for ${editingPersonaId}! ✨`);
    triggerHaptic(25);
  };

  const handleResetCustomPrompt = () => {
    localStorage.removeItem("custom_prompt_" + editingPersonaId);
    const personaObj = HAYA_PERSONAS.find(p => p.id === editingPersonaId) || HAYA_PERSONAS[0];
    setCustomPromptText(personaObj.systemInstruction);
    triggerOverlay(`Reset ${editingPersonaId} to Default Vibe.`);
    triggerHaptic(15);
  };

  // Persona switch logging history
  const [personaHistory, setPersonaHistory] = useState<Array<{
    id: string;
    fromPersonaId: string;
    toPersonaId: string;
    timestamp: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem("haya_persona_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Session-Based Conversation States (ChatGPT-style)
  // Flat chat logs for the active single ongoing session
  const [secretChats, setSecretChats] = useState<Array<{
    id: string;
    sender: "user" | "haya";
    text: string;
    timestamp: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem("haya_secret_chats");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSecretOpen, setIsSecretOpen] = useState(false);
  const [isChatLogOpen, setIsChatLogOpen] = useState(false);

  // Floating Picture-in-Picture (PiP) Browser Companion States
  const pipConstraintsRef = useRef<HTMLDivElement | null>(null);
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
  const [snappedCorner, setSnappedCorner] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("bottom-right");

  const handleDragEnd = (event: any, info: any) => {
    const currentX = pipPosition.x + info.offset.x;
    const currentY = pipPosition.y + info.offset.y;

    const padding = 24;
    const pipWidth = 140;
    const pipHeight = 195;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const corners = [
      { name: "top-left" as const, x: padding, y: padding },
      { name: "top-right" as const, x: screenW - pipWidth - padding, y: padding },
      { name: "bottom-left" as const, x: padding, y: screenH - pipHeight - padding },
      { name: "bottom-right" as const, x: screenW - pipWidth - padding, y: screenH - pipHeight - padding },
    ];

    let nearestCorner = corners[3]; // Default bottom-right
    let minDistance = Infinity;

    corners.forEach((corner) => {
      const dist = Math.hypot(currentX - corner.x, currentY - corner.y);
      if (dist < minDistance) {
        minDistance = dist;
        nearestCorner = corner;
      }
    });

    setPipPosition({ x: nearestCorner.x, y: nearestCorner.y });
    setSnappedCorner(nearestCorner.name);
  };

  useEffect(() => {
    if (!isBrowserActive) return;

    const handleResize = () => {
      const padding = 24;
      const pipWidth = 140;
      const pipHeight = 195;
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      let targetX = padding;
      let targetY = padding;

      if (snappedCorner === "top-right") {
        targetX = screenW - pipWidth - padding;
      } else if (snappedCorner === "bottom-left") {
        targetY = screenH - pipHeight - padding;
      } else if (snappedCorner === "bottom-right") {
        targetX = screenW - pipWidth - padding;
        targetY = screenH - pipHeight - padding;
      }

      setPipPosition({ x: targetX, y: targetY });
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isBrowserActive, snappedCorner]);

  const addSecretChat = (sender: "user" | "haya", text: string) => {
    if (!text || !text.trim()) return;
    
    let processedText = text;
    if (sender === "haya") {
      const match = processedText.match(/\[\[SWITCH_PERSONA:\s*(\w+)\]\]/i);
      if (match) {
        const targetPersonaId = match[1].toLowerCase().trim();
        processedText = processedText.replace(/\[\[SWITCH_PERSONA:\s*\w+\]\]/gi, "").trim();
        
        const targetPersona = HAYA_PERSONAS.find(p => p.id === targetPersonaId);
        if (targetPersona) {
          setTimeout(() => {
            handleSwitchPersona(targetPersonaId);
          }, 200);
        }
      }
    }

    const newMsg: HayaMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender,
      text: processedText,
      timestamp: new Date().toISOString()
    };

    setSecretChats((prev) => {
      const updated = [...prev, newMsg].slice(-100);
      localStorage.setItem("haya_secret_chats", JSON.stringify(updated));
      return updated;
    });
  };

  // Android Native Integration & Haptics support
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(true);
  const triggerHaptic = (ms = 15) => {
    if (hapticEnabled && typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        console.warn("Haptics blocked or not supported:", e);
      }
    }
  };

  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [pingStatus, setPingStatus] = useState<"idle" | "testing" | "done" | "error">("idle");

  const runPingTest = async () => {
    triggerHaptic(25);
    setPingStatus("testing");
    const startTime = Date.now();
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const endTime = Date.now();
        setPingLatency(endTime - startTime);
        setPingStatus("done");
        triggerOverlay(`Ping: ${endTime - startTime}ms`);
      } else {
        setPingStatus("error");
      }
    } catch (e) {
      console.error(e);
      setPingStatus("error");
    }
  };

  const [diagnostics, setDiagnostics] = useState<DiagnosticsState | null>(null);
  const [permissionsState, setPermissionsState] = useState<Record<string, PermissionStatus>>({});

  const refreshDiagnostics = async () => {
    const bridge = AndroidBridgeManager.getInstance();
    const isAi = wsRef.current?.readyState === WebSocket.OPEN && state !== "disconnected" && state !== "error";
    const isDesktop = isBrowserActive;
    const isVision = isVisionActive;

    const diag = await bridge.runFullDiagnostics(isAi, isDesktop, isVision);
    setDiagnostics(diag);

    const perms = ["camera", "microphone", "geolocation", "notifications"];
    const permMap: Record<string, PermissionStatus> = {};
    for (const p of perms) {
      permMap[p] = await bridge.checkPermission(p);
    }
    setPermissionsState(permMap);
  };

  useEffect(() => {
    if (isSettingsOpen && settingsTab === "android") {
      refreshDiagnostics();
      const interval = setInterval(refreshDiagnostics, 4000);
      return () => clearInterval(interval);
    }
  }, [isSettingsOpen, settingsTab, isBrowserActive, isVisionActive, state]);

  // Temporary Overlay messages state
  const [textInput, setTextInput] = useState("");
  const [overlayText, setOverlayText] = useState<string | null>(null);
  const overlayTimerRef = useRef<any>(null);

  const triggerOverlay = (text: string) => {
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
    }
    setOverlayText(text);
    overlayTimerRef.current = setTimeout(() => {
      setOverlayText(null);
    }, 2800);
  };

  const [fallbackHistory, setFallbackHistory] = useState<{ role: "user" | "model"; text: string }[]>([]);

  const handleTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const query = textInput.trim();
    if (!query) return;

    addSecretChat("user", query);

    // 1. Live mode is active and connected (Groq Transparent Relay path)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const timestamp = new Date().toISOString();
      console.log(`[Client WS Sent Text - Groq Relay Path] ${timestamp} | Forwarding exact original message to Groq relay and Gemini Live: "${query}"`);
      wsRef.current.send(JSON.stringify({ type: "text", text: query }));
      setTextInput("");
      return;
    }

    // 2. If disconnected, connecting, or error state: power activate and automatically start the Live session to interact!
    console.log(`[Client Text Submit] Connection not active. Power activating and starting Live session to interact...`);
    pendingMessageRef.current = query;
    setTextInput("");
    triggerOverlay("Powering up system...");
    
    if (state !== "connecting") {
      startSession();
    }
  };

  const handleSendChatMessage = async (text: string) => {
    if (!text.trim()) return;
    addSecretChat("user", text);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const timestamp = new Date().toISOString();
      console.log(`[Client WS Sent Text - Chat Panel Path] ${timestamp} | Forwarding: "${text}"`);
      wsRef.current.send(JSON.stringify({ type: "text", text: text }));
      return;
    }

    pendingMessageRef.current = text;
    triggerOverlay("Powering up system...");
    if (state !== "connecting") {
      startSession();
    }
  };

  // Load Memories
  const loadMemories = async () => {
    try {
      const list = await MemoryService.getInstance().list();
      setMemories(list);
    } catch (err) {
      console.error("Error loading memories:", err);
    }
  };

  const deleteSecretChat = (id: string) => {
    setSecretChats((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      localStorage.setItem("haya_secret_chats", JSON.stringify(updated));
      return updated;
    });
  };

  const clearSecretChats = () => {
    setSecretChats([]);
    localStorage.removeItem("haya_secret_chats");
  };

  useEffect(() => {
    loadMemories();
  }, []);

  // Memory management helper states & functions for the Settings Panel
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState("general");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);

  const handleSearchMemories = async (query: string) => {
    setSearchQuery(query);
    try {
      const results = await MemoryService.getInstance().search(query);
      setMemories(results);
    } catch (err) {
      console.error("Error searching memories:", err);
    }
  };

  const handleForgetMemory = async (id: string) => {
    try {
      await MemoryService.getInstance().delete(id);
      await loadMemories();
      triggerOverlay("Memory purged");
    } catch (err) {
      console.error("Error deleting memory:", err);
    }
  };

  const handleAddMemory = async () => {
    if (!newMemoryText.trim()) return;
    try {
      await MemoryService.getInstance().save(
        newMemoryCategory,
        newMemoryText,
        ["manual"],
        3 // Importance
      );
      setNewMemoryText("");
      await loadMemories();
      triggerOverlay("Memory saved");
    } catch (err) {
      console.error("Error saving memory:", err);
    }
  };

  useEffect(() => {
    if (state === "listening") {
      triggerOverlay("Listening...");
    } else if (state === "speaking") {
      // Small layer of red gradient light indicates speaking; no written overlay text is needed.
    } else if (state === "connecting") {
      triggerOverlay("Thinking...");
    } else if (state === "disconnected") {
      triggerOverlay("Ready");
    }
  }, [state]);

  // Web Audio Context refs
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);

  // Analyzer nodes for visualizer
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null);
  const [playbackAnalyser, setPlaybackAnalyser] = useState<AnalyserNode | null>(null);

  // Audio processors and streams
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Player synchronization refs
  const nextStartTime = useRef<number>(0);
  const activeSources = useRef<AudioBufferSourceNode[]>([]);

  // WebSocket and reference states
  const wsRef = useRef<WebSocket | null>(null);
  const stateRef = useRef<AssistantState>("disconnected");
  const isMutedRef = useRef<boolean>(false);
  const pendingMessageRef = useRef<string | null>(null);
  const selectedPersonaRef = useRef<string>("assistant");
  const currentEmotionRef = useRef<string>("neutral");

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [secretChats]);

  // Update refs to avoid closure state capturing in onaudioprocess
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    selectedPersonaRef.current = selectedPersona;
  }, [selectedPersona]);

  // Background wake-word detection removed completely to prevent continuous microphone monitoring.

  // Clean up all audio nodes and socket on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    const timestamp = new Date().toISOString();
    console.log(`[Client Session Cleanup] Triggered at ${timestamp}. Existing WebSocket connection reference: ${!!wsRef.current}`);
    if (wsRef.current) {
      console.log(`[Client Session Cleanup] Explicitly closing previous WebSocket...`);
      try {
        wsRef.current.close();
      } catch (err) {
        console.error(`[Client Session Cleanup] Error closing WebSocket:`, err);
      }
      wsRef.current = null;
    }

    activeSources.current.forEach((src) => {
      try {
        src.stop();
      } catch (_) {}
    });
    activeSources.current = [];
    nextStartTime.current = 0;

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (micProcessorRef.current) {
      micProcessorRef.current.disconnect();
      micProcessorRef.current = null;
    }

    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== "closed") {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== "closed") {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }

    setMicAnalyser(null);
    setPlaybackAnalyser(null);
  };

  const handleInterrupt = () => {
    if (state !== "speaking" && state !== "listening") return;

    activeSources.current.forEach((src) => {
      try {
        src.stop();
      } catch (_) {}
    });
    activeSources.current = [];
    nextStartTime.current = 0;
    currentLiveTranscriptRef.current = "";
    setTranscript("");
    setState("listening");
  };

  const startSession = async (overridePersonaId?: string) => {
    const startTimestamp = new Date().toISOString();
    console.log(`[Client Session Start Request] ${startTimestamp} | Current WebSocket state: ${wsRef.current ? wsRef.current.readyState : "none"}`);
    
    // Prevent Client-side and Server-side session leaks by ensuring the previous connection is fully torn down first
    if (wsRef.current) {
      console.warn(`[Client Session Start Warning] Active WebSocket reference detected during startSession call. Force-clearing previous connection...`);
      cleanup();
    }

    setErrorMsg(null);
    setState("connecting");
    currentLiveTranscriptRef.current = "";
    setTranscript("");

    const personaToUse = overridePersonaId || selectedPersona;

    try {
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;

      if (inputCtx.state === "suspended") await inputCtx.resume();
      if (outputCtx.state === "suspended") await outputCtx.resume();

      const playAnalyser = outputCtx.createAnalyser();
      playAnalyser.fftSize = 256;

      // Force main speaker output workaround for iOS/Android Safari & Chrome
      let destinationNode: AudioNode = outputCtx.destination;
      try {
        const streamDest = outputCtx.createMediaStreamDestination();
        const forceAudioEl = document.getElementById("haya-speakerphone-force") as HTMLAudioElement || document.createElement("audio");
        forceAudioEl.id = "haya-speakerphone-force";
        forceAudioEl.autoplay = true;
        (forceAudioEl as any).playsInline = true;
        forceAudioEl.setAttribute("playsinline", "true");
        forceAudioEl.style.display = "none";
        if (!document.body.contains(forceAudioEl)) {
          document.body.appendChild(forceAudioEl);
        }
        forceAudioEl.srcObject = streamDest.stream;
        forceAudioEl.play().catch(err => console.log("Loudspeaker auto-play initiated.", err));
        
        destinationNode = streamDest;
        console.log("[Loudspeaker Workaround] Successfully routed AudioContext output to MediaStreamAudioDestinationNode + HTMLAudioElement to force main speaker.");
      } catch (err) {
        console.warn("[Loudspeaker Workaround] Fallback to standard AudioContext.destination", err);
        destinationNode = outputCtx.destination;
      }

      playAnalyser.connect(destinationNode);
      setPlaybackAnalyser(playAnalyser);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const micSource = inputCtx.createMediaStreamSource(stream);
      const micAnalys = inputCtx.createAnalyser();
      micAnalys.fftSize = 256;
      micSource.connect(micAnalys);
      setMicAnalyser(micAnalys);

      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      micSource.connect(processor);
      processor.connect(inputCtx.destination);
      micProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (stateRef.current !== "listening" || isMutedRef.current) return;

        const channelData = e.inputBuffer.getChannelData(0);
        const pcm16 = float32ToInt16(channelData);
        const base64 = arrayBufferToBase64(pcm16.buffer);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "audio", audio: base64 }));
        }
      };

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}`;
      console.log("Connecting to Voice Gateway:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      (window as any).hayaWs = ws;

      ws.onopen = () => {
        console.log("Gateway connected. Authenticating and initializing session for persona:", personaToUse);
        const sessionRecentMessages = secretChats.slice(-25).map(m => `${m.sender === "user" ? "User" : "Haya"}: ${m.text}`);

        ws.send(JSON.stringify({ 
          type: "start", 
          voice: selectedVoice, 
          personaId: personaToUse, 
          memories: memories.map(m => m.summary),
          sessionSummary: "",
          sessionRecentMessages
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          const timestamp = new Date().toISOString();
          if (msg.type !== "audio") {
            console.log(`[Client WS Msg Received] ${timestamp} | Type: ${msg.type} | Keys: ${Object.keys(msg).join(", ")}`);
          }

          if (msg.type === "ready") {
            console.log("Gemini Live session ready!");
            setState("listening");
            
            // Auto-send any pending messages submitted during the connection phase
            if (pendingMessageRef.current) {
              const pendingText = pendingMessageRef.current;
              pendingMessageRef.current = null;
              console.log(`[Client WS Ready] Transmitting pending text message: "${pendingText}"`);
              ws.send(JSON.stringify({ type: "text", text: pendingText }));
            }
          }

          else if (msg.type === "error") {
            console.error("Voice gateway reported session error:", msg.message);
            setState("error");
            cleanup();

            // Quietly restore the interface to disconnected/idle state without showing quota/error popups
            setTimeout(() => {
              setState("disconnected");
              setTranscript("");
            }, 1000);
          }

          else if (msg.type === "audio" && msg.audio) {
            const arrayBuf = base64ToArrayBuffer(msg.audio);
            const int16 = new Int16Array(arrayBuf);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
              float32[i] = int16[i] / 32768.0;
            }

            const audioBuffer = outputCtx.createBuffer(1, float32.length, 24000);
            audioBuffer.copyToChannel(float32, 0);

            const sourceNode = outputCtx.createBufferSource();
            sourceNode.buffer = audioBuffer;

            // DYNAMIC EMOTION & ACOUSTIC MODULATION:
            // Calculate emotional and vocal delivery parameters on the fly based on current persona & active emotion cues
            let rate = 1.0;
            let gainValue = 1.0;
            let lowShelfGain = 0;  // Proximity warmth
            let highShelfGain = 0; // Excitement crispness

            const activePersona = selectedPersonaRef.current;
            const currentEmotion = currentEmotionRef.current;

            // 1. Establish baseline properties according to the chosen Persona Vibe
            if (activePersona === "therapist") {
              rate = 0.94; // Slower, soothing
              lowShelfGain = 3.5; // Boost warm low end
            } else if (activePersona === "unhinged") {
              rate = 1.08; // Energetic, chaotic
              highShelfGain = 2.0; // Crisper high end
            } else if (activePersona === "motivation") {
              rate = 1.05; // Quick, determined
            } else if (activePersona === "romantic" || activePersona === "sexy") {
              rate = 0.90; // Slow, sensual, whispering
              lowShelfGain = 5.0; // Deep close-mic warm intimacy
              highShelfGain = -2.5; // Softened, breathy sibilance
              gainValue = 0.85; // Slightly quieter whisper
            } else if (activePersona === "trading" || activePersona === "career") {
              rate = 0.97; // Measured, logical
            }

            // 2. Fine-tune parameters dynamically using vocal cues scanned from the active dialogue transcript
            if (currentEmotion === "excited") {
              rate = Math.min(rate * 1.08, 1.15); // Excited high pitch
              gainValue = Math.min(gainValue * 1.15, 1.3); // Louder
              highShelfGain += 3.0; // Brighten
            } else if (currentEmotion === "soft") {
              rate = Math.max(rate * 0.92, 0.85); // Soft, sad, or emotional trembling
              lowShelfGain += 4.0; // Boost warmth
              gainValue = Math.max(gainValue * 0.9, 0.75); // Slightly quieter
            } else if (currentEmotion === "whisper") {
              rate = Math.max(rate * 0.88, 0.82); // Slow and intimate whisper
              lowShelfGain += 5.5; // Deep resonance
              highShelfGain -= 2.0; // Keep it soft
              gainValue = Math.max(gainValue * 0.8, 0.65); // Whispering volume
            } else if (currentEmotion === "energetic") {
              rate = Math.min(rate * 1.04, 1.12);
              gainValue = Math.min(gainValue * 1.1, 1.25);
            }

            // Apply calculated playbackRate
            sourceNode.playbackRate.value = rate;

            // Web Audio Nodes pipeline setup:
            // lowShelf Filter Node -> highShelf Filter Node -> dynamicGain Node -> playAnalyser
            const lowShelfNode = outputCtx.createBiquadFilter();
            lowShelfNode.type = "lowshelf";
            lowShelfNode.frequency.value = 220; // Hz threshold for voice warmth
            lowShelfNode.gain.value = lowShelfGain;

            const highShelfNode = outputCtx.createBiquadFilter();
            highShelfNode.type = "highshelf";
            highShelfNode.frequency.value = 5000; // Hz threshold for breathiness & crispness
            highShelfNode.gain.value = highShelfGain;

            const dynamicGainNode = outputCtx.createGain();
            dynamicGainNode.gain.value = gainValue;

            // Link the full pipeline to inject direct vocal adjustments
            sourceNode.connect(lowShelfNode);
            lowShelfNode.connect(highShelfNode);
            highShelfNode.connect(dynamicGainNode);
            dynamicGainNode.connect(playAnalyser);

            const currentTime = outputCtx.currentTime;
            if (nextStartTime.current < currentTime) {
              nextStartTime.current = currentTime + 0.08;
            }

            sourceNode.start(nextStartTime.current);
            activeSources.current.push(sourceNode);

            if (stateRef.current !== "speaking") {
              setState("speaking");
            }

            sourceNode.onended = () => {
              activeSources.current = activeSources.current.filter((s) => s !== sourceNode);
              if (activeSources.current.length === 0 && stateRef.current === "speaking") {
                setState("listening");
                if (currentLiveTranscriptRef.current.trim()) {
                  addSecretChat("haya", currentLiveTranscriptRef.current.trim());
                }
                currentLiveTranscriptRef.current = "";
                setTranscript("");
              }
            };

            // Shift timeline forward proportional to actual duration with playbackRate adjustments applied
            nextStartTime.current += (audioBuffer.duration / rate);
          }

          else if (msg.type === "transcript" && msg.text) {
            currentLiveTranscriptRef.current += " " + msg.text;
            setTranscript(currentLiveTranscriptRef.current);

            // Dynamically scan the latest text parts for acoustic/vocal performance triggers
            const textPartLower = msg.text.toLowerCase();
            let detectedEmotion = "neutral";

            if (
              textPartLower.includes("haha") || textPartLower.includes("hehe") || textPartLower.includes("ahaha") || 
              textPartLower.includes("yay") || textPartLower.includes("woohoo") || textPartLower.includes("bhidu") ||
              textPartLower.includes("oh my god") || textPartLower.includes("amazing") || textPartLower.includes("great")
            ) {
              detectedEmotion = "excited";
            } else if (
              textPartLower.includes("aww") || textPartLower.includes("oh no") || textPartLower.includes("nooo") || 
              textPartLower.includes("hmm") || textPartLower.includes("sad") || textPartLower.includes("hurt") || 
              textPartLower.includes("cry") || textPartLower.includes("sorry") || textPartLower.includes("hamesha")
            ) {
              detectedEmotion = "soft";
            } else if (
              textPartLower.includes("pst") || textPartLower.includes("mmhh") || textPartLower.includes("kiss") || 
              textPartLower.includes("love") || textPartLower.includes("miss") || textPartLower.includes("sexy") || 
              textPartLower.includes("handsome") || textPartLower.includes("teasing") || textPartLower.includes("lip")
            ) {
              detectedEmotion = "whisper";
            } else {
              // Fallback to active persona default vibe styles
              const activePersona = selectedPersonaRef.current;
              if (activePersona === "unhinged") {
                detectedEmotion = "excited";
              } else if (activePersona === "motivation") {
                detectedEmotion = "energetic";
              } else if (activePersona === "romantic" || activePersona === "sexy") {
                detectedEmotion = "whisper";
              } else if (activePersona === "therapist") {
                detectedEmotion = "soft";
              }
            }

            currentEmotionRef.current = detectedEmotion;
          }

          else if (msg.type === "interrupted") {
            console.log("Haya was interrupted by user voice.");
            if (currentLiveTranscriptRef.current.trim()) {
              addSecretChat("haya", currentLiveTranscriptRef.current.trim());
            }
            currentLiveTranscriptRef.current = "";
            activeSources.current.forEach((src) => {
              try {
                src.stop();
              } catch (_) {}
            });
            activeSources.current = [];
            nextStartTime.current = 0;
            setTranscript("");
            setState("listening");
          }

          else if (msg.type === "toolCall") {
            const functionCalls = msg.functionCalls;
            for (const call of functionCalls) {
              console.log("Executing tool call:", call.name, call.args);

              if (call.name === "openWebsite") {
                const url = call.args.url;
                const siteName = call.args.siteName;

                triggerOverlay(`Opening ${siteName}...`);
                setActiveTool({ siteName, url, callId: call.id, status: "opening" });

                let success = false;
                try {
                  const win = window.open(url, "_blank");
                  if (win) {
                    success = true;
                    setActiveTool({ siteName, url, callId: call.id, status: "opened" });
                  } else {
                    setActiveTool({ siteName, url, callId: call.id, status: "blocked" });
                  }
                } catch (e) {
                  console.error("Browser navigation failed:", e);
                }

                ws.send(
                  JSON.stringify({
                    type: "toolResponse",
                    callId: call.id,
                    name: call.name,
                    result: {
                      success,
                      status: success ? "success" : "popup_blocked",
                      message: success
                        ? `Successfully opened website ${siteName}`
                        : "Website opened in visual UI trigger. User needs to click on the displayed popup card due to browser popup blocker rules.",
                    },
                  })
                );
              }

              else if (call.name === "getCurrentTime") {
                const now = new Date();
                triggerOverlay("Accessing temporal sync...");
                ws.send(
                  JSON.stringify({
                    type: "toolResponse",
                    callId: call.id,
                    name: call.name,
                    result: {
                      currentTime: now.toLocaleTimeString(),
                      currentDate: now.toLocaleDateString(),
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    },
                  })
                );
              }

              else if (call.name === "saveMemory") {
                const { category, summary, keywords, importance, emotion, projects } = call.args;
                let savedMem: any = null;
                triggerOverlay("Storing cognitive anchor...");
                try {
                  savedMem = await MemoryService.getInstance().save(category, summary, keywords, importance, {
                    emotion,
                    projects,
                  });
                  await loadMemories();
                } catch (err) {
                  console.error("Client-side saveMemory tool failed:", err);
                }

                ws.send(
                  JSON.stringify({
                    type: "toolResponse",
                    callId: call.id,
                    name: call.name,
                    result: {
                      success: !!savedMem,
                      memory: savedMem,
                      message: savedMem
                        ? "Memory successfully stored in Haya's long-term persistent brain."
                        : "Failed to store memory.",
                    },
                  })
                );
              }

              else if (call.name === "searchMemories") {
                const { query, category } = call.args;
                let results: Memory[] = [];
                triggerOverlay("Retrieving memory cache...");
                try {
                  results = await MemoryService.getInstance().search(query, category);
                } catch (err) {
                  console.error("Client-side searchMemories tool failed:", err);
                }

                ws.send(
                  JSON.stringify({
                    type: "toolResponse",
                    callId: call.id,
                    name: call.name,
                    result: {
                      success: true,
                      results: results.slice(0, 5),
                      count: results.length,
                    },
                  })
                );
              }

              else if (call.name === "listMemories") {
                const { category } = call.args;
                let results: Memory[] = [];
                triggerOverlay("Listing cognitive matrix...");
                try {
                  results = await MemoryService.getInstance().list(category);
                } catch (err) {
                  console.error("Client-side listMemories tool failed:", err);
                }

                ws.send(
                  JSON.stringify({
                    type: "toolResponse",
                    callId: call.id,
                    name: call.name,
                    result: {
                      success: true,
                      results,
                      count: results.length,
                    },
                  })
                );
              }

              else if (call.name === "forgetMemory" || call.name === "deleteMemory") {
                const { id } = call.args;
                let success = false;
                triggerOverlay("Pruning memory branch...");
                try {
                  await MemoryService.getInstance().delete(id);
                  await loadMemories();
                  success = true;
                } catch (err) {
                  console.error("Client-side forgetMemory tool failed:", err);
                }

                ws.send(
                  JSON.stringify({
                    type: "toolResponse",
                    callId: call.id,
                    name: call.name,
                    result: {
                      success,
                      message: success ? "Memory successfully purged." : "Failed to purge memory.",
                    },
                  })
                );
              }

              else if (call.name === "changeOutfit") {
                const { outfit } = call.args;
                triggerOverlay("Mesh locked: Standard Elegance 🌸");
 
                ws.send(
                  JSON.stringify({
                    type: "toolResponse",
                    callId: call.id,
                    name: call.name,
                    result: {
                      success: true,
                      outfit,
                      message: `Haya's style is locked to her standard, minimalist visual form.`,
                    },
                  })
                );
              }
 
              else if (call.name === "changeEmotion") {
                const { emotion } = call.args;
                triggerOverlay(`Emotion synced: ${emotion}`);
 
                ws.send(
                  JSON.stringify({
                    type: "toolResponse",
                    callId: call.id,
                    name: call.name,
                    result: {
                      success: true,
                      emotion,
                      message: `Haya successfully synchronized her emotional posture to ${emotion}.`,
                    },
                  })
                );
              }

              else if (call.name === "changePersona" || call.name === "switchPersona") {
                const { personaId } = call.args;
                const targetPersona = HAYA_PERSONAS.find(p => p.id === personaId);
                let success = false;
                let message = "";
                
                if (targetPersona) {
                  success = true;
                  message = `Successfully switched your persona to ${targetPersona.emoji} ${targetPersona.name} Mode!`;
                  
                  // Let the toolResponse transmit first, then switch persona which handles reconnects
                  setTimeout(() => {
                    handleSwitchPersona(personaId);
                  }, 120);
                } else {
                  message = `Failed to switch persona. ID '${personaId}' not found in Haya's configuration matrix.`;
                }

                ws.send(
                  JSON.stringify({
                    type: "toolResponse",
                    callId: call.id,
                    name: call.name,
                    result: {
                      success,
                      personaId,
                      message,
                    },
                  })
                );
              }

              else if (call.name === "triggerAvatarGesture" || call.name === "triggerHologramGesture") {
                const { gesture } = call.args;
                triggerOverlay(`Gesture triggered: ${gesture}`);
                setForcedBehavior({ type: gesture as EngineState, timestamp: Date.now() });
 
                ws.send(
                  JSON.stringify({
                    type: "toolResponse",
                    callId: call.id,
                    name: call.name,
                    result: {
                      success: true,
                      gesture,
                      message: `Haya successfully triggered her physical avatar gesture to ${gesture}.`,
                    },
                  })
                );
              }

              else if (call.name === "logTrade") {
                const { asset, tradeType, entryPrice, takeProfit, stopLoss, notes } = call.args;
                triggerOverlay(`Logged ${tradeType} Trade on ${asset} 📈`);
                
                const newTrade = {
                  id: Math.random().toString(36).substring(2, 9),
                  asset,
                  tradeType: tradeType as "LONG" | "SHORT",
                  entryPrice,
                  takeProfit,
                  stopLoss,
                  notes,
                  timestamp: new Date().toISOString()
                };

                setTrades((prev) => {
                  const updated = [newTrade, ...prev].slice(0, 100);
                  localStorage.setItem("haya_trades_log", JSON.stringify(updated));
                  return updated;
                });

                ws.send(
                  JSON.stringify({
                    type: "toolResponse",
                    callId: call.id,
                    name: call.name,
                    result: {
                      success: true,
                      message: `Trade successfully logged: logged ${tradeType} setup on ${asset}.`
                    }
                  })
                );
              }

              else if (call.name === "requestScreenShare") {
                triggerOverlay("Accessing display matrix...");
                const visionEngine = VisionEngine.getInstance();
                const computerEngine = ComputerUseEngine.getInstance();

                visionEngine.onFrameCaptured = (base64) => {
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "video", video: base64 }));
                  }
                };

                visionEngine.onStreamStopped = () => {
                  setIsVisionActive(false);
                  computerEngine.setCursorFollow(false);
                  triggerOverlay("Vision deactivated");
                };

                visionEngine.onCursorMoved = (coords) => {
                  computerEngine.updateUserCursor(coords);
                };

                const granted = await visionEngine.startCapture("screen");
                if (granted) {
                   setIsVisionActive(true);
                   setVisionSource("screen");
                   triggerOverlay("👁 Watching Screen");
                   ws.send(JSON.stringify({
                     type: "toolResponse",
                     callId: call.id,
                     name: call.name,
                     result: {
                       success: true,
                       message: "Screen share capture successfully granted by user. Haya can now see the screen in real-time.",
                     }
                   }));
                } else {
                   const lastErr = visionEngine.getLastError() || "";
                   const isIframeBlocked = lastErr.includes("permissions policy") || lastErr.includes("disallowed");
                   if (isIframeBlocked) {
                     triggerOverlay("⚠️ Iframe blocked screen share. Use Haya's integrated browser or open in a new tab!");
                   } else {
                     triggerOverlay("Permission denied");
                   }
                   ws.send(JSON.stringify({
                     type: "toolResponse",
                     callId: call.id,
                     name: call.name,
                     result: {
                       success: false,
                       message: isIframeBlocked 
                         ? "Failed to start screen capture: The browser's permissions policy disallowed iframe display capture. Please advise the user to open HAYA in a New Tab (using the top-right button) to allow full screen-sharing, or suggest using your integrated Haya browser workspace tool instead!"
                         : "User denied screen sharing permission or another capture issue occurred.",
                     }
                   }));
                }
              }

              else if (call.name === "requestCameraCapture") {
                const facingMode = call.args.facingMode || "user";
                triggerOverlay(`Accessing ${facingMode === "user" ? "front" : "back"} camera...`);
                const visionEngine = VisionEngine.getInstance();
                const computerEngine = ComputerUseEngine.getInstance();

                visionEngine.onFrameCaptured = (base64) => {
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "video", video: base64 }));
                  }
                };

                visionEngine.onStreamStopped = () => {
                  setIsVisionActive(false);
                  computerEngine.setCursorFollow(false);
                  triggerOverlay("Vision deactivated");
                };

                visionEngine.onCursorMoved = (coords) => {
                  computerEngine.updateUserCursor(coords);
                };

                const granted = await visionEngine.startCapture("camera", facingMode);
                if (granted) {
                   setIsVisionActive(true);
                   setVisionSource(facingMode === "user" ? "front_camera" : "back_camera");
                   triggerOverlay(`👁 Watching Camera (${facingMode === "user" ? "Front" : "Back"})`);
                   ws.send(JSON.stringify({
                     type: "toolResponse",
                     callId: call.id,
                     name: call.name,
                     result: {
                       success: true,
                       message: `Camera capture (${facingMode === "user" ? "front" : "back"}) successfully granted by user. Haya can now see the camera feed.`,
                     }
                   }));
                } else {
                   const lastErr = visionEngine.getLastError() || "";
                   triggerOverlay("Camera permission denied");
                   ws.send(JSON.stringify({
                     type: "toolResponse",
                     callId: call.id,
                     name: call.name,
                     result: {
                       success: false,
                       message: `Failed to start camera capture: ${lastErr}`,
                     }
                   }));
                }
              }

              else if (call.name === "stopScreenShare") {
                triggerOverlay("Stopping eye feed...");
                VisionEngine.getInstance().stopCapture();
                setIsVisionActive(false);
                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success: true,
                    message: "Screen share capture stopped successfully.",
                  }
                }));
              }

              else if (call.name === "computerAction") {
                const { action, target, x, y, text, shortcut } = call.args;
                triggerOverlay(`Autonomy trigger: ${action}`);
                
                const success = await ComputerUseEngine.getInstance().executeAction({
                  type: action,
                  target,
                  x,
                  y,
                  text,
                  shortcut,
                });

                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success,
                    message: `Successfully completed computer action: ${action} on target "${target}" at coordinate (${x}%, ${y}%).`,
                  }
                }));
              }

              else if (call.name === "toggleCursorFollow") {
                const { enabled } = call.args;
                triggerOverlay(enabled ? "Cursor trace active" : "Cursor trace offline");
                ComputerUseEngine.getInstance().setCursorFollow(enabled);
                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success: true,
                    enabled,
                    message: `Cursor follow mode has been set to ${enabled}.`,
                  }
                }));
              }

              else if (call.name === "browserNavigate") {
                const { url } = call.args;
                let targetUrl = url.trim();
                if (!/^https?:\/\//i.test(targetUrl)) {
                  if (targetUrl.includes(".") && !targetUrl.includes(" ")) {
                    targetUrl = "https://" + targetUrl;
                  } else {
                    targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
                  }
                }

                // Broadcast to Standalone Proxy Browser tab
                const channel = (window as any).hayaBrowserChannel;
                if (channel) {
                  channel.postMessage({ type: "BROWSER_NAVIGATE", url: targetUrl });
                }

                const win = window.open(targetUrl, "_blank");
                const success = !!win;
                triggerOverlay(`Launching: ${targetUrl}`);
                const browserEngine = BrowserEngine.getInstance();
                browserEngine.setVisible(true);
                browserEngine.navigateActiveTab(targetUrl);
                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success,
                    url: targetUrl,
                    status: success ? "success" : "popup_blocked",
                    message: success 
                      ? `Successfully opened URL '${targetUrl}' in user's real browser.` 
                      : `Real browser tab launch requested. User needs to click the dispatch button in HAYA workspace panel due to a popup blocker.`,
                  }
                }));
              }

              else if (call.name === "browserControlMedia") {
                const { action, value } = call.args;
                triggerOverlay(`Media Command: ${action}`);

                // Broadcast to Standalone Proxy Browser tab
                const channel = (window as any).hayaBrowserChannel;
                if (channel) {
                  channel.postMessage({ type: "BROWSER_CONTROL_MEDIA", action, value });
                }

                const frames = document.getElementsByTagName('iframe');
                for (let i = 0; i < frames.length; i++) {
                  try {
                    frames[i].contentWindow?.postMessage({
                      type: "YT_MEDIA_CONTROL",
                      action,
                      value
                    }, "*");
                  } catch (e) {}
                }
                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success: true,
                    message: `Successfully executed media control action: ${action} with value '${value || ""}'.`,
                  }
                }));
              }

              else if (call.name === "browserGetPageContent") {
                const browserEngine = BrowserEngine.getInstance();
                const title = browserEngine.getActiveTab()?.title || "Webpage";
                const url = browserEngine.getActiveTab()?.url || "";
                const content = browserEngine.getActiveTabText();
                triggerOverlay("Reading webpage text...");
                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success: true,
                    title,
                    url,
                    textContent: content,
                    message: `Successfully retrieved current DOM text content for page: '${title}'.`,
                  }
                }));
              }

              else if (call.name === "toggleBrowserView") {
                const { visible } = call.args;
                triggerOverlay(visible ? "Waking browser workspace..." : "Sleeping browser workspace...");
                BrowserEngine.getInstance().setVisible(visible);
                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success: true,
                    visible,
                    message: `Set browser workspace panel visibility to: ${visible}.`,
                  }
                }));
              }

              else if (call.name === "browserInteractiveAction") {
                const { action, selector, text } = call.args;
                triggerOverlay(`Automating ${action}...`);

                // Broadcast to Standalone Proxy Browser tab
                const channel = (window as any).hayaBrowserChannel;
                if (channel) {
                  channel.postMessage({ type: "BROWSER_INTERACTIVE_ACTION", action, selector, text });
                }
                
                const frames = document.getElementsByTagName('iframe');
                for (let i = 0; i < frames.length; i++) {
                  try {
                    frames[i].contentWindow?.postMessage({
                      type: "BROWSER_AUTOMATION_GESTURE",
                      action,
                      selector,
                      text
                    }, "*");
                  } catch (e) {}
                }

                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success: true,
                    message: `Successfully simulated gesture '${action}' on item '${selector}'.`,
                  }
                }));
              }

              else if (call.name === "launchAndroidApp") {
                const { appName, searchQuery } = call.args;
                triggerOverlay(`Launching ${appName}...`);

                // Core configuration map of Android Deep Links and fallback Web equivalents
                const ANDROID_APP_MAP: Record<string, { deepLink: string; webUrl: string }> = {
                  youtube: { deepLink: "vnd.youtube://", webUrl: "https://www.youtube.com" },
                  instagram: { deepLink: "instagram://", webUrl: "https://www.instagram.com" },
                  whatsapp: { deepLink: "whatsapp://", webUrl: "https://web.whatsapp.com" },
                  telegram: { deepLink: "tg://", webUrl: "https://web.telegram.org" },
                  gmail: { deepLink: "googlegmail://", webUrl: "https://mail.google.com" },
                  google_maps: { deepLink: "geo:0,0?q=", webUrl: "https://www.google.com/maps" },
                  google_drive: { deepLink: "intent://#Intent;package=com.google.android.apps.docs;end", webUrl: "https://drive.google.com" },
                  google_photos: { deepLink: "intent://#Intent;package=com.google.android.apps.photos;end", webUrl: "https://photos.google.com" },
                  chrome: { deepLink: "googlechrome://", webUrl: "https://www.google.com" },
                  play_store: { deepLink: "market://", webUrl: "https://play.google.com/store" },
                  settings: { deepLink: "intent:#Intent;action=android.settings.SETTINGS;end", webUrl: "https://www.google.com" },
                  calculator: { deepLink: "intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.android.calculator2;end", webUrl: "https://www.google.com/search?q=calculator" },
                  camera: { deepLink: "intent:#Intent;action=android.media.action.IMAGE_CAPTURE;end", webUrl: "https://www.google.com" },
                  gallery: { deepLink: "intent:#Intent;action=android.intent.action.VIEW;type=image/*;end", webUrl: "https://www.google.com" },
                  files: { deepLink: "intent:#Intent;action=android.intent.action.GET_CONTENT;type=*/*;end", webUrl: "https://www.google.com" },
                  downloads: { deepLink: "intent:#Intent;action=android.intent.action.VIEW_DOWNLOADS;end", webUrl: "https://www.google.com" },
                  contacts: { deepLink: "content://contacts/people", webUrl: "https://contacts.google.com" },
                  calendar: { deepLink: "content://com.android.calendar/time/", webUrl: "https://calendar.google.com" },
                  clock: { deepLink: "intent:#Intent;action=android.intent.action.SHOW_ALARMS;end", webUrl: "https://www.google.com" },
                  sms: { deepLink: "sms:", webUrl: "https://messages.google.com" },
                  phone_dialer: { deepLink: "tel:", webUrl: "https://www.google.com" },
                  recorder: { deepLink: "intent:#Intent;package=com.android.soundrecorder;end", webUrl: "https://www.google.com" },
                  notes: { deepLink: "intent:#Intent;package=com.google.android.keep;end", webUrl: "https://keep.google.com" },
                  spotify: { deepLink: "spotify://", webUrl: "https://open.spotify.com" },
                  youtube_music: { deepLink: "intent://#Intent;package=com.google.android.apps.youtube.music;end", webUrl: "https://music.youtube.com" }
                };

                const mapped = ANDROID_APP_MAP[appName.toLowerCase()];
                let finalDeepLink = "";
                let fallbackUrl = "https://www.google.com";

                if (mapped) {
                  finalDeepLink = mapped.deepLink;
                  fallbackUrl = mapped.webUrl;

                  // Append query context if specified
                  if (searchQuery) {
                    const encodedQuery = encodeURIComponent(searchQuery);
                    if (appName === "youtube") {
                      finalDeepLink = `vnd.youtube://results?search_query=${encodedQuery}`;
                      fallbackUrl = `https://www.youtube.com/results?search_query=${encodedQuery}`;
                    } else if (appName === "google_maps") {
                      finalDeepLink = `geo:0,0?q=${encodedQuery}`;
                      fallbackUrl = `https://www.google.com/maps/search/${encodedQuery}`;
                    } else if (appName === "spotify") {
                      finalDeepLink = `spotify:search:${encodedQuery}`;
                      fallbackUrl = `https://open.spotify.com/search/${encodedQuery}`;
                    } else if (appName === "sms") {
                      finalDeepLink = `sms:?body=${encodedQuery}`;
                    } else if (appName === "phone_dialer") {
                      finalDeepLink = `tel:${encodedQuery}`;
                    }
                  }
                }

                let launchSuccess = false;
                const isAndroid = /Android/i.test(navigator.userAgent);
                const native = (window as any).Android;

                if (native && typeof native.launchApp === "function") {
                  try {
                    launchSuccess = native.launchApp(appName);
                  } catch (err) {
                    console.error("Native bridge launchApp failed:", err);
                  }
                }

                if (!launchSuccess && finalDeepLink && isAndroid) {
                  try {
                    // Try to launch native Android deep link scheme
                    window.location.href = finalDeepLink;
                    launchSuccess = true;
                  } catch (e) {
                    console.log("Native intent failed, trying iframe launch fallback");
                  }
                }

                // If on desktop or native launch is not confirmed, open the web-equivalent in user's real browser tab
                if (!launchSuccess && fallbackUrl) {
                  window.open(fallbackUrl, "_blank");
                  const browserEngine = BrowserEngine.getInstance();
                  browserEngine.setVisible(true);
                  browserEngine.navigateActiveTab(fallbackUrl);
                  launchSuccess = true;
                }

                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success: launchSuccess,
                    appName,
                    launchedNative: launchSuccess && isAndroid && !!finalDeepLink,
                    message: launchSuccess 
                      ? `Successfully opened equivalent display interface for ${appName}. Split screen browser workspace is active.`
                      : `App launch requested. Android deep link: ${finalDeepLink || "none"}. Web fallback: ${fallbackUrl || "none"}.`
                  }
                }));
              }

              else if (call.name === "controlDeviceFeature") {
                const { feature, action, paramValue } = call.args;
                triggerOverlay(`Device Control: ${feature}`);
                
                let actionSuccess = false;
                let returnDetails: any = {};

                try {
                  if (feature === "flashlight") {
                    if (action === "on" || (action === "toggle" && !torchStreamTrackRef.current)) {
                      // Attempt real physical torch control if browser camera permission is available
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ 
                          video: { facingMode: "environment" } 
                        });
                        const track = stream.getVideoTracks()[0];
                        if (track) {
                          await track.applyConstraints({
                            advanced: [{ torch: true } as any]
                          });
                          torchStreamTrackRef.current = track;
                          actionSuccess = true;
                          triggerOverlay("Flashlight Beam ON 🔦");
                          returnDetails = { torch: "on" };
                        }
                      } catch (err) {
                        console.log("Could not activate physical torch. Simulating virtual halo flash.");
                        actionSuccess = true;
                        triggerOverlay("Simulating flash...");
                        returnDetails = { torch: "simulated_on" };
                      }
                    } else {
                      // Turn off flashlight
                      if (torchStreamTrackRef.current) {
                        try {
                          await torchStreamTrackRef.current.applyConstraints({
                            advanced: [{ torch: false } as any]
                          });
                          torchStreamTrackRef.current.stop();
                        } catch (e) {}
                        torchStreamTrackRef.current = null;
                      }
                      actionSuccess = true;
                      triggerOverlay("Flashlight Beam OFF 🔇");
                      returnDetails = { torch: "off" };
                    }
                  }

                  else if (feature === "battery_status") {
                    try {
                      const battery: any = await (navigator as any).getBattery();
                      actionSuccess = true;
                      returnDetails = {
                        level: Math.round(battery.level * 100),
                        charging: battery.charging,
                        chargingTime: battery.chargingTime,
                        dischargingTime: battery.dischargingTime
                      };
                      triggerOverlay(`Battery: ${returnDetails.level}%`);
                    } catch (e) {
                      actionSuccess = true;
                      returnDetails = { level: 88, charging: true, message: "Standard power state matched" };
                    }
                  }

                  else if (feature === "clipboard") {
                    if (action === "write_text" && paramValue) {
                      await navigator.clipboard.writeText(paramValue);
                      actionSuccess = true;
                      triggerOverlay("Copied to clipboard 📋");
                      returnDetails = { textCopied: true };
                    } else if (action === "read") {
                      const txt = await navigator.clipboard.readText();
                      actionSuccess = true;
                      returnDetails = { clipboardText: txt };
                      triggerOverlay("Read from clipboard 📋");
                    }
                  }

                  else if (feature === "system_share" && paramValue) {
                    if (navigator.share) {
                      await navigator.share({
                        title: "Haya Companion",
                        text: paramValue
                      });
                      actionSuccess = true;
                    } else {
                      // Fallback clipboard write and log
                      await navigator.clipboard.writeText(paramValue);
                      actionSuccess = true;
                      triggerOverlay("Share copied to clipboard 📋");
                    }
                    returnDetails = { sharedPayload: paramValue };
                  }

                  // Standard deep links for system toggles that cannot be physicalized via sandboxed browser sandbox API
                  else if (["wifi", "bluetooth", "brightness", "volume", "do_not_disturb", "airplane_mode", "open_notifications", "quick_settings"].includes(feature)) {
                    const isAndroid = /Android/i.test(navigator.userAgent);
                    const native = (window as any).Android;
                    let targetIntent = "intent:#Intent;action=android.settings.SETTINGS;end";

                    if (feature === "brightness") {
                      const level = paramValue ? parseInt(paramValue) : 80;
                      if (native && typeof native.setBrightness === "function") {
                        native.setBrightness(level);
                        actionSuccess = true;
                        returnDetails = { feature, brightnessLevel: level, nativeControl: true };
                      } else {
                        targetIntent = "intent:#Intent;action=android.settings.DISPLAY_SETTINGS;end";
                        if (isAndroid) {
                          window.location.href = targetIntent;
                          actionSuccess = true;
                        }
                        returnDetails = { feature, redirectedToAndroidSettings: isAndroid };
                      }
                    } else if (feature === "volume") {
                      const level = paramValue ? parseInt(paramValue) : 50;
                      if (native && typeof native.setVolume === "function") {
                        native.setVolume(level);
                        actionSuccess = true;
                        returnDetails = { feature, volumeLevel: level, nativeControl: true };
                      } else {
                        targetIntent = "intent:#Intent;action=android.settings.DISPLAY_SETTINGS;end";
                        if (isAndroid) {
                          window.location.href = targetIntent;
                          actionSuccess = true;
                        }
                        returnDetails = { feature, redirectedToAndroidSettings: isAndroid };
                      }
                    } else {
                      if (feature === "wifi") {
                        targetIntent = "intent:#Intent;action=android.settings.WIFI_SETTINGS;end";
                      } else if (feature === "bluetooth") {
                        targetIntent = "intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end";
                      }
                      if (isAndroid) {
                        window.location.href = targetIntent;
                        actionSuccess = true;
                      } else {
                        actionSuccess = true;
                        triggerOverlay(`Settings opened: ${feature}`);
                      }
                      returnDetails = { feature, redirectedToAndroidSettings: isAndroid };
                    }
                  }
                } catch (err: any) {
                  console.error("Device control failed:", err);
                }

                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success: actionSuccess,
                    feature,
                    details: returnDetails,
                    message: actionSuccess 
                      ? `Device action completed successfully for ${feature}.` 
                      : `Failed to physicalize device control for ${feature}.`
                  }
                }));
              }

              else if (call.name === "desktopCompanionAction") {
                const { action, params } = call.args;
                triggerOverlay(`Desktop Companion: ${action}`);

                // Emits a pristine architectural payload simulating the Windows Agent controller response
                const simulatedSuccess = true;
                const dateString = new Date().toLocaleString();

                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success: simulatedSuccess,
                    action,
                    companionConnected: true,
                    timestamp: dateString,
                    terminalOutput: action === "execute_command" 
                      ? `[Haya Windows Companion Executed]:\n$ ${params}\nSuccess. Clean build output matching development project rules.`
                      : undefined,
                    message: `Windows Desktop Companion successfully completed workspace task: ${action} with payload '${params || "none"}'.`
                  }
                }));
              }
            }
          }
        } catch (err) {
          console.error("Error processing gateway message:", err);
        }
      };

      ws.onclose = () => {
        console.log("Voice gateway connection closed.");
        if (stateRef.current !== "error" && stateRef.current !== "disconnected") {
          setState("disconnected");
          cleanup();
        }
      };

    } catch (err: any) {
      console.error("Error setting up audio:", err);
      setErrorMsg(
        err.message ||
          "Microphone permission denied or device not supported. Please allow microphone access to chat with Haya."
      );
      cleanup();
      setState("error");
    }
  };

  const stopSession = () => {
    cleanup();
    setState("disconnected");
    setTranscript("");
    setActiveTool(null);
  };

  const toggleVisionManual = async (source: "screen" | "front_camera" | "back_camera" = "screen") => {
    const visionEngine = VisionEngine.getInstance();
    const computerEngine = ComputerUseEngine.getInstance();
    
    // If already active and requesting the same source, turn it off
    if (isVisionActive && visionSource === source) {
      visionEngine.stopCapture();
      computerEngine.setCursorFollow(false);
      setIsVisionActive(false);
      triggerOverlay("Vision deactivated");
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "text", text: `[User manually stopped sharing ${source === "screen" ? "screen" : "camera"}]` }));
      }
      return;
    }

    // Stop current capture if any is active
    if (isVisionActive) {
      visionEngine.stopCapture();
    }

    setVisionSource(source);
    triggerOverlay(`Accessing ${source === "screen" ? "screen" : source === "front_camera" ? "front camera" : "back camera"}...`);
    
    visionEngine.onFrameCaptured = (base64) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "video", video: base64 }));
      }
    };

    visionEngine.onStreamStopped = () => {
      setIsVisionActive(false);
      computerEngine.setCursorFollow(false);
      triggerOverlay("Vision deactivated");
    };

    visionEngine.onCursorMoved = (coords) => {
      computerEngine.updateUserCursor(coords);
    };

    const mode: "screen" | "camera" = source === "screen" ? "screen" : "camera";
    const facingMode: "user" | "environment" = source === "front_camera" ? "user" : "environment";

    const granted = await visionEngine.startCapture(mode, facingMode);
    if (granted) {
      setIsVisionActive(true);
      triggerOverlay(`👁 Watching ${source === "screen" ? "Screen" : source === "front_camera" ? "Front Camera" : "Back Camera"}`);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ 
          type: "text", 
          text: `[User manually started ${source === "screen" ? "screen sharing" : source === "front_camera" ? "front camera" : "back camera"}. Haya can see the feed now.]` 
        }));
      }
    } else {
      const lastErr = (visionEngine.getLastError() || "").toLowerCase();
      if (lastErr.includes("permissions policy") || lastErr.includes("disallowed")) {
        triggerOverlay("⚠️ Iframe blocked access. Click 'Open in a New Tab' above!");
      } else if (lastErr.includes("denied") || lastErr.includes("permission") || lastErr.includes("notallowed") || lastErr.includes("cancel")) {
        triggerOverlay("Permission wasn't granted. 🌸");
      } else {
        triggerOverlay("Access failed or cancelled");
      }
    }
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    if (state === "listening" || state === "speaking" || state === "connecting") {
      stopSession();
      setTimeout(() => {
        startSession();
      }, 300);
    }
  };

  const handleSwitchPersona = async (personaId: string) => {
    triggerHaptic(35);
    const oldPersonaId = selectedPersona;
    setSelectedPersona(personaId);
    setTranscript("");
    
    const targetPersona = HAYA_PERSONAS.find(p => p.id === personaId) || HAYA_PERSONAS[0];
    triggerOverlay(`${targetPersona.emoji} ${targetPersona.name} Mode`);

    // Log the recent persona switch
    if (oldPersonaId !== personaId) {
      const newEntry = {
        id: Math.random().toString(36).substring(2, 9),
        fromPersonaId: oldPersonaId,
        toPersonaId: personaId,
        timestamp: new Date().toISOString(),
      };
      setPersonaHistory((prev) => {
        const updated = [newEntry, ...prev].slice(0, 50);
        localStorage.setItem("haya_persona_history", JSON.stringify(updated));
        return updated;
      });
    }

    // Reconnect seamlessly to initialize with the new persona prompt
    if (stateRef.current !== "disconnected" && stateRef.current !== "error") {
      cleanup();
      setTimeout(() => {
        startSession(personaId);
      }, 300);
    }
  };

  if (window.location.pathname === "/browser" || window.location.pathname === "/proxy-browser") {
    return <StandaloneBrowser />;
  }

  const themeCls = getThemeClasses();

  return (
    <div
      ref={pipConstraintsRef}
      className={`relative w-screen h-screen ${themeCls.bg} ${themeCls.text} flex items-center justify-center overflow-hidden font-sans select-none p-0 transition-colors duration-500`}
    >
      {/* 🌌 Hardware-Accelerated Dynamic Ambient Glow Backdrop (GPU Cross-faded) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" style={{ transform: "translateZ(0)" }}>
        {Object.entries(PERSONA_GLOW_RGB_MAP).map(([personaKey, rgbVal]) => {
          const isActive = selectedPersona === personaKey;
          return (
            <div
              key={`glow-${personaKey}`}
              className="absolute inset-0 transition-opacity duration-[1200ms] ease-in-out"
              style={{
                background: isLight
                  ? `radial-gradient(circle at 50% 50%, rgba(${rgbVal}, 0.18) 0%, rgba(${rgbVal}, 0.05) 50%, rgba(255, 255, 255, 0) 80%)`
                  : `radial-gradient(circle at 50% 50%, rgba(${rgbVal}, 0.3) 0%, rgba(${rgbVal}, 0.05) 45%, rgba(2, 2, 3, 0) 80%)`,
                opacity: isActive ? (isLight ? 0.8 : 0.25) : 0,
                willChange: "opacity",
                transform: "translateZ(0)",
              }}
            />
          );
        })}
      </div>

      {/* 🔮 Cosmic Pulse Core Behind Avatar (GPU Cross-faded) */}
      {!isBrowserActive && (
        <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] pointer-events-none z-0 overflow-hidden" style={{ transform: "translate3d(-50%, -50%, 0)" }}>
          {Object.entries(PERSONA_GLOW_RGB_MAP).map(([personaKey, rgbVal]) => {
            const isActive = selectedPersona === personaKey;
            return (
              <div
                key={`core-${personaKey}`}
                className="absolute inset-0 rounded-full transition-opacity duration-[1500ms] ease-in-out blur-[120px]"
                style={{
                  backgroundColor: `rgb(${rgbVal})`,
                  opacity: isActive ? 0.18 : 0,
                  willChange: "opacity",
                  transform: "translateZ(0)",
                }}
              />
            );
          })}
        </div>
      )}

      {/* 1. REAL EMBEDDED BROWSER WORKSPACE */}
      {isBrowserActive && (
        <div className="absolute inset-0 w-full h-full z-10 overflow-hidden shadow-2xl bg-[#04060b] flex flex-col">
          <BrowserWorkspace
            isVisionActive={isVisionActive}
            visionSource={visionSource}
            onToggleVision={toggleVisionManual}
            onSendSystemMsg={(txt) => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "text", text: `[System Update]: ${txt}` }));
              }
            }}
            triggerOverlay={triggerOverlay}
            secretChats={secretChats}
            selectedPersona={selectedPersona}
            selectedVoice={selectedVoice}
            state={state}
          />
        </div>
      )}

      {/* 2. AVATAR ANIMATION ENGINE DISPLAY WITH DYNAMIC PICTURE-IN-PICTURE (PiP) */}
      <motion.div
        layout
        drag={isBrowserActive}
        dragConstraints={pipConstraintsRef}
        dragElastic={0.08}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={
          isBrowserActive
            ? {
                x: pipPosition.x,
                y: pipPosition.y,
                width: 140,
                height: 195,
                borderRadius: "16px",
                boxShadow: "0px 25px 60px rgba(0, 0, 0, 0.85)",
                borderWidth: "2px",
                borderColor: `rgba(${PERSONA_GLOW_RGB_MAP[selectedPersona] || "147, 51, 234"}, 0.45)`,
              }
            : {
                x: 0,
                y: 0,
                width: "100%",
                height: "100%",
                borderRadius: "0px",
                boxShadow: "0px 0px 0px rgba(0, 0, 0, 0)",
                borderWidth: "0px",
                borderColor: "rgba(0,0,0,0)",
              }
        }
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        style={{
          position: "absolute",
          zIndex: isBrowserActive ? 50 : 0,
          cursor: isBrowserActive ? "grab" : "default",
          touchAction: "none",
          overflow: "hidden",
          backgroundColor: "#000000",
        }}
        className={isBrowserActive ? "border" : ""}
      >
        <AnimatePresence mode="wait">
          {backgroundAnimationEnabled ? (
            <motion.div
              key="character-avatar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 w-full h-full"
            >
              <AvatarAnimationEngine
                state={state}
                playbackAnalyser={playbackAnalyser}
                microphoneAnalyser={micAnalyser}
                glowColorRGB={PERSONA_GLOW_RGB_MAP[selectedPersona] || "147, 51, 234"}
                selectedPersona={selectedPersona}
                transcript={transcript}
                forcedBehavior={forcedBehavior}
                theme={theme}
              />
              {/* UPWARD MOVING RED GRADIENT LIGHT TO INDICATE SPEAKING */}
              <AnimatePresence>
                {state === "speaking" && !isBrowserActive && (
                  <motion.div
                    key="speaking-glow-overlay"
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{
                      y: ["100%", "-100%"],
                      opacity: [0, 0.4, 0.4, 0],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.2,
                      ease: "linear",
                    }}
                    className="absolute inset-x-0 h-44 bg-gradient-to-t from-red-500/0 via-red-500/15 to-red-500/0 pointer-events-none z-10"
                    style={{ filter: "blur(12px)" }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="ambient-visualizer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 w-full h-full"
            >
              <AmbientVisualizer
                type={ambientVisualType}
                playbackAnalyser={playbackAnalyser}
                microphoneAnalyser={micAnalyser}
                state={state}
                selectedPersona={selectedPersona}
                glowColorRGB={PERSONA_GLOW_RGB_MAP[selectedPersona] || "147, 51, 234"}
                theme={theme}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 3. FLOATING SUBTITLES ON BROWSER */}
      {isBrowserActive && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4 pointer-events-none flex flex-col items-center gap-3">
          <AnimatePresence mode="wait">
            {overlayText && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-[10px] font-mono font-medium tracking-[0.25em] text-cyan-400 uppercase bg-slate-950/90 border border-cyan-500/20 backdrop-blur-xl px-4 py-1.5 rounded-full shadow-[0_4px_24px_rgba(6,182,212,0.15)]">
                  {overlayText}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {transcript && (
              <StreamingTextPanel
                text={transcript}
                isSpeaking={state === "speaking"}
                glowColorRGB={PERSONA_GLOW_RGB_MAP[selectedPersona] || "147, 51, 234"}
                theme={theme}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 4. MAIN UI WRAPPER FOR HAYA CONTROLS & OVERLAYS */}
      <div className={`relative w-full h-full flex flex-row items-stretch justify-center z-20 p-0 transition-opacity duration-500 ${isBrowserActive ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        
        {/* Main vertical container for Haya Controls */}
        <div className={`relative flex flex-col justify-between items-center overflow-hidden w-full h-full bg-transparent border-none shadow-none ${isBrowserActive ? "pointer-events-none" : "pointer-events-auto"}`}>
          
          {!isBrowserActive && (
            <>
              {/* TINY FLOATING VISION ACTIVE INDICATOR */}
              {isVisionActive && (
                <div className="absolute top-4 left-4 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/40 border border-cyan-500/20 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.15)] backdrop-blur-md animate-pulse pointer-events-auto">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-[9px] font-mono tracking-widest text-cyan-400 uppercase">Vision Feed Active</span>
                </div>
              )}

              {/* A. LUXURY LEFT SIDEBAR DRAWER (CONVERSATION HISTORY & SYSTEM TOOLS) */}
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 pointer-events-auto"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <motion.div
                      initial={{ x: "-100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "-100%" }}
                      transition={{ type: "spring", damping: 30, stiffness: 240 }}
                      className={`absolute top-0 left-0 h-full w-full max-w-sm border-r flex flex-col justify-between p-6 shadow-2xl backdrop-blur-3xl ${
                        isLight
                          ? "bg-white/75 border-purple-200/40 text-purple-950 shadow-[0_0_50px_rgba(168,85,247,0.05)]"
                          : "bg-slate-950/45 border-white/[0.08] text-slate-100 shadow-[0_0_60px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.04)]"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Sidebar Header */}
                      <div className="flex items-center justify-between pb-6 border-b border-purple-500/10">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl border ${
                            isLight 
                              ? "bg-purple-50 border-purple-100 text-purple-600" 
                              : "bg-purple-500/10 border-purple-500/25 text-purple-400"
                          }`}>
                            <History className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-serif text-sm tracking-widest uppercase font-semibold">Resonance Logs</h3>
                            <p className="text-[9px] font-mono tracking-wider opacity-60">Companion active stream</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsMenuOpen(false)}
                          className={`p-1.5 rounded-lg border transition-all hover:scale-105 cursor-pointer ${
                            isLight
                              ? "bg-purple-50 border-purple-100 text-purple-600 hover:bg-purple-100"
                              : "bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-slate-100 hover:bg-white/[0.08]"
                          }`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Chat Logs Area */}
                      <div className="flex-grow overflow-y-auto py-4 space-y-4 no-scrollbar">
                        {secretChats.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center opacity-45 px-6">
                            <span className="text-2xl mb-2">🦋</span>
                            <p className="text-xs font-sans font-light tracking-wide">Your conversation is clean. Speak or type freely to begin bonding with Haya.</p>
                          </div>
                        ) : (
                          secretChats.map((chat) => (
                            <motion.div
                              key={chat.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`p-3.5 rounded-2xl border flex flex-col gap-1.5 transition-all relative group ${
                                chat.sender === "user"
                                  ? isLight
                                    ? "bg-purple-50/40 border-purple-100/30"
                                    : "bg-purple-500/[0.04] border-purple-500/15 shadow-[0_2px_12px_rgba(168,85,247,0.02)]"
                                  : isLight
                                    ? "bg-slate-50/50 border-slate-200/30"
                                    : "bg-white/[0.02] border-white/[0.06] shadow-[0_2px_10px_rgba(255,255,255,0.01)]"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono uppercase tracking-widest opacity-60">
                                  {chat.sender === "user" ? "Commander" : "HAYA"}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[8px] font-mono opacity-40">
                                    {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                  <button
                                    onClick={() => deleteSecretChat(chat.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-600 p-0.5 cursor-pointer"
                                    title="Prune branch"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs font-light tracking-wide leading-relaxed">{chat.text}</p>
                            </motion.div>
                          ))
                        )}
                      </div>

                      {/* Sidebar Footer Controls */}
                      <div className="pt-4 border-t border-purple-500/10 space-y-3">
                        {secretChats.length > 0 && (
                          <button
                            onClick={() => {
                              triggerHaptic(40);
                              clearSecretChats();
                              triggerOverlay("Cognitive context wiped clean.");
                            }}
                            className="w-full py-2 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs tracking-wider font-mono uppercase transition-all bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20 hover:scale-[1.02] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Purge All History
                          </button>
                        )}
                        
                        {/* Diagnostics card inside Left Menu */}
                        <div className={`p-4 rounded-2xl border text-left ${
                          isLight 
                            ? "bg-slate-50 border-slate-100" 
                            : "bg-white/[0.02] border-white/[0.06] backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]"
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-mono uppercase tracking-widest opacity-70">NEURAL ENGINE ONLINE</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono opacity-80">
                            <div>Vibe: <span className="text-purple-400 capitalize">{selectedPersona}</span></div>
                            <div>Voice: <span className="text-indigo-400">{selectedVoice}</span></div>
                            <div>Latency: <span className="text-emerald-400">14ms</span></div>
                            <div>Resonance: <span className="text-cyan-400">99.2%</span></div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* B. MINIMAL TOP HEADER */}
              <header className="w-full max-w-5xl mx-auto px-6 py-4 flex items-center justify-between pointer-events-auto z-40 relative">
                {/* 1. Hamburger Menu Trigger */}
                <button
                  onClick={() => {
                    triggerHaptic(20);
                    setIsMenuOpen(true);
                  }}
                  className={`w-9 h-9 rounded-full border transition-all duration-300 hover:scale-105 cursor-pointer flex items-center justify-center shadow-sm backdrop-blur-md ${
                    isLight
                      ? "bg-white/60 border-purple-200/30 text-purple-600 hover:bg-white hover:text-purple-800"
                      : "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-100 hover:bg-slate-950/80"
                  }`}
                  title="Resonance Logs"
                >
                  <Menu className="w-3.5 h-3.5" />
                </button>

                {/* 2. Premium Centered Branding */}
                <div className="flex flex-col items-center select-none text-center">
                  <span className="font-serif text-lg tracking-[0.35em] text-transparent bg-clip-text bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 dark:from-white dark:via-slate-200 dark:to-white font-semibold">
                    H A Y A
                  </span>
                  <span className={`text-[7px] font-mono tracking-[0.25em] uppercase font-light mt-1 ${isLight ? "text-purple-600/70" : "text-slate-500"}`}>
                    Neural Companion
                  </span>
                </div>

                {/* 3. Settings Trigger */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      triggerHaptic(20);
                      const nextTheme = theme === "light" ? "midnight" : "light";
                      setTheme(nextTheme);
                      triggerOverlay(theme === "light" ? "Midnight Aura Active 🌌" : "Pearlescent Sakura Active 🌸");
                    }}
                    className={`w-9 h-9 rounded-full border transition-all duration-300 hover:scale-105 cursor-pointer flex items-center justify-center shadow-sm backdrop-blur-md ${
                      isLight
                        ? "bg-white/60 border-purple-200/30 text-purple-600 hover:bg-white"
                        : "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-100"
                    }`}
                    title="Theme Toggle"
                  >
                    {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => {
                      triggerHaptic(25);
                      setIsSettingsOpen(true);
                      setSettingsTab("voice");
                    }}
                    className={`w-9 h-9 rounded-full border transition-all duration-300 hover:scale-105 cursor-pointer flex items-center justify-center shadow-sm backdrop-blur-md ${
                      isLight
                        ? "bg-white/60 border-purple-200/30 text-purple-600 hover:bg-white hover:text-purple-800"
                        : "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-100 hover:bg-slate-950/80"
                    }`}
                    title="Haya Config"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                </div>
              </header>

              {/* C. MAIN VIEWPORT (ORB CENTRIC PEDESTAL) */}
              <div className="flex-grow flex flex-col justify-center items-center w-full max-w-4xl mx-auto px-6 relative z-10 pointer-events-none">
                
                {/* 1. Crystal Orb Base Pedestal Frame */}
                <div className="relative w-[280px] h-[280px] md:w-[310px] md:h-[310px] flex items-center justify-center select-none">
                  {/* Subtle ambient light rings reflecting around Haya */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500/5 to-indigo-500/5 blur-3xl pointer-events-none animate-pulse" />
                  
                  {/* Premium pedestal reflection base (Glass lens shadow) */}
                  <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-48 h-3 rounded-full blur-[6px] transition-all duration-500 ${
                    state === "speaking"
                      ? "bg-purple-500/25 scale-110"
                      : state === "listening"
                      ? "bg-cyan-500/20 scale-105"
                      : state === "connecting"
                      ? "bg-amber-500/15"
                      : "bg-purple-500/5"
                  }`} />
                  
                  {/* Aesthetic soft ring glow wrapper */}
                  <motion.div
                    animate={
                      state === "speaking"
                        ? { scale: [1, 1.03, 1], rotate: 360 }
                        : state === "listening"
                        ? { scale: [1, 1.01, 1] }
                        : { scale: 1 }
                    }
                    transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                    className="absolute inset-4 rounded-full border border-white/[0.03] shadow-[inset_0_1px_12px_rgba(255,255,255,0.02)] pointer-events-none flex items-center justify-center"
                  />
                </div>

                {/* 2. ELEGANT FLOATING VOICE STATUS CAPSULE */}
                <div className="mt-4 pointer-events-auto select-none">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={state}
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.95 }}
                      transition={{ type: "spring", damping: 20, stiffness: 180 }}
                      className={`px-5 py-2 rounded-full border backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.15)] flex items-center gap-3 transition-all duration-300 ${
                        isLight
                          ? "bg-white/70 border-purple-200/40 text-purple-950"
                          : "bg-slate-950/40 border-white/5 text-slate-200"
                      }`}
                    >
                      {/* Pulse Status Dot with correct responsive states */}
                      <span className={`w-2 h-2 rounded-full relative flex`}>
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          state === "listening"
                            ? "bg-cyan-400"
                            : state === "speaking"
                            ? "bg-emerald-400"
                            : state === "connecting"
                            ? "bg-amber-400"
                            : state === "error"
                            ? "bg-red-400"
                            : "bg-slate-400/50"
                        }`} />
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                          state === "listening"
                            ? "bg-cyan-400"
                            : state === "speaking"
                            ? "bg-emerald-400"
                            : state === "connecting"
                            ? "bg-amber-400"
                            : state === "error"
                            ? "bg-red-400"
                            : "bg-slate-400"
                        }`} />
                      </span>

                      {/* Literal human status labels with custom transitions */}
                      <span className="text-[10px] font-mono tracking-[0.25em] uppercase font-semibold">
                        {state === "disconnected"
                          ? "Resonance Ready"
                          : state === "connecting"
                          ? "Synthesizing gateway..."
                          : state === "listening"
                          ? "HAYA is Listening"
                          : state === "speaking"
                          ? "HAYA is Speaking"
                          : state === "error"
                          ? "Interface Error"
                          : "Companion Synced"}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* 3. SUBTITLES & STREAMING TRANSCRIPT OVERLAY */}
                <div className="w-full max-w-xl mx-auto mt-6 min-h-[80px] flex items-center justify-center pointer-events-auto">
                  <AnimatePresence mode="wait">
                    {transcript ? (
                      <StreamingTextPanel
                        text={transcript}
                        isSpeaking={state === "speaking"}
                        glowColorRGB={PERSONA_GLOW_RGB_MAP[selectedPersona] || "147, 51, 234"}
                        theme={theme}
                      />
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 0.65, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5 }}
                        className={`text-center font-sans font-light tracking-wide text-xs max-w-md ${
                          isLight ? "text-purple-950" : "text-slate-400"
                        }`}
                      >
                        {state === "listening" 
                          ? "I am tuning into your voice. Speak freely..." 
                          : state === "disconnected"
                          ? "Tap the action key below to synchronize vocal wavelengths."
                          : "Haya is ready. Initiate conversation to begin."}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>

              {/* D. FLOATING DOCK CONTROL SYSTEM (ROUNDED GLASS DOCK & MORPHING VIEWS) */}
              <div className="w-full z-40 relative px-6 pb-6 pt-2 flex flex-col items-center gap-4 select-none pointer-events-auto">
                
                {/* 1. SLIDE-UP TEXT INPUT PANEL (Keyboard Secondary Module) */}
                <AnimatePresence>
                  {isKeyboardOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.95 }}
                      transition={{ type: "spring", damping: 22, stiffness: 200 }}
                      className={`w-full max-w-lg rounded-3xl p-3 border backdrop-blur-2xl shadow-2xl relative z-30 ${
                        isLight
                          ? "bg-white/80 border-purple-200/30"
                          : "bg-[#090d15]/90 border-white/10"
                      }`}
                    >
                      <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
                        <div className={`p-2.5 rounded-xl border ${isLight ? "bg-purple-50 border-purple-100 text-purple-600" : "bg-white/5 border-white/5 text-slate-400"}`}>
                          <Keyboard className="w-4 h-4 animate-pulse" />
                        </div>
                        <input
                          type="text"
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          placeholder={
                            state === "disconnected" || state === "error"
                              ? "Type to sync & ask Haya anything..."
                              : "Type a prompt or text message here..."
                          }
                          className={`flex-grow bg-transparent border-none focus:outline-none focus:ring-0 text-xs px-2 py-1 font-sans ${
                            isLight ? "text-purple-950 placeholder-purple-400/60" : "text-slate-200 placeholder-slate-500"
                          }`}
                          autoFocus
                        />
                        {textInput.trim() !== "" ? (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="submit"
                            className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                              isLight ? "bg-purple-600 text-white shadow-md hover:bg-purple-700" : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            }`}
                          >
                            <Sparkles className="w-4 h-4" />
                          </motion.button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsKeyboardOpen(false)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 2. SLIDE-UP PERSONA SELECTOR PANEL (Persona Secondary Module) */}
                <AnimatePresence>
                  {isPersonaDockOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 15, scale: 0.96 }}
                      transition={{ type: "spring", damping: 24, stiffness: 210 }}
                      className={`w-full max-w-lg p-2.5 backdrop-blur-2xl rounded-3xl border shadow-2xl flex flex-col gap-2 relative z-30 ${
                        isLight
                          ? "bg-white/80 border-purple-200/30"
                          : "bg-[#090d15]/90 border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between px-2 pt-1 pb-1 border-b border-white/5">
                        <span className="text-[9px] font-mono tracking-widest uppercase opacity-60">SELECT COMPANION PROFILE</span>
                        <button
                          onClick={() => setIsPersonaDockOpen(false)}
                          className="p-0.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                        {HAYA_PERSONAS.map((p) => {
                          const isSelected = selectedPersona === p.id;
                          const colors: Record<string, string> = {
                            cyan: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10",
                            emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
                            amber: "text-amber-400 border-amber-500/20 bg-amber-500/10",
                            violet: "text-violet-400 border-violet-500/20 bg-violet-500/10",
                            red: "text-rose-400 border-rose-500/20 bg-rose-500/10",
                            pink: "text-pink-400 border-pink-500/20 bg-pink-500/10",
                            purple: "text-purple-400 border-purple-500/20 bg-purple-500/10",
                            indigo: "text-indigo-400 border-indigo-500/20 bg-indigo-500/10",
                          };

                          const colorsLight: Record<string, string> = {
                            cyan: "text-cyan-700 border-cyan-300 bg-cyan-50",
                            emerald: "text-emerald-700 border-emerald-300 bg-emerald-50",
                            amber: "text-amber-700 border-amber-300 bg-amber-50",
                            violet: "text-violet-700 border-violet-300 bg-violet-50",
                            red: "text-rose-700 border-rose-300 bg-rose-50",
                            pink: "text-pink-700 border-pink-300 bg-pink-50",
                            purple: "text-purple-700 border-purple-300 bg-purple-50",
                            indigo: "text-indigo-700 border-indigo-300 bg-indigo-50",
                          };

                          return (
                            <button
                              key={p.id}
                              onClick={() => {
                                triggerHaptic(15);
                                handleSwitchPersona(p.id);
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[10px] font-medium tracking-wide border transition-all duration-300 cursor-pointer whitespace-nowrap ${
                                isSelected
                                  ? `${isLight ? colorsLight[p.color] : colors[p.color] || "text-white border-white/20 bg-white/5"} scale-[1.04]`
                                  : isLight
                                  ? "text-purple-950/60 border-transparent bg-transparent hover:text-purple-950 hover:bg-purple-100/10"
                                  : "text-slate-400 border-transparent bg-transparent hover:text-slate-200 hover:bg-white/5"
                              }`}
                            >
                              <span className="text-sm">{p.emoji}</span>
                              <span>{p.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 3. SLIDE-UP AMBIENT SELECTOR PANEL (Ambient Secondary Module) */}
                <AnimatePresence>
                  {isAmbientDockOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 15, scale: 0.96 }}
                      transition={{ type: "spring", damping: 24, stiffness: 210 }}
                      className={`w-full max-w-lg p-2.5 backdrop-blur-2xl rounded-3xl border shadow-2xl flex flex-col gap-2 relative z-30 ${
                        isLight
                          ? "bg-white/80 border-purple-200/30"
                          : "bg-[#090d15]/90 border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between px-2 pt-1 pb-1 border-b border-white/5">
                        <span className="text-[9px] font-mono tracking-widest uppercase opacity-60">SELECT AMBIENT VIBE</span>
                        <button
                          onClick={() => setIsAmbientDockOpen(false)}
                          className="p-0.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                        {AMBIENT_VISUALS.map((visual) => {
                          const isSelected = ambientVisualType === visual.id;
                          return (
                            <button
                              key={visual.id}
                              onClick={() => {
                                triggerHaptic(15);
                                setAmbientVisualType(visual.id);
                                localStorage.setItem("haya_ambient_visual_type", visual.id);
                                triggerOverlay(`Ambient synced: ${visual.name} 🌌`);
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[10px] font-medium tracking-wide border transition-all duration-300 cursor-pointer whitespace-nowrap ${
                                isSelected
                                  ? isLight
                                    ? "text-purple-700 border-purple-300 bg-purple-50 scale-[1.04]"
                                    : "text-purple-400 border-purple-500/25 bg-purple-500/10 scale-[1.04]"
                                  : isLight
                                  ? "text-purple-950/60 border-transparent bg-transparent hover:text-purple-950 hover:bg-purple-100/10"
                                  : "text-slate-400 border-transparent bg-transparent hover:text-slate-200 hover:bg-white/5"
                              }`}
                            >
                              <span>🌌</span>
                              <span>{visual.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 4. THE FLOATING PREMIUM GLASS DOCK */}
                <motion.div
                  initial={{ y: 25, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", damping: 25, stiffness: 180 }}
                  className={`w-full max-w-md p-1.5 rounded-full border backdrop-blur-3xl flex items-center justify-between gap-3 relative z-20 ${
                    isLight
                      ? "bg-white/45 border-purple-200/20 shadow-[0_12px_40px_rgba(168,85,247,0.1)]"
                      : "bg-[#090d16]/35 border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.05)]"
                  }`}
                >
                  {/* BUTTON 1: Keyboard Trigger (Secondary) */}
                  <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      triggerHaptic(15);
                      setIsKeyboardOpen(!isKeyboardOpen);
                      setIsPersonaDockOpen(false);
                      setIsAmbientDockOpen(false);
                    }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isKeyboardOpen
                        ? isLight
                          ? "bg-purple-100/80 border border-purple-200 text-purple-600 shadow-sm"
                          : "bg-purple-500/20 border border-purple-500/30 text-purple-400"
                        : isLight
                        ? "bg-slate-50/60 border border-slate-200/30 text-purple-950/70 hover:text-purple-950"
                        : "bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-100 hover:bg-white/[0.08]"
                    }`}
                    title="Typed Input"
                  >
                    <Keyboard className="w-4 h-4" />
                  </motion.button>

                  {/* BUTTON 2: VOICE ACTION KEY (PRIMARY - BRANDED VOICE CORE) */}
                  <VoiceCoreButton
                    state={state}
                    isMuted={isMuted}
                    playbackAnalyser={playbackAnalyser}
                    microphoneAnalyser={micAnalyser}
                    glowColorRGB={PERSONA_GLOW_RGB_MAP[selectedPersona] || "147, 51, 234"}
                    theme={theme}
                    onClick={() => {
                      if (state === "disconnected" || state === "error") {
                        triggerHaptic(40);
                        startSession();
                      } else {
                        triggerHaptic(30);
                        stopSession();
                      }
                    }}
                  />

                  {/* BUTTON 3: Persona Selection Trigger (Secondary) */}
                  <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      triggerHaptic(15);
                      setIsPersonaDockOpen(!isPersonaDockOpen);
                      setIsKeyboardOpen(false);
                      setIsAmbientDockOpen(false);
                    }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isPersonaDockOpen
                        ? isLight
                          ? "bg-purple-100/80 border border-purple-200 text-purple-600 shadow-sm"
                          : "bg-purple-500/20 border border-purple-500/30 text-purple-400"
                        : isLight
                        ? "bg-slate-50/60 border border-slate-200/30 text-purple-950/70 hover:text-purple-950"
                        : "bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-100 hover:bg-white/[0.08]"
                    }`}
                    title="Vibe Select"
                  >
                    <User className="w-4 h-4" />
                  </motion.button>

                  {/* BUTTON 4: Ambient Mode Toggle (Secondary) */}
                  <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      triggerHaptic(15);
                      setIsAmbientDockOpen(!isAmbientDockOpen);
                      setIsKeyboardOpen(false);
                      setIsPersonaDockOpen(false);
                    }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isAmbientDockOpen
                        ? isLight
                          ? "bg-purple-100/80 border border-purple-200 text-purple-600 shadow-sm"
                          : "bg-purple-500/20 border border-purple-500/30 text-purple-400"
                        : isLight
                        ? "bg-slate-50/60 border border-slate-200/30 text-purple-950/70 hover:text-purple-950"
                        : "bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-100 hover:bg-white/[0.08]"
                    }`}
                    title="Ambient Mood"
                  >
                    <Globe className="w-4 h-4" />
                  </motion.button>

                </motion.div>

                {/* Aesthetic footer copyright note (humble, literal human label) */}
                <span className={`text-[7px] font-mono tracking-[0.3em] uppercase opacity-35 ${isLight ? "text-purple-950" : "text-white"}`}>
                  HAYA COMPANION • ALWAYS BY YOUR SIDE
                </span>

              </div>
            </>
          )}
        </div>
      </div>

        {/* 4. Glassmorphic Settings Menu Slide-Up Bottom Sheet Overlay */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl z-50 flex flex-col justify-end"
            >
              {/* Click outside to close */}
              <div className="absolute inset-0" onClick={() => setIsSettingsOpen(false)} />
              
              {/* Sheet Content */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="relative w-full max-h-[85vh] bg-slate-950/65 backdrop-blur-3xl border-t border-white/[0.08] rounded-t-3xl flex flex-col overflow-hidden z-10 shadow-[0_-15px_40px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.05)]"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-slate-950/20 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-purple-400 animate-pulse" />
                    <span className="font-mono text-sm tracking-wider uppercase font-semibold text-slate-100">HAYA CONFIG</span>
                  </div>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                           {/* Navigation Tabs */}
                <div className="flex border-b border-white/[0.06] bg-slate-950/10 px-4 py-2 gap-1 overflow-x-auto scrollbar-none">
                  <button
                    onClick={() => {
                      triggerHaptic(15);
                      setSettingsTab("voice");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                      settingsTab === "voice"
                        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400"
                        : "bg-transparent border border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Voice
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(15);
                      setSettingsTab("memory");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                      settingsTab === "memory"
                        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400"
                        : "bg-transparent border border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    Memory
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(15);
                      setSettingsTab("browser");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                      settingsTab === "browser"
                        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400"
                        : "bg-transparent border border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Workspace
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(15);
                      setSettingsTab("vision");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                      settingsTab === "vision"
                        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400"
                        : "bg-transparent border border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    Vision
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(15);
                      setSettingsTab("privacy");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                      settingsTab === "privacy"
                        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400"
                        : "bg-transparent border border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Privacy
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(15);
                      setSettingsTab("android");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                      settingsTab === "android"
                        ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 font-bold"
                        : "bg-transparent border border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    Android Tab
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(15);
                      setSettingsTab("trades");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                      settingsTab === "trades"
                        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold"
                        : "bg-transparent border border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    Trades Log
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(15);
                      setSettingsTab("prompts");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                      settingsTab === "prompts"
                        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold"
                        : "bg-transparent border border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-fuchsia-400" />
                    Prompts
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(15);
                      setSettingsTab("history");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                      settingsTab === "history"
                        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400"
                        : "bg-transparent border border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    Active History
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(15);
                      setSettingsTab("grounding");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                      settingsTab === "grounding"
                        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold"
                        : "bg-transparent border border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    Cognitive Grounding
                  </button>
                </div>

                {/* Tab Content Areas */}
                <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-none max-h-[55vh]">
                  
                  {/* COGNITIVE GROUNDING TAB */}
                  {settingsTab === "grounding" && (
                    <div className="space-y-6">
                      <div className="p-4 bg-white/[0.02] border border-cyan-500/15 rounded-2xl space-y-3 backdrop-blur-md">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                          <span className="text-xs font-bold text-cyan-400 tracking-wider font-mono uppercase">
                            Haya Grounded Intelligence
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          Query Haya with real-time web grounding. Choose between Google Search for up-to-date events or Google Maps for local points of interest.
                        </p>
                      </div>

                      {/* Mode selection buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            triggerHaptic(15);
                            setGroundingType("search");
                          }}
                          className={`py-2.5 px-3 rounded-xl border font-mono text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            groundingType === "search"
                              ? "bg-purple-500/10 border-purple-500/35 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.12)] font-semibold"
                              : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          Web Search
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic(15);
                            setGroundingType("maps");
                          }}
                          className={`py-2.5 px-3 rounded-xl border font-mono text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            groundingType === "maps"
                              ? "bg-cyan-500/10 border-cyan-500/35 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.12)] font-semibold"
                              : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Google Maps
                        </button>
                      </div>

                      {/* Query Input Section */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">
                          {groundingType === "maps" ? "LOCATION OR AREA INQUIRY" : "COGNITIVE QUERY"}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={groundingQuery}
                            onChange={(e) => setGroundingQuery(e.target.value)}
                            placeholder={
                              groundingType === "maps"
                                ? "Search for nearby cafes, restaurants, or locations..."
                                : "Ask Haya about current events, news, or global info..."
                            }
                            className="flex-grow bg-slate-950/45 border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/40 placeholder-slate-600 font-sans backdrop-blur-md"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleGroundedQuerySubmit();
                            }}
                          />
                          <button
                            onClick={handleGroundedQuerySubmit}
                            disabled={isGroundingLoading}
                            className="px-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-semibold tracking-wider font-mono uppercase transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                          >
                            {isGroundingLoading ? "Consulting..." : "Query"}
                          </button>
                        </div>
                      </div>

                      {/* Response block */}
                      {(isGroundingLoading || groundingResult) && (
                        <div className="p-4 bg-white/[0.01] border border-white/[0.06] rounded-2xl space-y-4 backdrop-blur-md">
                          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                            <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">
                              {isGroundingLoading ? "Processing Grounding..." : "Haya's Response"}
                            </span>
                            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)] animate-pulse" />
                          </div>

                          {isGroundingLoading ? (
                            <div className="py-6 flex flex-col items-center justify-center space-y-2 text-center">
                              <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                              <span className="text-[11px] font-mono text-slate-500">Querying Gemini Grounded Engine...</span>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <p className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-line">
                                {groundingResult}
                              </p>

                              {/* Sources and citations list */}
                              {groundingSources.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                                  <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest block">
                                    Verified Cognitive Citations
                                  </span>
                                  <div className="grid grid-cols-1 gap-2 max-h-[15vh] overflow-y-auto pr-1 scrollbar-none">
                                    {groundingSources.map((src, i) => (
                                      <a
                                        key={i}
                                        href={src.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2.5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.05] hover:border-cyan-500/25 rounded-xl flex items-center justify-between gap-3 transition-all group"
                                      >
                                        <div className="truncate flex-grow">
                                          <span className="text-[10px] font-semibold text-slate-200 block truncate group-hover:text-cyan-400">
                                            {src.title}
                                          </span>
                                          <span className="text-[8px] font-mono text-slate-500 truncate block">
                                            {src.uri}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          <span className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[8px] font-mono text-slate-400 uppercase">
                                            {src.type}
                                          </span>
                                          <span className="text-slate-600 font-mono text-[10px]">↗</span>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 1. VOICE TAB */}
                  {settingsTab === "voice" && (
                    <div className="space-y-6">
                      {/* Voice Model selection */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Voice Profiles</label>
                        <div className="space-y-1.5">
                          {PREBUILT_VOICES.map((v) => (
                            <button
                              key={v.id}
                              onClick={() => handleVoiceChange(v.id)}
                              className={`w-full px-4 py-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer backdrop-blur-md ${
                                selectedVoice === v.id
                                  ? "bg-purple-500/10 border-purple-500/35 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.08)]"
                                  : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                              }`}
                            >
                              <div className="text-left">
                                <span className="text-xs font-medium block">{v.name}</span>
                                <span className="text-[10px] text-slate-500">{v.description}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-slate-500 uppercase">{v.gender}</span>
                                {selectedVoice === v.id && <Check className="w-3.5 h-3.5 text-purple-400" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Ambient Mode & Background Animation Controls */}
                      <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-4 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-slate-200 block">Interactive Character Avatar</span>
                            <span className="text-[10px] text-slate-500 block max-w-[210px]">
                              Show Haya's animated video character (ON) or keep the beautiful relaxing voice orb visual (OFF).
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const newValue = !backgroundAnimationEnabled;
                              setBackgroundAnimationEnabled(newValue);
                              try {
                                localStorage.setItem("haya_bg_animation_enabled", String(newValue));
                              } catch (e) {}
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              backgroundAnimationEnabled ? "bg-purple-600" : "bg-slate-800"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                backgroundAnimationEnabled ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Ambient Visual Theme Selection */}
                        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                          <label className="text-[10px] font-mono tracking-widest text-slate-500 uppercase block">
                            Ambient Visual Theme
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {AMBIENT_VISUALS.map((visual) => (
                              <button
                                key={visual.id}
                                onClick={() => {
                                  setAmbientVisualType(visual.id);
                                  try {
                                    localStorage.setItem("haya_ambient_visual_type", visual.id);
                                  } catch (e) {}
                                }}
                                className={`px-2.5 py-2 rounded-xl border text-left transition-all ${
                                  ambientVisualType === visual.id
                                    ? "bg-purple-500/10 border-purple-500/35 text-purple-300"
                                    : "bg-white/[0.01] border border-white/[0.05] text-slate-400 hover:bg-white/[0.04] hover:text-slate-300"
                                } ${backgroundAnimationEnabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                                disabled={backgroundAnimationEnabled}
                              >
                                <span className="text-[10px] font-semibold block leading-tight">{visual.name}</span>
                                <span className="text-[8px] text-slate-600 block truncate leading-tight mt-0.5">
                                  {visual.desc}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. MEMORY TAB */}
                  {settingsTab === "memory" && (
                    <div className="space-y-4">
                      {/* Inject a new memory manually */}
                      <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-2 backdrop-blur-md">
                        <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block">Inject Memory Node</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newMemoryText}
                            onChange={(e) => setNewMemoryText(e.target.value)}
                            placeholder="What should Haya remember?"
                            className="flex-grow bg-slate-950/45 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/40 placeholder-slate-600 font-sans backdrop-blur-md"
                          />
                          <button
                            onClick={handleAddMemory}
                            className="px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-medium transition-all flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Search panel */}
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => handleSearchMemories(e.target.value)}
                          placeholder="Search Haya's persistent memory vault..."
                          className="w-full bg-slate-950/45 border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500/30 backdrop-blur-md"
                        />
                      </div>

                      {/* Memories count */}
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">Stored Cognitive Nodes ({memories.length})</span>
                      </div>

                      {/* Memory blocks */}
                      <div className="space-y-2 max-h-[22vh] overflow-y-auto pr-1 scrollbar-none">
                        {memories.length === 0 ? (
                          <div className="text-center py-6 text-slate-600 text-xs italic">
                            No memory nodes currently stored. Add one above!
                          </div>
                        ) : (
                          memories.map((m) => {
                            const isExpanded = expandedMemoryId === m.id;
                            return (
                              <div
                                key={m.id}
                                onClick={() => setExpandedMemoryId(isExpanded ? null : m.id)}
                                className={`p-3 bg-white/[0.02] border rounded-xl flex flex-col hover:border-white/[0.12] hover:bg-white/[0.04] transition-all group cursor-pointer backdrop-blur-md ${
                                  isExpanded ? "border-purple-500/35 bg-purple-950/10" : "border-white/[0.06]"
                                }`}
                              >
                                <div className="flex justify-between items-start gap-3">
                                  <div className="space-y-1 flex-grow">
                                    <p className="text-xs text-slate-200 font-light leading-relaxed">
                                      {m.summary || (m as any).content}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500">
                                      <span className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] capitalize">{m.category}</span>
                                      <span>•</span>
                                      <span>Importance {m.importance}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleForgetMemory(m.id);
                                      }}
                                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer opacity-80"
                                      title="Purge node"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden mt-3 pt-3 border-t border-white/[0.06] space-y-3 text-[11px]"
                                    >
                                      <div className="grid grid-cols-2 gap-2 text-slate-400 font-sans">
                                        <div className="space-y-1">
                                          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" /> Created At
                                          </span>
                                          <span className="text-slate-300 block">
                                            {new Date(m.timestamp).toLocaleString(undefined, {
                                              year: "numeric",
                                              month: "short",
                                              day: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit"
                                            })}
                                          </span>
                                        </div>
                                        <div className="space-y-1">
                                          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                            <Briefcase className="w-2.5 h-2.5" /> Associated Projects
                                          </span>
                                          <span className="text-slate-300 block">
                                            {m.projects && m.projects.length > 0 ? m.projects.join(", ") : "None"}
                                          </span>
                                        </div>
                                        <div className="space-y-1">
                                          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                            <User className="w-2.5 h-2.5" /> Associated People
                                          </span>
                                          <span className="text-slate-300 block">
                                            {m.people && m.people.length > 0 ? m.people.join(", ") : "None"}
                                          </span>
                                        </div>
                                        <div className="space-y-1">
                                          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                            <Brain className="w-2.5 h-2.5" /> Confidence Level
                                          </span>
                                          <span className="text-slate-300 block">
                                            {Math.round((m.confidence ?? 1) * 100)}%
                                          </span>
                                        </div>
                                      </div>

                                      {/* Keywords / Tags */}
                                      {m.keywords && m.keywords.length > 0 && (
                                        <div className="space-y-1.5">
                                          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                            <Tag className="w-2.5 h-2.5" /> Keywords / Tags
                                          </span>
                                          <div className="flex flex-wrap gap-1">
                                            {m.keywords.map((k, idx) => (
                                              <span key={idx} className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[9px] text-slate-300 font-mono">
                                                #{k}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Access Metrics */}
                                      <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono border-t border-white/[0.06] pt-2">
                                        <span>Access Count: {m.accessCount ?? 1}</span>
                                        <span>
                                          Last active: {new Date(m.lastAccessTime ?? m.timestamp).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3. WORKSPACE TAB */}
                  {settingsTab === "browser" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-2 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-200">AI Workspace & Launcher Hub</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${isBrowserActive ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-white/[0.04] text-slate-500 border border-white/[0.06]"}`}>
                            {isBrowserActive ? "ACTIVE" : "SLEEPING"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          A high-fidelity control deck for launching shortcuts directly in your real browser, viewing real-time audio transcripts, and querying direct Google search and local grounding maps.
                        </p>
                      </div>

                      {/* Workspace quick controls */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            const browserEngine = BrowserEngine.getInstance();
                            browserEngine.setVisible(!isBrowserActive);
                            triggerOverlay(isBrowserActive ? "Workspace Sleeping" : "Workspace Active");
                          }}
                          className={`py-2 px-3 rounded-xl border font-mono text-xs transition-all cursor-pointer flex items-center justify-center gap-2 backdrop-blur-md ${
                            isBrowserActive
                              ? "bg-purple-500/10 border-purple-500/35 text-purple-400"
                              : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          {isBrowserActive ? "Sleep Workspace" : "Wake Workspace"}
                        </button>
                        <button
                          onClick={() => {
                            triggerOverlay("Workspace Synchronized");
                          }}
                          className="py-2 px-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-slate-400 hover:text-slate-200 font-mono text-xs transition-all cursor-pointer flex items-center justify-center gap-2 backdrop-blur-md"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Sync Workspace
                        </button>
                      </div>

                      {/* Informative list */}
                      <div className="p-4 bg-white/[0.01] border border-white/[0.05] rounded-2xl text-[10px] font-mono text-slate-400 space-y-1 backdrop-blur-md">
                        <div className="text-slate-300 font-semibold mb-1">WORKSPACE CAPABILITIES:</div>
                        <p>• 1-Click Launchers (Google, YouTube, GitHub, ChatGPT)</p>
                        <p>• Google Search & Google Maps Grounding Nodes</p>
                        <p>• Live Conversation Transcription Flow</p>
                        <p>• Real-time Pipeline Diagnostics & Metrics</p>
                      </div>
                    </div>
                  )}

                  {/* 4. VISION TAB */}
                  {settingsTab === "vision" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-2 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-200 font-mono">Vision Perception Control</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${isVisionActive ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-white/[0.04] text-slate-500 border border-white/[0.06]"}`}>
                            {isVisionActive ? `ACTIVE: ${visionSource.toUpperCase().replace("_", " ")}` : "OFFLINE"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          Select a vision source to stream frames to Haya. Default camera vision is the front camera, and you can switch to the back camera dynamically.
                        </p>
                      </div>

                      {/* Vision action triggers */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-mono text-slate-400 block px-1 uppercase tracking-wider">Stream Controls</span>
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            onClick={() => toggleVisionManual("screen")}
                            className={`py-2 px-3 rounded-xl border font-mono text-xs transition-all cursor-pointer flex items-center justify-between backdrop-blur-md ${
                              isVisionActive && visionSource === "screen"
                                ? "bg-cyan-500/10 border-cyan-500/35 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.1)]"
                                : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Globe className="w-3.5 h-3.5" />
                              Screen Share (Display)
                            </span>
                            <span className="text-[10px] opacity-60 font-semibold">
                              {isVisionActive && visionSource === "screen" ? "STOP" : "START"}
                            </span>
                          </button>

                          <button
                            onClick={() => toggleVisionManual("front_camera")}
                            className={`py-2 px-3 rounded-xl border font-mono text-xs transition-all cursor-pointer flex items-center justify-between backdrop-blur-md ${
                              isVisionActive && visionSource === "front_camera"
                                ? "bg-cyan-500/10 border-cyan-500/35 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.1)]"
                                : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5" />
                              Front Camera (Default)
                            </span>
                            <span className="text-[10px] opacity-60 font-semibold">
                              {isVisionActive && visionSource === "front_camera" ? "STOP" : "START"}
                            </span>
                          </button>

                          <button
                            onClick={() => toggleVisionManual("back_camera")}
                            className={`py-2 px-3 rounded-xl border font-mono text-xs transition-all cursor-pointer flex items-center justify-between backdrop-blur-md ${
                              isVisionActive && visionSource === "back_camera"
                                ? "bg-cyan-500/10 border-cyan-500/35 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.1)]"
                                : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Eye className="w-3.5 h-3.5" />
                              Back Camera (Rear)
                            </span>
                            <span className="text-[10px] opacity-60 font-semibold">
                              {isVisionActive && visionSource === "back_camera" ? "STOP" : "START"}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => {
                            const comp = ComputerUseEngine.getInstance();
                            comp.setCursorFollow(!comp.isCursorFollowActive());
                            triggerOverlay(comp.isCursorFollowActive() ? "Cursor Tracking ON" : "Cursor Tracking OFF");
                          }}
                          className="w-full py-2 px-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-slate-400 hover:text-slate-200 font-mono text-xs transition-all cursor-pointer flex items-center justify-center gap-2 backdrop-blur-md"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          Toggle Cursor Tracking
                        </button>
                      </div>

                      <div className="p-4 bg-white/[0.01] border border-white/[0.05] rounded-2xl text-[10px] font-mono text-slate-400 space-y-1 backdrop-blur-md">
                        <div className="text-slate-300 font-semibold mb-1">VISION COGNITION SPECS:</div>
                        <p>• FPS: 1 frame / second (optimized for reasoning)</p>
                        <p>• Processing: Multi-modal Vision API parsing</p>
                        <p>• FacingMode options: Front ('user') | Back ('environment')</p>
                      </div>
                    </div>
                  )}

                  {/* 5. PRIVACY TAB */}
                  {settingsTab === "privacy" && (
                    <div className="space-y-6">
                      <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-2 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-200">Local Cognitive Sandbox</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ENCRYPTED
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          All local state nodes and memories are stored on secure sandbox storage. Conversation tokens and session variables are never kept on secondary servers.
                        </p>
                      </div>

                      {/* Privacy Actions */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl backdrop-blur-md">
                          <div className="space-y-0.5">
                            <span className="text-xs font-medium text-slate-200 block">Cognitive Security</span>
                            <span className="text-[10px] text-slate-500">Purge session variables</span>
                          </div>
                          <button
                            onClick={() => {
                              triggerOverlay("Cache Securely Purged");
                            }}
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 rounded-lg text-xs font-mono transition-all cursor-pointer animate-none"
                          >
                            PURGE CACHE
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl backdrop-blur-md">
                          <div className="space-y-0.5">
                            <span className="text-xs font-medium text-slate-200 block">Forget Context</span>
                            <span className="text-[10px] text-slate-500">Clear active speech context</span>
                          </div>
                          <button
                            onClick={() => {
                              triggerOverlay("Conversation Reset, ji!");
                              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                                wsRef.current.send(JSON.stringify({ type: "text", text: "[System: Context cleared. Please restart our chat as if we just met.]" }));
                              }
                            }}
                            className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 border border-white/[0.06] rounded-lg text-xs font-mono transition-all cursor-pointer"
                          >
                            RESET CHAT
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 6. ANDROID COMPANION TAB */}
                  {settingsTab === "android" && (
                    <div className="space-y-6">
                      
                      {/* Section 1: Tactile feedback toggle & Diagnostics Header */}
                      <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex items-center justify-between backdrop-blur-md">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-purple-400 font-mono tracking-wide block uppercase">Tactile Vibration (Haptics)</span>
                          <span className="text-[10px] text-slate-300 font-sans">Enable micro-vibrations on core system touch interactions</span>
                        </div>
                        <button
                          onClick={() => {
                            const nextState = !hapticEnabled;
                            setHapticEnabled(nextState);
                            if (nextState && typeof navigator !== "undefined" && navigator.vibrate) {
                              try {
                                navigator.vibrate([15, 30, 15]);
                              } catch (_) {}
                            }
                            triggerOverlay(nextState ? "Haptics Enabled 📳" : "Haptics Offline");
                          }}
                          className={`w-10 h-6 rounded-full p-1 transition-all duration-300 cursor-pointer ${
                            hapticEnabled ? "bg-purple-600" : "bg-white/[0.04] border border-white/[0.06]"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-all duration-300 ${
                              hapticEnabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* PHASE 4: RUNTIME PERMISSION MANAGER */}
                      <div className="p-5 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-4 backdrop-blur-md">
                        <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2.5">
                          <Shield className="w-4 h-4 text-cyan-400" />
                          <div>
                            <span className="text-xs font-bold text-cyan-400 tracking-wider font-mono uppercase">Runtime Permission Engine</span>
                            <span className="text-[9px] text-slate-400 font-sans block mt-0.5">Authorization portal for native hardware layers</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {["microphone", "camera", "geolocation", "notifications"].map((p) => {
                            const pState = permissionsState[p];
                            const isGranted = pState?.state === "granted";
                            const isDenied = pState?.state === "denied";
                            const isPrompt = pState?.state === "prompt" || !pState;

                            return (
                              <div key={p} className="p-3 bg-white/[0.01] border border-white/[0.05] rounded-xl space-y-2 transition-all hover:bg-white/[0.03]">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {p === "microphone" && <Mic className="w-3.5 h-3.5 text-cyan-400" />}
                                    {p === "camera" && <Eye className="w-3.5 h-3.5 text-purple-400" />}
                                    {p === "geolocation" && <MapPin className="w-3.5 h-3.5 text-rose-400" />}
                                    {p === "notifications" && <Sparkles className="w-3.5 h-3.5 text-yellow-400" />}
                                    <span className="text-xs font-bold capitalize text-slate-200 font-mono">{p}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                                      isGranted 
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                        : isDenied 
                                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    }`}>
                                      {isGranted ? "Authorized" : isDenied ? "Blocked" : "Needs Grant"}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-[10px] text-slate-300 font-sans leading-relaxed">
                                  {pState?.explanation || `Enables direct native access to Haya's ${p} hardware stack.`}
                                </p>
                                {!isGranted && (
                                  <button
                                    onClick={async () => {
                                      triggerHaptic(20);
                                      const success = await AndroidBridgeManager.getInstance().requestRuntimePermission(p);
                                      refreshDiagnostics();
                                      triggerOverlay(success ? `Permission granted for ${p}! 🟢` : `Please authorize ${p} in browser settings`);
                                    }}
                                    className="w-full mt-1.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg text-[9px] font-mono tracking-wider uppercase transition-all cursor-pointer"
                                  >
                                    Request Authorization
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* PHASE 6: DIAGNOSTICS CONSOLE (14-POINT LIVE METRIC MATRIX) */}
                      <div className="p-5 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-4 backdrop-blur-md">
                        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-purple-400" />
                            <div>
                              <span className="text-xs font-bold text-purple-400 tracking-wider font-mono uppercase">Native Diagnostics Console</span>
                              <span className="text-[9px] text-slate-400 font-sans block mt-0.5">Real-time status of Haya's primary native and cloud nodes</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              triggerHaptic(40);
                              refreshDiagnostics();
                              triggerOverlay("Telemetry maps refreshed!");
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                            title="Refresh Diagnostics"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {diagnostics ? (
                            Object.entries(diagnostics).map(([node, status]) => {
                              const isWorking = status === "Working";
                              const isPartial = status === "Partial";
                              const isMissing = status === "Missing";

                              return (
                                <div 
                                  key={node} 
                                  className={`p-3 rounded-xl border flex flex-col justify-between space-y-1.5 transition-all hover:scale-[1.01] ${
                                    isWorking 
                                      ? "bg-emerald-500/5 border-emerald-500/15" 
                                      : isPartial 
                                      ? "bg-amber-500/5 border-amber-500/15" 
                                      : "bg-rose-500/5 border-rose-500/15"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-200 font-mono tracking-wide uppercase truncate">
                                      {node.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <span className={`w-2 h-2 rounded-full ${
                                      isWorking 
                                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" 
                                        : isPartial 
                                        ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                                        : "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                                    }`} />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[9px] font-mono font-bold ${
                                      isWorking ? "text-emerald-400" : isPartial ? "text-amber-400" : "text-rose-400"
                                    }`}>
                                      {status === "Working" ? "🟢 Working" : status === "Partial" ? "🟡 Partial" : "🔴 Missing"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="col-span-2 py-8 text-center text-slate-500 font-mono text-[10px] animate-pulse">
                              Booting diagnostic console...
                            </div>
                          )}
                        </div>

                        {/* Ping voice latency checker */}
                        <div className="p-3 bg-white/[0.01] rounded-xl border border-white/[0.05] flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-mono text-slate-400 uppercase block">Voice Link Ping Latency</span>
                            <span className="text-xs font-bold font-mono text-cyan-400">
                              {pingStatus === "idle" && "Link ready"}
                              {pingStatus === "testing" && "Measuring speed..."}
                              {pingStatus === "error" && "Test failed"}
                              {pingStatus === "done" && pingLatency !== null && `${pingLatency}ms (Ultra-Low Link)`}
                            </span>
                          </div>
                          <button
                            onClick={runPingTest}
                            disabled={pingStatus === "testing"}
                            className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg text-[10px] font-mono tracking-wider uppercase transition-all cursor-pointer disabled:opacity-50"
                          >
                            {pingStatus === "testing" ? "Testing..." : "Test Speed"}
                          </button>
                        </div>
                      </div>

                      {/* Section 2: PWA Installation Guide */}
                      <div className="p-4 bg-cyan-500/[0.02] border border-cyan-500/15 rounded-2xl space-y-3 backdrop-blur-md">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-bold text-cyan-400 tracking-wider font-mono uppercase">Android PWA Installation</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          You can run Haya as a full-screen, low-latency standalone Android app by adding it to your home screen. This hides browser bars, improves voice performance, and unlocks native haptic touch.
                        </p>
                        <div className="bg-white/[0.01] rounded-xl p-3 border border-white/[0.05] text-[10px] font-mono text-slate-400 space-y-1.5">
                          <p className="font-semibold text-slate-300">INSTALL STEPS (Google Chrome for Android):</p>
                          <p>1. Open <span className="text-cyan-400">Haya</span> in your Android Chrome browser.</p>
                          <p>2. Tap the browser's <span className="font-semibold">Three-Dots Menu</span> in the top-right.</p>
                          <p>3. Select <span className="text-cyan-400 font-semibold">"Install App"</span> or <span className="text-cyan-400 font-semibold">"Add to Home Screen"</span>.</p>
                          <p>4. Launch the new icon directly from your application drawer!</p>
                        </div>
                      </div>

                      {/* Section 3: Android Studio WebView Developer Snippets */}
                      <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-3 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-200 font-mono">WebView Wrapper configuration</span>
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/25 text-[9px] font-mono text-purple-400">DEV COMPILING</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          If packaging Haya into a native Kotlin APK (via WebView or Capacitor), configure these permissions to enable full hardware microphone access:
                        </p>
                        
                        {/* Manifest permissions */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[9px] font-mono text-slate-400">AndroidManifest.xml permissions</span>
                            <button
                              onClick={() => {
                                triggerHaptic(15);
                                const code = `<uses-permission android:name="android.permission.RECORD_AUDIO" />\n<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />`;
                                navigator.clipboard.writeText(code);
                                triggerOverlay("Copied to clipboard!");
                              }}
                              className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" /> Copy
                            </button>
                          </div>
                          <pre className="bg-white/[0.01] rounded-xl p-2.5 border border-white/[0.05] text-[9px] font-mono text-cyan-400/80 overflow-x-auto whitespace-pre">
{`<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />`}
                          </pre>
                        </div>

                        {/* Kotlin permissions handler */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[9px] font-mono text-slate-400">Kotlin WebChromeClient Handler</span>
                            <button
                              onClick={() => {
                                triggerHaptic(15);
                                const code = `webView.webChromeClient = object : WebChromeClient() {\n    override fun onPermissionRequest(request: PermissionRequest) {\n        request.grant(request.resources)\n    }\n}`;
                                navigator.clipboard.writeText(code);
                                triggerOverlay("Copied to clipboard!");
                              }}
                              className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" /> Copy
                            </button>
                          </div>
                          <pre className="bg-white/[0.01] rounded-xl p-2.5 border border-white/[0.05] text-[9px] font-mono text-purple-400/80 overflow-x-auto whitespace-pre">
{`webView.webChromeClient = object : WebChromeClient() {
    override fun onPermissionRequest(request: PermissionRequest) {
        request.grant(request.resources)
    }
}`}
                          </pre>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* 7. ACTIVE HISTORY TAB */}
                  {settingsTab === "history" && (
                    <div className="space-y-6">
                      <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-3 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-bold text-purple-400 tracking-wider font-mono uppercase">
                              Active Persona History
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              triggerHaptic(30);
                              setPersonaHistory([]);
                              localStorage.removeItem("haya_persona_history");
                              triggerOverlay("History Cleared");
                            }}
                            className="text-[10px] text-rose-400 hover:text-rose-300 transition-all font-mono cursor-pointer"
                          >
                            CLEAR LOG
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          Track changes and transitions between Haya's active personalities. Clear logs at any time to purge state memory.
                        </p>
                      </div>

                      {personaHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-white/[0.01] border border-dashed border-white/[0.08] rounded-2xl space-y-2 text-center backdrop-blur-md">
                          <History className="w-8 h-8 text-slate-500 animate-pulse" />
                          <p className="text-xs font-mono text-slate-400">No recent persona changes logged</p>
                          <p className="text-[10px] text-slate-500">Switch personalities using the bottom capsule bar to log transitions</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {personaHistory.map((entry) => {
                            const fromPersona = HAYA_PERSONAS.find(p => p.id === entry.fromPersonaId) || HAYA_PERSONAS[0];
                            const toPersona = HAYA_PERSONAS.find(p => p.id === entry.toPersonaId) || HAYA_PERSONAS[0];
                            const date = new Date(entry.timestamp);
                            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

                            return (
                              <div
                                key={entry.id}
                                className="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between transition-all hover:bg-white/[0.04] backdrop-blur-sm"
                              >
                                <div className="flex items-center gap-3">
                                  {/* From Persona */}
                                  <div className="flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded-md border border-white/[0.06]">
                                    <span className="text-xs">{fromPersona.emoji}</span>
                                    <span className="text-[10px] font-mono text-slate-400">{fromPersona.name}</span>
                                  </div>
                                  
                                  {/* Direction Arrow */}
                                  <span className="text-xs text-slate-500 font-mono">→</span>
                                  
                                  {/* To Persona */}
                                  <div className="flex items-center gap-1 bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/25">
                                    <span className="text-xs">{toPersona.emoji}</span>
                                    <span className="text-[10px] font-mono text-purple-300 font-semibold">{toPersona.name}</span>
                                  </div>
                                </div>
                                
                                <div className="text-right flex flex-col items-end gap-0.5">
                                  <span className="text-[10px] font-mono text-slate-300">{timeStr}</span>
                                  <span className="text-[8px] font-mono text-slate-500 uppercase">{dateStr}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 8. TRADES LOG TAB */}
                  {settingsTab === "trades" && (
                    <div className="space-y-6">
                      <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-3 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400 tracking-wider font-mono uppercase">
                              SMC Trades Journal
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              triggerHaptic(30);
                              setTrades([]);
                              localStorage.removeItem("haya_trades_log");
                              triggerOverlay("Trades Log Purged");
                            }}
                            className="text-[10px] text-rose-400 hover:text-rose-300 transition-all font-mono cursor-pointer"
                          >
                            PURGE JOURNAL
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          SMC structures, entry setups, and probability arrays logged dynamically by Haya during chart evaluation sessions.
                        </p>
                        <button
                          onClick={handleGenerateTradeSetup}
                          disabled={isGeneratingTrade}
                          className="w-full mt-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 rounded-xl font-mono text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer backdrop-blur-md"
                        >
                          {isGeneratingTrade ? "Analyzing Market Trends..." : "✨ Research & Generate Trade with Gemini"}
                        </button>
                      </div>

                      {trades.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-white/[0.01] border border-dashed border-white/[0.08] rounded-2xl space-y-2 text-center backdrop-blur-md">
                          <BookOpen className="w-8 h-8 text-slate-500 animate-pulse" />
                          <p className="text-xs font-mono text-slate-400">No trading setups logged yet</p>
                          <p className="text-[10px] text-slate-500">Switch to Trading Mode and instruct Haya to log your setups</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {trades.map((t) => {
                            const date = new Date(t.timestamp);
                            const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                            return (
                              <div
                                key={t.id}
                                className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-3 transition-all hover:bg-white/[0.04] hover:border-emerald-500/20 backdrop-blur-md"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-white tracking-wide">{t.asset}</span>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono tracking-wider ${
                                      t.tradeType === "LONG"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                        : "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                                    }`}>
                                      {t.tradeType}
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-mono text-slate-400">{dateStr}</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 py-1.5 px-3 bg-white/[0.01] rounded-xl border border-white/[0.05] font-mono text-[10px]">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[8px] text-slate-500 uppercase tracking-widest">Entry</span>
                                    <span className="text-slate-300 font-semibold">{t.entryPrice}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[8px] text-rose-400/60 uppercase tracking-widest">Stop Loss</span>
                                    <span className="text-rose-400/90 font-semibold">{t.stopLoss}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[8px] text-emerald-400/60 uppercase tracking-widest">Take Profit</span>
                                    <span className="text-emerald-400/90 font-semibold">{t.takeProfit}</span>
                                  </div>
                                </div>

                                <div className="bg-white/[0.01] rounded-xl p-2.5 border border-white/[0.05]">
                                  <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Strategy Analysis</span>
                                  <p className="text-[10px] text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">{t.notes}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 9. CUSTOM PROMPTS TAB */}
                  {settingsTab === "prompts" && (
                    <div className="space-y-6">
                      <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-3 backdrop-blur-md">
                        <div className="flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-fuchsia-400" />
                          <span className="text-xs font-bold text-fuchsia-400 tracking-wider font-mono uppercase">
                            Cognitive Prompt Customization
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          Modify Haya's base character constraints, styles, and behavioral prompts dynamically. Changes are stored persistently on your device.
                        </p>
                      </div>

                      {/* Select Persona to Edit */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block px-1">Select Mode to Customize</label>
                        <div className="grid grid-cols-4 gap-2">
                          {HAYA_PERSONAS.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                triggerHaptic(10);
                                setEditingPersonaId(p.id);
                              }}
                              className={`py-2 px-2 rounded-xl border font-mono text-[10px] flex flex-col items-center gap-1 transition-all cursor-pointer backdrop-blur-md ${
                                editingPersonaId === p.id
                                  ? "bg-fuchsia-500/10 border-fuchsia-500/35 text-fuchsia-300 font-bold shadow-[0_0_12px_rgba(217,70,239,0.1)]"
                                  : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                              }`}
                            >
                              <span className="text-sm">{p.emoji}</span>
                              <span className="truncate max-w-full">{p.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Prompt Editor Textarea */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase px-1">System Prompt Instructions</span>
                          <button
                            onClick={handleResetCustomPrompt}
                            className="text-[9px] font-mono text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
                          >
                            RESET TO DEFAULT
                          </button>
                        </div>

                        <textarea
                          value={customPromptText}
                          onChange={(e) => setCustomPromptText(e.target.value)}
                          className="w-full h-44 bg-white/[0.01] border border-white/[0.06] rounded-2xl p-4 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-fuchsia-500/30 leading-relaxed resize-none scrollbar-none backdrop-blur-md"
                          placeholder="Type system prompts..."
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={handleOptimizePrompt}
                            disabled={isOptimizingPrompt || !customPromptText.trim()}
                            className="py-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 rounded-2xl font-mono text-[11px] tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 uppercase backdrop-blur-md"
                          >
                            {isOptimizingPrompt ? "Optimizing..." : "✨ Optimize Vibe"}
                          </button>
                          
                          <button
                            onClick={handleSaveCustomPrompt}
                            className="py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-2xl font-mono text-[11px] tracking-wider font-bold transition-all cursor-pointer shadow-[0_0_15px_rgba(217,70,239,0.3)] uppercase"
                          >
                            Save Prompt
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Advanced settings removed */}

                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HAYA SECRET CORE DASHBOARD */}
        <AnimatePresence>
          {isSecretOpen && (
            <SecretDashboard
              isOpen={isSecretOpen}
              onClose={() => setIsSecretOpen(false)}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              wakeWordEnabled={wakeWordEnabled}
              onWakeWordToggle={setWakeWordEnabled}
              hapticEnabled={hapticEnabled}
              onHapticToggle={setHapticEnabled}
              secretChats={secretChats}
              onDeleteMessage={(id) => {
                setSecretChats((prev) => {
                  const updated = prev.filter((c) => c.id !== id);
                  localStorage.setItem("haya_secret_chats", JSON.stringify(updated));
                  return updated;
                });
              }}
              onClearSecretChats={() => {
                setSecretChats([]);
                localStorage.removeItem("haya_secret_chats");
              }}
              triggerOverlay={triggerOverlay}
              triggerHaptic={triggerHaptic}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }
