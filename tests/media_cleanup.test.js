import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('Media Streams should safely shutdown even if one errors out', () => {
    // 1. Check AudioStreamer.stop() wrapping
    const mediaUtilsPath = path.join(rootDir, 'lib/utils/media-utils.js');
    const mediaUtilsContent = fs.readFileSync(mediaUtilsPath, 'utf8');
    assert.ok(
        mediaUtilsContent.includes('try {\n        this.audioWorklet.disconnect();') ||
        mediaUtilsContent.includes('try { this.audioWorklet.disconnect();'),
        'AudioStreamer.stop() should catch AudioNode exceptions'
    );

    // 2. Check LiveAPIContext cleanUpMedia is hardened
    const liveAPIPath = path.join(rootDir, 'contexts/LiveAPIContext.tsx');
    const liveAPIContent = fs.readFileSync(liveAPIPath, 'utf8');
    assert.ok(
        liveAPIContent.includes('try { await audioStreamerRef.current.stop(); } catch'),
        'cleanupMedia should catch streamer stop exceptions'
    );
    assert.ok(
        liveAPIContent.includes('try { await videoStreamerRef.current.stop(); } catch'),
        'cleanupMedia should catch streamer stop exceptions'
    );

    // 3. Check App.tsx properly resets its UI sync state
    const appPath = path.join(rootDir, 'App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.ok(
        appContent.includes('audioEnabled: false,'),
        'App.tsx should reset local media states on disconnect'
    );
});
