/**
 * Media Utilities - Audio and Video streaming helpers for Gemini Live API
 */

import { logger } from './logger';

/**
 * Audio Streamer - Captures and streams microphone audio
 */
export class AudioStreamer {
  constructor(geminiClient) {
    this.client = geminiClient;
    this.audioContext = null;
    this.audioWorklet = null;
    this.mediaStream = null;
    this.isStreaming = false;
    this.sampleRate = 16000; // Gemini requires 16kHz

    // VAD settings
    this.vadEnabled = true; // Default to true (optimized)
    this.vadThreshold = 0.05; // Increased from 0.01 to avoid keyboard noise
    this.vadSpeechHoldTime = 1500; // ms to keep "speaking" after silence
    this.prefixPadding = 500; // ms of audio to keep before speech starts
    this.paddingBuffer = []; // Buffer for prefix padding
    this.lastSpeechTime = 0;
    this.isSpeaking = false;
    this.onSpeechStatusChange = null;
  }

  /**
   * Swap the underlying adapter (for reconnects without stopping the stream)
   */
  setClient(newClient) {
    this.client = newClient;
  }

  /**
   * Start streaming audio from microphone
   * @param {string} deviceId - Optional device ID for specific microphone
   */
  async start(deviceId = null) {
    if (this.isStreaming) return true;

    try {
      // Build audio constraints
      const audioConstraints = {
        sampleRate: this.sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      // Add device ID if specified
      if (deviceId) {
        audioConstraints.deviceId = { exact: deviceId };
      }

      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      // Create audio context at 16kHz
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
          sampleRate: this.sampleRate,
        });

      // Load the audio worklet module
      logger.debug('🎤 Loading audio capture worklet...');
      try {
        await this.audioContext.audioWorklet.addModule(
          "/audio-processors/capture.worklet.js"
        );
        logger.debug('🎤 Audio capture worklet loaded successfully');
      } catch (workletError) {
        logger.error('❌ Failed to load audio worklet:', workletError);
        throw workletError;
      }

      // Create the audio worklet node
      this.audioWorklet = new AudioWorkletNode(
        this.audioContext,
        "audio-capture-processor"
      );
      logger.debug('🎤 Audio worklet node created');

      // Set up message handling from the worklet
      this.audioWorklet.port.onmessage = (event) => {
        if (!this.isStreaming) return;

        if (event.data.type === "audio") {
          const inputData = event.data.data;
          const pcmData = this.convertToPCM16(inputData);
          const base64Audio = this.arrayBufferToBase64(pcmData);

          // VAD Logic
          if (this.vadEnabled) {
            // Calculate RMS
            let sumSquares = 0;
            for (let i = 0; i < inputData.length; i++) {
              sumSquares += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sumSquares / inputData.length);

            const now = Date.now();
            if (rms > this.vadThreshold) {
              this.lastSpeechTime = now;
            }

            const currentlySpeaking = (now - this.lastSpeechTime) < this.vadSpeechHoldTime;

            // Notify status change
            if (this.isSpeaking !== currentlySpeaking) {
              const startedSpeaking = !this.isSpeaking && currentlySpeaking;
              this.isSpeaking = currentlySpeaking;
              // logger.debug(`🎤 VAD Status Check: RMS=${rms.toFixed(4)}, Speaking=${currentlySpeaking}`);

              if (this.onSpeechStatusChange) {
                this.onSpeechStatusChange(currentlySpeaking);
              }

              // If started speaking, send the padding buffer first
              if (startedSpeaking && this.client && this.client.connected) {
                // logger.debug(`🎤 VAD: Speech started, sending ${this.paddingBuffer.length} padding chunks`);
                this.paddingBuffer.forEach(chunk => {
                  this.client.sendAudio(chunk);
                });
                this.paddingBuffer = [];
              }

              // If transitioning to silence, notify the adapter that speech ended
              if (!currentlySpeaking && this.client && this.client.connected) {
                // logger.debug('🎤 VAD: Speech ended');
                // Call onSpeechEnd if the adapter supports it (e.g., Flash adapter)
                if (typeof this.client.onSpeechEnd === 'function') {
                  this.client.onSpeechEnd();
                } else {
                  // For Live API: Send trailing silence to trigger Turn Complete
                  // Note: inputData.length is the number of samples (Float32)
                  // Int16Array needs 2 bytes per sample, so buffer size = samples * 2
                  const silenceBuffer = new ArrayBuffer(inputData.length * 2);
                  new Int16Array(silenceBuffer).fill(0);
                  const base64Silence = this.arrayBufferToBase64(silenceBuffer);

                  for (let j = 0; j < 20; j++) {
                    this.client.sendAudio(base64Silence);
                  }
                }
              }
            }

            if (currentlySpeaking) {
              if (this.client && this.client.connected) {
                this.client.sendAudio(base64Audio);
              }
            } else {
              // Not speaking, add to padding buffer
              this.paddingBuffer.push(base64Audio);

              // Maintain padding buffer size (4096 samples = 256ms per chunk at 16kHz)
              // Each chunk is 4096 samples. 4096 / 16000 = ~0.256s or 256ms
              const maxPaddingChunks = Math.ceil(this.prefixPadding / 256);
              if (this.paddingBuffer.length > maxPaddingChunks) {
                this.paddingBuffer.shift();
              }
            }
          } else {
            // Always send if VAD is disabled
            if (this.client && this.client.connected) {
              this.client.sendAudio(base64Audio);
            }
          }
        }
      };

      // Connect the audio graph
      const source = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );
      source.connect(this.audioWorklet);

      this.isStreaming = true;
      logger.info("🎤 Audio streaming started");

      return true;
    } catch (error) {
      logger.error("Failed to start audio streaming:", error);
      throw error;
    }
  }

  /**
   * Stop audio streaming
   */
  async stop() {
    if (!this.isStreaming) return;
    this.isStreaming = false;

    if (this.audioWorklet) {
      this.audioWorklet.disconnect();
      this.audioWorklet.port.close();
      this.audioWorklet = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (e) {
        logger.error("Error closing AudioContext:", e);
      }
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    logger.info("🛑 Audio streaming stopped");
    this.paddingBuffer = [];
  }

  /**
   * Convert Float32Array to PCM16 Int16Array
   */
  convertToPCM16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = sample * 0x7fff;
    }
    return int16Array.buffer;
  }

  /**
   * Convert ArrayBuffer to base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

/**
 * Base Video Capture - Shared functionality for video/screen capture
 */
class BaseVideoCapture {
  constructor(geminiClient) {
    this.client = geminiClient;
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.mediaStream = null;
    this.isStreaming = false;
    this.captureInterval = null;
    this.fps = 1; // Default 1 frame per second
    this.quality = 0.8; // Default JPEG quality

    // Optimization flags
    this.transmitFrames = false; // Controlled by speech status
    this.alwaysTransmit = false; // Controlled by Config Toggle
  }

  /**
   * Swap the underlying adapter (for reconnects without stopping the stream)
   */
  setClient(newClient) {
    this.client = newClient;
  }

  /**
   * Initialize canvas and video elements
   */
  initializeElements(width, height) {
    // Create video element
    this.video = document.createElement("video");
    this.video.srcObject = this.mediaStream;
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = true;

    // Create canvas for frame capture
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d");
  }

  /**
   * Wait for video to be ready and start playing
   */
  async waitForVideoReady() {
    await new Promise((resolve) => {
      this.video.onloadedmetadata = resolve;
    });
    this.video.play();
  }

  /**
   * Set an overlay canvas to be drawn on top of the video
   * @param {HTMLCanvasElement} canvas
   */
  setOverlayCanvas(canvas) {
    this.overlayCanvas = canvas;
  }

  /**
   * Start capturing and sending frames
   */
  startCapturing() {
    const captureFrame = () => {
      if (!this.isStreaming) return;

      // Draw current frame to canvas
      this.ctx.drawImage(
        this.video,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );

      // Draw overlay if it exists
      if (this.overlayCanvas) {
        this.ctx.drawImage(
          this.overlayCanvas,
          0,
          0,
          this.canvas.width,
          this.canvas.height
        );
      }

      // Convert to JPEG and send
      this.canvas.toBlob(
        (blob) => {
          if (!blob) return;

          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(",")[1];
            if (this.client && this.client.connected) {
              // Store the latest image for multimodal requests (audio + image)
              if (typeof this.client.setLatestImage === 'function') {
                this.client.setLatestImage(base64);
              }

              // Only send if always transmitting OR specific transmit trigger (e.g. speech) is active
              if (this.alwaysTransmit || this.transmitFrames) {
                this.client.sendImage(base64, "image/jpeg");
              }
            }
          };
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        this.quality
      );
    };

    // Start interval
    this.captureInterval = setInterval(captureFrame, 1000 / this.fps);
  }

  /**
   * Stop capturing
   */
  stop() {
    if (!this.isStreaming) return;
    this.isStreaming = false;

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }

    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Take a single snapshot
   */
  takeSnapshot() {
    if (!this.video || !this.canvas) {
      throw new Error("Video not initialized");
    }

    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    return this.canvas.toDataURL("image/jpeg", this.quality);
  }

  /**
   * Get the video element for preview
   */
  getVideoElement() {
    return this.video;
  }
}

/**
 * Video Streamer - Captures and streams camera video
 */
export class VideoStreamer extends BaseVideoCapture {
  /**
   * Start video streaming from camera
   * @param {Object} options - { fps: number, width: number, height: number, facingMode: string, quality: number, deviceId: string }
   */
  async start(options = {}) {
    if (this.isStreaming) return this.video;

    try {
      const {
        fps = 1,
        width = 640,
        height = 480,
        facingMode = "user", // 'user' for front camera, 'environment' for back
        quality = 0.8,
        deviceId = null,
      } = options;

      this.fps = fps;
      this.quality = quality;

      // Build video constraints
      const videoConstraints = {
        width: { ideal: width },
        height: { ideal: height },
      };

      // Add device ID if specified, otherwise use facingMode
      if (deviceId) {
        videoConstraints.deviceId = { exact: deviceId };
      } else {
        videoConstraints.facingMode = facingMode;
      }

      // Get camera access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
      });

      // Initialize video and canvas elements
      this.initializeElements(width, height);

      // Wait for video to be ready
      await this.waitForVideoReady();

      // Start capturing frames
      this.isStreaming = true;
      this.startCapturing();

      logger.info("📹 Camera streaming started at", fps, "fps");
      return this.video; // Return video element for preview
    } catch (error) {
      logger.error("Failed to start camera streaming:", error);
      throw error;
    }
  }

  async stop() {
    if (!this.isStreaming) return;
    super.stop();
    logger.info("🛑 Camera streaming stopped");
  }
}

/**
 * Screen Capture - Captures and streams screen/window
 */
export class ScreenCapture extends BaseVideoCapture {
  /**
   * Start screen capture
   * @param {Object} options - { fps: number, width: number, height: number, quality: number }
   */
  async start(options = {}) {
    if (this.isStreaming) return this.video;

    try {
      const { fps = 1, width = 1280, height = 720, quality = 0.7 } = options;

      this.fps = fps;
      this.quality = quality;

      // Get screen capture permission
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      });

      // Initialize video and canvas elements
      this.initializeElements(width, height);

      // Wait for video to be ready
      await this.waitForVideoReady();

      // Start capturing frames
      this.isStreaming = true;
      this.startCapturing();

      // Handle stream end (user stops sharing)
      this.mediaStream.getVideoTracks()[0].onended = () => {
        logger.info("User stopped screen sharing");
        this.stop();
      };

      logger.info("🖥️ Screen capture started at", fps, "fps");
      return this.video; // Return video element for preview
    } catch (error) {
      logger.error("Failed to start screen capture:", error);
      throw error;
    }
  }

  async stop() {
    if (!this.isStreaming) return;
    super.stop();
    logger.info("🛑 Screen capture stopped");
  }
}

/**
 * Audio Player - Plays audio responses from Gemini
 * Uses shared SpeechAudioContext for unified volume control
 */
import { SpeechAudioContext } from './SpeechAudioContext.js';

export class AudioPlayer {
  constructor() {
    this.audioContext = null;
    this.workletNode = null;
    this.gainNode = null; // Reference to shared gain node
    this.isInitialized = false;
  }

  /**
   * Initialize the audio player
   */
  async init() {
    if (this.isInitialized) return;

    try {
      // Get shared audio context
      this.audioContext = await SpeechAudioContext.getContext();
      this.gainNode = await SpeechAudioContext.getGainNode();

      // Load the audio worklet from external file
      await this.audioContext.audioWorklet.addModule(
        "/audio-processors/playback.worklet.js"
      );

      // Create worklet node
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        "pcm-processor"
      );

      // Connect worklet -> shared gain node (which connects to destination)
      this.workletNode.connect(this.gainNode);

      this.isInitialized = true;
      logger.info("🔊 Audio player initialized (using shared SpeechAudioContext)");
    } catch (error) {
      logger.error("Failed to initialize audio player:", error);
      throw error;
    }
  }

  /**
   * Play audio chunk from base64 PCM
   */
  async play(base64Audio) {
    if (!this.isInitialized) {
      logger.info('🔊 AudioPlayer not initialized, initializing now...');
      await this.init();
    }

    try {
      // Resume audio context if suspended
      await SpeechAudioContext.resume();

      // Convert base64 to Float32Array
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 LE to Float32
      const inputArray = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(inputArray.length);
      for (let i = 0; i < inputArray.length; i++) {
        float32Data[i] = inputArray[i] / 32768;
      }

      // Send to worklet for playback
      this.workletNode.port.postMessage(float32Data);
    } catch (error) {
      logger.error("Error playing audio chunk:", error);
      throw error;
    }
  }

  /**
   * Interrupt current playback
   */
  interrupt() {
    if (this.workletNode) {
      this.workletNode.port.postMessage("interrupt");
    }
  }

  /**
   * Clean up resources
   * Note: We don't close the shared AudioContext, just disconnect our node
   */
  destroy() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    this.isInitialized = false;
  }
}
