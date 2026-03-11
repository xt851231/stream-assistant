import { ModelAdapter } from '../interfaces/ModelAdapter.js';
import { MODEL_REGISTRY } from '../../../utils/model-registry.js';

export class QwenOmniAdapter extends ModelAdapter {
    constructor(config) {
        super(config);
        this.client = null;
        this.ws = null;
        this.model = config.modelId || "qwen3-omni-flash-realtime";
        this.isConnected = false;
        this._isModelResponding = false; // Track if model is actively generating a response
        this._audioSendCount = 0; // Diagnostic counter for interval
        this._totalAudioSent = 0; // Diagnostic counter for total
        this._diagInterval = null;
        this._sessionCreated = false;
        this._audioQueue = []; // Queue audio until session is verified created

        // Qwen supports VAD out of the box. Following Gemini Live adapter logic, 
        // we enforce Server VAD to ALWAYS be on regardless of client-side config.
        this.enableVAD = true;
    }

    async connect(config) {
        if (config) {
            this.config = { ...this.config, ...config };
            if (config.modelId) this.model = config.modelId;
            // Removed client-side config override for enableVAD since we force it ON
        }

        if (!this.config.apiKey) {
            this.emit('error', "API Key is required");
            return false;
        }

        return new Promise((resolve) => {
            try {
                // Pass the API key in the URL query to support browser native WebSockets
                const apiUrl = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${this.model}&api_key=${this.config.apiKey}`;

                console.log(`🔌 Connecting to Qwen Omni Realtime API: ${this.model}`);
                console.log("Qwen Adapter Initialized with UI Config:", {
                    ...this.config,
                    apiKey: this.config.apiKey ? `[HIDDEN: ${this.config.apiKey.substring(0, 4)}...]` : undefined
                });

                this.ws = new WebSocket(apiUrl);

                this.ws.onopen = () => {
                    console.log('🔌 Qwen Omni WebSocket OPENED');
                    this.connected = true;
                    this.isConnected = true;
                    this.emit('open');

                    this._sessionCreated = false;
                    this._audioQueue = [];

                    // Start diagnostic logging interval
                    this._audioSendCount = 0;
                    this._totalAudioSent = 0;
                    this._diagInterval = setInterval(() => {
                        if (this._audioSendCount > 0) {
                            console.log(`🔍 DIAG: Sent ${this._audioSendCount} audio chunks in last 3s | ws.readyState=${this.ws?.readyState} | connected=${this.connected}`);
                            this._audioSendCount = 0;
                        }
                    }, 3000);

                    // Build complete session.update payload mapped from Gemini Live settings.
                    // Gemini-specific properties (googleGrounding, affectiveDialog, speechConfig,
                    // thinkingConfig) are strictly ignored — Qwen doesn't support them.
                    const session = {
                        // Audio modalities & formats (Qwen3-Flash: pcm16 in, pcm24 out)
                        modalities: ["text", "audio"],
                        input_audio_format: "pcm16",
                        output_audio_format: "pcm24",

                        // Qwen3-Flash: enable conversational/spoken reply style
                        smooth_output: true,

                        // Enable server-side input audio transcription
                        // This makes Qwen emit conversation.item.input_audio_transcription.completed events
                        input_audio_transcription: { model: "gummy-realtime-v1" },

                        // VAD config: Always enforce Server VAD (same logic as Gemini adapter)
                        turn_detection: {
                            type: "server_vad",
                            threshold: 0.5,                                         // Qwen default
                            silence_duration_ms: this.config.silenceDuration || 800, // Qwen default: 800
                            prefix_padding_ms: this.config.prefixPadding || 300,     // Qwen default: 300
                        },

                        // Repetition penalty (Qwen-specific, default 1.05)
                        repetition_penalty: 1.05,
                    };

                    // System instructions (Gemini: systemInstruction → Qwen: instructions)
                    const personaInstruction = this.config.systemInstruction || "You are a helpful assistant.";
                    const modelDef = MODEL_REGISTRY[this.config.provider];
                    const modelInstruction = modelDef?.modelInstruction || "";

                    const finalInstruction = [personaInstruction, modelInstruction]
                        .filter(Boolean)
                        .join('\n\n');

                    session.instructions = finalInstruction;

                    // Voice (Gemini: speechConfig.voiceName → Qwen: voice)
                    if (this.config.voice) {
                        session.voice = this.config.voice;
                    }

                    // Generation params: Qwen docs say "only set one of temperature or top_p"
                    // We prioritize temperature as it's the most common control.
                    // Qwen3-Flash defaults: temperature=0.9, top_p=1.0, top_k=50
                    if (this.config.temperature !== undefined) {
                        session.temperature = this.config.temperature;
                    } else if (this.config.topP !== undefined) {
                        session.top_p = this.config.topP;
                    }

                    if (this.config.topK !== undefined) {
                        session.top_k = this.config.topK;
                    }

                    const sessionUpdate = { type: "session.update", session };

                    console.log("Sending Qwen session.update payload:", sessionUpdate);
                    this.ws.send(JSON.stringify(sessionUpdate));
                    resolve(true);
                };

                this.ws.onmessage = (event) => {
                    this.handleIncomingMessage(event.data);
                };

                this.ws.onclose = (e) => {
                    console.log('🔌 Qwen Omni WebSocket CLOSED', e);
                    this.connected = false;
                    this.isConnected = false;
                    this.emit('close', e);
                };

                this.ws.onerror = (e) => {
                    console.error('🔌 Qwen Omni WebSocket ERROR:', e);
                    this.emit('error', "WebSocket Error");
                    resolve(false);
                };

            } catch (error) {
                console.error("Failed to connect Qwen Omni:", error);
                this.emit('error', error.message);
                this.connected = false;
                this.isConnected = false;
                resolve(false);
            }
        });
    }

    disconnect() {
        if (this.ws) {
            console.log('🔌 QwenOmniAdapter: Disconnecting WebSocket...');
            this.connected = false;
            this.isConnected = false;

            const ws = this.ws;
            this.ws = null; // Clear reference first to prevent callbacks from using it

            // Close if not already closing or closed
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                try {
                    ws.close();
                } catch (e) {
                    console.error("Error closing Qwen WebSocket:", e);
                }
            }

            this.emit('close');
        }
        if (this._diagInterval) {
            clearInterval(this._diagInterval);
            this._diagInterval = null;
        }
    }

    sendAudio(base64PCM) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        // Qwen API MUST receive session.created before accepting audio chunks.
        // If we send audio too early, the server drops the whole stream.
        if (!this._sessionCreated) {
            this._audioQueue.push(base64PCM);
            return;
        }

        try {
            this._audioSendCount++;
            this._totalAudioSent++;
            this.ws.send(JSON.stringify({
                type: "input_audio_buffer.append",
                audio: base64PCM
            }));

            // Qwen requires at least one audio chunk to be sent before accepting images.
            // Flush any queued image immediately after the first audio chunk.
            if (this._imageQueue && this._imageQueue.length > 0) {
                const queuedImage = this._imageQueue.shift();
                this.sendImage(queuedImage);
            }

            // DIAGNOSTIC TEST: Manually commit after ~9 seconds of audio (approx 150 chunks)
            if (this._totalAudioSent === 150) {
                console.log("🔍 DIAG: Sending manual commit and response.create to force Qwen response");
                this.ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
                this.ws.send(JSON.stringify({ type: "response.create" }));
            }
        } catch (error) {
            console.error("Failed to send audio to Qwen:", error);
        }
    }

    sendImage(base64Image, mimeType = "image/jpeg") {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Requirement 1: Session must be fully created
        if (!this._sessionCreated) {
            this._imageQueue.push(base64Image); // Queue latest image
            return;
        }

        // Requirement 2 (Crucial): Qwen REQUIRES at least one audio chunk to be sent BEFORE any images.
        // Sending an image first throws a protocol error causing a 1006 WebSocket crash.
        if (this._totalAudioSent === 0) {
            this._imageQueue.push(base64Image);
            return;
        }

        // Prevent buffer overflows: drop image frames while the model is actively responding.
        // During long responses, infinite 1fps image streams can overflow Qwen's buffer.
        if (this._isModelResponding) {
            return;
        }

        try {
            this.ws.send(JSON.stringify({
                type: "input_image_buffer.append",
                image: base64Image
            }));
        } catch (error) {
            console.error("Failed to send image to Qwen:", error);
        }
    }

    sendText(text, imageBase64 = null) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const content = [];
        if (imageBase64) {
            content.push({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            });
        }
        content.push({
            type: "input_text",
            text: text
        });

        try {
            this.ws.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                    type: "message",
                    role: "user",
                    content: content
                }
            }));

            // Note: Server VAD is strictly ON, so Qwen automatically triggers response generation.
            // Manually sending `response.create` here is completely unnecessary and can cause double responses.
        } catch (error) {
            console.error("Failed to send text to Qwen:", error);
        }
    }

    setHistory(messages) {
        if (!this.ws || !messages || messages.length === 0) return;

        const validMessages = messages.filter(msg =>
            msg.type === 'user' || msg.type === 'assistant' || msg.type === 'user-transcript'
        );

        if (validMessages.length === 0) return;

        // Qwen supports conversation.item.create for history injection
        // Let's inject them as completed items
        validMessages.forEach(msg => {
            const role = (msg.type === 'assistant') ? 'assistant' : 'user';
            const senderTag = msg.sender ? `[${msg.sender}]: ` : '';
            this.ws.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                    type: "message",
                    status: "completed",
                    role: role,
                    content: [{
                        type: "input_text",
                        text: senderTag + msg.text
                    }]
                }
            }));
        });
        console.log(`📜 Injected ${validMessages.length} history turns into Qwen Session.`);
    }

    setTools(tools) {
        this.config.tools = tools;
    }

    handleIncomingMessage(data) {
        try {
            const message = JSON.parse(data);
            // Log ALL incoming events for diagnostics
            if (message.type !== 'response.audio.delta') {
                console.log(`🔍 DIAG Qwen EVENT: ${message.type}`);
            }
            switch (message.type) {
                case 'session.created':
                    // Setup complete is triggered by session.created.
                    this._sessionCreated = true;
                    if (this._audioQueue.length > 0) {
                        console.log(`🔌 Qwen Session Created. Flushing ${this._audioQueue.length} queued audio chunks...`);
                        this._audioQueue.forEach(chunk => this.sendAudio(chunk));
                        this._audioQueue = []; // Clear queue
                    }
                    this.emit('content', { type: 'setup_complete' });
                    break;
                case 'session.updated':
                    console.log('🔌 Qwen Session Updated');
                    break;

                case 'response.audio.delta':
                    this._isModelResponding = true;
                    // Qwen's "pcm24" = 24kHz sample rate, 16-bit depth (NOT 24-bit depth).
                    // Data is already compatible with our AudioPlayer — pass through as-is.
                    this.emit('content', {
                        type: 'audio',
                        data: message.delta,
                        endOfTurn: false
                    });
                    break;

                case 'response.audio_transcript.delta':
                case 'response.text.delta':
                    this.emit('content', {
                        type: 'text',
                        data: message.delta,
                        endOfTurn: false
                    });
                    break;

                case 'response.done':
                    this._isModelResponding = false;
                    this.emit('content', { type: 'turn_complete' });
                    break;

                // ─── Input Audio Transcription (Qwen-specific) ───
                // Emitted after VAD detects speech end and the ASR model transcribes it.
                // Maps to Gemini's inputTranscription feature.
                case 'conversation.item.input_audio_transcription.completed':
                    this.emit('content', {
                        type: 'input_transcription',
                        data: {
                            text: message.transcript || '',
                            finished: true
                        }
                    });
                    break;

                case 'conversation.item.input_audio_transcription.failed':
                    console.warn('⚠️ Qwen input audio transcription failed:', message.error);
                    break;

                // ─── VAD Speech Detection Events ───
                // Only emit interrupted when the model is actively responding.
                // Unlike Gemini (which only sends 'interrupted' during active generation),
                // Qwen sends 'speech_started' for ALL speech, even when the model is idle.
                case 'input_audio_buffer.speech_started':
                    if (this._isModelResponding) {
                        this._isModelResponding = false;
                        this.emit('content', { type: 'interrupted' });
                    }
                    break;

                case 'input_audio_buffer.speech_stopped':
                case 'input_audio_buffer.committed':
                case 'input_audio_buffer.cleared':
                case 'response.created':
                case 'response.output_item.added':
                case 'response.output_item.done':
                case 'response.content_part.added':
                case 'response.content_part.done':
                case 'response.audio.done':
                case 'response.audio_transcript.done':
                case 'response.text.done':
                case 'conversation.item.created':
                    // Known events we don't need to act on — suppress unknown event warnings
                    break;

                case 'error':
                    console.error("Qwen API Error:", message.error);
                    this.emit('error', message.error?.message || "Unknown error component");
                    break;

                default:
                    console.log(`🔌 Qwen unhandled event: ${message.type}`);
                    break;
            }
        } catch (e) {
            console.error("Error parsing Qwen message:", e, data);
        }
    }
}
