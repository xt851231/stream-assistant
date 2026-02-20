
const lookup = new Uint8Array(256);
const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (let i = 0; i < code.length; i++) {
  lookup[code.charCodeAt(i)] = i;
}

/**
 * Decodes a base64 string to a Uint8Array.
 * Optimized with tiered strategy:
 * 1. Native Uint8Array.fromBase64 (New standard)
 * 2. Node Buffer (Server-side/Polyfilled)
 * 3. Manual Optimized Loop (Fallback)
 *
 * @param {string} base64 The base64 string to decode
 * @returns {Uint8Array} The decoded bytes
 */
export function base64ToUint8Array(base64) {
  // Tier 1: Modern Browser Native (Proposal Stage 3, Chrome 125+, FF 126+, Safari 17.4+)
  if (typeof Uint8Array.fromBase64 === 'function') {
    return Uint8Array.fromBase64(base64);
  }

  // Tier 2: Node.js Buffer (or polyfill)
  // Check if Buffer is available globally and has 'from' method
  if (typeof Buffer !== 'undefined' && Buffer.from) {
    const buf = Buffer.from(base64, 'base64');
    // Create a view instead of a copy for performance
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
  }

  // Tier 3: Manual Fallback (Optimized)
  const len = base64.length;
  let bufferLength = len * 0.75;

  if (base64[len - 1] === "=") {
    bufferLength--;
    if (base64[len - 2] === "=") {
      bufferLength--;
    }
  }

  const array = new Uint8Array(bufferLength);
  let p = 0;

  // Fast path: Process full 4-char blocks without bounds checks
  // We stop 4 chars before the end to handle padding safely in the slow path
  const lenMain = len - 4;
  let i = 0;

  for (; i < lenMain; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    array[p++] = (encoded1 << 2) | (encoded2 >> 4);
    array[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    array[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  // Slow path: Handle the last block (potentially with padding)
  if (i < len) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    array[p++] = (encoded1 << 2) | (encoded2 >> 4);

    // Only write subsequent bytes if they are within valid buffer length (handles padding)
    if (p < bufferLength) {
      array[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < bufferLength) {
      array[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return array;
}

const lookup64 = new Array(64);
for (let i = 0; i < 64; i++) {
  lookup64[i] = code[i];
}

export function uint8ArrayToBase64(uint8) {
    let output = '';
    const length = uint8.length;
    const extraBytes = length % 3; // if we have 1 byte left, pad 2 bytes
    let i, temp, chunk;

    for (i = 0; i < length - 2; i += 3) {
      temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
      chunk = lookup64[(temp >> 18) & 0x3F] +
              lookup64[(temp >> 12) & 0x3F] +
              lookup64[(temp >> 6) & 0x3F] +
              lookup64[temp & 0x3F];
      output += chunk;
    }

    if (extraBytes === 1) {
      temp = uint8[length - 1];
      output += lookup64[temp >> 2];
      output += lookup64[(temp << 4) & 0x3F];
      output += '==';
    } else if (extraBytes === 2) {
      temp = (uint8[length - 2] << 8) + (uint8[length - 1]);
      output += lookup64[temp >> 10];
      output += lookup64[(temp >> 4) & 0x3F];
      output += lookup64[(temp << 2) & 0x3F];
      output += '=';
    }

    return output;
}
