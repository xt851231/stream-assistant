import test from 'node:test';
import assert from 'node:assert';
import { ModelClient } from '../lib/api/ModelClient.js';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';

test('GeminiLiveAdapter parses Context Window Compression and GoAway', () => {
    const mockConfig = {
        sessionHandle: "abc-123",
        inputTranscription: true
    };
    
    const adapter = new GeminiLiveAdapter(mockConfig);
    const connectConfig = adapter._buildConnectConfig();
    
    // 1. Verify Compression is enabled
    assert.deepStrictEqual(connectConfig.contextWindowCompression, { slidingWindow: {} }, 'Context window compression is missing');
    
    // 2. Verify Session handle is tracked
    assert.strictEqual(connectConfig.sessionResumption.handle, "abc-123", "Session handle lost");

    // 3. Verify GoAway extraction
    let emittedGoAway = null;
    adapter.on('content', (msg) => {
        if (msg.type === 'go_away') emittedGoAway = msg.data;
    });

    adapter.handleIncomingMessage({
        goAway: {
            timeLeft: "42s"
        }
    });

    assert.deepStrictEqual(emittedGoAway, { timeLeft: "42s" }, 'GoAway signal was not parsed or emitted correctly');
});
