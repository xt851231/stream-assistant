/**
 * Tests for capture.worklet.js PCM/RMS optimization and media-utils integration.
 *
 * These tests validate that:
 * 1. The worklet produces Int16 PCM data and a pre-calculated RMS value
 * 2. media-utils AudioStreamer no longer has a convertToPCM16 method (moved to worklet)
 * 3. GeminiLiveAdapter handleIncomingMessage has no hot-path console.log calls
 */
import { test, describe, it } from 'node:test';
import assert from 'node:assert';

describe('Capture Worklet PCM/RMS Optimization', () => {
    // Simulate what the worklet should produce
    it('Float32 to Int16 conversion should match expected output', () => {
        // Simulate the worklet's conversion logic
        const float32Samples = new Float32Array([0.0, 0.5, -0.5, 1.0, -1.0]);
        const int16Data = new Int16Array(float32Samples.length);

        for (let j = 0; j < float32Samples.length; j++) {
            const s = Math.max(-1, Math.min(1, float32Samples[j]));
            int16Data[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        assert.strictEqual(int16Data[0], 0, 'Silence should be 0');
        assert.strictEqual(int16Data[1], 16383, '0.5 should map to ~16383'); // 0.5 * 0x7FFF
        assert.strictEqual(int16Data[2], -16384, '-0.5 should map to ~-16384'); // -0.5 * 0x8000
        assert.strictEqual(int16Data[3], 32767, '1.0 should map to 32767');
        assert.strictEqual(int16Data[4], -32768, '-1.0 should map to -32768');
    });

    it('RMS calculation in worklet should be correct', () => {
        const samples = new Float32Array([0.5, -0.5, 0.5, -0.5]);
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i++) {
            sumSquares += samples[i] * samples[i];
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        assert.ok(Math.abs(rms - 0.5) < 0.001, `RMS should be ~0.5, got ${rms}`);
    });

    it('Int16 asymmetric range should handle full negative range correctly', () => {
        // The key difference: using 0x8000 for negative values covers -32768
        // while using 0x7FFF for both only covers -32767
        const sample = -1.0;
        const symmetricResult = sample * 0x7FFF; // -32767 (old approach on main)
        const asymmetricResult = sample * 0x8000; // -32768 (new approach from Jules)

        assert.strictEqual(asymmetricResult, -32768, 'Asymmetric should produce -32768 for -1.0');
        assert.strictEqual(symmetricResult, -32767, 'Symmetric produces -32767 for -1.0 (loses 1 value)');
    });
});

describe('AudioStreamer should NOT have convertToPCM16', () => {
    it('convertToPCM16 should be removed from AudioStreamer after worklet optimization', async () => {
        // Read the source file and verify the method is gone
        const fs = await import('node:fs');
        const path = await import('node:path');
        const sourceUrl = new URL('../lib/utils/media-utils.js', import.meta.url);
        const source = fs.readFileSync(sourceUrl, 'utf-8');

        assert.ok(
            !source.includes('convertToPCM16'),
            'convertToPCM16 should be removed from media-utils.js (now in worklet)'
        );
    });
});

describe('GeminiLiveAdapter should not have hot-path console.log', () => {
    it('handleIncomingMessage body should not contain active console.log on hot path', async () => {
        const fs = await import('node:fs');
        const sourceUrl = new URL('../lib/api/adapters/GeminiLiveAdapter.js', import.meta.url);
        const source = fs.readFileSync(sourceUrl, 'utf-8');

        // Extract handleIncomingMessage function body
        const funcStart = source.indexOf('handleIncomingMessage(message)');
        assert.ok(funcStart !== -1, 'handleIncomingMessage should exist');
        const funcBody = source.substring(funcStart);

        // These specific hot-path logs should be removed or commented out
        const hotPathLogs = [
            "console.log('📨 ModelTurn parts:'",
            "console.log('📨 Part keys:'",
            "console.log('📨 Emitting text:'",
            "console.log('📨 Emitting audio,",
        ];

        for (const log of hotPathLogs) {
            // Check for ACTIVE (not commented out) log statements
            const lines = funcBody.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.includes(log) && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
                    assert.fail(`Found active hot-path log: ${trimmed}`);
                }
            }
        }
    });
});

describe('Capture worklet source code validation', () => {
    it('worklet should output Int16 PCM data and RMS in messages', async () => {
        const fs = await import('node:fs');
        const sourceUrl = new URL('../public/audio-processors/capture.worklet.js', import.meta.url);
        const source = fs.readFileSync(sourceUrl, 'utf-8');

        assert.ok(source.includes('Int16Array'), 'Worklet should create Int16Array');
        assert.ok(source.includes('rms'), 'Worklet should calculate RMS');
        assert.ok(
            source.includes('.buffer') || source.includes('int16Data'),
            'Worklet should transfer the ArrayBuffer'
        );

        // Assert that the buffer size is set correctly to ensure low latency
        assert.ok(source.includes('this.bufferSize = 1024;'), 'Worklet buffersize should be 1024 for low latency');
    });
});
