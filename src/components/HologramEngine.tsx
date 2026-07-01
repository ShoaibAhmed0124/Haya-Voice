import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
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

const BEHAVIOR_KEYS: EngineState[] = ["IDLE", "LISTENING", "TALKING", "WAVING", "STRETCHING"];

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
  const [activeVideoSlot, setActiveVideoSlot] = useState<EngineState>("IDLE");

  // Video resource caching states
  const [videoUrls, setVideoUrls] = useState<Record<EngineState, string>>({
    IDLE: "/HAYA_IDLE.mp4",
    LISTENING: "/HAYA_LISTENING.mp4",
    TALKING: "/HAYA_TALKING.mp4",
    WAVING: "/HAYA_WAVING.mp4",
    STRETCHING: "/HAYA_STRETCHING.mp4",
  });
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  // Keep track of active behavior in a ref to avoid stale closures in timeouts
  const currentBehaviorRef = useRef<EngineState>("IDLE");

  // Track if videos have been unlocked by user interaction
  const unlockedRef = useRef<boolean>(false);

  // References for all 5 video elements
  const videoRefs = {
    IDLE: useRef<HTMLVideoElement | null>(null),
    LISTENING: useRef<HTMLVideoElement | null>(null),
    TALKING: useRef<HTMLVideoElement | null>(null),
    WAVING: useRef<HTMLVideoElement | null>(null),
    STRETCHING: useRef<HTMLVideoElement | null>(null),
  };

  const lastBehaviorRef = useRef<EngineState | null>(null);

  // Audio analysis states (running continuously)
  const [micActive, setMicActive] = useState<boolean>(false);
  const [playbackActive, setPlaybackActive] = useState<boolean>(false);

  // UI rendering refs
  const projectionContainerRef = useRef<HTMLDivElement | null>(null);

  // Audio active trackers
  const micActiveRef = useRef<boolean>(false);
  const playbackActiveRef = useRef<boolean>(false);
  const lastMicActiveTime = useRef<number>(0);
  const lastPlaybackActiveTime = useRef<number>(0);

  // Behavior tracking refs
  const lastActivityTimeRef = useRef<number>(Date.now());
  const volumeLevelRef = useRef<number>(0);
  const lastStateRef = useRef<AssistantState>(state);
  const lastAppliedOpacityRef = useRef<number>(0);
  const lastAppliedScaleRef = useRef<number>(0);

  // Keep currentBehaviorRef synced
  useEffect(() => {
    currentBehaviorRef.current = behavior;
  }, [behavior]);

  // Dynamic Cache Storage download & caching manager
  useEffect(() => {
    let active = true;
    
    const loadCachedVideos = async () => {
      if (typeof window === "undefined" || !("caches" in window)) {
        console.warn("[Haya Caching] Cache API not supported in this environment.");
        return;
      }
      
      try {
        const cache = await caches.open("haya-video-assets-v1");
        const cachedUrls: Partial<Record<EngineState, string>> = {};
        let allCached = true;
        
        for (const key of BEHAVIOR_KEYS) {
          const path = VIDEO_PATHS[key];
          const cachedRes = await cache.match(path);
          if (!cachedRes) {
            allCached = false;
            break;
          }
          const blob = await cachedRes.blob();
          cachedUrls[key] = URL.createObjectURL(blob);
        }
        
        if (allCached && active) {
          console.log("[Haya Caching] All video files loaded from persistent local cache.");
          setVideoUrls(cachedUrls as Record<EngineState, string>);
          return;
        }
        
        // Sequentially download missing resources
        if (active) {
          setIsDownloading(true);
          setDownloadProgress(0);
        }
        
        const tempUrls: Partial<Record<EngineState, string>> = {};
        let downloadedCount = 0;
        
        for (const key of BEHAVIOR_KEYS) {
          if (!active) return;
          const path = VIDEO_PATHS[key];
          
          let response: Response;
          try {
            response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP status ${response.status}`);
          } catch (e) {
            // Retry fetch once
            await new Promise((r) => setTimeout(r, 1500));
            response = await fetch(path);
            if (!response.ok) throw new Error(`Retry failed with status ${response.status}`);
          }
          
          await cache.put(path, response.clone());
          const blob = await response.blob();
          
          if (active) {
            tempUrls[key] = URL.createObjectURL(blob);
            downloadedCount++;
            setDownloadProgress(Math.round((downloadedCount / BEHAVIOR_KEYS.length) * 100));
          }
        }
        
        if (active) {
          console.log("[Haya Caching] All video files successfully downloaded and cached.");
          setVideoUrls(tempUrls as Record<EngineState, string>);
        }
      } catch (err) {
        console.error("[Haya Caching] Failed to cache files locally:", err);
      } finally {
        if (active) {
          setIsDownloading(false);
        }
      }
    };
    
    loadCachedVideos();
    
    return () => {
      active = false;
    };
  }, []);

  // Warm up and pre-load all videos whenever cache URLs are resolved/assigned
  useEffect(() => {
    BEHAVIOR_KEYS.forEach((key) => {
      const video = videoRefs[key].current;
      if (video) {
        video.load();
      }
    });
  }, [videoUrls]);

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

      // Real-time volumetric scales of holographic containment capsule
      if (projectionContainerRef.current) {
        const pulse = (Math.sin(now / 600) + 1) / 2;
        const baseIntensity = 0.94 + pulse * 0.05;
        const volumeScale = currentVolume * 0.16;
        
        const targetOpacity = Math.min(1, baseIntensity + volumeScale);
        const targetScale = 1 + currentVolume * 0.035;

        const opacityDiff = Math.abs(targetOpacity - lastAppliedOpacityRef.current);
        const scaleDiff = Math.abs(targetScale - lastAppliedScaleRef.current);

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

  // 4. Autonomous Conversation-driven Behavior Transitions
  useEffect(() => {
    if (isSpeechPlaybackActive) {
      if (behavior !== "TALKING") {
        setBehavior("TALKING");
      }
    } else if (isSpeechInputActive) {
      if (behavior !== "LISTENING" && behavior !== "WAVING" && behavior !== "STRETCHING") {
        setBehavior("LISTENING");
      }
    } else {
      if (behavior === "TALKING" || behavior === "LISTENING") {
        setBehavior("IDLE");
      }
    }
  }, [isSpeechPlaybackActive, isSpeechInputActive, behavior]);

  // 5. Inactivity "Stretching" posture clock (every 40s of complete silence)
  useEffect(() => {
    const checkInactivity = () => {
      if (behavior !== "IDLE") return;

      const now = Date.now();
      const idleDuration = now - lastActivityTimeRef.current;

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
    console.log("[Haya Behavior Engine] Initializing and preloading all 5 video decoders for mobile...");

    BEHAVIOR_KEYS.forEach((key) => {
      const video = videoRefs[key].current;
      if (video) {
        video.muted = true;
        video.playsInline = true;
        // Call load to initialize the decoder without playing all 5 at once
        video.load();
      }
    });

    unlockedRef.current = true;
  };

  const handleHologramClick = (e: React.MouseEvent) => {
    // Only trigger if clicking directly on the avatar container area, not buttons/overlay
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) {
      return;
    }
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
  }, []);

  // Safety timeout reset for non-looping animations to prevent freeze-ups if onEnded misses trigger
  useEffect(() => {
    if (behavior === "WAVING" || behavior === "STRETCHING") {
      const timer = setTimeout(() => {
        console.warn(`[HologramEngine] Safety timeout reset triggered for state: ${behavior}`);
        setBehavior("IDLE");
      }, 5500); // 5.5 seconds safety fallback
      return () => clearTimeout(timer);
    }
  }, [behavior]);

  // 8. High-Performance Multi-Element Crossfade Transition Layer
  useEffect(() => {
    const targetBehavior = behavior;
    if (lastBehaviorRef.current === targetBehavior) return;

    console.log(`[HologramEngine] Transitioning from ${lastBehaviorRef.current} to ${targetBehavior}`);

    const targetVideo = videoRefs[targetBehavior].current;

    if (targetVideo) {
      // Seek to 0 only for one-shot gestures (Waving, Stretching), NOT for continuous loops!
      if (targetBehavior === "WAVING" || targetBehavior === "STRETCHING") {
        targetVideo.currentTime = 0;
      }
      targetVideo.playbackRate = (targetBehavior === "IDLE" && state === "listening") ? 0.85 : 1.0;
      
      targetVideo.play()
        .then(() => {
          // Crossfade opacity
          setActiveVideoSlot(targetBehavior);

          // Pause other videos after crossfade has settled to keep animations smooth
          BEHAVIOR_KEYS.forEach((key) => {
            // NEVER pause the IDLE video - it is our safety background layer!
            if (key !== targetBehavior && key !== "IDLE") {
              const otherVideo = videoRefs[key].current;
              if (otherVideo && !otherVideo.paused) {
                setTimeout(() => {
                  if (currentBehaviorRef.current !== key) {
                    otherVideo.pause();
                  }
                }, 500); // 500ms delay to let the opacity crossfade complete
              }
            }
          });
        })
        .catch(e => {
          console.warn(`[HologramEngine] Play request failed for ${targetBehavior}:`, e);
          setActiveVideoSlot(targetBehavior);
        });
    }

    lastBehaviorRef.current = targetBehavior;
  }, [behavior, state]);

  // Handles end events for gestures
  const handleSlotEnded = (key: EngineState) => {
    console.log(`[HologramEngine] Video ended for behavior: ${key}`);
    if (key === "WAVING" || key === "STRETCHING") {
      setBehavior("IDLE");
    }
  };

  if (isDownloading) {
    return (
      <div className="relative w-full h-full overflow-hidden flex flex-col justify-center items-center bg-[#000000] z-10 font-mono text-[11px] tracking-wider text-purple-400 select-none">
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.45)_50%)] bg-[size:100%_4px] opacity-[0.06] z-20" />
        <div className="relative flex flex-col items-center justify-center space-y-6">
          <div className="relative w-20 h-20 flex items-center justify-center">
            {/* Glowing backdrop under icon */}
            <div 
              style={{ boxShadow: `0 0 45px 12px rgba(${glowColorRGB}, 0.4)` }}
              className="absolute w-12 h-12 rounded-full"
            />
            {/* Pulsing App Icon */}
            <motion.img
              src="/icon.svg"
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-16 h-16 object-contain z-10 filter drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]"
              alt="Haya Logo"
            />
          </div>
          <div className="flex flex-col items-center text-center space-y-2 px-6">
            <div className="text-[12px] font-bold text-white tracking-widest flex items-center space-x-1.5 uppercase">
              <span>Syncing Hologram Engine</span>
              <span className="w-1 h-1 rounded-full bg-purple-400 animate-ping" />
            </div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">
              Downloading assets... {downloadProgress}%
            </div>
            <div className="w-48 h-1 bg-white/5 border border-white/10 rounded-full overflow-hidden relative">
              <div 
                style={{ 
                  width: `${downloadProgress}%`,
                  backgroundColor: `rgb(${glowColorRGB})`,
                  boxShadow: `0 0 10px 2px rgba(${glowColorRGB}, 0.8)`
                }} 
                className="h-full transition-all duration-300 ease-out"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            {BEHAVIOR_KEYS.map((key) => {
              const isLooping = key === "IDLE" || key === "LISTENING" || key === "TALKING";
              const isActive = activeVideoSlot === key;
              return (
                <video
                  key={key}
                  ref={videoRefs[key]}
                  src={videoUrls[key]}
                  muted
                  playsInline
                  preload="auto"
                  loop={isLooping}
                  onEnded={() => handleSlotEnded(key)}
                  style={{
                    opacity: key === "IDLE" ? 1 : (isActive ? 1 : 0),
                    zIndex: key === "IDLE" ? 5 : (isActive ? 10 : 6),
                    pointerEvents: isActive ? "auto" : "none",
                    willChange: "opacity",
                  }}
                  onError={(e) => console.error(`[Haya ${key}] Critical stream error:`, e)}
                  className="absolute inset-0 w-full h-full object-contain transition-opacity duration-500 transform scale-100"
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
