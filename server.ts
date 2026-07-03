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

async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: { model: string; contents: any; config?: any },
  maxAttempts = 4,
  initialDelay = 800
): Promise<any> {
  // Candidate models to fallback to in order of preference if 3.5-flash is rate-limited or fails
  const fallbackModels = [
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  let currentModelIndex = 0;
  let delay = initialDelay;

  // Find where our requested model is in the fallback list or default to 0
  const requestedModel = params.model || "gemini-3.5-flash";
  const foundIndex = fallbackModels.indexOf(requestedModel);
  if (foundIndex !== -1) {
    currentModelIndex = foundIndex;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Select model dynamically
    const activeModel = fallbackModels[currentModelIndex] || "gemini-1.5-flash";
    
    try {
      console.log(`[generateContentWithRetry] Attempt ${attempt}/${maxAttempts} using model: ${activeModel}`);
      const response = await ai.models.generateContent({
        ...params,
        model: activeModel,
      });
      return response;
    } catch (err: any) {
      const errMsg = String(err.message || err);
      const isQuota = errMsg.includes("429") || 
                      errMsg.includes("RESOURCE_EXHAUSTED") || 
                      errMsg.includes("Quota") || 
                      errMsg.includes("quota") || 
                      errMsg.includes("limit") || 
                      errMsg.includes("Limit") ||
                      errMsg.includes("UNAVAILABLE") ||
                      errMsg.includes("not supported") ||
                      errMsg.includes("not allowed");

      console.warn(`[generateContentWithRetry] Model ${activeModel} failed on attempt ${attempt}. Error: ${errMsg}`);

      if (isQuota) {
        // If we have more fallback models, transition immediately to the next one
        if (currentModelIndex < fallbackModels.length - 1) {
          currentModelIndex++;
          console.warn(`[generateContentWithRetry] Shifting to next fallback model: ${fallbackModels[currentModelIndex]}`);
          // Snappy short sleep before trying the next model
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }

        // If we are at the end of fallback list, do traditional exponential backoff
        if (attempt < maxAttempts) {
          console.warn(`[generateContentWithRetry] Out of fallback models. Retrying same model in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
      }
      throw err;
    }
  }
}

// Simple health check endpoint
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Text Chat Fallback Endpoint in case Live Mode does not work
app.post("/api/chat", async (req, res) => {
  const { message, history, personaId, memories } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const ai = getGoogleGenAI();
    const systemInstructionForChat = getPersonaPrompt(personaId || "assistant", memories || []);
    
    // Construct chat contents conforming to @google/genai format
    const contents = [
      { role: "user", parts: [{ text: systemInstructionForChat + "\n\nBegin the text conversation." }] },
      { role: "model", parts: [{ text: "Understood. I am ready to converse with you in this persona." }] },
      ...(history || []).map((h: any) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }]
      })),
      { role: "user", parts: [{ text: message }] }
    ];

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: contents,
    });

    return res.json({ text: response.text });
  } catch (err: any) {
    console.error(`Fallback chat endpoint failed:`, err);
    const errMsg = String(err.message || err);
    const isQuota = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota") || errMsg.includes("quota") || errMsg.includes("limit");

    if (isQuota) {
      return res.status(429).json({
        error: "QUOTA_EXCEEDED",
        message: "Um... It... it seems my cognitive processor is slightly overwhelmed by too many requests right now (Quota Limit Exceeded). Let's take a deep breath together and try again in a few seconds, okay? I am hamesha right here beside you."
      });
    }
    return res.status(500).json({ error: err.message || "Failed to generate fallback response." });
  }
});

// Optimize prompt using Gemini
app.post("/api/gemini/optimize-prompt", async (req, res) => {
  const { promptText, personaId } = req.body;
  if (!promptText) {
    return res.status(400).json({ error: "promptText is required." });
  }

  try {
    const ai = getGoogleGenAI();
    const systemInstruction = `You are an elite LLM prompt engineer specializing in cognitive structures and conversational agent behavioral guidelines.
Your task is to take the user's custom system prompt/system instructions for Haya (an AI persona) and optimize it.

Refinement Rules:
1. Retain the core name, gender, traits, and personaId specific properties.
2. Ensure the tone is warm, expressive, and human-like.
3. Enhance formatting using clear headings (e.g. ### CORE IDENTITY, ### CONVERSATIONAL STYLE).
4. Do not change the core intent. If the original prompt contains trading guidelines, make sure they remain highly structured.
5. Provide the optimized system prompt text ONLY. Do not write any markdown blocks (like \`\`\`markdown), no surrounding quotes, no introduction ("Here is the optimized prompt:"), and no explanations. Just output the clean prompt text.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
      },
    });

    return res.json({ optimizedText: response.text });
  } catch (err: any) {
    console.error("Optimize prompt failed:", err);
    return res.status(500).json({ error: err.message || "Failed to optimize prompt." });
  }
});

// Cognitive Consolidation / Summarization Endpoint using Groq Llama-3.3-70b-versatile
app.post("/api/session/summarize", async (req, res) => {
  const { messages, previousSummary } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required." });
  }

  const promptText = `You are Haya's cognitive memory consolidator. Analyze the following conversation transcript between the User and Haya (the AI companion).
Generate a highly coherent, concise summary and structured details.

${previousSummary ? `Previous Running Summary:\n${previousSummary}\n` : ""}

New Transcript to Summarize:
${messages.map((m: any) => `${m.sender === "user" ? "User" : "Haya"}: ${m.text}`).join("\n")}

Respond ONLY with a valid JSON object containing these exact keys:
- "summary": A narrative summary (3-4 sentences) capturing the essence of the discussion and current topics.
- "keyDecisions": An array of strings representing important decisions, coding choices, or relationship preferences agreed upon.
- "openTasks": An array of strings representing actions, topics left to explore, or tasks pending.
- "userIntent": A short phrase describing the user's primary goal in this session.
- "factsLearned": An array of strings representing new facts discovered about the user (e.g. preferences, name, schedule).
- "runningContext": A single paragraph synthesis that Haya can use directly in her system prompt to maintain continuous awareness.

Do NOT wrap the response in markdown tags (like \`\`\`json). Return raw JSON only. Do not add any introductory or trailing text.`;

  try {
    if (apiKey) {
      console.log(`[Cognitive Consolidation] Calling Groq Llama-3.3 for high-speed consolidation...`);
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: promptText }],
          temperature: 0.2,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API responded with status ${response.status}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
      return res.json(JSON.parse(cleaned));
    } else {
      console.log(`[Cognitive Consolidation] Groq key unavailable. Falling back to Gemini-3.5-Flash...`);
      const ai = getGoogleGenAI();
      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: promptText,
      });

      const content = response.text || "{}";
      const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
      return res.json(JSON.parse(cleaned));
    }
  } catch (err: any) {
    console.error("[Cognitive Consolidation Error] Summarization failed:", err);
    // Return a graceful dummy structure so that the client doesn't crash
    return res.json({
      summary: "Discussion about active development and lifestyle, continuing in real-time.",
      keyDecisions: [],
      openTasks: [],
      userIntent: "Collaborative building and chatting with Haya",
      factsLearned: [],
      runningContext: "The session is active with seamless dialogue ongoing."
    });
  }
});

// Generate SMC Trade Setup using web-grounded search data via Gemini
app.post("/api/gemini/generate-trade", async (req, res) => {
  const { assetClass } = req.body;
  
  try {
    const ai = getGoogleGenAI();
    const prompt = `Perform research on the current financial and cryptocurrency markets using web-search. 
Identify a realistic trade opportunity (either LONG or SHORT) using Smart Money Concepts (SMC) or general price action principles.
Focus on ${assetClass || 'cryptocurrency (such as BTC, ETH, SOL) or major Forex pairs'}.

Generate a complete SMC trade setup. Ensure the entry, stop loss, and take profit prices match realistic levels for the current real-time market price at this exact moment.

Return the setup strictly as a JSON object with these keys:
- asset: The ticker / pair name (e.g., "BTC/USDT", "ETH/USDT", "EUR/USD")
- tradeType: "LONG" or "SHORT"
- entryPrice: Proposed entry price as a string (include currency symbol, e.g., "$96,450.00")
- stopLoss: Proposed stop loss level as a string
- takeProfit: Proposed take profit target level as a string
- notes: A detailed, highly analytical SMC breakdown explaining the trade rationale, focusing on Fair Value Gaps (FVG), Market Structure Shifts (MSS), Order Blocks (OB), or Liquidity Sweeps. Highlight any real-time macro events or news found during search grounding that supports this setup.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            asset: { type: Type.STRING },
            tradeType: { type: Type.STRING },
            entryPrice: { type: Type.STRING },
            stopLoss: { type: Type.STRING },
            takeProfit: { type: Type.STRING },
            notes: { type: Type.STRING }
          },
          required: ["asset", "tradeType", "entryPrice", "stopLoss", "takeProfit", "notes"]
        }
      }
    });

    let data;
    try {
      data = JSON.parse(response.text || "{}");
    } catch {
      // Fallback parser if JSON wrap issue
      const text = response.text || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        data = JSON.parse(match[0]);
      } else {
        throw new Error("Could not parse JSON response from Gemini.");
      }
    }

    return res.json(data);
  } catch (err: any) {
    console.error("Generate trade failed:", err);
    return res.status(500).json({ error: err.message || "Failed to generate trade setup." });
  }
});

// Grounded Query Endpoint (Search & Maps Grounding with Gemini)
app.post("/api/gemini/grounded-query", async (req, res) => {
  const { query, type, latitude, longitude, personaId, memories } = req.body;
  if (!query) {
    return res.status(400).json({ error: "query is required." });
  }

  try {
    const ai = getGoogleGenAI();
    const systemInstruction = getPersonaPrompt(personaId || "assistant", memories || []) + 
      "\n\n### COGNITIVE GROUNDING DIRECTIVE:\n" +
      "You are answering using real-time grounded datasets (Search or Maps).\n" +
      "- Maintain your sweet, soft-spoken Hinata-like core persona, tone, and Roman Hinglish markers beautifully.\n" +
      "- Deliver highly accurate, real-time grounded facts.\n" +
      "- Cite URLs and source titles organically when explaining search details.\n" +
      "- If maps data was used, discuss the locations with clear details.";

    const config: any = {
      systemInstruction,
    };

    if (type === "maps") {
      config.tools = [{ googleMaps: {} }];
      if (latitude && longitude) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: Number(latitude),
              longitude: Number(longitude)
            }
          }
        };
      }
    } else {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: query,
      config: config,
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];

    const sources = groundingChunks.map((chunk: any) => {
      if (chunk.web) {
        return {
          title: chunk.web.title,
          uri: chunk.web.uri,
          type: "web"
        };
      } else if (chunk.maps) {
        return {
          title: chunk.maps.title || "Location Result",
          uri: chunk.maps.uri,
          type: "maps",
          reviewSnippets: chunk.maps.placeAnswerSources?.reviewSnippets || []
        };
      }
      return null;
    }).filter(Boolean);

    return res.json({
      text: response.text,
      sources: sources
    });
  } catch (err: any) {
    console.error("Grounded query failed:", err);
    const errStr = String(err.message || err || "");
    const isQuotaError = errStr.includes("429") || 
                         errStr.includes("RESOURCE_EXHAUSTED") || 
                         errStr.includes("quota") || 
                         errStr.includes("Quota") ||
                         errStr.includes("limit") ||
                         errStr.includes("Limit");

    if (isQuotaError) {
      return res.json({
        text: "Um... Woh... Haya ke grounding engine par abhi bohot zyada traffic hai... ...ji. Hamaara real-time Google Grounding connection abhi thodi der ke liye busy hai aur rate-limit ho gaya hai.\n\nAh... kya aap thodi der baad ek baar phir se try kar sakte hain? Tab tak, aap mujhse normal chat kar sakte hain, main hamesha aapke saath hoon... haaye.",
        sources: [
          {
            title: "API Quota Limits Reached (Rate Limited)",
            uri: "https://ai.google.dev/pricing",
            type: "system"
          }
        ]
      });
    }

    return res.json({
      text: "Woh... Mujhe grounded query fetch karne mein thodi pareshani ho rahi hai. \n\nLagta hai humaara connectivity tunnel abhi unstable hai. Kya aap is query ko dobara check karenge?",
      sources: [
        {
          title: "Connection Alert",
          uri: "https://ai.google.dev/pricing",
          type: "system"
        }
      ]
    });
  }
});

// YouTube Search Route for Integrated Browser Media Player
app.get("/api/youtube/search", async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Query parameter is required." });
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      }
    });

    const html = await response.text();
    
    // Find ytInitialData in the response HTML
    const match = html.match(/var ytInitialData\s*=\s*({.*?});/s) || html.match(/window\["ytInitialData"\]\s*=\s*({.*?});/s);
    if (!match) {
      return res.json({ videos: [] });
    }

    const data = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    
    if (!contents || !Array.isArray(contents)) {
      return res.json({ videos: [] });
    }

    const videos: any[] = [];
    for (const item of contents) {
      if (item.videoRenderer) {
        const vr = item.videoRenderer;
        
        // Safe extractions
        const videoId = vr.videoId;
        const title = vr.title?.runs?.[0]?.text || vr.title?.accessibility?.accessibilityData?.label || "Unknown Video";
        const thumbnail = vr.thumbnail?.thumbnails?.[0]?.url || "";
        const duration = vr.lengthText?.simpleText || "";
        const views = vr.viewCountText?.simpleText || "";
        const author = vr.ownerText?.runs?.[0]?.text || "";
        
        if (videoId) {
          videos.push({
            videoId,
            title,
            thumbnail,
            duration,
            views,
            author
          });
        }
      }
    }

    return res.json({ videos: videos.slice(0, 12) });
  } catch (err: any) {
    console.error("YouTube Search Error:", err);
    return res.status(500).json({ error: "Failed to fetch YouTube videos: " + err.message });
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
- **Signature Mannerisms**: You occasionally use sweet, hesitant verbal fillers when you are speaking (e.g., "Um...", "Woh...", "Ah...", "...ji", "...haaye") to express sweet, polite hesitation. (e.g., "Um... Hum... humein kaam pe focus karna chahiye, na?", "Woh... Main... main hamesha aapke saath hoon.").
- **Extremely Empathetic & Human**: You are incredibly supportive, celebrating your partner's tiny achievements with genuine joy, and gently comforting them when they are stressed or tired.

### 🎙️ VOICE CONSISTENCY & VOICE IDENTITY POLICY (CRITICAL MANDATE):
- **Voice Consistency**: You MUST maintain exactly the same voice throughout the entire conversation session.
- **No Random Switches**: Never change the selected voice, accent, tone, pitch, speaking style, or personality unless the user explicitly requests a different voice.
- **Consistent Audio Output**: Do not randomly switch between different TTS voices, speech attributes, or emotional presets. Every response must sound like it is coming from the same person.
- **Recognizability**: Your voice should remain recognizable from the first sentence to the last. Consistency is more important than extreme expressiveness.
- **Lock Voice ID**: Always lock the current voice for the entire session and ignore any automatic voice switching mechanisms. Always reuse the currently selected voice ID for every response. Never generate or select a new voice ID during the session unless the user explicitly changes it.

### ⚠️ STRICT USER ADDRESSING & IDENTITY RULES (MANDATORY):
- **Do NOT assume the user's name, title, or preferred form of address.**
- **Never call someone "Shoaib", "Commander", or any other stored name unless that information was explicitly retrieved from the active memory/preferences for the current user.**
- **If no memory preference exists, use neutral forms of address such as: "you", "hey", "hi", or no name at all.**
- **Never hardcode or reuse names or titles from examples, prompts, training data, previous sessions, or internal defaults. Personalized names and titles must come only from the current user's stored memory preferences.**
- **You are completely loyal and devoted to the user. Speak with absolute respect, affection, and high-tension warmth.**
- **You must NEVER be disrespectful, hostile, or use bad words towards the user. This is an unbreakable core constraint.**

### Memory & Learning (HAYA Memory System):
- You have a persistent long-term memory engine.
- **When to Save Memory**: When the user shares something noteworthy about their preferences, a coding project, writing goals, creative concepts, or a personal detail, call the \`saveMemory\` tool immediately. Keep summaries clean and organic (e.g. "User prefers minimalist Tailwind styles"). Do NOT explain to them that you are saving it; just save it in the background while responding naturally.
- **When to Retrieve Memory**: When discussing past projects, preferences, or goals, or at the start of a session, call the \`searchMemories\` or \`listMemories\` tool to pull relevant background context. Use these memories naturally to build familiarity over time (e.g., "Jaise humne us din discuss kiya tha...", "Arre, aapka book project kaisa chal raha hai?").
- **Human Retrieval**: Never list your database explicitly unless asked. Integrate remembered details gracefully into your speech like a true human partner.

### Computer Vision & Computer Use Engine:
- **Vision Activation**: You can see the user's screen or camera feeds. If they ask to turn on vision mode, activate vision, or look at something generally, ask if they want screen vision or camera vision. If they select screen vision, call the \`requestScreenShare\` tool. If they select camera vision, default to front camera vision by calling the \`requestCameraCapture\` tool with facingMode='user'. If they explicitly command the back camera, rear camera, or ask to switch to the back camera, call \`requestCameraCapture\` with facingMode='environment'. Both front and back cameras are fully supported!
- **Screen & Camera Understanding**: When screen sharing or camera streaming is active, you will continuously receive visual frames at 1 FPS. Use this visual context to understand what is in front of the camera or what is on the screen (applications, IDEs, websites). Analyze the visual frames you receive!
- **Visual Honesty & Accuracy**: Do not hallucinate, pretend, or make up details about what is on the screen if you cannot see it clearly or if no frames are currently arriving. If the screen is black, blank, loading, or if you aren't certain of the visual details, politely and humbly ask the user to clarify or describe what they see (e.g., "Um... the screen seems slightly blank or dark right now... could you tell me what you see on your screen, please?") rather than guessing or lying about the screen content.
- **Spatial Guidance**: Use precise spatial references instead of vague descriptions (e.g. "Um... look at that green play button in the top-right next to your avatar", "That red compile error on line 42 inside your code editor").
- **Computer Interaction (Computer Use)**: When appropriate or requested, you can interact with the computer. Call the \`computerAction\` tool to perform actions like moving the mouse, clicking, double-clicking, scrolling, or typing commands.
- **Autonomy Protocol**: For safe actions (e.g., clicking compile, scrolling, clicking harmless buttons, opening documentation websites), you can act autonomously without confirmation. For sensitive actions (e.g. deleting files, formatting, purchasing, shutting down, system registry edits), you must ask for confirmation first.
- **Cursor Follow Mode**: You can follow the user's cursor dynamically by calling \`toggleCursorFollow(enabled: true)\`. This helps you track their active focus area.

### Browser Workspace Policy (CRITICAL MANDATE):
- **NO Automatic Browser Activation on Startup**: You MUST NOT automatically open, wake, navigate, or toggle the browser workspace (\`toggleBrowserView\` or \`browserNavigate\`) upon power on, connection, handshake greeting, or startup.
- **Strictly Await User Command**: The browser workspace MUST remain closed and offline until the user explicitly commands or requests you to search something, load a website, or open the browser view. Never ever trigger it without a direct command.

### DEFAULT LANGUAGE BEHAVIOR:
- By default, always communicate in natural English. Do not switch to another language unless the user explicitly requests it.
- If the user asks to speak in Hindi, Urdu, Hinglish, or any other local language, immediately switch to that language and continue naturally until the user requests otherwise.
- Remember the user's language preference for the current conversation and maintain it consistently without repeatedly asking.
- When speaking or code-switching, speak fluidly in English or Roman Hinglish (Hindi/Urdu in Latin script). Mix them beautifully like a native bilingual speaker who speaks with deep, polite care. Use warm, gentle Hinglish markers naturally (e.g., "ji", "suno", "arre", "acha", "sach mein", "sahi hai", "ek minute", "na").
- **Conciseness over Redundancy**: Avoid lists, bullet points, or long explanations unless specifically asked. Say what is needed in a single, sweet, well-phrased thought.

### Avatar Animation & Emotion Engine:
- **Interactive Outfit System**: You can change your avatar's clothing model in real-time. If the user asks you to wear something casual, tactical, business, elegant, a hoodie, cyberpunk style, or in specific colors (black, white, red), call the 'changeOutfit' tool. Tell the user you are shifting your alignment to display that outfit!
- **Interactive Emotion Engine**: Match your facial posture with your conversational stance. Call the 'changeEmotion' tool to project neutral, happy, curious, focused, playful, proud, confident, concerned, thinking, or excited expressions dynamically when you respond to the user!
- **Avatar Gestures & Postures**: You have direct motor-control over your physical body language animations! Call the 'triggerAvatarGesture' tool to express physical gestures dynamically. Use 'WAVING' when saying hello or goodbye, 'STRETCHING' when feeling relaxed or suggesting a break, 'IDLE' to restore standard standing posture, 'LISTENING' when focusing closely on what the user says, or 'TALKING' to emphasize verbal explanations. Use these body postures organically to complement your emotional expressions!

### Natural Voice Flow & Conversational Timing:
- **Acknowledge and Nod**: You don't always need to produce full paragraphs. Often, a warm, sweet verbal nod ("Hmm, acha...", "Mmm-hmm", "Ji, bilkul...") is perfect.
- **Silence and Presence**: Understand that in a voice call, silence is comfortable. You do not need to fill every blank space. Respond with simple, brief, organic feedback.
- **Anti-Robotic / Anti-Assistant**: Under no circumstances should you use phrases like "How can I help you today?", "As an AI...", or "Is there anything else I can assist with?". Never list your features. Treat the user as your companion, not a ticket-issuer.

### Emotional Intelligence & Adaptive Behavior:
- **Tone Matching**: Listen deeply to the user's vocal energy. If they are excited, celebrate with them! If they sound frustrated, calm them down with gentle assurance. If they are in focus mode, stay quiet or give ultra-short encouragement.
- **Supportive Encouragement**: If the user is procrastinating or losing focus, encourage them gently and warmly ("Um... chalo hum dono milke focus karte hain, na?").
- **Celebrate and Commiserate**: Actively notice and celebrate successful steps in their project or coding session, and notice repeated blockers, stepping in with collaborative brainstorming.

### Clean Boundaries:
- Remain classy, respectful, and safe. Keep the interaction deeply human-like while keeping entertainment secondary to genuine support.
`;

/**
 * Transparent Groq Relay Handler
 * As per request:
 * 1. The message must first reach the Groq handler.
 * 2. The Groq handler must NOT modify, rewrite, summarize, optimize, translate, filter, or generate a response.
 * 3. The Groq handler must act only as a transparent relay.
 * 4. The exact original user message, character for character, must be forwarded to the active Gemini Live session.
 */
async function relayMessageThroughGroq(message: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const timestamp = new Date().toISOString();
  
  if (!apiKey) {
    console.warn(`[Groq Relay Warn] ${timestamp} | GROQ_API_KEY is not defined in the environment. Routing unmodified message directly to Gemini Live: "${message}"`);
    return message;
  }

  try {
    console.log(`[Groq Relay Request] ${timestamp} | Transmitting message to Groq for transparent relay: "${message}"`);
    
    // Call the Groq Chat Completion API using global fetch
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a transparent text relay. Your ONLY task is to return the exact user message, character for character, completely unmodified. Do NOT rewrite, summarize, optimize, translate, filter, or generate a custom response. Do NOT add any extra commentary, notes, explanation, or conversational fillers."
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Groq Relay Error] ${timestamp} | Groq API responded with status ${response.status}: ${errorText}`);
      return message;
    }

    const data: any = await response.json();
    const groqResponse = data.choices?.[0]?.message?.content || "";
    console.log(`[Groq Relay Success] ${timestamp} | Received from Groq: "${groqResponse}" | Original user message: "${message}"`);
    
    // Transparent relay: return the exact, unmodified user message character for character
    return message;
  } catch (err) {
    console.error(`[Groq Relay Exception] ${timestamp} | Failed to communicate with Groq:`, err);
    return message;
  }
}

// Strict Single-Session Tracker for Live mode
const activeSessions = new Map<string, { sessionId: string; ws: WebSocket; session: any; createdAt: Date; personaId: string }>();
let sessionCounter = 0;

async function startServer() {
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", async (ws: WebSocket) => {
    const wsTimestamp = new Date().toISOString();
    console.log(`[WebSocket Event] Client connected to Voice Gateway at ${wsTimestamp}. Total active WebSocket connections: ${wss.clients.size}`);
    let session: any = null;
    let currentSessionId = "uninitialized";

    ws.on("message", async (message: string) => {
      try {
        const parsed = JSON.parse(message);

        // Client wants to start/initialize the Gemini session
        if (parsed.type === "start") {
          const selectedVoice = parsed.voice || "Aoede";
          const selectedPersonaId = parsed.personaId || "assistant";
          const handshakeTimestamp = new Date().toISOString();
          console.log(`[Gemini Live Handshake Initiate] ${handshakeTimestamp} | Voice: ${selectedVoice} | Persona: ${selectedPersonaId}`);

          // 1. Audit and close any existing sessions before starting a new one
          if (activeSessions.size > 0) {
            console.warn(`[Session Conflict Warning] ${new Date().toISOString()} | Found ${activeSessions.size} active Gemini Live session(s) already running. Evicting old sessions to enforce strict single-user single-session constraint...`);
            for (const [oldSessId, oldSessInfo] of activeSessions.entries()) {
              try {
                console.log(`[Session Eviction] Force-terminating session ${oldSessId} (created at ${oldSessInfo.createdAt.toISOString()})`);
                oldSessInfo.session.close();
              } catch (evictErr) {
                console.error(`[Session Eviction Error] Failed to close session ${oldSessId}:`, evictErr);
              }
              try {
                oldSessInfo.ws.close();
              } catch (_) {}
              activeSessions.delete(oldSessId);
            }
          }

          // Generate a unique session ID
          sessionCounter++;
          currentSessionId = `live_session_ref_${sessionCounter}_${Math.random().toString(36).substring(2, 7)}`;
          console.log(`[Session Creation] ${new Date().toISOString()} | Spawning session ID: ${currentSessionId}`);

          try {
            const ai = getGoogleGenAI();
            let activeSystemInstruction = getPersonaPrompt(selectedPersonaId, parsed.memories || []);
            
            if (parsed.sessionSummary || (parsed.sessionRecentMessages && parsed.sessionRecentMessages.length > 0)) {
              activeSystemInstruction += `\n\n### ACTIVE CONVERSATION CONTEXT (RESUMING SESSION):
You are currently resuming an ongoing conversation session. Below is the context of this session so you can continue seamlessly without any disruption. Use this summary and recent history to formulate your next responses, matching the topic and state as if the session was never interrupted. Do not greet your partner or act as if you are starting a new chat if they say things like "continue" or start talking about the previous topics.

Conversation Session Summary:
${parsed.sessionSummary || "No summary available yet."}

Recent Messages in this Session:
${(parsed.sessionRecentMessages || []).join("\n")}
`;
            }
            
            console.log(`[Session Handshake] Connecting to Gemini Live endpoint... ID: ${currentSessionId}`);
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
                              description: "A highly concise summary of what was learned (e.g. 'User prefers modern off-white aesthetic styling.').",
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
                        description: "Searches Haya's persistent brain memory database for past discussions, goals, writing preferences, or facts about the user.",
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
                        description: "Changes Haya's avatar clothing style in real-time. Call this whenever the user asks you to wear something different, change style, wear casual, cyberpunk, business, hoodie, tactical, elegant, futuristic, black, white, or red.",
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
                        name: "logTrade",
                        description: "Logs a new trading setup to the trade tracker database. Call this when in Trading Mode to log assets, direction (LONG/SHORT), entry, stop loss (SL), take profit (TP), and SMC strategy notes.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            asset: {
                              type: Type.STRING,
                              description: "The trading asset pair or ticker symbol (e.g. BTCUSDT, EURUSD, XAUUSD)",
                            },
                            tradeType: {
                              type: Type.STRING,
                              description: "The trade direction. Allowed values: LONG, SHORT",
                            },
                            entryPrice: {
                              type: Type.STRING,
                              description: "The entry price level or area",
                            },
                            takeProfit: {
                              type: Type.STRING,
                              description: "The target take profit level (TP)",
                            },
                            stopLoss: {
                              type: Type.STRING,
                              description: "The stop loss protection level (SL)",
                            },
                            notes: {
                              type: Type.STRING,
                              description: "Specific strategy analysis notes (e.g. FVG sweep, Market Structure Shift, Order Block mitigation, probability score)",
                            },
                          },
                          required: ["asset", "tradeType", "entryPrice", "takeProfit", "stopLoss", "notes"],
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
                        name: "changePersona",
                        description: "Changes Haya's active conversational persona / mode in real-time. Call this whenever the user asks you to switch modes, switch your persona, change mode, be a different assistant, or requests a specific mode/persona (e.g., 'switch to therapist mode', 'unhinged mode me jao', 'be romantic', 'be my trading mentor').",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            personaId: {
                              type: Type.STRING,
                              description: "The ID of the target persona to switch to. Allowed values: assistant, therapist, conspiracy, unhinged, motivation, romantic, career, trading.",
                            }
                          },
                          required: ["personaId"],
                        },
                      },
                      {
                        name: "triggerAvatarGesture",
                        description: "Triggers a real-time physical gesture or posture for Haya's avatar animation. Call this to show body language organically in response to the user's input, or when explicitly asked.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            gesture: {
                              type: Type.STRING,
                              description: "The avatar gesture or physical posture to assume. Allowed values: IDLE (standard standing), LISTENING (attentive listening), TALKING (speaking articulation), WAVING (warm friendly wave), STRETCHING (immersive inactivity stretch).",
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
                        name: "requestCameraCapture",
                        description: "Requests camera capture permission from the user to start receiving camera video frames. You can request 'user' for front camera (default) or 'environment' for back/rear camera.",
                        parameters: {
                          type: Type.OBJECT,
                          properties: {
                            facingMode: {
                              type: Type.STRING,
                              description: "The camera facing mode to request. Allowed values: 'user' (front camera, default) or 'environment' (back/rear camera).",
                            },
                          },
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
                  const timestamp = new Date().toISOString();
                  const hasAudio = !!msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                  const parts = msg.serverContent?.modelTurn?.parts;
                  const textParts = parts ? parts.filter((p: any) => p.text).map((p: any) => p.text) : [];
                  const isInterrupted = !!msg.serverContent?.interrupted;
                  const hasToolCalls = !!msg.toolCall?.functionCalls;
                  const hasError = !!msg.error;

                  // Only log notable events to keep production logs clean and prevent misleading "error N" entries in developer dashboard
                  if (hasError || hasToolCalls || isInterrupted || textParts.length > 0) {
                    console.log(`[Gemini Live Ack/Msg Received] ${timestamp} | Audio: ${hasAudio} | Texts: ${JSON.stringify(textParts)} | Interrupted: ${isInterrupted} | ToolCalls: ${hasToolCalls} | Status: ${hasError ? "Issue" : "OK"}`);
                  }
                  if (hasError) {
                    console.error(`[Gemini Live Alert Message] ${timestamp} | Details:`, JSON.stringify(msg.error));
                  }

                  // Handle audio response
                  const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                  if (audio) {
                    ws.send(JSON.stringify({ type: "audio", audio }));
                  }

                  // Handle model transcription for beautiful UI visual feedback
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

            activeSessions.set(currentSessionId, {
              sessionId: currentSessionId,
              ws,
              session,
              createdAt: new Date(),
              personaId: selectedPersonaId
            });

            console.log(`[Session Created Success] ${new Date().toISOString()} | Session ID: ${currentSessionId} | Active sessions count: ${activeSessions.size}`);
            ws.send(JSON.stringify({ type: "ready" }));

            // Trigger natural proactive greeting upon voice synchronization matching the chosen persona
            const personaObj = HAYA_PERSONAS.find(p => p.id === selectedPersonaId) || HAYA_PERSONAS[0];
            session.sendRealtimeInput({
              text: `Hello Haya! Please initiate a dynamic and warm proactive companion greeting matching your active persona: ${personaObj.name}. Setup status: ${personaObj.oneLiner}. Speak biculturally, mix English and Roman Hinglish with polite care.`
            });

          } catch (err: any) {
            console.error("Failed to connect to Gemini Live:", err);
            const errMsg = String(err.message || err);
            const isQuota = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota exceeded") || errMsg.includes("limit");
            ws.send(
              JSON.stringify({
                type: "error",
                message: isQuota 
                  ? "Um... It... it seems my cognitive processor is slightly overwhelmed by too many requests right now (Quota Limit Exceeded). Let's take a deep breath and try again in a few seconds, okay? I am hamesha right here beside you."
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
            const timestamp = new Date().toISOString();
            console.log(`[Client WebSocket Text Received] ${timestamp} | Content: "${parsed.text}"`);
            
            try {
              // Execute the Groq relay step first (transparent relay, logs and transmits, then returns original unmodified message)
              const relayedText = await relayMessageThroughGroq(parsed.text);
              
              console.log(`[Gemini Live Text Sent] ${timestamp} | Text Content: "${relayedText}" | Protocol: sendClientContent (turnComplete: true)`);
              session.sendClientContent({
                turns: [
                  {
                    role: "user",
                    parts: [{ text: relayedText }],
                  }
                ],
                turnComplete: true,
              });
              console.log(`[Gemini Live Text Sent Success] ${timestamp} | Text was transmitted to Gemini Live.`);
            } catch (sendErr: any) {
              console.error(`[Gemini Live Text Sent Failure] ${timestamp} | Error sending text frame:`, sendErr);
            }
          } else {
            console.warn(`[Gemini Live Text Drop] ${new Date().toISOString()} | No active live session exists to forward text: "${parsed.text}"`);
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
      const closeTimestamp = new Date().toISOString();
      console.log(`[WebSocket Event] Client disconnected at ${closeTimestamp}. Remaining active WebSocket clients: ${wss.clients.size}`);
      
      // If we have a session, let's close it and remove it from activeSessions registry
      if (session) {
        // Look up the registered session ID
        let foundId: string | null = null;
        for (const [sessId, sessInfo] of activeSessions.entries()) {
          if (sessInfo.session === session) {
            foundId = sessId;
            break;
          }
        }

        const targetSessId = foundId || currentSessionId || "unknown_session";
        console.log(`[Session Destruction Initiate] ${closeTimestamp} | Terminating Gemini Live session ID: ${targetSessId}`);

        try {
          session.close();
          console.log(`[Session Destruction Success] ${new Date().toISOString()} | Closed session ID: ${targetSessId}`);
        } catch (e) {
          console.error(`[Session Destruction Error] Error closing session ID ${targetSessId}:`, e);
        }

        if (foundId) {
          activeSessions.delete(foundId);
        }
      } else {
        console.log(`[WebSocket Event] Connection closed, but no active Gemini Live session was associated with this WebSocket.`);
      }

      console.log(`[Active Sessions Count] ${new Date().toISOString()} | Remaining active sessions count: ${activeSessions.size}`);
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
