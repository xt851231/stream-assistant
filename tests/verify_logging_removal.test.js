
import { test, describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';
import { GeminiFlashAdapter } from '../lib/api/adapters/GeminiFlashAdapter.js';
import { GeminiTTSAdapter } from '../lib/api/tts/adapters/GeminiTTSAdapter.js';

describe('Verify Logging Removal', () => {
    let consoleLogMock;
    let originalConsoleLog;

    beforeEach(() => {
        originalConsoleLog = console.log;
        consoleLogMock = mock.fn();
        console.log = consoleLogMock;
    });

    afterEach(() => {
        console.log = originalConsoleLog;
    });

    it('GeminiLiveAdapter should not log input/output transcription', () => {
        const adapter = new GeminiLiveAdapter({ apiKey: 'test' });

        // Mock emit
        adapter.emit = mock.fn();

        const message = {
            serverContent: {
                inputTranscription: { text: 'SENSITIVE_INPUT' },
                outputTranscription: { text: 'SENSITIVE_OUTPUT' }
            }
        };

        adapter.handleIncomingMessage(message);

        const calls = consoleLogMock.mock.calls.map(c => c.arguments.join(' '));
        const joinedLogs = calls.join('\n');

        assert.ok(!joinedLogs.includes('SENSITIVE_INPUT'), 'Should not log input transcription');
        assert.ok(!joinedLogs.includes('SENSITIVE_OUTPUT'), 'Should not log output transcription');
        assert.ok(!joinedLogs.includes('Parsed Transcript'), 'Should not log parsed transcript');
    });

    it('GeminiFlashAdapter should not log full audio response text', async () => {
        // Mock GoogleGenAI and TTS
        class MockGoogleGenAI {
            constructor() {
                this.models = {
                    generateContentStream: async function* () {
                        yield { text: 'TRANSCRIPT: SENSITIVE_TRANSCRIPT\nRESPONSE: SENSITIVE_RESPONSE' };
                    }
                };
            }
        }

        const mockTTS = { speak: mock.fn(), stop: mock.fn() };
        const MockTTSFactory = { createAdapter: () => mockTTS };

        const adapter = new GeminiFlashAdapter({
            apiKey: 'test',
            GoogleGenAIClass: MockGoogleGenAI,
            TTSFactoryClass: MockTTSFactory
        });

        adapter.emit = mock.fn();
        await adapter.connect();

        // Trigger sendAudioToFlash logic (mocking history/etc not needed strictly if we just call the method or simulate flow)
        // But since sendAudioToFlash is internal-ish, let's call it if possible or simulate sendText which uses similar logic?
        // Actually sendAudioToFlash is async.

        // Let's call sendAudioToFlash directly
        await adapter.sendAudioToFlash('base64wav');

        const calls = consoleLogMock.mock.calls.map(c => c.arguments.join(' '));
        const joinedLogs = calls.join('\n');

        assert.ok(!joinedLogs.includes('SENSITIVE_TRANSCRIPT'), 'Should not log transcript');
        // We expect it might log length, but not the text SENSITIVE_RESPONSE
        // Wait, the code was: console.log("🎤 Flash: Audio response received (length: " + fullText.length + ")");
        // So it should NOT contain "SENSITIVE_RESPONSE"
        assert.ok(!joinedLogs.includes('SENSITIVE_RESPONSE'), 'Should not log response text');
    });

    it('GeminiTTSAdapter should not log full text', async () => {
        const adapter = new GeminiTTSAdapter({ apiKey: 'test' });
        adapter.fetchAudio = mock.fn(async () => ({ base64Audio: 'audio', mimeType: 'audio/mp3' }));
        adapter.playAudio = mock.fn(async () => {});

        const sensitiveText = "This is a very sensitive text that should not be logged completely.";

        await adapter.speak(sensitiveText);

        const calls = consoleLogMock.mock.calls.map(c => c.arguments.join(' '));
        const joinedLogs = calls.join('\n');

        assert.ok(!joinedLogs.includes(sensitiveText), 'Should not log full text');
        assert.ok(joinedLogs.includes(`length: ${sensitiveText.length}`), 'Should log length');
    });
});
