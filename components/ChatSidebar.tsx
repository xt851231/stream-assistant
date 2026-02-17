import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, ThemeConfig } from '../types';
import { X, Send, Crown, Bot } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { getBgColor } from '../lib/utils/style-utils';

interface ChatSidebarProps {
    messages: Message[];
    onSendMessage: (text: string) => void;
    onClose: () => void;
    videoStream: MediaStream | null;
    style?: React.CSSProperties;
    themeConfig?: ThemeConfig;
}

const ChatSidebar: React.FC<ChatSidebarProps> = React.memo(({ messages, onSendMessage, onClose, videoStream, style, themeConfig }) => {
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Animation State Machine: 'hidden' | 'active' | 'static' | 'off-anim'
    const [visualState, setVisualState] = useState<'hidden' | 'active' | 'static' | 'off-anim'>('hidden');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (videoStream) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            setVisualState('active');
        } else {
            // Sequence: active -> static (0.5s) -> off-anim (0.5s) -> hidden
            if (visualState === 'active') {
                setVisualState('static');
                timerRef.current = setTimeout(() => {
                    setVisualState('off-anim');
                    timerRef.current = setTimeout(() => {
                        setVisualState('hidden');
                        timerRef.current = null;
                    }, 500); // Duration of crt-turn-off
                }, 500); // Duration of static noise
            } else if (visualState !== 'static' && visualState !== 'off-anim') {
                // Initial load or quick toggle
                setVisualState('hidden');
            }
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [videoStream]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream, visualState]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        }
    }, [input, onSendMessage]);

    return (
        <section
            data-component="ChatSidebar"
            className="w-full h-full bg-[#0c1219] border-2 border-[#2b6cee] rounded-xl flex flex-col z-10 shadow-lg overflow-hidden relative min-h-0 transition-colors duration-300"
            style={style}
        >
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '15px 15px' }}></div>

            {/* Header */}
            <header
                className="p-3 border-b-2 border-[#1e293b] flex justify-between items-center shrink-0 transition-colors duration-300"
                style={{
                    backgroundColor: getBgColor('#162032', themeConfig?.opacity?.sidebarHeader || 0.9)
                }}
            >
                <h2 className="font-pixel text-[9px] text-[#ffd700] tracking-widest">PARTY COMMS</h2>
                <div className="flex gap-1">
                    <button
                        onClick={onClose}
                        className="hover:text-red-500 text-gray-500 transition-colors"
                        title="Close Chat"
                    >
                        <X size={14} />
                    </button>
                </div>
            </header>

            {/* Messages */}
            <section
                id="chat-feed"
                aria-label="Chat Feed"
                className="flex-1 overflow-y-auto p-3 space-y-4 relative scroll-smooth min-h-0 transition-colors duration-300"
            >
                {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} themeConfig={themeConfig} />
                ))}
                <div ref={endRef} />
            </section>

            {/* Input Area - Height and Position aligned to Toolbelt */}
            <footer
                className="flex items-center px-3 h-[62px] mx-4 mb-4 border-2 border-[#1e293b] rounded-lg shrink-0 z-20 transition-colors duration-300"
                style={{
                    backgroundColor: getBgColor('#162032', themeConfig?.opacity?.sidebarInput || 0.9)
                }}
            >
                <form onSubmit={handleSubmit} className="flex gap-2 items-center h-10 w-full">
                    <input
                        className="flex-1 min-w-0 bg-[#0a0f16] border border-gray-600 text-white rounded px-3 text-[11px] focus:outline-none focus:border-[#ffd700] placeholder-gray-600 font-display transition-colors h-full"
                        placeholder="Send message..."
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                    <button type="submit" className="h-full aspect-square bg-[#2b6cee] rounded border border-blue-400 flex items-center justify-center text-white hover:bg-blue-500 transition-colors shadow-sm">
                        <Send size={16} />
                    </button>
                </form>
            </footer>

            {/* Secondary Vision Port (PIP) */}
            {visualState !== 'hidden' && (
                <div className={`secondary-screen-container p-4 bg-[#0c1219] shrink-0 border-t border-[#1e293b]`}>
                    <div className={`w-full aspect-video bg-black relative rounded-lg border-2 border-[#232f48] overflow-hidden group shadow-inner flex items-center justify-center ${visualState === 'active' ? 'animate-crt-on' : visualState === 'off-anim' ? 'animate-crt-off' : ''}`}>
                        {/* Video Content */}
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover ${!videoStream ? 'invisible' : ''}`}
                        />

                        {/* NO SIGNAL Placeholder */}
                        {!videoStream && visualState !== 'static' && visualState !== 'off-anim' && (
                            <span className="text-[10px] text-gray-600 font-pixel">NO SIGNAL</span>
                        )}

                        {/* Static Noise Overlay */}
                        {(visualState === 'static' || visualState === 'off-anim') && (
                            <div className="animate-static-noise"></div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
});

export default ChatSidebar;