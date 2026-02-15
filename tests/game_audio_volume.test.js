import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

/**
 * Test: SpeechAudioContext system (game) volume control
 *
 * Verifies that setSystemVolume correctly updates the gain node value,
 * which is the path the game audio slider controls.
 */

// Mock AudioContext and GainNode since we're in Node (no Web Audio API)
class MockGainNode {
    constructor() {
        this.gain = { value: 1.0 };
    }
    connect() { }
}

class MockAudioContext {
    constructor() {
        this.state = 'running';
        this.destination = {};
    }
    createGain() {
        return new MockGainNode();
    }
    async resume() { }
}

describe('SpeechAudioContext - Game Audio Volume', () => {
    it('setSystemVolume should update systemGainNode.gain.value', async () => {
        // We need to re-import a fresh instance, so we patch globalThis
        globalThis.AudioContext = MockAudioContext;
        globalThis.window = { AudioContext: MockAudioContext };

        // Dynamic import to get the singleton
        const { SpeechAudioContext } = await import('../lib/utils/SpeechAudioContext.js');

        // Force re-init by clearing existing state
        SpeechAudioContext.audioContext = null;
        SpeechAudioContext.gainNode = null;
        SpeechAudioContext.systemGainNode = null;

        await SpeechAudioContext.init();

        // Default system volume should be 0.5 (50%)
        assert.ok(SpeechAudioContext.systemGainNode, 'systemGainNode should exist after init');
        assert.strictEqual(SpeechAudioContext.systemGainNode.gain.value, 0.5,
            'Default system volume should be 0.5');

        // Set to 0% — slider all the way left
        SpeechAudioContext.setSystemVolume(0);
        assert.strictEqual(SpeechAudioContext.systemGainNode.gain.value, 0,
            'System volume at 0% should set gain to 0');

        // Set to 100% — slider all the way right
        SpeechAudioContext.setSystemVolume(100);
        assert.strictEqual(SpeechAudioContext.systemGainNode.gain.value, 1.0,
            'System volume at 100% should set gain to 1.0');

        // Set to 75%
        SpeechAudioContext.setSystemVolume(75);
        assert.strictEqual(SpeechAudioContext.systemGainNode.gain.value, 0.75,
            'System volume at 75% should set gain to 0.75');
    });

    it('setSystemVolume should clamp values outside 0-100 range', async () => {
        globalThis.AudioContext = MockAudioContext;
        globalThis.window = { AudioContext: MockAudioContext };

        const { SpeechAudioContext } = await import('../lib/utils/SpeechAudioContext.js');

        // Re-init
        SpeechAudioContext.audioContext = null;
        SpeechAudioContext.gainNode = null;
        SpeechAudioContext.systemGainNode = null;
        await SpeechAudioContext.init();

        SpeechAudioContext.setSystemVolume(200);
        assert.strictEqual(SpeechAudioContext.systemGainNode.gain.value, 1.0,
            'Volume above 100 should clamp to 1.0');

        SpeechAudioContext.setSystemVolume(-50);
        assert.strictEqual(SpeechAudioContext.systemGainNode.gain.value, 0,
            'Volume below 0 should clamp to 0');
    });

    it('setVolume (AI voice) should NOT affect systemGainNode', async () => {
        globalThis.AudioContext = MockAudioContext;
        globalThis.window = { AudioContext: MockAudioContext };

        const { SpeechAudioContext } = await import('../lib/utils/SpeechAudioContext.js');

        // Re-init
        SpeechAudioContext.audioContext = null;
        SpeechAudioContext.gainNode = null;
        SpeechAudioContext.systemGainNode = null;
        await SpeechAudioContext.init();

        // Set system volume to a known value
        SpeechAudioContext.setSystemVolume(50);
        const systemBefore = SpeechAudioContext.systemGainNode.gain.value;

        // Change AI voice volume
        SpeechAudioContext.setVolume(20);

        assert.strictEqual(SpeechAudioContext.systemGainNode.gain.value, systemBefore,
            'Changing AI voice volume should not affect system/game audio volume');
    });
});
