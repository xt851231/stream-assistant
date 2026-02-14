
import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { GeminiFlashAdapter } from '../lib/api/adapters/GeminiFlashAdapter.js';

describe('GeminiFlashAdapter Mid-Session Updates', () => {
    it('should use updated system instructions in the next request', async () => {
        const generateContentStreamMock = mock.fn(async function* () {
            yield { text: () => 'Ay ay captain!' };
        });

        class MockGoogleGenAI {
            constructor(config) {
                this.apiKey = config.apiKey;
                this.models = {
                    generateContentStream: generateContentStreamMock
                };
            }
        }

        // Mock TTS
        const mockTTS = {
            speak: mock.fn(),
            stop: mock.fn()
        };
        const createAdapterMock = mock.fn(() => mockTTS);
        const MockTTSFactory = {
            createAdapter: createAdapterMock
        };

        const adapter = new GeminiFlashAdapter({
            apiKey: 'test-key',
            GoogleGenAIClass: MockGoogleGenAI,
            TTSFactoryClass: MockTTSFactory
        });

        await adapter.connect();

        // 1. Send first message
        await adapter.sendText('Hello');

        // 2. Update instructions
        const newInstructions = 'You are a pirate.';
        adapter.updateConfig({ systemInstructions: newInstructions });

        // 3. Send second message
        await adapter.sendText('Status report');

        // Verify second call config
        assert.strictEqual(generateContentStreamMock.mock.calls.length, 2);
        const secondCallArgs = generateContentStreamMock.mock.calls[1].arguments[0];

        assert.strictEqual(secondCallArgs.config.systemInstruction, newInstructions, 'System instruction should be updated in the second request');
    });

    it('should recreate TTS adapter when voice changes', async () => {
        const generateContentStreamMock = mock.fn(async function* () {
            yield { text: () => 'Ok' };
        });

        class MockGoogleGenAI {
            constructor(config) {
                this.apiKey = config.apiKey;
                this.models = {
                    generateContentStream: generateContentStreamMock
                };
            }
        }

        const mockStop = mock.fn();
        const mockTTS = {
            speak: mock.fn(),
            stop: mockStop
        };
        const createAdapterMock = mock.fn(() => mockTTS);
        const MockTTSFactory = {
            createAdapter: createAdapterMock
        };

        const adapter = new GeminiFlashAdapter({
            apiKey: 'test-key',
            GoogleGenAIClass: MockGoogleGenAI,
            TTSFactoryClass: MockTTSFactory
        });

        await adapter.connect();

        // Initially created once
        assert.strictEqual(createAdapterMock.mock.calls.length, 1);

        // Update voice
        adapter.updateConfig({ voice: 'Fenrir' });

        // Should have called stop on old TTS
        assert.strictEqual(mockStop.mock.calls.length, 1, 'Should stop previous TTS');

        // Should have created new TTS adapter
        assert.strictEqual(createAdapterMock.mock.calls.length, 2, 'Should create new TTS adapter');
        const secondCallArgs = createAdapterMock.mock.calls[1].arguments;
        assert.strictEqual(secondCallArgs[1].voice, 'Fenrir', 'Should pass new voice in config');
    });
});
