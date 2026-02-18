import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { base64Utils } from '../lib/utils/base64-utils.js';

describe('Base64 Utilities', () => {
  it('should encode ArrayBuffer to Base64 string', () => {
    const input = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const expected = 'SGVsbG8=';
    const result = base64Utils.arrayBufferToBase64(input.buffer);
    assert.strictEqual(result, expected);
  });

  it('should decode Base64 string to ArrayBuffer', () => {
    const input = 'SGVsbG8='; // "Hello"
    const expected = new Uint8Array([72, 101, 108, 108, 111]);
    const result = base64Utils.base64ToArrayBuffer(input);
    const resultBytes = new Uint8Array(result);
    assert.deepStrictEqual(resultBytes, expected);
  });

  it('should handle large buffers correctly (chunking test)', () => {
    // Create a large buffer (e.g., 100KB) to trigger chunking logic
    const size = 100 * 1024;
    const input = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      input[i] = i % 256;
    }

    // Use Buffer to get expected base64 (Node.js environment)
    const expected = Buffer.from(input).toString('base64');

    const result = base64Utils.arrayBufferToBase64(input.buffer);
    assert.strictEqual(result, expected);
  });

  it('should round-trip correctly', () => {
      const original = new Uint8Array([1, 2, 3, 255, 0, 128]);
      const encoded = base64Utils.arrayBufferToBase64(original.buffer);
      const decoded = base64Utils.base64ToArrayBuffer(encoded);
      assert.deepStrictEqual(new Uint8Array(decoded), original);
  });
});
