
import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';

describe('GeminiLiveAdapter Connect Configuration', () => {
    it('should build correct configuration with defaults', async () => {
        const connectMock = mock.fn(async () => ({
            conn: { _ws: { readyState: 1, send: mock.fn(), close: mock.fn() } }
        }));

        class MockGoogleGenAI {
            constructor() {
                this.live = {
                    connect: connectMock
                };
            }
        }

        const adapter = new GeminiLiveAdapter({
            apiKey: 'test-key',
            GoogleGenAIClass: MockGoogleGenAI
        });

        await adapter.connect();

        assert.strictEqual(connectMock.mock.calls.length, 1);
        const call = connectMock.mock.calls[0];
        const config = call.arguments[0].config;

        // Default system instruction
        assert.strictEqual(config.systemInstruction, "You are a helpful assistant.");

        // Default speech config
        assert.strictEqual(config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Puck');

        // Default silence duration
        assert.strictEqual(config.realtimeInputConfig.automaticActivityDetection.silenceDurationMs, 1500);

        // Transcription defaults (undefined)
        assert.strictEqual(config.inputAudioTranscription, undefined);
        assert.strictEqual(config.outputAudioTranscription, undefined);
    });

    it('should build correct configuration with provided options', async () => {
        const connectMock = mock.fn(async () => ({
            conn: { _ws: { readyState: 1, send: mock.fn(), close: mock.fn() } }
        }));

        class MockGoogleGenAI {
            constructor() {
                this.live = {
                    connect: connectMock
                };
            }
        }

        const adapter = new GeminiLiveAdapter({
            apiKey: 'test-key',
            GoogleGenAIClass: MockGoogleGenAI,
            systemInstruction: 'Custom instruction',
            voice: 'Fenrir',
            silenceDuration: 2000,
            inputTranscription: true,
            outputTranscription: true,
            affectiveDialog: true,
            thinkingBudget: 100
        });

        await adapter.connect();

        assert.strictEqual(connectMock.mock.calls.length, 1);
        const call = connectMock.mock.calls[0];
        const config = call.arguments[0].config;

        assert.strictEqual(config.systemInstruction, 'Custom instruction');
        assert.strictEqual(config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Fenrir');
        assert.strictEqual(config.realtimeInputConfig.automaticActivityDetection.silenceDurationMs, 2000);
        assert.deepStrictEqual(config.inputAudioTranscription, {});
        assert.deepStrictEqual(config.outputAudioTranscription, {});
        assert.strictEqual(config.enableAffectiveDialog, true);
        assert.strictEqual(config.thinkingConfig.budgetTokenCount, 100);
    });
});
