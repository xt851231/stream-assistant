
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock AudioWorkletProcessor and environment
class AudioWorkletProcessor {
  constructor() {
    this.port = {
      onmessage: null,
      postMessage: () => {}
    };
  }
}

let RegisteredProcessorClass = null;
function registerProcessor(name, processorClass) {
  RegisteredProcessorClass = processorClass;
}

// Read the worklet code
const workletPath = path.resolve(__dirname, '../public/audio-processors/playback.worklet.js');
const workletCode = fs.readFileSync(workletPath, 'utf8');

// Execute worklet code to register the processor
// We wrap it in a function to avoid polluting global scope, but we need AudioWorkletProcessor and registerProcessor in scope.
// Using new Function is cleaner than eval if we pass arguments, but the code relies on global registerProcessor.
// So we'll use a crude eval with globals set.

global.AudioWorkletProcessor = AudioWorkletProcessor;
global.registerProcessor = registerProcessor;

// Run the code
eval(workletCode);

test('PCMProcessor Int16Array Conversion', () => {
  assert.ok(RegisteredProcessorClass, 'Processor should be registered');

  const processor = new RegisteredProcessorClass();

  // Verify initial state
  assert.strictEqual(processor.writeIndex, 0);
  assert.strictEqual(processor.readIndex, 0);

  // Create test data: Int16Array
  // Values: 0, 32767 (approx 1.0), -32768 (-1.0)
  const int16Data = new Int16Array([0, 32767, -32768]);

  // Send message
  processor.port.onmessage({ data: int16Data });

  // Verify buffer content
  // writeIndex should increase by 3
  assert.strictEqual(processor.writeIndex, 3);

  // Check values
  const buffer = processor.buffer;
  assert.strictEqual(buffer[0], 0);
  assert.ok(Math.abs(buffer[1] - (32767 / 32768)) < 0.0001, `Expected ~1.0, got ${buffer[1]}`);
  assert.strictEqual(buffer[2], -1);

  // Check rest is 0
  assert.strictEqual(buffer[3], 0);
});

test('PCMProcessor Wrap-around Logic', () => {
  const processor = new RegisteredProcessorClass();
  const bufferSize = processor.bufferSize;

  // Move writeIndex near the end
  processor.writeIndex = bufferSize - 2;

  // Data: [1000, 2000, 3000, 4000]
  // Should write 2 at end, 2 at start
  const int16Data = new Int16Array([16384, 16384, -16384, -16384]); // 0.5, 0.5, -0.5, -0.5

  processor.port.onmessage({ data: int16Data });

  assert.strictEqual(processor.writeIndex, bufferSize + 2);

  // Check end of buffer
  assert.strictEqual(processor.buffer[bufferSize - 2], 0.5);
  assert.strictEqual(processor.buffer[bufferSize - 1], 0.5);

  // Check start of buffer (wrap around)
  assert.strictEqual(processor.buffer[0], -0.5);
  assert.strictEqual(processor.buffer[1], -0.5);
});

test('PCMProcessor Float32Array Pass-through', () => {
  // Ensure existing functionality still works
  const processor = new RegisteredProcessorClass();

  const floatData = new Float32Array([0.1, 0.2, 0.3]);
  processor.port.onmessage({ data: floatData });

  assert.strictEqual(processor.writeIndex, 3);
  assert.ok(Math.abs(processor.buffer[0] - 0.1) < 0.0001);
  assert.ok(Math.abs(processor.buffer[1] - 0.2) < 0.0001);
  assert.ok(Math.abs(processor.buffer[2] - 0.3) < 0.0001);
});
