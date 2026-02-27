
const lookup = new Uint8Array(256);
const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (let i = 0; i < code.length; i++) {
  lookup[code.charCodeAt(i)] = i;
}

export function base64ToUint8Array(base64) {
  // 1. Try native Uint8Array.fromBase64 (Proposal/Future)
  if (typeof Uint8Array.fromBase64 === 'function') {
    return Uint8Array.fromBase64(base64);
  }

  // 2. Try Node.js Buffer (Best for Node environment)
  if (typeof globalThis !== 'undefined' && globalThis.Buffer && typeof globalThis.Buffer.from === 'function') {
    return new Uint8Array(globalThis.Buffer.from(base64, 'base64'));
  }

  // 3. Try atob (Best for Browser)
  // Use try/catch to handle invalid base64 strings gracefully (e.g. whitespace)
  if (typeof atob === 'function') {
    try {
      // atob is strict, so we strip whitespace to match Buffer's lenient behavior
      const binary = atob(base64.replace(/\s+/g, ''));
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      console.warn('atob failed, falling back to manual decoding', e);
    }
  }

  // 4. Fallback to manual decoding
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
  // 1. Try native Uint8Array.toBase64 (Proposal/Future)
  if (typeof uint8.toBase64 === 'function') {
    return uint8.toBase64();
  }

  // 2. Try Node.js Buffer (Best for Node environment)
  // Use globalThis to safely check for Buffer without ReferenceError in strict mode if it's missing
  if (typeof globalThis !== 'undefined' && globalThis.Buffer && typeof globalThis.Buffer.from === 'function') {
    return globalThis.Buffer.from(uint8).toString('base64');
  }

  // 3. Fallback to btoa with chunked String.fromCharCode (Best for Browser)
  // Stack size limits usually ~65k-128k arguments. We use 32k to be safe.
  const CHUNK_SIZE = 0x8000; // 32768
  const len = uint8.length;

  // Fast path for small buffers (most audio chunks)
  if (len < CHUNK_SIZE) {
    return btoa(String.fromCharCode.apply(null, uint8));
  }

  // Chunked path for large buffers (images/video frames)
  let binary = '';
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    // subarray creates a view, no copy overhead
    binary += String.fromCharCode.apply(null, uint8.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}
