
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AudioStreamer } from '../lib/utils/media-utils.js';

describe('AudioStreamer', () => {
    describe('convertToPCM16', () => {
        // Create a dummy client for the constructor
        const dummyClient = {};
        const streamer = new AudioStreamer(dummyClient);

        it('should handle silence (0)', () => {
            const input = new Float32Array([0]);
            const outputBuffer = streamer.convertToPCM16(input);
            const output = new Int16Array(outputBuffer);
            assert.strictEqual(output.length, 1);
            assert.strictEqual(output[0], 0);
        });

        it('should handle max positive (1.0)', () => {
            const input = new Float32Array([1.0]);
            const outputBuffer = streamer.convertToPCM16(input);
            const output = new Int16Array(outputBuffer);
            assert.strictEqual(output[0], 32767);
        });

        it('should handle max negative (-1.0)', () => {
            const input = new Float32Array([-1.0]);
            const outputBuffer = streamer.convertToPCM16(input);
            const output = new Int16Array(outputBuffer);
            assert.strictEqual(output[0], -32767);
        });

        it('should clamp values > 1.0', () => {
            const input = new Float32Array([1.5, 2.0]);
            const outputBuffer = streamer.convertToPCM16(input);
            const output = new Int16Array(outputBuffer);
            assert.strictEqual(output[0], 32767);
            assert.strictEqual(output[1], 32767);
        });

        it('should clamp values < -1.0', () => {
            const input = new Float32Array([-1.5, -2.0]);
            const outputBuffer = streamer.convertToPCM16(input);
            const output = new Int16Array(outputBuffer);
            assert.strictEqual(output[0], -32767);
            assert.strictEqual(output[1], -32767);
        });

        it('should handle fractional values correctly (truncation)', () => {
            // 0.5 * 32767 = 16383.5 -> 16383
            // -0.5 * 32767 = -16383.5 -> -16383
            const input = new Float32Array([0.5, -0.5]);
            const outputBuffer = streamer.convertToPCM16(input);
            const output = new Int16Array(outputBuffer);
            assert.strictEqual(output[0], 16383);
            assert.strictEqual(output[1], -16383);
        });

        it('should handle empty input', () => {
            const input = new Float32Array([]);
            const outputBuffer = streamer.convertToPCM16(input);
            const output = new Int16Array(outputBuffer);
            assert.strictEqual(output.length, 0);
        });

        it('should handle a sequence of values', () => {
            const input = new Float32Array([0, 1.0, -1.0, 0.5]);
            const outputBuffer = streamer.convertToPCM16(input);
            const output = new Int16Array(outputBuffer);
            assert.deepStrictEqual(Array.from(output), [0, 32767, -32767, 16383]);
        });
    });
});
