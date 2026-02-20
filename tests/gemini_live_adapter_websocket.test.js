
import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';

describe('GeminiLiveAdapter WebSocket Hack', () => {
    class MockGoogleGenAI {
        constructor() {
            this.live = {
                connect: async () => ({
                    // Start empty, tests will override
                    conn: {},
                    sendRealtimeInput: mock.fn(),
                })
            };
        }
    }

    it('should use direct WebSocket (via conn._ws) if available in sendImage', async () => {
        const adapter = new GeminiLiveAdapter({ apiKey: 'test', GoogleGenAIClass: MockGoogleGenAI });
        await adapter.connect();

        const mockWs = {
            readyState: 1, // OPEN
            send: mock.fn()
        };
        adapter.session.conn = { _ws: mockWs };

        await adapter.sendImage('base64data');

        assert.strictEqual(mockWs.send.mock.calls.length, 1);
        const sentMessage = JSON.parse(mockWs.send.mock.calls[0].arguments[0]);
        assert.deepStrictEqual(sentMessage.realtimeInput.mediaChunks[0].data, 'base64data');

        // Should not use SDK fallback
        assert.strictEqual(adapter.session.sendRealtimeInput.mock.calls.length, 0);
    });

    it('should use direct WebSocket (via conn.ws) if available in sendImage', async () => {
        const adapter = new GeminiLiveAdapter({ apiKey: 'test', GoogleGenAIClass: MockGoogleGenAI });
        await adapter.connect();

        const mockWs = {
            readyState: 1, // OPEN
            send: mock.fn()
        };
        adapter.session.conn = { ws: mockWs };

        await adapter.sendImage('base64data');

        assert.strictEqual(mockWs.send.mock.calls.length, 1);
    });

    it('should use direct WebSocket (via conn itself) if available in sendImage', async () => {
        const adapter = new GeminiLiveAdapter({ apiKey: 'test', GoogleGenAIClass: MockGoogleGenAI });
        await adapter.connect();

        const mockWs = {
            readyState: 1, // OPEN
            send: mock.fn()
        };
        adapter.session.conn = mockWs; // conn IS the ws

        await adapter.sendImage('base64data');

        assert.strictEqual(mockWs.send.mock.calls.length, 1);
    });

    it('should fallback to SDK sendRealtimeInput if WebSocket is not found', async () => {
        const adapter = new GeminiLiveAdapter({ apiKey: 'test', GoogleGenAIClass: MockGoogleGenAI });
        await adapter.connect();

        // No ws in session.conn
        adapter.session.conn = {};

        await adapter.sendImage('base64data');

        // Should use SDK fallback
        assert.strictEqual(adapter.session.sendRealtimeInput.mock.calls.length, 1);
        const args = adapter.session.sendRealtimeInput.mock.calls[0].arguments[0];
        assert.deepStrictEqual(args.mediaChunks[0].data, 'base64data');
    });

    it('should fallback to SDK sendRealtimeInput if WebSocket is not OPEN', async () => {
        const adapter = new GeminiLiveAdapter({ apiKey: 'test', GoogleGenAIClass: MockGoogleGenAI });
        await adapter.connect();

        const mockWs = {
            readyState: 0, // CONNECTING (not OPEN)
            send: mock.fn()
        };
        adapter.session.conn = { _ws: mockWs };

        await adapter.sendImage('base64data');

        // Should use SDK fallback because ws is not OPEN
        assert.strictEqual(adapter.session.sendRealtimeInput.mock.calls.length, 1);
        assert.strictEqual(mockWs.send.mock.calls.length, 0);
    });

    it('should try to close WebSocket in disconnect if found', async () => {
        const adapter = new GeminiLiveAdapter({ apiKey: 'test', GoogleGenAIClass: MockGoogleGenAI });
        await adapter.connect();

        const mockWs = {
            readyState: 1,
            close: mock.fn()
        };
        adapter.session.conn = { _ws: mockWs };

        adapter.disconnect();

        assert.strictEqual(mockWs.close.mock.calls.length, 1);
        assert.strictEqual(adapter.session, null);
    });
});
