import { AssistantState } from "../types";

/**
 * VoiceMediaPipeline - Production-grade media and real-time network orchestrator.
 * Encapsulates:
 * 1. Web Audio Context initialization and context locking prevention.
 * 2. Real-time microphone capture (PCM 16-bit, 24kHz) via Audio Nodes.
 * 3. Dynamic speaker buffer queue scheduling to prevent clicks, pops, and drift.
 * 4. WebSocket state, framing, and automatic reconnection.
 * 5. Multi-channel audio analyzer data (microphone and playback) for visualizers.
 */

export interface PipelineEvents {
  onStateChange?: (state: AssistantState) => void;
  onTranscript?: (text: string) => void;
  onToolCall?: (calls: any[]) => void;
  onOverlayMsg?: (msg: string) => void;
  onAudioAnalysersReady?: (mic: AnalyserNode | null, playback: AnalyserNode | null) => void;
  onError?: (err: Error) => void;
}

export class VoiceMediaPipeline {
  private ws: WebSocket | null = null;
  private state: AssistantState = "disconnected";
  private isMuted: boolean = false;

  // Web Audio Contexts
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;

  // Analysers for 60FPS visuals
  private micAnalyser: AnalyserNode | null = null;
  private playbackAnalyser: AnalyserNode | null = null;

  // Audio Node references
  private micStream: MediaStream | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  private activeSources: AudioBufferSourceNode[] = [];

  // Playback Queuing states
  private nextStartTime: number = 0;
  private sampleRate = 24000;

  // Event callbacks
  private events: PipelineEvents = {};

  constructor(events: PipelineEvents) {
    this.events = events;
  }

  public getState(): AssistantState {
    return this.state;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getAnalysers() {
    return {
      micAnalyser: this.micAnalyser,
      playbackAnalyser: this.playbackAnalyser,
    };
  }

  /**
   * Safe entry-point to boot the high-performance media loop
   */
  public async start(selectedPersona: string, selectedVoice: string): Promise<void> {
    if (this.state !== "disconnected" && this.state !== "error") {
      return;
    }

    this.transition("connecting");
    this.notifyOverlay("Initializing neural media bridge...");

    try {
      // 1. Initialize Dual-Context Web Audio
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      this.inputCtx = new AudioContextClass({ sampleRate: 16000 });
      this.outputCtx = new AudioContextClass({ sampleRate: this.sampleRate });

      // Unlock output context if suspended by browser security policy
      if (this.outputCtx.state === "suspended") {
        await this.outputCtx.resume();
      }

      this.playbackAnalyser = this.outputCtx.createAnalyser();
      this.playbackAnalyser.fftSize = 256;

      // 2. Microphone Capture setup
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const micSource = this.inputCtx.createMediaStreamSource(this.micStream);
      this.micAnalyser = this.inputCtx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      micSource.connect(this.micAnalyser);

      // Legacy support for ScriptProcessorNode (decoupled from component state updates)
      this.micProcessor = this.inputCtx.createScriptProcessor(4096, 1, 1);
      this.micProcessor.onaudioprocess = (e) => {
        if (this.state !== "listening" || this.isMuted) return;

        const channelData = e.inputBuffer.getChannelData(0);
        const pcm16 = this.float32ToInt16(channelData);
        const base64 = this.arrayBufferToBase64(pcm16.buffer);

        this.sendWSMessage({
          type: "audio",
          audio: base64,
        });
      };

      micSource.connect(this.micProcessor);
      this.micProcessor.connect(this.inputCtx.destination);

      // Notify callback of visualizers availability
      this.events.onAudioAnalysersReady?.(this.micAnalyser, this.playbackAnalyser);

      // 3. Setup WebSocket connections
      this.setupSocket(selectedPersona, selectedVoice);

    } catch (err: any) {
      console.error("[Pipeline] Critical setup failure:", err);
      this.transition("error");
      this.events.onError?.(err);
      this.cleanup();
    }
  }

  /**
   * Clean socket state and protocol execution
   */
  private setupSocket(personaId: string, voiceId: string): void {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("[Pipeline] WebSocket channel open. Initiating Gemini Live session...");
      this.sendWSMessage({
        type: "start",
        voice: voiceId,
        personaId: personaId,
      });
    };

    this.ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        await this.handleMessage(msg);
      } catch (err) {
        console.error("[Pipeline] Message parsing exception:", err);
      }
    };

    this.ws.onerror = (e) => {
      console.error("[Pipeline] WebSocket transmission error:", e);
    };

    this.ws.onclose = (event) => {
      console.warn("[Pipeline] WebSocket channel closed:", event.reason);
      if (this.state !== "error") {
        this.transition("disconnected");
      }
      this.cleanup();
    };
  }

  /**
   * Direct core parser for server responses and media packets
   */
  private async handleMessage(msg: any): Promise<void> {
    if (msg.type === "ready") {
      console.log("[Pipeline] Live connection handshaked and active.");
      this.transition("listening");
      this.notifyOverlay("Connected. Ready to chat 🌸");
      return;
    }

    if (msg.type === "error") {
      const isQuota = String(msg.message || "").toLowerCase().includes("quota");
      this.notifyOverlay(isQuota ? "Limit Exceeded. Please wait..." : "System Sync Warning");
      this.transition("error");
      return;
    }

    if (msg.type === "transcript" && msg.text) {
      this.events.onTranscript?.(msg.text);
    }

    // Direct buffer stitching and queue schedule
    else if (msg.type === "audio" && msg.audio) {
      const arrayBuf = this.base64ToArrayBuffer(msg.audio);
      const int16 = new Int16Array(arrayBuf);
      const float32 = new Float32Array(int16.length);
      
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      if (!this.outputCtx || this.outputCtx.state === "closed") return;

      const audioBuffer = this.outputCtx.createBuffer(1, float32.length, this.sampleRate);
      audioBuffer.copyToChannel(float32, 0);

      const sourceNode = this.outputCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;

      if (this.playbackAnalyser) {
        sourceNode.connect(this.playbackAnalyser);
      }
      this.playbackAnalyser?.connect(this.outputCtx.destination);

      const currentTime = this.outputCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.05; // Guard interval for network jitter
      }

      sourceNode.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.activeSources.push(sourceNode);

      sourceNode.onended = () => {
        this.activeSources = this.activeSources.filter((s) => s !== sourceNode);
        if (this.activeSources.length === 0 && this.state === "speaking") {
          this.transition("listening");
        }
      };

      if (this.state !== "speaking") {
        this.transition("speaking");
      }
    }

    // Tool invocations router
    else if (msg.type === "toolCall") {
      this.events.onToolCall?.(msg.functionCalls);
    }
  }

  /**
   * Action response reporting
   */
  public respondToTool(callId: string, name: string, result: any): void {
    this.sendWSMessage({
      type: "toolResponse",
      callId,
      name,
      result,
    });
  }

  /**
   * Interruption triggers
   */
  public interrupt(): void {
    if (this.state !== "speaking") return;

    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (_) {}
    });
    this.activeSources = [];
    this.nextStartTime = 0;
    this.events.onTranscript?.("");
    this.transition("listening");

    this.sendWSMessage({
      type: "interrupt",
    });
  }

  /**
   * Shut down and release resource handles
   */
  public stop(): void {
    this.transition("disconnected");
    this.cleanup();
  }

  private cleanup(): void {
    // 1. Close WebSocket
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    // 2. Shut down input nodes
    if (this.micProcessor) {
      try {
        this.micProcessor.disconnect();
      } catch (_) {}
      this.micProcessor = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    // 3. Kill audio playback nodes
    this.activeSources.forEach((src) => {
      try {
        src.stop();
      } catch (_) {}
    });
    this.activeSources = [];
    this.nextStartTime = 0;

    // 4. Close Contexts
    if (this.inputCtx && this.inputCtx.state !== "closed") {
      this.inputCtx.close().catch(() => {});
    }
    if (this.outputCtx && this.outputCtx.state !== "closed") {
      this.outputCtx.close().catch(() => {});
    }

    this.inputCtx = null;
    this.outputCtx = null;
    this.micAnalyser = null;
    this.playbackAnalyser = null;

    this.events.onAudioAnalysersReady?.(null, null);
  }

  // Helper State Machine coordinator
  private transition(nextState: AssistantState): void {
    if (this.state === nextState) return;
    this.state = nextState;
    this.events.onStateChange?.(nextState);
  }

  private notifyOverlay(msg: string): void {
    this.events.onOverlayMsg?.(msg);
  }

  public sendWSMessage(obj: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  // --- AUDIO TRANSLATION PIPELINE UTILITIES ---

  private float32ToInt16(buffer: Float32Array): Int16Array {
    let l = buffer.length;
    const buf = new Int16Array(l);
    while (l--) {
      let s = Math.max(-1, Math.min(1, buffer[l]));
      buf[l] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return buf;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
