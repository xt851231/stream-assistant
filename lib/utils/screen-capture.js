import { BaseVideoCapture } from './base-video-capture.js';
import { SpeechAudioContext } from './SpeechAudioContext.js';

/**
 * Screen Capture - Captures and streams screen/window
 */
export class ScreenCapture extends BaseVideoCapture {
  /**
   * Start screen capture
   * @param {Object} options - { fps: number, width: number, height: number, quality: number, audio: boolean }
   */
  async start(options = {}) {
    if (this.isStreaming) return this.video;

    try {
      const {
        fps = 1,
        width = 1280,
        height = 720,
        quality = 0.7,
        audio = false // Default to false unless requested
      } = options;

      this.fps = fps;
      this.quality = quality;

      // Get screen capture permission
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: audio, // Request system audio if enabled
      });

      // Handle system audio if it was captured
      const audioTracks = this.mediaStream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log("🔊 System audio track detected in screen share");

        // Route audio track to local playback via SpeechAudioContext
        const context = await SpeechAudioContext.getContext();
        const systemGain = await SpeechAudioContext.getSystemGainNode();

        // Create source from the stream
        this.audioSourceNode = context.createMediaStreamSource(this.mediaStream);
        this.audioSourceNode.connect(systemGain);

        // Note: We DO NOT connect this to the capture.worklet,
        // ensuring the AI never receives this audio.
      }

      // Initialize video and canvas elements
      this.initializeElements(width, height);

      // Wait for video to be ready
      await this.waitForVideoReady();

      // Start capturing frames
      this.isStreaming = true;
      this.startCapturing();

      // Handle stream end (user stops sharing)
      this.mediaStream.getVideoTracks()[0].onended = () => {
        console.log("User stopped screen sharing");
        this.stop();
      };

      console.log("🖥️ Screen capture started at", fps, "fps", audio ? "(with system audio)" : "");
      return this.video; // Return video element for preview
    } catch (error) {
      console.error("Failed to start screen capture:", error);
      throw error;
    }
  }

  async stop() {
    if (!this.isStreaming) return;

    // Disconnect audio node if it exists
    if (this.audioSourceNode) {
      this.audioSourceNode.disconnect();
      this.audioSourceNode = null;
    }

    super.stop();
    console.log("🛑 Screen capture stopped");
  }
}
