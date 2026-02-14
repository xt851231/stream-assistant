
import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { GeminiLiveAdapter } from '../lib/api/adapters/GeminiLiveAdapter.js';

describe('GeminiLiveAdapter Mid-Session Updates', () => {
    it('should only merge config in updateConfig (no reconnect)', async () => {
        class MockGoogleGenAI {
            constructor() {
                this.live = {
                    connect: async () => ({
                        conn: { _ws: { readyState: 1, send: mock.fn(), close: mock.fn() } }
                    })
                };
            }
        }

        const adapter = new GeminiLiveAdapter({
            apiKey: 'test-key',
            voice: 'Puck',
            systemInstruction: 'You are helpful.',
            GoogleGenAIClass: MockGoogleGenAI
        });

        await adapter.connect();

        // Update config
        adapter.updateConfig({
            systemInstructions: 'You are a pirate.',
            voice: 'Fenrir'
        });

        // Config should be merged
        assert.strictEqual(adapter.config.systemInstruction, 'You are a pirate.');
        assert.strictEqual(adapter.config.voice, 'Fenrir');

        // Session should still be active (no disconnect)
        assert.ok(adapter.session !== null, 'Session should still be active');
    });

    it('should map systemInstructions to systemInstruction', () => {
        class MockGoogleGenAI {
            constructor() { this.live = { connect: async () => ({}) }; }
        }

        const adapter = new GeminiLiveAdapter({
            apiKey: 'test-key',
            GoogleGenAIClass: MockGoogleGenAI
        });

        adapter.updateConfig({ systemInstructions: 'Be a pirate.' });
        assert.strictEqual(adapter.config.systemInstruction, 'Be a pirate.');
    });
});

describe('Media Streamer setClient', () => {
    it('AudioStreamer should support setClient for adapter swap', async () => {
        const { AudioStreamer } = await import('../lib/utils/media-utils.js');

        const oldClient = { sendAudio: mock.fn(), connected: true };
        const newClient = { sendAudio: mock.fn(), connected: true };

        const streamer = new AudioStreamer(oldClient);
        assert.strictEqual(streamer.client, oldClient);

        streamer.setClient(newClient);
        assert.strictEqual(streamer.client, newClient);
    });

    it('BaseVideoCapture subclass (VideoStreamer) should support setClient', async () => {
        const { VideoStreamer } = await import('../lib/utils/media-utils.js');

        const oldClient = { sendImage: mock.fn(), connected: true };
        const newClient = { sendImage: mock.fn(), connected: true };

        const streamer = new VideoStreamer(oldClient);
        assert.strictEqual(streamer.client, oldClient);

        streamer.setClient(newClient);
        assert.strictEqual(streamer.client, newClient);
    });
});
