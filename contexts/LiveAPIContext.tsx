import React, { createContext, useContext, useState, useRef, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { AppConfig, MediaConfig, Message } from '../types';
import { ModelClient } from '../lib/api/ModelClient';
import { AudioStreamer, VideoStreamer, ScreenCapture, AudioPlayer } from '../lib/utils/media-utils';
import { MODEL_REGISTRY } from '../utils/model-registry';
import { PERSONAS } from '../constants';
import { calculateNextProactiveTime } from '../lib/utils/scheduler-utils';


interface LiveAPIContextType {
    connected: boolean;
    connecting: boolean;
    connect: (config: AppConfig) => Promise<void>;
    disconnect: () => Promise<void>;
    sendMessage: (text: string, config: AppConfig) => void;
    toggleAudio: (enabled: boolean, micId: string, config: AppConfig) => Promise<void>;
    toggleVideo: (enabled: boolean, camId: string, config: AppConfig) => Promise<void>;
    toggleScreen: (enabled: boolean, config: AppConfig, screenAudio?: boolean) => Promise<void>;
    messages: Message[];
    audioStreaming: boolean;
    videoStreaming: boolean;
    screenSharing: boolean;
    videoStream: MediaStream | null;
    cameraStream: MediaStream | null;
    setOverlayCanvas: (canvas: HTMLCanvasElement | null) => void;
    setConfig: (config: Partial<AppConfig>) => void;
}

const LiveAPIContext = createContext<LiveAPIContextType | undefined>(undefined);

export const LiveAPIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);

    // Media State
    const [audioStreaming, setAudioStreaming] = useState(false);
    const [videoStreaming, setVideoStreaming] = useState(false);
    const [screenSharing, setScreenSharing] = useState(false);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

    // Refs
    // Use any for the ported JS classes for now to avoid strict TS issues
    const clientRef = useRef<any>(null);
    const audioStreamerRef = useRef<any>(null);
    const videoStreamerRef = useRef<any>(null);
    const screenCaptureRef = useRef<any>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const audioPlayerRef = useRef<any>(null);
    const activeToolsMapRef = useRef<Record<string, any>>({});
    const latestConfigRef = useRef<AppConfig | null>(null);
    const lastUserSpeechTimeRef = useRef<number>(Date.now());
    const nextProactiveInteractionTimeRef = useRef<number>(0);
    const isModelRespondingRef = useRef<boolean>(false);

    // Helper to schedule next proactive interaction with jitter
    const scheduleNextProactive = useCallback(() => {
        const config = latestConfigRef.current;
        if (!config?.proactiveAudio) return;

        const baseInterval = config.proactiveAudioInterval || 10000;
        const nextTime = calculateNextProactiveTime(baseInterval);

        nextProactiveInteractionTimeRef.current = nextTime;
        console.log(`⏰ Next proactive nudge scheduled for ${new Date(nextTime).toLocaleTimeString()} (Interval: ${baseInterval}ms)`);
    }, []);

    // Proactive Audio Logic
    useEffect(() => {
        if (!connected) return;

        // Schedule initial nudge on connect
        scheduleNextProactive();

        const interval = setInterval(() => {
            // Check if proactive audio is enabled in the LATEST config
            if (!latestConfigRef.current?.proactiveAudio) return;

            // Don't nudge if model is currently responding or user is speaking
            if (isModelRespondingRef.current) return;
            if (audioStreamerRef.current?.isSpeaking) return;

            if (Date.now() > nextProactiveInteractionTimeRef.current) {
                console.log("⏰ Proactive Nudge triggered!");
                // Send a neutral prompt to encourage the model to speak
                clientRef.current?.sendText(" ");
                isModelRespondingRef.current = true; // Assume model will respond

                // Reschedule next one
                scheduleNextProactive();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [connected, scheduleNextProactive]);

    // Helper to add messages
    const addMessage = (text: string, type: 'user' | 'assistant' | 'system' | 'user-transcript', isFinished: boolean = false) => {
        setMessages(prev => {
            // Logic to append to last message if it's the same type and not finished
            // Simplified for now, logic ported from LiveAPIDemo
            // We can enhance this to match the exact behavior if needed
            if (prev.length > 0) {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg.type === type && !lastMsg.isFinished) {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        ...lastMsg,
                        text: lastMsg.text + text,
                        isFinished: isFinished
                    };
                    return updated;
                }
            }

            // Determine sender name based on type and persona
            let senderName = 'System';
            if (type === 'user' || type === 'user-transcript') {
                senderName = 'You';
            } else if (type === 'assistant') {
                // Use persona name if available
                const currentPersonaId = latestConfigRef.current?.selectedPersonaId;
                const persona = PERSONAS.find(p => p.id === currentPersonaId);
                senderName = persona ? persona.name : 'Gemini';
            }

            return [...prev, {
                id: crypto.randomUUID(),
                sender: senderName,
                text: text || '',
                type: type,
                timestamp: new Date(),
                isFinished: isFinished
            }];
        });
    };

    const handleMessage = (message: any) => {
        switch (message.type) {
            case 'text':
                isModelRespondingRef.current = true;
                addMessage(message.data, 'assistant', message.endOfTurn);
                break;
            case 'audio':
                isModelRespondingRef.current = true;
                if (audioPlayerRef.current) {
                    audioPlayerRef.current.play(message.data);
                } else {
                    console.warn('⚠️ Audio player not initialized');
                }
                break;
            case 'input_transcription':
                addMessage(message.data.text, 'user-transcript', message.data.finished);
                break;
            case 'output_transcription':
                addMessage(message.data.text, 'assistant', message.data.finished);
                break;
            case 'setup_complete':
                const currentPersonaId = latestConfigRef.current?.selectedPersonaId;
                const persona = PERSONAS.find(p => p.id === currentPersonaId);
                const welcomeMsg = persona ? `${persona.name} is online` : "Connected and ready!";
                addMessage(welcomeMsg, 'system', true);
                break;
            case 'tool_call':
                const functionCalls = message.data.functionCalls;
                functionCalls.forEach((call: any) => {
                    const tool = activeToolsMapRef.current[call.name];
                    if (tool) {
                        tool.runFunction(call.args);
                    } else {
                        console.warn(`Unknown tool called: ${call.name}`);
                    }
                });
                break;
            case 'interrupted':
                isModelRespondingRef.current = false;
                addMessage("[Interrupted]", 'system', true);
                if (audioPlayerRef.current) audioPlayerRef.current.interrupt();
                // Reschedule proactive timer after interruption
                scheduleNextProactive();
                break;
            case 'turn_complete':
                isModelRespondingRef.current = false;
                // Mark the last message as finished so next response starts a new entry
                setMessages(prev => {
                    if (prev.length > 0 && !prev[prev.length - 1].isFinished) {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            ...updated[updated.length - 1],
                            isFinished: true
                        };
                        return updated;
                    }
                    return prev;
                });
                // Model finished responding — reschedule the proactive timer
                scheduleNextProactive();
                break;
            case 'error':
                isModelRespondingRef.current = false;
                addMessage(`Error: ${message.data}`, 'system', true);
                break;
        }
    };

    const connect = async (config: AppConfig) => {
        if (connecting || connected) return;
        setConnecting(true);
        latestConfigRef.current = config;

        try {
            // Re-create client
            const modelDef = MODEL_REGISTRY[config.provider];
            const adapterType = modelDef?.protocol === 'websocket' ? 'live' : 'flash';
            clientRef.current = ModelClient.createAdapter(adapterType, {
                apiKey: config.apiKey,
                modelId: config.modelId,
                voice: config.voice,
                systemInstruction: config.systemInstructions,
                temperature: config.temperature,
                topP: config.topP,
                topK: config.topK,
                thinkingBudget: config.thinkingBudget,
                affectiveDialog: config.affectiveDialog,
                inputTranscription: config.inputTranscription,
                outputTranscription: config.outputTranscription,
                enableVAD: config.enableVAD,
                silenceDuration: config.silenceDuration,
                prefixPadding: config.prefixPadding,
                startSpeechSensitivity: config.startSpeechSensitivity === 'default' ? 'START_SENSITIVITY_UNSPECIFIED' : config.startSpeechSensitivity === 'high' ? 'START_SENSITIVITY_HIGH' : config.startSpeechSensitivity === 'medium' ? 'START_SENSITIVITY_MEDIUM' : 'START_SENSITIVITY_LOW',
                endSpeechSensitivity: config.endSpeechSensitivity === 'default' ? 'END_SENSITIVITY_UNSPECIFIED' : config.endSpeechSensitivity === 'high' ? 'END_SENSITIVITY_HIGH' : config.endSpeechSensitivity === 'medium' ? 'END_SENSITIVITY_MEDIUM' : 'END_SENSITIVITY_LOW',
            });

            clientRef.current.on('content', handleMessage);
            clientRef.current.on('open', () => {
                setConnected(true);
                setConnecting(false);
            });
            clientRef.current.on('close', () => {
                setConnected(false);
                setConnecting(false);
                // Media streams are intentionally NOT cleaned up here.
                // They persist independently and are re-attached on reconnect.
            });
            clientRef.current.on('error', (err: any) => {
                console.error("Adapter Error:", err);
                setConnecting(false);
            });

            // Setup Tools
            const tools = [];
            const functionDecls = [];
            const activeTools: Record<string, any> = {};

            if (config.googleGrounding) {
                tools.push({ googleSearch: {} });
            }


            // ... Add other tools

            if (functionDecls.length > 0) {
                tools.push({ functionDeclarations: functionDecls });
            }
            activeToolsMapRef.current = activeTools;
            clientRef.current.setTools(tools);

            const success = await clientRef.current.connect();
            if (success) {
                // Init Audio Player
                if (!audioPlayerRef.current) {
                    audioPlayerRef.current = new AudioPlayer();
                }
                await audioPlayerRef.current.init();

                // Initialize Streamers
                // We don't start them yet, just prep
            } else {
                setConnecting(false);
            }

        } catch (e) {
            console.error(e);
            setConnecting(false);
        }
    };

    const cleanupMedia = async () => {
        if (audioStreamerRef.current) await audioStreamerRef.current.stop();
        if (videoStreamerRef.current) await videoStreamerRef.current.stop();
        if (screenCaptureRef.current) await screenCaptureRef.current.stop();
        setAudioStreaming(false);
        setVideoStreaming(false);
        setScreenSharing(false);
        setVideoStream(null);
        setCameraStream(null);
    };

    const disconnect = async () => {
        if (clientRef.current) clientRef.current.disconnect();
        await cleanupMedia();
        setConnected(false);
        setConnecting(false);
    };

    const sendMessage = (text: string, config: AppConfig) => {
        if (clientRef.current) {
            addMessage(text, 'user', true);

            let imageBase64 = null;

            // Capture image if streaming
            try {
                if (screenSharing && screenCaptureRef.current) {
                    imageBase64 = screenCaptureRef.current.takeSnapshot().split(',')[1];
                } else if (videoStreaming && videoStreamerRef.current) {
                    imageBase64 = videoStreamerRef.current.takeSnapshot().split(',')[1];
                }
            } catch (e) {
                console.error("Failed to capture snapshot for message:", e);
            }

            clientRef.current.sendText(text, imageBase64);
            // Reset proactive timer since user just interacted
            scheduleNextProactive();
        }
    };

    // Toggle Functions
    const toggleAudio = async (enabled: boolean, micId: string, config: AppConfig) => {
        if (enabled) {
            // Always create a fresh AudioStreamer to avoid stale AudioContext issues
            if (clientRef.current) {
                audioStreamerRef.current = new AudioStreamer(clientRef.current);
            }
            if (audioStreamerRef.current) {
                audioStreamerRef.current.vadEnabled = config.enableVAD;
                audioStreamerRef.current.vadSpeechHoldTime = config.silenceDuration;

                // Hook up VAD status to control video transmission
                audioStreamerRef.current.onSpeechStatusChange = (isSpeaking: boolean) => {
                    if (isSpeaking) {
                        lastUserSpeechTimeRef.current = Date.now();
                        // Reset proactive timer when user speaks
                        scheduleNextProactive();
                    }

                    if (config.enableVAD) {
                        if (videoStreamerRef.current) {
                            videoStreamerRef.current.transmitFrames = isSpeaking;
                        }
                        if (screenCaptureRef.current) {
                            screenCaptureRef.current.transmitFrames = isSpeaking;
                        }
                    }
                };

                try {
                    await audioStreamerRef.current.start(micId === 'default' ? undefined : micId);
                    setAudioStreaming(true);
                } catch (e) {
                    console.error('Failed to start audio:', e);
                    audioStreamerRef.current = null;
                }
            }
        } else {
            if (audioStreamerRef.current) {
                await audioStreamerRef.current.stop();
                audioStreamerRef.current = null; // Ensure fresh instance next time
            }
            setAudioStreaming(false);
        }
    };

    const toggleVideo = async (enabled: boolean, camId: string, config: AppConfig) => {
        if (enabled) {
            if (!videoStreamerRef.current && clientRef.current) {
                videoStreamerRef.current = new VideoStreamer(clientRef.current);
            }
            if (videoStreamerRef.current) {
                const video = await videoStreamerRef.current.start({
                    deviceId: camId === 'default' ? undefined : camId
                });

                // Apply overlay if available
                if (overlayCanvasRef.current && videoStreamerRef.current) {
                    videoStreamerRef.current.setOverlayCanvas(overlayCanvasRef.current);
                }

                // Configure Video Transmission Strategy
                if (videoStreamerRef.current) {
                    videoStreamerRef.current.alwaysTransmit = !config.enableVAD;
                }

                setCameraStream(video.srcObject);

                // If screen sharing is NOT active, update the main video stream
                // If screen sharing IS active, we start the camera in background but don't show it 
                // (except maybe in a PiP which is handled by UI, but here 'videoStream' implies the main view)
                if (!screenSharing) {
                    setVideoStream(video.srcObject);
                }
                setVideoStreaming(true);
            }
        } else {
            if (videoStreamerRef.current) await videoStreamerRef.current.stop();
            setVideoStreaming(false);
            setCameraStream(null);
            if (!screenSharing) setVideoStream(null);
        }
    };

    const toggleScreen = async (enabled: boolean, config: AppConfig, screenAudio?: boolean) => {
        if (enabled) {
            if (!screenCaptureRef.current && clientRef.current) {
                screenCaptureRef.current = new ScreenCapture(clientRef.current);
            }
            if (screenCaptureRef.current) {
                const video = await screenCaptureRef.current.start({
                    audio: screenAudio
                });
                setScreenSharing(true);

                // Apply overlay if available
                if (overlayCanvasRef.current && screenCaptureRef.current) {
                    screenCaptureRef.current.setOverlayCanvas(overlayCanvasRef.current);
                }

                // Configure Screen Transmission Strategy
                if (screenCaptureRef.current) {
                    screenCaptureRef.current.alwaysTransmit = !config.enableVAD;
                }

                // If Camera was already streaming, we move it to background (in UI)
                // We update main videoStream to be the screen share
                setVideoStream(video.srcObject);
            }
        } else {
            if (screenCaptureRef.current) await screenCaptureRef.current.stop();
            setScreenSharing(false);

            // Revert to camera if active
            if (videoStreaming && videoStreamerRef.current) {
                // Check if the video streamer still has an active stream
                const cameraVideo = videoStreamerRef.current.getVideoElement();
                if (cameraVideo && cameraVideo.srcObject) {
                    setVideoStream(cameraVideo.srcObject);
                } else {
                    // Should potentially restart or handle error, but usually it stays active
                    setVideoStream(null);
                }
            } else {
                setVideoStream(null);
            }
        }
    };

    const setOverlayCanvas = (canvas: HTMLCanvasElement | null) => {
        overlayCanvasRef.current = canvas;
        if (videoStreamerRef.current) {
            videoStreamerRef.current.setOverlayCanvas(canvas);
        }
        if (screenCaptureRef.current) {
            screenCaptureRef.current.setOverlayCanvas(canvas);
        }
    };

    const setConfig = useCallback(async (configUpdate: Partial<AppConfig>) => {
        if (!clientRef.current || !latestConfigRef.current) return;

        // Merge the update into the stored config
        const newConfig = { ...latestConfigRef.current, ...configUpdate };
        latestConfigRef.current = newConfig;

        // For Live API, we need to reconnect to apply config changes
        const modelDef = MODEL_REGISTRY[newConfig.provider];
        if (modelDef?.protocol === 'websocket' && connected) {
            console.log('🔄 Config changed, reconnecting with new settings (media streams preserved)...');

            // Neutralize old adapter's handlers so its close event doesn't override new state
            clientRef.current.removeAllListeners();
            clientRef.current.disconnect();

            // Create new adapter with updated config
            const adapterType = 'live';
            clientRef.current = ModelClient.createAdapter(adapterType, {
                apiKey: newConfig.apiKey,
                modelId: newConfig.modelId,
                voice: newConfig.voice,
                systemInstruction: newConfig.systemInstructions,
                temperature: newConfig.temperature,
                topP: newConfig.topP,
                topK: newConfig.topK,
                thinkingBudget: newConfig.thinkingBudget,
                affectiveDialog: newConfig.affectiveDialog,
                inputTranscription: newConfig.inputTranscription,
                outputTranscription: newConfig.outputTranscription,
                enableVAD: newConfig.enableVAD,
                silenceDuration: newConfig.silenceDuration,
                prefixPadding: newConfig.prefixPadding,
                startSpeechSensitivity: newConfig.startSpeechSensitivity === 'default' ? 'START_SENSITIVITY_UNSPECIFIED' : newConfig.startSpeechSensitivity === 'high' ? 'START_SENSITIVITY_HIGH' : newConfig.startSpeechSensitivity === 'medium' ? 'START_SENSITIVITY_MEDIUM' : 'START_SENSITIVITY_LOW',
                endSpeechSensitivity: newConfig.endSpeechSensitivity === 'default' ? 'END_SENSITIVITY_UNSPECIFIED' : newConfig.endSpeechSensitivity === 'high' ? 'END_SENSITIVITY_HIGH' : newConfig.endSpeechSensitivity === 'medium' ? 'END_SENSITIVITY_MEDIUM' : 'END_SENSITIVITY_LOW',
            });

            // Re-attach event handlers
            clientRef.current.on('content', handleMessage);
            clientRef.current.on('open', () => {
                setConnected(true);
                setConnecting(false);
            });
            clientRef.current.on('close', () => {
                setConnected(false);
                setConnecting(false);
            });
            clientRef.current.on('error', (err: any) => {
                console.error('Adapter Error:', err);
                setConnecting(false);
            });

            // Re-attach tools
            const tools = [];
            const functionDecls = [];
            if (newConfig.googleGrounding) {
                tools.push({ googleSearch: {} });
            }
            if (functionDecls.length > 0) {
                tools.push({ functionDeclarations: functionDecls });
            }
            clientRef.current.setTools(tools);

            // Reconnect
            setConnecting(true);
            const success = await clientRef.current.connect();
            if (success) {
                // Re-point active streamers to the new adapter
                if (audioStreamerRef.current) {
                    audioStreamerRef.current.setClient(clientRef.current);
                }
                if (videoStreamerRef.current) {
                    videoStreamerRef.current.setClient(clientRef.current);
                }
                if (screenCaptureRef.current) {
                    screenCaptureRef.current.setClient(clientRef.current);
                }
                console.log('✅ Reconnected with new config. Media streams preserved.');
            } else {
                setConnecting(false);
            }
        } else {
            // For Flash/REST API, just update config in-place
            clientRef.current.updateConfig(configUpdate);
        }
    }, [connected]);


    const contextValue = useMemo(() => ({
        connected,
        connecting,
        connect,
        disconnect,
        sendMessage,
        toggleAudio,
        toggleVideo,
        toggleScreen,
        messages,
        audioStreaming,
        videoStreaming,
        screenSharing,
        videoStream,
        cameraStream,
        setOverlayCanvas,
        setConfig
    }), [
        connected,
        connecting,
        connect,
        disconnect,
        sendMessage,
        toggleAudio,
        toggleVideo,
        toggleScreen,
        messages,
        audioStreaming,
        videoStreaming,
        screenSharing,
        videoStream,
        cameraStream,
        setOverlayCanvas,
        setConfig
    ]);

    return (
        <LiveAPIContext.Provider value={contextValue}>
            {children}
        </LiveAPIContext.Provider>
    );
};

export const useLiveAPI = () => {
    const context = useContext(LiveAPIContext);
    if (!context) {
        throw new Error('useLiveAPI must be used within a LiveAPIProvider');
    }
    return context;
};
