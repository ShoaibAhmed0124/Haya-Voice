import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, MessageSquare } from "lucide-react";

interface StreamingTextPanelProps {
  text: string;
  isSpeaking: boolean;
  glowColorRGB?: string;
}

export default function StreamingTextPanel({
  text,
  isSpeaking,
  glowColorRGB = "168, 85, 247", // Default purple
}: StreamingTextPanelProps) {
  const [displayedText, setDisplayedText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync displayedText with text via typewriter effect
  useEffect(() => {
    if (!text) {
      setDisplayedText("");
      return;
    }

    // If the difference is small, catch up quickly. If big, catch up at steady speed.
    const startTypewriter = () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }

      typingTimerRef.current = setInterval(() => {
        setDisplayedText((prev) => {
          if (prev.length >= text.length) {
            if (typingTimerRef.current) {
              clearInterval(typingTimerRef.current);
            }
            return prev;
          }
          
          // Determine how many characters to append
          const diff = text.length - prev.length;
          const increment = diff > 30 ? 5 : diff > 10 ? 3 : 1;
          return prev + text.substring(prev.length, prev.length + increment);
        });
      }, 15);
    };

    startTypewriter();

    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
    };
  }, [text]);

  // Auto-scroll to the bottom of the text container as it grows
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [displayedText]);

  if (!text) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full max-w-md mx-auto"
    >
      <div 
        style={{
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 1px rgba(${glowColorRGB}, 0.15)`,
          borderColor: `rgba(${glowColorRGB}, 0.15)`
        }}
        className="bg-slate-950/60 backdrop-blur-xl border rounded-2xl p-4 flex flex-col gap-2.5 max-h-[160px] overflow-hidden"
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
          <div className="flex items-center gap-1.5">
            <div 
              style={{ backgroundColor: `rgba(${glowColorRGB}, 0.2)` }}
              className="p-1 rounded-md"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
              Haya Live Output
            </span>
          </div>
          {isSpeaking && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[8px] font-mono tracking-wider text-emerald-400 uppercase">
                Speaking
              </span>
            </div>
          )}
        </div>

        {/* Text Area with Auto Scroll */}
        <div 
          ref={containerRef}
          className="overflow-y-auto no-scrollbar flex-grow pr-1"
          style={{ scrollBehavior: "smooth" }}
        >
          <p className="text-xs text-slate-200 leading-relaxed font-sans font-light">
            {displayedText}
            {displayedText.length < text.length && (
              <span 
                style={{ backgroundColor: `rgb(${glowColorRGB})` }}
                className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse align-middle" 
              />
            )}
          </p>
          <div ref={scrollRef} />
        </div>
      </div>
    </motion.div>
  );
}
