import { TTSAdapter } from '../interfaces/TTSAdapter.js';
import { GoogleGenAI } from "@google/genai";
import { SpeechAudioContext } from '../../../utils/SpeechAudioContext.js';

/**
 * TTS Adapter using Gemini 2.5 Flash TTS model
 */
export class GeminiTTSAdapter extends TTSAdapter {
    constructor(config) {
        super(config);
        this.client = new GoogleGenAI({ apiKey: config.apiKey });
        this.modelId = "gemini-2.5-flash-preview-tts";
        this.audioCtx = null;
        this.gainNode = null;
        this.isPlayingAudio = false;
        this.currentSource = null;
        this.queue = [];
        // Map common voice names to Gemini voices if applicable (Puck, Charon, etc.)
        // For now we use default voice config
        this.voiceConfig = config.voice ? { prebuiltVoiceConfig: { voiceName: config.voice } } : undefined;
    }

    speak(text) {
        if (!text) return Promise.resolve();

        return new Promise((resolve, reject) => {
            // Create a task that starts fetching audio immediately
            const task = {
                text,
                // Start the network request right now (Promise)
                audioPromise: this.fetchAudio(text),
                // Resolver for the caller
                resolve,
                reject
            };

            // Add to queue
            this.queue.push(task);

            // Try to process queue
            this.processQueue();
        });
    }

    async processQueue() {
        // If already playing or queue empty, do nothing
        if (this.isPlayingAudio || this.queue.length === 0) return;

        this.isPlayingAudio = true;
        const task = this.queue[0]; // Peek

        try {
            console.log(`🔊 GeminiTTS: Processing queue item: "${task.text.substring(0, 20)}..."`);

            // Wait for audio data to be ready (if not already)
            const { base64Audio, mimeType } = await task.audioPromise;

            if (base64Audio) {
                // Play it (this waits for playback to finish)
                await this.playAudio(base64Audio, mimeType);
            }
            // Signal completion to caller
            task.resolve();
        } catch (error) {
            console.error("🔊 GeminiTTS: Error processing queue item:", error);
            task.reject(error);
        } finally {
            // Finished with this item (success or error)
            this.queue.shift(); // Remove from queue
            this.isPlayingAudio = false;

            // Process next item immediately via microtask (no artificial delay)
            queueMicrotask(() => this.processQueue());
        }
    }

    async fetchAudio(text, retries = 3) {
        // Simple semaphore: wait if too many requests are active
        while (this.activeRequests >= 3) {
            await new Promise(r => setTimeout(r, 100));
        }

        this.activeRequests = (this.activeRequests || 0) + 1;
        console.log(`🔊 GeminiTTS: [Fetch] Generating audio for: "${text.substring(0, 30)}..." (Active: ${this.activeRequests})`);

        try {
            let lastError;
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const response = await this.client.models.generateContent({
                        model: this.modelId,
                        contents: [{ parts: [{ text: text }] }],
                        config: {
                            responseModalities: ["AUDIO"],
                            speechConfig: { voiceConfig: this.voiceConfig }
                        }
                    });

                    const candidates = response.candidates;
                    if (!candidates || candidates.length === 0) {
                        throw new Error("No TTS candidates returned");
                    }

                    const part = candidates[0].content.parts[0];
                    if (part.inlineData) {
                        console.log(`🔊 GeminiTTS: [Fetch] Got audio data (${part.inlineData.data.length} chars)`);
                        return {
                            base64Audio: part.inlineData.data,
                            mimeType: part.inlineData.mimeType
                        };
                    } else {
                        console.warn("🔊 GeminiTTS: Got unexpected text response");
                        return { base64Audio: null, mimeType: null };
                    }
                } catch (error) {
                    lastError = error;
                    // Retry on 5xx errors or network issues
                    if (attempt < retries && (error.message.includes('500') || error.message.includes('503') || error.message.includes('fetch'))) {
                        const delay = Math.pow(2, attempt) * 500 + Math.random() * 500;
                        console.warn(`🔊 GeminiTTS: Fetch failed (Attempt ${attempt}/${retries}). Retrying in ${Math.round(delay)}ms... Error: ${error.message}`);
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }
                    throw error;
                }
            }
            throw lastError;
        } catch (error) {
            console.error("🔊 GeminiTTS: Fetch failed after retries:", error);
            throw error;
        } finally {
            this.activeRequests--;
        }
    }

    async playAudio(base64String, mimeType) {
        console.log(`🔊 GeminiTTS: playAudio() called, mimeType: ${mimeType}`);

        if (!this.audioCtx) {
            // Use shared SpeechAudioContext
            this.audioCtx = await SpeechAudioContext.getContext();
            this.gainNode = await SpeechAudioContext.getGainNode();
            console.log(`🔊 GeminiTTS: Using shared SpeechAudioContext, sampleRate: ${this.audioCtx.sampleRate}`);
        }

        await SpeechAudioContext.resume();

        // Convert base64 to ArrayBuffer
        console.log(`🔊 GeminiTTS: Decoding base64 audio (${base64String.length} chars)...`);
        const binaryString = atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        console.log(`🔊 GeminiTTS: Decoded to ${bytes.length} bytes`);

        // Check if this is raw PCM (no standard container)
        // Gemini TTS returns raw 16-bit PCM at 24kHz
        const isPCM = mimeType && (mimeType.includes('pcm') || mimeType.includes('raw') || mimeType.includes('L16'));

        try {
            let audioBuffer;

            if (isPCM || !mimeType || mimeType === 'audio/pcm') {
                // Raw PCM: Convert 16-bit PCM to Float32
                console.log(`🔊 GeminiTTS: Converting raw PCM to AudioBuffer...`);
                audioBuffer = this.pcmToAudioBuffer(bytes);
            } else {
                // Try standard decode for other formats
                console.log(`🔊 GeminiTTS: Trying decodeAudioData for ${mimeType}...`);
                try {
                    audioBuffer = await this.audioCtx.decodeAudioData(bytes.buffer.slice(0));
                } catch (decodeError) {
                    // Fallback: assume it's raw PCM
                    console.warn(`🔊 GeminiTTS: decodeAudioData failed, falling back to PCM conversion`);
                    audioBuffer = this.pcmToAudioBuffer(bytes);
                }
            }

            console.log(`🔊 GeminiTTS: Audio ready! Duration: ${audioBuffer.duration}s, channels: ${audioBuffer.numberOfChannels}, sampleRate: ${audioBuffer.sampleRate}`);

            return new Promise((resolve) => {
                const source = this.audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                // Route through shared gain node for volume control
                source.connect(this.gainNode);

                this.currentSource = source;
                this.isPlayingAudio = true;

                source.onended = () => {
                    this.isPlayingAudio = false;
                    this.currentSource = null;
                    console.log("🔊 GeminiTTS: Audio playback finished");
                    resolve();
                };

                console.log(`🔊 GeminiTTS: Starting audio playback NOW`);
                source.start(0);
            });
        } catch (error) {
            console.error(`🔊 GeminiTTS: Failed to process audio:`, error);
            this.isPlayingAudio = false;
            throw error;
        }
    }

    /**
     * Convert 16-bit PCM bytes to AudioBuffer (24kHz mono)
     */
    pcmToAudioBuffer(pcmBytes) {
        // Interpret bytes as 16-bit signed integers (little-endian)
        const numSamples = pcmBytes.length / 2;
        const float32Data = new Float32Array(numSamples);

        for (let i = 0; i < numSamples; i++) {
            // Read 16-bit sample (little-endian)
            let sample = pcmBytes[i * 2] | (pcmBytes[i * 2 + 1] << 8);
            // Convert to signed
            if (sample >= 32768) sample -= 65536;
            // Normalize to -1.0 to 1.0
            float32Data[i] = sample / 32768;
        }

        // Create AudioBuffer (mono, 24kHz)
        const sampleRate = 24000;
        const audioBuffer = this.audioCtx.createBuffer(1, numSamples, sampleRate);
        audioBuffer.copyToChannel(float32Data, 0);

        return audioBuffer;
    }

    stop() {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            this.currentSource = null;
        }
        this.isPlayingAudio = false;
        this.queue = [];
    }

    isPlaying() {
        return this.isPlayingAudio;
    }

    getAvailableVoices() {
        // Return dummy voices for now as we don't query the API for this list
        return [
            { name: 'Puck', lang: 'en-US', default: true },
            { name: 'Charon', lang: 'en-US', default: false },
            { name: 'Kore', lang: 'en-US', default: false },
            { name: 'Fenrir', lang: 'en-US', default: false },
            { name: 'Aoede', lang: 'en-US', default: false }
        ];
    }
}
