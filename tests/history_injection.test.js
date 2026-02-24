
import { test, describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';
import { GeminiFlashAdapter } from '../lib/api/adapters/GeminiFlashAdapter.js';

describe('History Injection Tests', () => {

    describe('GeminiLiveAdapter setHistory', () => {
        let adapter;
        let sendClientContentMock;

        beforeEach(() => {
            sendClientContentMock = mock.fn();

            class MockGoogleGenAI {
                constructor() {
                    this.live = {
                        connect: async () => ({
                            sendClientContent: sendClientContentMock,
                            conn: { _ws: { readyState: 1 } }
                        })
                    };
                }
            }

            adapter = new GeminiLiveAdapter({
                apiKey: 'test-key',
                GoogleGenAIClass: MockGoogleGenAI
            });
        });

        it('should correctly format and send history as a single summary turn', async () => {
            await adapter.connect();

            const history = [
                { type: 'user', sender: 'Player1', text: 'Hello' },
                { type: 'assistant', sender: 'Jules', text: 'Hi there!' }
            ];

            adapter.setHistory(history);

            assert.strictEqual(sendClientContentMock.mock.calls.length, 2);
            const call1 = sendClientContentMock.mock.calls[0];
            const call2 = sendClientContentMock.mock.calls[1];
            const expectedText = "[System Note: Previous Conversation History]\n" +
                "[Player1]: Hello\n" +
                "[Jules]: Hi there!\n" +
                "[End of Previous History, New Session Begins]";

            assert.deepStrictEqual(call1.arguments[0], {
                turns: [
                    { role: 'user', parts: [{ text: expectedText }] }
                ],
                turnComplete: false
            });
            assert.deepStrictEqual(call2.arguments[0], {
                turns: [
                    { role: 'user', parts: [{ text: 'Greetings!' }] }
                ],
                turnComplete: true
            });
        });

        it('should handle user-transcript type and default sender', async () => {
            await adapter.connect();

            const history = [
                { type: 'user-transcript', text: 'Voice command' }
            ];

            adapter.setHistory(history);

            assert.strictEqual(sendClientContentMock.mock.calls.length, 2);
            const call1 = sendClientContentMock.mock.calls[0];
            const call2 = sendClientContentMock.mock.calls[1];
            const expectedText = "[System Note: Previous Conversation History]\n" +
                "[User]: Voice command\n" +
                "[End of Previous History, New Session Begins]";

            assert.deepStrictEqual(call1.arguments[0], {
                turns: [
                    { role: 'user', parts: [{ text: expectedText }] }
                ],
                turnComplete: false
            });
            assert.deepStrictEqual(call2.arguments[0], {
                turns: [
                    { role: 'user', parts: [{ text: 'Greetings!' }] }
                ],
                turnComplete: true
            });
        });

        it('should filter out system messages', async () => {
            await adapter.connect();

            const history = [
                { type: 'system', text: 'Connected' },
                { type: 'user', sender: 'Player1', text: 'Valid message' }
            ];

            adapter.setHistory(history);

            assert.strictEqual(sendClientContentMock.mock.calls.length, 2);
            const call1 = sendClientContentMock.mock.calls[0];
            const call2 = sendClientContentMock.mock.calls[1];

            assert.strictEqual(call1.arguments[0].turns.length, 1);
            const expectedText = "[System Note: Previous Conversation History]\n" +
                "[Player1]: Valid message\n" +
                "[End of Previous History, New Session Begins]";
            assert.strictEqual(call1.arguments[0].turns[0].parts[0].text, expectedText);
            assert.strictEqual(call2.arguments[0].turns[0].parts[0].text, "Greetings!");
        });

        it('should skip history injection if sessionHandle is present', async () => {
            adapter = new GeminiLiveAdapter({
                apiKey: 'test-key',
                sessionHandle: 'existing-handle',
                GoogleGenAIClass: class {
                    constructor() {
                        this.live = { connect: async () => ({ sendClientContent: sendClientContentMock, conn: { _ws: { readyState: 1 } } }) };
                    }
                }
            });
            await adapter.connect();

            const history = [{ type: 'user', text: 'Hello' }];
            adapter.setHistory(history);

            assert.strictEqual(sendClientContentMock.mock.calls.length, 0);
        });
    });

    describe('GeminiFlashAdapter setHistory', () => {
        let adapter;

        beforeEach(() => {
            class MockTTSFactory {
                static createAdapter() { return { speak: () => { }, stop: () => { } }; }
            }
            class MockGoogleGenAI {
                constructor() { }
            }

            adapter = new GeminiFlashAdapter({
                apiKey: 'test-key',
                GoogleGenAIClass: MockGoogleGenAI,
                TTSFactoryClass: MockTTSFactory
            });
        });

        it('should correctly update internal history buffer', () => {
            const history = [
                { type: 'user', sender: 'Player1', text: 'Hello' },
                { type: 'assistant', sender: 'Echo', text: 'How can I help?' }
            ];

            adapter.setHistory(history);

            assert.strictEqual(adapter.history.length, 2);
            assert.deepStrictEqual(adapter.history[0], {
                role: 'user',
                parts: [{ text: '[Player1]: Hello' }]
            });
            assert.deepStrictEqual(adapter.history[1], {
                role: 'model',
                parts: [{ text: '[Echo]: How can I help?' }]
            });
        });
    });
});
