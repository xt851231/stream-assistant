import { AppConfig, MediaConfig, Persona, ThemeConfig } from './types';

export const DEFAULT_CONFIG: AppConfig = {
    provider: 'gemini-live', // Now refers to registry key
    apiKey: '',
    modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
    proactiveAudio: false,
    inputTranscription: true,
    outputTranscription: true,
    googleGrounding: false,
    affectiveDialog: true,
    endSpeechSensitivity: 'default',
    startSpeechSensitivity: 'default',
    selectedPersonaId: 'felix',
    systemInstructions: 'You are a helpful retro gaming assistant.',
    voice: 'Puck',
    temperature: 0.7,
    silenceDuration: 500,
    enableVAD: true,
    prefixPadding: 300,
    topP: 0.95,
    topK: 64,
    thinkingBudget: 0,
};

export const DEFAULT_MEDIA_CONFIG: MediaConfig = {
    microphoneId: 'default',
    cameraId: 'default',
    audioEnabled: true,
    videoEnabled: true,
    screenShareEnabled: false,
    volume: 80,
};

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
    backgroundImage: '',
    opacity: {
        header: 0.9,
        sidebar: 0.9,
        toolbar: 0.9,
        toolbelt: 0.9,
        workspaceBackground: 0.8,
        general: 0.9,
        configurationMenu: 0.95,
        mediaControlHub: 0.9,
        chatMessage: 0.8,
        mainStage: 0.8,
        chatFeed: 0.8,
        sidebarHeader: 0.9,
        sidebarInput: 0.9,
    },
    blur: 8,
    userAssets: {
        startScreenUrl: '',
        startScreenAudio: false,
    }
};

export const PERSONAS: Persona[] = [
    { id: 'felix', name: 'Felix', emoji: '🧙‍♂️', description: 'Wise Sage' },
    { id: 'luna', name: 'Luna', emoji: '🧝‍♀️', description: 'Mystic Elf' },
    { id: 'kai', name: 'Kai', emoji: '🤖', description: 'Cyber Rogue' },
    { id: 'pixel', name: 'Pixel', emoji: '👾', description: '8-bit Mascot' },
];

export const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export const INITIAL_MESSAGES = [];
