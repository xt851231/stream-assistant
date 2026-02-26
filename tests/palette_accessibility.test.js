import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('MediaControlHub should contain accessibility attributes for toggles', () => {
    const mediaHubContent = fs.readFileSync(path.join(rootDir, 'components', 'MediaControlHub.tsx'), 'utf8');

    // Check for aria-pressed on toggle buttons
    assert.ok(mediaHubContent.includes('aria-pressed={config.audioEnabled}'), 'MediaControlHub.tsx is missing audioEnabled aria-pressed');
    assert.ok(mediaHubContent.includes('aria-pressed={config.videoEnabled}'), 'MediaControlHub.tsx is missing videoEnabled aria-pressed');
    assert.ok(mediaHubContent.includes('aria-pressed={config.screenShareEnabled}'), 'MediaControlHub.tsx is missing screenShareEnabled aria-pressed');

    // Check for aria-labels on toggle buttons
    assert.ok(mediaHubContent.includes('aria-label="Toggle Microphone"'), 'MediaControlHub.tsx is missing Microphone aria-label');
    assert.ok(mediaHubContent.includes('aria-label="Toggle Camera"'), 'MediaControlHub.tsx is missing Camera aria-label');
    assert.ok(mediaHubContent.includes('aria-label="Toggle Screen Share"'), 'MediaControlHub.tsx is missing Screen Share aria-label');

    // Check for switch role and aria-checked on "Capture Game Audio"
    assert.ok(mediaHubContent.includes('role="switch"'), 'MediaControlHub.tsx is missing role="switch"');
    assert.ok(mediaHubContent.includes('aria-checked={config.screenAudio}'), 'MediaControlHub.tsx is missing aria-checked');
    assert.ok(mediaHubContent.includes('aria-label="Capture Game Audio"'), 'MediaControlHub.tsx is missing Capture Game Audio aria-label');
});
