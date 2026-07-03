import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AssistantState } from "../types";

interface VoiceCoreButtonProps {
  state: AssistantState;
  isMuted?: boolean;
  playbackAnalyser: AnalyserNode | null;
  microphoneAnalyser: AnalyserNode | null;
  onClick: () => void;
  theme?: string;
  glowColorRGB?: string;
}

export default function VoiceCoreButton({
  state,
  isMuted = false,
  playbackAnalyser,
  microphoneAnalyser,
  onClick,
  theme = "midnight",
  glowColorRGB = "147, 51, 234",
}: VoiceCoreButtonProps) {
  const volumeRef = useRef<number>(0);
  const animationRef = useRef<number | null>(null);

  const leftLineRef = useRef<SVGLineElement | null>(null);
  const centerLineRef = useRef<SVGLineElement | null>(null);
  const rightLineRef = useRef<SVGLineElement | null>(null);

  const isLight = theme === "light";

  // Audio analysis loop for real-time soundwave dancing
  useEffect(() => {
    const dataArray = new Uint8Array(64);

    const updateWaveform = () => {
      let targetVolume = 0;

      if (state === "listening" && microphoneAnalyser && !isMuted) {
        microphoneAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 32; i++) {
          sum += dataArray[i];
        }
        targetVolume = sum / 32 / 255;
      } else if (state === "speaking" && playbackAnalyser) {
        playbackAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 32; i++) {
          sum += dataArray[i];
        }
        targetVolume = sum / 32 / 255;
      }

      // Smooth amplitude easing
      volumeRef.current = volumeRef.current * 0.75 + targetVolume * 0.25;
      const vol = volumeRef.current;

      // Update SVG lines directly to avoid React rerender overhead
      if (centerLineRef.current) {
        const h = 70 + vol * 130;
        centerLineRef.current.setAttribute("y1", `-${h}`);
        centerLineRef.current.setAttribute("y2", `${h}`);
      }
      if (leftLineRef.current) {
        const h = 30 + vol * 90;
        leftLineRef.current.setAttribute("y1", `-${h}`);
        leftLineRef.current.setAttribute("y2", `${h}`);
      }
      if (rightLineRef.current) {
        const h = 30 + vol * 90;
        rightLineRef.current.setAttribute("y1", `-${h}`);
        rightLineRef.current.setAttribute("y2", `${h}`);
      }

      animationRef.current = requestAnimationFrame(updateWaveform);
    };

    updateWaveform();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, playbackAnalyser, microphoneAnalyser, isMuted]);

  // Determine button state classifications
  const isOffline = state === "disconnected" || state === "error";
  const isConnecting = state === "connecting";
  const isListening = state === "listening" && !isMuted;
  const isSpeaking = state === "speaking";
  const isThinking = state === "connecting"; // Connecting doubles as Thinking representation in core
  const isMutedState = isMuted && state !== "disconnected";

  // Framer Motion animation configuration based on the active state
  const getGlowStyle = () => {
    if (isMutedState) {
      return {
        boxShadow: "0 0 0px 0px rgba(148, 163, 184, 0)",
        background: "rgba(100, 116, 139, 0.1)",
        borderColor: "rgba(148, 163, 184, 0.2)",
      };
    }
    if (isOffline) {
      return {
        boxShadow: isLight
          ? `0 0 16px 2px rgba(${glowColorRGB}, 0.12)`
          : `0 0 20px 4px rgba(${glowColorRGB}, 0.18)`,
        background: isLight ? "rgba(255, 255, 255, 0.8)" : "rgba(15, 23, 42, 0.6)",
        borderColor: `rgba(${glowColorRGB}, 0.3)`,
      };
    }
    if (isConnecting) {
      return {
        boxShadow: `0 0 24px 6px rgba(245, 158, 11, 0.25)`,
        background: "rgba(245, 158, 11, 0.08)",
        borderColor: "rgba(245, 158, 11, 0.4)",
      };
    }
    if (isListening) {
      return {
        boxShadow: `0 0 30px 8px rgba(34, 211, 238, 0.35)`,
        background: "rgba(34, 211, 238, 0.12)",
        borderColor: "rgba(34, 211, 238, 0.5)",
      };
    }
    if (isSpeaking) {
      return {
        boxShadow: `0 0 30px 8px rgba(${glowColorRGB}, 0.35)`,
        background: `rgba(${glowColorRGB}, 0.12)`,
        borderColor: `rgba(${glowColorRGB}, 0.5)`,
      };
    }
    return {
      boxShadow: `0 0 20px 4px rgba(${glowColorRGB}, 0.2)`,
      background: "rgba(15, 23, 42, 0.6)",
      borderColor: `rgba(${glowColorRGB}, 0.35)`,
    };
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* 1. OUTER HALO AMBIENT GLOW */}
      <motion.div
        animate={
          isOffline
            ? { scale: [0.95, 1.05, 0.95], opacity: [0.3, 0.55, 0.3] }
            : isConnecting
            ? { scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }
            : isListening
            ? { scale: [1, 1.15, 1], opacity: [0.6, 0.95, 0.6] }
            : isSpeaking
            ? { scale: [1, 1.15, 1], opacity: [0.6, 0.95, 0.6] }
            : { scale: 1, opacity: 0.2 }
        }
        transition={{
          repeat: Infinity,
          duration: isConnecting ? 1.5 : isOffline ? 3 : 1.2,
          ease: "easeInOut",
        }}
        className="absolute rounded-full pointer-events-none z-0 blur-[14px]"
        style={{
          width: "74px",
          height: "74px",
          background: isMutedState
            ? "radial-gradient(circle, rgba(148, 163, 184, 0.15) 0%, transparent 70%)"
            : isConnecting
            ? "radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%)"
            : isListening
            ? "radial-gradient(circle, rgba(34, 211, 238, 0.4) 0%, transparent 70%)"
            : `radial-gradient(circle, rgba(${glowColorRGB}, 0.4) 0%, transparent 70%)`,
        }}
      />

      {/* 2. ROTATING OUTER RING (Active only during Connecting state) */}
      <AnimatePresence>
        {isConnecting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.05, rotate: 360 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              rotate: { repeat: Infinity, duration: 2.5, ease: "linear" },
              default: { duration: 0.3 },
            }}
            className="absolute inset-[-6px] rounded-full border border-dashed border-amber-500/50 pointer-events-none z-10"
          />
        )}
      </AnimatePresence>

      {/* 3. CORE VOICE KEY BUTTON */}
      <motion.button
        id="haya-voice-core-btn"
        onClick={onClick}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        animate={getGlowStyle()}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className={`w-[60px] h-[60px] rounded-full flex items-center justify-center border backdrop-blur-2xl transition-all cursor-pointer relative overflow-hidden shadow-xl z-20`}
      >
        {/* Apple-style internal 3D gloss shine */}
        <div className="absolute top-0.5 left-2 right-2 h-5 rounded-[50%] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

        {/* SVG Core Foundation (Branded Butterfly) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          className="w-10 h-10 select-none transition-transform duration-300 pointer-events-none"
        >
          <defs>
            {/* Rich glowing spectrum gradient */}
            <linearGradient id="btn-active-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#22d3ee" />
              <stop offset="50%" stop-color="#ec4899" />
              <stop offset="100%" stop-color="#8b5cf6" />
            </linearGradient>

            {/* Muted monochrome gradient */}
            <linearGradient id="btn-muted-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#94a3b8" />
              <stop offset="100%" stop-color="#475569" />
            </linearGradient>

            {/* Connecting amber energy gradient */}
            <linearGradient id="btn-connecting-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f59e0b" />
              <stop offset="100%" stop-color="#d97706" />
            </linearGradient>
          </defs>

          {/* Core group with relative translation */}
          <g
            transform="translate(256, 256)"
            style={{
              filter: isMutedState ? "none" : "drop-shadow(0 0 8px rgba(139, 92, 246, 0.45))",
            }}
          >
            {/* Left Wing */}
            <motion.path
              d="M -10,-40 C -80,-120 -180,-80 -140,20 C -120,60 -60,80 -10,30"
              fill="none"
              stroke={
                isMutedState
                  ? "url(#btn-muted-glow)"
                  : isConnecting
                  ? "url(#btn-connecting-glow)"
                  : "url(#btn-active-glow)"
              }
              strokeWidth="15"
              strokeLinecap="round"
              animate={
                isOffline
                  ? { scale: [1, 1.03, 1], opacity: 0.95 }
                  : isConnecting
                  ? { scale: [0.95, 1.05, 0.95], opacity: 0.9 }
                  : isListening
                  ? { scale: [1, 1.08, 1], rotate: [0, -3, 0] }
                  : isSpeaking
                  ? { scale: [1, 1.12, 1], rotate: [0, -5, 0] }
                  : { scale: 1, opacity: 0.6 }
              }
              transition={{
                repeat: Infinity,
                duration: isOffline ? 4 : isConnecting ? 1.6 : 0.8,
                ease: "easeInOut",
              }}
            />
            <motion.path
              d="M -10,-20 C -60,-80 -130,-50 -100,20 C -85,50 -45,60 -10,20"
              fill="none"
              stroke={
                isMutedState
                  ? "url(#btn-muted-glow)"
                  : isConnecting
                  ? "url(#btn-connecting-glow)"
                  : "url(#btn-active-glow)"
              }
              strokeWidth="9"
              strokeLinecap="round"
              animate={
                isOffline
                  ? { scale: [1, 1.02, 1], opacity: 0.8 }
                  : isConnecting
                  ? { scale: [0.96, 1.04, 0.96], opacity: 0.75 }
                  : isListening
                  ? { scale: [1, 1.06, 1] }
                  : isSpeaking
                  ? { scale: [1, 1.1, 1] }
                  : { scale: 1, opacity: 0.5 }
              }
              transition={{
                repeat: Infinity,
                duration: isOffline ? 4 : isConnecting ? 1.6 : 0.8,
                ease: "easeInOut",
              }}
            />

            {/* Right Wing */}
            <motion.path
              d="M 10,-40 C 80,-120 180,-80 140,20 C 120,60 60,80 10,30"
              fill="none"
              stroke={
                isMutedState
                  ? "url(#btn-muted-glow)"
                  : isConnecting
                  ? "url(#btn-connecting-glow)"
                  : "url(#btn-active-glow)"
              }
              strokeWidth="15"
              strokeLinecap="round"
              animate={
                isOffline
                  ? { scale: [1, 1.03, 1], opacity: 0.95 }
                  : isConnecting
                  ? { scale: [0.95, 1.05, 0.95], opacity: 0.9 }
                  : isListening
                  ? { scale: [1, 1.08, 1], rotate: [0, 3, 0] }
                  : isSpeaking
                  ? { scale: [1, 1.12, 1], rotate: [0, 5, 0] }
                  : { scale: 1, opacity: 0.6 }
              }
              transition={{
                repeat: Infinity,
                duration: isOffline ? 4 : isConnecting ? 1.6 : 0.8,
                ease: "easeInOut",
              }}
            />
            <motion.path
              d="M 10,-20 C 60,-80 130,-50 100,20 C 85,50 45,60 10,20"
              fill="none"
              stroke={
                isMutedState
                  ? "url(#btn-muted-glow)"
                  : isConnecting
                  ? "url(#btn-connecting-glow)"
                  : "url(#btn-active-glow)"
              }
              strokeWidth="9"
              strokeLinecap="round"
              animate={
                isOffline
                  ? { scale: [1, 1.02, 1], opacity: 0.8 }
                  : isConnecting
                  ? { scale: [0.96, 1.04, 0.96], opacity: 0.75 }
                  : isListening
                  ? { scale: [1, 1.06, 1] }
                  : isSpeaking
                  ? { scale: [1, 1.1, 1] }
                  : { scale: 1, opacity: 0.5 }
              }
              transition={{
                repeat: Infinity,
                duration: isOffline ? 4 : isConnecting ? 1.6 : 0.8,
                ease: "easeInOut",
              }}
            />

            {/* Left Antenna */}
            <motion.path
              d="M -5,-50 C -15,-90 -40,-110 -60,-105"
              fill="none"
              stroke={isMutedState ? "#64748b" : isConnecting ? "#f59e0b" : "#22d3ee"}
              strokeWidth="7"
              strokeLinecap="round"
              animate={isConnecting ? { rotate: [0, -3, 0] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
            <motion.circle
              cx="-60"
              cy="-105"
              r="9"
              fill={isMutedState ? "#475569" : isConnecting ? "#d97706" : "#22d3ee"}
              animate={
                isConnecting
                  ? { scale: [1, 1.25, 1] }
                  : isListening
                  ? { scale: [1, 1.3, 1] }
                  : {}
              }
              transition={{ repeat: Infinity, duration: 1.2 }}
            />

            {/* Right Antenna */}
            <motion.path
              d="M 5,-50 C 15,-90 40,-110 60,-105"
              fill="none"
              stroke={isMutedState ? "#64748b" : isConnecting ? "#d97706" : "#ec4899"}
              strokeWidth="7"
              strokeLinecap="round"
              animate={isConnecting ? { rotate: [0, 3, 0] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
            <motion.circle
              cx="60"
              cy="-105"
              r="9"
              fill={isMutedState ? "#475569" : isConnecting ? "#f59e0b" : "#ec4899"}
              animate={
                isConnecting
                  ? { scale: [1, 1.25, 1] }
                  : isListening
                  ? { scale: [1, 1.3, 1] }
                  : {}
              }
              transition={{ repeat: Infinity, duration: 1.2 }}
            />

            {/* Center Live Waveform (Controlled by requestAnimationFrame Analyser loop) */}
            <line
              ref={centerLineRef}
              x1="0"
              y1="-70"
              x2="0"
              y2="70"
              stroke={
                isMutedState
                  ? "url(#btn-muted-glow)"
                  : isConnecting
                  ? "url(#btn-connecting-glow)"
                  : "url(#btn-active-glow)"
              }
              strokeWidth="18"
              strokeLinecap="round"
            />
            <line
              ref={leftLineRef}
              x1="-24"
              y1="-30"
              x2="-24"
              y2="30"
              stroke={isMutedState ? "#64748b" : isConnecting ? "#f59e0b" : "#22d3ee"}
              strokeWidth="11"
              strokeLinecap="round"
            />
            <line
              ref={rightLineRef}
              x1="24"
              y1="-30"
              x2="24"
              y2="30"
              stroke={isMutedState ? "#475569" : isConnecting ? "#d97706" : "#ec4899"}
              strokeWidth="11"
              strokeLinecap="round"
            />

            {/* Center micro pulsing focal dot */}
            <circle cx="0" cy="0" r="7" fill="#ffffff" />
          </g>
        </svg>
      </motion.button>
    </div>
  );
}
