
import { test, describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GeminiFlashAdapter } from '../lib/api/adapters/GeminiFlashAdapter.js';

describe('GeminiFlashAdapter Refactor Verification', () => {
    let adapter;
    let generateContentStreamMock;
    let mockTTS;
    let createAdapterMock;

    beforeEach(async () => {
        // Mock GoogleGenAI
        generateContentStreamMock = mock.fn(async function* () {
            // Default mock response
            yield { text: 'TRANSCRIPT: Hello world\nRESPONSE: Hi there!' };
        });

        class MockGoogleGenAI {
            constructor(config) {
                this.apiKey = config.apiKey;
                this.models = {
                    generateContentStream: generateContentStreamMock
                };
            }
        }

        // Mock TTS
        mockTTS = {
            speak: mock.fn(async () => {}), // Returns promise
            stop: mock.fn()
        };
        createAdapterMock = mock.fn(() => mockTTS);
        const MockTTSFactory = {
            createAdapter: createAdapterMock
        };

        adapter = new GeminiFlashAdapter({
            apiKey: 'test-key',
            GoogleGenAIClass: MockGoogleGenAI,
            TTSFactoryClass: MockTTSFactory
        });

        await adapter.connect();
    });

    it('should successfully send audio and parse transcript/response', async () => {
        // Setup mock stream chunks for audio response
        generateContentStreamMock.mock.mockImplementation(async function* () {
            yield { text: 'TRANSCRIPT: How are you?\n' };
            yield { text: 'RESPONSE: I am doing well.' };
        });

        const emittedEvents = [];
        adapter.on('content', (event) => emittedEvents.push(event));

        await adapter.sendAudioToFlash('base64wavdata');

        // Check that generateContentStream was called with correct model
        assert.strictEqual(generateContentStreamMock.mock.calls.length, 1);
        const callArgs = generateContentStreamMock.mock.calls[0].arguments[0];
        assert.strictEqual(callArgs.model, 'gemini-2.5-flash');

        // Check prompt structure for audio
        const lastContent = callArgs.contents[callArgs.contents.length - 1];
        assert.strictEqual(lastContent.role, 'user');
        // Expect 2 parts: audio + text prompt (image is optional)
        assert.strictEqual(lastContent.parts.length, 2);
        assert.ok(lastContent.parts[1].text.includes('TRANSCRIPT:'), 'Prompt should include transcription instruction');

        // Verify parsing logic
        // 1. Transcription event
        const transcriptionEvent = emittedEvents.find(e => e.type === 'input_transcription');
        assert.ok(transcriptionEvent, 'Should emit input_transcription event');
        assert.strictEqual(transcriptionEvent.data.text, 'How are you?');

        // 2. Response text event
        const textEvent = emittedEvents.find(e => e.type === 'text' && !e.endOfTurn);
        assert.ok(textEvent, 'Should emit text event');
        assert.strictEqual(textEvent.data, ' I am doing well.');

        // 3. TTS call
        assert.strictEqual(mockTTS.speak.mock.calls.length, 1);
        assert.strictEqual(mockTTS.speak.mock.calls[0].arguments[0], 'I am doing well.');
    });

    it('should successfully send text and speak response', async () => {
        // Setup mock stream chunks for text response
        generateContentStreamMock.mock.mockImplementation(async function* () {
            yield { text: 'Hello user.' };
        });

        const emittedEvents = [];
        adapter.on('content', (event) => emittedEvents.push(event));

        await adapter.sendText('Hi computer');

        // Check call args
        const callArgs = generateContentStreamMock.mock.calls[0].arguments[0];
        const lastContent = callArgs.contents[callArgs.contents.length - 1];
        assert.strictEqual(lastContent.parts[0].text, 'Hi computer');

        // Verify parsing logic (simpler for text)
        // No transcription event expected for sendText
        const transcriptionEvent = emittedEvents.find(e => e.type === 'input_transcription');
        assert.strictEqual(transcriptionEvent, undefined, 'Should NOT emit input_transcription event for sendText');

        // Response text event
        const textEvent = emittedEvents.find(e => e.type === 'text' && !e.endOfTurn);
        assert.strictEqual(textEvent.data, 'Hello user.');

        // TTS call
        assert.strictEqual(mockTTS.speak.mock.calls.length, 1);
        assert.strictEqual(mockTTS.speak.mock.calls[0].arguments[0], 'Hello user.');
    });

    it('should handle missing transcription marker gracefully in sendAudioToFlash', async () => {
        // Response without TRANSCRIPT: marker
        generateContentStreamMock.mock.mockImplementation(async function* () {
            yield { text: 'Direct response only.' };
        });

        const emittedEvents = [];
        adapter.on('content', (event) => emittedEvents.push(event));

        await adapter.sendAudioToFlash('base64wavdata');

        // Verify fallback behavior
        const transcriptionEvent = emittedEvents.find(e => e.type === 'input_transcription');
        assert.strictEqual(transcriptionEvent, undefined, 'Should not emit transcription if marker missing');

        // Should still emit text? Current implementation logs warning and adds to history,
        // but looking at code:
        // if (transcription) ... else ... responseText = fullText
        // Then: emits 'text' with empty data and endOfTurn: true.
        // Wait, looking at code:
        // It loops over chunks. Parsing happens inside loop: if (fullText.includes("RESPONSE:")) ...
        // If "RESPONSE:" is missing, `responseText` remains empty string!
        // So `emit('content', { type: 'text', data: newContent })` is NEVER called if "RESPONSE:" is missing in the loop logic.
        // However, after the loop:
        // if (transcription) ... else ... responseText = fullText.
        // But `emit` for text content happens INSIDE the loop only?
        // Let's check the code:
        // Inside loop: checks for "RESPONSE:". If found, emits text.
        // If not found, nothing emitted.
        // After loop:
        // emits endOfTurn.
        // So the user sees NOTHING if "RESPONSE:" is missing?
        // Let's verify this behavior.

        // Actually, let's verify what the code DOES now, so we preserve it or fix it if it's broken but "expected".
        // Code says: `if (fullText.includes("RESPONSE:"))` -> emit text.
        // So if response doesn't have "RESPONSE:", no text is emitted to UI during streaming.
        // But `this.emit('content', { type: 'text', data: "", endOfTurn: true });` is called at end.

        // This test confirms current behavior (even if buggy/suboptimal).
        const textEvents = emittedEvents.filter(e => e.type === 'text' && !e.endOfTurn);
        assert.strictEqual(textEvents.length, 0, 'Currently emits no text events if RESPONSE marker is missing');

        // However, history is updated with fullText
        const lastHistory = adapter.history[adapter.history.length - 1];
        assert.strictEqual(lastHistory.parts[0].text, 'Direct response only.');
    });
});
