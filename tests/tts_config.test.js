import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { getEffectiveSettings } from '../utils/model-registry.ts'; // We will test the implementation here

describe('TTS Configuration Injection', () => {
    it('should NOT inject TTS settings when requiresTTS is falsy', () => {
        const inputSettings = ['persona', 'systemInstructions', 'temperature'];
        const result = getEffectiveSettings(false, inputSettings);

        assert.deepStrictEqual(result, ['persona', 'systemInstructions', 'temperature']);
    });

    it('should inject TTS settings after persona when requiresTTS is true', () => {
        const inputSettings = ['persona', 'systemInstructions', 'temperature'];
        const result = getEffectiveSettings(true, inputSettings);

        const expected = [
            'persona',
            'ttsEngine',
            'ttsVoice',
            'ttsRate',
            'ttsPitch',
            'systemInstructions',
            'temperature'
        ];

        assert.deepStrictEqual(result, expected);
    });

    it('should NOT inject TTS settings if persona is not in the array, even if requiresTTS is true', () => {
        const inputSettings = ['systemInstructions', 'temperature'];
        const result = getEffectiveSettings(true, inputSettings);

        // In our current design, we only inject after 'persona'. If it's missing, we don't inject.
        // OR we could inject at the end. Let's enforce it only injects if persona is present to keep it grouped.
        assert.deepStrictEqual(result, inputSettings);
    });
});
