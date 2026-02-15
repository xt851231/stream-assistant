import React, { useState } from 'react';
import { AppConfig, MediaConfig, ConnectionState, Message, ThemeConfig } from './types';
import { DEFAULT_CONFIG, DEFAULT_MEDIA_CONFIG, INITIAL_MESSAGES, DEFAULT_THEME_CONFIG } from './constants';
import ConfigurationMenu from './components/ConfigurationMenu';
import MediaControlHub from './components/MediaControlHub';
import Stage from './components/Stage';
import Toolbelt from './components/Toolbelt';
import ChatSidebar from './components/ChatSidebar';
import { useLiveAPI } from './hooks/useLiveAPI';
import { Swords, Zap, Settings, Video, Mic, Monitor, MessageSquare } from 'lucide-react';

const App: React.FC = () => {
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
            const savedConfig = localStorage.getItem('app_config');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                return { ...DEFAULT_CONFIG, ...parsed };
            }
        } catch (e) {
            console.error("Failed to load config from localStorage", e);
        }
        return DEFAULT_CONFIG;
    });

    const [mediaConfig, setMediaConfig] = useState<MediaConfig>(() => {
        try {
            const savedConfig = localStorage.getItem('media_config');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                // Always start with screen sharing disabled to avoid permission prompts on reload
                return { ...DEFAULT_MEDIA_CONFIG, ...parsed, screenShareEnabled: false };
            }
        } catch (e) {
            console.error("Failed to load media config", e);
        }
        return DEFAULT_MEDIA_CONFIG;
    });

    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => {
        try {
            const savedConfig = localStorage.getItem('theme_config');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                return { ...DEFAULT_THEME_CONFIG, ...parsed };
            }
        } catch (e) {
            console.error("Failed to load theme config", e);
        }
        return DEFAULT_THEME_CONFIG;
    });

    // Save config to localStorage whenever it changes
    React.useEffect(() => {
        localStorage.setItem('app_config', JSON.stringify(config));
    }, [config]);

    React.useEffect(() => {
        localStorage.setItem('media_config', JSON.stringify(mediaConfig));
    }, [mediaConfig]);

    React.useEffect(() => {
        localStorage.setItem('theme_config', JSON.stringify(themeConfig));
    }, [themeConfig]);

    // Update Config when relevant fields change (not on initial connection)
    const prevConfigRef = React.useRef<{ systemInstructions?: string; voice?: string; selectedPersonaId?: string }>({});
    React.useEffect(() => {
        if (!connected) return;

        const prev = prevConfigRef.current;
        const changed = prev.systemInstructions !== config.systemInstructions
            || prev.voice !== config.voice
            || prev.selectedPersonaId !== config.selectedPersonaId;

        // Only update if values actually changed (skip initial mount)
        if (changed && (prev.systemInstructions !== undefined || prev.voice !== undefined || prev.selectedPersonaId !== undefined)) {
            setLiveConfig({
                systemInstructions: config.systemInstructions,
                voice: config.voice,
                selectedPersonaId: config.selectedPersonaId
            });
        }

        prevConfigRef.current = {
            systemInstructions: config.systemInstructions,
            voice: config.voice,
            selectedPersonaId: config.selectedPersonaId
        };
    }, [config.systemInstructions, config.voice, config.selectedPersonaId, connected, setLiveConfig]);

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

    // Handlers
    const handleConnect = async () => {
        if (connected) {
            await disconnect();
        } else {
            await connect(config);
        }
    };

    const handleSendMessage = (text: string) => {
        sendMessage(text, config);
    };

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



    const triggerClearStage = () => {
        // Dispatch custom event for Stage component
        const event = new Event('STAGE_CLEAR');
        document.dispatchEvent(event);
    };

    // Helper to get helper RBGA color with opacity
    const getBgColor = (baseColorHex: string, opacity: number) => {
        // Simple hex to rgba conversion
        const hex = baseColorHex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };



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
            <div data-component="App" className="aspect-video w-full max-w-[177.78vh] max-h-[96vh] flex flex-col border-4 border-[#1e293b] relative shadow-2xl overflow-hidden shrink-0"
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
                    className="flex-1 flex overflow-hidden p-6 relative transition-colors duration-300"
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
                                <div className="relative px-4 py-2 min-w-[280px]">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-blue-800/50 to-transparent border-l-4 border-[#ffd700] transform skew-x-[-12deg] rounded-r-lg"></div>
                                    <div className="relative flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[#ffd700] text-2xl">
                                            <Swords size={28} className="text-[#ffd700]" />
                                        </span>
                                        <div className="flex flex-col w-full">
                                            <span className="text-[8px] text-blue-200 uppercase tracking-widest font-bold mb-0.5">Currently Playing</span>
                                            <input
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
                                        ref={settingsButtonRef}
                                        onClick={() => { setIsConfigOpen(!isConfigOpen); setIsMediaOpen(false); }}
                                        className={`rpg-window px-3 py-2 flex items-center justify-center border-2 border-white transition-all hover:-translate-y-0.5 ${isConfigOpen ? 'bg-[#ffd700] border-white' : 'bg-blue-900'
                                            }`}
                                    >
                                        <Settings size={18} className={isConfigOpen ? 'text-black' : 'text-white'} />
                                    </button>
                                    <button
                                        onClick={() => { setIsMediaOpen(!isMediaOpen); setIsConfigOpen(false); }}
                                        className={`rpg-window px-3 py-2 flex items-center justify-center border-2 border-white transition-all hover:-translate-y-0.5 ${isMediaOpen ? 'bg-[#ffd700] border-white' : 'bg-blue-900'
                                            }`}
                                    >
                                        <Video size={18} className={isMediaOpen ? 'text-black' : 'text-white'} />
                                    </button>
                                    <button
                                        onClick={() => toggleAudio(!audioStreaming, 'default', config)}
                                        className={`rpg-window px-3 py-2 flex items-center justify-center border-2 border-white transition-all hover:-translate-y-0.5 ${audioStreaming ? 'bg-[#ffd700] border-white' : 'bg-blue-900'}`}
                                    >
                                        <Mic size={18} className={audioStreaming ? 'text-black' : 'text-white'} />
                                    </button>
                                    <button
                                        onClick={() => toggleScreen(!screenSharing, config, mediaConfig.screenAudio)}
                                        className={`rpg-window px-3 py-2 flex items-center justify-center border-2 border-white transition-all hover:-translate-y-0.5 ${screenSharing ? 'bg-[#ffd700] border-white' : 'bg-blue-900'}`}
                                    >
                                        <Monitor size={18} className={screenSharing ? 'text-black' : 'text-white'} />
                                    </button>
                                    <button
                                        onClick={() => setIsChatOpen(!isChatOpen)}
                                        className={`rpg-window px-3 py-2 flex items-center justify-center border-2 border-white transition-all hover:-translate-y-0.5 ${isChatOpen ? 'bg-[#ffd700] border-white' : 'bg-blue-900'
                                            }`}
                                        title="Toggle Chat"
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
                                    style={{
                                        backgroundColor: getBgColor('#000000', themeConfig?.opacity?.mainStage || 0.8)
                                    }}
                                />

                                <Toolbelt
                                    tool={tool}
                                    setTool={setTool}
                                    color={color}
                                    setColor={setColor}
                                    brushSize={brushSize}
                                    setBrushSize={setBrushSize}
                                    onClear={triggerClearStage}
                                    themeConfig={themeConfig} // Pass theme config to Toolbelt if needed, or wrap it
                                />
                            </div>
                        </div>
                    </main>

                    {/* Sidebar Container with Transition */}
                    <aside
                        id="sidebar-panel"
                        className={`flex flex-col shrink-0 h-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${isChatOpen
                            ? 'w-[22%] ml-6 translate-x-0'
                            : 'w-0 ml-0 translate-x-10'
                            }`}
                        style={{
                            opacity: isChatOpen ? 1 : 0, // Control visibility animation
                        }}
                    >
                        <ChatSidebar
                            messages={messages}
                            onSendMessage={handleSendMessage}
                            onClose={() => setIsChatOpen(false)}
                            videoStream={screenSharing ? cameraStream : null}
                            themeConfig={themeConfig}
                            style={{
                                backgroundColor: getBgColor('#05080c', themeConfig?.opacity?.sidebar || 0.9),
                                backdropFilter: themeConfig?.backgroundImage ? `blur(${(themeConfig?.blur || 0) / 2}px)` : 'none'
                            }}
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
            />
        </div>
    );
};

export default App;