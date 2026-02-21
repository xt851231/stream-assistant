import { AppConfig } from '../types';
import { PERSONAS, VOICES } from '../constants';

export { PERSONAS, VOICES };

/**
 * Fields that are shared across ALL models and persist when switching modes.
 * Everything else is model+persona-specific and stored independently.
 */
export const COMMON_FIELDS: (keyof AppConfig)[] = ['apiKey', 'selectedPersonaId'];
export const COMMON_STORAGE_KEY = 'app_common_config';

export function getStorageKey(modelId: string, personaId: string): string {
    return `config_${modelId}_${personaId}`;
}

/** Extract only the common (cross-model) fields from a full config */
export function extractCommonConfig(config: Partial<AppConfig>): Partial<AppConfig> {
    const common: Partial<AppConfig> = {};
    for (const field of COMMON_FIELDS) {
        if ((config as any)[field] !== undefined) {
            (common as any)[field] = (config as any)[field];
        }
    }
    return common;
}

/** Extract model-specific fields (everything except common fields) */
export function extractModelConfig(config: Partial<AppConfig>): Partial<AppConfig> {
    const modelConfig = { ...config };
    for (const field of COMMON_FIELDS) {
        delete (modelConfig as any)[field];
    }
    return modelConfig;
}

/** Save a full config to localStorage as common + model-specific */
export function saveConfig(config: AppConfig): void {
    // Always save common fields
    const common = extractCommonConfig(config);
    localStorage.setItem(COMMON_STORAGE_KEY, JSON.stringify(common));

    // Save model-specific fields under provider+persona key
    const provider = config.provider || 'gemini-live';
    const personaId = config.selectedPersonaId || 'felix';
    const modelConfig = extractModelConfig(config);
    localStorage.setItem(getStorageKey(provider, personaId), JSON.stringify(modelConfig));
}

/** Load a full config from localStorage by merging common + model-specific */
export function loadConfig(provider: string, personaId: string, defaults: AppConfig): AppConfig {
    let result = { ...defaults };

    // Load common config first
    try {
        const savedCommon = localStorage.getItem(COMMON_STORAGE_KEY);
        if (savedCommon) {
            const parsed = JSON.parse(savedCommon);
            result = { ...result, ...parsed };
        }
    } catch (e) { /* ignore parse errors */ }

    // Load model-specific config
    try {
        const modelKey = getStorageKey(provider, personaId);
        const savedModel = localStorage.getItem(modelKey);
        if (savedModel) {
            const parsed = JSON.parse(savedModel);
            // Merge model-specific fields but preserve common fields from above
            const common = extractCommonConfig(result);
            result = { ...result, ...parsed, ...common };
        }
    } catch (e) { /* ignore parse errors */ }

    // Ensure provider is set correctly
    result.provider = provider;
    return result;
}

export function getEffectiveSettings(requiresTTS: boolean, settings: string[]): string[] {
    if (!requiresTTS) return settings;

    const personaIndex = settings.indexOf('persona');
    if (personaIndex === -1) return settings;

    const newSettings = [...settings];
    // Inject TTS settings immediately after 'persona'
    newSettings.splice(personaIndex + 1, 0, 'ttsEngine', 'ttsVoice', 'ttsRate', 'ttsPitch');
    return newSettings;
}

export const PROVIDERS = {
    google: { id: 'google', name: 'Google Gemini', disabled: false }
};

export const MODEL_REGISTRY: Record<string, any> = {
    'gemini-live': {
        id: 'gemini-live',
        label: 'Gemini Live (WebSocket)',
        providerId: 'google',
        modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
        protocol: 'websocket',
        uiGroups: [
            {
                id: 'system',
                label: 'System',
                icon: 'settings',
                sections: [
                    { title: 'Connection', settings: ['apiKey', 'modelId'] },
                    { title: 'Behavior', settings: ['persona', 'systemInstructions', 'voice', 'temperature'] },
                    { title: 'Features', settings: ['googleGrounding', 'inputTranscription', 'outputTranscription', 'proactiveAudio', 'proactiveAudioInterval', 'affectiveDialog'] },
                    { title: 'Client VAD', settings: ['enableVAD', 'silenceDuration', 'prefixPadding'] },
                    { title: 'Server VAD (Gemini Live)', settings: ['startSpeechSensitivity', 'endSpeechSensitivity'] }
                ]
            }
        ]
    },
    'gemini-flash-rest': {
        id: 'gemini-flash-rest',
        label: 'Gemini Flash (REST)',
        providerId: 'google',
        modelId: 'gemini-2.5-flash',
        protocol: 'rest',
        requiresTTS: true,
        uiGroups: [
            {
                id: 'system',
                label: 'System',
                icon: 'settings',
                sections: [
                    { title: 'Connection', settings: ['apiKey', 'modelId'] },
                    { title: 'Behavior', settings: ['persona', 'systemInstructions', 'temperature'] },
                    { title: 'Features', settings: ['googleGrounding', 'affectiveDialog'] },
                    { title: 'Reasoning', settings: ['thinkingBudget', 'topP', 'topK'] },
                    { title: 'Client VAD', settings: ['enableVAD', 'silenceDuration', 'prefixPadding'] },
                ]
            }
        ]
    }
};

export const FIELD_DEFINITIONS: Record<string, any> = {
    apiKey: { label: 'API Key', type: 'password', placeholder: 'Enter API Key' },
    modelId: { label: 'Model ID', type: 'text', placeholder: 'e.g. gemini-2.0-flash' },
    systemInstructions: { label: 'System Instructions', type: 'textarea', rows: 4, placeholder: 'You are a helpful assistant...' },
    voice: { label: 'Voice', type: 'select', options: VOICES.map(v => ({ value: v, label: v })), defaultValue: 'Puck' },
    temperature: { label: 'Temperature', type: 'slider', min: 0, max: 2, step: 0.1, defaultValue: 0.7 },
    topP: { label: 'Top P', type: 'slider', min: 0, max: 1, step: 0.05, defaultValue: 0.95 },
    topK: { label: 'Top K', type: 'slider', min: 1, max: 100, step: 1, defaultValue: 64 },
    thinkingBudget: { label: 'Thinking Budget', type: 'slider', min: 0, max: 32768, step: 1024, defaultValue: 0 },
    proactiveAudio: { label: 'Proactive Audio', type: 'checkbox', defaultValue: false },
    proactiveAudioInterval: { label: 'Proactive Interval (ms)', type: 'slider', min: 1000, max: 60000, step: 1000, defaultValue: 10000 },
    affectiveDialog: { label: 'Affective Dialog', type: 'checkbox', defaultValue: true },
    inputTranscription: { label: 'Input Transcription', type: 'checkbox', defaultValue: true },
    outputTranscription: { label: 'Output Transcription', type: 'checkbox', defaultValue: true },
    googleGrounding: { label: 'Google Grounding', type: 'checkbox', defaultValue: false },

    // TTS
    ttsEngine: {
        label: 'TTS Engine', type: 'select', options: [
            { value: 'gemini', label: 'Gemini (Native)' },
            { value: 'browser', label: 'Browser (Web Speech)' }
        ], defaultValue: 'gemini'
    },
    ttsVoice: { label: 'TTS Voice', type: 'select', options: VOICES.map(v => ({ value: v, label: v })), defaultValue: 'Puck' },
    ttsRate: { label: 'TTS Rate', type: 'slider', min: 0.5, max: 2.0, step: 0.1, defaultValue: 1.0 },
    ttsPitch: { label: 'TTS Pitch', type: 'slider', min: 0.5, max: 2.0, step: 0.1, defaultValue: 1.0 },

    // VAD
    // VAD
    enableVAD: { label: 'Enable Client VAD', type: 'checkbox', defaultValue: true },
    silenceDuration: { label: 'Silence Duration (ms)', type: 'slider', min: 0, max: 5000, step: 100, defaultValue: 500 },
    prefixPadding: { label: 'Prefix Padding (ms)', type: 'slider', min: 0, max: 1000, step: 100, defaultValue: 300 },
    startSpeechSensitivity: {
        label: 'Start Sensitivity', type: 'select', options: [
            { value: 'default', label: 'Default' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' }
        ], defaultValue: 'default'
    },
    endSpeechSensitivity: {
        label: 'End Sensitivity', type: 'select', options: [
            { value: 'default', label: 'Default' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' }
        ], defaultValue: 'default'
    },
};
