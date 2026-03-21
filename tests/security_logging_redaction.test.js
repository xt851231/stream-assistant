import { test } from 'node:test';
import assert from 'node:assert';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';
import { GeminiFlashAdapter } from '../lib/api/adapters/GeminiFlashAdapter.js';
import { BrowserTTSAdapter } from '../lib/api/tts/adapters/BrowserTTSAdapter.js';

test('GeminiLiveAdapter should redact transcription logs', (t) => {
    const originalLog = console.log;
    let logContent = '';
    console.log = (...args) => {
        logContent += args.join(' ') + '\n';
    };

    const adapter = new GeminiLiveAdapter({ apiKey: 'test' });
    const sensitiveText = "SECRET_PASSWORD_123";
    const message = { serverContent: { inputTranscription: sensitiveText, outputTranscription: sensitiveText } };

    adapter.handleIncomingMessage(message);

    console.log = originalLog;
    assert.ok(!logContent.includes(sensitiveText), 'Should NOT log sensitive transcription text');
});

test('BrowserTTSAdapter should redact transcription logs', async (t) => {
    // Mock window and SpeechSynthesis for Node environment
    global.window = {
        speechSynthesis: {
            speak: (utterance) => { setTimeout(() => utterance.onend(), 10); },
            getVoices: () => []
        }
    };
    global.SpeechSynthesisUtterance = class {
        constructor(text) { this.text = text; }
        onend() { }
    };

    const originalLog = console.log;
    let logContent = '';
    console.log = (...args) => {
        logContent += args.join(' ') + '\n';
    };

    const adapter = new BrowserTTSAdapter({});
    const sensitiveText = "SECRET_PASSWORD_123";

    // Using a mock to bypass actual speech synthesis in tests
    adapter.synthesis = {
        speak: (utterance) => { utterance.onend(); },
        getVoices: () => []
    };

    await adapter.speak(sensitiveText);

    console.log = originalLog;
    assert.ok(!logContent.includes(sensitiveText), 'Should NOT log sensitive speaking text');
});

test('GeminiLiveAdapter should redact systemInstruction from connectConfig log', async (t) => {
    const originalLog = console.log;
    let logContent = '';
    console.log = (...args) => {
        logContent += args.join(' ') + '\n';
    };

    const sensitiveInstruction = "SECRET_SYSTEM_INSTRUCTION_123";
    const adapter = new GeminiLiveAdapter({
        apiKey: 'test',
        systemInstruction: sensitiveInstruction,
        GoogleGenAIClass: class {
            constructor() {
                this.live = {
                    connect: async () => ({})
                };
            }
        }
    });

    await adapter.connect();

    console.log = originalLog;
    assert.ok(!logContent.includes(sensitiveInstruction), 'Should NOT log sensitive systemInstruction text');
});
