/**
 * Tests for config storage architecture:
 * - Common config (apiKey, selectedPersonaId) persists across model switches
 * - Model-specific config is saved/loaded independently per provider+persona
 * - Switching models preserves common fields and loads model-specific fields
 */
import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';

// ============================================================
// Define the expected architecture
// ============================================================

/**
 * Common fields: These must persist across ALL model switches.
 * They are stored once under 'app_common_config'.
 */
const COMMON_FIELDS = ['apiKey', 'selectedPersonaId'];

/**
 * Storage keys:
 *   'app_common_config'              → { apiKey, selectedPersonaId }
 *   'config_{provider}_{personaId}'  → { all model-specific fields }
 */

describe('Config Storage Architecture', () => {

    // In-memory localStorage mock
    let storage;

    beforeEach(() => {
        storage = {};
    });

    function getItem(key) {
        return storage[key] || null;
    }

    function setItem(key, value) {
        storage[key] = value;
    }

    // The helper function we expect to exist
    function getStorageKey(provider, personaId) {
        return `config_${provider}_${personaId}`;
    }

    // Simulate extractCommonConfig
    function extractCommonConfig(config) {
        const common = {};
        for (const field of COMMON_FIELDS) {
            if (config[field] !== undefined) {
                common[field] = config[field];
            }
        }
        return common;
    }

    // Simulate extractModelConfig (everything except common fields)
    function extractModelConfig(config) {
        const modelConfig = { ...config };
        for (const field of COMMON_FIELDS) {
            delete modelConfig[field];
        }
        return modelConfig;
    }

    it('Common fields should persist when switching from Live to REST', () => {
        // User sets apiKey in Live mode
        const liveConfig = {
            provider: 'gemini-live',
            apiKey: 'MY_SECRET_KEY',
            selectedPersonaId: 'felix',
            modelId: 'gemini-2.5-flash-native-audio-preview',
            voice: 'Puck',
            temperature: 0.7,
        };

        // Save common config
        const commonConfig = extractCommonConfig(liveConfig);
        setItem('app_common_config', JSON.stringify(commonConfig));

        // Save model-specific config
        const liveModelConfig = extractModelConfig(liveConfig);
        setItem(getStorageKey('gemini-live', 'felix'), JSON.stringify(liveModelConfig));

        // Now switch to REST mode
        const savedCommon = JSON.parse(getItem('app_common_config'));
        const restModelKey = getStorageKey('gemini-flash-rest', 'felix');
        const savedRest = getItem(restModelKey);

        let restConfig;
        if (savedRest) {
            restConfig = { ...JSON.parse(savedRest), ...savedCommon };
        } else {
            // First time on REST, common + defaults
            restConfig = {
                ...savedCommon,
                provider: 'gemini-flash-rest',
                modelId: 'gemini-2.5-flash',
                temperature: 0.7,
            };
        }

        // API key MUST survive the switch
        assert.strictEqual(restConfig.apiKey, 'MY_SECRET_KEY',
            'API key must persist when switching models');
        assert.strictEqual(restConfig.selectedPersonaId, 'felix',
            'Selected persona must persist when switching models');
    });

    it('Model-specific fields should be independent between modes', () => {
        // Live mode has voice=Puck
        const liveModelConfig = { provider: 'gemini-live', modelId: 'live-model', voice: 'Puck', temperature: 0.9 };
        setItem(getStorageKey('gemini-live', 'felix'), JSON.stringify(liveModelConfig));

        // REST mode has different temperature
        const restModelConfig = { provider: 'gemini-flash-rest', modelId: 'rest-model', temperature: 0.3, topK: 40 };
        setItem(getStorageKey('gemini-flash-rest', 'felix'), JSON.stringify(restModelConfig));

        // Load Live
        const loadedLive = JSON.parse(getItem(getStorageKey('gemini-live', 'felix')));
        assert.strictEqual(loadedLive.voice, 'Puck');
        assert.strictEqual(loadedLive.temperature, 0.9);

        // Load REST  
        const loadedRest = JSON.parse(getItem(getStorageKey('gemini-flash-rest', 'felix')));
        assert.strictEqual(loadedRest.temperature, 0.3);
        assert.strictEqual(loadedRest.topK, 40);

        // They must NOT contaminate each other
        assert.strictEqual(loadedRest.voice, undefined, 'REST should not inherit Live voice');
    });

    it('Persona info should survive model switches', () => {
        const common = { apiKey: 'KEY', selectedPersonaId: 'luna' };
        setItem('app_common_config', JSON.stringify(common));

        // Luna has specific system instructions on Live
        const lunaLive = {
            provider: 'gemini-live',
            systemInstructions: 'You are Luna, a mystical elf.',
            voice: 'Kore',
        };
        setItem(getStorageKey('gemini-live', 'luna'), JSON.stringify(lunaLive));

        // Switch to REST - Luna should show up from common, even if no REST-specific save
        const loadedCommon = JSON.parse(getItem('app_common_config'));
        assert.strictEqual(loadedCommon.selectedPersonaId, 'luna');
    });

    it('Saving config should split into common + model-specific', () => {
        const fullConfig = {
            apiKey: 'KEY123',
            selectedPersonaId: 'kai',
            provider: 'gemini-live',
            modelId: 'some-model',
            voice: 'Fenrir',
            temperature: 1.2,
        };

        const common = extractCommonConfig(fullConfig);
        const modelSpecific = extractModelConfig(fullConfig);

        // Common should only have common fields
        assert.deepStrictEqual(Object.keys(common).sort(), ['apiKey', 'selectedPersonaId']);
        assert.strictEqual(common.apiKey, 'KEY123');

        // Model-specific should NOT have common fields
        assert.strictEqual(modelSpecific.apiKey, undefined);
        assert.strictEqual(modelSpecific.selectedPersonaId, undefined);
        assert.strictEqual(modelSpecific.voice, 'Fenrir');
    });
});
