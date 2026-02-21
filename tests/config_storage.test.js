/**
 * Tests for per-model config storage architecture:
 * - Each model has its own independent config
 * - Persona voice defaults are per-model
 * - New models start with defaults from constants
 * - Model switching saves/loads correctly
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// ========================================
// Read source files for static analysis
// ========================================
const typesSource = fs.readFileSync(path.resolve('types.ts'), 'utf8');
const constantsSource = fs.readFileSync(path.resolve('constants.ts'), 'utf8');
const registrySource = fs.readFileSync(path.resolve('utils/model-registry.ts'), 'utf8');
const appSource = fs.readFileSync(path.resolve('App.tsx'), 'utf8');
const configMenuSource = fs.readFileSync(path.resolve('components/ConfigurationMenu.tsx'), 'utf8');

// ========================================
// Architecture Tests
// ========================================

describe('Per-Model Config Storage Architecture', () => {

    describe('Types', () => {
        it('should have PersonaVoiceConfig interface', () => {
            assert.ok(typesSource.includes('interface PersonaVoiceConfig'),
                'types.ts must define PersonaVoiceConfig');
        });

        it('Persona should have voiceDefaults, not voice', () => {
            assert.ok(typesSource.includes('voiceDefaults'),
                'Persona must have voiceDefaults field');
            // Should not have a plain 'voice: string' in the Persona interface
            // (AppConfig still has voice, but Persona should use voiceDefaults)
            const personaBlock = typesSource.slice(
                typesSource.indexOf('interface Persona'),
                typesSource.indexOf('}', typesSource.indexOf('interface Persona')) + 1
            );
            assert.ok(!personaBlock.includes('voice: string'),
                'Persona interface should not have a plain voice: string field');
        });
    });

    describe('Constants', () => {
        it('each persona should have voiceDefaults with gemini-live and gemini-flash-rest', () => {
            // Check that voiceDefaults appears for each persona
            const personaMatches = constantsSource.match(/voiceDefaults:\s*\{/g);
            assert.ok(personaMatches && personaMatches.length >= 4,
                'All 4 personas should have voiceDefaults');
        });

        it('should export getPersonaVoiceForModel helper', () => {
            assert.ok(constantsSource.includes('function getPersonaVoiceForModel'),
                'constants.ts must export getPersonaVoiceForModel');
        });

        it('gemini-live voice defaults should use native voice field', () => {
            assert.ok(constantsSource.includes("'gemini-live': { voice:"),
                'gemini-live voiceDefaults should set native voice');
        });

        it('gemini-flash-rest voice defaults should use ttsEngine and ttsVoice', () => {
            assert.ok(constantsSource.includes("ttsEngine: 'gemini'"),
                'gemini-flash-rest voiceDefaults should set ttsEngine');
            assert.ok(constantsSource.includes("ttsVoice:"),
                'gemini-flash-rest voiceDefaults should set ttsVoice');
        });
    });

    describe('Model Registry', () => {
        it('getStorageKey should take only provider (no persona)', () => {
            // Signature: getStorageKey(provider: string): string
            assert.ok(registrySource.includes('getStorageKey(provider: string): string'),
                'getStorageKey should accept only one param: provider');
        });

        it('should export saveModelConfig', () => {
            assert.ok(registrySource.includes('function saveModelConfig'),
                'model-registry must export saveModelConfig');
        });

        it('should export loadModelConfig', () => {
            assert.ok(registrySource.includes('function loadModelConfig'),
                'model-registry must export loadModelConfig');
        });

        it('saveModelConfig should save to config_{provider} key', () => {
            assert.ok(registrySource.includes('getStorageKey(config.provider)'),
                'saveModelConfig should use config_{provider} key');
        });

        it('saveModelConfig should also save provider routing to app_config', () => {
            assert.ok(registrySource.includes("localStorage.setItem('app_config'"),
                'saveModelConfig should update app_config for routing');
        });
    });

    describe('App.tsx', () => {
        it('should use loadModelConfig for initial load', () => {
            assert.ok(appSource.includes('loadModelConfig'),
                'App.tsx should use loadModelConfig');
        });

        it('should use saveModelConfig in useEffect', () => {
            assert.ok(appSource.includes('saveModelConfig(config)'),
                'App.tsx useEffect should call saveModelConfig');
        });

        it('should NOT use old getStorageKey with two params', () => {
            assert.ok(!appSource.includes('getStorageKey('),
                'App.tsx should not use getStorageKey directly');
        });
    });

    describe('ConfigurationMenu', () => {
        it('should import saveModelConfig and loadModelConfig', () => {
            assert.ok(configMenuSource.includes('saveModelConfig'),
                'ConfigurationMenu must import saveModelConfig');
            assert.ok(configMenuSource.includes('loadModelConfig'),
                'ConfigurationMenu must import loadModelConfig');
        });

        it('should import getPersonaVoiceForModel', () => {
            assert.ok(configMenuSource.includes('getPersonaVoiceForModel'),
                'ConfigurationMenu must import getPersonaVoiceForModel');
        });

        it('handlePersonaSelect should use getPersonaVoiceForModel', () => {
            assert.ok(configMenuSource.includes('getPersonaVoiceForModel(persona, currentModelId)'),
                'handlePersonaSelect should call getPersonaVoiceForModel');
        });

        it('handleModelChange should call saveModelConfig before switching', () => {
            // saveModelConfig(config) should appear before loadModelConfig
            const saveIdx = configMenuSource.indexOf('saveModelConfig(config)');
            const loadIdx = configMenuSource.indexOf('loadModelConfig(newModelKey)');
            assert.ok(saveIdx > 0 && loadIdx > 0 && saveIdx < loadIdx,
                'handleModelChange should save before loading');
        });

        it('should NOT use old getStorageKey with persona param', () => {
            assert.ok(!configMenuSource.includes('getStorageKey(currentModelId, '),
                'ConfigurationMenu should not use old 2-param getStorageKey');
        });
    });
});

describe('Per-Model Config Logic (simulated)', () => {
    // Simulated localStorage
    let storage;

    beforeEach(() => {
        storage = {};
    });

    function getItem(key) { return storage[key] || null; }
    function setItem(key, value) { storage[key] = value; }

    function getStorageKey(provider) { return `config_${provider}`; }

    function saveModelConfig(config) {
        setItem(getStorageKey(config.provider), JSON.stringify(config));
        setItem('app_config', JSON.stringify({ provider: config.provider }));
    }

    function loadModelConfig(provider, defaults) {
        const saved = getItem(getStorageKey(provider));
        if (saved) return { ...defaults, ...JSON.parse(saved), provider };
        return { ...defaults, provider };
    }

    it('API keys should be independent per model', () => {
        const liveConfig = { provider: 'gemini-live', apiKey: 'LIVE_KEY', voice: 'Fenrir', temperature: 0.9 };
        saveModelConfig(liveConfig);

        const restConfig = { provider: 'gemini-flash-rest', apiKey: 'REST_KEY', ttsVoice: 'Puck', temperature: 0.3 };
        saveModelConfig(restConfig);

        const loadedLive = loadModelConfig('gemini-live', {});
        const loadedRest = loadModelConfig('gemini-flash-rest', {});

        assert.strictEqual(loadedLive.apiKey, 'LIVE_KEY');
        assert.strictEqual(loadedRest.apiKey, 'REST_KEY');
        assert.notStrictEqual(loadedLive.apiKey, loadedRest.apiKey);
    });

    it('switching models round-trips correctly', () => {
        // Set up Live
        saveModelConfig({ provider: 'gemini-live', apiKey: 'KEY1', voice: 'Fenrir', temperature: 1.0 });
        // Set up REST
        saveModelConfig({ provider: 'gemini-flash-rest', apiKey: 'KEY2', topK: 40, temperature: 0.5 });

        // Switch to Live
        const live = loadModelConfig('gemini-live', {});
        assert.strictEqual(live.apiKey, 'KEY1');
        assert.strictEqual(live.voice, 'Fenrir');
        assert.strictEqual(live.temperature, 1.0);

        // Switch to REST
        const rest = loadModelConfig('gemini-flash-rest', {});
        assert.strictEqual(rest.apiKey, 'KEY2');
        assert.strictEqual(rest.topK, 40);
        assert.strictEqual(rest.temperature, 0.5);

        // Switch back to Live
        const live2 = loadModelConfig('gemini-live', {});
        assert.strictEqual(live2.apiKey, 'KEY1');
    });

    it('new model starts with defaults', () => {
        const defaults = { provider: 'new-model', apiKey: '', voice: 'Puck', temperature: 0.7 };
        const config = loadModelConfig('new-model', defaults);

        assert.strictEqual(config.provider, 'new-model');
        assert.strictEqual(config.apiKey, ''); // No saved key
        assert.strictEqual(config.voice, 'Puck'); // From defaults
    });

    it('persona voice defaults should differ by model', () => {
        // Simulate getPersonaVoiceForModel
        const felixVoiceDefaults = {
            'gemini-live': { voice: 'Fenrir' },
            'gemini-flash-rest': { ttsEngine: 'gemini', ttsVoice: 'Fenrir' }
        };

        function getPersonaVoiceForModel(provider) {
            return felixVoiceDefaults[provider] || {};
        }

        const liveVoice = getPersonaVoiceForModel('gemini-live');
        assert.strictEqual(liveVoice.voice, 'Fenrir');
        assert.strictEqual(liveVoice.ttsEngine, undefined);

        const restVoice = getPersonaVoiceForModel('gemini-flash-rest');
        assert.strictEqual(restVoice.ttsEngine, 'gemini');
        assert.strictEqual(restVoice.ttsVoice, 'Fenrir');
        assert.strictEqual(restVoice.voice, undefined);
    });

    it('app_config should only store provider for routing', () => {
        saveModelConfig({ provider: 'gemini-live', apiKey: 'KEY', voice: 'Puck' });

        const routing = JSON.parse(getItem('app_config'));
        assert.strictEqual(routing.provider, 'gemini-live');
        // Should NOT contain apiKey or other config fields
        assert.strictEqual(routing.apiKey, undefined);
    });
});
