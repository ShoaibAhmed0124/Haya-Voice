/**
 * HAYA Computer Vision Engine - Services
 * Handles media capture (getDisplayMedia), frame extraction, performance-optimized
 * JPEG downsampling, throttling (at most 1 FPS), and cursor coordinate tracking.
 */

export interface VisionEngineConfig {
  fps?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export class VisionEngine {
  private static instance: VisionEngine | null = null;
  
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private captureIntervalId: any = null;
  private isProcessingFrame: boolean = false;
  private config: Required<VisionEngineConfig>;
  private lastError: string | null = null;

  // Callback to stream Base64 frames
  public onFrameCaptured: ((base64Image: string) => void) | null = null;
  // Callback for stream closed (user clicks "Stop sharing" in browser native bar)
  public onStreamStopped: (() => void) | null = null;
  // Cursor follow coordinates
  public onCursorMoved: ((coords: { x: number; y: number }) => void) | null = null;

  private constructor() {
    this.config = {
      fps: 1, // Cap at 1 FPS per Gemini Live specifications
      maxWidth: 800, // Optimized width for low CPU/RAM
      maxHeight: 600, // Optimized height
    };
  }

  public static getInstance(): VisionEngine {
    if (!VisionEngine.instance) {
      VisionEngine.instance = new VisionEngine();
    }
    return VisionEngine.instance;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Triggers the browser's native getDisplayMedia capture dialog.
   * Returns true if permission was granted, false otherwise.
   */
  public async startCapture(): Promise<boolean> {
    this.lastError = null;
    if (this.stream) {
      this.stopCapture();
    }

    try {
      // Trigger native Screen Capture API
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor", // prefer entire screen, but browser lets user choose
        },
        audio: false, // only capture video
      });

      // Handle user stopping screen share via browser's built-in UI
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopCapture();
          if (this.onStreamStopped) {
            this.onStreamStopped();
          }
        };
      }

      // Create a hidden video element to feed the stream for frame grabbing
      this.videoElement = document.createElement("video");
      this.videoElement.srcObject = this.stream;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      await this.videoElement.play();

      // Begin interval capture
      this.startFrameInterval();
      this.setupCursorTracking();

      return true;
    } catch (err: any) {
      console.error("Haya Vision Engine: Failed to start screen capture:", err);
      this.lastError = err instanceof Error ? err.message : String(err);
      this.stopCapture();
      return false;
    }
  }

  /**
   * Stops looking at the screen and cleans up tracks and elements
   */
  public stopCapture(): void {
    if (this.captureIntervalId) {
      clearInterval(this.captureIntervalId);
      this.captureIntervalId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.teardownCursorTracking();
    this.isProcessingFrame = false;
  }

  public isActive(): boolean {
    return !!this.stream && this.stream.active;
  }

  /**
   * Grabs a single screen capture frame, downsamples it via Canvas,
   * compresses it as JPEG, and reports the Base64 data.
   */
  private startFrameInterval(): void {
    const msInterval = 1000 / this.config.fps;
    
    this.captureIntervalId = setInterval(async () => {
      if (!this.videoElement || this.isProcessingFrame || !this.isActive()) return;

      this.isProcessingFrame = true;

      try {
        const video = this.videoElement;
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width === 0 || height === 0) {
          this.isProcessingFrame = false;
          return;
        }

        // Calculate aspect ratio downscaling to fit config limits
        let targetWidth = width;
        let targetHeight = height;

        if (width > this.config.maxWidth || height > this.config.maxHeight) {
          const ratio = Math.min(this.config.maxWidth / width, this.config.maxHeight / height);
          targetWidth = Math.round(width * ratio);
          targetHeight = Math.round(height * ratio);
        }

        // Setup hidden canvas
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          
          // Export as optimized low-quality JPEG to preserve CPU / bandwidth
          const base64DataUrl = canvas.toDataURL("image/jpeg", 0.65);
          // Extract base64 part
          const base64 = base64DataUrl.split(",")[1];
          
          if (base64 && this.onFrameCaptured) {
            this.onFrameCaptured(base64);
          }
        }
      } catch (err) {
        console.error("Haya Vision Engine: Frame extraction failed:", err);
      } finally {
        this.isProcessingFrame = false;
      }
    }, msInterval);
  }

  /**
   * Mouse coordinates inside window tracking for Cursor Follow Mode
   */
  private handleMouseMove = (e: MouseEvent) => {
    if (this.onCursorMoved) {
      // Return coordinates relative to screen/viewport
      const xPercent = Math.round((e.clientX / window.innerWidth) * 100);
      const yPercent = Math.round((e.clientY / window.innerHeight) * 100);
      this.onCursorMoved({ x: xPercent, y: yPercent });
    }
  };

  private setupCursorTracking(): void {
    window.addEventListener("mousemove", this.handleMouseMove);
  }

  private teardownCursorTracking(): void {
    window.removeEventListener("mousemove", this.handleMouseMove);
  }
}
