
import { test } from 'node:test';
import assert from 'node:assert';
import { GeminiTTSAdapter } from '../lib/api/tts/adapters/GeminiTTSAdapter.js';

// Mock AudioBuffer
class MockAudioBuffer {
    constructor(numberOfChannels, length, sampleRate) {
        this.numberOfChannels = numberOfChannels;
        this.length = Math.floor(length); // AudioBuffer length is integer
        this.sampleRate = sampleRate;
        this.channels = [new Float32Array(this.length)];
    }

    copyToChannel(source, channelNumber) {
        if (channelNumber >= this.numberOfChannels) {
            throw new Error('Channel index out of bounds');
        }
        // Copy source into channel
        this.channels[channelNumber].set(source.subarray(0, this.length));
    }

    getChannelData(channelNumber) {
        return this.channels[channelNumber];
    }
}

// Mock AudioContext
const mockAudioCtx = {
    createBuffer: (numberOfChannels, length, sampleRate) => {
        return new MockAudioBuffer(numberOfChannels, length, sampleRate);
    }
};

test('GeminiTTSAdapter pcmToAudioBuffer converts PCM16 to Float32 correctly', async (t) => {
    // 1. Setup
    const config = { apiKey: 'dummy' };
    const adapter = new GeminiTTSAdapter(config);
    adapter.audioCtx = mockAudioCtx;

    // 2. Create test data (little-endian 16-bit PCM)
    // Values: 0, 32767, -32768, -1
    // 0 -> 0x0000 -> [0x00, 0x00]
    // 32767 -> 0x7FFF -> [0xFF, 0x7F]
    // -32768 -> 0x8000 -> [0x00, 0x80]
    // -1 -> 0xFFFF -> [0xFF, 0xFF]

    const pcmBytes = new Uint8Array([
        0x00, 0x00, // 0
        0xFF, 0x7F, // 32767
        0x00, 0x80, // -32768
        0xFF, 0xFF  // -1
    ]);

    // 3. Run method
    const audioBuffer = adapter.pcmToAudioBuffer(pcmBytes);

    // 4. Verify
    assert.strictEqual(audioBuffer.numberOfChannels, 1);
    assert.strictEqual(audioBuffer.length, 4);
    assert.strictEqual(audioBuffer.sampleRate, 24000);

    const channelData = audioBuffer.getChannelData(0);

    // Check values (within epsilon for float precision)
    const expected = [
        0 / 32768,
        32767 / 32768,
        -32768 / 32768,
        -1 / 32768
    ];

    for (let i = 0; i < expected.length; i++) {
        const diff = Math.abs(channelData[i] - expected[i]);
        assert.ok(diff < 1e-6, `Sample ${i} mismatch: got ${channelData[i]}, expected ${expected[i]}`);
    }
});

test('GeminiTTSAdapter pcmToAudioBuffer handles odd length buffer safely (truncates)', async (t) => {
    const config = { apiKey: 'dummy' };
    const adapter = new GeminiTTSAdapter(config);
    adapter.audioCtx = mockAudioCtx;

    // 3 bytes -> 1 sample + 1 byte
    // Expectation: 1 sample, last byte ignored.

    const pcmBytes = new Uint8Array([0x00, 0x00, 0xFF]);

    // Run method
    const audioBuffer = adapter.pcmToAudioBuffer(pcmBytes);

    // Should be length 1
    assert.strictEqual(audioBuffer.length, 1);

    const data = audioBuffer.getChannelData(0);

    // Check first sample
    assert.strictEqual(data[0], 0);
});

test('GeminiTTSAdapter pcmToAudioBuffer handles unaligned buffer safely', async (t) => {
    const config = { apiKey: 'dummy' };
    const adapter = new GeminiTTSAdapter(config);
    adapter.audioCtx = mockAudioCtx;

    // Create unaligned Uint8Array
    // ArrayBuffer of size 6. Offset 1. Length 4.
    // [pad, b0, b1, b2, b3, pad]
    const buffer = new ArrayBuffer(6);
    const view = new Uint8Array(buffer);
    // Fill with data at offset 1
    // Sample 1: 32767 -> [0xFF, 0x7F]
    // Sample 2: -32768 -> [0x00, 0x80]
    view[1] = 0xFF; view[2] = 0x7F;
    view[3] = 0x00; view[4] = 0x80;

    const unalignedBytes = new Uint8Array(buffer, 1, 4);
    assert.strictEqual(unalignedBytes.byteOffset, 1);

    // Run method
    const audioBuffer = adapter.pcmToAudioBuffer(unalignedBytes);

    assert.strictEqual(audioBuffer.length, 2);
    const data = audioBuffer.getChannelData(0);

    const expected = [
        32767 / 32768,
        -32768 / 32768
    ];

    for (let i = 0; i < expected.length; i++) {
        const diff = Math.abs(data[i] - expected[i]);
        assert.ok(diff < 1e-6, `Sample ${i} mismatch: got ${data[i]}, expected ${expected[i]}`);
    }
});
