import React, { useState } from 'react';
import { AppConfig, MediaConfig, ConnectionState, Message, ThemeConfig } from './types';
import { DEFAULT_CONFIG, DEFAULT_MEDIA_CONFIG, INITIAL_MESSAGES, DEFAULT_THEME_CONFIG } from './constants';
import { loadModelConfig, saveModelConfig } from './utils/model-registry';
import { safeJsonParse, validateAndMergeConfig } from './utils/storage-utils';
import ConfigurationMenu from './components/ConfigurationMenu';
import MediaControlHub from './components/MediaControlHub';
import Stage from './components/Stage';
import Toolbelt from './components/Toolbelt';
import ChatSidebar from './components/ChatSidebar';
import { useLiveAPI } from './hooks/useLiveAPI';
import { Swords, Zap, Settings, Video, MessageSquare, Smartphone } from 'lucide-react';
import { getBgColor } from './lib/utils/style-utils';
import { useTranslation } from 'react-i18next';

const App: React.FC = () => {
    const { i18n } = useTranslation();
    // Context
    const {
        connected,
        connecting,
        connect,
        disconnect,
        messages,
        sendMessage,
        toggleAudio,
        toggleVideo,
        toggleScreen,
        videoStream,
        cameraStream,
        screenSharing,
        audioStreaming,
        videoStreaming,
        setOverlayCanvas,
        setConfig: setLiveConfig // Rename to avoid collision with state setter
    } = useLiveAPI();

    // State
    const [config, setConfig] = useState<AppConfig>(() => {
        try {
            // Determine which model was last used
            const routing = localStorage.getItem('app_config');
            let provider = DEFAULT_CONFIG.provider;
            if (routing) {
                const parsed = safeJsonParse(routing);
                if (parsed && parsed.provider) provider = parsed.provider;
            }
            // Load the full config for that model
            return loadModelConfig(provider);
        } catch (e) {
            console.error("Failed to load config from localStorage", e);
        }
        return DEFAULT_CONFIG;
    });

    const [mediaConfig, setMediaConfig] = useState<MediaConfig>(() => {
        const savedConfig = localStorage.getItem('media_config');
        const parsed = safeJsonParse(savedConfig);
        const validated = validateAndMergeConfig(DEFAULT_MEDIA_CONFIG, parsed);
        // Always start with screen sharing disabled to avoid permission prompts on reload
        return { ...validated, screenShareEnabled: false };
    });

    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => {
        const savedConfig = localStorage.getItem('theme_config');
        const parsed = safeJsonParse(savedConfig);
        return validateAndMergeConfig(DEFAULT_THEME_CONFIG, parsed);
    });

    const [isPortrait, setIsPortrait] = useState(false);

    // Save config to localStorage whenever it changes (per-model)
    React.useEffect(() => {
        saveModelConfig(config);
    }, [config]);

    React.useEffect(() => {
        if (config.language && i18n.language !== config.language) {
            i18n.changeLanguage(config.language);
        }
    }, [config.language, i18n]);

    React.useEffect(() => {
        localStorage.setItem('media_config', JSON.stringify(mediaConfig));
    }, [mediaConfig]);

    React.useEffect(() => {
        localStorage.setItem('theme_config', JSON.stringify(themeConfig));
    }, [themeConfig]);

    // Update Config when relevant fields change (not on initial connection)
    const prevConfigRef = React.useRef<{
        systemInstructions?: string;
        voice?: string;
        selectedPersonaId?: string;
        ttsEngine?: string;
        ttsVoice?: string;
        ttsRate?: number;
        ttsPitch?: number;
    }>({});

    React.useEffect(() => {
        if (!connected) return;

        const prev = prevConfigRef.current;
        const changed = prev.systemInstructions !== config.systemInstructions
            || prev.voice !== config.voice
            || prev.selectedPersonaId !== config.selectedPersonaId
            || prev.ttsEngine !== config.ttsEngine
            || prev.ttsVoice !== config.ttsVoice
            || prev.ttsRate !== config.ttsRate
            || prev.ttsPitch !== config.ttsPitch;

        // Only update if values actually changed (skip initial mount)
        if (changed && (prev.systemInstructions !== undefined || prev.voice !== undefined || prev.selectedPersonaId !== undefined)) {
            setLiveConfig({
                systemInstructions: config.systemInstructions,
                voice: config.voice,
                selectedPersonaId: config.selectedPersonaId,
                ttsEngine: config.ttsEngine,
                ttsVoice: config.ttsVoice,
                ttsRate: config.ttsRate,
                ttsPitch: config.ttsPitch
            });
        }

        prevConfigRef.current = {
            systemInstructions: config.systemInstructions,
            voice: config.voice,
            selectedPersonaId: config.selectedPersonaId,
            ttsEngine: config.ttsEngine,
            ttsVoice: config.ttsVoice,
            ttsRate: config.ttsRate,
            ttsPitch: config.ttsPitch
        };
    }, [
        config.systemInstructions,
        config.voice,
        config.selectedPersonaId,
        config.ttsEngine,
        config.ttsVoice,
        config.ttsRate,
        config.ttsPitch,
        connected,
        setLiveConfig
    ]);

    // Derived State
    const connectionState: ConnectionState = connected ? 'connected' : connecting ? 'connecting' : 'disconnected';

    const [gameTitle, setGameTitle] = useState('bigger better sue');

    // UI Toggles
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isMediaOpen, setIsMediaOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(true);

    // Tooling
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
    const [color, setColor] = useState('#ffd700');
    const [brushSize, setBrushSize] = useState(4);

    const settingsButtonRef = React.useRef<HTMLButtonElement>(null);
    const mediaButtonRef = React.useRef<HTMLButtonElement>(null);
    const appContainerRef = React.useRef<HTMLDivElement>(null);

    // Handlers
    const handleConnect = async () => {
        if (connected) {
            await disconnect();
            // Clear local cached config so "Go Live" later starts completely clean
            setMediaConfig(prev => ({
                ...prev,
                audioEnabled: false,
                videoEnabled: false,
                screenShareEnabled: false
            }));
        } else {
            await connect(config);
        }
    };

    const handleSendMessage = React.useCallback((text: string) => {
        sendMessage(text, config);
    }, [sendMessage, config]);

    // Media Handlers
    // Media Handlers
    const handleMediaConfigChange = (newConfig: MediaConfig) => {
        console.log('🔧 handleMediaConfigChange:', newConfig);
        setMediaConfig(newConfig);

        // Direct Toggle Logic - Source of Truth is the Context
        // Audio
        if (newConfig.audioEnabled !== audioStreaming ||
            (audioStreaming && newConfig.microphoneId !== mediaConfig.microphoneId)) {
            toggleAudio(newConfig.audioEnabled, newConfig.microphoneId || 'default', config);
        }

        // Video (Camera)
        if (newConfig.videoEnabled !== videoStreaming ||
            (videoStreaming && newConfig.cameraId !== mediaConfig.cameraId)) {
            toggleVideo(newConfig.videoEnabled, newConfig.cameraId || 'default', config);
        }

        // Screen Share - Now passing screenAudio preference
        if (newConfig.screenShareEnabled !== screenSharing ||
            (screenSharing && newConfig.screenAudio !== mediaConfig.screenAudio)) {
            // Note: toggleScreen will need to handle restarting if screenAudio changed while active
            toggleScreen(newConfig.screenShareEnabled, config, newConfig.screenAudio);
        }
    };

    // Calculate effective config regarding active states from Context
    // This ensures the UI always reflects the REAL state, not just the local config
    const effectiveMediaConfig: MediaConfig = {
        ...mediaConfig,
        audioEnabled: audioStreaming,
        videoEnabled: videoStreaming,
        screenShareEnabled: screenSharing
    };

    /* 
       Refactor Note: 
       Removed previous existing Media Config Sync useEffect. 
       We now trigger toggles directly in the handler, and derive UI state from context.
       This prevents state desync and "Permission denied" loops on reload.
    */

    // ...



    const triggerClearStage = React.useCallback(() => {
        // Dispatch custom event for Stage component
        const event = new Event('STAGE_CLEAR');
        document.dispatchEvent(event);
    }, []);

    const handleCloseChat = React.useCallback(() => {
        setIsChatOpen(false);
    }, []);

    const stageStyle = React.useMemo(() => ({
        backgroundColor: getBgColor('#000000', themeConfig?.opacity?.mainStage || 0.8)
    }), [themeConfig?.opacity?.mainStage]);

    const sidebarStyle = React.useMemo(() => ({
        backgroundColor: getBgColor('#05080c', themeConfig?.opacity?.sidebar || 0.9),
        backdropFilter: themeConfig?.backgroundImage ? `blur(${(themeConfig?.blur || 0) / 2}px)` : 'none'
    }), [themeConfig?.opacity?.sidebar, themeConfig?.backgroundImage, themeConfig?.blur]);




    return (
        <div id="viewport" className="w-screen h-screen bg-[#050505] flex items-center justify-center overflow-hidden relative">
            {/* Custom Background Image Layer */}
            {themeConfig.backgroundImage && (
                <div
                    className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-500"
                    style={{
                        backgroundImage: `url(${themeConfig.backgroundImage})`,
                        filter: `blur(${themeConfig.blur}px)`
                    }}
                />
            )}

            {/* Retro Grid Background - Increased visibility - Hide if background image is present */}
            {!themeConfig.backgroundImage && (
                <div className="absolute inset-0 z-0 opacity-40 pointer-events-none"
                    style={{
                        backgroundImage: `
                        linear-gradient(rgba(50, 50, 90, 0.4) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(50, 50, 90, 0.4) 1px, transparent 1px)
                    `,
                        backgroundSize: '40px 40px',
                        maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)'
                    }}
                />
            )}

            {/* Ambient Glow - Adjusted size/blur to not overwhelm - Hide if background image is present */}
            {!themeConfig.backgroundImage && (
                <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                    <div className="aspect-video w-[95%] h-[95%] bg-blue-900/15 blur-3xl rounded-full opacity-60 animate-pulse"></div>
                </div>
            )}

            {/* Scanline Overlay - More visible */}
            <div className="absolute inset-0 z-[0] pointer-events-none opacity-[0.08]"
                style={{
                    backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
                    backgroundSize: '100% 4px, 6px 100%'
                }}
            />
            <div ref={appContainerRef} data-component="App" className={`w-full flex flex-col border-4 border-[#1e293b] relative shadow-2xl overflow-hidden shrink-0 transition-all duration-500 max-h-[96vh] ${isPortrait ? 'aspect-[9/16] max-w-[54vh]' : 'aspect-video max-w-[177.78vh]'}`}
                style={{ backgroundColor: themeConfig.backgroundImage ? 'transparent' : '#111722' }}
            >

                {/* Header with Background Image */}
                <header
                    data-component="AppHeader"
                    className="h-[8%] shrink-0 z-40 px-4 py-1 border-b-4 border-[#2b6cee] flex items-center justify-between shadow-lg relative bg-cover bg-center transition-colors duration-300"
                    style={{
                        backgroundColor: getBgColor('#0a0f16', themeConfig.opacity.header),
                        // Only show gradient if no background or high opacity? Keeping it simple for now
                        // backgroundImage: 'linear-gradient(to bottom, rgba(10, 15, 22, 0.8), rgba(10, 15, 22, 0.9))'
                        backdropFilter: themeConfig.backgroundImage ? `blur(${themeConfig.blur / 2}px)` : 'none'
                    }}
                >

                    {/* Branding */}
                    <div className="flex items-center gap-3 select-none">
                        <div className="size-8 bg-gradient-to-br from-blue-600 to-blue-900 rounded border-2 border-white flex items-center justify-center shadow-pixel-sm">
                            <Swords className="text-white" size={20} />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="font-pixel text-[10px] text-[#ffd700] mb-0.5 tracking-widest">STREAM QUEST</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] uppercase bg-green-600 px-1 rounded text-white font-bold">LVL 99</span>
                                <span className="text-[10px] text-gray-400">DASHBOARD</span>
                            </div>
                        </div>
                    </div>

                    {/* Connection Status & Action */}
                    <div className="flex items-center gap-4">
                        <div className="flex gap-1 items-center">
                            <div className={`size-2 rounded-full animate-pulse ${connectionState === 'connected' ? 'bg-green-500' :
                                connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                                }`}></div>
                            <span className={`text-[10px] font-bold tracking-wider ${connectionState === 'connected' ? 'text-green-400' :
                                connectionState === 'connecting' ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                {connectionState === 'connected' ? 'ONLINE' :
                                    connectionState === 'connecting' ? 'SYNCING...' : 'OFFLINE'}
                            </span>
                        </div>

                        <button
                            onClick={handleConnect}
                            className={`btn-pixel relative group overflow-hidden border-2 border-white text-white px-3 py-1 rounded shadow-pixel hover:brightness-110 active:shadow-none active:translate-y-[2px] ${connectionState === 'connected' ? 'bg-red-700' : 'bg-gradient-to-b from-blue-600 to-blue-800'
                                }`}
                        >
                            <div className="flex items-center gap-1.5 relative z-10">
                                <Zap size={14} fill="currentColor" />
                                <span className="font-bold text-[10px] tracking-wider font-pixel">
                                    {connectionState === 'connected' ? 'DISCONNECT' : 'GO LIVE'}
                                </span>
                            </div>
                        </button>
                    </div>
                </header>

                {/* Main Content Flex with Gap and Padding + Background Image */}
                <section
                    id="content-area"
                    className={`flex-1 flex overflow-hidden p-6 relative transition-colors duration-300 ${isPortrait ? 'flex-col gap-4 p-4' : 'flex-row'}`}
                    style={{
                        backgroundColor: themeConfig.backgroundImage ? 'rgba(17, 23, 34, 0.3)' : '#111722',
                    }}
                >

                    {/* Workspace Panel */}
                    <main data-component="AppMain" className="flex-1 flex flex-col min-w-0 rounded-xl border-2 border-[#2b6cee] shadow-2xl relative overflow-hidden transition-all duration-500"
                        style={{
                            backgroundColor: getBgColor('#05080c', themeConfig.opacity.workspaceBackground),
                            backdropFilter: themeConfig.backgroundImage ? `blur(${themeConfig.blur / 2}px)` : 'none'
                        }}
                    >

                        {/* Inner Container */}
                        <div className="flex-1 flex flex-col p-4 overflow-hidden">

                            {/* Toolbar Row */}
                            <nav
                                data-component="Toolbar"
                                className="flex justify-between items-center mb-4 shrink-0 p-2 rounded-lg transition-colors duration-300"
                                style={{ backgroundColor: getBgColor('#000000', themeConfig.opacity.toolbar * 0.5) }}
                            >
                                <div className={`relative px-4 py-2 min-w-[280px] ${isPortrait ? 'hidden' : ''}`}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-blue-800/50 to-transparent border-l-4 border-[#ffd700] transform skew-x-[-12deg] rounded-r-lg"></div>
                                    <div className="relative flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[#ffd700] text-2xl">
                                            <Swords size={28} className="text-[#ffd700]" />
                                        </span>
                                        <div className={`flex flex-col w-full ${isPortrait ? 'hidden' : ''}`}>
                                            <span className="text-[8px] text-blue-200 uppercase tracking-widest font-bold mb-0.5">Currently Playing</span>
                                            <input
                                                id="game-title-input"
                                                name="gameTitle"
                                                aria-label="Currently Playing Game Title"
                                                type="text"
                                                value={gameTitle}
                                                onChange={(e) => setGameTitle(e.target.value)}
                                                className="font-pixel text-lg text-white tracking-widest bg-transparent border-b-2 border-transparent hover:border-white/20 focus:border-[#ffd700] outline-none transition-colors w-full h-8"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Toggles */}
                                <div className="flex gap-2 items-center relative z-50">
                                    <button
                                        onClick={() => setIsPortrait(!isPortrait)}
                                        className={`rpg-window px-3 py-2 flex items-center justify-center border-2 border-white transition-all hover:-translate-y-0.5 ${isPortrait ? 'bg-[#ffd700] border-white' : 'bg-blue-900'}`}
                                        title={isPortrait ? "Switch to Landscape Mode" : "Switch to Portrait Mode"}
                                        aria-label={isPortrait ? "Switch to Landscape Mode" : "Switch to Portrait Mode"}
                                        aria-pressed={isPortrait}
                                    >
                                        <Smartphone size={18} className={isPortrait ? 'text-black' : 'text-white'} />
                                    </button>
                                    <button
                                        ref={settingsButtonRef}
                                        onClick={() => { setIsConfigOpen(!isConfigOpen); setIsMediaOpen(false); }}
                                        className={`rpg-window px-3 py-2 flex items-center justify-center border-2 border-white transition-all hover:-translate-y-0.5 ${isConfigOpen ? 'bg-[#ffd700] border-white' : 'bg-blue-900'
                                            }`}
                                        aria-label="Toggle Configuration Menu"
                                        aria-expanded={isConfigOpen}
                                    >
                                        <Settings size={18} className={isConfigOpen ? 'text-black' : 'text-white'} />
                                    </button>
                                    <button
                                        ref={mediaButtonRef}
                                        onClick={() => { setIsMediaOpen(!isMediaOpen); setIsConfigOpen(false); }}
                                        className={`rpg-window px-3 py-2 flex items-center justify-center border-2 border-white transition-all hover:-translate-y-0.5 ${isMediaOpen ? 'bg-[#ffd700] border-white' : 'bg-blue-900'
                                            }`}
                                        aria-label="Toggle Media Controls"
                                        aria-expanded={isMediaOpen}
                                    >
                                        <Video size={18} className={isMediaOpen ? 'text-black' : 'text-white'} />
                                    </button>
                                    <button
                                        onClick={() => setIsChatOpen(!isChatOpen)}
                                        className={`rpg-window px-3 py-2 flex items-center justify-center border-2 border-white transition-all hover:-translate-y-0.5 ${isChatOpen ? 'bg-[#ffd700] border-white' : 'bg-blue-900'
                                            }`}
                                        title="Toggle Chat"
                                        aria-label="Toggle Chat"
                                        aria-pressed={isChatOpen}
                                    >
                                        <MessageSquare size={18} className={isChatOpen ? 'text-black' : 'text-white'} />
                                    </button>

                                    {/* Dropdowns */}

                                    <MediaControlHub
                                        isOpen={isMediaOpen}
                                        config={effectiveMediaConfig}
                                        onConfigChange={handleMediaConfigChange}
                                        onClose={() => setIsMediaOpen(false)}
                                        themeConfig={themeConfig}
                                        onToggleAudio={(enabled) => toggleAudio(enabled, 'default', config)}
                                        onToggleVideo={(enabled) => toggleVideo(enabled, 'default', config)}
                                        onToggleScreen={(enabled) => toggleScreen(enabled, config, mediaConfig.screenAudio)}
                                        isPortrait={isPortrait}
                                        containerRef={appContainerRef}
                                        triggerRef={mediaButtonRef}
                                    />
                                </div>
                            </nav>

                            {/* Stage & Tools */}
                            <div id="stage-area" className="flex-1 min-h-0 flex flex-col">
                                <Stage
                                    tool={tool}
                                    color={color}
                                    brushSize={brushSize}
                                    onClear={triggerClearStage}
                                    videoStream={videoStream}
                                    onCanvasReady={setOverlayCanvas}
                                    themeConfig={themeConfig}
                                    isPortrait={isPortrait}
                                    style={stageStyle}
                                />

                                <Toolbelt
                                    tool={tool}
                                    setTool={setTool}
                                    color={color}
                                    setColor={setColor}
                                    brushSize={brushSize}
                                    setBrushSize={setBrushSize}
                                    onClear={triggerClearStage}
                                    themeConfig={themeConfig}
                                    isPortrait={isPortrait}
                                />
                            </div>
                        </div>
                    </main>

                    {/* Sidebar Container with Transition */}
                    <aside
                        id="sidebar-panel"
                        className={`flex flex-col shrink-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${isPortrait
                            ? (isChatOpen ? 'w-full h-[40%] translate-y-0 order-2' : 'h-0 translate-y-10 order-2')
                            : (isChatOpen ? 'w-[22%] h-full ml-6 translate-x-0' : 'w-0 h-full ml-0 translate-x-10')
                            }`}
                        style={{
                            opacity: isChatOpen ? 1 : 0, // Control visibility animation
                        }}
                    >
                        <ChatSidebar
                            messages={messages}
                            onSendMessage={handleSendMessage}
                            onClose={handleCloseChat}
                            videoStream={screenSharing ? cameraStream : null}
                            themeConfig={themeConfig}
                            style={sidebarStyle}
                        />
                    </aside>
                </section>
            </div>
            {/* Global Configuration Menu - Moved to root to avoid clipping */}
            <ConfigurationMenu
                isOpen={isConfigOpen}
                config={config}
                themeConfig={themeConfig}
                onConfigChange={setConfig}
                onThemeConfigChange={setThemeConfig}
                onClose={() => setIsConfigOpen(false)}
                triggerRef={settingsButtonRef}
                isPortrait={isPortrait}
                containerRef={appContainerRef}
            />
        </div>
    );
};

export default App;