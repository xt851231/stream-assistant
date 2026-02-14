import { GeminiLiveAdapter } from './adapters/GeminiLiveAdapter';
import { GeminiFlashAdapter } from './adapters/GeminiFlashAdapter';

export class ModelClient {
    /**
     * Create a Model Adapter instance
     * @param {string} type - 'live' | 'flash'
     * @param {Object} config - Configuration object
     * @returns {ModelAdapter}
     */
    static createAdapter(type, config) {
        console.log(`Creating Model Adapter: ${type}`, config);

        switch (type) {
            case 'live':
                return new GeminiLiveAdapter(config);
            case 'flash':
                return new GeminiFlashAdapter(config);
            default:
                throw new Error(`Unknown model adapter type: ${type}`);
        }
    }
}
