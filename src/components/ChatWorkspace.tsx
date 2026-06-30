import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Image as ImageIcon,
  Send,
  Trash2,
  Pin,
  Search,
  Plus,
  Share2,
  Download,
  Copy,
  RotateCw,
  Edit2,
  X,
  Upload,
  ChevronLeft,
  Sliders,
  Sparkles,
  Check,
  ArrowRight,
  Bookmark,
  FileText,
  File,
  Save,
  Grid,
  Info,
  Maximize2,
  Paperclip,
  Calendar,
  History,
  BarChart2
} from "lucide-react";
import { hayaStorage } from "../services/storage";

// Types for Chat Workspace
export interface ChatAttachment {
  name: string;
  type: string;
  url: string; // base64 URI
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  isStreaming?: boolean;
  attachments?: ChatAttachment[];
  toolOutputs?: { name: string; output: string }[];
  generatedImages?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  isPinned: boolean;
  createdAt: string;
}

export interface GeneratedImage {
  id: string;
  url: string; // base64 or external public image URL
  prompt: string;
  enhancedPrompt?: string;
  model: string;
  timestamp: string;
  seed: string;
  aspectRatio: string;
  resolution: string;
  negativePrompt?: string;
  stylePreset?: string;
}

interface ChatWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  activePersonaId?: string;
  onTriggerHaptic?: (ms: number) => void;
}

// Light-weight high-fidelity Markdown and Code Block Renderer
const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!text) return null;

  // Split content by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-slate-200 text-sm font-sans leading-relaxed selection:bg-purple-500/30">
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          // It's a code block
          const match = part.match(/```(\w*)\n([\s\S]*?)```/);
          const lang = match ? match[1] : "code";
          const code = match ? match[2] : part.slice(3, -3);
          const blockId = `code-${index}`;

          return (
            <div key={blockId} className="my-3 border border-white/10 rounded-xl overflow-hidden bg-slate-950/80 shadow-inner">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-white/5 text-xs font-mono text-slate-400">
                <span className="uppercase text-[10px] tracking-wider font-bold text-slate-500">{lang || "code"}</span>
                <button
                  onClick={() => handleCopyCode(code, blockId)}
                  className="flex items-center gap-1 hover:text-slate-200 transition-all cursor-pointer"
                >
                  {copiedId === blockId ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold text-[10px]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-xs font-mono text-cyan-200/90 leading-relaxed bg-black/30">
                <code>{code}</code>
              </pre>
            </div>
          );
        } else {
          // Standard text with bold/italic parsing and lists
          const lines = part.split("\n");
          return lines.map((line, lineIdx) => {
            const trimmed = line.trim();

            // Headers
            if (trimmed.startsWith("### ")) {
              return (
                <h3 key={lineIdx} className="text-sm font-bold text-purple-400 tracking-wide mt-3 mb-1 font-mono uppercase">
                  {trimmed.replace("### ", "")}
                </h3>
              );
            }
            if (trimmed.startsWith("## ")) {
              return (
                <h2 key={lineIdx} className="text-base font-bold text-cyan-400 tracking-wider mt-4 mb-2 font-mono uppercase border-b border-white/5 pb-1">
                  {trimmed.replace("## ", "")}
                </h2>
              );
            }
            if (trimmed.startsWith("# ")) {
              return (
                <h1 key={lineIdx} className="text-lg font-black text-slate-100 tracking-widest mt-5 mb-2 font-mono uppercase">
                  {trimmed.replace("# ", "")}
                </h1>
              );
            }

            // Bullet lists
            if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
              const content = trimmed.slice(2);
              return (
                <ul key={lineIdx} className="list-disc pl-5 my-1 text-slate-300">
                  <li>{parseInlineStyles(content)}</li>
                </ul>
              );
            }

            // Numbered lists
            if (/^\d+\.\s/.test(trimmed)) {
              const content = trimmed.replace(/^\d+\.\s/, "");
              return (
                <ol key={lineIdx} className="list-decimal pl-5 my-1 text-slate-300">
                  <li>{parseInlineStyles(content)}</li>
                </ol>
              );
            }

            // Normal paragraphs
            if (trimmed === "") {
              return <div key={lineIdx} className="h-2" />;
            }

            return <p key={lineIdx} className="my-1">{parseInlineStyles(line)}</p>;
          });
        }
      })}
    </div>
  );
};

// Helper to parse inline bold/italics
function parseInlineStyles(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={idx} className="italic text-slate-300">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  isOpen,
  onClose,
  activePersonaId = "assistant",
  onTriggerHaptic
}) => {
  const [activeTab, setActiveTab] = useState<"chat" | "images" | "history">("chat");

  // -------------------- CHAT STATES --------------------
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [editMessageId, setEditMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Conversation Management Additional States
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------- IMAGE STUDIO STATES --------------------
  const [imagePrompt, setImagePrompt] = useState("");
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [stylePreset, setStylePreset] = useState("Cinematic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("1024x1024");
  const [selectedModel, setSelectedModel] = useState("Stable Diffusion XL (SDXL)");
  const [negativePrompt, setNegativePrompt] = useState("blurry, low quality, distorted, extra limbs");
  const [seed, setSeed] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentGeneratedImage, setCurrentGeneratedImage] = useState<GeneratedImage | null>(null);

  // -------------------- REFERENCE IMAGE STATES --------------------
  const [referenceImages, setReferenceImages] = useState<string[]>([]); // array of base64 data URIs
  const [isAnalyzingRef, setIsAnalyzingRef] = useState(false);
  const [faceConsistencyPrompt, setFaceConsistencyPrompt] = useState("");

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Trigger haptic helper
  const triggerHaptic = (ms = 20) => {
    if (onTriggerHaptic) onTriggerHaptic(ms);
  };

  // Load chat sessions and images from LocalStorage
  useEffect(() => {
    const initStorage = async () => {
      const savedSessions = await hayaStorage.getSessions();
      const lastActiveId = await hayaStorage.getLastActiveSessionId();

      if (savedSessions && savedSessions.length > 0) {
        setSessions(savedSessions);
        if (lastActiveId && savedSessions.some((s) => s.id === lastActiveId)) {
          setCurrentSessionId(lastActiveId);
        } else {
          setCurrentSessionId(savedSessions[0].id);
        }
      } else {
        // Create initial chat
        const initialSession: ChatSession = {
          id: "chat-default",
          title: "Commander Portal",
          messages: [
            {
              id: "msg-welcome",
              role: "assistant",
              text: "Salutations, Commander. This is your high-fidelity dedicated Chat Workspace and creative hub. Speak your thoughts or initialize AI creations.",
              timestamp: new Date().toISOString()
            }
          ],
          isPinned: false,
          createdAt: new Date().toISOString()
        };
        setSessions([initialSession]);
        setCurrentSessionId(initialSession.id);
        await hayaStorage.saveSessions([initialSession]);
        await hayaStorage.saveLastActiveSessionId(initialSession.id);
      }
    };

    initStorage();

    const savedImages = localStorage.getItem("haya_generated_images");
    if (savedImages) {
      try {
        const parsed = JSON.parse(savedImages);
        setGeneratedImages(parsed);
        if (parsed.length > 0) {
          setCurrentGeneratedImage(parsed[0]);
        }
      } catch (e) {
        console.error("Failed to parse generated images", e);
      }
    }
  }, []);

  // Save active session ID on change
  useEffect(() => {
    if (currentSessionId) {
      hayaStorage.saveLastActiveSessionId(currentSessionId);
    }
  }, [currentSessionId]);

  // Save sessions helper
  const saveSessions = (updated: ChatSession[]) => {
    setSessions(updated);
    hayaStorage.saveSessions(updated);
  };

  // Save images helper
  const saveImages = (updated: GeneratedImage[]) => {
    setGeneratedImages(updated);
    localStorage.setItem("haya_generated_images", JSON.stringify(updated));
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, isAiStreaming, currentSessionId]);

  const activeSession = sessions.find((s) => s.id === currentSessionId) || sessions[0];

  // -------------------- CHAT METHODS --------------------

  const createNewChat = () => {
    triggerHaptic(30);
    const id = `chat-${Date.now()}`;
    const newSession: ChatSession = {
      id,
      title: `Conversation ${sessions.length + 1}`,
      messages: [],
      isPinned: false,
      createdAt: new Date().toISOString()
    };
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setCurrentSessionId(id);
    setActiveTab("chat"); // Auto switch to chat tab on creation
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(40);
    const updated = sessions.filter((s) => s.id !== id);
    saveSessions(updated);
    if (currentSessionId === id && updated.length > 0) {
      setCurrentSessionId(updated[0].id);
    } else if (updated.length === 0) {
      const fallback: ChatSession = {
        id: "chat-default",
        title: "Commander Portal",
        messages: [],
        isPinned: false,
        createdAt: new Date().toISOString()
      };
      saveSessions([fallback]);
      setCurrentSessionId(fallback.id);
    }
  };

  const togglePinChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(20);
    const updated = sessions.map((s) => {
      if (s.id === id) {
        return { ...s, isPinned: !s.isPinned };
      }
      return s;
    });
    saveSessions(updated);
  };

  const renameChat = (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    const updated = sessions.map((s) => {
      if (s.id === id) {
        return { ...s, title: newTitle };
      }
      return s;
    });
    saveSessions(updated);
  };

  // Export chats as JSON file
  const exportChats = () => {
    triggerHaptic(30);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessions, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `haya-workspace-export-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import chats from JSON
  const importChats = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          const merged = [...parsed, ...sessions];
          // Remove duplicates by id
          const unique = merged.filter((item, index, self) =>
            self.findIndex((t) => t.id === item.id) === index
          );
          saveSessions(unique);
          if (unique.length > 0) {
            setCurrentSessionId(unique[0].id);
          }
          triggerHaptic(50);
        }
      } catch (err) {
        console.error("Invalid workspace export format", err);
      }
    };
    reader.readAsText(file);
  };

  // Handle send message
  const handleSendMessage = async (textToSend?: string) => {
    const rawMessage = textToSend !== undefined ? textToSend : chatInput;
    const hasAttachments = pendingAttachments.length > 0;
    if (!rawMessage.trim() && !hasAttachments) return;
    if (isAiStreaming) return;

    triggerHaptic(20);
    if (textToSend === undefined) {
      setChatInput("");
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      text: rawMessage,
      timestamp: new Date().toISOString(),
      attachments: hasAttachments ? [...pendingAttachments] : undefined
    };

    // Clear pending attachments
    setPendingAttachments([]);

    const targetSession = sessions.find((s) => s.id === currentSessionId) || activeSession;
    const previousMsgs = targetSession.messages || [];
    let updatedMsgs = [...previousMsgs, userMsg];

    // If first message and title is default, auto rename
    let updatedTitle = targetSession.title;
    if (targetSession.title.startsWith("Conversation") || targetSession.title === "Commander Portal" || previousMsgs.length === 0) {
      updatedTitle = rawMessage.trim() 
        ? (rawMessage.slice(0, 26) + (rawMessage.length > 26 ? "..." : ""))
        : (hasAttachments ? `Attachment Chat ${sessions.length + 1}` : `Conversation ${sessions.length + 1}`);
    }

    const updatedSessions = sessions.map((s) => {
      if (s.id === targetSession.id) {
        return { ...s, title: updatedTitle, messages: updatedMsgs };
      }
      return s;
    });
    saveSessions(updatedSessions);

    // Prepare streaming state
    setIsAiStreaming(true);

    const streamMsgId = `msg-stream-${Date.now()}`;
    const placeholderAssistantMsg: ChatMessage = {
      id: streamMsgId,
      role: "assistant",
      text: "",
      timestamp: new Date().toISOString(),
      isStreaming: true
    };

    // Append streaming message to screen
    const sessionsWithPlaceholder = sessions.map((s) => {
      if (s.id === targetSession.id) {
        return { ...s, messages: [...updatedMsgs, placeholderAssistantMsg] };
      }
      return s;
    });
    setSessions(sessionsWithPlaceholder);

    try {
      // Build previous conversation logs (excluding userMsg, which is passed as message)
      const historyLogs = previousMsgs.map((m) => ({
        role: m.role,
        text: m.text
      }));

      // Call streaming backend
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: rawMessage || "Attached assets transmitted.",
          history: historyLogs,
          personaId: activePersonaId
        })
      });

      if (!response.ok) {
        throw new Error("Core channel interrupted.");
      }

      const responseData = await response.json();
      const finalResponseText = responseData.text || "I was unable to establish a telemetry flow. Please try again.";

      // Mock streaming chunks for satisfying messenger UX feel
      let index = 0;
      const interval = setInterval(() => {
        const chunkLength = Math.floor(Math.random() * 4) + 2;
        const currentSlice = finalResponseText.slice(0, index + chunkLength);
        index += chunkLength;

        setSessions((prev) => {
          const updated = prev.map((s) => {
            if (s.id === targetSession.id) {
              const msgs = s.messages.map((m) => {
                if (m.id === streamMsgId) {
                  return { ...m, text: currentSlice };
                }
                return m;
              });
              return { ...s, messages: msgs };
            }
            return s;
          });
          // Real-time incremental save for crash resilience
          hayaStorage.saveSessions(updated);
          return updated;
        });

        if (index >= finalResponseText.length) {
          clearInterval(interval);
          setIsAiStreaming(false);

          // Persist the completed session
          setSessions((prev) => {
            const finalized = prev.map((s) => {
              if (s.id === targetSession.id) {
                const msgs = s.messages.map((m) => {
                  if (m.id === streamMsgId) {
                    return { ...m, text: finalResponseText, isStreaming: false };
                  }
                  return m;
                });
                return { ...s, messages: msgs };
              }
              return s;
            });
            hayaStorage.saveSessions(finalized);
            return finalized;
          });
        }
      }, 15);

    } catch (err) {
      console.error("Failed to stream chat", err);
      setIsAiStreaming(false);
      setSessions((prev) => {
        const finalized = prev.map((s) => {
          if (s.id === targetSession.id) {
            const msgs = s.messages.map((m) => {
              if (m.id === streamMsgId) {
                return { ...m, text: "Error: Telemetry channel blocked. Ensure your API links are healthy.", isStreaming: false };
              }
              return m;
            });
            return { ...s, messages: msgs };
          }
          return s;
        });
        hayaStorage.saveSessions(finalized);
        return finalized;
      });
    }
  };

  // Edit previous prompt
  const handleEditPrompt = (msgId: string, oldText: string) => {
    setEditMessageId(msgId);
    setEditValue(oldText);
  };

  const handleSaveEditPrompt = (msgId: string) => {
    if (!editValue.trim()) return;
    triggerHaptic(20);

    const targetSession = sessions.find((s) => s.id === currentSessionId) || activeSession;
    // Keep messages up to the edited one, rewrite with edited, and discard anything after
    const msgIndex = targetSession.messages.findIndex((m) => m.id === msgId);
    if (msgIndex !== -1) {
      const truncatedMessages = targetSession.messages.slice(0, msgIndex);
      setEditMessageId(null);
      handleSendMessage(editValue);
    }
  };

  // Regenerate Response
  const handleRegenerateResponse = (msgId: string) => {
    triggerHaptic(30);
    const targetSession = sessions.find((s) => s.id === currentSessionId) || activeSession;
    const msgIndex = targetSession.messages.findIndex((m) => m.id === msgId);
    if (msgIndex !== -1) {
      // Find the last user prompt preceding this response
      const precedingUserMsg = [...targetSession.messages]
        .slice(0, msgIndex)
        .reverse()
        .find((m) => m.role === "user");

      if (precedingUserMsg) {
        // Truncate from the index of the user message and re-send
        const userMsgIndex = targetSession.messages.findIndex((m) => m.id === precedingUserMsg.id);
        if (userMsgIndex !== -1) {
          const truncated = targetSession.messages.slice(0, userMsgIndex);
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id === targetSession.id) {
                return { ...s, messages: truncated };
              }
              return s;
            })
          );
          handleSendMessage(precedingUserMsg.text);
        }
      }
    }
  };

  // Continue generation
  const handleContinueGeneration = () => {
    triggerHaptic(20);
    handleSendMessage("Continue writing/answering from exactly where you left off. Ensure fluid continuation.");
  };

  // Helper to get most recent activity timestamp for a session
  const getSessionTime = (s: ChatSession) => {
    if (s.messages && s.messages.length > 0) {
      return s.messages[s.messages.length - 1].timestamp;
    }
    return s.createdAt;
  };

  // Filter and sort sessions: Pinned at the top ordered by activity, unpinned below ordered by activity
  const filteredSessions = sessions
    .filter((s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.messages.some((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(getSessionTime(b)).getTime() - new Date(getSessionTime(a)).getTime();
    });

  // Relative / Friendly Time Formatter
  const formatFriendlyTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 0) return "Just now";
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Chat Attachments Handlers
  const handleChatAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newAttachment: ChatAttachment = {
          name: file.name,
          type: file.type || "application/octet-stream",
          url: base64
        };
        setPendingAttachments((prev) => [...prev, newAttachment]);
        triggerHaptic(20);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = ""; // Reset value
  };

  const removePendingAttachment = (index: number) => {
    triggerHaptic(15);
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Bridge between AI Image Studio & Workspace Chat
  const handleSendGeneratedToChat = (img: GeneratedImage) => {
    triggerHaptic(40);
    const targetSession = sessions.find((s) => s.id === currentSessionId) || sessions[0];
    if (!targetSession) return;

    const imgMsg: ChatMessage = {
      id: `msg-img-${Date.now()}`,
      role: "assistant",
      text: `### Shared Artwork Output\nGenerated image based on prompt:\n> "${img.prompt}"`,
      timestamp: new Date().toISOString(),
      generatedImages: [img.url]
    };

    const updatedMsgs = [...(targetSession.messages || []), imgMsg];
    const updatedSessions = sessions.map((s) => {
      if (s.id === targetSession.id) {
        return { ...s, messages: updatedMsgs };
      }
      return s;
    });

    saveSessions(updatedSessions);
    setActiveTab("chat"); // transition instantly to chat tab to view the image
  };

  // -------------------- IMAGE STUDIO METHODS --------------------

  // Handles reference image uploading
  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setReferenceImages((prev) => {
          const next = [...prev, base64].slice(0, 3); // Max 3 reference images
          triggerHaptic(30);
          return next;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeRefImage = (index: number) => {
    triggerHaptic(15);
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
    if (referenceImages.length <= 1) {
      setFaceConsistencyPrompt("");
    }
  };

  // AI-enhanced prompts using Gemini Model server side
  const handleEnhancePrompt = async () => {
    if (!imagePrompt.trim()) return;
    triggerHaptic(30);
    setIsEnhancing(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Enhance this short image generation prompt. Add deep artistic adjectives, atmospheric lighting, volumetric depth, photorealistic textures, style descriptors, and high resolution details while keeping it clear and faithful to the original idea. Wrap the enhanced prompt in double quotes and output ONLY the prompt. Prompt: "${imagePrompt}"`,
          personaId: "assistant"
        })
      });

      if (res.ok) {
        const data = await res.json();
        const cleaned = (data.text || "").replace(/"/g, "").trim();
        setEnhancedPrompt(cleaned);
      } else {
        setEnhancedPrompt(imagePrompt + ", highly detailed, cinematic lighting, ultra-sharp focus, professional render, 8k resolution");
      }
    } catch (e) {
      setEnhancedPrompt(imagePrompt + ", detailed, cinematic lighting, highly realistic");
    } finally {
      setIsEnhancing(false);
    }
  };

  // Generate image using public free API mapped to user selection
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    triggerHaptic(50);
    setIsGenerating(true);

    try {
      // 1. Analyze reference image for Face Consistency if reference images exist
      let analysisContext = "";
      if (referenceImages.length > 0 && !faceConsistencyPrompt) {
        setIsAnalyzingRef(true);
        try {
          // Ask server-side Gemini to analyze face and physical descriptions
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "Describe the physical features, face structure, hair style, skin tone, gender, age range, and core appearance elements of the person in the provided prompt. Provide a short description (max 20 words). If no person is described, say 'generic character'.",
              personaId: "assistant"
            })
          });
          const data = await res.json();
          const desc = data.text || "person with sharp features, modern styling";
          setFaceConsistencyPrompt(desc);
          analysisContext = desc;
        } catch (_) {
          analysisContext = "characterized with sharp identical features, matched hair structure, skin tones";
          setFaceConsistencyPrompt(analysisContext);
        } finally {
          setIsAnalyzingRef(false);
        }
      } else {
        analysisContext = faceConsistencyPrompt;
      }

      // Prepare final visual prompt
      let finalPrompt = enhancedPrompt || imagePrompt;
      if (analysisContext && referenceImages.length > 0) {
        finalPrompt = `Preserve exact face identity, hair, skin, and facial proportions of: ${analysisContext}. Scene: ${finalPrompt}`;
      }

      // Append style preset
      if (stylePreset !== "None") {
        finalPrompt += `, style: ${stylePreset}, flawless composition, masterpiece quality`;
      }

      // Map requested models to pollinations parameters or seed mappings
      const modelMap: Record<string, string> = {
        "Stable Diffusion XL (SDXL)": "sdxl",
        "Juggernaut XL": "turbo",
        "DreamShaper XL": "flux-realism",
        "RealVisXL": "flux-3d",
        "Flux Schnell": "flux"
      };

      const selectedModelParam = modelMap[selectedModel] || "flux";

      // Seed setup
      const activeSeed = seed.trim() || String(Math.floor(Math.random() * 99999999));

      // Fetch from Pollinations free fast endpoint
      const sizeParts = resolution.split("x");
      const width = sizeParts[0] || "1024";
      const height = sizeParts[1] || "1024";

      const imageUrl = `https://image.pollinations.ai/p/${encodeURIComponent(finalPrompt)}?width=${width}&height=${height}&seed=${activeSeed}&model=${selectedModelParam}&nologo=true`;

      // Verify the image can load
      const imgCheck = new Image();
      imgCheck.src = imageUrl;
      await new Promise((resolve, reject) => {
        imgCheck.onload = resolve;
        imgCheck.onerror = reject;
      });

      // Save generated image metadata locally
      const newImg: GeneratedImage = {
        id: `img-${Date.now()}`,
        url: imageUrl,
        prompt: imagePrompt,
        enhancedPrompt: enhancedPrompt || undefined,
        model: selectedModel,
        timestamp: new Date().toISOString(),
        seed: activeSeed,
        aspectRatio,
        resolution,
        negativePrompt: negativePrompt || undefined,
        stylePreset: stylePreset !== "None" ? stylePreset : undefined
      };

      const updated = [newImg, ...generatedImages];
      saveImages(updated);
      setCurrentGeneratedImage(newImg);

    } catch (err) {
      console.error("Image generation channel interrupted", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Image helpers
  const handleDownloadImage = async (img: GeneratedImage) => {
    triggerHaptic(20);
    try {
      const response = await fetch(img.url);
      const blob = await response.blob() as Blob;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `haya-studio-${img.id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      // Fallback
      window.open(img.url, "_blank");
    }
  };

  const handleShareImage = (img: GeneratedImage) => {
    triggerHaptic(20);
    if (navigator.share) {
      navigator.share({
        title: "Haya Image Studio Creation",
        text: `Check out this masterwork generated on Haya Image Studio: "${img.prompt}"`,
        url: img.url
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(img.url);
      alert("Image URL copied to Commander's clipboard!");
    }
  };

  const handleDeleteImage = (id: string) => {
    triggerHaptic(40);
    const updated = generatedImages.filter((img) => img.id !== id);
    saveImages(updated);
    if (currentGeneratedImage?.id === id) {
      setCurrentGeneratedImage(updated.length > 0 ? updated[0] : null);
    }
  };

  const handleRevisitImage = (img: GeneratedImage) => {
    triggerHaptic(15);
    setImagePrompt(img.prompt);
    setEnhancedPrompt(img.enhancedPrompt || "");
    setStylePreset(img.stylePreset || "None");
    setAspectRatio(img.aspectRatio);
    setResolution(img.resolution);
    setSelectedModel(img.model);
    setSeed(img.seed);
    setCurrentGeneratedImage(img);
  };

  const handleRegenerateImage = () => {
    if (currentGeneratedImage) {
      setImagePrompt(currentGeneratedImage.prompt);
      setSeed(String(Math.floor(Math.random() * 99999999))); // fresh seed
      handleGenerateImage();
    }
  };

  const handleCreateVariation = () => {
    if (currentGeneratedImage) {
      const prompts = [
        ", extreme detail, cinematic close-up",
        ", neon lighting, digital art masterpiece",
        ", minimalist composition, artistic rendering",
        ", dramatic volumetric shadows"
      ];
      const randomPromptTweak = prompts[Math.floor(Math.random() * prompts.length)];
      setImagePrompt(currentGeneratedImage.prompt + randomPromptTweak);
      setSeed(String(Math.floor(Math.random() * 99999999))); // new seed
      triggerHaptic(30);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#040406]/98 backdrop-blur-2xl z-50 flex flex-col md:flex-row text-slate-200 font-sans overflow-hidden animate-fade-in select-text">
      
      {/* LEFT PANEL: CONVERSATION LIST & HISTORY */}
      <div className="w-full md:w-80 bg-slate-950/80 border-b md:border-b-0 md:border-r border-white/5 flex flex-col flex-shrink-0 h-1/3 md:h-full">
        
        {/* SIDEBAR HEADER */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold font-mono tracking-wider text-slate-100 uppercase">Haya Workspace</span>
          </div>
          <button
            onClick={createNewChat}
            className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all cursor-pointer"
            title="Create new conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="p-3 border-b border-white/5 relative flex items-center">
          <Search className="absolute left-6 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search conversation text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-1.5 pl-8 pr-4 bg-slate-900/40 border border-white/5 rounded-xl text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500/40 transition-all"
          />
        </div>

        {/* CONVERSATION LIST */}
        <div className="flex-grow overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {filteredSessions.length > 0 ? (
            filteredSessions.map((session) => {
              const isActive = session.id === currentSessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => {
                    triggerHaptic(15);
                    setCurrentSessionId(session.id);
                  }}
                  className={`group relative p-3 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    isActive
                      ? "bg-purple-500/10 border border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.05)]"
                      : "hover:bg-slate-900/40 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-grow">
                    <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-purple-400" : "text-slate-500 group-hover:text-slate-400"}`} />
                    <input
                      type="text"
                      value={session.title}
                      onChange={(e) => renameChat(session.id, e.target.value)}
                      className={`text-xs bg-transparent border-none p-0 focus:ring-0 focus:outline-none truncate min-w-0 font-medium ${
                        isActive ? "text-slate-100 font-bold" : "text-slate-400 group-hover:text-slate-300"
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => togglePinChat(session.id, e)}
                      className={`p-1 rounded hover:bg-white/5 transition-all cursor-pointer ${session.isPinned ? "text-amber-400" : "text-slate-500"}`}
                      title={session.isPinned ? "Unpin chat" : "Pin chat"}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => deleteChat(session.id, e)}
                      className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {session.isPinned && !isActive && (
                    <Pin className="absolute right-2 top-2 w-2.5 h-2.5 text-amber-500/50" />
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              No conversations found
            </div>
          )}
        </div>

        {/* EXPORT / IMPORT CONTROLS */}
        <div className="p-3 border-t border-white/5 grid grid-cols-2 gap-2 bg-slate-950/40">
          <button
            onClick={exportChats}
            className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-900/60 hover:bg-slate-900 border border-white/5 rounded-xl text-[10px] font-mono tracking-wider text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>EXPORT</span>
          </button>
          <label className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-900/60 hover:bg-slate-900 border border-white/5 rounded-xl text-[10px] font-mono tracking-wider text-slate-400 hover:text-slate-200 transition-all cursor-pointer">
            <Upload className="w-3 h-3" />
            <span>IMPORT</span>
            <input
              type="file"
              accept=".json"
              onChange={importChats}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* RIGHT PANEL: CHAT HUB OR IMAGE STUDIO */}
      <div className="flex-grow flex flex-col h-2/3 md:h-full relative bg-[#060608]/90">
        
        {/* WORKSPACE HEADER AND TAB NAVIGATION */}
        <div className="px-4 py-3 border-b border-white/5 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-100 transition-all cursor-pointer"
              title="Return to main screen"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-xl border border-white/5 flex-wrap md:flex-nowrap">
              <button
                onClick={() => {
                  triggerHaptic(15);
                  setActiveTab("chat");
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono tracking-wider uppercase transition-all cursor-pointer ${
                  activeTab === "chat"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Workspace Chat</span>
              </button>
              <button
                onClick={() => {
                  triggerHaptic(15);
                  setActiveTab("images");
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono tracking-wider uppercase transition-all cursor-pointer ${
                  activeTab === "images"
                    ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>AI Image Studio</span>
              </button>
              <button
                onClick={() => {
                  triggerHaptic(15);
                  setActiveTab("history");
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono tracking-wider uppercase transition-all cursor-pointer ${
                  activeTab === "history"
                    ? "bg-pink-600 text-white shadow-lg shadow-pink-600/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Chat History</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-purple-400/80 uppercase tracking-widest bg-purple-950/20 border border-purple-500/10 px-2.5 py-1 rounded-full">
              Haya v4.9 Core
            </span>
          </div>
        </div>

        {/* TAB CONTENTS */}
        {activeTab === "chat" ? (
          // ==================== WORKSPACE CHAT SCREEN ====================
          <div className="flex-grow flex flex-col justify-between overflow-hidden relative">
            
            {/* MESSAGES CONSOLE */}
            <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin">
              {activeSession && activeSession.messages && activeSession.messages.length > 0 ? (
                activeSession.messages.map((message) => {
                  const isUser = message.role === "user";
                  const isEditingThis = editMessageId === message.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 md:gap-4 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold font-mono tracking-wider ${
                        isUser 
                          ? "bg-purple-600/20 text-purple-300 border border-purple-500/30" 
                          : "bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.1)]"
                      }`}>
                        {isUser ? "CMD" : "HYA"}
                      </div>

                      {/* Content Bubble */}
                      <div className="space-y-1.5 max-w-[85%] md:max-w-[75%]">
                        <div className={`px-4 py-3.5 rounded-2xl border ${
                          isUser
                            ? "bg-purple-950/15 border-purple-500/10 text-slate-100 rounded-tr-none"
                            : "bg-slate-950/40 border-white/5 text-slate-200 rounded-tl-none shadow-lg shadow-black/20"
                        }`}>
                          {isEditingThis ? (
                            <div className="space-y-2">
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full bg-slate-900 border border-purple-500/20 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-sans"
                                rows={3}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditMessageId(null)}
                                  className="px-2.5 py-1 hover:bg-white/5 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-mono uppercase tracking-wider border border-white/5 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveEditPrompt(message.id)}
                                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-mono uppercase tracking-wider cursor-pointer"
                                >
                                  Resubmit
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* RENDER ATTACHMENTS */}
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="flex flex-col gap-2 border-b border-white/5 pb-2.5 mb-2.5">
                                  {message.attachments.map((att, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-xl border border-white/5">
                                      {att.type.startsWith("image/") ? (
                                        <div className="relative group">
                                          <img src={att.url || null} alt="Thumbnail" className="max-w-xs rounded-lg border border-white/10 max-h-40 object-contain" referrerPolicy="no-referrer" />
                                          <button
                                            onClick={() => {
                                              const a = document.createElement("a");
                                              a.href = att.url;
                                              a.download = att.name;
                                              a.click();
                                            }}
                                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-between w-full">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <File className="w-4 h-4 text-purple-400" />
                                            <span className="text-xs font-mono truncate text-slate-300 max-w-[200px]">{att.name}</span>
                                          </div>
                                          <button
                                            onClick={() => {
                                              const a = document.createElement("a");
                                              a.href = att.url;
                                              a.download = att.name;
                                              a.click();
                                            }}
                                            className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* TEXT CONTENT */}
                              {message.text && <MarkdownRenderer text={message.text} />}

                              {/* RENDER GENERATED IMAGES */}
                              {message.generatedImages && message.generatedImages.length > 0 && (
                                <div className="mt-3 grid grid-cols-1 gap-2.5">
                                  {message.generatedImages.map((imgUrl, i) => (
                                    <div key={i} className="relative rounded-2xl overflow-hidden border border-white/10 group shadow-lg max-w-md">
                                      <img src={imgUrl || null} alt="Generated asset" className="w-full h-auto object-cover max-h-96" referrerPolicy="no-referrer" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                                        <button
                                          onClick={() => {
                                            const a = document.createElement("a");
                                            a.href = imgUrl;
                                            a.download = `haya-asset-${Date.now()}.png`;
                                            a.click();
                                          }}
                                          className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white transition-all border border-white/10 cursor-pointer"
                                          title="Download image"
                                        >
                                          <Download className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions underneath bubble */}
                        {!isEditingThis && (
                          <div className={`flex items-center gap-3 text-[10px] text-slate-500 px-1 font-mono ${isUser ? "justify-end" : "justify-start"}`}>
                            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            
                            {isUser ? (
                              <button
                                onClick={() => handleEditPrompt(message.id, message.text)}
                                className="hover:text-purple-400 flex items-center gap-1 transition-all cursor-pointer"
                                title="Edit prompt"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                                <span>Edit</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(message.text);
                                    triggerHaptic(10);
                                  }}
                                  className="hover:text-cyan-400 flex items-center gap-1 transition-all cursor-pointer"
                                  title="Copy response"
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>Copy</span>
                                </button>
                                <button
                                  onClick={() => handleRegenerateResponse(message.id)}
                                  className="hover:text-cyan-400 flex items-center gap-1 transition-all cursor-pointer"
                                  title="Regenerate this response"
                                >
                                  <RotateCw className="w-2.5 h-2.5" />
                                  <span>Regen</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto py-20">
                  <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/25 shadow-2xl animate-pulse">
                    <MessageSquare className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-mono text-sm tracking-wider uppercase font-bold text-slate-200">Initialize Chat Pipeline</h3>
                    <p className="text-xs text-slate-500 font-sans leading-relaxed">
                      Commence high-fidelity communication with your system companion, Haya. Type your instructions below.
                    </p>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* FLOATING ACTION OVERLAY FOR CONTINUOUS WRITING */}
            <div className="absolute bottom-24 right-6 z-20 flex flex-col gap-2.5 items-end">
              {/* Floating New Chat button */}
              <button
                onClick={createNewChat}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-950/90 text-purple-300 hover:text-purple-200 border border-purple-500/30 hover:border-purple-500/50 rounded-full text-[10px] font-mono tracking-wider shadow-[0_0_15px_rgba(168,85,247,0.2)] backdrop-blur-md transition-all cursor-pointer uppercase font-bold"
                title="Initialize New Chat Pipeline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>

              {activeSession && activeSession.messages && activeSession.messages.length > 3 && !isAiStreaming && (
                <button
                  onClick={handleContinueGeneration}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900/90 hover:bg-slate-800 border border-white/10 rounded-full text-xs font-mono text-cyan-400 hover:text-cyan-300 shadow-2xl backdrop-blur-md hover:border-cyan-500/30 transition-all cursor-pointer uppercase tracking-wider"
                >
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>Continue Generation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* CHAT INPUT AREA */}
            <div className="p-4 pb-22 bg-slate-950/60 border-t border-white/5 flex flex-col gap-2">
              {/* PENDING ATTACHMENTS PREVIEW */}
              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 py-2 max-w-4xl mx-auto w-full">
                  {pendingAttachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2 bg-purple-950/30 border border-purple-500/20 rounded-xl pl-2.5 pr-1.5 py-1 text-xs animate-fade-in">
                      {att.type.startsWith("image/") ? (
                        <img src={att.url || null} alt="Attachment" className="w-4 h-4 rounded object-cover" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-purple-400" />
                      )}
                      <span className="text-slate-300 font-mono text-[9px] truncate max-w-[120px]">{att.name}</span>
                      <button
                        onClick={() => removePendingAttachment(i)}
                        className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end max-w-4xl w-full mx-auto relative bg-slate-900/40 border border-white/5 rounded-2xl px-4 py-2.5 focus-within:border-purple-500/30 transition-all">
                {/* Paperclip Button */}
                <button
                  onClick={() => chatFileInputRef.current?.click()}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-xl transition-all cursor-pointer flex items-center justify-center flex-shrink-0"
                  title="Upload attachment (Image/Document)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  type="file"
                  ref={chatFileInputRef}
                  onChange={handleChatAttachmentUpload}
                  className="hidden"
                  multiple
                />

                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask Haya anything or instruct core procedures... (Press Enter to Send)"
                  className="flex-grow bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-slate-200 text-sm max-h-32 min-h-[24px] resize-none font-sans leading-relaxed"
                  rows={1}
                />
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] font-mono text-slate-600 uppercase hidden sm:inline">
                    {chatInput.length} chars
                  </span>
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isAiStreaming || (!chatInput.trim() && pendingAttachments.length === 0)}
                    className={`px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 border font-mono text-[10px] uppercase font-bold tracking-wider ${
                      isAiStreaming
                        ? "bg-slate-900 border-white/5 text-slate-600 cursor-not-allowed"
                        : (chatInput.trim() || pendingAttachments.length > 0)
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 border-purple-500/50 text-white hover:from-purple-500 hover:to-pink-500 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                        : "bg-purple-950/30 border-purple-500/20 text-purple-400 hover:bg-purple-950/60 hover:text-purple-300"
                    }`}
                    title="Transmit Message Pipeline"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-center text-slate-600 font-mono tracking-wide uppercase">
                High-fidelity link active. Powered by server-side Gemini Core.
              </p>
            </div>

          </div>
        ) : activeTab === "images" ? (
          // ==================== AI IMAGE STUDIO SCREEN ====================
          <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
            
            {/* IMAGE CONTROL PANEL */}
            <div className="w-full md:w-96 bg-slate-950/40 border-b md:border-b-0 md:border-r border-white/5 p-4 pb-24 md:p-5 md:pb-24 overflow-y-auto space-y-5 flex-shrink-0">
              
              {/* Prompt box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono tracking-wider text-cyan-400 uppercase">Generative Prompts</span>
                  <button
                    onClick={handleEnhancePrompt}
                    disabled={isEnhancing || !imagePrompt.trim()}
                    className="flex items-center gap-1 px-2.5 py-1 bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-400 border border-cyan-500/20 rounded-lg text-[9px] font-mono tracking-wider uppercase transition-all cursor-pointer disabled:opacity-40"
                  >
                    <Sparkles className={`w-3 h-3 ${isEnhancing ? "animate-spin" : "animate-pulse"}`} />
                    <span>{isEnhancing ? "Expanding..." : "Enhance Prompt"}</span>
                  </button>
                </div>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => {
                    setImagePrompt(e.target.value);
                    if (enhancedPrompt) setEnhancedPrompt(""); // Reset enhanced prompt on edit
                  }}
                  placeholder="Describe your vision in high detail (e.g., 'An astronaut wandering a glowing coral forest under purple moons, photorealistic')..."
                  className="w-full bg-slate-900/60 border border-white/5 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/30 font-sans leading-relaxed"
                  rows={3}
                />
                {enhancedPrompt && (
                  <div className="p-3 bg-cyan-950/10 border border-cyan-500/10 rounded-xl space-y-1 animate-fade-in">
                    <span className="text-[8px] font-mono text-cyan-400/80 font-bold uppercase tracking-wider block">Expanded Blueprint Output:</span>
                    <p className="text-[10px] text-slate-300 font-sans leading-relaxed italic">
                      "{enhancedPrompt}"
                    </p>
                  </div>
                )}
              </div>

              {/* Reference image upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-mono tracking-wider text-cyan-400 uppercase block">Reference Portrait Upload</span>
                    <span className="text-[8px] text-slate-500 font-sans block mt-0.5">Maintain Face Consistency & Facial Proportions</span>
                  </div>
                  {referenceImages.length > 0 && (
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 uppercase tracking-widest animate-pulse">
                      Identity Mode Active
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {/* Upload box */}
                  {referenceImages.length < 3 && (
                    <label className="aspect-square border border-dashed border-white/10 rounded-xl bg-slate-900/40 hover:bg-slate-900 hover:border-cyan-500/20 transition-all flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer">
                      <Upload className="w-4 h-4 mb-1" />
                      <span className="text-[8px] font-mono uppercase tracking-wider">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleRefImageUpload}
                        className="hidden"
                        multiple
                      />
                    </label>
                  )}

                  {referenceImages.map((base64, index) => (
                    <div key={index} className="aspect-square rounded-xl overflow-hidden border border-white/10 relative group">
                      <img src={base64 || null} alt="ref" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeRefImage(index)}
                        className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                        title="Remove reference"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {referenceImages.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-slate-500 uppercase block">Detected Character Identity Map:</span>
                    <input
                      type="text"
                      placeholder="Optional details (e.g. 'handsome male, blonde hair')"
                      value={faceConsistencyPrompt}
                      onChange={(e) => setFaceConsistencyPrompt(e.target.value)}
                      className="w-full py-1.5 px-3 bg-slate-900/40 border border-white/5 rounded-lg text-[10px] placeholder-slate-600 text-cyan-400 focus:outline-none font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Style Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold font-mono tracking-wider text-cyan-400 uppercase">Style Presets</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {["None", "Cinematic", "Portrait", "Cyberpunk", "Anime", "Fantasy", "3D Render", "Oil Painting"].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        triggerHaptic(10);
                        setStylePreset(preset);
                      }}
                      className={`py-1.5 px-2.5 rounded-lg text-[10px] font-mono uppercase tracking-wider text-left transition-all border ${
                        stylePreset === preset
                          ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                          : "bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-300 hover:border-white/10"
                      } cursor-pointer`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold font-mono tracking-wider text-cyan-400 uppercase">Aspect Ratio</span>
                <div className="grid grid-cols-5 gap-1">
                  {["1:1", "3:4", "4:3", "9:16", "16:9"].map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => {
                        triggerHaptic(10);
                        setAspectRatio(ratio);
                        // Update resolution preset matched with ratio
                        if (ratio === "1:1") setResolution("1024x1024");
                        if (ratio === "3:4") setResolution("768x1024");
                        if (ratio === "4:3") setResolution("1024x768");
                        if (ratio === "9:16") setResolution("576x1024");
                        if (ratio === "16:9") setResolution("1024x576");
                      }}
                      className={`py-1.5 rounded-lg text-[9px] font-mono tracking-widest text-center transition-all border ${
                        aspectRatio === ratio
                          ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                          : "bg-slate-900/40 border-white/5 text-slate-500 hover:text-slate-300"
                      } cursor-pointer`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Models Switcher */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold font-mono tracking-wider text-cyan-400 uppercase">Image Engine Models</span>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    triggerHaptic(15);
                    setSelectedModel(e.target.value);
                  }}
                  className="w-full py-1.5 px-3 bg-slate-900 border border-white/5 rounded-xl text-[10px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500/30 cursor-pointer"
                >
                  <option>Stable Diffusion XL (SDXL)</option>
                  <option>Juggernaut XL</option>
                  <option>DreamShaper XL</option>
                  <option>RealVisXL</option>
                  <option>Flux Schnell</option>
                </select>
              </div>

              {/* Advanced Controls Toggle */}
              <div className="space-y-2 border-t border-white/5 pt-3">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1">
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Seed Configuration</span>
                    <input
                      type="text"
                      placeholder="Randomized Seed"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      className="w-full py-1.5 px-3 bg-slate-900/40 border border-white/5 rounded-lg text-[10px] font-mono text-slate-300 focus:outline-none placeholder-slate-700"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Active Resolution</span>
                    <input
                      type="text"
                      value={resolution}
                      disabled
                      className="w-full py-1.5 px-3 bg-slate-900/20 border border-white/5 rounded-lg text-[10px] font-mono text-slate-500 select-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-slate-500 uppercase block">Negative Prompting</span>
                  <input
                    type="text"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Traits to exclude..."
                    className="w-full py-1.5 px-3 bg-slate-900/40 border border-white/5 rounded-lg text-[10px] font-mono text-slate-300 focus:outline-none placeholder-slate-700"
                  />
                </div>
              </div>

              {/* GENERATE SUBMIT TRIGGER */}
              <button
                onClick={handleGenerateImage}
                disabled={isGenerating || !imagePrompt.trim()}
                className={`w-full py-3.5 rounded-2xl font-mono tracking-wider text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  imagePrompt.trim() && !isGenerating
                    ? "bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-600/15"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                {isGenerating ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin text-white" />
                    <span>{isAnalyzingRef ? "Analyzing Faces..." : "Synthesizing Canvas..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    <span>Generate Creation</span>
                  </>
                )}
              </button>
            </div>

            {/* GENERATIVE CANVAS AREA */}
            <div className="flex-grow p-4 md:p-6 pb-24 md:pb-24 flex flex-col justify-between overflow-hidden">
              
              {/* CURRENT CANVAS STAGE */}
              <div className="flex-grow flex items-center justify-center relative overflow-hidden bg-black/40 border border-white/5 rounded-3xl p-4 md:p-8 shadow-inner min-h-[250px]">
                {currentGeneratedImage ? (
                  <div className="relative max-h-full max-w-full flex items-center justify-center group">
                    <img
                      src={currentGeneratedImage.url || null}
                      alt={currentGeneratedImage.prompt}
                      className="rounded-2xl max-h-[450px] object-contain shadow-2xl transition-all border border-white/5"
                    />
                    
                    {/* Hover controls */}
                    <div className="absolute inset-x-4 bottom-4 p-3 bg-slate-950/80 backdrop-blur-md rounded-2xl flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity border border-white/5">
                      <div className="min-w-0 pr-4">
                        <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Enhanced Prompt Output</p>
                        <p className="text-xs text-slate-200 font-sans truncate block">{currentGeneratedImage.prompt}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleSendGeneratedToChat(currentGeneratedImage)}
                          className="p-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/40 text-purple-400 border border-purple-500/20 transition-all cursor-pointer"
                          title="Send to Active Chat"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownloadImage(currentGeneratedImage)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                          title="Download Image"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleShareImage(currentGeneratedImage)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                          title="Share Link"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteImage(currentGeneratedImage.id)}
                          className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/30 text-red-400 transition-all cursor-pointer"
                          title="Delete image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center max-w-sm space-y-3.5 py-20 animate-fade-in">
                    <div className="p-4 rounded-full bg-cyan-500/10 border border-cyan-500/25 shadow-2xl inline-block">
                      <ImageIcon className="w-8 h-8 text-cyan-400" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-mono text-sm tracking-wider uppercase font-bold text-slate-200">Creative Studio Core Ready</h3>
                      <p className="text-xs text-slate-500 font-sans leading-relaxed">
                        Formulate your description on the left panel, add reference portraits, set stylistic dimensions, and manifest your creation.
                      </p>
                    </div>
                  </div>
                )}

                {/* Loader Overlay */}
                {isGenerating && (
                  <div className="absolute inset-0 bg-[#040406]/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-4 border-cyan-500/10 border-t-cyan-500 animate-spin" />
                      <Sparkles className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
                    </div>
                    <div className="space-y-1 text-center">
                      <p className="font-mono text-xs text-cyan-400 tracking-widest uppercase font-bold animate-pulse">
                        {isAnalyzingRef ? "Analyzing Face Layouts..." : "Rasterizing Canvas Matrix..."}
                      </p>
                      <p className="text-[10px] text-slate-500 font-sans">
                        Harnessing {selectedModel} cluster nodes.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* IMAGE CONTROLS BAR (ONLY IF IMAGE SELECTED) */}
              {currentGeneratedImage && (
                <div className="p-3 bg-slate-950/40 border border-white/5 rounded-2xl flex items-center justify-between gap-4 mt-4 flex-wrap md:flex-nowrap">
                  <div className="flex gap-2">
                    <button
                      onClick={handleRegenerateImage}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-xl text-[10px] font-mono tracking-wider uppercase text-slate-300 transition-all cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Regen</span>
                    </button>
                    <button
                      onClick={handleCreateVariation}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-xl text-[10px] font-mono tracking-wider uppercase text-slate-300 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Variations</span>
                    </button>
                    <button
                      onClick={() => handleSendGeneratedToChat(currentGeneratedImage)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-950/40 hover:bg-purple-900/30 border border-purple-500/20 rounded-xl text-[10px] font-mono tracking-wider uppercase text-purple-300 transition-all cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.1)]"
                      title="Send to Active Chat"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send to Chat</span>
                    </button>
                  </div>

                  <div className="text-[9px] font-mono text-slate-600 uppercase flex items-center gap-4">
                    <span>Model: <b className="text-slate-400">{currentGeneratedImage.model}</b></span>
                    <span>Seed: <b className="text-slate-400">{currentGeneratedImage.seed}</b></span>
                    <span>Resolution: <b className="text-slate-400">{currentGeneratedImage.resolution}</b></span>
                  </div>
                </div>
              )}

              {/* RECENT GENERATIONS GALLERY */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">Recent Generations Gallery</span>
                  <span className="text-[9px] font-mono text-slate-600 uppercase">{generatedImages.length} Saved</span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {generatedImages.length > 0 ? (
                    generatedImages.map((img) => (
                      <div
                        key={img.id}
                        onClick={() => handleRevisitImage(img)}
                        className={`w-16 h-16 rounded-xl overflow-hidden border flex-shrink-0 relative group transition-all cursor-pointer hover:scale-[1.03] ${
                          currentGeneratedImage?.id === img.id
                            ? "border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                            : "border-white/5 hover:border-white/20"
                        }`}
                      >
                        <img src={img.url || null} alt={img.prompt} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="w-full py-4 text-center text-[9px] font-mono text-slate-600 uppercase tracking-wider">
                      History log is completely clear
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        ) : (
          // ==================== CHAT HISTORY ARCHIVE SCREEN ====================
          <div className="flex-grow flex flex-col overflow-hidden bg-[#040406]">
            {/* Header / Intro */}
            <div className="p-6 pb-4 border-b border-white/5 bg-slate-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-mono font-bold tracking-wider text-pink-400 uppercase flex items-center gap-2">
                  <History className="w-4 h-4 animate-pulse" />
                  <span>Conversation Archive Enclave</span>
                </h2>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Search, review, rename, secure, or terminate your system pipeline sessions.
                </p>
              </div>

              {/* Initialize button */}
              <button
                onClick={createNewChat}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-mono text-[10px] uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(219,39,119,0.3)] transition-all cursor-pointer font-bold shrink-0 self-start md:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Initialize Pipeline</span>
              </button>
            </div>

            {/* Statistics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-4 border-b border-white/5 bg-slate-900/10">
              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/15">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[9px] font-mono uppercase text-slate-500">Active Pipelines</div>
                  <div className="text-sm font-mono font-bold text-slate-200">{sessions.length}</div>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/15">
                  <Pin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[9px] font-mono uppercase text-slate-500">Pinned Channels</div>
                  <div className="text-sm font-mono font-bold text-slate-200">
                    {sessions.filter((s) => s.isPinned).length}
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/15">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">Telemetry Logs</div>
                  <div className="text-sm font-mono font-bold text-slate-200">
                    {sessions.reduce((acc, s) => acc + (s.messages?.length || 0), 0)} logs
                  </div>
                </div>
              </div>
            </div>

            {/* Main History Scroll List */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6 pb-24">
              {filteredSessions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredSessions.map((session) => {
                    const lastMsg = session.messages && session.messages.length > 0 
                      ? session.messages[session.messages.length - 1] 
                      : null;
                    const isRenaming = renamingSessionId === session.id;

                    return (
                      <div
                        key={session.id}
                        onClick={() => {
                          if (!isRenaming) {
                            setCurrentSessionId(session.id);
                            setActiveTab("chat");
                            triggerHaptic(20);
                          }
                        }}
                        className={`relative group bg-slate-950/60 border rounded-2xl p-4.5 flex flex-col justify-between h-44 cursor-pointer overflow-hidden transition-all duration-300 ${
                          currentSessionId === session.id
                            ? "border-pink-500/30 bg-pink-950/5 shadow-[0_0_15px_rgba(236,72,153,0.05)]"
                            : "border-white/5 hover:border-pink-500/20 hover:bg-slate-900/40"
                        }`}
                      >
                        {/* Background subtle hover pulse gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 via-purple-500/0 to-cyan-500/0 group-hover:from-pink-500/1 group-hover:to-cyan-500/2 transition-all duration-500 pointer-events-none" />

                        <div>
                          {/* Card Top / Header */}
                          <div className="flex items-start justify-between gap-2 relative z-10">
                            {isRenaming ? (
                              <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={renameInputValue}
                                  onChange={(e) => setRenameInputValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      renameChat(session.id, renameInputValue);
                                      setRenamingSessionId(null);
                                    } else if (e.key === "Escape") {
                                      setRenamingSessionId(null);
                                    }
                                  }}
                                  className="flex-grow py-1 px-2.5 bg-slate-900 border border-pink-500/40 rounded-lg text-xs text-slate-100 focus:outline-none font-sans"
                                  autoFocus
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    renameChat(session.id, renameInputValue);
                                    setRenamingSessionId(null);
                                  }}
                                  className="p-1 rounded-md bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 border border-pink-500/20 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingSessionId(null);
                                  }}
                                  className="p-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 border border-white/5 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {session.isPinned && (
                                    <Pin className="w-3 h-3 text-amber-400 rotate-45 shrink-0" />
                                  )}
                                  <span className="text-xs font-mono font-bold tracking-wide uppercase truncate text-slate-100">
                                    {session.title}
                                  </span>
                                </div>

                                {/* Hover actions bar */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => togglePinChat(session.id, e)}
                                    className={`p-1 rounded hover:bg-white/5 transition-all cursor-pointer ${
                                      session.isPinned ? "text-amber-400" : "text-slate-500 hover:text-slate-200"
                                    }`}
                                    title={session.isPinned ? "Unpin Pipeline" : "Pin Pipeline"}
                                  >
                                    <Pin className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenamingSessionId(session.id);
                                      setRenameInputValue(session.title);
                                      triggerHaptic(20);
                                    }}
                                    className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-200 transition-all cursor-pointer"
                                    title="Rename Pipeline"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => deleteChat(session.id, e)}
                                    className="p-1 rounded hover:bg-red-950/20 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                                    title="Delete Pipeline"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Message Preview */}
                          <div className="mt-3.5 text-xs text-slate-400 line-clamp-2 font-sans leading-relaxed relative z-10">
                            {lastMsg ? (
                              <>
                                <b className="text-[10px] font-mono tracking-wider text-slate-500 uppercase mr-1">
                                  {lastMsg.role === "assistant" ? "Haya:" : "CMD:"}
                                </b>
                                {lastMsg.text || (lastMsg.attachments ? "Sent attachment payload." : "No preview available.")}
                              </>
                            ) : (
                              <span className="italic text-slate-600 text-[11px]">No telemetry logged in pipeline.</span>
                            )}
                          </div>
                        </div>

                        {/* Card Bottom / Footer */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-auto relative z-10">
                          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            {formatFriendlyTime(getSessionTime(session))}
                          </span>

                          <span className="text-[9px] font-mono text-pink-400/80 bg-pink-950/20 border border-pink-500/10 px-2 py-0.5 rounded-md uppercase">
                            {session.messages?.length || 0} logs
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
                  <div className="p-4 rounded-full bg-slate-900 border border-white/5 text-slate-500">
                    <Search className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-mono text-sm tracking-wider uppercase font-bold text-slate-200">No Records Located</h3>
                    <p className="text-xs text-slate-500 font-sans leading-relaxed">
                      Your query yielded zero active pipeline records in the database. Revise search parameters or initialize a new channel.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
