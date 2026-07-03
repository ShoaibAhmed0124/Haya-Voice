import React, { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";

interface StreamingTextPanelProps {
  text: string;
  isSpeaking: boolean;
  glowColorRGB?: string;
  theme?: string;
}

export default function StreamingTextPanel({
  text,
  isSpeaking,
  glowColorRGB = "168, 85, 247",
  theme = "midnight",
}: StreamingTextPanelProps) {
  const [displayedText, setDisplayedText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isLight = theme === "light";
  const glowColor = isLight ? "147, 51, 234" : glowColorRGB;

  useEffect(() => {
    if (!text) {
      setDisplayedText("");
      return;
    }

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [displayedText]);

  if (!text) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-lg mx-auto px-4"
    >
      <div 
        className={`backdrop-blur-md rounded-2xl px-6 py-4 flex flex-col text-center max-h-[140px] overflow-hidden border transition-all duration-300 ${
          isLight 
            ? "bg-white/30 text-purple-950 border-purple-200/20 shadow-sm" 
            : "bg-slate-950/20 text-slate-100 border-white/5 shadow-2xl"
        }`}
      >
        <div 
          ref={containerRef}
          className="overflow-y-auto no-scrollbar flex-grow"
          style={{ scrollBehavior: "smooth" }}
        >
          <p className={`text-base leading-relaxed font-sans font-light tracking-wide ${isLight ? "text-purple-950/90" : "text-white/90"}`}>
            {displayedText}
            {displayedText.length < text.length && (
              <span 
                style={{ backgroundColor: `rgb(${glowColor})` }}
                className="inline-block w-1.5 h-4 ml-1.5 animate-pulse align-middle" 
              />
            )}
          </p>
          <div ref={scrollRef} />
        </div>
      </div>
    </motion.div>
  );
}
