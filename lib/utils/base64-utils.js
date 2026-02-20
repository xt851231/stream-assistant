
const lookup = new Uint8Array(256);
const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (let i = 0; i < code.length; i++) {
  lookup[code.charCodeAt(i)] = i;
}

export function base64ToUint8Array(base64) {
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

  for (let i = 0; i < len; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    array[p++] = (encoded1 << 2) | (encoded2 >> 4);

    // Check buffer length to avoid writing garbage from padding
    if (p < bufferLength) {
      array[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < bufferLength) {
      array[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return array;
}

export function uint8ArrayToBase64(uint8) {
  // Use Buffer if available (Node.js or polyfilled)
  // Use globalThis.Buffer to avoid ReferenceError in strict mode if Buffer is undefined
  if (typeof globalThis.Buffer === 'function') {
    return globalThis.Buffer.from(uint8).toString('base64');
  }

  // Browser Fallback: Use btoa with chunking to avoid stack overflow
  // 8192 is a safe chunk size for String.fromCharCode.apply
  const CHUNK_SIZE = 8192;
  let binary = '';
  const len = uint8.length;

  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = uint8.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, chunk);
  }

  return btoa(binary);
}
