
import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { ModelClient } from '../lib/api/ModelClient.js';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';

describe('Security Logging Vulnerability', () => {
    it('should NOT log the API key when creating an adapter', (t) => {
        // Mock console.log
        const originalLog = console.log;
        const logMock = mock.fn();
        console.log = logMock;

        try {
            const sensitiveConfig = {
                apiKey: 'SENSITIVE_API_KEY_12345',
                modelId: 'gemini-test',
                voice: 'Puck'
            };

            // Create adapter (using 'live' type)
            ModelClient.createAdapter('live', sensitiveConfig);

            // Check calls to console.log
            const calls = logMock.mock.calls;

            // Search for the sensitive key in all log arguments
            let keyFound = false;
            for (const call of calls) {
                for (const arg of call.arguments) {
                    const argStr = typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                    if (argStr.includes('SENSITIVE_API_KEY_12345')) {
                        keyFound = true;
                        break;
                    }
                }
                if (keyFound) break;
            }

            assert.strictEqual(keyFound, false, 'API Key was leaked to console.log!');

        } finally {
            // Restore console.log
            console.log = originalLog;
        }
    });

    it('GeminiLiveAdapter should NOT log full transcription to console', async () => {
        // Mock console.log
        const originalLog = console.log;
        const logMock = mock.fn();
        console.log = logMock;

        try {
            const config = {
                apiKey: 'test-key',
                inputTranscription: true,
                outputTranscription: true
            };

            const adapter = new GeminiLiveAdapter(config);

            // Mock message with transcription
            const sensitiveInput = "SENSITIVE_USER_INPUT_SECRET";
            const sensitiveOutput = "SENSITIVE_MODEL_OUTPUT_SECRET";

            const message = {
                serverContent: {
                    inputTranscription: { text: sensitiveInput, finished: true },
                    outputTranscription: { text: sensitiveOutput, finished: true }
                }
            };

            // Trigger handleIncomingMessage
            adapter.handleIncomingMessage(message);

            // Check logs
            const calls = logMock.mock.calls;
            let inputLeaked = false;
            let outputLeaked = false;

            for (const call of calls) {
                for (const arg of call.arguments) {
                    const argStr = typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                    if (argStr.includes(sensitiveInput)) inputLeaked = true;
                    if (argStr.includes(sensitiveOutput)) outputLeaked = true;
                }
            }

            // Assert that sensitive data was NOT found in logs
            assert.strictEqual(inputLeaked, false, 'Input transcription leaked to console!');
            assert.strictEqual(outputLeaked, false, 'Output transcription leaked to console!');

        } finally {
            console.log = originalLog;
        }
    });
});
