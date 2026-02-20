import { base64ToUint8Array } from './base64-utils.js';
import { SpeechAudioContext } from './SpeechAudioContext.js';

/**
 * Audio Player - Plays audio responses from Gemini
 * Uses shared SpeechAudioContext for unified volume control
 */
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
      console.log("🔊 Audio player initialized (using shared SpeechAudioContext)");
    } catch (error) {
      console.error("Failed to initialize audio player:", error);
      throw error;
    }
  }

  /**
   * Play audio chunk from base64 PCM
   */
  async play(base64Audio) {
    if (!this.isInitialized) {
      console.log('🔊 AudioPlayer not initialized, initializing now...');
      await this.init();
    }

    try {
      // Resume audio context if suspended
      await SpeechAudioContext.resume();

      // Convert base64 to Float32Array
      const bytes = base64ToUint8Array(base64Audio);

      // Convert PCM16 LE to Float32
      const inputArray = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(inputArray.length);

      // Optimization: Cached inverse constant
      const inv32768 = 1 / 32768;

      for (let i = 0; i < inputArray.length; i++) {
        float32Data[i] = inputArray[i] * inv32768;
      }

      // Send to worklet for playback
      this.workletNode.port.postMessage(float32Data);
    } catch (error) {
      console.error("Error playing audio chunk:", error);
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
