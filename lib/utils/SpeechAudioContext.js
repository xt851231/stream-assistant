/**
 * SpeechAudioContext - Shared audio context for all speech output
 * 
 * This singleton provides a unified audio output path with volume control.
 * All speech audio (Live API, TTS) should route through this context.
 */

class SpeechAudioContextSingleton {
    constructor() {
        this.audioContext = null;
        this.gainNode = null;
        this.volume = 0.8; // Default 80%
        this.sampleRate = 24000; // Match Gemini output
    }

    /**
     * Initialize the audio context (lazy initialization)
     * Must be called after user interaction due to autoplay policies
     */
    async init() {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });

        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volume;

        // Connect gain to destination
        this.gainNode.connect(this.audioContext.destination);

        console.log('🔊 SpeechAudioContext initialized');
    }

    /**
     * Get the shared AudioContext
     * Initializes if needed
     */
    async getContext() {
        if (!this.audioContext) {
            await this.init();
        }
        return this.audioContext;
    }

    /**
     * Get the shared GainNode for routing audio
     * All speech audio should connect to this node
     */
    async getGainNode() {
        if (!this.gainNode) {
            await this.init();
        }
        return this.gainNode;
    }

    /**
     * Set the speech output volume
     * @param {number} volume - Volume level 0-100
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume / 100));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
        console.log(`🔊 Speech volume set to ${volume}%`);
    }

    /**
     * Get current volume (0.0 - 1.0)
     * Used by BrowserTTS which needs normalized value
     */
    getVolume() {
        return this.volume;
    }

    /**
     * Resume audio context if suspended (required after user interaction)
     */
    async resume() {
        // Skip if already running - avoid unnecessary async overhead
        if (this.audioContext && this.audioContext.state === 'running') {
            return;
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    /**
     * Get the sample rate
     */
    getSampleRate() {
        return this.sampleRate;
    }
}

// Export singleton instance
export const SpeechAudioContext = new SpeechAudioContextSingleton();
