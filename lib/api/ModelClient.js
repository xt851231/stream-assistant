import { GeminiLiveAdapter } from './adapters/GeminiLiveAdapter.js';
import { GeminiFlashAdapter } from './adapters/GeminiFlashAdapter.js';
import { QwenOmniAdapter } from './adapters/QwenOmniAdapter.js';

export class ModelClient {
    /**
     * Create a Model Adapter instance
     * @param {string} type - 'live' | 'flash' | 'qwen-omni'
     * @param {Object} config - Configuration object
     * @returns {ModelAdapter}
     */
    static createAdapter(type, config) {
        console.log(`Creating Model Adapter: ${type}`);

        switch (type) {
            case 'live':
                return new GeminiLiveAdapter(config);
            case 'flash':
                return new GeminiFlashAdapter(config);
            case 'qwen-omni':
                return new QwenOmniAdapter(config);
            default:
                throw new Error(`Unknown model adapter type: ${type}`);
        }
    }
}
