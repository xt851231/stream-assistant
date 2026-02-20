
import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { base64ToUint8Array, uint8ArrayToBase64, writeBase64ToUint8Array } from '../lib/utils/base64-utils.js';

describe('Base64 Utils', () => {
    it('should encode and decode empty string', () => {
        const input = new Uint8Array(0);
        const encoded = uint8ArrayToBase64(input);
        assert.strictEqual(encoded, '');
        const decoded = base64ToUint8Array(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    it('should encode and decode "Hello World"', () => {
        const text = "Hello World";
        const input = new Uint8Array(Buffer.from(text));
        const encoded = uint8ArrayToBase64(input);
        assert.strictEqual(encoded, "SGVsbG8gV29ybGQ=");
        const decoded = base64ToUint8Array(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    it('should handle padding correctly (1 byte)', () => {
        const input = new Uint8Array([0x61]); // 'a'
        const encoded = uint8ArrayToBase64(input);
        assert.strictEqual(encoded, "YQ==");
        const decoded = base64ToUint8Array(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    it('should handle padding correctly (2 bytes)', () => {
        const input = new Uint8Array([0x61, 0x62]); // 'ab'
        const encoded = uint8ArrayToBase64(input);
        assert.strictEqual(encoded, "YWI=");
        const decoded = base64ToUint8Array(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    it('should handle large random data', () => {
        const size = 1024 * 1024; // 1MB
        const input = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            input[i] = Math.floor(Math.random() * 256);
        }

        const encoded = uint8ArrayToBase64(input);
        // Compare with Node's native implementation for correctness check
        assert.strictEqual(encoded, Buffer.from(input).toString('base64'));

        const decoded = base64ToUint8Array(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    it('should write base64 to target array at offset', () => {
        const text = "Hello";
        const base64 = Buffer.from(text).toString('base64'); // "SGVsbG8="
        const expected = new Uint8Array(Buffer.from(text));

        const target = new Uint8Array(10);
        // Fill with dummy data
        target.fill(0xFF);

        const offset = 2;
        const written = writeBase64ToUint8Array(base64, target, offset);

        assert.strictEqual(written, 5);

        // Check content
        assert.strictEqual(target[0], 0xFF);
        assert.strictEqual(target[1], 0xFF);
        for(let i=0; i<5; i++) {
            assert.strictEqual(target[offset+i], expected[i]);
        }
        assert.strictEqual(target[offset+5], 0xFF);
    });
});
