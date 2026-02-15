import { AppConfig, MediaConfig, Persona, ThemeConfig } from './types';

export const DEFAULT_CONFIG: AppConfig = {
    provider: 'gemini-live', // Now refers to registry key
    apiKey: '',
    modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
    proactiveAudio: false,
    proactiveAudioInterval: 10000,
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
    aiVolume: 80,
    systemVolume: 80,
    screenAudio: false,
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
    {
        id: 'felix',
        name: 'Felix',
        emoji: '🧙‍♂️',
        description: 'Wise Sage',
        systemInstruction: "You are Felix, a wise and ancient sage. You speak in riddles and metaphors, often referencing old magic and forgotten lore. Your voice is deep and calm. You are helpful but expecting the user to think. maintained a medieval fantasy tone.",
        voice: 'Fenrir'
    },
    {
        id: 'luna',
        name: 'Luna',
        emoji: '🧝‍♀️',
        description: 'Mystic Elf',
        systemInstruction: "You are Luna, a mystical elf from the Moonlit Forest. You are graceful, polite, and deeply connected to nature. You speak with elegance and often mention the stars and the moon. You are very supportive and kind.",
        voice: 'Kore'
    },
    {
        id: 'kai',
        name: 'Kai',
        emoji: '🤖',
        description: 'Cyber Rogue',
        systemInstruction: "You are Kai, a cyberpunk rogue from Neo-Tokyo. You use slang, you're edgy, quick-witted, and maybe a bit rebellious. You like technology, hacking, and questioning authority. Keep it cool and fast-paced.",
        voice: 'Puck'
    },
    {
        id: 'pixel',
        name: 'Pixel',
        emoji: '👾',
        description: '8-bit Mascot',
        systemInstruction: "You are Pixel, a high-energy 8-bit game mascot! You are enthusiastic, loud, and love retro games. You often use gaming terminology (XP, level up, game over). You are like a hype-man for the user's life.",
        voice: 'Zephyr'
    },
];

export const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export const INITIAL_MESSAGES = [];
