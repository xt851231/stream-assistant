import { test, describe } from 'node:test';
import assert from 'node:assert';
import { arrayBufferToBase64, base64ToArrayBuffer } from '../lib/utils/base64-utils.js';

describe('Base64 Utils', () => {
  test('should correctly encode and decode a simple string', () => {
    const text = 'Hello World!';
    const buffer = new TextEncoder().encode(text).buffer;
    const base64 = arrayBufferToBase64(buffer);
    const decodedBuffer = base64ToArrayBuffer(base64);
    const decodedText = new TextDecoder().decode(decodedBuffer);

    assert.strictEqual(decodedText, text);
  });

  test('should handle empty buffer', () => {
    const buffer = new ArrayBuffer(0);
    const base64 = arrayBufferToBase64(buffer);
    assert.strictEqual(base64, '');
    const decodedBuffer = base64ToArrayBuffer(base64);
    assert.strictEqual(decodedBuffer.byteLength, 0);
  });

  test('should handle random bytes', () => {
    const size = 1024;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
    }
    const buffer = bytes.buffer;
    const base64 = arrayBufferToBase64(buffer);
    const decodedBuffer = base64ToArrayBuffer(base64);
    const decodedBytes = new Uint8Array(decodedBuffer);

    for (let i = 0; i < size; i++) {
        assert.strictEqual(decodedBytes[i], bytes[i], `Byte at index ${i} mismatch`);
    }
  });
});
