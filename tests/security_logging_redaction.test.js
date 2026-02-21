
import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';
import { GeminiTTSAdapter } from '../lib/api/tts/adapters/GeminiTTSAdapter.js';

// Mock dependencies
class MockGoogleGenAI {
    constructor(config) {
        this.apiKey = config.apiKey;
    }
}

describe('Sensitive Data Logging', () => {
    it('GeminiLiveAdapter should redact transcription logs', (t) => {
        const originalLog = console.log;
        const logs = [];
        console.log = (...args) => logs.push(args.join(' '));

        try {
            // Mock dependencies via injection or just rely on the fact that constructor doesn't use them heavily
            // The adapter imports GoogleGenAI. We can mock it if we could, but here we can just pass a dummy key
            // and rely on handleIncomingMessage not using the client directly for message parsing.

            // Actually, GeminiLiveAdapter constructor allows injecting GoogleGenAIClass via config!
            const adapter = new GeminiLiveAdapter({
                apiKey: 'test-key',
                GoogleGenAIClass: MockGoogleGenAI
            });

            // Simulate incoming message with sensitive transcription
            const sensitiveText = "SECRET_PASSWORD_123";
            const message = {
                serverContent: {
                    inputTranscription: sensitiveText,
                    outputTranscription: sensitiveText
                }
            };

            adapter.handleIncomingMessage(message);

            // Check logs
            const logContent = logs.join('\n');
            assert.ok(logContent.includes('Input transcription (serverContent) received'), 'Should log redacted input transcription message');
            assert.ok(logContent.includes('Output transcription (serverContent) received'), 'Should log redacted output transcription message');
            assert.ok(!logContent.includes(sensitiveText), 'Should NOT log sensitive transcription text');

        } finally {
            console.log = originalLog;
        }
    });

    it('GeminiTTSAdapter should redact text logs', async (t) => {
        const originalLog = console.log;
        const logs = [];
        console.log = (...args) => logs.push(args.join(' '));

        try {
            const adapter = new GeminiTTSAdapter({ apiKey: 'test-key' });

            // Mock client.models.generateContent
            adapter.client = {
                models: {
                    generateContent: async () => ({
                        candidates: [{
                            content: {
                                parts: [{
                                    inlineData: {
                                        data: 'dummy_audio_base64',
                                        mimeType: 'audio/wav'
                                    }
                                }]
                            }
                        }]
                    })
                }
            };

            // Mock playAudio to avoid AudioContext dependency
            adapter.playAudio = async () => {};

            const sensitiveText = "SECRET_TTS_MESSAGE";

            await adapter.speak(sensitiveText);

            // Check logs
            const logContent = logs.join('\n');
            // Check for redacted logs
            // console.log(`🔊 GeminiTTS: Processing queue item (length: ${task.text.length})`);
            // console.log(`🔊 GeminiTTS: [Fetch] Generating audio (length: ${text.length}, Active: ${this.activeRequests})`);

            assert.ok(logContent.includes(`Processing queue item (length: ${sensitiveText.length})`), 'Should log redacted queue item message');
            assert.ok(logContent.includes(`Generating audio (length: ${sensitiveText.length}`), 'Should log redacted generation message');

            // Check for absence of sensitive text
            assert.ok(!logContent.includes(sensitiveText), 'Should NOT log sensitive TTS text');

        } finally {
            console.log = originalLog;
        }
    });
});
