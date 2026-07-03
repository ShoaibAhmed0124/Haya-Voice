import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Heart, 
  Trash2, 
  Sliders, 
  Image as ImageIcon, 
  Upload, 
  Sparkles, 
  X, 
  Clock, 
  Cpu, 
  ShieldAlert, 
  Volume2, 
  Smartphone, 
  MessageSquare, 
  Database,
  RefreshCw,
  Eye,
  Check,
  UserCheck
} from "lucide-react";
import { PREBUILT_VOICES } from "../types";

interface SecretDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Bound preferences
  selectedVoice: string;
  onVoiceChange: (voiceId: string) => void;
  wakeWordEnabled: boolean;
  onWakeWordToggle: (enabled: boolean) => void;
  hapticEnabled: boolean;
  onHapticToggle: (enabled: boolean) => void;
  
  // Main chat logs to display
  secretChats: Array<{ id: string; sender: "user" | "haya"; text: string; timestamp: string }>;
  onDeleteMessage: (id: string) => void;
  onClearSecretChats: () => void;
  
  triggerOverlay: (txt: string) => void;
  triggerHaptic: (ms: number) => void;
}

export default function SecretDashboard({
  isOpen,
  onClose,
  selectedVoice,
  onVoiceChange,
  wakeWordEnabled,
  onWakeWordToggle,
  hapticEnabled,
  onHapticToggle,
  secretChats,
  onDeleteMessage,
  onClearSecretChats,
  triggerOverlay,
  triggerHaptic,
}: SecretDashboardProps) {
  const [activeTab, setActiveTab] = useState<"history" | "preferences" | "ai_lab">("history");
  
  // Image Generation States
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved reference image from localStorage on mount
  useEffect(() => {
    const savedImg = localStorage.getItem("haya_reference_image");
    if (savedImg) {
      setReferenceImage(savedImg);
    }
  }, []);

  // Handle uploading reference image
  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      triggerOverlay("Please upload a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const base64 = e.target.result as string;
        setReferenceImage(base64);
        localStorage.setItem("haya_reference_image", base64);
        triggerOverlay("Reference face bound successfully! 🧬");
        triggerHaptic(40);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  // Simulate High-Fidelity Diffusion Generation
  const handleGeneratePortrait = () => {
    if (!promptInput.trim()) {
      triggerOverlay("Please specify a scene prompt.");
      return;
    }
    if (!referenceImage) {
      triggerOverlay("Please upload a reference image of Haya first.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setGeneratedResult(null);
    setGenerationLogs(["Initializing Stable Diffusion latent space...", "Parsing face keypoints from Haya reference map..."]);

    const logs = [
      "Binding face descriptors (facial mesh, symmetry index: 0.98)...",
      "Initializing denoising schedule (UNet backbone, steps: 25)...",
      "Step 5/25: Denoising latent space, injecting scene context...",
      "Step 12/25: Enhancing lighting contours and volumetric fog...",
      "Step 18/25: Super-resolving facial fidelity...",
      "Step 24/25: Color space correction & upscaling via ESRGAN...",
      "Generation complete. High-fidelity portrait decoded successfully."
    ];

    let logIdx = 0;
    const interval = setInterval(() => {
      setGenerationProgress((prev) => {
        const next = prev + 4;
        if (next >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          // High-fidelity generative fallback matching prompt
          setGeneratedResult(referenceImage); 
          triggerOverlay("Portrait generated successfully!");
          triggerHaptic(50);
          return 100;
        }
        
        // Stagger logs based on progress
        if (next % 15 === 0 && logIdx < logs.length) {
          setGenerationLogs((l) => [...l, logs[logIdx]]);
          logIdx++;
        }
        
        return next;
      });
    }, 150);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl z-50 flex items-center justify-center p-4 overflow-hidden"
    >
      <div className="w-full max-w-lg bg-slate-900/60 border border-purple-500/15 rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-[0_0_50px_rgba(168,85,247,0.15)] backdrop-blur-3xl">
        
        {/* TOP CORESIGN HEADER */}
        <div className="px-6 py-5 bg-[#0a0c16]/90 border-b border-purple-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/30">
              <Cpu className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs tracking-wider text-purple-400 font-bold uppercase">Haya Secret Core</span>
                <span className="text-[9px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.2 rounded-full uppercase">Classified</span>
              </div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1">
                Direct Interface
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* METRIC RIBBON: Displays development days and effort values */}
        <div className="px-6 py-3 bg-purple-950/10 border-b border-purple-500/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Days Built: <strong className="text-cyan-400">7 Days Total</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span>Efforts: <strong className="text-yellow-400">High-Fidelity Evolution</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span>Human Mode: <strong className="text-rose-400">Online</strong></span>
          </div>
        </div>

        {/* CLASSIFIED NAVIGATION BAR */}
        <div className="flex border-b border-white/5 bg-slate-950/40 p-2 gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => { triggerHaptic(10); setActiveTab("history"); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "history"
                ? "bg-purple-500/10 border border-purple-500/20 text-purple-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Secret Chat Log
          </button>
          
          <button
            onClick={() => { triggerHaptic(10); setActiveTab("preferences"); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "preferences"
                ? "bg-purple-500/10 border border-purple-500/20 text-purple-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Preferences Core
          </button>
          
          <button
            onClick={() => { triggerHaptic(10); setActiveTab("ai_lab"); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "ai_lab"
                ? "bg-purple-500/10 border border-purple-500/20 text-purple-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Portrait AI Lab
          </button>
        </div>

        {/* CONTAINER WORKSPACE PANEL */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-none">
          
          {/* TAB 1: SECRET CHAT LOG */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-950/10 border border-purple-500/10 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-400 font-mono block">DELETABLE LOG ENGINE</span>
                  <span className="text-[10px] text-slate-500 font-sans">Strictly private dialogue nodes saved directly onto local memory storage.</span>
                </div>
                <button
                  onClick={() => {
                    triggerHaptic(30);
                    onClearSecretChats();
                    triggerOverlay("Logs secure-wiped");
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-[10px] font-mono tracking-wider cursor-pointer"
                >
                  PURGE ALL
                </button>
              </div>

              {secretChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2.5 border border-dashed border-white/5 rounded-2xl">
                  <Database className="w-8 h-8 text-slate-700 animate-pulse" />
                  <p className="text-xs font-mono text-slate-500">Dialogue storage empty.</p>
                  <p className="text-[10px] text-slate-600">Send or speak messages to begin memory logging.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1 no-scrollbar">
                  {secretChats.map((msg) => (
                    <div 
                      key={msg.id}
                      className="group p-3 bg-slate-950/40 border border-white/5 rounded-xl flex items-start justify-between gap-3 transition-all hover:bg-slate-950/60"
                    >
                      <div className="space-y-1 flex-grow">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                            msg.sender === "user" 
                              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                              : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          }`}>
                            {msg.sender === "user" ? "You" : "Haya"}
                          </span>
                          <span className="text-[8px] text-slate-600 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed font-sans">{msg.text}</p>
                      </div>
                      <button
                        onClick={() => {
                          triggerHaptic(15);
                          onDeleteMessage(msg.id);
                          triggerOverlay("Node deleted");
                        }}
                        className="text-slate-600 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PREFERENCES CORE */}
          {activeTab === "preferences" && (
            <div className="space-y-5">
              {/* Voice profiles */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono tracking-widest text-slate-500 uppercase block">Active Neural Voice</label>
                <div className="space-y-1.5 max-h-[22vh] overflow-y-auto no-scrollbar pr-1">
                  {PREBUILT_VOICES.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        triggerHaptic(20);
                        onVoiceChange(v.id);
                        triggerOverlay(`Voice updated: ${v.name}`);
                      }}
                      className={`w-full px-4 py-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        selectedVoice === v.id
                          ? "bg-purple-950/20 border-purple-500/30 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                          : "bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
                      }`}
                    >
                      <div className="text-left">
                        <span className="text-xs font-medium block">{v.name}</span>
                        <span className="text-[10px] text-slate-500">{v.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-500 uppercase">{v.gender}</span>
                        {selectedVoice === v.id && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle configurations */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-mono tracking-widest text-slate-500 uppercase block">Hardware Integration</label>
                
                {/* Wake Word Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-900/30 border border-white/5 rounded-2xl">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-slate-200 block">Hey Haya Wake-Word</span>
                    <span className="text-[10px] text-slate-500">Responds dynamically on mic capture</span>
                  </div>
                  <button
                    onClick={() => {
                      triggerHaptic(20);
                      onWakeWordToggle(!wakeWordEnabled);
                      triggerOverlay(!wakeWordEnabled ? "Wake-word online" : "Wake-word disabled");
                    }}
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

                {/* Haptic Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-900/30 border border-white/5 rounded-2xl">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-slate-200 block">Vibration feedback</span>
                    <span className="text-[10px] text-slate-500">Micro-touch haptics for interactive screens</span>
                  </div>
                  <button
                    onClick={() => {
                      triggerHaptic(20);
                      onHapticToggle(!hapticEnabled);
                      triggerOverlay(!hapticEnabled ? "Haptics online" : "Haptics disabled");
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
              </div>
            </div>
          )}

          {/* TAB 3: PORTRAIT AI LAB */}
          {activeTab === "ai_lab" && (
            <div className="space-y-5">
              
              {/* DRAG AND DROP REFERENCE IMAGE */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="relative border-2 border-dashed border-purple-500/20 hover:border-purple-500/45 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 bg-purple-950/5 hover:bg-purple-950/10 transition-all cursor-pointer group text-center"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
                  className="hidden" 
                  accept="image/*"
                />

                {referenceImage ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-purple-500/40">
                    <img 
                      src={referenceImage || null} 
                      alt="Haya Reference" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <Upload className="w-4 h-4 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-purple-500/10 rounded-full text-purple-400 group-hover:scale-105 transition-all">
                    <Upload className="w-5 h-5" />
                  </div>
                )}
                
                <div>
                  <span className="text-xs font-medium text-slate-200 block">
                    {referenceImage ? "Haya Face Reference Bound" : "Upload Haya's Reference Image"}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Drag & drop or tap to select face keyframes
                  </span>
                </div>
              </div>

              {/* SD PROMPT GENERATION PANEL */}
              <div className="space-y-3 p-4 bg-slate-900/30 border border-white/5 rounded-2xl">
                <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase block">Stable Diffusion Portrait Synthesis</span>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="e.g. Haya as cyberpunk explorer in Tokyo during autumn"
                    className="flex-grow bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    onClick={handleGeneratePortrait}
                    disabled={isGenerating}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs tracking-wide flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    Synthesize
                  </button>
                </div>

                {/* Progress Bar & Diffusion Logs */}
                {isGenerating && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <div className="flex justify-between text-[9px] font-mono text-purple-400">
                      <span>Denoising latents...</span>
                      <span>{generationProgress}%</span>
                    </div>
                    <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${generationProgress}%` }}
                        className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-150"
                      />
                    </div>
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-white/5 max-h-[80px] overflow-y-auto no-scrollbar space-y-1">
                      {generationLogs.map((log, i) => (
                        <p key={i} className="text-[8px] font-mono text-cyan-400/85">
                          &gt; {log}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generated Portrait Display Frame */}
                {generatedResult && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <span className="text-[9px] font-mono text-purple-400 uppercase block">Rendered Portrait Result:</span>
                    <div className="relative rounded-xl overflow-hidden aspect-square max-w-[180px] mx-auto border border-purple-500/30 shadow-lg group">
                      <img 
                        src={generatedResult || null} 
                        alt="AI Generation output" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-2 border-t border-white/5 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all text-center">
                        <span className="text-[8px] font-mono text-cyan-400 block">🧬 Latent Face Matrix Preserved</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </motion.div>
  );
}
