class AudioCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 1024;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];

        if (input && input.length > 0) {
            const inputChannel = input[0];

            for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex++] = inputChannel[i];

                // When buffer is full, process and send
                if (this.bufferIndex >= this.bufferSize) {
                    let sumSquares = 0;

                    // Create a new Int16Array for the message (will be transferred)
                    const int16Data = new Int16Array(this.bufferSize);

                    for (let j = 0; j < this.bufferSize; j++) {
                        const sample = this.buffer[j];

                        // RMS Calculation
                        sumSquares += sample * sample;

                        // PCM16 Conversion
                        const s = Math.max(-1, Math.min(1, sample));
                        // Use 0x8000 for negative to cover full Int16 range (-32768)
                        // Use 0x7FFF for positive (32767)
                        int16Data[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }

                    const rms = Math.sqrt(sumSquares / this.bufferSize);

                    // Send to main thread with Transferable for zero-copy
                    this.port.postMessage({
                        type: 'audio',
                        data: int16Data.buffer,
                        rms: rms
                    }, [int16Data.buffer]);

                    // Reset buffer index
                    this.bufferIndex = 0;
                }
            }
        }

        return true; // Keep the processor alive
    }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
