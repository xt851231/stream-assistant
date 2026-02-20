
const lookup = new Uint8Array(256);
const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (let i = 0; i < code.length; i++) {
  lookup[code.charCodeAt(i)] = i;
}

export function base64ToUint8Array(base64) {
  // Use modern APIs if available (e.g. Chrome 127+, Firefox 129+, Safari 18+)
  if (typeof Uint8Array.fromBase64 === 'function') {
    return Uint8Array.fromBase64(base64);
  }

  // Use Buffer in Node.js environments for massive speedup
  if (typeof Buffer !== 'undefined' && Buffer.from) {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

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

  // Optimization: Loop for all full blocks (len - 4) to avoid inner checks
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

  // Handle last chunk safely with checks
  if (i < len) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    array[p++] = (encoded1 << 2) | (encoded2 >> 4);
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
