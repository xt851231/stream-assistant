/**
 * Abstract Base Class for Text-to-Speech Adapters
 */
export class TTSAdapter {
    constructor(config) {
        this.config = config || {};
        this.voice = null;
    }

    /**
     * Speak the provided text
     * @param {string} text - Text to speak
     * @returns {Promise<void>}
     */
    async speak(text) {
        throw new Error("speak() must be implemented by subclass");
    }

    /**
     * Stop current playback
     */
    stop() {
        throw new Error("stop() must be implemented by subclass");
    }

    /**
     * Set the voice to use
     * @param {string} voiceId 
     */
    setVoice(voiceId) {
        this.voice = voiceId;
    }
}
