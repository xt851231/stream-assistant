/**
 * Abstract Base Class for Model Adapters
 * Defines the standardized interface that all model implementations must follow.
 */
/**
 * Simple Event Emitter for Browser Compatibility
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return this;
    }

    off(event, listenerToRemove) {
        if (!this.events[event]) return this;
        this.events[event] = this.events[event].filter(l => l !== listenerToRemove);
        return this;
    }

    once(event, listener) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            listener.apply(this, args);
        };
        return this.on(event, wrapper);
    }

    emit(event, ...args) {
        if (!this.events[event]) return false;
        this.events[event].forEach(listener => {
            try {
                listener.apply(this, args);
            } catch (e) {
                console.error(`Error in event listener for ${event}:`, e);
            }
        });
        return true;
    }

    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
        return this;
    }
}

export class ModelAdapter extends EventEmitter {
    constructor(config) {
        super();
        this.config = config || {};
        this.connected = false;
    }

    /**
     * Connect to the model service
     * @param {Object} config - Connection configuration (apiKey, modelId, etc.)
     * @returns {Promise<boolean>} - True if connection successful
     */
    async connect(config) {
        throw new Error("connect() must be implemented by subclass");
    }

    /**
     * Disconnect from the model service
     */
    disconnect() {
        this.connected = false;
        this.emit('close');
    }

    /**
     * Send audio chunk to the model
     * @param {string | Int16Array | ArrayBuffer} audioData - Audio data (base64 or binary)
     */
    sendAudio(audioData) {
        throw new Error("sendAudio() must be implemented by subclass");
    }

    /**
     * Send video/image frame to the model
     * @param {string} base64Image - Base64 encoded image data
     * @param {string} mimeType - MIME type of the image
     */
    sendImage(base64Image, mimeType) {
        throw new Error("sendImage() must be implemented by subclass");
    }

    /**
     * Send text message to the model
     * @param {string} text - Text message
     * @param {string} base64Image - Optional context image
     */
    sendText(text, base64Image) {
        throw new Error("sendText() must be implemented by subclass");
    }

    /**
     * Set system instructions
     * @param {string} instructions 
     */
    setSystemInstructions(instructions) {
        // Default implementation does nothing, override if supported
        this.config.systemInstruction = instructions;
    }

    /**
     * Set the conversation history.
     * Overridden by subclasses to handle history in a provider-specific way.
     * @param {Array<{role: string, text: string, sender?: string}>} messages 
     */
    setHistory(messages) {
        this.config.history = messages;
    }

    /**
     * Set output voice
     * @param {string} voiceName 
     */
    setVoice(voiceName) {
        // Default implementation does nothing, override if supported
        this.config.voice = voiceName;
    }

    /**
     * Set tools configuration
     * @param {Array} tools 
     */
    setTools(tools) {
        // Default implementation does nothing, override if supported
        this.config.tools = tools;
    }
    /**
     * Update configuration (system instructions, voice, etc.) mid-session
     * @param {Object} config - Configuration updates
     */
    updateConfig(config) {
        // Default implementation does nothing, override if supported
        this.config = { ...this.config, ...config };
    }
}
