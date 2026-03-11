import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { QwenOmniAdapter } from '../lib/api/adapters/QwenOmniAdapter.js';

// Mock WebSocket globally for the test
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        this.sendCalledWith = [];
        this.closeCalled = false;
        this.onopen = null;
        this.onclose = null;
        this.timer = null;

        // Auto-open for simple tests
        this.timer = setTimeout(() => {
            if (!this.closeCalled) {
                this.readyState = MockWebSocket.OPEN;
                if (this.onopen) this.onopen();
            }
        }, 50);
    }

    send(data) {
        if (this.readyState !== MockWebSocket.OPEN) {
            throw new Error('Cannot send on non-OPEN WebSocket');
        }
        this.sendCalledWith.push(data);
    }

    close() {
        this.closeCalled = true;
        this.readyState = MockWebSocket.CLOSED;
        if (this.timer) clearTimeout(this.timer);
        if (this.onclose) this.onclose({ code: 1000 });
    }

    addEventListener(event, handler) {
        if (event === 'open') this.onopen = handler;
        if (event === 'close') this.onclose = handler;
    }
}

globalThis.WebSocket = MockWebSocket;

/** Helper: get parsed session.update payload from ws send calls */
function getSessionUpdate(ws) {
    const raw = ws.sendCalledWith.find(s => JSON.parse(s).type === 'session.update');
    return raw ? JSON.parse(raw) : null;
}

describe('QwenOmniAdapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new QwenOmniAdapter({
            apiKey: 'test-key',
            modelId: 'qwen3-omni-flash-realtime',
            inputTranscription: true,
            outputTranscription: true,
        });
    });

    // ─── Existing tests ────────────────────────────────

    test('should emit setup_complete only once for multiple session events', async () => {
        let setupCount = 0;
        adapter.on('content', (msg) => {
            if (msg.type === 'setup_complete') setupCount++;
        });

        await adapter.connect();

        adapter.handleIncomingMessage(JSON.stringify({ type: 'session.created' }));
        adapter.handleIncomingMessage(JSON.stringify({ type: 'session.updated' }));

        assert.strictEqual(setupCount, 1, 'setup_complete should be emitted exactly once');
        adapter.disconnect();
    });

    test('should handle disconnect in CONNECTING state correctly', async () => {
        let closedTriggered = false;
        adapter.on('close', () => { closedTriggered = true; });

        adapter.connect();

        const wsInstance = adapter.ws;
        assert.strictEqual(wsInstance.readyState, MockWebSocket.CONNECTING, 'Should be in connecting state');

        adapter.disconnect();

        assert.ok(closedTriggered, 'close event should be triggered');
        assert.strictEqual(adapter.ws, null, 'ws reference should be cleared');
        assert.ok(wsInstance.closeCalled, 'ws.close() should have been called even in connecting state');
    });

    test('should avoid sending conflicting temperature/topP params', async () => {
        adapter.config.temperature = 0.7;
        adapter.config.topP = 0.95;

        await adapter.connect();

        const updateMsg = getSessionUpdate(adapter.ws);

        assert.notStrictEqual(updateMsg.session.temperature, undefined, 'Temperature should be set');
        assert.strictEqual(updateMsg.session.top_p, undefined, 'top_p should be omitted when temperature is set');
        adapter.disconnect();
    });

    // ─── New tests: session.update payload structure ───

    test('should include input_audio_transcription in session.update when enabled', async () => {
        await adapter.connect();
        const updateMsg = getSessionUpdate(adapter.ws);

        assert.ok(updateMsg.session.input_audio_transcription, 'input_audio_transcription should be present');
        assert.strictEqual(
            updateMsg.session.input_audio_transcription.model,
            'gummy-realtime-v1',
            'transcription model should be gummy-realtime-v1'
        );
        adapter.disconnect();
    });

    test('should include smooth_output: true in session.update', async () => {
        await adapter.connect();
        const updateMsg = getSessionUpdate(adapter.ws);

        assert.strictEqual(updateMsg.session.smooth_output, true, 'smooth_output should be true');
        adapter.disconnect();
    });

    test('should include modalities, input_audio_format, output_audio_format', async () => {
        await adapter.connect();
        const updateMsg = getSessionUpdate(adapter.ws);

        assert.deepStrictEqual(
            updateMsg.session.modalities,
            ['text', 'audio'],
            'modalities should be ["text", "audio"]'
        );
        assert.strictEqual(updateMsg.session.input_audio_format, 'pcm16', 'input format should be pcm16');
        assert.strictEqual(updateMsg.session.output_audio_format, 'pcm24', 'output format should be pcm24');
        adapter.disconnect();
    });

    test('should include VAD threshold and prefix_padding_ms in turn_detection', async () => {
        adapter.config.silenceDuration = 600;
        adapter.config.prefixPadding = 400;

        await adapter.connect();
        const updateMsg = getSessionUpdate(adapter.ws);

        const td = updateMsg.session.turn_detection;
        assert.strictEqual(td.type, 'server_vad');
        assert.strictEqual(td.threshold, 0.5, 'VAD threshold should be 0.5');
        assert.strictEqual(td.silence_duration_ms, 600, 'silence_duration_ms should use config value');
        assert.strictEqual(td.prefix_padding_ms, 400, 'prefix_padding_ms should use config value');
        adapter.disconnect();
    });

    test('should include repetition_penalty in session.update', async () => {
        await adapter.connect();
        const updateMsg = getSessionUpdate(adapter.ws);

        assert.strictEqual(updateMsg.session.repetition_penalty, 1.05, 'repetition_penalty should be 1.05');
        adapter.disconnect();
    });

    test('should NOT include max_tokens in session.update', async () => {
        await adapter.connect();
        const updateMsg = getSessionUpdate(adapter.ws);

        assert.strictEqual(updateMsg.session.max_tokens, undefined, 'max_tokens should be omitted');
        adapter.disconnect();
    });

    test('should combine systemInstruction and modelInstruction in session.update', async () => {
        adapter.config.systemInstruction = "Test persona override.";
        adapter.config.provider = 'qwen-omni';

        await adapter.connect();
        const updateMsg = getSessionUpdate(adapter.ws);

        assert.ok(updateMsg.session.instructions.includes("Test persona override."), "Should contain user instruction");
        assert.ok(updateMsg.session.instructions.includes("participant in a live voice dialogue"), "Should contain registry instruction");
        assert.ok(updateMsg.session.instructions.includes("\n\n"), "Should be separated by double newline");

        adapter.disconnect();
    });

    // ─── New tests: input transcription event handling ──

    test('should emit input_transcription for conversation.item.input_audio_transcription.completed', async () => {
        let received = null;
        adapter.on('content', (msg) => {
            if (msg.type === 'input_transcription') received = msg;
        });

        await adapter.connect();

        adapter.handleIncomingMessage(JSON.stringify({
            type: 'conversation.item.input_audio_transcription.completed',
            item_id: 'item_123',
            content_index: 0,
            transcript: 'Hello, world!'
        }));

        assert.ok(received, 'input_transcription event should be emitted');
        assert.strictEqual(received.data.text, 'Hello, world!');
        assert.strictEqual(received.data.finished, true);
        adapter.disconnect();
    });

    test('should emit interrupted for speech_started ONLY when model is responding', async () => {
        let interruptedCount = 0;
        adapter.on('content', (msg) => {
            if (msg.type === 'interrupted') interruptedCount++;
        });

        await adapter.connect();

        // speech_started when model is idle → should NOT emit interrupted
        adapter.handleIncomingMessage(JSON.stringify({
            type: 'input_audio_buffer.speech_started',
            audio_start_ms: 1000,
            item_id: 'item_idle'
        }));
        assert.strictEqual(interruptedCount, 0, 'Should not interrupt when model is idle');

        // Simulate model responding (audio.delta sets _isModelResponding = true)
        adapter.handleIncomingMessage(JSON.stringify({
            type: 'response.audio.delta',
            delta: 'AAAA' // minimal base64
        }));

        // speech_started when model IS responding → SHOULD emit interrupted
        adapter.handleIncomingMessage(JSON.stringify({
            type: 'input_audio_buffer.speech_started',
            audio_start_ms: 2000,
            item_id: 'item_active'
        }));
        assert.strictEqual(interruptedCount, 1, 'Should interrupt when model is actively responding');

        adapter.disconnect();
    });

    test('should not crash on conversation.item.input_audio_transcription.failed', async () => {
        await adapter.connect();

        // Should not throw
        adapter.handleIncomingMessage(JSON.stringify({
            type: 'conversation.item.input_audio_transcription.failed',
            item_id: 'item_789',
            content_index: 0,
            error: { code: 'asr_error', message: 'Failed to transcribe' }
        }));

        assert.ok(true, 'No crash');
        adapter.disconnect();
    });

    test('should pass audio data through unchanged (pcm24 = 24kHz 16-bit, not 24-bit depth)', async () => {
        let audioData = null;
        adapter.on('content', (msg) => {
            if (msg.type === 'audio') audioData = msg;
        });

        await adapter.connect();

        const testDelta = 'SGVsbG8gV29ybGQ='; // arbitrary base64
        adapter.handleIncomingMessage(JSON.stringify({
            type: 'response.audio.delta',
            delta: testDelta
        }));

        assert.ok(audioData, 'audio event should be emitted');
        assert.strictEqual(audioData.data, testDelta, 'audio data should pass through unchanged');
        adapter.disconnect();
    });
});
