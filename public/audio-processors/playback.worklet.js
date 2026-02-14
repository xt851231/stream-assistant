class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Ring Buffer (Float32)
        // 48000 * 5 = 5 seconds buffer
        this.bufferSize = 48000 * 5;
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
                    // Bulk copy using set() - much faster than per-sample loop
                    const writePos = this.writeIndex % this.bufferSize;
                    const availableSpace = this.bufferSize - writePos;
                    if (data.length <= availableSpace) {
                        this.buffer.set(data, writePos);
                    } else {
                        // Handle wrap-around
                        this.buffer.set(data.subarray(0, availableSpace), writePos);
                        this.buffer.set(data.subarray(availableSpace), 0);
                    }
                    this.writeIndex += data.length;
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

        // Copy to other channels
        for (let i = 1; i < output.length; i++) {
            output[i].set(channel);
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
