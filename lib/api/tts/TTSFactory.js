import { BrowserTTSAdapter } from './adapters/BrowserTTSAdapter';
import { GeminiTTSAdapter } from './adapters/GeminiTTSAdapter';

export class TTSFactory {
    /**
     * Create a TTS Adapter instance
     * @param {string} provider - 'browser' | 'gemini'
     * @param {Object} config - Configuration object
     * @returns {TTSAdapter}
     */
    static createAdapter(provider = 'browser', config = {}) {
        switch (provider) {
            case 'browser':
                return new BrowserTTSAdapter(config);
            case 'gemini':
                return new GeminiTTSAdapter(config);
            default:
                console.warn(`TTS provider '${provider}' not found, falling back to browser.`);
                return new BrowserTTSAdapter(config);
        }
    }
}
