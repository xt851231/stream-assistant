
import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { GeminiFlashAdapter } from '../lib/api/adapters/GeminiFlashAdapter.js';

// Mock dependencies
class MockGoogleGenAI {
    constructor(config) {
        this.apiKey = config.apiKey;
    }
}

const mockTTS = {
    speak: mock.fn(),
    stop: mock.fn()
};
const MockTTSFactory = {
    createAdapter: mock.fn(() => mockTTS)
};

describe('GeminiFlashAdapter Audio Processing', () => {
    it('should combine audio chunks into a valid WAV file', async () => {
        const adapter = new GeminiFlashAdapter({
            apiKey: 'test-key',
            GoogleGenAIClass: MockGoogleGenAI,
            TTSFactoryClass: MockTTSFactory
        });

        // Create dummy base64 chunks
        const chunk1Bytes = new Uint8Array([0, 1, 2]);
        const chunk1Base64 = Buffer.from(chunk1Bytes).toString('base64');

        const chunk2Bytes = new Uint8Array([3, 4, 5, 6]);
        const chunk2Base64 = Buffer.from(chunk2Bytes).toString('base64');

        const chunks = [chunk1Base64, chunk2Base64];

        // Call combineAudioChunksToWav
        const wavBase64 = adapter.combineAudioChunksToWav(chunks);

        // Decode result
        const wavBuffer = Buffer.from(wavBase64, 'base64');

        // Check WAV Header
        assert.strictEqual(wavBuffer.toString('utf8', 0, 4), 'RIFF');
        assert.strictEqual(wavBuffer.toString('utf8', 8, 12), 'WAVE');
        assert.strictEqual(wavBuffer.toString('utf8', 12, 16), 'fmt ');
        assert.strictEqual(wavBuffer.readUInt16LE(22), 1, 'Channels should be 1');
        assert.strictEqual(wavBuffer.readUInt32LE(24), 16000, 'Sample rate should be 16000');
        assert.strictEqual(wavBuffer.readUInt16LE(34), 16, 'Bits per sample should be 16');
        assert.strictEqual(wavBuffer.toString('utf8', 36, 40), 'data');

        // Check data size
        const dataSize = wavBuffer.readUInt32LE(40);
        const expectedDataSize = chunk1Bytes.length + chunk2Bytes.length;
        assert.strictEqual(dataSize, expectedDataSize, `Data size mismatch. Expected ${expectedDataSize}, got ${dataSize}`);

        // Check data content
        const data = wavBuffer.subarray(44);
        assert.strictEqual(data.length, expectedDataSize);

        assert.strictEqual(data[0], 0);
        assert.strictEqual(data[1], 1);
        assert.strictEqual(data[2], 2);
        assert.strictEqual(data[3], 3);
        assert.strictEqual(data[4], 4);
        assert.strictEqual(data[5], 5);
        assert.strictEqual(data[6], 6);
    });

    it('should handle empty chunks array', async () => {
        const adapter = new GeminiFlashAdapter({
            apiKey: 'test-key',
            GoogleGenAIClass: MockGoogleGenAI,
            TTSFactoryClass: MockTTSFactory
        });

        const chunks = [];
        const wavBase64 = adapter.combineAudioChunksToWav(chunks);
        const wavBuffer = Buffer.from(wavBase64, 'base64');

        assert.strictEqual(wavBuffer.length, 44); // Header only
        const dataSize = wavBuffer.readUInt32LE(40);
        assert.strictEqual(dataSize, 0);
    });
});
