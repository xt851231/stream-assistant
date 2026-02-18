/**
 * Base64 Utilities - Centralized and optimized base64 encoding/decoding
 *
 * Strategy:
 * 1. Native methods (Uint8Array.fromBase64 / toBase64) - Future proofing
 * 2. Browser native (atob/btoa) with chunking for large buffers
 */

export const base64Utils = {
    /**
     * Convert ArrayBuffer to Base64 string
     * @param {ArrayBuffer} buffer
     * @returns {string}
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);

        // 1. Native method (Proposal)
        if (typeof bytes.toBase64 === 'function') {
            return bytes.toBase64();
        }

        // 2. Standard Browser Optimization
        // Using a chunked approach to avoid stack overflow with String.fromCharCode.apply
        let binary = '';
        const len = bytes.byteLength;
        const chunkSize = 0x8000; // 32768

        for (let i = 0; i < len; i += chunkSize) {
            // subarray does not copy data, so it's efficient
            binary += String.fromCharCode.apply(
                null,
                bytes.subarray(i, Math.min(i + chunkSize, len))
            );
        }

        return btoa(binary);
    },

    /**
     * Convert Base64 string to ArrayBuffer
     * @param {string} base64
     * @returns {ArrayBuffer}
     */
    base64ToArrayBuffer(base64) {
        // 1. Native method (Proposal)
        if (typeof Uint8Array.fromBase64 === 'function') {
            return Uint8Array.fromBase64(base64).buffer;
        }

        // 2. Standard Browser Optimization
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);

        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return bytes.buffer;
    }
};
