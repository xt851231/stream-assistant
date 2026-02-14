import React, { useEffect } from 'react';
import { MediaConfig, ThemeConfig } from '../types';
import { Mic, Video, Monitor, Volume2, Settings2 } from 'lucide-react';
import { SpeechAudioContext } from '../lib/utils/SpeechAudioContext';

interface MediaControlHubProps {
    isOpen: boolean;
    config: MediaConfig;
    onConfigChange: (newConfig: MediaConfig) => void;
    onClose: () => void;
    themeConfig?: ThemeConfig;
}

const getBgColor = (baseColorHex: string, opacity: number) => {
    const hex = baseColorHex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const MediaControlHub: React.FC<MediaControlHubProps> = ({ isOpen, config, onConfigChange, onClose, themeConfig }) => {
    // Sync volume to SpeechAudioContext on mount and when config.volume changes
    useEffect(() => {
        SpeechAudioContext.setVolume(config.volume);
    }, [config.volume]);

    if (!isOpen) return null;

    const handleChange = <K extends keyof MediaConfig>(key: K, value: MediaConfig[K]) => {
        onConfigChange({ ...config, [key]: value });
    };

    return (
        <aside aria-label="Media Controls" role="dialog" data-component="MediaControlHub" className="absolute top-14 right-20 z-50 w-[300px] rpg-window shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <header className="bg-blue-900 border-b-2 border-white p-2 flex items-center gap-2">
                <Settings2 className="text-[#ffd700]" size={16} />
                <h2 className="font-pixel text-[10px] text-white">Media Hub</h2>
            </header>

            <div
                className="p-4 space-y-4"
                style={{
                    backgroundColor: getBgColor('#0a0f16', themeConfig?.opacity?.mediaControlHub || 0.9),
                    backdropFilter: themeConfig?.backgroundImage ? `blur(${(themeConfig?.blur || 0) / 2}px)` : 'none'
                }}
            >

                {/* Device Selectors */}
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                            <Mic size={12} className="text-blue-400" />
                            <span>Microphone</span>
                        </div>
                        <select
                            className="w-full bg-[#162032] border border-gray-600 text-white text-xs rounded p-1.5 outline-none focus:border-blue-500"
                            value={config.microphoneId}
                            onChange={(e) => handleChange('microphoneId', e.target.value)}
                        >
                            <option value="default">Default Microphone</option>
                            <option value="mic-1">Yeti Stereo Microphone</option>
                            <option value="mic-2">Headset Mic</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                            <Video size={12} className="text-blue-400" />
                            <span>Camera</span>
                        </div>
                        <select
                            className="w-full bg-[#162032] border border-gray-600 text-white text-xs rounded p-1.5 outline-none focus:border-blue-500"
                            value={config.cameraId}
                            onChange={(e) => handleChange('cameraId', e.target.value)}
                        >
                            <option value="default">Default Camera</option>
                            <option value="cam-1">Logitech Brio</option>
                            <option value="cam-2">OBS Virtual Camera</option>
                        </select>
                    </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => handleChange('audioEnabled', !config.audioEnabled)}
                        className={`flex flex-col items-center justify-center p-2 rounded border border-gray-600 transition-colors ${config.audioEnabled ? 'bg-blue-900/50 border-blue-400' : 'bg-[#162032] text-gray-500'
                            }`}
                    >
                        <Mic size={16} />
                        <span className="text-[9px] mt-1 font-bold">{config.audioEnabled ? 'ON' : 'OFF'}</span>
                    </button>
                    <button
                        onClick={() => handleChange('videoEnabled', !config.videoEnabled)}
                        className={`flex flex-col items-center justify-center p-2 rounded border border-gray-600 transition-colors ${config.videoEnabled ? 'bg-blue-900/50 border-blue-400' : 'bg-[#162032] text-gray-500'
                            }`}
                    >
                        <Video size={16} />
                        <span className="text-[9px] mt-1 font-bold">{config.videoEnabled ? 'ON' : 'OFF'}</span>
                    </button>
                    <button
                        onClick={() => handleChange('screenShareEnabled', !config.screenShareEnabled)}
                        className={`flex flex-col items-center justify-center p-2 rounded border border-gray-600 transition-colors ${config.screenShareEnabled ? 'bg-blue-900/50 border-blue-400' : 'bg-[#162032] text-gray-500'
                            }`}
                    >
                        <Monitor size={16} />
                        <span className="text-[9px] mt-1 font-bold">{config.screenShareEnabled ? 'ON' : 'OFF'}</span>
                    </button>
                </div>

                {/* Volume */}
                <div className="space-y-2 pt-2 border-t border-gray-700">
                    <div className="flex items-center justify-between text-xs text-gray-300">
                        <div className="flex items-center gap-2">
                            <Volume2 size={12} />
                            <span>Output Volume</span>
                        </div>
                        <span className="font-mono text-[#ffd700]">{config.volume}%</span>
                    </div>
                    <input
                        type="range"
                        min="0" max="100"
                        value={config.volume}
                        onChange={(e) => handleChange('volume', parseInt(e.target.value))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>
        </aside>
    );
};

export default MediaControlHub;
