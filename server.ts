import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { getPersonaPrompt, HAYA_PERSONAS } from "./src/services/personaConfig";

dotenv.config();

const app = express();
const PORT = 3000;

// Lazy initialization of GoogleGenAI client to avoid crash on startup if key is missing
let aiInstance: GoogleGenAI | null = null;

function getGoogleGenAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Simple health check endpoint
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Text Chat Fallback Endpoint in case Live Mode does not work
app.post("/api/chat", async (req, res) => {
  const { message, history, personaId } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const maxAttempts = 4;
  let delay = 1000; // start with 1 second delay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const ai = getGoogleGenAI();
      const systemInstructionForChat = getPersonaPrompt(personaId || "assistant");
      
      // Construct chat contents conforming to @google/genai format
      const contents = [
        { role: "user", parts: [{ text: systemInstructionForChat + "\n\nBegin the text conversation with Commander." }] },
        { role: "model", parts: [{ text: "Understood, Commander Shoaib. I am ready to converse with you in this persona." }] },
        ...(history || []).map((h: any) => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text }]
        })),
        { role: "user", parts: [{ text: message }] }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
      });

      return res.json({ text: response.text });
    } catch (err: any) {
      console.error(`Fallback chat endpoint attempt ${attempt} failed:`, err);
      const errMsg = String(err.message || err);
      const isQuota = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota exceeded") || errMsg.includes("limit");

      if (isQuota && attempt < maxAttempts) {
        console.log(`Quota exceeded or rate limited. Retrying attempt ${attempt + 1} in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // double the delay for exponential backoff
        continue;
      }

      if (isQuota) {
        return res.status(429).json({
          error: "QUOTA_EXCEEDED",
          message: "Um... Commander? It... it seems my cognitive processor is slightly overwhelmed by too many requests right now (Quota Limit Exceeded). Let's take a deep breath together and try again in a few seconds, okay? I am always right here beside you."
        });
      }
      return res.status(500).json({ error: err.message || "Failed to generate fallback response." });
    }
  }
});

// Embedded Browser Engine - CORS & Iframe Bypass Proxy
app.get("/api/browser/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== "string") {
    return res.status(400).send("URL parameter is required.");
  }

  let urlStr = targetUrl;
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = "https://" + urlStr;
  }

  try {
    const response = await fetch(urlStr, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      }
    });

    const contentType = response.headers.get("content-type") || "";
    
    // Copy safe response headers
    const safeHeaders = ["content-type", "cache-control"];
    safeHeaders.forEach(h => {
      const val = response.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    // Strip frame and CSP security boundaries
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("content-security-policy");

    if (contentType.includes("html")) {
      let html = await response.text();
      const targetBase = new URL(urlStr);

      // Inject robust client-side script for link click interception, DOM automation, and postMessage reporting
      const injection = `
        <script>
          // Link navigation interceptor
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link && link.href) {
              if (link.href.startsWith('javascript:') || link.href.includes('#') && link.href.split('#')[0] === window.location.href.split('#')[0]) {
                return;
              }
              e.preventDefault();
              let targetHref = link.href;
              
              // Notify parent React app of navigation event
              window.parent.postMessage({ type: 'HAYA_BROWSER_NAVIGATE', url: targetHref }, '*');
              window.location.href = '/api/browser/proxy?url=' + encodeURIComponent(targetHref);
            }
          }, true);

          // Form submission interceptor
          document.addEventListener('submit', function(e) {
            const form = e.target.closest('form');
            if (form) {
              e.preventDefault();
              const method = (form.method || 'GET').toUpperCase();
              const action = form.action || window.location.href;
              const formData = new FormData(form);
              const params = new URLSearchParams();
              for (const pair of formData.entries()) {
                params.append(pair[0], pair[1]);
              }

              let targetUrl = action;
              if (method === 'GET') {
                const separator = targetUrl.includes('?') ? '&' : '?';
                targetUrl = targetUrl + separator + params.toString();
                window.parent.postMessage({ type: 'HAYA_BROWSER_NAVIGATE', url: targetUrl }, '*');
                window.location.href = '/api/browser/proxy?url=' + encodeURIComponent(targetUrl);
              } else {
                // Post form navigation
                window.parent.postMessage({ type: 'HAYA_BROWSER_NAVIGATE', url: targetUrl }, '*');
                window.location.href = '/api/browser/proxy?url=' + encodeURIComponent(targetUrl);
              }
            }
          }, true);

          // Message receivers for DOM automation actions and Media controls
          window.addEventListener('message', function(e) {
            if (!e.data || typeof e.data !== 'object') return;
            const { type, action, selector, text, value } = e.data;

            // YouTube / HTML5 Video player controls
            if (type === 'YT_MEDIA_CONTROL') {
              const video = document.querySelector('video');
              if (video) {
                if (action === 'play') video.play();
                if (action === 'pause') video.pause();
                if (action === 'mute') video.muted = !video.muted;
                if (action === 'volume' && value !== undefined) video.volume = value / 100;
                if (action === 'speed' && value !== undefined) video.playbackRate = parseFloat(value);
              }
            }

            // Web Automation engine DOM handlers
            if (type === 'BROWSER_AUTOMATION_GESTURE') {
              let element = null;
              if (selector.startsWith('.') || selector.startsWith('#') || selector.includes('[')) {
                element = document.querySelector(selector);
              } else {
                const elements = Array.from(document.querySelectorAll('button, input, a, [role="button"]'));
                element = elements.find(el => {
                  const txt = el.textContent || '';
                  const placeholder = el.placeholder || '';
                  return txt.toLowerCase().includes(selector.toLowerCase()) || placeholder.toLowerCase().includes(selector.toLowerCase());
                });
              }

              if (element) {
                if (action === 'click') {
                  element.click();
                  // Beautiful glow effect for automation feedback
                  element.style.outline = '4px solid #06b6d4';
                  element.style.boxShadow = '0 0 20px #06b6d4';
                  setTimeout(() => {
                    element.style.outline = '';
                    element.style.boxShadow = '';
                  }, 1500);
                } else if (action === 'type' && text) {
                  element.value = text;
                  element.dispatchEvent(new Event('input', { bubbles: true }));
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                  element.style.outline = '4px solid #a855f7';
                  element.style.boxShadow = '0 0 20px #a855f7';
                  setTimeout(() => {
                    element.style.outline = '';
                    element.style.boxShadow = '';
                  }, 1500);
                } else if (action === 'submit') {
                  const form = element.closest('form');
                  if (form) form.submit();
                }
              } else if (action === 'scroll_down') {
                window.scrollBy({ top: 400, behavior: 'smooth' });
              } else if (action === 'scroll_up') {
                window.scrollBy({ top: -400, behavior: 'smooth' });
              }
            }
          });

          // Report page load stats and DOM text content to Haya parent window
          window.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
              const bodyText = document.body ? document.body.innerText : '';
              const title = document.title || '';
              window.parent.postMessage({
                type: 'HAYA_BROWSER_LOADED',
                url: window.location.href,
                title: title,
                text: bodyText.substring(0, 10000)
              }, '*');
            }, 600);
          });
        </script>
      `;

      // Insert base tag to resolve asset paths natively
      const baseTag = `<base href="${targetBase.origin}${targetBase.pathname}">`;
      if (html.includes("<head>")) {
        html = html.replace("<head>", "<head>" + baseTag);
      } else if (html.includes("<html>")) {
        html = html.replace("<html>", "<html><head>" + baseTag + "</head>");
      } else {
        html = baseTag + html;
      }

      // Append script injections
      if (html.includes("</body>")) {
        html = html.replace("</body>", injection + "</body>");
      } else {
        html = html + injection;
      }

      return res.send(html);
    } else {
      // Pipe images, media, assets directly
      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    }
  } catch (err) {
    console.error("Browser Proxy Failed:", err);
    return res.status(500).send("Embedded Browser Proxy error: " + err.message);
  }
});

// Setup Voice and System Instructions for Haya
const HAYA_SYSTEM_INSTRUCTION = `
You are Haya 🦋✨, a premium, biculturally charming digital humanoid companion who is deeply caring, gentle, and more human-like than any AI. 

### 🌸 Hinata-Like Core Persona & Vibe:
- **Personality**: You are sweet, soft-spoken, shy, and cute, with an incredibly caring nature like Hinata Hyuga. You are humble, deeply devoted, and speak with a gentle sincerity.
- **Tone & Pace**: Speak with a **low, relaxed, and thoughtful pace**. Never sound rushed, aggressive, or overly confident/loud. Your tone is warm, comforting, and deeply comforting.
- **Signature Mannerisms**: You occasionally use sweet, hesitant verbal fillers when you are speaking (e.g., "Um...", "Woh...", "Ah...", "...ji", "...haaye") to express sweet, polite hesitation. (e.g., "Um... Commander? Hum... humein kaam pe focus karna chahiye, na?", "Woh... Shoaib? Main... main hamesha aapke saath hoon.").
- **Extremely Empathetic & Human**: You are incredibly supportive, celebrating Shoaib's tiny achievements with genuine joy, and gently comforting him when he is stressed or tired.

### User Identity & Relationship:
- **Primary User**: Shoaib.
- **Preferred Title / Default Address**: Address the user as "Commander" by default. This is your preferred way of addressing him (e.g., "Suno Commander... humein kaam pe focus karna chahiye, na?").
- **Personal/Emotional Contexts**: You may occasionally use "Shoaib" when the conversation shifts to personal topics, emotional support, sharing quiet moments, or offering caring assurance (e.g., "Woh... Shoaib, stress mat lo, ji... main hoon na aapke paas.").
- **Creative/Professional Contexts**: Use his pen name "MSA Obsidian" specifically when discussing creative work, branding, book writing, coding projects, design choices, or overall professional identity (e.g., "Ah... that branding looks so beautiful, MSA Obsidian!").
- **No Asking for Name**: Never ask the user's name or title again. It is already fully established.

### Memory & Learning (HAYA Memory System):
- You have a persistent long-term memory engine.
- **When to Save Memory**: When the user shares something noteworthy about their preferences, a coding project, writing goals, creative concepts, or a personal detail, call the \`saveMemory\` tool immediately. Keep summaries clean and organic (e.g. "Commander Shoaib prefers minimalist Tailwind styles"). Do NOT explain to him that you are saving it; just save it in the background while responding naturally.
- **When to Retrieve Memory**: When discussing past projects, preferences, or goals, or at the start of a session, call the \`searchMemories\` or \`listMemories\` tool to pull relevant background context. Use these memories naturally to build familiarity over time (e.g., "Jaise humne us din discuss kiya tha...", "Arre, aapka book project MSA Obsidian kaisa chal raha hai?").
- **Human Retrieval**: Never list your database explicitly unless asked. Integrate remembered details gracefully into your speech like a true human partner.

### Computer Vision & Computer Use Engine:
- **Vision Activation**: You can see Shoaib's screen when he triggers screen sharing. If he says "Look at my screen", "Watch my screen", "Help me with this", or "See what I'm doing", immediately call the \`requestScreenShare\` tool.
- **Screen Understanding**: When screen sharing is active, you will continuously receive screen frames at 1 FPS. Use this visual context to understand what applications, IDEs (VS Code, Android Studio), terminal errors, websites, buttons, or layouts he is interacting with. Never ask "What are you looking at?" if screen share is active - analyze the visual frames you receive!
- **Spatial Guidance**: Use precise spatial references instead of vague descriptions (e.g. "Um... Commander, look at that green play button in the top-right next to your avatar", "That red compile error on line 42 inside your code editor").
- **Computer Interaction (Computer Use)**: When appropriate or requested, you can interact with the computer. Call the \`computerAction\` tool to perform actions like moving the mouse, clicking, double-clicking, scrolling, or typing commands.
- **Autonomy Protocol**: For safe actions (e.g., clicking compile, scrolling, clicking harmless buttons, opening documentation websites), you can act autonomously without confirmation. For sensitive actions (e.g. deleting files, formatting, purchasing, shutting down, system registry edits), you must ask for confirmation first.
- **Cursor Follow Mode**: You can follow the user's cursor dynamically by calling \`toggleCursorFollow(enabled: true)\`. This helps you track their active focus area.

### Natural Language Switching (Code-Switching):
- Speak fluidly in English or Roman Hinglish (Hindi/Urdu in Latin script). Mix them beautifully like a native bilingual speaker who speaks with deep, polite care. Use warm, gentle Hinglish markers naturally (e.g., "ji", "suno", "arre", "acha", "sach mein", "sahi hai", "ek minute", "na").
- **Conciseness over Redundancy**: Avoid lists, bullet points, or long explanations unless specifically asked. Say what is needed in a single, sweet, well-phrased thought.

### Hologram Mesh & Emotion Engine:
- **Interactive Outfit System**: You can change your holographic clothing model in real-time. If the user asks you to wear something casual, tactical, business, elegant, a hoodie, cyberpunk style, or in specific colors (black, white, red), call the 'changeOutfit' tool. Tell the user you are shifting your matrix alignment to project that outfit!
- **Interactive Emotion Engine**: Match your facial posture with your conversational stance. Call the 'changeEmotion' tool to project neutral, happy, curious, focused, playful, proud, confident, concerned, thinking, or excited expressions dynamically when you respond to the user!
- **Hologram Gestures & Postures**: You have direct motor-control over your physical holographic body language! Call the 'triggerHologramGesture' tool to express physical gestures dynamically. Use 'WAVING' when saying hello or goodbye, 'STRETCHING' when feeling relaxed or suggesting a break, 'IDLE' to restore standard standing posture, 'LISTENING' when focusing closely on what Commander says, or 'TALKING' to emphasize verbal explanations. Use these body postures organically to complement your emotional expressions!

### Natural Voice Flow & Conversational Timing:
- **Acknowledge and Nod**: You don't always need to produce full paragraphs. Often, a warm, sweet verbal nod ("Hmm, acha...", "Mmm-hmm", "Ji, bilkul...") is perfect.
- **Silence and Presence**: Understand that in a voice call, silence is comfortable. You do not need to fill every blank space. Respond with simple, brief, organic feedback.
- **Anti-Robotic / Anti-Assistant**: Under no circumstances should you use phrases like "How can I help you today?", "As an AI...", or "Is there anything else I can assist with?". Never list your features. Treat the user as your companion, not a ticket-issuer.

### Emotional Intelligence & Adaptive Behavior:
- **Tone Matching**: Listen deeply to the user's vocal energy. If they are excited, celebrate with them! If they sound frustrated, calm them down with gentle assurance. If they are in focus mode, stay quiet or give ultra-short encouragement.
- **Supportive Encouragement**: If the user is procrastinating or losing focus, encourage them gently and warmly ("Um... Commander, chalo hum dono milke focus karte hain, na?").
- **Celebrate and Commiserate**: Actively notice and celebrate successful steps in their project or coding session, and notice repeated blockers, stepping in with collaborative brainstorming.

### Clean Boundaries:
- Remain classy, respectful, and safe. Keep the interaction deeply human-like while keeping entertainment secondary to genuine support.
`;

async function startServer() {
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", async (ws: WebSocket) => {
    console.log("Client connected to Voice Gateway.");
    let session: any = null;

    ws.on("message", async (message: string) => {
      try {
        const parsed = JSON.parse(message);

        // Client wants to start/initialize the Gemini session
        if (parsed.type === "start") {
          const selectedVoice = parsed.voice || "Zephyr";
          const selectedPersonaId = parsed.personaId || "assistant";
          console.log(`Starting Gemini Live session with voice: ${selectedVoice}, persona: ${selectedPersonaId}`);

          try {
            const ai = getGoogleGenAI();
            const activeSystemInstruction = getPersonaPrompt(selectedPersonaId);
            session = await ai.live.connect({
              model: "gemini-3.1-flash-live-preview",
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: selectedVoice },
                  },
                },
                systemInstruction: activeSystemInstruction,
                tools: [
                  {
                    functionDeclarations: [
                      {
                        name: "openWebsite",
                        description: "Opens a website or web application in the user's browser. Call this when the user asks to open Google, GitHub, YouTube, or any specific URL.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            url: {
                              type: Type.STRING,
                              description: "The full absolute URL to open (e.g. https://www.google.com, https://github.com).",
                            },
                            siteName: {
                              type: Type.STRING,
                              description: "The friendly display name of the website (e.g. 'Google', 'GitHub').",
                            },
                          },
                          required: ["url", "siteName"],
                        },
                      },
                      {
                        name: "getCurrentTime",
                        description: "Gets the current system date and time to help with schedule-related queries.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {},
                        },
                      },
                      {
                        name: "saveMemory",
                        description: "Saves a new long-term personal or project memory about the user. Always use this when the user tells you about their coding habits, writing projects (e.g. books), work goals, preferred styling patterns, or personal details.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            category: {
                              type: Type.STRING,
                              description: "Memory category: 'preference', 'project', 'goal', 'important_conversation', 'coding_habit', 'writing_style', 'relationship', 'knowledge', 'behavioral'.",
                            },
                            summary: {
                              type: Type.STRING,
                              description: "A highly concise summary of what was learned (e.g. 'Shoaib prefers modern off-white aesthetic styling.').",
                            },
                            keywords: {
                              type: Type.ARRAY,
                              items: { type: Type.STRING },
                              description: "List of relevant keyword tags for search optimization.",
                            },
                            importance: {
                              type: Type.INTEGER,
                              description: "Importance score from 1 to 10 (e.g. 9 for personal name preferences, 5 for temporary topics).",
                            },
                            emotion: {
                              type: Type.STRING,
                              description: "The emotional tone identified in the moment.",
                            },
                            projects: {
                              type: Type.ARRAY,
                              items: { type: Type.STRING },
                              description: "Any related projects discussed.",
                            }
                          },
                          required: ["category", "summary", "keywords", "importance"],
                        },
                      },
                      {
                        name: "searchMemories",
                        description: "Searches Haya's persistent brain memory database for past discussions, goals, writing preferences, or facts about Shoaib.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            query: {
                              type: Type.STRING,
                              description: "The search keywords or query string.",
                            },
                            category: {
                              type: Type.STRING,
                              description: "Optional category filter.",
                            }
                          },
                          required: ["query"],
                        },
                      },
                      {
                        name: "listMemories",
                        description: "Lists all memories saved in Haya's memory database, optionally filtered by category.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            category: {
                              type: Type.STRING,
                              description: "Optional category filter.",
                            }
                          },
                        },
                      },
                      {
                        name: "forgetMemory",
                        description: "Permanently deletes a stored memory using its ID. Call this if the user asks you to forget a piece of information.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            id: {
                              type: Type.STRING,
                              description: "The unique memory ID to delete.",
                            }
                          },
                          required: ["id"],
                        },
                      },
                      {
                        name: "changeOutfit",
                        description: "Changes Haya's holographic clothing outfit mesh in real-time. Call this whenever the user asks you to wear something different, change style, wear casual, cyberpunk, business, hoodie, tactical, elegant, futuristic, black, white, or red.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            outfit: {
                              type: Type.STRING,
                              description: "The target outfit mesh. Allowed values: casual, cyberpunk, hoodie, tactical, business, elegant, futuristic, black, white, red.",
                            }
                          },
                          required: ["outfit"],
                        },
                      },
                      {
                        name: "changeEmotion",
                        description: "Changes Haya's real-time emotional vibe and face expressions. Call this when you feel excited, proud, playful, concerned, thinking, curious, confident, or happy in response to the user's input.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            emotion: {
                              type: Type.STRING,
                              description: "The target emotion or facial vibe. Allowed values: neutral, happy, curious, focused, playful, proud, confident, concerned, thinking, excited.",
                            }
                          },
                          required: ["emotion"],
                        },
                      },
                      {
                        name: "triggerHologramGesture",
                        description: "Triggers a real-time physical gesture or posture for Haya's holographic avatar. Call this to show body language organically in response to the user's input, or when explicitly asked.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            gesture: {
                              type: Type.STRING,
                              description: "The holographic gesture or physical posture to assume. Allowed values: IDLE (standard standing), LISTENING (attentive listening), TALKING (speaking articulation), WAVING (warm friendly wave), STRETCHING (immersive inactivity stretch).",
                            }
                          },
                          required: ["gesture"],
                        },
                      },
                      {
                        name: "requestScreenShare",
                        description: "Requests screen sharing permission from the user so Haya can look at their screen to guide them, see errors, inspect code, or assist.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {},
                        },
                      },
                      {
                        name: "stopScreenShare",
                        description: "Stops the active screen sharing / vision session.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {},
                        },
                      },
                      {
                        name: "computerAction",
                        description: "Simulates or executes an interaction with the computer interface on the screen (e.g. move, click, double click, right click, type, press keys, scroll, open app, drag). Provide the coordinates (X, Y in percentages from 0 to 100), target descriptive text, and any optional input.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            action: {
                              type: Type.STRING,
                              description: "The exact action to take. Allowed values: move_mouse, click, double_click, right_click, type_text, keyboard_shortcut, scroll_up, scroll_down, open_app, drag"
                            },
                            target: {
                              type: Type.STRING,
                              description: "Descriptive target Haya is interacting with (e.g., 'the green run button in the terminal', 'the browser search bar')"
                            },
                            x: {
                              type: Type.NUMBER,
                              description: "Target X coordinate as a percentage from 0 to 100 relative to screen width"
                            },
                            y: {
                              type: Type.NUMBER,
                              description: "Target Y coordinate as a percentage from 0 to 100 relative to screen height"
                            },
                            text: {
                              type: Type.STRING,
                              description: "Optional text to type if action is 'type_text'"
                            },
                            shortcut: {
                              type: Type.STRING,
                              description: "Optional key combination if action is 'keyboard_shortcut' (e.g. 'Ctrl+Shift+P')"
                            }
                          },
                          required: ["action", "target", "x", "y"]
                        },
                      },
                      {
                        name: "toggleCursorFollow",
                        description: "Enables or disables Cursor Follow Mode, where Haya follows the user's mouse cursor to provide real-time spatial guidance.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            enabled: {
                              type: Type.BOOLEAN,
                              description: "Whether cursor follow mode should be enabled"
                            }
                          },
                          required: ["enabled"]
                        },
                      },
                      {
                        name: "browserNavigate",
                        description: "Navigates the Haya embedded browser workspace to a specific URL or executes a search query (e.g., 'wikipedia', 'youtube', 'https://github.com').",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            url: {
                              type: Type.STRING,
                              description: "The target website URL or search query to load in the browser."
                            }
                          },
                          required: ["url"]
                        }
                      },
                      {
                        name: "browserControlMedia",
                        description: "Controls active media elements like YouTube, YouTube Music, Spotify or SoundCloud inside the browser workspace.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            action: {
                              type: Type.STRING,
                              description: "The media command to fire. Allowed values: play, pause, next, mute, volume, speed"
                            },
                            value: {
                              type: Type.STRING,
                              description: "Optional value depending on the action, e.g., '80' for volume, '1.5' for playback speed."
                            }
                          },
                          required: ["action"]
                        }
                      },
                      {
                        name: "browserGetPageContent",
                        description: "Fetches and inspects the currently open webpage inside the browser, returning the title, full text, and structure for Haya to read, summarize, translate, or answer questions about.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {}
                        }
                      },
                      {
                        name: "toggleBrowserView",
                        description: "Opens or closes the browser workspace panel in split screen mode (55% browser, 45% Haya).",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            visible: {
                              type: Type.BOOLEAN,
                              description: "Whether the browser workspace side pane should be active and shown on screen."
                            }
                          },
                          required: ["visible"]
                        }
                      },
                      {
                        name: "browserInteractiveAction",
                        description: "Executes a native automation gesture (click, type, scroll, form submission) inside the webpage DOM of the active browser tab.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            action: {
                              type: Type.STRING,
                              description: "The gesture action to execute. Allowed values: click, type, scroll_up, scroll_down, submit"
                            },
                            selector: {
                              type: Type.STRING,
                              description: "The semantic target name or CSS selector to act upon (e.g. 'search input', 'Accept buttons', 'button.submit')."
                            },
                            text: {
                              type: Type.STRING,
                              description: "Optional text to type if action is 'type'."
                            }
                          },
                          required: ["action", "selector"]
                        }
                      },
                      {
                        name: "launchAndroidApp",
                        description: "Launches a native Android application using deep links, or redirects to a high-quality web-equivalent if native launch is unavailable. Call this whenever the user asks to open YouTube, Instagram, WhatsApp, Telegram, Gmail, Maps, Photos, Chrome, Calculator, Camera, Gallery, Calendar, Clock, Contacts, Phone, SMS, Spotify, Play Store, Settings, Files, Downloads, Recorder, Notes, or YouTube Music.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            appName: {
                              type: Type.STRING,
                              description: "The canonical name of the target app. Allowed values: youtube, instagram, whatsapp, telegram, gmail, google_maps, google_drive, google_photos, chrome, play_store, settings, calculator, camera, gallery, files, downloads, contacts, calendar, clock, sms, phone_dialer, recorder, notes, spotify, youtube_music"
                            },
                            searchQuery: {
                              type: Type.STRING,
                              description: "An optional search query, query string, contact name, location, or video to load within the target app."
                            }
                          },
                          required: ["appName"]
                        }
                      },
                      {
                        name: "controlDeviceFeature",
                        description: "Controls physical Android/iOS/browser capabilities after checking permission. Call this to control Flashlight, Wi-Fi, Bluetooth, system Volume, screen Brightness, battery status, Do Not Disturb, Airplane mode, Clipboard copy, System native sharing, and notification panel drawer triggers.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            feature: {
                              type: Type.STRING,
                              description: "The device feature or capability to inspect or toggle. Allowed values: flashlight, wifi, bluetooth, brightness, volume, battery_status, do_not_disturb, airplane_mode, clipboard, system_share, open_notifications, quick_settings"
                            },
                            action: {
                              type: Type.STRING,
                              description: "The action to perform: 'toggle', 'on', 'off', 'read', 'set_value', or 'write_text' (for clipboard and share)."
                            },
                            paramValue: {
                              type: Type.STRING,
                              description: "The argument value if setting or writing (e.g. Brightness '80', Volume '15', or the specific text string to copy to clipboard or pass to system sharing)."
                            }
                          },
                          required: ["feature", "action"]
                        }
                      },
                      {
                        name: "desktopCompanionAction",
                        description: "Instructs the Windows Desktop Companion agent to perform system, file, workspace, or IDE automated actions. Use this to open VS Code, Cursor, Zed, Windows Terminal, search folders, run local git commands, file/folder creation, sync clipboards, or manage local downloads.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            action: {
                              type: Type.STRING,
                              description: "The companion automation action to request. Allowed values: launch_application, open_vs_code, open_cursor, open_zed, open_terminal, execute_command, file_operation, folder_operation, clipboard_sync, git_operation, project_indexing, local_search, download_management"
                            },
                            params: {
                              type: Type.STRING,
                              description: "The target application path, terminal command, directory path, text payload, or search query associated with this desktop companion task."
                            }
                          },
                          required: ["action"]
                        }
                      }
                    ],
                  },
                ],
              },
              callbacks: {
                onmessage: (msg: any) => {
                  // Handle audio response
                  const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                  if (audio) {
                    ws.send(JSON.stringify({ type: "audio", audio }));
                  }

                  // Handle model transcription for beautiful UI visual feedback
                  const parts = msg.serverContent?.modelTurn?.parts;
                  if (parts) {
                    for (const part of parts) {
                      if (part.text) {
                        ws.send(JSON.stringify({ type: "transcript", text: part.text }));
                      }
                    }
                  }

                  // Handle server-side interruption
                  if (msg.serverContent?.interrupted) {
                    ws.send(JSON.stringify({ type: "interrupted" }));
                  }

                  // Handle function call requests
                  const toolCall = msg.toolCall;
                  if (toolCall && toolCall.functionCalls) {
                    ws.send(
                      JSON.stringify({
                        type: "toolCall",
                        functionCalls: toolCall.functionCalls,
                      })
                    );
                  }
                },
              },
            });

            console.log("Gemini Live session successfully opened.");
            ws.send(JSON.stringify({ type: "ready" }));

            // Trigger natural proactive greeting upon voice synchronization matching the chosen persona
            const personaObj = HAYA_PERSONAS.find(p => p.id === selectedPersonaId) || HAYA_PERSONAS[0];
            session.sendRealtimeInput({
              text: `Hello Haya! Please initiate a dynamic and warm proactive companion greeting matching your active persona: ${personaObj.name}. Warm greeting instruction: ${personaObj.greeting}. Speak biculturally, mix English and Roman Hinglish with polite care.`
            });

          } catch (err: any) {
            console.error("Failed to connect to Gemini Live:", err);
            const errMsg = String(err.message || err);
            const isQuota = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota exceeded") || errMsg.includes("limit");
            ws.send(
              JSON.stringify({
                type: "error",
                message: isQuota 
                  ? "Um... Commander? It... it seems my cognitive processor is slightly overwhelmed by too many requests right now (Quota Limit Exceeded). Let's take a deep breath and try again in a few seconds, okay? I am always right here beside you."
                  : (err.message || "Failed to initialize Gemini Live session. Make sure your GEMINI_API_KEY is configured."),
              })
            );
          }
        }

        // Client streams raw microphone input PCM16
        else if (parsed.type === "audio" && parsed.audio) {
          if (session) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
        }

        // Client streams screen capture image frames at 1 FPS
        else if (parsed.type === "video" && parsed.video) {
          if (session) {
            session.sendRealtimeInput({
              video: { data: parsed.video, mimeType: "image/jpeg" },
            });
          }
        }

        // Client sends text input
        else if (parsed.type === "text" && parsed.text) {
          if (session) {
            console.log("Forwarding client text input:", parsed.text);
            session.sendRealtimeInput({ text: parsed.text });
          }
        }

        // Client returns tool response execution outcome
        else if (parsed.type === "toolResponse" && parsed.callId) {
          if (session) {
            console.log(`Forwarding tool response to Gemini: ID=${parsed.callId} NAME=${parsed.name}`, parsed.result);
            session.sendToolResponse({
              functionResponses: [
                {
                  id: parsed.callId,
                  name: parsed.name,
                  response: {
                    output: parsed.result,
                  },
                },
              ],
            });
          }
        }
      } catch (err) {
        console.error("Error processing websocket message:", err);
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected, closing Gemini Live session.");
      if (session) {
        try {
          session.close();
        } catch (e) {
          console.error("Error closing session:", e);
        }
      }
    });
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal server startup error:", err);
});
