import { TTSAdapter } from '../interfaces/TTSAdapter.js';
import { SpeechAudioContext } from '../../../utils/SpeechAudioContext.js';

/**
 * TTS Adapter using Browser's built-in Window.speechSynthesis
 */
export class BrowserTTSAdapter extends TTSAdapter {
    constructor(config) {
        super(config);
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        // Use ttsVoice if provided, fallback to persona voice or null
        this.voice = config.ttsVoice || config.voice || null;
    }

    async speak(text) {
        if (!text) return;

        return new Promise((resolve, reject) => {
            console.log(`🔊 BrowserTTS: Speaking (length: ${text.length}) at ${Date.now()}`);
            const utterance = new SpeechSynthesisUtterance(text);

            // Apply volume from shared SpeechAudioContext
            utterance.volume = SpeechAudioContext.getVolume();

            // Apply Rate and Pitch from config
            utterance.rate = this.config.ttsRate || 1.0;
            utterance.pitch = this.config.ttsPitch || 1.0;

            // Set voice if configured
            if (this.voice) {
                const voices = this.synthesis.getVoices();
                const selectedVoice = voices.find(v => v.name === this.voice || v.voiceURI === this.voice);
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                }
            }

            utterance.onend = () => {
                console.log(`🔊 BrowserTTS: Finished speaking at ${Date.now()}`);
                this.currentUtterance = null;
                resolve();
            };

            utterance.onerror = (e) => {
                console.error("TTS Error:", e);
                this.currentUtterance = null;
                reject(e);
            };

            this.currentUtterance = utterance;
            this.synthesis.speak(utterance);
        });
    }

    stop() {
        if (this.synthesis) {
            this.synthesis.cancel();
            this.currentUtterance = null;
        }
    }

    getAvailableVoices() {
        return this.synthesis.getVoices().map(v => ({
            name: v.name,
            lang: v.lang,
            default: v.default
        }));
    }
}
