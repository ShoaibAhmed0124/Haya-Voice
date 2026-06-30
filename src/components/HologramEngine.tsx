import React, { useEffect, useRef, useState } from "react";
import { AssistantState } from "../types";

// Explicit Behavioral States
export type EngineState = "IDLE" | "LISTENING" | "TALKING" | "WAVING" | "STRETCHING";

const VIDEO_PATHS: Record<EngineState, string> = {
  IDLE: "/HAYA_IDLE.mp4",
  LISTENING: "/HAYA_LISTENING.mp4",
  TALKING: "/HAYA_TALKING.mp4",
  WAVING: "/HAYA_WAVING.mp4",
  STRETCHING: "/HAYA_STRETCHING.mp4",
};

interface HologramEngineProps {
  state: AssistantState;
  playbackAnalyser: AnalyserNode | null;
  microphoneAnalyser: AnalyserNode | null;
  glowColorRGB?: string;
  selectedPersona?: string;
  transcript?: string;
  isManualGlitching?: boolean;
  forcedBehavior?: { type: EngineState; timestamp: number } | null;
}

export default function HologramEngine({
  state,
  playbackAnalyser,
  microphoneAnalyser,
  glowColorRGB = "147, 51, 234",
  selectedPersona = "assistant",
  transcript = "",
  isManualGlitching = false,
  forcedBehavior = null,
}: HologramEngineProps) {
  // 1. Behavior State
  const [behavior, setBehavior] = useState<EngineState>("IDLE");

  // Dual-Video element states for the crossfading deck
  const [activeVideoSlot, setActiveVideoSlot] = useState<"slotA" | "slotB">("slotA");
  const [slotAOpacity, setSlotAOpacity] = useState<number>(1);
  const [slotBOpacity, setSlotBOpacity] = useState<number>(0);

  // Synchronization refs for smooth hardware crossfading
  const currentSlotRef = useRef<"slotA" | "slotB">("slotA");
  const lastBehaviorRef = useRef<EngineState | null>(null);

  // Audio analysis states (running continuously)
  const [micActive, setMicActive] = useState<boolean>(false);
  const [playbackActive, setPlaybackActive] = useState<boolean>(false);

  // Dual-Video element references (Only 2 physical elements to satisfy mobile hardware decoder limits!)
  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);

  // Gesture unlock tracker for strict mobile autoplay sandbox
  const unlockedRef = useRef<boolean>(false);

  // UI rendering refs
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectionContainerRef = useRef<HTMLDivElement | null>(null);

  // Audio active trackers
  const micActiveRef = useRef<boolean>(false);
  const playbackActiveRef = useRef<boolean>(false);
  const lastMicActiveTime = useRef<number>(0);
  const lastPlaybackActiveTime = useRef<number>(0);

  // Behavior tracking refs
  const lastActivityTimeRef = useRef<number>(Date.now());
  const behaviorStartTimeRef = useRef<number>(performance.now());
  const volumeLevelRef = useRef<number>(0);
  const lastStateRef = useRef<AssistantState>(state);
  const lastAppliedOpacityRef = useRef<number>(0);
  const lastAppliedScaleRef = useRef<number>(0);

  // Warm up Slot A on mount with initial IDLE video resource
  useEffect(() => {
    if (videoRefA.current) {
      videoRefA.current.src = VIDEO_PATHS.IDLE;
      videoRefA.current.load();
    }
  }, []);

  // Logs state transitions beautifully in the console
  const logBehaviorTransition = (newBehavior: EngineState, durationMs: number) => {
    console.group(`%c[HAYA BEHAVIOR ACTIVE] → ${newBehavior}`, "color: #c084fc; font-weight: bold;");
    console.log(`%cApp State context:   %c${state}`, "color: #818cf8; font-weight: bold;", "color: #ffffff;");
    console.log(`%cTime in transition:  %c${durationMs.toFixed(1)}ms`, "color: #e2e8f0; font-weight: bold;", "color: #ffffff;");
    console.log(`%cActive Deck Slot:    %c${currentSlotRef.current === "slotA" ? "Slot A" : "Slot B"}`, "color: #2dd4bf; font-weight: bold;", "color: #ffffff;");
    console.groupEnd();
  };

  // 2. High-Performance Audio Analyser Thread (Runs continuously at 60fps)
  useEffect(() => {
    let active = true;
    const dataArray = new Uint8Array(128);

    const updateVolumeLoop = () => {
      if (!active) return;

      let currentVolume = 0;

      // Microphone intensity tracking
      if (microphoneAnalyser) {
        microphoneAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 128; i++) {
          sum += dataArray[i];
        }
        const norm = sum / 128 / 255;
        if (norm > 0.02) {
          lastMicActiveTime.current = Date.now();
        }
        if (state === "listening") {
          currentVolume = norm;
        }
      }

      // Voice output (TTS) playback intensity tracking
      if (playbackAnalyser) {
        playbackAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 128; i++) {
          sum += dataArray[i];
        }
        const norm = sum / 128 / 255;
        if (norm > 0.01) {
          lastPlaybackActiveTime.current = Date.now();
        }
        if (state === "speaking") {
          currentVolume = norm;
        }
      }

      const now = Date.now();
      const isMicActiveNow = (now - lastMicActiveTime.current) < 1000;
      const isPlaybackActiveNow = (now - lastPlaybackActiveTime.current) < 500;

      if (isMicActiveNow !== micActiveRef.current) {
        micActiveRef.current = isMicActiveNow;
        setMicActive(isMicActiveNow);
      }
      if (isPlaybackActiveNow !== playbackActiveRef.current) {
        playbackActiveRef.current = isPlaybackActiveNow;
        setPlaybackActive(isPlaybackActiveNow);
      }

      volumeLevelRef.current = currentVolume;

      // Real-time volumetric scales of holographic containment capsule (Throttled & smoothed for performance)
      if (projectionContainerRef.current) {
        const pulse = (Math.sin(now / 600) + 1) / 2;
        const baseIntensity = 0.94 + pulse * 0.05;
        const volumeScale = currentVolume * 0.16;
        
        const targetOpacity = Math.min(1, baseIntensity + volumeScale);
        const targetScale = 1 + currentVolume * 0.035;

        const opacityDiff = Math.abs(targetOpacity - lastAppliedOpacityRef.current);
        const scaleDiff = Math.abs(targetScale - lastAppliedScaleRef.current);

        // Only update styles if the change exceeds visual threshold to prevent excessive layout/style recalculations on mobile
        if (opacityDiff > 0.005 || scaleDiff > 0.001) {
          projectionContainerRef.current.style.opacity = targetOpacity.toFixed(3);
          projectionContainerRef.current.style.transform = `scale(${targetScale.toFixed(3)})`;
          lastAppliedOpacityRef.current = targetOpacity;
          lastAppliedScaleRef.current = targetScale;
        }
      }

      requestAnimationFrame(updateVolumeLoop);
    };

    updateVolumeLoop();
    return () => {
      active = false;
    };
  }, [state, playbackAnalyser, microphoneAnalyser]);

  const isSpeechPlaybackActive = playbackActive || state === "speaking";
  const isSpeechInputActive = micActive || state === "listening";

  // 3. User Activity Timer (Resets idle tracking on interaction)
  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityTimeRef.current = Date.now();
    };

    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("mousedown", handleUserActivity);
    window.addEventListener("touchstart", handleUserActivity);

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("mousedown", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
    };
  }, []);

  useEffect(() => {
    if (isSpeechPlaybackActive || isSpeechInputActive) {
      lastActivityTimeRef.current = Date.now();
    }
  }, [isSpeechPlaybackActive, isSpeechInputActive]);

  // 4. Autonomous Conversation-driven Behavior Transitions (Rule-based Decision Layer)
  useEffect(() => {
    if (isSpeechPlaybackActive) {
      if (behavior !== "TALKING") {
        setBehavior("TALKING");
      }
    } else if (isSpeechInputActive) {
      // Do not interrupt ongoing gestures (waving/stretching) prematurely
      if (behavior !== "LISTENING" && behavior !== "WAVING" && behavior !== "STRETCHING") {
        setBehavior("LISTENING");
      }
    } else {
      // Return to attentive IDLE posture if conversational streams stop
      if (behavior === "TALKING" || behavior === "LISTENING") {
        setBehavior("IDLE");
      }
    }
  }, [isSpeechPlaybackActive, isSpeechInputActive, behavior]);

  // 5. Inactivity "Stretching" posture clock (rare, immersive behavior)
  useEffect(() => {
    const checkInactivity = () => {
      if (behavior !== "IDLE") return;

      const now = Date.now();
      const idleDuration = now - lastActivityTimeRef.current;

      // Stretch if completely inactive and silent for 40 seconds
      if (idleDuration >= 40000 && !isSpeechPlaybackActive && !isSpeechInputActive) {
        console.log("[Haya Behavior Engine] Immersive inactivity stretch triggered.");
        setBehavior("STRETCHING");
        lastActivityTimeRef.current = Date.now();
      }
    };

    const timer = setInterval(checkInactivity, 1000);
    return () => clearInterval(timer);
  }, [behavior, isSpeechPlaybackActive, isSpeechInputActive]);

  // 6. Responsive Wave greeting on initial connection handshakes
  useEffect(() => {
    if (lastStateRef.current === "connecting" && state === "listening" && behavior === "IDLE") {
      console.log("[Haya Behavior Engine] Handshake complete. Playing WAVING gesture.");
      setBehavior("WAVING");
    }
    lastStateRef.current = state;
  }, [state, behavior]);

  // 6.5 Explicit forced behavior command from the main AI brain
  useEffect(() => {
    if (forcedBehavior) {
      console.log(`[Haya Behavior Engine] Forced behavior triggered via AI tool call: ${forcedBehavior.type}`);
      unlockAllVideos();
      setBehavior(forcedBehavior.type);
    }
  }, [forcedBehavior]);

  // 7. Universal gesture unlock to satisfy mobile autoplay policies
  const unlockAllVideos = () => {
    if (unlockedRef.current) return;
    console.log("[Haya Behavior Engine] Initializing and warming up dual-video decoders for mobile...");

    const vA = videoRefA.current;
    const vB = videoRefB.current;

    if (vA) {
      vA.muted = true;
      vA.playsInline = true;
      vA.play().then(() => {
        // Keep active playing
        if (activeVideoSlot !== "slotA") vA.pause();
      }).catch(e => console.warn("[Autoplay Unlock] Slot A failed:", e));
    }

    if (vB) {
      vB.muted = true;
      vB.playsInline = true;
      vB.play().then(() => {
        // Keep active playing
        if (activeVideoSlot !== "slotB") vB.pause();
      }).catch(e => console.warn("[Autoplay Unlock] Slot B failed:", e));
    }

    unlockedRef.current = true;
  };

  const handleHologramClick = () => {
    unlockAllVideos();

    // Trigger playful gesture on tap
    if (behavior === "IDLE") {
      const gesture = Math.random() > 0.5 ? "WAVING" : "STRETCHING";
      setBehavior(gesture);
    }
  };

  // Add touch listener to unlock videos seamlessly at first user interaction
  useEffect(() => {
    const handleGlobalUnlock = () => {
      unlockAllVideos();
      window.removeEventListener("click", handleGlobalUnlock);
      window.removeEventListener("touchstart", handleGlobalUnlock);
    };

    window.addEventListener("click", handleGlobalUnlock);
    window.addEventListener("touchstart", handleGlobalUnlock);

    return () => {
      window.removeEventListener("click", handleGlobalUnlock);
      window.removeEventListener("touchstart", handleGlobalUnlock);
    };
  }, [behavior]);

  // 8. Dual-Video Crossfade Transition Layer (Preloads, cross-fades, and recycles decoders)
  useEffect(() => {
    const targetPath = VIDEO_PATHS[behavior];
    if (lastBehaviorRef.current === behavior) return;
    lastBehaviorRef.current = behavior;

    const isLooping = behavior === "IDLE" || behavior === "LISTENING" || behavior === "TALKING";
    behaviorStartTimeRef.current = performance.now();

    const videoA = videoRefA.current;
    const videoB = videoRefB.current;

    const currentSlot = currentSlotRef.current;
    const targetSlot = currentSlot === "slotA" ? "slotB" : "slotA";
    const activeVideo = currentSlot === "slotA" ? videoA : videoB;
    const targetVideo = currentSlot === "slotA" ? videoB : videoA;

    if (targetVideo) {
      targetVideo.src = targetPath;
      targetVideo.muted = true;
      targetVideo.playsInline = true;
      targetVideo.loop = isLooping;
      targetVideo.currentTime = 0;
      targetVideo.playbackRate = (behavior === "IDLE" && state === "listening") ? 0.85 : 1.0;

      targetVideo.load();
      targetVideo.play()
        .then(() => {
          if (targetSlot === "slotA") {
            setSlotAOpacity(1);
            setSlotBOpacity(0);
          } else {
            setSlotAOpacity(0);
            setSlotBOpacity(1);
          }
          setActiveVideoSlot(targetSlot);
          currentSlotRef.current = targetSlot;
          if (activeVideo) activeVideo.pause();

          const dur = performance.now() - behaviorStartTimeRef.current;
          logBehaviorTransition(behavior, dur);
        })
        .catch(e => {
          console.warn(`[Dual-Deck] Play request failed/aborted for ${behavior}:`, e);
          // Fallback to avoid visual lock
          if (targetSlot === "slotA") {
            setSlotAOpacity(1);
            setSlotBOpacity(0);
          } else {
            setSlotAOpacity(0);
            setSlotBOpacity(1);
          }
          setActiveVideoSlot(targetSlot);
          currentSlotRef.current = targetSlot;
          if (activeVideo) activeVideo.pause();
        });
    }
  }, [behavior, state]);

  // Handles end events for gestures
  const handleSlotEnded = (slot: "A" | "B") => {
    console.log(`[Dual-Deck] Video ended in Slot ${slot} for behavior: ${behavior}`);
    if (behavior === "WAVING" || behavior === "STRETCHING") {
      setBehavior("IDLE");
    }
  };

  return (
    <div
      onClick={handleHologramClick}
      title="Tap Haya to trigger random gesture (Waving/Stretching)"
      className="relative w-full h-full overflow-hidden flex flex-col justify-center items-center z-10 bg-[#000000] cursor-pointer"
    >
      {/* Sci-fi scanner overlays */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.45)_50%)] bg-[size:100%_4px] opacity-[0.06] z-20" />
      <div className="absolute inset-0 pointer-events-none bg-radial-gradient from-transparent via-transparent to-black/80 z-10" />

      {/* Video Container with Radial Transparency Mask */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden">
        <div
          ref={projectionContainerRef}
          style={{
            opacity: 0.95,
            maskImage: "radial-gradient(circle at 50% 48%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 86%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 48%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 86%)",
            willChange: "transform, opacity",
          }}
          className={`relative w-full h-full flex items-center justify-center transition-all duration-300 ${
            isManualGlitching ? "skew-x-2 brightness-115 contrast-110" : ""
          }`}
        >
          <div className="relative w-full h-full flex items-center justify-center mix-blend-screen select-none pointer-events-none">
            {/* Slot A: High-performance Hardware Video Decoder */}
            <video
              ref={videoRefA}
              muted
              playsInline
              preload="auto"
              style={{ opacity: slotAOpacity, willChange: "opacity" }}
              onEnded={() => handleSlotEnded("A")}
              onError={(e) => console.error("[Haya Slot A] Critical stream error:", e)}
              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 transform scale-100 z-10"
            />

            {/* Slot B: High-performance Hardware Video Decoder */}
            <video
              ref={videoRefB}
              muted
              playsInline
              preload="auto"
              style={{ opacity: slotBOpacity, willChange: "opacity" }}
              onEnded={() => handleSlotEnded("B")}
              onError={(e) => console.error("[Haya Slot B] Critical stream error:", e)}
              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 transform scale-100 z-10"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

