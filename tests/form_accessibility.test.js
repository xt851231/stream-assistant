import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('Components should contain accessibility attributes for form fields', () => {
    const appContent = fs.readFileSync(path.join(rootDir, 'App.tsx'), 'utf8');
    assert.ok(appContent.includes('id="game-title-input"'), 'App.tsx is missing game title id');
    assert.ok(appContent.includes('aria-label="Currently Playing Game Title"'), 'App.tsx is missing game title aria-label');

    const chatSidebarContent = fs.readFileSync(path.join(rootDir, 'components', 'ChatSidebar.tsx'), 'utf8');
    assert.ok(chatSidebarContent.includes('id="chat-message-input"'), 'ChatSidebar.tsx is missing chat input id');
    assert.ok(chatSidebarContent.includes('aria-label="Chat message input"'), 'ChatSidebar.tsx is missing chat input aria-label');

    const mediaHubContent = fs.readFileSync(path.join(rootDir, 'components', 'MediaControlHub.tsx'), 'utf8');
    assert.ok(mediaHubContent.includes('id="microphone-select"'), 'MediaControlHub.tsx is missing mic input id');
    assert.ok(mediaHubContent.includes('aria-label="AI Voice Volume"'), 'MediaControlHub.tsx is missing volume aria-label');

    const configMenuContent = fs.readFileSync(path.join(rootDir, 'components', 'ConfigurationMenu.tsx'), 'utf8');
    assert.ok(configMenuContent.includes('id={`config-select-${settingId}`}'), 'ConfigurationMenu.tsx is missing dynamic setting id');
    assert.ok(configMenuContent.includes('id="appearance-bg-image"'), 'ConfigurationMenu.tsx is missing static appearance bg id');
});
