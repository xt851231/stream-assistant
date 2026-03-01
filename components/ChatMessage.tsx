import React from 'react';
import { Message, ThemeConfig } from '../types';
import { Crown, Bot } from 'lucide-react';
import { PERSONAS } from '../constants';
import { getBgColor } from '../lib/utils/style-utils';

interface ChatMessageProps {
    message: Message;
    themeConfig?: ThemeConfig;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, themeConfig }) => {
    const msg = message;
    const opacity = themeConfig?.opacity?.chatMessage || 0.8;

    return (
        <div className="flex gap-2 group animate-in slide-in-from-right-2 duration-300">
            <div className="shrink-0 mt-1">
                {msg.sender === 'System' ? (
                    <div className="size-6 bg-yellow-900/50 rounded border border-yellow-500 flex items-center justify-center">
                        <Crown size={12} className="text-yellow-500" />
                    </div>
                ) : msg.type === 'assistant' ? (
                    <div className="size-6 bg-purple-900/50 rounded border border-purple-500 flex items-center justify-center text-[14px]">
                        {PERSONAS.find(p => p.name === msg.sender)?.emoji || <Bot size={12} className="text-purple-400" />}
                    </div>
                ) : (
                    <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender}`}
                        alt="Avatar"
                        className="size-6 bg-indigo-900 rounded border border-indigo-400"
                    />
                )}
            </div>

            <div className="flex flex-col gap-0.5 max-w-[85%]">
                <span className={`text-[9px] font-ark font-bold flex items-center gap-1 ${msg.type === 'system' ? 'text-yellow-500' :
                    msg.type === 'assistant' ? 'text-purple-400' :
                        'text-blue-300'
                    }`}>
                    {msg.sender}
                    {msg.isMod && <span className="bg-blue-600 text-[7px] px-1 rounded text-white leading-tight">MOD</span>}
                </span>

                {msg.type === 'system' ? (
                    <div className="bg-yellow-900/20 border border-yellow-600/50 rounded px-2 py-1 text-center">
                        <p className="text-[9px] text-yellow-500 font-pixel">{msg.text}</p>
                    </div>
                ) : (
                    <div
                        className={`border rounded p-2 text-[11px] font-ark shadow-sm relative ${msg.type === 'assistant'
                            ? 'border-purple-500/50 text-gray-200'
                            : 'border-gray-600 text-gray-200'
                            }`}
                        style={{
                            backgroundColor: msg.type === 'assistant'
                                ? getBgColor('#2a1b3d', opacity)
                                : getBgColor('#1e293b', opacity)
                        }}
                    >
                        {msg.text}
                    </div>
                )}
            </div>
        </div>
    );
};

// Memoize to prevent re-renders when other messages change
export default React.memo(ChatMessage);
