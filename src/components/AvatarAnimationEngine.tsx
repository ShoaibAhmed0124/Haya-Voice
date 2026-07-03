import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AssistantState } from "../types";

export type EngineState = "IDLE" | "LISTENING" | "TALKING" | "WAVING" | "STRETCHING";

interface AvatarAnimationEngineProps {
  state: AssistantState;
  playbackAnalyser: AnalyserNode | null;
  microphoneAnalyser: AnalyserNode | null;
  glowColorRGB?: string;
  selectedPersona?: string;
  transcript?: string;
  isManualGlitching?: boolean;
  forcedBehavior?: any;
  theme?: string;
}

interface TouchRipple {
  id: number;
  x: number;
  y: number;
}

// 3D Icosahedron Geometry Coordinates for our Premium Living Crystal Core
const phi = (1 + Math.sqrt(5)) / 2;
const ICOSA_VERTICES = [
  [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
  [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
  [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
].map(v => {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / len, v[1] / len, v[2] / len]; // Normalized coordinates
});

const ICOSA_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
];

export default function AvatarAnimationEngine({
  state,
  playbackAnalyser,
  microphoneAnalyser,
  glowColorRGB = "147, 51, 234",
  selectedPersona = "assistant",
  transcript = "",
  isManualGlitching = false,
  forcedBehavior = null,
  theme = "midnight",
}: AvatarAnimationEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<number>(0);
  const volumeLevelRef = useRef<number>(0);
  const [ripples, setRipples] = useState<TouchRipple[]>([]);
  const rippleIdCounter = useRef<number>(0);

  const isLight = theme === "light";

  // Audio analyzer loop
  useEffect(() => {
    let active = true;
    const dataArray = new Uint8Array(64);

    const analyzeAudio = () => {
      if (!active) return;
      let volume = 0;

      if (state === "listening" && microphoneAnalyser) {
        microphoneAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 32; i++) {
          sum += dataArray[i];
        }
        volume = sum / 32 / 255;
      } else if (state === "speaking" && playbackAnalyser) {
        playbackAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 32; i++) {
          sum += dataArray[i];
        }
        volume = sum / 32 / 255;
      }

      volumeLevelRef.current = volumeLevelRef.current * 0.75 + volume * 0.25;
      requestAnimationFrame(analyzeAudio);
    };

    analyzeAudio();
    return () => {
      active = false;
    };
  }, [state, playbackAnalyser, microphoneAnalyser]);

  // Canvas drawing loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = canvas.parentElement?.clientWidth || 280;
        canvas.height = canvas.parentElement?.clientHeight || 280;
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const render = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Keep crystal core bounded nicely
      const radius = Math.min(w, h) / 2.7;

      const amp = volumeLevelRef.current;
      // Phase speeds up dynamically based on audio amplitude
      phaseRef.current += 0.008 + (amp * 0.05);
      const phase = phaseRef.current;

      ctx.save();

      // 1. MAIN ROUND GLASS MARBLE CLIPPING PATH
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // Glass internal base
      const glassBg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      if (isLight) {
        glassBg.addColorStop(0, "rgba(255, 255, 255, 0.85)");
        glassBg.addColorStop(0.6, "rgba(245, 240, 255, 0.5)");
        glassBg.addColorStop(1, "rgba(230, 220, 255, 0.3)");
      } else {
        glassBg.addColorStop(0, "rgba(6, 8, 16, 0.95)");
        glassBg.addColorStop(0.6, "rgba(13, 10, 24, 0.85)");
        glassBg.addColorStop(1, "rgba(3, 2, 8, 0.98)");
      }
      ctx.fillStyle = glassBg;
      ctx.fillRect(0, 0, w, h);

      // 2. LAYER B: Liquid Light Waves flowing in the background
      const waveCount = 2;
      const rgbArray = glowColorRGB.split(",").map(v => parseInt(v.trim()));
      const waveColors = [
        `rgba(${rgbArray[0]}, ${rgbArray[1]}, ${rgbArray[2]}, 0.3)`,
        `rgba(${Math.min(255, rgbArray[0] + 40)}, ${Math.max(0, rgbArray[1] - 20)}, ${Math.min(255, rgbArray[2] + 40)}, 0.15)`,
      ];

      for (let i = 0; i < waveCount; i++) {
        ctx.beginPath();
        const frequency = 0.015 + i * 0.008;
        const speed = phase * (0.6 + i * 0.3);
        let baseAmp = 8 + i * 4;
        if (state === "speaking") baseAmp = 14 + i * 8;
        if (state === "listening") baseAmp = 12 + i * 6;

        const waveAmplitude = baseAmp * (1 + amp * 3);
        const baselineY = cy + (i * 12) + (state === "listening" ? -10 : state === "speaking" ? 10 : 0);

        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 6) {
          const y = baselineY + Math.sin(x * frequency + speed) * waveAmplitude;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, baselineY - waveAmplitude * 1.5, 0, h);
        grad.addColorStop(0, waveColors[i]);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.globalCompositeOperation = isLight ? "multiply" : "screen";
        ctx.fill();
      }

      // 3. LAYER C: 3D faceted crystal projection
      const crystalScale = radius * 0.82;
      const rotX = phase * 0.22;
      const rotY = phase * 0.35;
      const rotZ = phase * 0.15;

      // Project vertices
      const rotatedVertices = ICOSA_VERTICES.map(v => {
        // Rotate X
        let y1 = v[1] * Math.cos(rotX) - v[2] * Math.sin(rotX);
        let z1 = v[1] * Math.sin(rotX) + v[2] * Math.cos(rotX);
        // Rotate Y
        let x2 = v[0] * Math.cos(rotY) + z1 * Math.sin(rotY);
        let z2 = -v[0] * Math.sin(rotY) + z1 * Math.cos(rotY);
        // Rotate Z
        let x3 = x2 * Math.cos(rotZ) - y1 * Math.sin(rotZ);
        let y3 = x2 * Math.sin(rotZ) + y1 * Math.cos(rotZ);

        return [x3, y3, z2]; // [x, y, z] rotated
      });

      // Map faces with depth sorting (Painters algorithm for transparent 3D)
      const sortedFaces = ICOSA_FACES.map((face, idx) => {
        const zAvg = (rotatedVertices[face[0]][2] + rotatedVertices[face[1]][2] + rotatedVertices[face[2]][2]) / 3;
        return { face, zAvg, idx };
      }).sort((a, b) => a.zAvg - b.zAvg);

      // Draw faces
      sortedFaces.forEach(({ face, zAvg }) => {
        const v0 = rotatedVertices[face[0]];
        const v1 = rotatedVertices[face[1]];
        const v2 = rotatedVertices[face[2]];

        const x0 = cx + v0[0] * crystalScale;
        const y0 = cy + v0[1] * crystalScale;
        const x1 = cx + v1[0] * crystalScale;
        const y1 = cy + v1[1] * crystalScale;
        const x2 = cx + v2[0] * crystalScale;
        const y2 = cy + v2[1] * crystalScale;

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();

        // Separate back vs front face rendering for absolute refraction depth
        if (zAvg <= 0.05) {
          // BACK FACES: subtle wireframe and soft glow
          ctx.fillStyle = `rgba(${glowColorRGB}, 0.03)`;
          ctx.fill();
          ctx.strokeStyle = `rgba(${glowColorRGB}, 0.12)`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        } else {
          // FRONT FACES: premium chromatic crystal gradients
          const gradient = ctx.createLinearGradient(x0, y0, (x1 + x2) / 2, (y1 + y2) / 2);
          // High-end glass reflections combining crystal primary with cyan aberration
          if (isLight) {
            gradient.addColorStop(0, "rgba(255, 255, 255, 0.55)");
            gradient.addColorStop(0.5, `rgba(${glowColorRGB}, 0.2)`);
            gradient.addColorStop(1, "rgba(34, 211, 238, 0.15)");
          } else {
            gradient.addColorStop(0, "rgba(255, 255, 255, 0.35)");
            gradient.addColorStop(0.4, `rgba(${glowColorRGB}, 0.18)`);
            gradient.addColorStop(0.8, "rgba(34, 211, 238, 0.12)");
            gradient.addColorStop(1, "rgba(139, 92, 246, 0.05)");
          }

          ctx.fillStyle = gradient;
          ctx.globalCompositeOperation = isLight ? "multiply" : "screen";
          ctx.fill();

          // Sharp, shiny crystal edge stroke
          ctx.strokeStyle = `rgba(255, 255, 255, ${isLight ? 0.4 : 0.28 + amp * 0.4})`;
          ctx.lineWidth = 1.0;
          ctx.stroke();
        }
      });

      // 4. LAYER D: Internal Energy Nucleus Core
      const innerCoreRadius = crystalScale * (0.32 + amp * 0.38);
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerCoreRadius);
      coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      coreGrad.addColorStop(0.25, `rgba(${glowColorRGB}, 0.85)`);
      coreGrad.addColorStop(0.6, "rgba(139, 92, 246, 0.35)");
      coreGrad.addColorStop(0.9, "rgba(34, 211, 238, 0.08)");
      coreGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = coreGrad;
      ctx.globalCompositeOperation = "screen";
      ctx.beginPath();
      ctx.arc(cx, cy, innerCoreRadius, 0, Math.PI * 2);
      ctx.fill();

      // 5. LAYER E: Orbiting/Floating stardust particles inside
      const pCount = 14;
      for (let i = 0; i < pCount; i++) {
        const pAngle = phase * (0.15 + (i % 3) * 0.08) + (i * Math.PI * 2) / pCount;
        const pDist = crystalScale * (0.2 + 0.55 * Math.sin(phase * 0.3 + i));
        const px = cx + Math.cos(pAngle) * pDist;
        const py = cy + Math.sin(pAngle) * pDist;
        const pSize = 1.2 + 1.8 * Math.sin(phase * 0.7 + i);

        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.6, pSize), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${i % 2 === 0 ? "34, 211, 238" : "255, 255, 255"}, ${0.35 + 0.45 * Math.sin(phase + i)})`;
        ctx.shadowColor = `rgb(${glowColorRGB})`;
        ctx.shadowBlur = isLight ? 0 : 5;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      // 6. PREMIUM BLOWN GLASS OUTER SHINE AND SPECULAR BEZEL
      const rimGrad = ctx.createRadialGradient(cx, cy, radius - 4, cx, cy, radius + 2);
      if (isLight) {
        rimGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
        rimGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.7)");
        rimGrad.addColorStop(0.95, `rgba(${glowColorRGB}, 0.2)`);
        rimGrad.addColorStop(1, `rgba(${glowColorRGB}, 0.05)`);
      } else {
        rimGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
        rimGrad.addColorStop(0.6, `rgba(${glowColorRGB}, 0.15)`);
        rimGrad.addColorStop(0.95, "rgba(255, 255, 255, 0.45)");
        rimGrad.addColorStop(1, `rgba(${glowColorRGB}, 0.3)`);
      }
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [glowColorRGB, state, isLight]);

  // Touch trigger ripples
  const handleOrbClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple: TouchRipple = {
      id: ++rippleIdCounter.current,
      x,
      y,
    };

    setRipples((prev) => [...prev, newRipple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 1500);
  };

  // State-specific soft breathing layout configurations
  const getGlowVariant = () => {
    switch (state) {
      case "listening":
        return {
          scale: [1, 1.05, 1],
          opacity: isLight ? [0.4, 0.65, 0.4] : [0.55, 0.85, 0.55],
          transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
        };
      case "speaking":
        return {
          scale: [1, 1.08, 1],
          opacity: isLight ? [0.45, 0.75, 0.45] : [0.65, 0.98, 0.65],
          transition: { repeat: Infinity, duration: 1.3, ease: "easeInOut" },
        };
      case "connecting":
        return {
          scale: [0.97, 1.03, 0.97],
          opacity: isLight ? [0.35, 0.55, 0.35] : [0.45, 0.7, 0.45],
          transition: { repeat: Infinity, duration: 2.0, ease: "easeInOut" },
        };
      case "disconnected":
      case "error":
        return {
          scale: 1,
          opacity: isLight ? 0.22 : 0.32,
        };
      default:
        return {
          scale: [1, 1.02, 1],
          opacity: isLight ? [0.3, 0.42, 0.3] : [0.42, 0.58, 0.42],
          transition: { repeat: Infinity, duration: 3.0, ease: "easeInOut" },
        };
    }
  };

  return (
    <div
      onClick={handleOrbClick}
      className="relative w-full h-full flex items-center justify-center cursor-pointer select-none"
    >
      {/* 1. LAYER 1: Multi-ring Ambient Aura Lighting behind the crystal core */}
      <motion.div
        animate={getGlowVariant()}
        style={{
          boxShadow: isLight
            ? `0 0 110px 35px rgba(${glowColorRGB}, 0.22), 0 0 160px 55px rgba(56, 189, 248, 0.12)`
            : `0 0 130px 45px rgba(${glowColorRGB}, 0.38), 0 0 210px 75px rgba(6, 182, 212, 0.2)`,
          width: "215px",
          height: "215px",
        }}
        className="absolute rounded-full pointer-events-none z-0 blur-[45px] transition-all duration-700"
      />

      {/* 2. LAYER 2: Double rotating conic chromatic back flare */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: state === "connecting" ? 4.5 : 24, ease: "linear" }}
        style={{
          background: `conic-gradient(from 0deg, rgba(${glowColorRGB}, 0.45) 0%, rgba(34, 211, 238, 0.25) 30%, rgba(${glowColorRGB}, 0.05) 65%, rgba(${glowColorRGB}, 0.45) 100%)`,
          width: "245px",
          height: "245px",
          willChange: "transform",
        }}
        className="absolute rounded-full pointer-events-none z-0 blur-[26px] opacity-75"
      />

      {/* 3. LAYER 3: Touch ripples */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-full">
        <AnimatePresence>
          {ripples.map((ripple) => (
            <motion.span
              key={ripple.id}
              initial={{ scale: 0, opacity: 0.85 }}
              animate={{ scale: 4.8, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, ease: "easeOut" }}
              style={{
                left: ripple.x,
                top: ripple.y,
                borderColor: `rgba(${glowColorRGB}, 0.5)`,
                boxShadow: `0 0 16px rgba(${glowColorRGB}, 0.3)`,
              }}
              className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full border border-double"
            />
          ))}
        </AnimatePresence>
      </div>

      {/* 4. LAYER 4: The Core Glass Orb Canvas hosting the Rotating Living Crystal */}
      <div className="relative w-[280px] h-[280px] flex items-center justify-center z-10 rounded-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none rounded-full"
        />

        {/* Gloss highlight: Hand-blown glass light sheen */}
        <div
          className="absolute top-4 left-6 w-[190px] h-[95px] rounded-[50%] bg-gradient-to-b from-white/35 via-white/4 to-transparent pointer-events-none z-20 blur-[1px]"
          style={{ transform: "rotate(-25deg)" }}
        />

        {/* Sphere Crescent Rim Shadow for intense visual depth */}
        <div className="absolute inset-0 rounded-full border border-white/5 shadow-[inset_0_-14px_28px_rgba(0,0,0,0.7),inset_0_12px_24px_rgba(255,255,255,0.12)] pointer-events-none z-20" />
      </div>

      {/* 5. LAYER 5: Sparkling particle aura around crystal pedestal */}
      {!isLight && state === "connecting" && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.4, y: 15 }}
              animate={{
                opacity: [0, 0.9, 0],
                scale: [0.4, 1.25, 0.4],
                y: [-15, -60],
                x: [0, (i % 2 === 0 ? 18 : -18)],
              }}
              transition={{
                repeat: Infinity,
                duration: 1.4 + i * 0.25,
                delay: i * 0.15,
                ease: "easeOut",
              }}
              style={{
                left: `calc(50% + ${i * 12 - 42}px)`,
                top: "45%",
                backgroundColor: `rgba(${glowColorRGB}, 0.85)`,
              }}
              className="absolute w-1.5 h-1.5 rounded-full blur-[0.4px]"
            />
          ))}
        </div>
      )}
    </div>
  );
}
