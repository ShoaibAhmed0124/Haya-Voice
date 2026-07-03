import React, { useEffect, useRef, useState } from "react";

export type AmbientVisualType =
  | "glowing_orb"
  | "liquid_gradient"
  | "aurora"
  | "neon_ribbons"
  | "galaxy"
  | "glass_particles"
  | "geometric"
  | "soft_rain"
  | "cyberpunk"
  | "energy_field"
  | "bioluminescence";

export const AMBIENT_VISUALS: { id: AmbientVisualType; name: string; desc: string }[] = [
  { id: "glowing_orb", name: "Pulsing Voice Orb", desc: "A satisfying glowing energy sphere reacting to voice" },
  { id: "liquid_gradient", name: "Liquid Gradient Motion", desc: "Smooth blending colors flowing in deep space" },
  { id: "neon_ribbons", name: "Flowing Neon Ribbons", desc: "Neon wave-strands pulsing with energy" },
  { id: "galaxy", name: "Animated Cosmic Galaxy", desc: "Slow rotating spiral stars and dust clouds" },
  { id: "glass_particles", name: "Floating Glass Particles", desc: "Translucent frosted spheres drifting slowly" },
  { id: "geometric", name: "Minimal Glowing Shapes", desc: "Wireframe geometries morphing in 3D space" },
  { id: "soft_rain", name: "Soft Rain & Bokeh", desc: "Cozy blurred lights beneath a gentle rainfall" },
  { id: "cyberpunk", name: "Cyberpunk Holograms", desc: "Tech gridlines and glowing scanning sweeps" },
  { id: "energy_field", name: "Abstract Energy Field", desc: "A swarm of organic energy vectors swirling around" },
  { id: "bioluminescence", name: "Ocean Bioluminescence", desc: "Deep water neon particles reacting to current waves" },
];

interface AmbientVisualizerProps {
  type: AmbientVisualType;
  playbackAnalyser: AnalyserNode | null;
  microphoneAnalyser: AnalyserNode | null;
  state: string;
  selectedPersona?: string;
  glowColorRGB?: string; // e.g. "34, 211, 238"
  theme?: string;
}

export default function AmbientVisualizer({
  type,
  playbackAnalyser,
  microphoneAnalyser,
  state,
  selectedPersona,
  glowColorRGB = "147, 51, 234",
  theme = "midnight",
}: AmbientVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Audio peak tracking
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const audioVolumeRef = useRef<number>(0);

  // Color mapping based on persona to blend ambient colors nicely
  const getPersonaColors = () => {
    switch (selectedPersona) {
      case "assistant":
        return ["rgba(34, 211, 238, 0.3)", "rgba(59, 130, 246, 0.2)", "rgba(147, 51, 234, 0.15)"];
      case "therapist":
        return ["rgba(16, 185, 129, 0.3)", "rgba(20, 184, 166, 0.2)", "rgba(6, 182, 212, 0.15)"];
      case "conspiracy":
        return ["rgba(245, 158, 11, 0.3)", "rgba(217, 119, 6, 0.2)", "rgba(239, 68, 68, 0.15)"];
      case "unhinged":
        return ["rgba(139, 92, 246, 0.35)", "rgba(217, 70, 239, 0.25)", "rgba(239, 68, 68, 0.2)"];
      case "motivation":
        return ["rgba(239, 68, 68, 0.3)", "rgba(244, 63, 94, 0.25)", "rgba(249, 115, 22, 0.15)"];
      case "romantic":
        return ["rgba(236, 72, 153, 0.35)", "rgba(244, 63, 94, 0.25)", "rgba(168, 85, 247, 0.2)"];
      case "sexy":
        return ["rgba(168, 85, 247, 0.35)", "rgba(236, 72, 153, 0.25)", "rgba(99, 102, 241, 0.2)"];
      case "career":
        return ["rgba(99, 102, 241, 0.3)", "rgba(59, 130, 246, 0.2)", "rgba(79, 70, 229, 0.15)"];
      case "trading":
        return ["rgba(16, 185, 129, 0.3)", "rgba(52, 211, 153, 0.2)", "rgba(15, 23, 42, 0.15)"];
      default:
        return [`rgba(${glowColorRGB}, 0.3)`, "rgba(59, 130, 246, 0.2)", "rgba(15, 23, 42, 0.15)"];
    }
  };

  // Resize canvas according to the container
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Audio level monitoring loop
  useEffect(() => {
    let isActive = true;
    const pData = new Uint8Array(playbackAnalyser ? playbackAnalyser.frequencyBinCount : 0);
    const mData = new Uint8Array(microphoneAnalyser ? microphoneAnalyser.frequencyBinCount : 0);

    const updateAudioLevels = () => {
      if (!isActive) return;

      let total = 0;
      let count = 0;

      if (playbackAnalyser && state === "speaking") {
        playbackAnalyser.getByteFrequencyData(pData);
        for (let i = 0; i < pData.length; i++) {
          total += pData[i];
          count++;
        }
      }

      if (microphoneAnalyser && state === "listening") {
        microphoneAnalyser.getByteFrequencyData(mData);
        for (let i = 0; i < mData.length; i++) {
          total += mData[i];
          count++;
        }
      }

      const average = count > 0 ? total / count : 0;
      // Normalize to 0 - 1
      const normalized = Math.min(average / 128, 1.0);
      // Fast attack, slow decay
      if (normalized > audioVolumeRef.current) {
        audioVolumeRef.current = normalized;
      } else {
        audioVolumeRef.current = audioVolumeRef.current * 0.9 + normalized * 0.1;
      }

      setAudioVolume(audioVolumeRef.current);
      requestAnimationFrame(updateAudioLevels);
    };

    updateAudioLevels();
    return () => {
      isActive = false;
    };
  }, [playbackAnalyser, microphoneAnalyser, state]);

  // Main rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;

    // Helper particle models depending on visualization chosen
    // Keep count lightweight for GPU safety
    const particles: any[] = [];
    const maxParticles = 60;

    // Initialize particles once based on type
    const initParticles = () => {
      particles.length = 0;
      const w = canvas.width;
      const h = canvas.height;

      if (type === "glowing_orb") {
        for (let i = 0; i < 40; i++) {
          particles.push({
            angle: Math.random() * Math.PI * 2,
            distance: 50 + Math.random() * 120,
            speed: (0.003 + Math.random() * 0.008) * (Math.random() > 0.5 ? 1 : -1),
            size: 1.0 + Math.random() * 2.2,
            opacity: 0.2 + Math.random() * 0.6,
            phase: Math.random() * Math.PI * 2,
            pulseSpeed: 0.01 + Math.random() * 0.02,
          });
        }
      } else if (type === "galaxy") {
        for (let i = 0; i < 120; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.random() * Math.min(w, h) * 0.45 + 10;
          particles.push({
            angle,
            distance,
            speed: (0.001 + Math.random() * 0.002) * (Math.random() > 0.5 ? 1 : -1),
            size: 0.8 + Math.random() * 1.8,
            color: Math.random() > 0.3 ? "#ffffff" : `rgba(${glowColorRGB}, 0.8)`,
          });
        }
      } else if (type === "glass_particles" || type === "bioluminescence") {
        for (let i = 0; i < maxParticles; i++) {
          particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.4,
            vy: -0.2 - Math.random() * 0.8,
            size: type === "glass_particles" ? 8 + Math.random() * 24 : 1.5 + Math.random() * 3.5,
            alpha: 0.1 + Math.random() * 0.4,
            glow: Math.random() > 0.6,
          });
        }
      } else if (type === "soft_rain") {
        // Raindrops
        for (let i = 0; i < 40; i++) {
          particles.push({
            x: Math.random() * w,
            y: Math.random() * h - h,
            vy: 4 + Math.random() * 6,
            length: 12 + Math.random() * 15,
            opacity: 0.1 + Math.random() * 0.25,
          });
        }
        // Bokeh lights (store in state array under particles)
        for (let i = 0; i < 15; i++) {
          particles.push({
            isBokeh: true,
            x: Math.random() * w,
            y: Math.random() * h,
            size: 30 + Math.random() * 60,
            alpha: 0.02 + Math.random() * 0.08,
            color: Math.random() > 0.5 ? `rgba(${glowColorRGB}, 0.3)` : "rgba(59, 130, 246, 0.3)",
            speed: 0.002 + Math.random() * 0.003,
            phase: Math.random() * Math.PI * 2,
          });
        }
      } else if (type === "energy_field") {
        for (let i = 0; i < 70; i++) {
          particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: 0,
            vy: 0,
            life: Math.random() * 100,
            maxLife: 80 + Math.random() * 100,
            color: `rgba(${glowColorRGB}, ${0.15 + Math.random() * 0.4})`,
            size: 1 + Math.random() * 2,
          });
        }
      }
    };

    initParticles();

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) {
        animationFrameId.current = requestAnimationFrame(render);
        return;
      }

      time += 0.01;
      const peak = audioVolumeRef.current; // peak intensity (0 - 1)
      const personaColors = getPersonaColors();

      ctx.save();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      const dw = w / window.devicePixelRatio;
      const dh = h / window.devicePixelRatio;

      const isLight = theme === "light";
      const clearBackground = (darkColor: string) => {
        if (isLight) {
          ctx.clearRect(0, 0, dw, dh);
        } else {
          ctx.fillStyle = darkColor;
          ctx.fillRect(0, 0, dw, dh);
        }
      };

      // Render styles
      if (type === "glowing_orb") {
        // Clear background with extremely clean transparent backdrop
        if (isLight) {
          ctx.clearRect(0, 0, dw, dh);
        } else {
          ctx.fillStyle = "#020204";
          ctx.fillRect(0, 0, dw, dh);
        }

        const isOffline = state === "disconnected";

        // 1. Precise Floating Motion Offset
        const floatOffset = Math.sin(time * 1.0) * 8;
        const centerX = dw / 2;
        const centerY = dh / 2 + floatOffset - 25; // elegant vertical lift

        // Dynamic breathing scale
        const breathe = 1.0 + Math.sin(time * 1.5) * 0.02 + peak * 0.18;
        const baseRadius = Math.min(dw, dh) * 0.165;
        const currentRadius = baseRadius * breathe;

        // 2. Soft Shadow Beneath (3D volumetric depth)
        const shadowY = centerY + currentRadius + 35;
        const shadowScale = (1.0 - floatOffset / 110) * breathe;
        const shadowWidth = currentRadius * 0.85 * shadowScale;
        const shadowHeight = 8 * shadowScale;

        const shadowGrad = ctx.createRadialGradient(centerX, shadowY, 0, centerX, shadowY, shadowWidth);
        shadowGrad.addColorStop(0, isLight ? "rgba(147, 51, 234, 0.08)" : "rgba(0, 0, 0, 0.5)");
        shadowGrad.addColorStop(0.5, isLight ? "rgba(147, 51, 234, 0.02)" : "rgba(0, 0, 0, 0.25)");
        shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        
        ctx.save();
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(centerX, shadowY, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 3. Volumetric Soft Background Aura Glow
        if (!isOffline) {
          const auraRad = currentRadius * 2.5;
          const auraGrad = ctx.createRadialGradient(centerX, centerY, currentRadius * 0.5, centerX, centerY, auraRad);
          auraGrad.addColorStop(0, `rgba(${glowColorRGB}, ${isLight ? 0.07 : 0.13})`);
          auraGrad.addColorStop(0.6, `rgba(${glowColorRGB}, ${isLight ? 0.02 : 0.04})`);
          auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, auraRad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 4. Gentle Listening Ripples (Smooth waves outward)
        if (state === "listening" && !isOffline) {
          const rippleCount = 2;
          for (let i = 0; i < rippleCount; i++) {
            const progress = ((time * 0.6 + i / rippleCount) % 1.0);
            const rippleRad = currentRadius * (1.0 + progress * 0.55);
            const rippleAlpha = (1.0 - progress) * 0.16;
            ctx.save();
            ctx.strokeStyle = `rgba(${glowColorRGB}, ${rippleAlpha})`;
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.arc(centerX, centerY, rippleRad, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }

        // 5. Begin Spherical Crystal Core Clipping Area (Limits stars/refractions to inside the sphere)
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
        ctx.clip();

        // -- Spherical Dark Velvet Base (adds volume to the glass ball) --
        const sphereBaseGrad = ctx.createRadialGradient(
          centerX - currentRadius * 0.2,
          centerY - currentRadius * 0.2,
          0,
          centerX,
          centerY,
          currentRadius
        );
        if (isOffline) {
          sphereBaseGrad.addColorStop(0, isLight ? "#f0f0f4" : "#1a1a24");
          sphereBaseGrad.addColorStop(1, isLight ? "#d1d1db" : "#0a0a0f");
        } else {
          sphereBaseGrad.addColorStop(0, isLight ? "#faf5ff" : "#120d20");
          sphereBaseGrad.addColorStop(0.7, isLight ? "#e9e3f5" : "#090612");
          sphereBaseGrad.addColorStop(1, isLight ? "#d2cbe3" : "#020105");
        }
        ctx.fillStyle = sphereBaseGrad;
        ctx.fill();

        // -- Core Intense Light Glow --
        if (!isOffline) {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          const coreGlowRad = currentRadius * (0.45 + peak * 0.15);
          const coreGlowGrad = ctx.createRadialGradient(
            centerX - currentRadius * 0.1,
            centerY - currentRadius * 0.1,
            0,
            centerX,
            centerY,
            coreGlowRad
          );
          coreGlowGrad.addColorStop(0, `rgba(${glowColorRGB}, 0.65)`);
          coreGlowGrad.addColorStop(0.5, `rgba(${glowColorRGB}, 0.2)`);
          coreGlowGrad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = coreGlowGrad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, coreGlowRad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // -- Thinking / Energy Swirls inside --
        if (state === "thinking" && !isOffline) {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          const swirlCount = 3;
          for (let i = 0; i < swirlCount; i++) {
            const angleOffset = (i * Math.PI * 2) / swirlCount + time * 3.5;
            const swirlRad = currentRadius * 0.5;
            const sx = centerX + Math.cos(angleOffset) * swirlRad * 0.35;
            const sy = centerY + Math.sin(angleOffset * 1.3) * swirlRad * 0.25;
            
            const swirlGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, swirlRad * 0.65);
            swirlGrad.addColorStop(0, `rgba(${glowColorRGB}, 0.55)`);
            swirlGrad.addColorStop(0.5, `rgba(${glowColorRGB}, 0.15)`);
            swirlGrad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = swirlGrad;
            ctx.beginPath();
            ctx.arc(sx, sy, swirlRad * 0.65, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // -- 3D Crystallized Geometric Facets (Internal refraction mesh) --
        const rotateAndProject = (lat: number, lon: number, radius: number) => {
          const x3d = Math.cos(lat) * Math.sin(lon);
          const y3d = Math.sin(lat);
          const z3d = Math.cos(lat) * Math.cos(lon);
          
          // Speed of rotation depends on active state
          const rotY = time * 0.15 + (state === "thinking" ? time * 0.4 : 0);
          const rotX = Math.sin(time * 0.3) * 0.15;
          
          // Y axis rotation
          const x1 = x3d * Math.cos(rotY) - z3d * Math.sin(rotY);
          const z1 = x3d * Math.sin(rotY) + z3d * Math.cos(rotY);
          
          // X axis rotation
          const y2 = y3d * Math.cos(rotX) - z1 * Math.sin(rotX);
          const z2 = y3d * Math.sin(rotX) + z1 * Math.cos(rotX);
          
          const scale = 1.0 + z2 * 0.1;
          return {
            x: centerX + x1 * radius * scale,
            y: centerY + y2 * radius * scale,
            z: z2
          };
        };

        const rings = 4;
        const cols = 10;
        for (let r = 0; r < rings; r++) {
          const lat1 = -Math.PI / 2 + (r * Math.PI) / rings;
          const lat2 = -Math.PI / 2 + ((r + 1) * Math.PI) / rings;
          
          for (let c = 0; c < cols; c++) {
            const lon1 = (c * Math.PI * 2) / cols;
            const lon2 = ((c + 1) * Math.PI * 2) / cols;
            
            const p1 = rotateAndProject(lat1, lon1, currentRadius);
            const p2 = rotateAndProject(lat1, lon2, currentRadius);
            const p3 = rotateAndProject(lat2, lon2, currentRadius);
            const p4 = rotateAndProject(lat2, lon1, currentRadius);
            
            const avgZ = (p1.z + p2.z + p3.z + p4.z) / 4;
            // Draw front-facing facets for beautiful 3D refractions
            if (avgZ > -0.1) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.lineTo(p3.x, p3.y);
              ctx.lineTo(p4.x, p4.y);
              ctx.closePath();
              
              const facetOpacity = (0.04 + (avgZ + 1.0) * 0.08) * (1.0 + peak * 1.1);
              
              if (isOffline) {
                ctx.fillStyle = `rgba(${isLight ? "160, 160, 170" : "110, 110, 125"}, ${facetOpacity * 0.65})`;
              } else {
                ctx.fillStyle = `rgba(${glowColorRGB}, ${facetOpacity})`;
              }
              ctx.fill();
              
              const strokeOpacity = (0.05 + (avgZ + 1.0) * 0.07) * (1.0 + peak * 1.0);
              ctx.strokeStyle = isOffline
                ? `rgba(${isLight ? "180, 180, 180" : "75, 75, 90"}, ${strokeOpacity * 0.5})`
                : `rgba(255, 255, 255, ${strokeOpacity})`;
              ctx.lineWidth = 0.6 + (avgZ + 1.0) * 0.25;
              ctx.stroke();
            }
          }
        }

        // -- Tiny Sparkling Internal Stars (Bounded inside orb only) --
        particles.forEach((p) => {
          p.angle += p.speed * (0.8 + peak * 2.0);
          p.phase += p.pulseSpeed;
          
          // Keep floating stars strictly bounded and responsive
          const orbitRadius = p.distance * currentRadius * 0.95;
          const x = centerX + Math.cos(p.angle) * orbitRadius;
          const y = centerY + Math.sin(p.angle) * orbitRadius;
          
          const sparkSize = p.size * (0.85 + peak * 0.8);
          const sparkOpacity = p.opacity * (0.45 + Math.sin(p.phase) * 0.45) * (1.0 + peak * 1.2);
          
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          if (isOffline) {
            ctx.fillStyle = `rgba(${isLight ? "100, 100, 100" : "220, 220, 225"}, ${sparkOpacity * 0.4})`;
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${sparkOpacity})`;
          }
          ctx.beginPath();
          ctx.arc(x, y, sparkSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // Restore clipped region so we can draw outer crystal highlights and reflections over boundaries
        ctx.restore();

        // 6. Realistic Polished Crystal Glass Reflections (Studio glossy lighting)
        ctx.save();
        ctx.globalCompositeOperation = "source-over";

        // Curved soft volumetric top-left reflection
        const reflectGrad = ctx.createLinearGradient(
          centerX - currentRadius * 0.5,
          centerY - currentRadius * 0.5,
          centerX + currentRadius * 0.3,
          centerY + currentRadius * 0.3
        );
        reflectGrad.addColorStop(0, "rgba(255, 255, 255, 0.42)");
        reflectGrad.addColorStop(0.35, "rgba(255, 255, 255, 0.12)");
        reflectGrad.addColorStop(0.7, "rgba(255, 255, 255, 0)");
        
        ctx.fillStyle = reflectGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Intense Specular Spotlight Reflection Node (Top Left)
        const specGrad = ctx.createRadialGradient(
          centerX - currentRadius * 0.38,
          centerY - currentRadius * 0.38,
          0,
          centerX - currentRadius * 0.38,
          centerY - currentRadius * 0.38,
          currentRadius * 0.3
        );
        specGrad.addColorStop(0, "rgba(255, 255, 255, 0.8)");
        specGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.22)");
        specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        
        ctx.fillStyle = specGrad;
        ctx.beginPath();
        ctx.arc(centerX - currentRadius * 0.38, centerY - currentRadius * 0.38, currentRadius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Beautiful bottom-right crescent refraction (simulates glass body thickness)
        const glassRimGrad = ctx.createRadialGradient(
          centerX + currentRadius * 0.3,
          centerY + currentRadius * 0.3,
          currentRadius * 0.6,
          centerX + currentRadius * 0.3,
          centerY + currentRadius * 0.3,
          currentRadius * 1.0
        );
        if (isOffline) {
          glassRimGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
          glassRimGrad.addColorStop(0.85, "rgba(255, 255, 255, 0.04)");
          glassRimGrad.addColorStop(1, "rgba(255, 255, 255, 0.15)");
        } else {
          glassRimGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
          glassRimGrad.addColorStop(0.8, `rgba(${glowColorRGB}, 0.05)`);
          glassRimGrad.addColorStop(0.95, `rgba(${glowColorRGB}, 0.12)`);
          glassRimGrad.addColorStop(1, "rgba(255, 255, 255, 0.28)");
        }
        ctx.fillStyle = glassRimGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Elegant razor-thin Outer Glistening Rim
        ctx.strokeStyle = isLight ? "rgba(255, 255, 255, 0.65)" : "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius - 0.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }

      else if (type === "liquid_gradient") {
        clearBackground("#02040a");

        // Blending fluid gradients
        ctx.globalCompositeOperation = "screen";

        const blobs = [
          {
            x: dw * 0.3 + Math.sin(time * 0.5) * dw * 0.15,
            y: dh * 0.4 + Math.cos(time * 0.6) * dh * 0.12,
            radius: Math.min(dw, dh) * (0.35 + peak * 0.08),
            color: personaColors[0],
          },
          {
            x: dw * 0.7 + Math.cos(time * 0.4) * dw * 0.18,
            y: dh * 0.6 + Math.sin(time * 0.7) * dh * 0.15,
            radius: Math.min(dw, dh) * (0.4 + peak * 0.1),
            color: personaColors[1],
          },
          {
            x: dw * 0.5 + Math.sin(time * 0.3) * dw * 0.12,
            y: dh * 0.7 + Math.cos(time * 0.5) * dh * 0.15,
            radius: Math.min(dw, dh) * (0.28 + peak * 0.06),
            color: personaColors[2],
          },
        ];

        blobs.forEach((b) => {
          const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius);
          grad.addColorStop(0, b.color);
          grad.addColorStop(0.5, b.color.replace("0.35", "0.15").replace("0.3", "0.1").replace("0.25", "0.08"));
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      else if (type === "aurora") {
        clearBackground("#02040a");

        // Render elegant flowing sine waves mimicking aurora borealis
        ctx.globalCompositeOperation = "screen";

        const waveCount = 4;
        const colorStops = [
          `rgba(${glowColorRGB}, 0.12)`,
          "rgba(59, 130, 246, 0.08)",
          "rgba(16, 185, 129, 0.06)",
          "rgba(147, 51, 234, 0.1)",
        ];

        for (let wIdx = 0; wIdx < waveCount; wIdx++) {
          ctx.beginPath();
          ctx.fillStyle = colorStops[wIdx % colorStops.length];

          const amplitude = (35 + wIdx * 12) * (1.0 + peak * 0.8);
          const frequency = 0.003 + wIdx * 0.001;
          const speed = (0.3 + wIdx * 0.15) * time;

          ctx.moveTo(0, dh);
          for (let x = 0; x <= dw; x += 10) {
            const y =
              dh * 0.5 +
              Math.sin(x * frequency + speed) * amplitude +
              Math.cos(x * 0.005 - speed * 0.5) * (amplitude * 0.4);
            ctx.lineTo(x, y);
          }

          ctx.lineTo(dw, dh);
          ctx.closePath();
          ctx.fill();
        }
      }

      else if (type === "neon_ribbons") {
        clearBackground("#030712");

        ctx.globalCompositeOperation = "screen";
        const ribbonCount = 3;

        for (let r = 0; r < ribbonCount; r++) {
          ctx.beginPath();
          ctx.lineWidth = (2 + r * 1.5) * (1.0 + peak * 1.5);
          ctx.strokeStyle = r === 0 
            ? `rgba(${glowColorRGB}, 0.6)` 
            : r === 1 ? "rgba(59, 130, 246, 0.5)" : "rgba(217, 70, 239, 0.4)";

          const waveFreq = 0.004 + r * 0.001;
          const shift = time * (0.8 + r * 0.2);

          for (let x = 0; x <= dw; x += 15) {
            const y = dh * 0.5 + Math.sin(x * waveFreq + shift) * 70 * Math.cos(x * 0.002 - shift * 0.3);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      else if (type === "galaxy") {
        clearBackground("#010206");

        // Central soft nebula background
        const nebulaGrad = ctx.createRadialGradient(dw / 2, dh / 2, 0, dw / 2, dh / 2, Math.min(dw, dh) * (0.4 + peak * 0.15));
        nebulaGrad.addColorStop(0, `rgba(${glowColorRGB}, 0.15)`);
        nebulaGrad.addColorStop(0.5, "rgba(59, 130, 246, 0.05)");
        nebulaGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = nebulaGrad;
        ctx.beginPath();
        ctx.arc(dw / 2, dh / 2, Math.min(dw, dh) * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Draw rotating stars
        ctx.fillStyle = "#ffffff";
        particles.forEach((p) => {
          p.angle += p.speed * (1.0 + peak * 3.0); // Spin faster with audio
          const x = dw / 2 + Math.cos(p.angle) * p.distance;
          const y = dh / 2 + Math.sin(p.angle) * p.distance;

          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(x, y, p.size * (1.0 + peak * 0.6), 0, Math.PI * 2);
          ctx.fill();
        });
      }

      else if (type === "glass_particles") {
        clearBackground("#05070f");

        particles.forEach((p) => {
          // Drifts upward
          p.y += p.vy * (1.0 + peak * 2.0);
          p.x += p.vx;

          // Wrap borders
          if (p.y < -50) {
            p.y = dh + 30;
            p.x = Math.random() * dw;
          }
          if (p.x < -30) p.x = dw + 30;
          if (p.x > dw + 30) p.x = -30;

          const size = p.size * (1.0 + peak * 0.4);

          // Render frosted translucent glass circle
          const grad = ctx.createRadialGradient(p.x - size * 0.2, p.y - size * 0.2, size * 0.1, p.x, p.y, size);
          grad.addColorStop(0, `rgba(255, 255, 255, ${p.alpha + 0.1})`);
          grad.addColorStop(0.6, `rgba(180, 195, 220, ${p.alpha * 0.4})`);
          grad.addColorStop(1, "rgba(255, 255, 255, 0.01)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();

          // Subtle rim border
          ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha * 0.25})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        });
      }

      else if (type === "geometric") {
        clearBackground("#020409");

        ctx.globalCompositeOperation = "screen";

        // Draw multiple nested geometric outlines rotating
        const centerX = dw / 2;
        const centerY = dh / 2;
        const sides = 6; // Hexagon
        const radius = Math.min(dw, dh) * 0.22 * (1.0 + peak * 0.25);

        ctx.strokeStyle = `rgba(${glowColorRGB}, 0.35)`;
        ctx.lineWidth = 1.5;

        // Render 3 spinning nested layers
        for (let layer = 0; layer < 3; layer++) {
          const lRadius = radius * (1.0 - layer * 0.28);
          const spin = time * 0.25 * (layer % 2 === 0 ? 1 : -1) + (layer * Math.PI) / 6;

          ctx.beginPath();
          for (let s = 0; s <= sides; s++) {
            const angle = (s * Math.PI * 2) / sides + spin;
            const x = centerX + Math.cos(angle) * lRadius;
            const y = centerY + Math.sin(angle) * lRadius;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();

          // Subtle neon dot vertices
          ctx.fillStyle = layer === 0 ? "rgba(59, 130, 246, 0.6)" : "rgba(236, 72, 153, 0.6)";
          for (let s = 0; s < sides; s++) {
            const angle = (s * Math.PI * 2) / sides + spin;
            const x = centerX + Math.cos(angle) * lRadius;
            const y = centerY + Math.sin(angle) * lRadius;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      else if (type === "soft_rain") {
        clearBackground("#020306");

        // Update and Draw bokeh backdrops
        particles.forEach((p) => {
          if (p.isBokeh) {
            p.phase += p.speed;
            const currentAlpha = p.alpha * (0.6 + Math.sin(p.phase) * 0.4) * (1.0 + peak * 1.5);
            
            const bokehGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            bokehGrad.addColorStop(0, p.color.replace(/0\.\d+\)/, `${currentAlpha})`));
            bokehGrad.addColorStop(1, "rgba(0,0,0,0)");

            ctx.fillStyle = bokehGrad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // It is raindrop
            p.y += p.vy * (1.0 + peak * 1.2);
            if (p.y > dh) {
              p.y = -p.length;
              p.x = Math.random() * dw;
            }

            ctx.strokeStyle = `rgba(156, 180, 255, ${p.opacity})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x, p.y + p.length);
            ctx.stroke();
          }
        });
      }

      else if (type === "cyberpunk") {
        clearBackground("#010204");

        // Draw horizontal scanning gridlines
        ctx.strokeStyle = "rgba(6, 182, 212, 0.035)";
        ctx.lineWidth = 1;
        const gridStep = 40;
        const gridOffset = (time * 15) % gridStep;

        for (let y = gridOffset; y < dh; y += gridStep) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(dw, y);
          ctx.stroke();
        }
        for (let x = 0; x < dw; x += gridStep) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, dh);
          ctx.stroke();
        }

        // Draw holographic scanning sweeps
        const sweepY = (time * 120) % (dh + 200) - 100;
        const sweepGrad = ctx.createLinearGradient(0, sweepY - 50, 0, sweepY + 50);
        sweepGrad.addColorStop(0, "rgba(6, 182, 212, 0)");
        sweepGrad.addColorStop(0.5, `rgba(${glowColorRGB}, ${0.12 + peak * 0.15})`);
        sweepGrad.addColorStop(1, "rgba(6, 182, 212, 0)");

        ctx.fillStyle = sweepGrad;
        ctx.fillRect(0, sweepY - 50, dw, 100);

        // Neon target scopes reacting to voice
        ctx.strokeStyle = `rgba(${glowColorRGB}, ${0.15 + peak * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(dw / 2, dh / 2, 45 + peak * 25, 0, Math.PI * 0.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(dw / 2, dh / 2, 45 + peak * 25, Math.PI, Math.PI * 1.5);
        ctx.stroke();

        // Technical coordinates indicators
        ctx.fillStyle = "rgba(6, 182, 212, 0.4)";
        ctx.font = "9px monospace";
        ctx.fillText(`HAYA_CORE v2.5 // AUDIO_SYNC: ${(peak * 100).toFixed(0)}%`, 25, dh - 25);
        ctx.fillText(`LATENCY: OK // AMBIENT: ON`, dw - 180, dh - 25);
      }

      else if (type === "energy_field") {
        clearBackground("#010307");

        ctx.globalCompositeOperation = "screen";

        // Swirling particles in an attractor field
        particles.forEach((p) => {
          p.life++;

          // Vector attractor force toward center
          const dx = dw / 2 - p.x;
          const dy = dh / 2 - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          // Perpendicular vortex force + pull inwards
          const pullX = dx / dist * 0.12;
          const pullY = dy / dist * 0.12;
          const swirlX = -dy / dist * (0.8 + peak * 1.5);
          const swirlY = dx / dist * (0.8 + peak * 1.5);

          p.vx = p.vx * 0.95 + (pullX + swirlX) * 0.05;
          p.vy = p.vy * 0.95 + (pullY + swirlY) * 0.05;

          p.x += p.vx;
          p.y += p.vy;

          if (p.life > p.maxLife || dist < 10) {
            // Respawn on outer edges
            const angle = Math.random() * Math.PI * 2;
            const r = Math.max(dw, dh) * 0.45;
            p.x = dw / 2 + Math.cos(angle) * r;
            p.y = dh / 2 + Math.sin(angle) * r;
            p.vx = 0;
            p.vy = 0;
            p.life = 0;
          }

          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.0 + peak * 0.8), 0, Math.PI * 2);
          ctx.fill();
        });
      }

      else if (type === "bioluminescence") {
        clearBackground("#020613");

        ctx.globalCompositeOperation = "screen";

        // Subtle fluid underwater light rays
        const rayGrad = ctx.createLinearGradient(0, 0, dw, dh);
        rayGrad.addColorStop(0, "rgba(20, 184, 166, 0.02)");
        rayGrad.addColorStop(0.5, `rgba(${glowColorRGB}, ${0.01 + peak * 0.04})`);
        rayGrad.addColorStop(1, "rgba(20, 184, 166, 0.02)");
        ctx.fillStyle = rayGrad;
        ctx.fillRect(0, 0, dw, dh);

        // Bioluminescent algae particles
        particles.forEach((p) => {
          // Drifts with random sinuous water movement
          p.y += p.vy * (1.0 + peak * 1.5);
          p.x += p.vx + Math.sin(time * 0.8 + p.y * 0.02) * 0.35;

          // Warp borders
          if (p.y < -20) {
            p.y = dh + 10;
            p.x = Math.random() * dw;
          }
          if (p.x < -10) p.x = dw + 10;
          if (p.x > dw + 10) p.x = -10;

          // Pulse glowing brightness
          const size = p.size * (1.0 + peak * 1.5);
          const dynamicAlpha = p.alpha * (0.7 + Math.sin(time * 2 + p.y * 0.05) * 0.3) * (1.0 + peak * 2.0);

          const algGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 2.5);
          algGrad.addColorStop(0, `rgba(45, 212, 191, ${dynamicAlpha})`);
          algGrad.addColorStop(0.3, `rgba(${glowColorRGB}, ${dynamicAlpha * 0.4})`);
          algGrad.addColorStop(1, "rgba(0,0,0,0)");

          ctx.fillStyle = algGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore();
      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [type, glowColorRGB, theme]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden select-none">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
