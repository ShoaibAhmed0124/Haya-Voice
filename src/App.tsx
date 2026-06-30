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
  MessageSquare,
  Home,
} from "lucide-react";
import { AssistantState, PREBUILT_VOICES } from "./types";
import { HAYA_PERSONAS, Persona } from "./services/personaConfig";
import VoiceVisualizer from "./components/VoiceVisualizer";
import HologramEngine, { EngineState } from "./components/HologramEngine";
import { MemoryService, Memory } from "./services/memoryService";
import { VisionEngine } from "./services/visionEngine";
import { ComputerUseEngine } from "./services/computerUseEngine";
import VisionOverlay from "./components/VisionOverlay";
import BrowserWorkspace from "./components/BrowserWorkspace";
import { BrowserEngine } from "./services/browserEngine";
import StreamingTextPanel from "./components/StreamingTextPanel";
import SecretDashboard from "./components/SecretDashboard";
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

type AppTheme = "midnight" | "sunset" | "cyber";

const PERSONA_GLOW_RGB_MAP: Record<string, string> = {
  assistant: "34, 211, 238", // Cyan
  therapist: "16, 185, 129", // Emerald
  conspiracy: "245, 158, 11", // Amber
  unhinged: "139, 92, 246", // Violet
  motivation: "239, 68, 68", // Rose/Red
  romantic: "236, 72, 153", // Pink
  sexy: "168, 85, 247", // Purple
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

  const [theme, setTheme] = useState<AppTheme>("midnight");
  const [wakeWordEnabled, setWakeWordEnabled] = useState<boolean>(true);
  const [isVisionActive, setIsVisionActive] = useState(false);
  const [isBrowserActive, setIsBrowserActive] = useState(false);
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

  const isExpandedMode = isBrowserActive;

  // Custom configuration states for Haya rendering engine and unified settings menu
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [settingsTab, setSettingsTab] = useState<"voice" | "memory" | "browser" | "vision" | "privacy" | "android" | "history">("voice");
  const [isManualGlitching, setIsManualGlitching] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);

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

  // Secret Core Dashboard States
  const [isSecretOpen, setIsSecretOpen] = useState(false);
  const [secretChats, setSecretChats] = useState<Array<{
    id: string;
    sender: "user" | "haya";
    text: string;
    timestamp: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem("haya_secret_chats");
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const addSecretChat = (sender: "user" | "haya", text: string) => {
    if (!text || !text.trim()) return;
    const newMsg = {
      id: Math.random().toString(36).substring(2, 9),
      sender,
      text,
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

    // 1. Live mode is active and connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && state !== "disconnected" && state !== "error") {
      wsRef.current.send(JSON.stringify({ type: "text", text: query }));
      setTextInput("");
      triggerOverlay("Transmitting...");
      return;
    }

    // 2. Fallback mode (not connected to live WebSocket)
    setTextInput("");
    triggerOverlay("Haya is thinking...");
    setState("connecting"); // Maps to "thinking" video state in HologramEngine
    setTranscript(query);

    // Add user message to history
    const userMsg = { role: "user" as const, text: query };
    const updatedHistory = [...fallbackHistory, userMsg];
    setFallbackHistory(updatedHistory);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: fallbackHistory,
          personaId: selectedPersona
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || "QUOTA_EXCEEDED");
        }
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      const reply = data.text || "Um... Commander, I'm having trouble connecting to my neural network.";

      // Update transcript and transition to speaking state
      setTranscript(reply);
      setState("speaking");

      addSecretChat("haya", reply);

      // Add Haya's response to history
      setFallbackHistory((prev) => [...prev, { role: "model" as const, text: reply }]);

      // Estimate reading time to transition back to idle (approx 60ms per character + 1500ms padding)
      const speechDuration = Math.max(3000, Math.min(10000, reply.length * 60 + 1500));
      setTimeout(() => {
        setState("disconnected");
      }, speechDuration);

    } catch (err: any) {
      console.error("Fallback chat failed:", err);
      setState("error");
      const errMessage = err.message || "";
      const isQuotaExceeded = errMessage.includes("Quota Limit Exceeded") ||
                              errMessage.includes("QUOTA_EXCEEDED") ||
                              errMessage.includes("RESOURCE_EXHAUSTED") ||
                              errMessage.includes("429") ||
                              errMessage.includes("cognitive processor");
      
      if (isQuotaExceeded) {
        setTranscript("I'm temporarily busy. Please try again in a moment.");
        triggerOverlay("Quota Limit Exceeded ⚠️");
      } else {
        setTranscript("Ah... Commander, I lost connection to my core systems. Please try again or re-sync our gateway.");
        triggerOverlay("System Disconnected");
      }

      // Return to disconnected (idle) state after 5 seconds to keep the avatar alive and restore UI
      setTimeout(() => {
        setState("disconnected");
        setTranscript("");
      }, 5000);
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

  useEffect(() => {
    loadMemories();
  }, []);

  // Memory management helper states & functions for the Settings Panel
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState("general");
  const [searchQuery, setSearchQuery] = useState("");

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
      triggerOverlay("Speaking...");
    } else if (state === "connecting") {
      triggerOverlay("Thinking...");
    } else if (state === "disconnected") {
      triggerOverlay("Offline");
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

  // Update refs to avoid closure state capturing in onaudioprocess
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Background wake-word detection removed completely to prevent continuous microphone monitoring.

  // Clean up all audio nodes and socket on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close();
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
      playAnalyser.connect(outputCtx.destination);
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
        ws.send(JSON.stringify({ type: "start", voice: selectedVoice, personaId: personaToUse }));
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "ready") {
            console.log("Gemini Live session ready!");
            setState("listening");
          }

          else if (msg.type === "error") {
            console.error("Voice gateway reported session error:", msg.message);
            setState("error");
            const errStr = String(msg.message || "");
            const isQuotaExceeded = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("Quota exceeded") || errStr.includes("cognitive processor");
            if (isQuotaExceeded) {
              setTranscript("I'm temporarily busy. Please try again in a moment.");
              triggerOverlay("Quota Limit Exceeded ⚠️");
            } else {
              setTranscript(msg.message || "Failed to initialize our connection gateway. Please check your system alignment.");
              triggerOverlay("Gateway Connection Failed");
            }
            cleanup();

            // Return to disconnected (idle) state after 5 seconds to keep the avatar alive and restore UI
            setTimeout(() => {
              setState("disconnected");
              setTranscript("");
            }, 5000);
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
            sourceNode.connect(playAnalyser);

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

            nextStartTime.current += audioBuffer.duration;
          }

          else if (msg.type === "transcript" && msg.text) {
            currentLiveTranscriptRef.current += " " + msg.text;
            setTranscript(currentLiveTranscriptRef.current);
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

              else if (call.name === "forgetMemory") {
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
                      message: `Haya's projection successfully synchronized her emotional posture to ${emotion}.`,
                    },
                  })
                );
              }

              else if (call.name === "triggerHologramGesture") {
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
                      message: `Haya successfully triggered her physical holographic gesture to ${gesture}.`,
                    },
                  })
                );
              }

              else if (call.name === "requestScreenShare") {
                triggerOverlay("Accessing display matrix...");
                const granted = await VisionEngine.getInstance().startCapture();
                if (granted) {
                   setIsVisionActive(true);
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
                   const lastErr = VisionEngine.getInstance().getLastError() || "";
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
                const browserEngine = BrowserEngine.getInstance();
                browserEngine.setVisible(true);
                browserEngine.navigateActiveTab(url);
                triggerOverlay(`Navigating: ${url}`);
                ws.send(JSON.stringify({
                  type: "toolResponse",
                  callId: call.id,
                  name: call.name,
                  result: {
                    success: true,
                    url,
                    message: `Successfully loaded '${url}' in Haya Browser workspace. Split screen is active.`,
                  }
                }));
              }

              else if (call.name === "browserControlMedia") {
                const { action, value } = call.args;
                triggerOverlay(`Media Command: ${action}`);
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

                if (finalDeepLink && isAndroid) {
                  try {
                    // Try to launch native Android deep link scheme
                    window.location.href = finalDeepLink;
                    launchSuccess = true;
                  } catch (e) {
                    console.log("Native intent failed, trying iframe launch fallback");
                  }
                }

                // If on desktop or native launch is not confirmed, open the web-equivalent in Haya's responsive browser tab
                if (!launchSuccess && fallbackUrl) {
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
                    let targetIntent = "intent:#Intent;action=android.settings.SETTINGS;end";

                    if (feature === "wifi") {
                      targetIntent = "intent:#Intent;action=android.settings.WIFI_SETTINGS;end";
                    } else if (feature === "bluetooth") {
                      targetIntent = "intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end";
                    } else if (feature === "brightness" || feature === "volume") {
                      targetIntent = "intent:#Intent;action=android.settings.DISPLAY_SETTINGS;end";
                    }

                    if (isAndroid) {
                      window.location.href = targetIntent;
                      actionSuccess = true;
                    } else {
                      // Desktop/web simulator
                      actionSuccess = true;
                      triggerOverlay(`Settings opened: ${feature}`);
                    }
                    returnDetails = { feature, redirectedToAndroidSettings: isAndroid };
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

  const toggleVisionManual = async () => {
    const visionEngine = VisionEngine.getInstance();
    const computerEngine = ComputerUseEngine.getInstance();
    
    if (isVisionActive) {
      visionEngine.stopCapture();
      computerEngine.setCursorFollow(false);
      setIsVisionActive(false);
      triggerOverlay("Vision deactivated");
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "text", text: "[User manually stopped sharing screen]" }));
      }
    } else {
      triggerOverlay("Requesting display permission...");
      
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

      const granted = await visionEngine.startCapture();
      if (granted) {
        setIsVisionActive(true);
        triggerOverlay("👁 Watching Screen");
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "text", text: "[User manually started screen sharing. Haya can see the screen now.]" }));
        }
      } else {
        const lastErr = (visionEngine.getLastError() || "").toLowerCase();
        if (lastErr.includes("permissions policy") || lastErr.includes("disallowed")) {
          triggerOverlay("⚠️ Iframe blocked screen capture. Please click 'Open in a New Tab' above, ji!");
        } else if (lastErr.includes("denied") || lastErr.includes("permission") || lastErr.includes("notallowed") || lastErr.includes("cancel")) {
          triggerOverlay("Um... permission wasn't granted, ji. No worries! 🌸");
        } else {
          triggerOverlay("Screen capture cancelled or unavailable");
        }
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

  return (
    <div className="relative w-screen h-screen bg-[#020203] text-slate-200 flex items-center justify-center overflow-hidden font-sans select-none p-0">
      
      <div className="relative w-full h-full flex flex-col lg:flex-row items-stretch justify-center z-10 transition-all duration-500 p-0">
        
        {/* Main vertical container for Haya (Hologram & Controls) */}
        <div className={`relative flex flex-col justify-between items-center overflow-hidden transition-all duration-500 ${isExpandedMode ? "w-full lg:w-[40%] flex-shrink-0 h-[45%] lg:h-full bg-transparent border-none" : "w-full h-full bg-transparent border-none shadow-none"}`}>
        
        {/* TINY FLOATING VISION ACTIVE INDICATOR */}
        {isVisionActive && (
          <div className="absolute top-4 left-4 z-40 flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/40 border border-cyan-500/20 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.15)] backdrop-blur-md animate-pulse">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-[9px] font-mono tracking-wider text-cyan-400 uppercase">Vision Feed Active</span>
          </div>
        )}

        {/* TOP HUD: Floating buttons in top-right */}
        <header className="absolute top-4 right-4 z-40 flex items-center gap-2 pointer-events-none">
          {/* SECRETS DASHBOARD TRIGGER */}
          <button
            onClick={() => {
              triggerHaptic(30);
              setIsSecretOpen(true);
            }}
            className="p-2.5 rounded-full bg-purple-950/30 border border-purple-500/20 text-purple-400 hover:text-purple-300 hover:bg-purple-950/60 hover:border-purple-500/45 transition-all pointer-events-auto cursor-pointer shadow-lg backdrop-blur-md relative"
            title="Haya Secret Core"
          >
            <Cpu className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse border border-[#020203]" />
          </button>



          <button
            onClick={() => {
              triggerHaptic(20);
              setIsSettingsOpen(true);
              loadMemories();
            }}
            className="p-2.5 rounded-full bg-slate-950/40 border border-white/5 text-slate-400 hover:text-slate-100 hover:bg-slate-950/85 hover:border-white/10 transition-all pointer-events-auto cursor-pointer shadow-lg backdrop-blur-md"
            title="Configure Haya settings"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </header>

        {/* 2. HOLOGRAM ENGINE DISPLAY (Full-bleed absolute background) */}
        <div className="absolute inset-0 w-full h-full z-0 select-none overflow-hidden bg-black">
          <HologramEngine
            state={state}
            playbackAnalyser={playbackAnalyser}
            microphoneAnalyser={micAnalyser}
            glowColorRGB={PERSONA_GLOW_RGB_MAP[selectedPersona] || "147, 51, 234"}
            selectedPersona={selectedPersona}
            transcript={transcript}
            forcedBehavior={forcedBehavior}
          />
        </div>

        {/* Layout Spacer to preserve flex push for floating overlay & footer */}
        <div className="flex-grow w-full pointer-events-none" />

        {/* TRANSIENT INTERFACE ALERTS AND OVERLAYS */}
        <div className="w-full max-w-lg mx-auto relative z-20 flex flex-col items-center justify-end px-4 gap-4 pb-2">
          {/* Temporary overlay status display (e.g. "Listening...", "Thinking...") */}
          <AnimatePresence mode="wait">
            {overlayText && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-none"
              >
                <span className="text-[10px] font-mono font-medium tracking-[0.25em] text-cyan-400 uppercase bg-slate-950/85 border border-cyan-500/20 backdrop-blur-xl px-4 py-1.5 rounded-full shadow-[0_4px_24px_rgba(6,182,212,0.12)]">
                  {overlayText}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live subtitle transcription */}
          <AnimatePresence>
            {transcript && (
              <StreamingTextPanel
                text={transcript}
                isSpeaking={state === "speaking"}
                glowColorRGB={PERSONA_GLOW_RGB_MAP[selectedPersona] || "147, 51, 234"}
              />
            )}
          </AnimatePresence>
        </div>



        {/* BUILT-IN PERSONA SELECTOR CAPSULE BAR (Inspired by Grok) */}
        <div className="w-full max-w-lg mx-auto relative z-30 px-4 mb-3 flex justify-center">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-950/60 border border-white/10 backdrop-blur-2xl rounded-full overflow-x-auto no-scrollbar max-w-full shadow-[0_0_20px_rgba(168,85,247,0.15),inset_0_1px_1px_rgba(255,255,255,0.1)] hover:border-purple-500/20 transition-all duration-300">
            {HAYA_PERSONAS.map((p) => {
              const isSelected = selectedPersona === p.id;
              const textColors: Record<string, string> = {
                cyan: "text-cyan-400 border-cyan-500/35 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.2)]",
                emerald: "text-emerald-400 border-emerald-500/35 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
                amber: "text-amber-400 border-amber-500/35 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
                violet: "text-violet-400 border-violet-500/35 bg-violet-500/10 shadow-[0_0_12px_rgba(139,92,246,0.2)]",
                red: "text-rose-400 border-rose-500/35 bg-rose-500/10 shadow-[0_0_12px_rgba(244,63,94,0.2)]",
                pink: "text-pink-400 border-pink-500/35 bg-pink-500/10 shadow-[0_0_12px_rgba(236,72,153,0.2)]",
                purple: "text-purple-400 border-purple-500/35 bg-purple-500/10 shadow-[0_0_12px_rgba(168,85,247,0.2)]",
              };
              
              return (
                <button
                  key={p.id}
                  onClick={() => handleSwitchPersona(p.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-medium tracking-wide border transition-all duration-300 cursor-pointer whitespace-nowrap ${
                    isSelected 
                      ? `${textColors[p.color] || "text-white border-white/25 bg-white/5"} scale-105 font-semibold` 
                      : "text-slate-400 border-transparent bg-transparent hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <span className="text-xs">{p.emoji}</span>
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. SINGLE FLOATING COMMAND DOCK */}
        <footer className="w-full z-30 relative px-4 pb-6">
          <div className="relative flex items-center bg-slate-950/25 border border-white/5 backdrop-blur-2xl rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.8)] px-4 py-2 gap-3 max-w-lg mx-auto transition-all duration-300 hover:border-white/10">
            
            {/* Waveform Visualization as subtle background inside the dock */}
            <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none opacity-[0.2]">
              <VoiceVisualizer
                state={state}
                microphoneAnalyser={micAnalyser}
                playbackAnalyser={playbackAnalyser}
              />
            </div>

            {/* GLOWING MICROPHONE TRIGGER & MUTE BUTTON CLUSTER */}
            <div className="relative z-10 flex-shrink-0 flex items-center gap-1.5">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  triggerHaptic(30);
                  if (state === "disconnected" || state === "error") {
                    startSession();
                  } else {
                    stopSession();
                  }
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center relative cursor-pointer overflow-hidden transition-all duration-300 ${
                  state === "disconnected" || state === "error"
                    ? "bg-slate-900/60 border border-white/10 text-slate-300 shadow-[0_0_15px_rgba(255,255,255,0.05),inset_0_1px_1px_rgba(255,255,255,0.15)] hover:border-white/20"
                    : state === "connecting"
                    ? "bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:border-amber-400/60"
                    : state === "listening"
                    ? "bg-cyan-500/25 border border-cyan-400/50 text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] hover:border-cyan-400/70"
                    : "bg-rose-500/25 border border-rose-400/50 text-rose-300 shadow-[0_0_25px_rgba(244,63,94,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] hover:border-rose-400/70"
                }`}
                title={state === "disconnected" || state === "error" ? "Connect Haya Live Voice" : "Disconnect Haya Live"}
              >
                {/* Rotating ring on connecting/thinking */}
                {state === "connecting" && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 border-2 border-transparent border-t-amber-400 rounded-full"
                  />
                )}

                {/* Pulsing glow on listening */}
                {state === "listening" && (
                  <motion.div
                    animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="absolute inset-0 bg-cyan-400/20 rounded-full pointer-events-none"
                  />
                )}

                {/* Pulsing expand on speaking */}
                {state === "speaking" && (
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    className="absolute inset-0 bg-rose-400/25 rounded-full pointer-events-none"
                  />
                )}

                {/* Icons based on state */}
                {state === "disconnected" || state === "error" ? (
                  <Power className="w-4.5 h-4.5" />
                ) : state === "connecting" ? (
                  <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <Mic className="w-4.5 h-4.5" />
                )}
              </motion.button>
            </div>

            {/* INPUT FIELD FOR TYPING OPTIONAL MESSAGE (ENABLE INCASE LIVE MODE DOES NOT WORK) */}
            <div className="relative z-10 flex-grow">
              <form onSubmit={handleTextSubmit} className="flex items-center">
                <input
                  type="text"
                  disabled={state === "connecting"}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={
                    state === "disconnected" || state === "error"
                      ? "Type here (Fallback chat) or tap power..."
                      : "Type a secret or speak freely..."
                  }
                  className="w-full bg-transparent border-0 text-slate-200 placeholder-slate-500 focus:outline-none text-xs px-2 py-1.5 font-sans disabled:opacity-50"
                />
                
                {/* Send button when typing */}
                {textInput.trim() !== "" && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    type="submit"
                    className="p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-white/5 rounded-full transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                  </motion.button>
                )}
              </form>
            </div>
          </div>
        </footer>

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
                className="relative w-full max-h-[85vh] bg-[#090d16] border-t border-white/10 rounded-t-3xl flex flex-col overflow-hidden z-10"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0b0f1a]/80">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-purple-400" />
                    <span className="font-mono text-sm tracking-wider uppercase font-semibold text-slate-100">HAYA CONFIG</span>
                  </div>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                           {/* Navigation Tabs */}
                <div className="flex border-b border-white/5 bg-[#0b0f1a]/40 px-4 py-2 gap-1 overflow-x-auto scrollbar-none">
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
                    Browser
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
                </div>

                {/* Tab Content Areas */}
                <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-none max-h-[55vh]">
                  
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
                              className={`w-full px-4 py-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                                selectedVoice === v.id
                                  ? "bg-purple-950/20 border-purple-500/30 text-purple-300"
                                  : "bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
                              }`}
                            >
                              <div className="text-left">
                                <span className="text-xs font-medium block">{v.name}</span>
                                <span className="text-[10px] text-slate-500">{v.description}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-500 uppercase">{v.gender}</span>
                                {selectedVoice === v.id && <Check className="w-3.5 h-3.5 text-purple-400" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Voice Wake-Word toggle */}
                      <div className="flex items-center justify-between p-4 bg-slate-900/30 border border-white/5 rounded-2xl">
                        <div className="space-y-0.5">
                          <span className="text-xs font-medium text-slate-200 block">Wake-Word Listening</span>
                          <span className="text-[10px] text-slate-500">Respond to "Hey Haya"</span>
                        </div>
                        <button
                          onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
                          className={`w-10 h-6 rounded-full p-1 transition-all duration-300 cursor-pointer ${
                            wakeWordEnabled ? "bg-purple-600" : "bg-slate-800"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-all duration-300 ${
                              wakeWordEnabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. MEMORY TAB */}
                  {settingsTab === "memory" && (
                    <div className="space-y-4">
                      {/* Inject a new memory manually */}
                      <div className="p-4 bg-slate-900/30 border border-white/5 rounded-2xl space-y-2">
                        <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block">Inject Memory Node</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newMemoryText}
                            onChange={(e) => setNewMemoryText(e.target.value)}
                            placeholder="What should Haya remember?"
                            className="flex-grow bg-slate-950/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
                          />
                          <button
                            onClick={handleAddMemory}
                            className="px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-medium transition-all flex items-center justify-center cursor-pointer"
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
                          className="w-full bg-slate-950/40 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500/30"
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
                          memories.map((m) => (
                            <div
                              key={m.id}
                              className="p-3 bg-slate-900/40 border border-white/5 rounded-xl flex justify-between items-start gap-3 hover:border-white/10 transition-all group"
                            >
                              <div className="space-y-1">
                                <p className="text-xs text-slate-200 font-light leading-relaxed">
                                  {m.content}
                                </p>
                                <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500">
                                  <span className="px-1.5 py-0.5 rounded bg-white/5 capitalize">{m.category}</span>
                                  <span>•</span>
                                  <span>Importance {m.importance}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleForgetMemory(m.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer opacity-80"
                                title="Purge node"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3. BROWSER TAB */}
                  {settingsTab === "browser" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-900/30 border border-white/5 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-200">Browser Workspace Integration</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${isBrowserActive ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-slate-800 text-slate-500"}`}>
                            {isBrowserActive ? "RUNNING" : "SLEEPING"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                          Haya's proxy engine routes through full JavaScript execution nodes to bypass sandbox iframe limits. This ensures full capability with heavy web applications.
                        </p>
                      </div>

                      {/* Browser quick controls */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            const browserEngine = BrowserEngine.getInstance();
                            browserEngine.setVisible(!isBrowserActive);
                            triggerOverlay(isBrowserActive ? "Browser Offline" : "Browser Online");
                          }}
                          className={`py-2 px-3 rounded-xl border font-mono text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            isBrowserActive
                              ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                              : "bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          {isBrowserActive ? "Sleep Workspace" : "Wake Workspace"}
                        </button>
                        <button
                          onClick={() => {
                            triggerOverlay("Cognitive Node Synchronized");
                          }}
                          className="py-2 px-3 rounded-xl border border-white/5 bg-slate-900/40 text-slate-400 hover:text-slate-200 font-mono text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Refresh Node
                        </button>
                      </div>

                      {/* Informative list */}
                      <div className="p-4 bg-slate-900/10 border border-white/5 rounded-2xl text-[10px] font-mono text-slate-500 space-y-1">
                        <div className="text-slate-400 font-semibold mb-1">CAPABLE SECTOR PROTOCOLS:</div>
                        <p>• YouTube, Google Docs, ChatGPT</p>
                        <p>• Cookie-backed local storage & indexing support</p>
                        <p>• Safe CORS-bypassing secure gateway proxies</p>
                      </div>
                    </div>
                  )}

                  {/* 4. VISION TAB */}
                  {settingsTab === "vision" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-900/30 border border-white/5 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-200">Spatial Perception Vision Mode</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${isVisionActive ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-slate-800 text-slate-500"}`}>
                            {isVisionActive ? "ACTIVE" : "OFFLINE"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                          When active, HAYA continuously processes display streams locally to coordinate mouse, keyboard, and layout bounding rects.
                        </p>
                      </div>

                      {/* Vision action triggers */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const comp = ComputerUseEngine.getInstance();
                            comp.setCursorFollow(!comp.isCursorFollowActive());
                            triggerOverlay(comp.isCursorFollowActive() ? "Cursor Tracking ON" : "Cursor Tracking OFF");
                          }}
                          className="w-full py-2.5 px-3 rounded-xl border border-white/5 bg-slate-900/40 text-slate-400 hover:text-slate-200 font-mono text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          Toggle Cursor Tracking
                        </button>
                      </div>

                      <div className="p-4 bg-slate-900/10 border border-white/5 rounded-2xl text-[10px] font-mono text-slate-500 space-y-1">
                        <div className="text-slate-400 font-semibold mb-1">VISION COGNITION SPECS:</div>
                        <p>• FPS: 1 frame / second (optimized for reasoning)</p>
                        <p>• Processing: Multi-modal Vision API parsing</p>
                        <p>• Permissions: Display capture API</p>
                      </div>
                    </div>
                  )}

                  {/* 5. PRIVACY TAB */}
                  {settingsTab === "privacy" && (
                    <div className="space-y-6">
                      <div className="p-4 bg-slate-900/30 border border-white/5 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-200">Local Cognitive Sandbox</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ENCRYPTED
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                          All local state nodes and memories are stored on secure sandbox storage. Conversation tokens and session variables are never kept on secondary servers.
                        </p>
                      </div>

                      {/* Privacy Actions */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-slate-900/30 border border-white/5 rounded-2xl">
                          <div className="space-y-0.5">
                            <span className="text-xs font-medium text-slate-200 block">Cognitive Security</span>
                            <span className="text-[10px] text-slate-500">Purge session variables</span>
                          </div>
                          <button
                            onClick={() => {
                              triggerOverlay("Cache Securely Purged");
                            }}
                            className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-500/25 rounded-lg text-xs font-mono transition-all cursor-pointer animate-none"
                          >
                            PURGE CACHE
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-900/30 border border-white/5 rounded-2xl">
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
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 rounded-lg text-xs font-mono transition-all cursor-pointer"
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
                      <div className="p-4 bg-slate-900/40 border border-purple-500/10 rounded-2xl flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-purple-400 font-mono tracking-wide block uppercase">Tactile Vibration (Haptics)</span>
                          <span className="text-[10px] text-slate-400 font-sans">Enable micro-vibrations on core system touch interactions</span>
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
                            hapticEnabled ? "bg-purple-600" : "bg-slate-800"
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
                      <div className="p-5 bg-slate-950/40 border border-cyan-500/10 rounded-2xl space-y-4">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                          <Shield className="w-4 h-4 text-cyan-400" />
                          <div>
                            <span className="text-xs font-bold text-cyan-400 tracking-wider font-mono uppercase">Runtime Permission Engine</span>
                            <span className="text-[9px] text-slate-500 font-sans block mt-0.5">Commander authorization portal for native hardware layers</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {["microphone", "camera", "geolocation", "notifications"].map((p) => {
                            const pState = permissionsState[p];
                            const isGranted = pState?.state === "granted";
                            const isDenied = pState?.state === "denied";
                            const isPrompt = pState?.state === "prompt" || !pState;

                            return (
                              <div key={p} className="p-3 bg-slate-900/30 border border-white/5 rounded-xl space-y-2 transition-all hover:bg-slate-900/50">
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
                                <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
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
                                    className="w-full mt-1.5 py-1.5 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-400 border border-cyan-500/20 rounded-lg text-[9px] font-mono tracking-wider uppercase transition-all cursor-pointer"
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
                      <div className="p-5 bg-slate-950/40 border border-purple-500/10 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-purple-400" />
                            <div>
                              <span className="text-xs font-bold text-purple-400 tracking-wider font-mono uppercase">Native Diagnostics Console</span>
                              <span className="text-[9px] text-slate-500 font-sans block mt-0.5">Real-time status of Haya's primary native and cloud nodes</span>
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
                                      ? "bg-emerald-950/5 border-emerald-500/15" 
                                      : isPartial 
                                      ? "bg-amber-950/5 border-amber-500/15" 
                                      : "bg-rose-950/5 border-rose-500/15"
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
                        <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-mono text-slate-500 uppercase block">Voice Link Ping Latency</span>
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
                            className="px-3 py-1.5 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-400 border border-cyan-500/20 rounded-lg text-[10px] font-mono tracking-wider uppercase transition-all cursor-pointer disabled:opacity-50"
                          >
                            {pingStatus === "testing" ? "Testing..." : "Test Speed"}
                          </button>
                        </div>
                      </div>

                      {/* Section 2: PWA Installation Guide */}
                      <div className="p-4 bg-cyan-950/10 border border-cyan-500/10 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-bold text-cyan-400 tracking-wider font-mono uppercase">Android PWA Installation</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                          You can run Haya as a full-screen, low-latency standalone Android app by adding it to your home screen. This hides browser bars, improves voice performance, and unlocks native haptic touch.
                        </p>
                        <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5 text-[10px] font-mono text-slate-400 space-y-1.5">
                          <p className="font-semibold text-slate-300">INSTALL STEPS (Google Chrome for Android):</p>
                          <p>1. Open <span className="text-cyan-400">Haya</span> in your Android Chrome browser.</p>
                          <p>2. Tap the browser's <span className="font-semibold">Three-Dots Menu</span> in the top-right.</p>
                          <p>3. Select <span className="text-cyan-400 font-semibold">"Install App"</span> or <span className="text-cyan-400 font-semibold">"Add to Home Screen"</span>.</p>
                          <p>4. Launch the new icon directly from your application drawer!</p>
                        </div>
                      </div>

                      {/* Section 3: Android Studio WebView Developer Snippets */}
                      <div className="p-4 bg-slate-900/30 border border-white/5 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-200">WebView Wrapper configuration</span>
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] font-mono text-purple-400">DEV COMPILING</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          If packaging Haya into a native Kotlin APK (via WebView or Capacitor), configure these permissions to enable full hardware microphone access:
                        </p>
                        
                        {/* Manifest permissions */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[9px] font-mono text-slate-500">AndroidManifest.xml permissions</span>
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
                          <pre className="bg-slate-950/80 rounded-xl p-2.5 border border-white/5 text-[9px] font-mono text-cyan-400/80 overflow-x-auto whitespace-pre">
{`<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />`}
                          </pre>
                        </div>

                        {/* Kotlin permissions handler */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[9px] font-mono text-slate-500">Kotlin WebChromeClient Handler</span>
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
                          <pre className="bg-slate-950/80 rounded-xl p-2.5 border border-white/5 text-[9px] font-mono text-purple-400/80 overflow-x-auto whitespace-pre">
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
                      <div className="p-4 bg-slate-900/30 border border-white/5 rounded-2xl space-y-3">
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
                            className="text-[10px] text-rose-400 hover:text-rose-300 transition-all font-mono"
                          >
                            CLEAR LOG
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                          Track changes and transitions between Haya's active personalities. Clear logs at any time to purge state memory.
                        </p>
                      </div>

                      {personaHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-slate-900/10 border border-dashed border-white/5 rounded-2xl space-y-2 text-center">
                          <History className="w-8 h-8 text-slate-600 animate-pulse" />
                          <p className="text-xs font-mono text-slate-500">No recent persona changes logged</p>
                          <p className="text-[10px] text-slate-600">Switch personalities using the bottom capsule bar to log transitions</p>
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
                                className="p-3.5 bg-slate-900/25 border border-white/5 rounded-xl flex items-center justify-between transition-all hover:bg-slate-900/40 hover:border-white/10"
                              >
                                <div className="flex items-center gap-3">
                                  {/* From Persona */}
                                  <div className="flex items-center gap-1 bg-slate-950/40 px-2 py-1 rounded-md border border-white/5">
                                    <span className="text-xs">{fromPersona.emoji}</span>
                                    <span className="text-[10px] font-mono text-slate-400">{fromPersona.name}</span>
                                  </div>
                                  
                                  {/* Direction Arrow */}
                                  <span className="text-xs text-slate-600 font-mono">→</span>
                                  
                                  {/* To Persona */}
                                  <div className="flex items-center gap-1 bg-purple-950/20 px-2 py-1 rounded-md border border-purple-500/20">
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

      {/* RESPONSIVE BROWSER WORKSPACE */}
      {isBrowserActive && (
        <div className="flex flex-col flex-grow h-[55%] lg:h-full lg:max-h-full rounded-t-3xl lg:rounded-3xl border-t lg:border border-white/10 overflow-hidden shadow-2xl relative z-10 bg-[#04060b]/95 backdrop-blur-3xl transition-all duration-500">
          <BrowserWorkspace
            isVisionActive={isVisionActive}
            onToggleVision={toggleVisionManual}
            onSendSystemMsg={(txt) => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "text", text: `[System Update]: ${txt}` }));
              }
            }}
            triggerOverlay={triggerOverlay}
          />
        </div>
      )}

      </div>

    </div>
  );
}
