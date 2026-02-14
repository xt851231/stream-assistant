/**
 * Gemini Live Adapter
 * Implements ModelAdapter interface for Google Gemini Live API (WebSocket)
 */
import { ModelAdapter } from '../interfaces/ModelAdapter';
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
    }

    async connect(config) {
        // Update config if provided
        if (config) {
            this.config = { ...this.config, ...config };
            if (config.modelId) this.model = config.modelId;
        }

        if (!this.config.apiKey) {
            this.emit('error', "API Key is required");
            return false;
        }

        try {
            this.client = new GoogleGenAI({ apiKey: this.config.apiKey });

            const connectConfig = {
                model: this.model,
                responseModalities: this.responseModalities,
                systemInstruction: this.config.systemInstruction || "You are a helpful assistant.",
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: this.config.voice || "Puck"
                        }
                    }
                },
                // Add Activity Detection Config
                // Server-side VAD is always enabled for speech boundary detection
                // The client-side enableVAD toggle only controls local silence suppression
                realtimeInputConfig: {
                    automaticActivityDetection: {
                        disabled: false, // Always keep server VAD enabled
                        silenceDurationMs: this.config.silenceDuration || 1500,
                        prefixPaddingMs: this.config.prefixPadding || 500,
                        startOfSpeechSensitivity: this.config.startSpeechSensitivity || "START_SENSITIVITY_UNSPECIFIED",
                        endOfSpeechSensitivity: this.config.endOfSpeechSensitivity || "END_SENSITIVITY_UNSPECIFIED"
                    }
                },
                // Disable thoughts in response output
                thinkingConfig: {
                    includeThoughts: false
                },
                // Enable transcriptions
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            };

            if (this.tools) {
                connectConfig.tools = this.tools;
            }

            this.session = await this.client.live.connect({
                model: this.model,
                config: connectConfig,
                callbacks: {
                    onopen: () => {
                        console.log('🔌 WebSocket connection OPENED');
                        this.connected = true;
                        this.emit('open');
                    },
                    onmessage: (message) => {
                        console.log('📨 RAW onmessage callback triggered!');
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
                }
            });

            // Expose session for debugging
            window.__liveApiSession = this.session;
            window.__liveApiAdapter = this;
            console.log('🔧 DEBUG: Session and adapter exposed on window');

            return true;
        } catch (error) {
            this.emit('error', error.message);
            this.connected = false;
            return false;
        }
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

    async sendAudio(base64PCM) {
        if (!this.session) {
            console.warn("⚠️ sendAudio called but session is null");
            return;
        }
        // console.debug(`📤 Sending ${base64PCM.length} bytes of audio`); // frequent log
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
        console.log('📨 Received message:', Object.keys(message));
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
            console.log('📨 ServerContent keys:', Object.keys(serverContent));

            if (serverContent.interrupted) {
                this.emit('content', { type: 'interrupted' });
            }

            if (serverContent.turnComplete) {
                this.emit('content', { type: 'turn_complete' });
            }

            if (serverContent.inputTranscription) {
                this.emit('content', {
                    type: 'input_transcription',
                    data: serverContent.inputTranscription
                });
            }

            if (serverContent.outputTranscription) {
                this.emit('content', {
                    type: 'output_transcription',
                    data: serverContent.outputTranscription
                });
            }

            if (serverContent.modelTurn?.parts) {
                console.log('📨 ModelTurn parts:', serverContent.modelTurn.parts.length);
                for (const part of serverContent.modelTurn.parts) {
                    console.log('📨 Part keys:', Object.keys(part));

                    // Skip thought parts - the SDK returns thoughts in a separate 'thought' property
                    if (part.thought) {
                        continue;
                    }

                    if (part.text) {
                        console.log('📨 Emitting text:', part.text.substring(0, 50));
                        this.emit('content', {
                            type: 'text',
                            data: part.text,
                            endOfTurn: serverContent.turnComplete
                        });
                    } else if (part.inlineData) {
                        console.log('📨 Emitting audio, mime:', part.inlineData.mimeType, 'length:', part.inlineData.data?.length);
                        this.emit('content', {
                            type: 'audio',
                            data: part.inlineData.data,
                            endOfTurn: serverContent.turnComplete
                        });
                    }
                }
            }
        }
    }
}
