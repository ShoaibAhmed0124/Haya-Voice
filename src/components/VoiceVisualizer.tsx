import { useEffect, useRef } from "react";
import { AssistantState } from "../types";

interface VoiceVisualizerProps {
  state: AssistantState;
  microphoneAnalyser: AnalyserNode | null;
  playbackAnalyser: AnalyserNode | null;
}

export default function VoiceVisualizer({
  state,
  microphoneAnalyser,
  playbackAnalyser,
}: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle resizing
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // Cap DPR at 1.5 for performance on mobile devices
        canvas.width = parent.clientWidth * dpr;
        canvas.height = parent.clientHeight * dpr;
        ctx.scale(dpr, dpr);
      }
    };
    resizeCanvas();

    let resizeTimeout: number;
    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        resizeCanvas();
      }, 100);
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Audio buffers
    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Clear with slight trailing fade for a smooth cyber glow motion
      ctx.fillStyle = "rgba(10, 10, 12, 0.2)";
      ctx.fillRect(0, 0, width, height);

      phaseRef.current += 0.05; // speed of idle waves

      // Choose active analyser based on state
      let activeAnalyser: AnalyserNode | null = null;
      if (state === "listening") {
        activeAnalyser = microphoneAnalyser;
      } else if (state === "speaking") {
        activeAnalyser = playbackAnalyser;
      }

      let volume = 0;
      if (activeAnalyser) {
        activeAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        volume = sum / bufferLength / 255; // Normalized 0 to 1
      }

      const centerY = height / 2;
      const centerX = width / 2;

      // Draw cyber orb glow in the center
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        Math.max(60, 60 + volume * 150)
      );

      if (state === "disconnected") {
        glowGrad.addColorStop(0, "rgba(59, 130, 246, 0.15)"); // Blue
        glowGrad.addColorStop(1, "rgba(59, 130, 246, 0)");
      } else if (state === "connecting") {
        const pulse = (Math.sin(phaseRef.current * 1.5) + 1) / 2;
        glowGrad.addColorStop(0, `rgba(245, 158, 11, ${0.1 + pulse * 0.15})`); // Amber
        glowGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
      } else if (state === "listening") {
        glowGrad.addColorStop(0, `rgba(6, 182, 212, ${0.15 + volume * 0.35})`); // Cyan
        glowGrad.addColorStop(1, "rgba(6, 182, 212, 0)");
      } else if (state === "speaking") {
        glowGrad.addColorStop(0, `rgba(236, 72, 153, ${0.2 + volume * 0.45})`); // Pink / Magenta
        glowGrad.addColorStop(1, "rgba(236, 72, 153, 0)");
      } else if (state === "error") {
        glowGrad.addColorStop(0, "rgba(239, 68, 68, 0.2)"); // Red
        glowGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
      }

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(100, 100 + volume * 180), 0, Math.PI * 2);
      ctx.fill();

      // Render layered sine waves (Optimized with step increments for high-DPR mobile screens)
      const drawSineWave = (
        amplitude: number,
        frequency: number,
        color: string,
        lineWidth: number,
        phaseOffset: number
      ) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        const step = width > 500 ? 4 : 2; // Step of 4 for larger screens, 2 for smaller screens
        for (let x = 0; x <= width; x += step) {
          const currentX = Math.min(x, width);
          // Normalize currentX to -1 to 1 for fading edges
          const normX = (currentX / width) * 2 - 1;
          const envelope = Math.cos((normX * Math.PI) / 2); // Beautiful window function to taper edges

          const y =
            centerY +
            Math.sin(currentX * frequency + phaseRef.current + phaseOffset) *
              amplitude *
              envelope *
              (1 + volume * 2.5);

          if (currentX === 0) {
            ctx.moveTo(currentX, y);
          } else {
            ctx.lineTo(currentX, y);
          }
        }
        ctx.stroke();
      };

      if (state === "disconnected") {
        // Simple calm waves
        drawSineWave(12, 0.008, "rgba(99, 102, 241, 0.4)", 1.5, 0);
        drawSineWave(8, 0.012, "rgba(59, 130, 246, 0.25)", 1.0, Math.PI / 2);
      } else if (state === "connecting") {
        // Medium speed wave indicating thinking
        const sweepPhase = phaseRef.current * 1.5;
        drawSineWave(16, 0.015, "rgba(245, 158, 11, 0.5)", 2, sweepPhase);
        drawSineWave(10, 0.022, "rgba(217, 119, 6, 0.3)", 1.5, sweepPhase + Math.PI);
      } else if (state === "listening") {
        // High frequency active listening waves (Cyan/Emerald)
        drawSineWave(18, 0.014, "rgba(6, 182, 212, 0.75)", 2.5, 0);
        drawSineWave(12, 0.022, "rgba(16, 185, 129, 0.45)", 1.5, Math.PI / 3);
        drawSineWave(8, 0.03, "rgba(6, 182, 212, 0.25)", 1.0, -Math.PI / 3);
      } else if (state === "speaking") {
        // Large expressive voice speaking waves (Pink/Purple)
        drawSineWave(24, 0.01, "rgba(236, 72, 153, 0.85)", 3, 0);
        drawSineWave(16, 0.018, "rgba(139, 92, 246, 0.55)", 2, Math.PI / 4);
        drawSineWave(10, 0.028, "rgba(244, 63, 94, 0.35)", 1.5, -Math.PI / 4);
      } else if (state === "error") {
        // Flat errant red line
        drawSineWave(4, 0.05, "rgba(239, 68, 68, 0.6)", 2, 0);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, [state, microphoneAnalyser, playbackAnalyser]);

  return (
    <div id="visualizer-container" className="relative w-full h-full overflow-hidden bg-transparent">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </div>
  );
}
