import { uint8ArrayToBase64 } from './base64-utils.js';

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
      console.log('🎤 Loading audio capture worklet...');
      try {
        await this.audioContext.audioWorklet.addModule(
          "/audio-processors/capture.worklet.js"
        );
        console.log('🎤 Audio capture worklet loaded successfully');
      } catch (workletError) {
        console.error('❌ Failed to load audio worklet:', workletError);
        throw workletError;
      }

      // Create the audio worklet node
      this.audioWorklet = new AudioWorkletNode(
        this.audioContext,
        "audio-capture-processor"
      );
      console.log('🎤 Audio worklet node created');

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
              // console.log(`🎤 VAD Status Check: RMS=${rms.toFixed(4)}, Speaking=${currentlySpeaking}`);

              if (this.onSpeechStatusChange) {
                this.onSpeechStatusChange(currentlySpeaking);
              }

              // If started speaking, send the padding buffer first
              if (startedSpeaking && this.client && this.client.connected) {
                // console.debug(`🎤 VAD: Speech started, sending ${this.paddingBuffer.length} padding chunks`);
                this.paddingBuffer.forEach(chunk => {
                  this.client.sendAudio(chunk);
                });
                this.paddingBuffer = [];
              }

              // If transitioning to silence, notify the adapter that speech ended
              if (!currentlySpeaking && this.client && this.client.connected) {
                // console.log('🎤 VAD: Speech ended');
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
      console.log("🎤 Audio streaming started");

      return true;
    } catch (error) {
      console.error("Failed to start audio streaming:", error);
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
        console.error("Error closing AudioContext:", e);
      }
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    console.log("🛑 Audio streaming stopped");
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
    return uint8ArrayToBase64(bytes);
  }
}
