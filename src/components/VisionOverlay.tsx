import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Eye,
  Cpu,
  Terminal,
  MousePointer,
  Maximize2,
  List,
  Sparkles,
  Layers,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Play,
  PlayCircle
} from "lucide-react";
import { VisionEngine } from "../services/visionEngine";
import { ComputerUseEngine, ComputerAction, ActionStep } from "../services/computerUseEngine";

interface VisionOverlayProps {
  wsActive: boolean;
  onSendSystemMsg: (text: string) => void;
  triggerOverlay: (text: string) => void;
}

export default function VisionOverlay({ wsActive, onSendSystemMsg, triggerOverlay }: VisionOverlayProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<ActionStep>("idle");
  const [activeAction, setActiveAction] = useState<ComputerAction | null>(null);
  const [history, setHistory] = useState<ComputerAction[]>([]);
  const [cursorFollow, setCursorFollow] = useState(false);
  const [userCursor, setUserCursor] = useState({ x: 50, y: 50 });
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  // Simulation parameters for Haya's AI Cursor
  const [aiCursorPos, setAiCursorPos] = useState({ x: 50, y: 50 });
  const [isAiCursorVisible, setIsAiCursorVisible] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  // Log outputs
  const [logs, setLogs] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visionEngine = VisionEngine.getInstance();
  const computerEngine = ComputerUseEngine.getInstance();

  // Reload states when engines update
  useEffect(() => {
    const handleStateChange = () => {
      setIsActive(visionEngine.isActive());
      setCurrentStep(computerEngine.getCurrentStep());
      setActiveAction(computerEngine.getActiveAction());
      setHistory(computerEngine.getHistory());
      setCursorFollow(computerEngine.isCursorFollowActive());
      setUserCursor(computerEngine.getLastKnownUserCursor());
    };

    // Register listeners
    computerEngine.registerStateListener(handleStateChange);
    
    // Register mouse simulation triggers
    computerEngine.registerMouseTrigger((action) => {
      animateAiCursor(action);
    });

    handleStateChange();

    return () => {
      // Cleanup is handled internally by engines
    };
  }, []);

  // Update stream preview source
  useEffect(() => {
    if (isActive && videoRef.current) {
      // Grab stream from Vision Engine static reference
      const stream = (visionEngine as any).stream;
      if (stream) {
        videoRef.current.srcObject = stream;
        setVideoStream(stream);
      }
    } else {
      setVideoStream(null);
    }
  }, [isActive]);

  // Generate sci-fi system logs based on current action steps
  useEffect(() => {
    if (currentStep === "idle") return;

    let newLog = "";
    const timestamp = new Date().toLocaleTimeString().split(" ")[0];

    switch (currentStep) {
      case "observing":
        newLog = `[${timestamp}] 👁 [OBSERVE] Capturing desktop context... Parsing frames (FPS: 1)`;
        break;
      case "understanding":
        newLog = `[${timestamp}] 🧠 [UNDERSTAND] Analyzing spatial layouts, detecting elements...`;
        if (activeAction) {
          newLog += ` Identified target: "${activeAction.target}"`;
        }
        break;
      case "planning":
        newLog = `[${timestamp}] 🗺 [PLAN] Mapping visual bounding rects. Formulating movement vector...`;
        break;
      case "explaining":
        newLog = `[${timestamp}] 💬 [EXPLAIN] Informing user of planned interaction.`;
        break;
      case "executing":
        if (activeAction) {
          newLog = `[${timestamp}] 🎯 [EXECUTE] Dispatched simulated cursor to coordinate (${activeAction.x}%, ${activeAction.y}%) for action: ${activeAction.type.toUpperCase()}`;
        }
        break;
      case "verifying":
        newLog = `[${timestamp}] 🔬 [VERIFY] Comparing pre- and post-interaction hashes. Confirming UI state...`;
        break;
      case "completed":
        newLog = `[${timestamp}] ✨ [REPORT] Transaction completed successfully. State normalized.`;
        break;
    }

    setLogs((prev) => [newLog, ...prev].slice(0, 15));
  }, [currentStep, activeAction]);

  // Handle Haya's AI Cursor path animations
  const animateAiCursor = async (action: ComputerAction) => {
    setIsAiCursorVisible(true);
    
    // Smooth transition from previous position
    const steps = 30;
    const startX = aiCursorPos.x;
    const startY = aiCursorPos.y;
    const endX = action.x;
    const endY = action.y;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      // Ease in-out quadratic
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      
      setAiCursorPos({
        x: startX + (endX - startX) * ease,
        y: startY + (endY - startY) * ease
      });
      await new Promise((r) => setTimeout(r, 20));
    }

    // Trigger click effect
    if (action.type.includes("click")) {
      setIsClicking(true);
      await new Promise((r) => setTimeout(r, 400));
      setIsClicking(false);
    }

    // Keep visible for a brief moment then hide
    await new Promise((r) => setTimeout(r, 1000));
    setIsAiCursorVisible(false);
  };

  // Toggle Screen Capture manual trigger
  const toggleVision = async () => {
    if (isActive) {
      visionEngine.stopCapture();
      computerEngine.setCursorFollow(false);
      setIsActive(false);
      triggerOverlay("Vision deactivated");
      onSendSystemMsg("I have stopped sharing my screen.");
    } else {
      triggerOverlay("Requesting display permission...");
      
      // Setup frame grab callback
      visionEngine.onFrameCaptured = (base64) => {
        // Find if WS is open and forward
        const ws = (window as any).hayaWs; // Hook to main WS
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "video", video: base64 }));
        }
      };

      visionEngine.onStreamStopped = () => {
        setIsActive(false);
        computerEngine.setCursorFollow(false);
        triggerOverlay("Vision deactivated");
      };

      visionEngine.onCursorMoved = (coords) => {
        computerEngine.updateUserCursor(coords);
      };

      const granted = await visionEngine.startCapture();
      if (granted) {
        setIsActive(true);
        triggerOverlay("Vision Enabled");
        onSendSystemMsg("I am looking at your screen now. Let me know how I can guide you!");
      } else {
        const lastErr = visionEngine.getLastError() || "";
        if (lastErr.includes("permissions policy") || lastErr.includes("disallowed")) {
          triggerOverlay("⚠️ Screen share blocked by Iframe policy. Open HAYA in a New Tab to allow!");
          onSendSystemMsg("⚠️ System: The browser's iframe security policy has blocked native screen sharing. Please click the 'Open in New Tab' button in the top right of the application to run Haya in full page context, or use my built-in Browser Workspace to browse!");
        } else {
          triggerOverlay("Capture permission denied");
        }
      }
    }
  };

  // Run a fully self-contained demo scenario to showcase HAYA's visual autonomy and Computer Use
  const runSimulationDemo = async () => {
    if (!isActive) {
      triggerOverlay("Activate Vision first!");
      return;
    }
    
    triggerOverlay("Starting workflow...");
    
    // Simulate Click on VS Code terminal to compile
    await computerEngine.executeAction({
      type: "click",
      target: "the Run Button in the upper-right corner of VS Code",
      x: 88,
      y: 12,
    });

    await new Promise((r) => setTimeout(r, 1000));

    // Simulate Typing npm command
    await computerEngine.executeAction({
      type: "type_text",
      target: "VS Code compiler terminal input box",
      x: 45,
      y: 85,
      text: "npm run lint",
    });

    await new Promise((r) => setTimeout(r, 800));

    // Simulate mouse highlight on success checkmark
    await computerEngine.executeAction({
      type: "move_mouse",
      target: "the green 'Linting completed successfully' checkmark",
      x: 35,
      y: 92,
    });
  };

  const getStepColor = (step: ActionStep) => {
    switch (step) {
      case "observing": return "text-cyan-400 border-cyan-500/30 bg-cyan-500/5";
      case "understanding": return "text-purple-400 border-purple-500/30 bg-purple-500/5";
      case "planning": return "text-pink-400 border-pink-500/30 bg-pink-500/5";
      case "explaining": return "text-yellow-400 border-yellow-500/30 bg-yellow-500/5";
      case "executing": return "text-rose-400 border-rose-500/30 bg-rose-500/5";
      case "verifying": return "text-teal-400 border-teal-500/30 bg-teal-500/5";
      case "completed": return "text-green-400 border-green-500/30 bg-green-500/5";
      default: return "text-slate-500 border-white/5 bg-transparent";
    }
  };

  return (
    <div className="w-full h-full flex flex-col xl:grid xl:grid-cols-12 gap-5 p-4 bg-[#050811]/90 backdrop-blur-3xl overflow-y-auto">
      
      {/* COLUMN 1: LIVE VISION VIEWER HUD (Cols 1-8) */}
      <div className="xl:col-span-8 flex flex-col gap-4">
        {/* VIEWPORT CONTROLLER CARD */}
        <div className="relative rounded-2xl border border-white/10 bg-[#090e18]/85 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex-grow flex flex-col min-h-[350px]">
          {/* Header toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-950/40 select-none z-20">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isActive ? "bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]" : "bg-slate-500"}`} />
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase font-bold text-slate-300">
                HAYA_VISION_HUD_VIEWPORT
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                {isActive ? "1080p @ 1 FPS" : "DISCONNECTED"}
              </span>
              <button
                onClick={toggleVision}
                className={`px-3 py-1 rounded-lg border font-mono text-[10px] uppercase cursor-pointer transition-all duration-300 ${
                  isActive
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                    : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                }`}
              >
                {isActive ? "Kill Feed" : "Stream Screen"}
              </button>
            </div>
          </div>

          {/* VIEWPORT GRAPHIC STAGE */}
          <div className="relative flex-grow flex items-center justify-center bg-black overflow-hidden select-none">
            {isActive && videoStream ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Real Stream Video Element */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain opacity-80"
                />

                {/* Simulated Computer Vision Elements Bounding Boxes (OCR / AI Detection boxes) */}
                <div className="absolute inset-0 pointer-events-none z-10">
                  {/* Bounding Box A: Code Editor bounds */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: [0.3, 0.45, 0.3] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="absolute border border-cyan-500/40 bg-cyan-500/5 rounded-lg"
                    style={{ left: "15%", top: "8%", width: "55%", height: "65%" }}
                  >
                    <span className="absolute top-1 left-1.5 font-mono text-[8px] text-cyan-400 bg-slate-950/80 px-1 py-0.5 rounded border border-cyan-500/20">
                      VS_CODE_EDITOR (94% CONF)
                    </span>
                  </motion.div>

                  {/* Bounding Box B: Compiler Terminal bounds */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: [0.2, 0.35, 0.2] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 1 }}
                    className="absolute border border-pink-500/40 bg-pink-500/5 rounded-lg"
                    style={{ left: "15%", top: "75%", width: "55%", height: "20%" }}
                  >
                    <span className="absolute top-1 left-1.5 font-mono text-[8px] text-pink-400 bg-slate-950/80 px-1 py-0.5 rounded border border-pink-500/20">
                      INTEGRATED_TERMINAL (89% CONF)
                    </span>
                  </motion.div>

                  {/* Bounding Box C: Active Tab / Browser layout */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.15, 0.3, 0.15] }}
                    transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                    className="absolute border border-purple-500/30 bg-purple-500/5 rounded-lg"
                    style={{ left: "72%", top: "8%", width: "26%", height: "87%" }}
                  >
                    <span className="absolute top-1 left-1.5 font-mono text-[8px] text-purple-400 bg-slate-950/80 px-1 py-0.5 rounded border border-purple-500/20">
                      APPLET_PREVIEW (81% CONF)
                    </span>
                  </motion.div>

                  {/* AI Pointer Action Cursor Highlight Overlay */}
                  <AnimatePresence>
                    {isAiCursorVisible && (
                      <motion.div
                        className="absolute z-50 pointer-events-none"
                        style={{ left: `${aiCursorPos.x}%`, top: `${aiCursorPos.y}%` }}
                        initial={{ scale: 2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        {/* Interactive concentric radar ripples during click simulations */}
                        {isClicking && (
                          <div className="absolute -inset-8 flex items-center justify-center">
                            <motion.div
                              initial={{ scale: 0.1, opacity: 0.8 }}
                              animate={{ scale: 1.5, opacity: 0 }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                              className="w-16 h-16 rounded-full border border-pink-500 bg-pink-500/15"
                            />
                            <motion.div
                              initial={{ scale: 0.1, opacity: 1 }}
                              animate={{ scale: 1.2, opacity: 0 }}
                              transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
                              className="absolute w-16 h-16 rounded-full border border-cyan-400"
                            />
                          </div>
                        )}

                        {/* High-visibility glowing pink cursor */}
                        <div className="relative">
                          <MousePointer className="w-6 h-6 text-pink-500 filter drop-shadow-[0_0_8px_rgba(236,72,153,0.8)] fill-pink-500 transform -rotate-12" />
                          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping" />
                          <span className="absolute left-6 top-1 px-1.5 py-0.5 rounded bg-pink-600 border border-pink-400 text-[8px] font-mono text-white whitespace-nowrap shadow-lg">
                            HAYA CURSOR
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Active user cursor highlight when Cursor Follow Mode is on */}
                  {cursorFollow && (
                    <div
                      className="absolute z-40 pointer-events-none border border-cyan-400/50 rounded bg-cyan-500/5 px-2 py-0.5"
                      style={{ left: `${userCursor.x}%`, top: `${userCursor.y}%` }}
                    >
                      <span className="text-[8px] font-mono text-cyan-400">COMMANDER_HOVER</span>
                    </div>
                  )}
                </div>

                {/* Matrix Scanline Overlay effect */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[size:100%_4px] opacity-15 z-20" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm gap-4">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                  <Eye className="w-8 h-8 text-slate-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-sans text-xs font-semibold text-slate-200">Vision Engine Offline</h3>
                  <p className="font-sans text-[11px] text-slate-500 leading-relaxed">
                    Haya is not currently looking at your desktop. Click "Stream Screen" above or say <code className="text-cyan-400 font-mono">"Haya, look at my screen"</code> to activate.
                  </p>
                </div>
                <button
                  onClick={toggleVision}
                  className="px-4 py-1.5 mt-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-sans text-xs font-medium hover:bg-cyan-500/15 transition-all select-none cursor-pointer"
                >
                  Initiate Screen Access
                </button>
              </div>
            )}
          </div>

          {/* Action Trigger Sandbox panel */}
          <div className="p-3 border-t border-white/5 bg-slate-950/60 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-mono text-slate-500 tracking-wider">SANDBOX TOOLS:</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                disabled={!isActive}
                onClick={runSimulationDemo}
                className="px-3 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 font-mono text-[9px] uppercase hover:bg-purple-500/20 transition-all cursor-pointer disabled:opacity-25"
                title="Simulates a multi-step compile/lint routine using autonomous mouse clicks"
              >
                Simulate Workflow
              </button>
              <button
                disabled={!isActive}
                onClick={() => computerEngine.setCursorFollow(!cursorFollow)}
                className={`px-3 py-1 rounded-lg border font-mono text-[9px] uppercase transition-all cursor-pointer disabled:opacity-25 ${
                  cursorFollow
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                    : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                {cursorFollow ? "Disable Follow" : "Follow Cursor"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* COLUMN 2: REAL-TIME HUD LOGS AND CONTROLLER BAR (Cols 9-12) */}
      <div className="xl:col-span-4 flex flex-col gap-4">
        
        {/* PIPELINE STAGE GRAPHIC */}
        <div className="rounded-2xl border border-white/10 bg-[#090e18]/85 p-4 flex flex-col gap-3 shadow-lg">
          <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-[10px] tracking-wider uppercase font-bold text-slate-200">
              THINKING_PIPELINE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            {[
              { id: "observing", label: "1. OBSERVE" },
              { id: "understanding", label: "2. UNDERSTAND" },
              { id: "planning", label: "3. PLAN" },
              { id: "explaining", label: "4. EXPLAIN" },
              { id: "executing", label: "5. EXECUTE" },
              { id: "verifying", label: "6. VERIFY" },
              { id: "completed", label: "7. REPORT" },
            ].map((step) => {
              const active = currentStep === step.id;
              return (
                <div
                  key={step.id}
                  className={`px-2 py-1.5 rounded-lg border text-center transition-all duration-300 ${
                    active
                      ? getStepColor(step.id as ActionStep) + " shadow-[0_0_15px_rgba(34,211,238,0.1)] scale-[1.03] font-bold"
                      : "border-white/5 text-slate-600 bg-transparent"
                  }`}
                >
                  {step.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* LOG TERMINAL HUD */}
        <div className="rounded-2xl border border-white/10 bg-[#060a12]/95 flex flex-col flex-grow min-h-[180px] max-h-[300px] shadow-inner overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-slate-950/45 select-none">
            <Terminal className="w-4 h-4 text-purple-400 animate-pulse" />
            <span className="font-mono text-[10px] tracking-wider uppercase font-bold text-slate-300">
              VISION_AUTONOMY_LOGS
            </span>
          </div>

          <div className="flex-grow p-3 font-mono text-[9px] text-slate-400 overflow-y-auto space-y-1.5 flex flex-col-reverse">
            {logs.length > 0 ? (
              logs.map((log, idx) => (
                <div key={idx} className="leading-relaxed border-l-2 border-cyan-500/45 pl-2 select-text">
                  {log}
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 italic">
                System idling. Send vision trigger.
              </div>
            )}
          </div>
        </div>

        {/* RECENT HISTORIC ACTIONS */}
        <div className="rounded-2xl border border-white/10 bg-[#090e18]/85 p-4 flex flex-col gap-3 shadow-lg flex-grow min-h-[150px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-pink-400" />
              <span className="font-mono text-[10px] tracking-wider uppercase font-bold text-slate-200">
                ACTION_REGISTRY
              </span>
            </div>
            {history.length > 0 && (
              <button
                onClick={() => computerEngine.clearHistory()}
                className="font-mono text-[8px] text-slate-500 hover:text-slate-300 transition-all uppercase cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-grow overflow-y-auto space-y-2 max-h-[220px]">
            {history.length > 0 ? (
              history.map((act) => (
                <div key={act.id} className="p-2 rounded-lg bg-white/5 border border-white/5 flex flex-col gap-1 text-[9px] font-mono select-text">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold uppercase">{act.type.replace("_", " ")}</span>
                    <span className="text-[8px] text-slate-500">{act.timestamp}</span>
                  </div>
                  <div className="text-slate-400">
                    <span className="text-slate-500">Target:</span> "{act.target}"
                  </div>
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5 text-[8px] text-slate-500">
                    <span>COORDS: ({act.x}%, {act.y}%)</span>
                    <span className="text-green-400 uppercase font-semibold">SUCCESS</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 italic text-[10px] py-8">
                No recent actions recorded.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
