
import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';
import { GeminiFlashAdapter } from '../lib/api/adapters/GeminiFlashAdapter.js';

describe('Sensitive Data Logging Vulnerability', () => {
    it('should NOT log sensitive transcription data in GeminiLiveAdapter', () => {
        // Mock console.log
        const originalLog = console.log;
        const logMock = mock.fn();
        console.log = logMock;

        try {
            const adapter = new GeminiLiveAdapter({ apiKey: 'fake-key' });
            const sensitiveInput = "My secret password is 12345";
            const sensitiveOutput = "I have noted your secret password.";

            // Simulate incoming message with sensitive data
            const message = {
                serverContent: {
                    inputTranscription: sensitiveInput,
                    outputTranscription: sensitiveOutput
                }
            };

            adapter.handleIncomingMessage(message);

            // Check calls to console.log
            const calls = logMock.mock.calls;
            let sensitiveDataFound = false;

            for (const call of calls) {
                const args = call.arguments.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
                if (args.includes(sensitiveInput) || args.includes(sensitiveOutput)) {
                    sensitiveDataFound = true;
                    break;
                }
            }

            assert.strictEqual(sensitiveDataFound, false, 'Sensitive transcription data was leaked to console.log in GeminiLiveAdapter!');

        } finally {
            console.log = originalLog;
        }
    });

    it('should NOT log sensitive transcription data in GeminiFlashAdapter', async () => {
        // Mock console.log
        const originalLog = console.log;
        const logMock = mock.fn();
        console.log = logMock;

        try {
            const sensitiveTranscript = "My secret credit card is 4111";
            const sensitiveResponse = "I have received your credit card.";

            // Mock GoogleGenAI class and client
            const mockGenerateContentStream = mock.fn(async function* () {
                yield { text: `TRANSCRIPT: ${sensitiveTranscript}\n` };
                yield { text: `RESPONSE: ${sensitiveResponse}` };
            });

            const MockGoogleGenAI = class {
                constructor() {
                    this.models = {
                        generateContentStream: mockGenerateContentStream
                    };
                }
            };

            // Mock TTS Factory to avoid errors
            const MockTTSFactory = {
                createAdapter: () => ({
                    speak: mock.fn(),
                    stop: mock.fn()
                })
            };

            const adapter = new GeminiFlashAdapter({
                apiKey: 'fake-key',
                GoogleGenAIClass: MockGoogleGenAI,
                TTSFactoryClass: MockTTSFactory
            });

            await adapter.connect();
            await adapter.sendAudioToFlash('fake-base64-audio');

            // Check calls to console.log
            const calls = logMock.mock.calls;
            let sensitiveDataFound = false;

            for (const call of calls) {
                const args = call.arguments.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
                if (args.includes(sensitiveTranscript) || args.includes(sensitiveResponse)) {
                    sensitiveDataFound = true;
                    break;
                }
            }

            assert.strictEqual(sensitiveDataFound, false, 'Sensitive transcription data was leaked to console.log in GeminiFlashAdapter!');

        } finally {
            console.log = originalLog;
        }
    });
});
