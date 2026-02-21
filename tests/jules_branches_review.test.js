/**
 * Tests for Jules branch cherry-picks:
 * 1. Toolbelt accessibility (aria-labels)
 * 2. Sensitive log removal
 * 3. GeminiLiveAdapter connect refactoring
 */
import { test, describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('Toolbelt Accessibility', () => {
    it('Toolbelt.tsx should have aria-label on all button elements', () => {
        const sourceUrl = new URL('../components/Toolbelt.tsx', import.meta.url);
        const source = fs.readFileSync(sourceUrl, 'utf-8');

        // Count all <button occurrences
        const buttonCount = (source.match(/<button/g) || []).length;
        // Count all aria-label occurrences on buttons
        const ariaLabelCount = (source.match(/aria-label=/g) || []).length;

        assert.ok(buttonCount > 0, 'Should have buttons');
        assert.ok(ariaLabelCount >= buttonCount,
            `Every button (${buttonCount}) should have an aria-label, found ${ariaLabelCount}`);
    });

    it('Toolbelt.tsx should have a COLOR_NAMES map', () => {
        const sourceUrl = new URL('../components/Toolbelt.tsx', import.meta.url);
        const source = fs.readFileSync(sourceUrl, 'utf-8');

        assert.ok(source.includes('COLOR_NAMES'), 'Should define COLOR_NAMES map');
    });
});

describe('Sensitive Log Removal', () => {
    it('GeminiLiveAdapter should not log transcription content', () => {
        const sourceUrl = new URL('../lib/api/adapters/GeminiLiveAdapter.js', import.meta.url);
        const source = fs.readFileSync(sourceUrl, 'utf-8');

        // These lines should NOT exist as active code
        const sensitivePatterns = [
            "console.log('📝 Input transcription (serverContent):'",
            "console.log('📝 Output transcription (serverContent):'",
            "console.log('📝 Input transcription (top-level):'",
            "console.log('📝 Output transcription (top-level):'",
        ];

        for (const pattern of sensitivePatterns) {
            const lines = source.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.includes(pattern) && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
                    assert.fail(`Found active sensitive log: ${trimmed}`);
                }
            }
        }
    });

    it('GeminiFlashAdapter should not log transcription text', () => {
        const sourceUrl = new URL('../lib/api/adapters/GeminiFlashAdapter.js', import.meta.url);
        const source = fs.readFileSync(sourceUrl, 'utf-8');

        const lines = source.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
            if (trimmed.includes('console.log') && trimmed.includes('Parsed Transcript')) {
                assert.fail(`Found active sensitive log: ${trimmed}`);
            }
        }
    });

    it('GeminiTTSAdapter should not log text content, only length', () => {
        const sourceUrl = new URL('../lib/api/tts/adapters/GeminiTTSAdapter.js', import.meta.url);
        const source = fs.readFileSync(sourceUrl, 'utf-8');

        const lines = source.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
            // Should not log substrings of text content
            if (trimmed.includes('console.log') && trimmed.includes('.substring(')) {
                assert.fail(`Found log with text substring: ${trimmed}`);
            }
        }
    });
});

describe('GeminiLiveAdapter Connect Refactoring', () => {
    it('should have _buildConnectConfig helper method', () => {
        const sourceUrl = new URL('../lib/api/adapters/GeminiLiveAdapter.js', import.meta.url);
        const source = fs.readFileSync(sourceUrl, 'utf-8');

        assert.ok(source.includes('_buildConnectConfig'), 'Should have _buildConnectConfig method');
    });

    it('should have _getCallbacks helper method', () => {
        const sourceUrl = new URL('../lib/api/adapters/GeminiLiveAdapter.js', import.meta.url);
        const source = fs.readFileSync(sourceUrl, 'utf-8');

        assert.ok(source.includes('_getCallbacks'), 'Should have _getCallbacks method');
    });

    it('connect() should use _buildConnectConfig and _getCallbacks', () => {
        const sourceUrl = new URL('../lib/api/adapters/GeminiLiveAdapter.js', import.meta.url);
        const source = fs.readFileSync(sourceUrl, 'utf-8');

        // Extract the connect method body
        const connectStart = source.indexOf('async connect(');
        const connectEnd = source.indexOf('_buildConnectConfig()');
        assert.ok(connectStart !== -1, 'connect method should exist');
        assert.ok(connectEnd > connectStart, '_buildConnectConfig should be called inside or near connect');
    });

    it('_buildConnectConfig should produce correct defaults', async () => {
        const { GeminiLiveAdapter } = await import('../lib/api/adapters/GeminiLiveAdapter.js');

        const adapter = new GeminiLiveAdapter({
            apiKey: 'test-key',
        });

        const config = adapter._buildConnectConfig();

        assert.strictEqual(config.systemInstruction, 'You are a helpful assistant.');
        assert.strictEqual(config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Puck');
        assert.strictEqual(config.realtimeInputConfig.automaticActivityDetection.silenceDurationMs, 1500);
        assert.strictEqual(config.inputAudioTranscription, undefined);
        assert.strictEqual(config.outputAudioTranscription, undefined);
    });

    it('_buildConnectConfig should respect custom values', async () => {
        const { GeminiLiveAdapter } = await import('../lib/api/adapters/GeminiLiveAdapter.js');

        const adapter = new GeminiLiveAdapter({
            apiKey: 'test-key',
            systemInstruction: 'Custom instruction',
            voice: 'Fenrir',
            silenceDuration: 2000,
            inputTranscription: true,
            outputTranscription: true,
            affectiveDialog: true,
            thinkingBudget: 100,
        });

        const config = adapter._buildConnectConfig();

        assert.strictEqual(config.systemInstruction, 'Custom instruction');
        assert.strictEqual(config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Fenrir');
        assert.strictEqual(config.realtimeInputConfig.automaticActivityDetection.silenceDurationMs, 2000);
        assert.deepStrictEqual(config.inputAudioTranscription, {});
        assert.deepStrictEqual(config.outputAudioTranscription, {});
        assert.strictEqual(config.enableAffectiveDialog, true);
        assert.strictEqual(config.thinkingConfig.budgetTokenCount, 100);
    });

    it('_buildConnectConfig should include tools when set', async () => {
        const { GeminiLiveAdapter } = await import('../lib/api/adapters/GeminiLiveAdapter.js');

        const adapter = new GeminiLiveAdapter({ apiKey: 'test-key' });
        const tools = [{ googleSearch: {} }];
        adapter.setTools(tools);

        const config = adapter._buildConnectConfig();
        assert.deepStrictEqual(config.tools, tools);
    });
});
