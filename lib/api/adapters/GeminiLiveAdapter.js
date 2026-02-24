/**
 * Gemini Live Adapter
 * Implements ModelAdapter interface for Google Gemini Live API (WebSocket)
 */
import { ModelAdapter } from '../interfaces/ModelAdapter.js';
import { GoogleGenAI } from "@google/genai";

// Response type constants (Internal to this adapter)
export const MultimodalLiveResponseType = {
    TEXT: "TEXT",
    AUDIO: "AUDIO",
    SETUP_COMPLETE: "SETUP COMPLETE",
    INTERRUPTED: "INTERRUPTED",
    TURN_COMPLETE: "TURN COMPLETE",
    TOOL_CALL: "TOOL_CALL",
    ERROR: "ERROR",
    INPUT_TRANSCRIPTION: "INPUT_TRANSCRIPTION",
    OUTPUT_TRANSCRIPTION: "OUTPUT_TRANSCRIPTION",
};

export class GeminiLiveAdapter extends ModelAdapter {
    constructor(config) {
        super(config);
        this.client = null;
        this.session = null;
        this.model = config.modelId || "gemini-2.5-flash-native-audio-preview-12-2025";
        this.responseModalities = ["AUDIO"]; // Default to Audio for Live
        this.tools = null;
        // Allow dependency injection for testing
        this.GoogleGenAIClass = config.GoogleGenAIClass || GoogleGenAI;
    }

    async connect(config) {
        // Update config if provided
        if (config) {
            this.config = { ...this.config, ...config };
            if (config.modelId) this.model = config.modelId;
            // Allow updating dependency injection if needed (though usually done in static config)
            if (config.GoogleGenAIClass) this.GoogleGenAIClass = config.GoogleGenAIClass;
        }

        if (!this.config.apiKey) {
            this.emit('error', "API Key is required");
            return false;
        }

        try {
            // Use v1alpha as required for enableAffectiveDialog
            this.client = new this.GoogleGenAIClass({
                apiKey: this.config.apiKey,
                httpOptions: { apiVersion: "v1alpha" }
            });

            const connectConfig = this._buildConnectConfig();

            console.log('🔧 TRANSCRIPTION CONFIG:', {
                inputTranscription: this.config.inputTranscription,
                outputTranscription: this.config.outputTranscription,
                inputAudioTranscription: connectConfig.inputAudioTranscription,
                outputAudioTranscription: connectConfig.outputAudioTranscription,
            });

            this.session = await this.client.live.connect({
                model: this.model,
                config: connectConfig,
                callbacks: this._getCallbacks()
            });

            return true;
        } catch (error) {
            this.emit('error', error.message);
            this.connected = false;
            return false;
        }
    }

    _buildConnectConfig() {
        const systemInstruction = this.config.systemInstruction || "You are a helpful assistant.";

        const connectConfig = {
            model: this.model,
            responseModalities: this.responseModalities,
            systemInstruction: systemInstruction,
            // Generation params go directly on config (not nested in generationConfig)
            temperature: this.config.temperature,
            topP: this.config.topP,
            topK: this.config.topK,
            maxOutputTokens: 8192,
            // Native Affective Dialog toggle (requires v1alpha)
            enableAffectiveDialog: this.config.affectiveDialog || false,
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: this.config.voice || "Puck"
                    }
                }
            },
            // Add Activity Detection Config
            realtimeInputConfig: {
                automaticActivityDetection: {
                    disabled: false, // Always keep server VAD enabled
                    silenceDurationMs: this.config.silenceDuration || 1500,
                    prefixPaddingMs: this.config.prefixPadding || 500,
                    startOfSpeechSensitivity: this.config.startSpeechSensitivity || "START_SENSITIVITY_UNSPECIFIED",
                    endOfSpeechSensitivity: this.config.endOfSpeechSensitivity || "END_SENSITIVITY_UNSPECIFIED"
                }
            },
            // Thinking Config
            thinkingConfig: {
                includeThoughts: false, // UI doesn't support visualizing thoughts yet
                budgetTokenCount: this.config.thinkingBudget > 0 ? this.config.thinkingBudget : undefined
            }
        };

        // Conditionally enable transcriptions
        if (this.config.inputTranscription) {
            connectConfig.inputAudioTranscription = {};
        }
        if (this.config.outputTranscription) {
            connectConfig.outputAudioTranscription = {};
        }

        if (this.tools) {
            connectConfig.tools = this.tools;
        }

        return connectConfig;
    }

    _getCallbacks() {
        return {
            onopen: () => {
                console.log('🔌 WebSocket connection OPENED');
                this.connected = true;
                this.emit('open');
            },
            onmessage: (message) => {
                this.handleIncomingMessage(message);
            },
            onclose: (e) => {
                console.log('🔌 WebSocket connection CLOSED', e);
                this.connected = false;
                this.emit('close', e);
            },
            onerror: (e) => {
                console.error('🔌 WebSocket ERROR:', e);
                this.emit('error', e.message);
            }
        };
    }

    disconnect() {
        if (this.session) {
            this.connected = false;
            // Try to close the WebSocket properly
            const ws = this.session.conn?._ws || this.session.conn?.ws || this.session.conn?.websocket || this.session.conn;
            if (ws && typeof ws.close === 'function') {
                try {
                    ws.close();
                } catch (error) {
                    console.error("Error closing WebSocket:", error);
                }
            }
            this.session = null;
            this.emit('close');
        }
    }

    /**
     * Update configuration.
     * The Live API does not support mid-session setup messages.
     * Reconnect logic is handled by LiveAPIContext to preserve media streams.
     * @param {Object} config 
     */
    updateConfig(config) {
        // Map systemInstructions (from AppConfig) to systemInstruction (API field)
        if (config.systemInstructions) {
            config.systemInstruction = config.systemInstructions;
        }

        this.config = { ...this.config, ...config };
    }

    async sendAudio(base64PCM) {
        if (!this.session) {
            console.warn("⚠️ sendAudio called but session is null");
            return;
        }

        this.session.sendRealtimeInput({
            audio: {
                data: base64PCM,
                mimeType: "audio/pcm;rate=16000"
            }
        });
    }

    /**
     * Send activity start marker (for manual VAD mode)
     * Required when automaticActivityDetection.disabled is true
     */
    sendActivityStart() {
        if (!this.session) return;
        try {
            this.session.sendRealtimeInput({ activityStart: {} });
            console.debug('📣 Sent activityStart to Gemini Live API');
        } catch (error) {
            console.error('Failed to send activityStart:', error);
        }
    }

    /**
     * Send activity end marker (for manual VAD mode)
     * Required when automaticActivityDetection.disabled is true
     */
    sendActivityEnd() {
        if (!this.session) return;
        try {
            this.session.sendRealtimeInput({ activityEnd: {} });
            console.debug('📣 Sent activityEnd to Gemini Live API');
        } catch (error) {
            console.error('Failed to send activityEnd:', error);
        }
    }

    async sendImage(base64Image, mimeType = "image/jpeg") {
        if (!this.session) return;

        // Try to access the underlying WebSocket for direct protocol support
        // (Copied from original implementation as SDK might have issues with images)
        let ws = null;
        if (this.session.conn) {
            ws = this.session.conn._ws || this.session.conn.ws || this.session.conn.websocket || this.session.conn;
            if (ws && typeof ws.send !== 'function') ws = null;
        }
        if (!ws) ws = this.session._ws || this.session.ws || this.session.websocket;

        if (ws && ws.readyState === WebSocket.OPEN) {
            const message = {
                realtimeInput: {
                    mediaChunks: [{
                        mimeType: mimeType,
                        data: base64Image
                    }]
                }
            };
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                console.error("Failed to send via WebSocket:", error);
            }
        } else {
            // Fallback to SDK
            try {
                this.session.sendRealtimeInput({
                    mediaChunks: [{
                        mimeType: mimeType,
                        data: base64Image
                    }]
                });
            } catch (error) {
                console.error("Failed to send image via SDK:", error);
            }
        }
    }


    sendText(text, imageBase64 = null) {
        if (!this.session) return;

        const parts = [{ text: text }];
        if (imageBase64) {
            parts.unshift({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: imageBase64
                }
            });
        }

        this.session.sendClientContent({
            turns: [{
                role: "user",
                parts: parts
            }],
            turnComplete: true
        });
    }

    setTools(tools) {
        this.tools = tools;
    }

    handleIncomingMessage(message) {
        const serverContent = message.serverContent;

        if (message.setupComplete) {
            this.emit('content', { type: 'setup_complete' });
        }

        if (message.toolCall) {
            this.emit('content', {
                type: 'tool_call',
                data: message.toolCall
            });
        }

        if (serverContent) {

            if (serverContent.interrupted) {
                this.emit('content', { type: 'interrupted' });
            }

            if (serverContent.turnComplete) {
                this.emit('content', { type: 'turn_complete' });
            }

            if (serverContent.inputTranscription) {
                console.log('📝 Input transcription (serverContent):', '<redacted>');
                this.emit('content', {
                    type: 'input_transcription',
                    data: serverContent.inputTranscription
                });
            }

            if (serverContent.outputTranscription) {
                console.log('📝 Output transcription (serverContent):', '<redacted>');
                this.emit('content', {
                    type: 'output_transcription',
                    data: serverContent.outputTranscription
                });
            }

            if (serverContent.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                    // Skip thought parts - the SDK returns thoughts in a separate 'thought' property
                    if (part.thought) {
                        continue;
                    }

                    if (part.text) {
                        this.emit('content', {
                            type: 'text',
                            data: part.text,
                            endOfTurn: serverContent.turnComplete
                        });
                    } else if (part.inlineData) {
                        this.emit('content', {
                            type: 'audio',
                            data: part.inlineData.data,
                            endOfTurn: serverContent.turnComplete
                        });
                    }
                }
            }
        }

        // Fallback: transcription may arrive as top-level message properties (not under serverContent)
        if (message.inputTranscription && !serverContent?.inputTranscription) {
            console.log('📝 Input transcription (top-level):', '<redacted>');
            this.emit('content', {
                type: 'input_transcription',
                data: message.inputTranscription
            });
        }
        if (message.outputTranscription && !serverContent?.outputTranscription) {
            console.log('📝 Output transcription (top-level):', '<redacted>');
            this.emit('content', {
                type: 'output_transcription',
                data: message.outputTranscription
            });
        }
    }
}
