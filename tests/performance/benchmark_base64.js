
import { base64ToUint8Array, writeBase64ToUint8Array, uint8ArrayToBase64 } from '../../lib/utils/base64-utils.js';
import { performance } from 'node:perf_hooks';

// Old implementation (copied from GeminiFlashAdapter.js)
function decodeBase64Old(chunk) {
    const binaryString = atob(chunk);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Generate test data
const iterations = 5000;
const chunkSize = 4096;
const chunks = [];

const buffer = new Uint8Array(chunkSize);
for (let i = 0; i < chunkSize; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
}
const base64Chunk = Buffer.from(buffer).toString('base64');

console.log(`Generating ${iterations} chunks of size ${chunkSize} bytes...`);
for (let i = 0; i < iterations; i++) {
    chunks.push(base64Chunk);
}

// Warmup
for (let i = 0; i < 100; i++) {
    decodeBase64Old(chunks[0]);
    // base64ToUint8Array(chunks[0]);
}

// 1. Measure Old Implementation (Decode + Concat simulation)
console.log('Running benchmark for OLD implementation (Decode + Copy)...');
const startOld = performance.now();
// Step 1: Decode all
const binaryArrays = chunks.map(chunk => decodeBase64Old(chunk));
// Step 2: Calculate length
const pcmLengthOld = binaryArrays.reduce((sum, arr) => sum + arr.length, 0);
// Step 3: Combine
const pcmDataOld = new Uint8Array(pcmLengthOld);
let offsetOld = 0;
for (const arr of binaryArrays) {
    pcmDataOld.set(arr, offsetOld);
    offsetOld += arr.length;
}
const endOld = performance.now();
const timeOld = endOld - startOld;
console.log(`Old Implementation (Decode): ${timeOld.toFixed(2)}ms`);


// 2. Measure Optimized Implementation (Direct Decode)
console.log('Running benchmark for OPTIMIZED implementation (Direct Decode)...');
const startNew = performance.now();
// Step 1: Calculate total length
let totalLength = 0;
for (const chunk of chunks) {
    let len = chunk.length * 0.75;
    if (chunk[chunk.length - 1] === '=') {
        len--;
        if (chunk[chunk.length - 2] === '=') len--;
    }
    totalLength += len;
}

// Step 2: Allocate once
const pcmDataNew = new Uint8Array(totalLength);
let offsetNew = 0;

// Step 3: Decode into
for (const chunk of chunks) {
    const written = writeBase64ToUint8Array(chunk, pcmDataNew, offsetNew);
    offsetNew += written;
}
const endNew = performance.now();
const timeNew = endNew - startNew;
console.log(`New Implementation (Decode): ${timeNew.toFixed(2)}ms`);


// Verify Correctness
let equal = true;
if (pcmDataOld.length !== pcmDataNew.length) {
    equal = false;
    console.error(`Length mismatch: Old=${pcmDataOld.length}, New=${pcmDataNew.length}`);
} else {
    for (let i = 0; i < pcmDataOld.length; i++) {
        if (pcmDataOld[i] !== pcmDataNew[i]) {
            equal = false;
            console.error(`Mismatch at index ${i}`);
            break;
        }
    }
}

if (equal) {
    console.log('✅ Decode Verification passed: Outputs are identical.');
} else {
    console.error('❌ Decode Verification failed: Outputs differ!');
    process.exit(1);
}

// 3. Measure Encoding (Uint8Array -> Base64)
console.log('Running benchmark for ENCODING...');
// Old Encoding
const startEncOld = performance.now();
let binary = '';
// Only encode a portion if it's too huge, but let's try full
// 5000 * 4096 = 20MB.
// String concatenation in loop is O(N^2) or optimized? In V8 `+=` is optimized but still slow for 20MB.
// Actually `binary += char` 20 million times is VERY slow.
// But `GeminiFlashAdapter` does exactly this!
for (let i = 0; i < pcmDataOld.length; i++) {
    binary += String.fromCharCode(pcmDataOld[i]);
}
const encodedOld = btoa(binary);
const endEncOld = performance.now();
const timeEncOld = endEncOld - startEncOld;
console.log(`Old Encoding: ${timeEncOld.toFixed(2)}ms`);

// New Encoding
const startEncNew = performance.now();
const encodedNew = uint8ArrayToBase64(pcmDataNew);
const endEncNew = performance.now();
const timeEncNew = endEncNew - startEncNew;
console.log(`New Encoding: ${timeEncNew.toFixed(2)}ms`);

// Verify Encoding
if (encodedOld !== encodedNew) {
     console.error('❌ Encoding mismatch!');
} else {
     console.log('✅ Encoding matches.');
}

const totalOld = timeOld + timeEncOld;
const totalNew = timeNew + timeEncNew;

console.log('--------------------------------------------------');
console.log(`Total Old: ${totalOld.toFixed(2)}ms`);
console.log(`Total New: ${totalNew.toFixed(2)}ms`);
const totalImprovement = ((totalOld - totalNew) / totalOld) * 100;
console.log(`🚀 Total Improvement: ${totalImprovement.toFixed(2)}% faster`);
console.log(`Speedup: ${(totalOld / totalNew).toFixed(2)}x`);
