/**
 * Gemini Flash Adapter
 * Implements ModelAdapter interface for Gemini Flash (REST API)
 * Uses TTS for audio output.
 */
import { ModelAdapter } from '../interfaces/ModelAdapter.js';
import { GoogleGenAI } from "@google/genai";
import { TTSFactory } from '../tts/TTSFactory.js';
import { base64ToUint8Array, uint8ArrayToBase64 } from '../../utils/base64-utils.js';

export class GeminiFlashAdapter extends ModelAdapter {
    constructor(config) {
        super(config);
        this.client = null;
        this.modelId = config.modelId || "gemini-2.5-flash";
        this.history = []; // Simple chat history for context
        this.tts = null; // Will initialize in connect() or lazy load
        this.voiceEnabled = true; // Default to reading out loud

        // Audio accumulation for REST mode
        this.audioChunks = []; // Accumulated PCM audio chunks (base64)
        this.isAccumulatingAudio = false;

        // Mute-while-speaking: Prevent acoustic feedback loop
        this.isOutputting = false;
        this.outputCooldownTimer = null;

        // Allow dependency injection for testing
        this.GoogleGenAIClass = config.GoogleGenAIClass || GoogleGenAI;
        this.TTSFactoryClass = config.TTSFactoryClass || TTSFactory;
    }

    async connect(config) {
        if (config) {
            this.config = { ...this.config, ...config };
            if (config.modelId) this.modelId = config.modelId;
            if (config.GoogleGenAIClass) this.GoogleGenAIClass = config.GoogleGenAIClass;
        }

        if (!this.config.apiKey) {
            this.emit('error', "API Key is required");
            return false;
        }

        try {
            this.client = new this.GoogleGenAIClass({ apiKey: this.config.apiKey });

            // Initialize TTS with config
            const ttsEngine = this.config.ttsEngine || 'gemini';
            this.tts = this.TTSFactoryClass.createAdapter(ttsEngine, this.config);

            // For REST, we don't hold a persistent connection, but we set ready state
            this.connected = true;
            this.emit('open');
            this.emit('content', { type: 'setup_complete' });
            return true;
        } catch (error) {
            this.emit('error', error.message);
            return false;
        }
    }

    disconnect() {
        this.connected = false;
        if (this.tts) {
            this.tts.stop();
        }
        this.audioChunks = []; // Clear accumulated audio
        this.emit('close');
    }

    /**
     * Update configuration mid-session
     */
    updateConfig(config) {
        // Map systemInstructions (from AppConfig) to systemInstruction (API expectation)
        if (config.systemInstructions) {
            config.systemInstruction = config.systemInstructions;
        }

        const ttsChanged = config.ttsEngine !== undefined ||
            config.ttsVoice !== undefined ||
            config.ttsRate !== undefined ||
            config.ttsPitch !== undefined ||
            config.voice !== undefined;

        this.config = { ...this.config, ...config };

        // If TTS config changed, re-initialize TTS
        if (ttsChanged && this.tts) {
            console.log(`🔄 Flash Adapter: Updating TTS configuration`);
            if (this.tts.stop) this.tts.stop();
            const ttsEngine = this.config.ttsEngine || 'gemini';
            this.tts = this.TTSFactoryClass.createAdapter(ttsEngine, this.config);
        }
    }


        setTools(tools) {
            this.config.tools = tools;
        }
    
        /**
         * Set chat history for REST context.
         * Updates the internal history array used in every request.
         * @param {Array} messages 
         */
        setHistory(messages) {
            if (!messages) return;
    
            this.history = messages
                .filter(msg => msg.type === 'user' || msg.type === 'assistant' || msg.type === 'user-transcript')
                .map(msg => {
                    const role = (msg.type === 'user' || msg.type === 'user-transcript') ? 'user' : 'model';
                    const text = msg.sender ? `[${msg.sender}]: ${msg.text}` : msg.text;
    
                    return {
                        role: role,
                        parts: [{ text: text }]
                    };
                });
    
            console.log(`📜 Updated REST history buffer with ${this.history.length} turns.`);
        }
    
        /**
         * Accumulate audio chunks. The audio will be sent when onSpeechEnd is called.
     * @param {string} base64PCM - Base64-encoded PCM audio chunk
     */
    async sendAudio(base64PCM) {
        if (!this.connected) return;

        // Mute-while-speaking: Discard audio while TTS is playing to prevent feedback loop
        if (this.isOutputting) {
            console.debug(`🎤 Flash: Ignored audio chunk during playback at ${Date.now()}`);
            return; // Ignore audio input during TTS playback
        }

        // Accumulate audio chunks
        this.audioChunks.push(base64PCM);
        this.isAccumulatingAudio = true;

        // Log every 10th chunk to reduce noise but show activity
        if (this.audioChunks.length % 10 === 0) {
            console.debug(`🎤 Flash: Accumulated audio chunk (total: ${this.audioChunks.length} chunks) at ${Date.now()}`);
        }
    }

    /**
     * Called when VAD detects speech has ended.
     * Combines accumulated audio and sends to Gemini Flash.
     */
    async onSpeechEnd() {
        if (!this.connected || this.audioChunks.length === 0) {
            console.debug("🎤 Flash: Speech ended but no audio accumulated");
            return;
        }

        console.log(`🎤 Flash: Speech ended, sending ${this.audioChunks.length} audio chunks`);
        this.isAccumulatingAudio = false;

        try {
            // Combine all base64 chunks into a WAV audio file
            const wavAudio = this.combineAudioChunksToWav(this.audioChunks);
            this.audioChunks = []; // Clear the buffer

            // Send audio (and image if available) to Gemini Flash
            await this.sendAudioToFlash(wavAudio);
        } catch (error) {
            console.error("🎤 Flash: Error processing accumulated audio:", error);
            this.emit('error', error.message);
            this.audioChunks = [];
        }
    }

    /**
     * Store the latest captured image for multimodal requests
     */
    setLatestImage(base64Image) {
        this.latestImage = base64Image;
    }

    /**
     * Combine multiple base64 PCM chunks into a WAV file (base64 encoded)
     * WAV format is required because raw PCM is not supported by Gemini REST API
     */
    combineAudioChunksToWav(chunks) {
        // Decode all base64 chunks to binary
        // ⚡ Bolt Performance Optimization: Replace slow manual btoa loop with high-performance native utility
        const binaryArrays = chunks.map(chunk => base64ToUint8Array(chunk));

        // Calculate total length of PCM data
        const pcmLength = binaryArrays.reduce((sum, arr) => sum + arr.length, 0);

        // Combine into single PCM array
        const pcmData = new Uint8Array(pcmLength);
        let offset = 0;
        for (const arr of binaryArrays) {
            pcmData.set(arr, offset);
            offset += arr.length;
        }

        // Create WAV header (44 bytes)
        const sampleRate = 16000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * bitsPerSample / 8;
        const blockAlign = numChannels * bitsPerSample / 8;
        const dataSize = pcmLength;
        const fileSize = 44 + dataSize - 8;

        const wavBuffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(wavBuffer);

        // RIFF header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, fileSize, true);
        this.writeString(view, 8, 'WAVE');

        // fmt chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // chunk size
        view.setUint16(20, 1, true); // audio format (1 = PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);

        // data chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Copy PCM data after header
        const wavBytes = new Uint8Array(wavBuffer);
        wavBytes.set(pcmData, 44);

        // Convert to base64
        // ⚡ Bolt Performance Optimization: Replace slow manual atob loop with high-performance native utility
        return uint8ArrayToBase64(wavBytes);
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * Send accumulated audio (and optional image) to Gemini Flash REST API
     */
    async sendAudioToFlash(base64WavAudio) {
        if (!this.client) return;

        console.log("🎤 Flash: Sending audio to Gemini Flash API...");

        try {
            // Build request parts
            const parts = [];

            // Add image if available (for multimodal context)
            if (this.latestImage) {
                parts.push({
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: this.latestImage
                    }
                });
                console.log("🎤 Flash: Including image in request");
            }

            // Add audio (WAV format)
            parts.push({
                inlineData: {
                    mimeType: "audio/wav",
                    data: base64WavAudio
                }
            });

            // Add text prompt
            // Inject instruction to force transcription (User-level prompt, does not affect System Prompt)
            parts.push({
                text: `
Listen to the audio and respond helpfully. If there's an image, consider it as context.

IMPORTANT: You must start your response by transcribing exactly what you heard in the audio.
Format:
TRANSCRIPT: [What the user said]
RESPONSE: [Your helpful response. Do not use emojis. Output text only.]
` });

            const contents = [
                ...this.history,
                {
                    role: 'user',
                    parts: parts
                }
            ];

            // Prepare System Instruction with Affective Logic
            let systemInstruction = this.config.systemInstruction || "You are a helpful assistant.";
            if (this.config.affectiveDialog) {
                systemInstruction += "\n\nYou are emotionally expressive. Use tone and inflection to match the context.";
            }

            const response = await this.client.models.generateContentStream({
                model: this.modelId,
                contents: contents,
                config: {
                    systemInstruction: systemInstruction,
                    ...(this.config.googleGrounding ? { tools: [{ googleSearch: {} }] } : {}),
                    generationConfig: {
                        temperature: this.config.temperature,
                        topP: this.config.topP,
                        topK: this.config.topK,
                        maxOutputTokens: 8192,
                    }
                }
            });

            let fullText = "";
            let transcription = "";
            let responseText = "";
            let transcriptionEmitted = false;

            for await (const chunk of response) {
                const chunkText = chunk.text || '';
                fullText += chunkText;

                // Simple parsing logic (streaming friendly)
                if (fullText.includes("RESPONSE:")) {
                    const split = fullText.split("RESPONSE:");
                    transcription = split[0].replace("TRANSCRIPT:", "").trim();

                    // Emit transcription ONCE as soon as we detect it (before response chunks)
                    if (!transcriptionEmitted && transcription) {
                        // Transcription logged by event handler, not here (avoids logging sensitive user speech)
                        console.log("🎤 Flash: Parsed Transcript:", '<redacted length=' + transcription.length + '>');
                        this.emit('content', {
                            type: 'input_transcription',
                            data: {
                                text: transcription,
                                finished: true
                            }
                        });
                        transcriptionEmitted = true;
                    }

                    // We found the response marker, everything after is response
                    // We only want to emit the new part of the response
                    const currentTotalResponse = split[1] || "";
                    const newContent = currentTotalResponse.substring(responseText.length);
                    responseText = currentTotalResponse;

                    if (newContent) {
                        this.emit('content', {
                            type: 'text',
                            data: newContent,
                            endOfTurn: false
                        });
                    }
                }
            }

            // Speak full response as single TTS call for consistent voice
            if (this.voiceEnabled && responseText.trim()) {
                this.isOutputting = true;
                try {
                    await this.tts.speak(responseText.trim());
                } catch (e) {
                    console.error("TTS Error:", e);
                } finally {
                    // Add a cool-down period to let echo dissipate
                    console.debug("🎤 Flash: TTS finished, starting cool-down...");
                    setTimeout(() => {
                        this.isOutputting = false;
                        console.debug("🎤 Flash: Cool-down complete, listening...");
                    }, 1000);
                }
            } else {
                this.isOutputting = false;
            }

            // Update history with parsed content
            if (transcription) {
                this.history.push({ role: 'user', parts: [{ text: transcription }] });
                this.history.push({ role: 'model', parts: [{ text: responseText }] });
            } else {
                console.warn("🎤 Flash: No transcription parsed, using fallback");
                responseText = fullText;
                this.history.push({ role: 'user', parts: [{ text: "[Audio Message]" }] });
                this.history.push({ role: 'model', parts: [{ text: fullText }] });
            }

            this.emit('content', { type: 'text', data: "", endOfTurn: true });
            this.emit('content', { type: 'turn_complete' });

            console.log("🎤 Flash: Audio response received:", '<redacted length=' + fullText.length + '>');

        } catch (error) {
            console.error("🎤 Flash: Error sending audio:", error);
            this.emit('error', error.message);
        }
    }

    /**
     * Override sendImage to prevent throwing. Flash can process images via REST but not in streaming fashion.
     */
    sendImage(base64Image, mimeType) {
        // For REST, we accumulate the latest image and send on next text or audio call.
        this.setLatestImage(base64Image);
    }

    /**
     * Send text to Gemini Flash
     */
    async sendText(text, base64Image = null) {
        if (!this.client) return;

        // NOTE: We do NOT emit input_transcription here because the UI already displays the typed message.
        // Emitting it would cause a duplicate "echo" in the chat.

        try {
            // Prepare Content Parts
            const parts = [];
            const imgToUse = base64Image || this.latestImage;
            if (imgToUse) {
                parts.push({
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: imgToUse
                    }
                });
            }
            parts.push({ text: text });

            // Construct contents array including history
            const contents = [
                ...this.history,
                { role: 'user', parts: parts }
            ];

            // Prepare System Instruction with Affective Logic
            let systemInstruction = this.config.systemInstruction || "You are a helpful assistant.";
            if (this.config.affectiveDialog) {
                systemInstruction += "\n\nYou are emotionally expressive. Use tone and inflection to match the context.";
            }

            // Use the correct SDK method: ai.models.generateContentStream
            const response = await this.client.models.generateContentStream({
                model: this.modelId,
                contents: contents,
                config: {
                    systemInstruction: systemInstruction,
                    ...(this.config.googleGrounding ? { tools: [{ googleSearch: {} }] } : {}),
                    generationConfig: {
                        temperature: this.config.temperature,
                        topP: this.config.topP,
                        topK: this.config.topK,
                        maxOutputTokens: 8192,
                    }
                }
            });

            let fullText = "";

            for await (const chunk of response) {
                const chunkText = chunk.text || '';
                fullText += chunkText;

                // Emit text chunk (for UI display)
                this.emit('content', {
                    type: 'text',
                    data: chunkText,
                    endOfTurn: false
                });
            }

            // End of turn
            this.emit('content', {
                type: 'text',
                data: "",
                endOfTurn: true
            });
            this.emit('content', { type: 'turn_complete' });

            // Speak full response as single TTS call for consistent voice
            if (this.voiceEnabled && fullText.trim()) {
                this.isOutputting = true;
                try {
                    await this.tts.speak(fullText.trim());
                } catch (e) {
                    console.error("TTS Error:", e);
                } finally {
                    console.debug("🎤 Flash: TTS finished (text mode), starting cool-down...");
                    setTimeout(() => {
                        this.isOutputting = false;
                        console.debug("🎤 Flash: Cool-down complete, listening...");
                    }, 1000);
                }
            } else {
                this.isOutputting = false;
            }

            // Update history
            this.history.push({ role: 'user', parts: [{ text: text }] });
            this.history.push({ role: 'model', parts: [{ text: fullText }] });

        } catch (error) {
            console.error("Gemini Flash Error:", error);
            this.emit('error', error.message);
        }
    }
}
