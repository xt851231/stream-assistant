
import { base64ToUint8Array } from '../lib/utils/base64-utils.js';

// Setup
const size = 1024 * 1024 * 5; // 5MB
const input = new Uint8Array(size);
for (let i = 0; i < size; i++) {
    input[i] = Math.floor(Math.random() * 256);
}
const base64String = Buffer.from(input).toString('base64');

console.log(`Benchmarking Base64 decoding (Size: ${size} bytes)`);

const ITERATIONS = 10;

function runBenchmark(name, fn) {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
        fn();
    }
    const end = performance.now();
    console.log(`${name}: ${((end - start) / ITERATIONS).toFixed(3)}ms per iteration`);
}

// 1. Original Code (Baseline)
// This simulates the original implementation in GeminiTTSAdapter.js
runBenchmark('Baseline (atob + loop)', () => {
    const binaryString = atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
});

// 2. New Implementation
runBenchmark('Optimized (lib/utils/base64-utils.js)', () => {
    base64ToUint8Array(base64String);
});

// 3. Node Buffer (Reference)
runBenchmark('Node Buffer.from (Direct)', () => {
    Buffer.from(base64String, 'base64');
});
