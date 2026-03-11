
import { test, describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';

describe('GeminiLiveAdapter Tests', () => {
    let adapter;
    let emitMock;

    beforeEach(() => {
        // Mock GoogleGenAI class
        class MockGoogleGenAI {
            constructor() {
                this.live = {
                    connect: async () => ({
                        conn: { _ws: { readyState: 1, send: mock.fn(), close: mock.fn() } }
                    })
                };
            }
        }

        adapter = new GeminiLiveAdapter({
            apiKey: 'test-key',
            GoogleGenAIClass: MockGoogleGenAI
        });

        // Mock emit method to verify events
        emitMock = mock.method(adapter, 'emit');
    });

    it('should combine systemInstruction and modelInstruction in connect config', () => {
        adapter.config.systemInstruction = "Live persona override.";
        adapter.config.provider = 'gemini-live'; // For MODEL_REGISTRY lookup

        const connectConfig = adapter._buildConnectConfig();

        assert.ok(connectConfig.systemInstruction.includes("Live persona override."), "Should contain user instruction");
        assert.ok(connectConfig.systemInstruction.includes("live voice conversation. Keep responses brief"), "Should contain registry instruction");
        assert.ok(connectConfig.systemInstruction.includes("\n\n"), "Should be separated by double newline");
    });

    it('should emit setup_complete event', () => {
        const message = { setupComplete: {} };
        adapter.handleIncomingMessage(message);

        assert.strictEqual(emitMock.mock.calls.length, 1);
        const call = emitMock.mock.calls[0];
        assert.strictEqual(call.arguments[0], 'content');
        assert.deepStrictEqual(call.arguments[1], { type: 'setup_complete' });
    });

    it('should emit tool_call event', () => {
        const toolCall = { functionCalls: [{ name: 'test_tool' }] };
        const message = { toolCall };
        adapter.handleIncomingMessage(message);

        assert.strictEqual(emitMock.mock.calls.length, 1);
        const call = emitMock.mock.calls[0];
        assert.strictEqual(call.arguments[0], 'content');
        assert.deepStrictEqual(call.arguments[1], { type: 'tool_call', data: toolCall });
    });

    it('should emit interrupted event when serverContent has interrupted flag', () => {
        const message = { serverContent: { interrupted: true } };
        adapter.handleIncomingMessage(message);

        assert.strictEqual(emitMock.mock.calls.length, 1);
        const call = emitMock.mock.calls[0];
        assert.strictEqual(call.arguments[0], 'content');
        assert.deepStrictEqual(call.arguments[1], { type: 'interrupted' });
    });

    it('should emit turn_complete event when serverContent has turnComplete flag', () => {
        const message = { serverContent: { turnComplete: true } };
        adapter.handleIncomingMessage(message);

        assert.strictEqual(emitMock.mock.calls.length, 1);
        const call = emitMock.mock.calls[0];
        assert.strictEqual(call.arguments[0], 'content');
        assert.deepStrictEqual(call.arguments[1], { type: 'turn_complete' });
    });

    it('should emit input_transcription event from serverContent', () => {
        const transcription = { text: 'hello' };
        const message = { serverContent: { inputTranscription: transcription } };
        adapter.handleIncomingMessage(message);

        assert.strictEqual(emitMock.mock.calls.length, 1);
        const call = emitMock.mock.calls[0];
        assert.strictEqual(call.arguments[0], 'content');
        assert.deepStrictEqual(call.arguments[1], { type: 'input_transcription', data: transcription });
    });

    it('should emit output_transcription event from serverContent', () => {
        const transcription = { text: 'world' };
        const message = { serverContent: { outputTranscription: transcription } };
        adapter.handleIncomingMessage(message);

        assert.strictEqual(emitMock.mock.calls.length, 1);
        const call = emitMock.mock.calls[0];
        assert.strictEqual(call.arguments[0], 'content');
        assert.deepStrictEqual(call.arguments[1], { type: 'output_transcription', data: transcription });
    });

    it('should emit text content from modelTurn', () => {
        const message = {
            serverContent: {
                modelTurn: {
                    parts: [{ text: 'Hello world' }]
                },
                turnComplete: false
            }
        };
        adapter.handleIncomingMessage(message);

        assert.strictEqual(emitMock.mock.calls.length, 1);
        const call = emitMock.mock.calls[0];
        assert.strictEqual(call.arguments[0], 'content');
        assert.deepStrictEqual(call.arguments[1], {
            type: 'text',
            data: 'Hello world',
            endOfTurn: false
        });
    });

    it('should emit audio content from modelTurn', () => {
        const audioData = 'base64audio';
        const message = {
            serverContent: {
                modelTurn: {
                    parts: [{ inlineData: { mimeType: 'audio/pcm', data: audioData } }]
                },
                turnComplete: true
            }
        };
        adapter.handleIncomingMessage(message);

        assert.strictEqual(emitMock.mock.calls.length, 2);
        // 1. turn_complete (because serverContent.turnComplete is present)
        // 2. audio content

        // Wait, looking at the code:
        // if (serverContent.turnComplete) emit('turn_complete')
        // ...
        // for (const part of parts) { ... emit('audio') ... }

        // So we expect:
        // 1. content: { type: 'turn_complete' }
        // 2. content: { type: 'audio', data: 'base64audio', endOfTurn: true }

        // Let's verify calls
        const calls = emitMock.mock.calls;

        // Find turn_complete
        const turnCompleteCall = calls.find(c => c.arguments[1].type === 'turn_complete');
        assert.ok(turnCompleteCall, 'Should verify turn_complete event');

        // Find audio
        const audioCall = calls.find(c => c.arguments[1].type === 'audio');
        assert.ok(audioCall, 'Should verify audio event');
        assert.deepStrictEqual(audioCall.arguments[1], {
            type: 'audio',
            data: audioData,
            endOfTurn: true
        });
    });

    it('should ignore thought parts in modelTurn', () => {
        const message = {
            serverContent: {
                modelTurn: {
                    parts: [
                        { thought: 'I am thinking...' },
                        { text: 'Final answer' }
                    ]
                }
            }
        };
        adapter.handleIncomingMessage(message);

        // Should only emit text, not thought
        const calls = emitMock.mock.calls;
        assert.strictEqual(calls.length, 1);
        assert.deepStrictEqual(calls[0].arguments[1], {
            type: 'text',
            data: 'Final answer',
            endOfTurn: undefined // serverContent.turnComplete is undefined
        });
    });

    it('should handle top-level transcription fallback', () => {
        const inputTx = { text: 'fallback input' };
        const outputTx = { text: 'fallback output' };

        const message = {
            inputTranscription: inputTx,
            outputTranscription: outputTx
        };

        adapter.handleIncomingMessage(message);

        const calls = emitMock.mock.calls;
        assert.strictEqual(calls.length, 2);

        const inputCall = calls.find(c => c.arguments[1].type === 'input_transcription');
        assert.ok(inputCall);
        assert.deepStrictEqual(inputCall.arguments[1].data, inputTx);

        const outputCall = calls.find(c => c.arguments[1].type === 'output_transcription');
        assert.ok(outputCall);
        assert.deepStrictEqual(outputCall.arguments[1].data, outputTx);
    });
});
