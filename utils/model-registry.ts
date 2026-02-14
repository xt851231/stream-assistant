
import { PERSONAS, VOICES } from '../constants';

export { PERSONAS, VOICES };

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
        uiGroups: [
            {
                id: 'system',
                label: 'System',
                icon: 'settings',
                sections: [
                    { title: 'Connection', settings: ['apiKey', 'modelId'] },
                    { title: 'Behavior', settings: ['persona', 'systemInstructions', 'temperature'] },
                    { title: 'Features', settings: ['affectiveDialog'] },
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
