export type Provider = string; // Support dynamic providers from registry
export type VadSensitivity = 'high' | 'medium' | 'low' | 'default';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface PersonaVoiceConfig {
    voice?: string;        // native voice name (websocket models)
    ttsEngine?: string;    // TTS engine (REST models)
    ttsVoice?: string;     // TTS voice (REST models)
}

export interface Persona {
    id: string;
    name: string;
    emoji: string;
    description: string;
    systemInstruction: string;
    voiceDefaults: Record<string, PersonaVoiceConfig>; // keyed by provider ID
}

export interface AppConfig {
    // Model & Connection
    provider: Provider;
    apiKey: string;
    modelId: string;

    // Feature Toggles
    proactiveAudio: boolean;
    proactiveAudioInterval: number;
    inputTranscription: boolean;
    outputTranscription: boolean;
    googleGrounding: boolean;
    affectiveDialog: boolean;

    // VAD
    endSpeechSensitivity: VadSensitivity;
    startSpeechSensitivity: VadSensitivity;

    // Persona
    selectedPersonaId: string;
    systemInstructions: string;
    voice: string;

    // Audio Engine
    temperature: number;
    silenceDuration: number;

    // Client VAD
    enableVAD: boolean; // Renamed from clientVAD
    prefixPadding: number;

    // REST Specifics
    topP: number;
    topK: number;
    thinkingBudget: number;

    // TTS Configuration
    ttsEngine: 'browser' | 'gemini';
    ttsVoice: string;
    ttsRate: number;
    ttsPitch: number;
}

export interface ThemeConfig {
    backgroundImage: string; // URL
    opacity: {
        header: number;             // App Header
        sidebar: number;            // Chat Sidebar
        toolbar: number;            // Workspace Top Toolbar
        toolbelt: number;           // Workspace Bottom Toolbelt
        workspaceBackground: number;// Main Workspace Container Background
        general: number;            // Dialogs / Menus
        configurationMenu: number;
        mediaControlHub: number;
        chatMessage: number;
        mainStage: number;
        chatFeed: number;
        sidebarHeader: number;
        sidebarInput: number;
    };
    blur: number; // Backdrop blur
    userAssets?: {
        startScreenUrl?: string; // Image or Video URL
        startScreenAudio?: boolean; // Enable audio for start screen
    };
}


export interface Message {
    id: string;
    sender: string;
    text: string;
    type: 'user' | 'assistant' | 'system' | 'user-transcript';
    timestamp: Date;
    isMod?: boolean;
    isFinished?: boolean;
}

export interface MediaConfig {
    microphoneId: string;
    cameraId: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
    screenShareEnabled: boolean;
    aiVolume: number;
    systemVolume: number;
    screenAudio: boolean;
    audioOutputDevice: string;
}
