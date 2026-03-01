import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SpeechAudioContext } from '../lib/utils/SpeechAudioContext.js';

describe('Audio Output Routing via setSinkId', () => {

    beforeEach(() => {
        // Reset singleton
        SpeechAudioContext.audioContext = null;
        SpeechAudioContext.gainNode = null;
        SpeechAudioContext.systemGainNode = null;
    });

    test('should call setSinkId when a device is provided', async () => {
        let sinkIdCalledWith = null;

        class MockAudioContext {
            constructor() {
                this.destination = {};
                this.state = 'suspended';
            }
            createGain() { return { gain: { value: 1 }, connect: () => { } }; }
            async setSinkId(id) {
                sinkIdCalledWith = id;
            }
        }

        globalThis.window = { AudioContext: MockAudioContext };

        await SpeechAudioContext.init();

        await SpeechAudioContext.setSinkId('virtual-cable-id-123');
        assert.strictEqual(sinkIdCalledWith, 'virtual-cable-id-123');
    });

    test('should call setSinkId with empty string when "default" is passed', async () => {
        let sinkIdCalledWith = null;

        class MockAudioContext {
            constructor() {
                this.destination = {};
                this.state = 'suspended';
            }
            createGain() { return { gain: { value: 1 }, connect: () => { } }; }
            async setSinkId(id) {
                sinkIdCalledWith = id;
            }
        }

        globalThis.window = { AudioContext: MockAudioContext };

        await SpeechAudioContext.init();

        await SpeechAudioContext.setSinkId('default');
        assert.strictEqual(sinkIdCalledWith, '');
    });

    test('should not crash if setSinkId is not supported in browser', async () => {
        class MockAudioContext {
            constructor() {
                this.destination = {};
                this.state = 'suspended';
            }
            createGain() { return { gain: { value: 1 }, connect: () => { } }; }
            // setSinkId not defined
        }

        globalThis.window = { AudioContext: MockAudioContext };

        await SpeechAudioContext.init();

        // This should run without throwing an error
        await SpeechAudioContext.setSinkId('virtual-cable-id-123');
        assert.ok(true, "Did not crash when setSinkId was undefined");
    });
});
