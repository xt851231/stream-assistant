/**
 * Base64 Utility - Tiered strategy for performance
 */

/**
 * Convert ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);

    // 1. Native method (Proposal)
    if (typeof Uint8Array.prototype.toBase64 === 'function') {
        return bytes.toBase64();
    }

    // 2. Buffer (Node.js)
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }

    // 3. Fallback: chunked btoa to avoid stack overflow with String.fromCharCode
    let binary = '';
    const len = bytes.byteLength;
    const CHUNK_SIZE = 0x8000; // 32k chunks

    for (let i = 0; i < len; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
        binary += String.fromCharCode.apply(null, chunk);
    }
    // In browser environment, window.btoa exists. In Node (if Buffer is missing for some reason), global.btoa might exist.
    if (typeof btoa === 'function') {
        return btoa(binary);
    } else if (typeof window !== 'undefined' && window.btoa) {
        return window.btoa(binary);
    }

    // Last resort manual encoding? Unlikely needed if environment is standard.
    throw new Error("Base64 encoding not supported in this environment");
}

/**
 * Convert Base64 string to ArrayBuffer
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
export function base64ToArrayBuffer(base64) {
    // 1. Native method (Proposal)
    if (typeof Uint8Array.fromBase64 === 'function') {
        return Uint8Array.fromBase64(base64).buffer;
    }

    // 2. Buffer (Node.js)
    if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from(base64, 'base64');
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }

    // 3. Fallback: atob + loop
    let binaryString;
    if (typeof atob === 'function') {
        binaryString = atob(base64);
    } else if (typeof window !== 'undefined' && window.atob) {
        binaryString = window.atob(base64);
    } else {
         throw new Error("Base64 decoding not supported in this environment");
    }

    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
