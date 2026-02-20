class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Ring Buffer (Float32)
        // 24000 Hz * 60 seconds = 1,440,000 samples (~5.7MB)
        this.bufferSize = 24000 * 60;
        this.buffer = new Float32Array(this.bufferSize);
        this.writeIndex = 0;
        this.readIndex = 0;

        this.port.onmessage = (event) => {
            if (event.data === 'interrupt') {
                this.writeIndex = 0;
                this.readIndex = 0;
            } else {
                const data = event.data;
                if (data && data.length) {
                    const len = data.length;

                    // Prevent writeIndex from lapping readIndex + bufferSize (overflow)
                    if (this.writeIndex + len > this.readIndex + this.bufferSize) {
                        // Fast-forward readIndex to drop oldest unplayed data
                        this.readIndex = (this.writeIndex + len) - this.bufferSize;
                    }

                    const writePos = this.writeIndex % this.bufferSize;
                    const availableSpace = this.bufferSize - writePos;

                    if (data instanceof Int16Array) {
                        // Conversion loop: Int16 -> Float32
                        const inv32768 = 1 / 32768;

                        if (len <= availableSpace) {
                            for (let i = 0; i < len; i++) {
                                this.buffer[writePos + i] = data[i] * inv32768;
                            }
                        } else {
                            // Handle wrap-around
                            // Part 1: Fill to end
                            for (let i = 0; i < availableSpace; i++) {
                                this.buffer[writePos + i] = data[i] * inv32768;
                            }
                            // Part 2: Fill from start
                            const remaining = len - availableSpace;
                            for (let i = 0; i < remaining; i++) {
                                this.buffer[i] = data[availableSpace + i] * inv32768;
                            }
                        }
                    } else {
                        // Bulk copy using set() - much faster than per-sample loop
                        // Assumes Float32Array or compatible array
                        if (len <= availableSpace) {
                            this.buffer.set(data, writePos);
                        } else {
                            // Handle wrap-around
                            this.buffer.set(data.subarray(0, availableSpace), writePos);
                            this.buffer.set(data.subarray(availableSpace), 0);
                        }
                    }
                    this.writeIndex += len;
                }
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];

        if (!channel) return true;

        for (let i = 0; i < channel.length; i++) {
            // Check if we have data to read
            if (this.readIndex < this.writeIndex) {
                channel[i] = this.buffer[this.readIndex % this.bufferSize];
                this.readIndex++;
            } else {
                // Underrun / Silence
                channel[i] = 0;
            }
        }

        // JS Numbers are fine up to 9 quadrillion. At 48kHz, that's 6,000 years of audio.
        // No need to manually wrap indices, which causes data races.

        // Copy to other channels
        for (let i = 1; i < output.length; i++) {
            output[i].set(channel);
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
