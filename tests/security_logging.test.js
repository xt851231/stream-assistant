
import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { ModelClient } from '../lib/api/ModelClient.js';

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
            // We need to mock GoogleGenAI because GeminiLiveAdapter constructor/connect might use it
            // But createAdapter just instantiates it.
            // GeminiLiveAdapter constructor does not use GoogleGenAI, only connect() does.
            // createAdapter returns new GeminiLiveAdapter(config).

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

            // The test should FAIL if the key is found (vulnerability exists)
            // But since this is a reproduction test, we want to confirm it fails first.
            // So we assert that keyFound is FALSE. If it is TRUE, the test fails, confirming vulnerability.
            assert.strictEqual(keyFound, false, 'API Key was leaked to console.log!');

        } finally {
            // Restore console.log
            console.log = originalLog;
        }
    });
});
