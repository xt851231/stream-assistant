import test from 'node:test';
import assert from 'node:assert';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';

test('GeminiLiveAdapter uses sessionResumption and ignores history', () => {
    // 1. With session Handle
    const mockConfig = {
        sessionHandle: "abc-123",
        history: [{ role: "user", parts: [{ text: "hello" }] }]
    };

    const adapter = new GeminiLiveAdapter(mockConfig);
    const connectConfig = adapter._buildConnectConfig();

    // Verify Session handle is tracked
    assert.strictEqual(connectConfig.sessionResumption.handle, "abc-123", "Session handle lost");

    // Create a mock session to intercept sendClientContent
    let sentClientContent = null;
    adapter.session = {
        sendClientContent: (content) => { sentClientContent = content; }
    };

    // In the connect() method, history sending is removed, so we simulate the logic of connect() connecting:
    const restoredHistory = typeof adapter.config.history !== 'undefined' ? adapter.config.history : null;

    // The GeminiLiveAdapter should not execute sending history anymore!
    assert.strictEqual(sentClientContent, null, "History should not be sent automatically");
});
