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
        this.systemGainNode = null; // Node for game/system audio
        this.volume = 0.8; // AI Voice volume
        this.systemVolume = 0.5; // Game audio volume
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

        // Create gain node for AI voice volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volume;
        this.gainNode.connect(this.audioContext.destination);

        // Create gain node for system/game audio volume control
        this.systemGainNode = this.audioContext.createGain();
        this.systemGainNode.gain.value = this.systemVolume;
        this.systemGainNode.connect(this.audioContext.destination);

        console.log('🔊 SpeechAudioContext initialized (with System Audio path)');
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
     * Get the shared GainNode for routing AI voice
     */
    async getGainNode() {
        if (!this.gainNode) {
            await this.init();
        }
        return this.gainNode;
    }

    /**
     * Get the shared GainNode for routing system/game audio
     */
    async getSystemGainNode() {
        if (!this.systemGainNode) {
            await this.init();
        }
        return this.systemGainNode;
    }

    /**
     * Set the AI voice output volume
     * @param {number} volume - Volume level 0-100
     */
    setVolume(volume) {
        const newVolume = Math.max(0, Math.min(1, volume / 100));

        if (Math.abs(this.volume - newVolume) > 0.001 || !this.gainNode) {
            this.volume = newVolume;
            if (this.gainNode) {
                this.gainNode.gain.value = this.volume;
            }
            console.log(`🔊 AI Voice volume set to ${volume}%`);
        }
    }

    /**
     * Set the system/game audio output volume
     * @param {number} volume - Volume level 0-100
     */
    setSystemVolume(volume) {
        const newVolume = Math.max(0, Math.min(1, volume / 100));

        if (Math.abs(this.systemVolume - newVolume) > 0.001 || !this.systemGainNode) {
            this.systemVolume = newVolume;
            if (this.systemGainNode) {
                this.systemGainNode.gain.value = this.systemVolume;
            }
            console.log(`🔊 System audio volume set to ${volume}%`);
        }
    }

    /**
     * Set the audio output device (sink ID)
     * @param {string} deviceId 
     */
    async setSinkId(deviceId) {
        if (!this.audioContext) {
            await this.init();
        }

        if (typeof this.audioContext.setSinkId === 'function') {
            try {
                // 'default' maps to empty string '' for setSinkId
                const sinkId = deviceId === 'default' ? '' : deviceId;
                await this.audioContext.setSinkId(sinkId);
                console.log(`🔊 Audio output routed to device: ${deviceId}`);
            } catch (error) {
                console.error(`Failed to set audio output device to ${deviceId}:`, error);
            }
        } else {
            console.warn('AudioContext.setSinkId is not supported in this browser.');
        }
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
