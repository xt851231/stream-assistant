import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MediaConfig, ThemeConfig } from '../types';
import { Mic, Video, Monitor, Volume2, Settings2, Gamepad2 } from 'lucide-react';
import { SpeechAudioContext } from '../lib/utils/SpeechAudioContext';

interface MediaControlHubProps {
    isOpen: boolean;
    config: MediaConfig;
    onConfigChange: (newConfig: MediaConfig) => void;
    onClose: () => void;
    themeConfig?: ThemeConfig;
}

interface DeviceInfo {
    deviceId: string;
    label: string;
}

const getBgColor = (baseColorHex: string, opacity: number) => {
    const hex = baseColorHex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const MediaControlHub: React.FC<MediaControlHubProps> = ({ isOpen, config, onConfigChange, onClose, themeConfig }) => {
    const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
    const [cameras, setCameras] = useState<DeviceInfo[]>([]);
    const panelRef = useRef<HTMLElement>(null);

    // Sync volumes to SpeechAudioContext
    useEffect(() => {
        SpeechAudioContext.setVolume(config.aiVolume);
        SpeechAudioContext.setSystemVolume(config.systemVolume);
    }, [config.aiVolume, config.systemVolume]);

    // Enumerate real devices when the menu opens
    useEffect(() => {
        if (!isOpen) return;

        const enumerateDevices = async () => {
            try {
                // Request permission first (needed to get labels)
                // If permission was already granted, this resolves instantly
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => null);

                const devices = await navigator.mediaDevices.enumerateDevices();

                const mics = devices
                    .filter(d => d.kind === 'audioinput')
                    .map((d, i) => ({
                        deviceId: d.deviceId,
                        label: d.label || `Microphone ${i + 1}`
                    }));

                const cams = devices
                    .filter(d => d.kind === 'videoinput')
                    .map((d, i) => ({
                        deviceId: d.deviceId,
                        label: d.label || `Camera ${i + 1}`
                    }));

                setMicrophones(mics);
                setCameras(cams);

                // Release the permission stream
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                }
            } catch (err) {
                console.error('Failed to enumerate devices:', err);
            }
        };

        enumerateDevices();

        // Listen for device changes (plug/unplug)
        navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
        };
    }, [isOpen]);

    // Click outside to close
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        // Use setTimeout to avoid closing immediately from the same click that opened it
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleChange = <K extends keyof MediaConfig>(key: K, value: MediaConfig[K]) => {
        onConfigChange({ ...config, [key]: value });
    };

    return (
        <aside
            ref={panelRef}
            aria-label="Media Controls"
            role="dialog"
            data-component="MediaControlHub"
            className="absolute top-14 right-20 z-50 w-[300px] rpg-window shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
        >
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
                            {microphones.length === 0 ? (
                                <option value="default">No microphones detected</option>
                            ) : (
                                microphones.map(mic => (
                                    <option key={mic.deviceId} value={mic.deviceId}>
                                        {mic.label}
                                    </option>
                                ))
                            )}
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
                            {cameras.length === 0 ? (
                                <option value="default">No cameras detected</option>
                            ) : (
                                cameras.map(cam => (
                                    <option key={cam.deviceId} value={cam.deviceId}>
                                        {cam.label}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => handleChange('audioEnabled', !config.audioEnabled)}
                        className={`flex flex-col items-center justify-center p-2 rounded border border-gray-600 transition-colors ${config.audioEnabled ? 'bg-blue-900/50 border-blue-400' : 'bg-[#162032] text-gray-500'
                            }`}
                        title="Toggle Microphone"
                    >
                        <Mic size={16} />
                        <span className="text-[9px] mt-1 font-bold">MIC</span>
                    </button>
                    <button
                        onClick={() => handleChange('videoEnabled', !config.videoEnabled)}
                        className={`flex flex-col items-center justify-center p-2 rounded border border-gray-600 transition-colors ${config.videoEnabled ? 'bg-blue-900/50 border-blue-400' : 'bg-[#162032] text-gray-500'
                            }`}
                        title="Toggle Camera"
                    >
                        <Video size={16} />
                        <span className="text-[9px] mt-1 font-bold">CAM</span>
                    </button>
                    <button
                        onClick={() => handleChange('screenShareEnabled', !config.screenShareEnabled)}
                        className={`flex flex-col items-center justify-center p-2 rounded border border-gray-600 transition-colors ${config.screenShareEnabled ? 'bg-blue-900/50 border-blue-400' : 'bg-[#162032] text-gray-500'
                            }`}
                        title="Toggle Screen Share"
                    >
                        <Monitor size={16} />
                        <span className="text-[9px] mt-1 font-bold">SCREEN</span>
                    </button>
                </div>

                {/* Screen Audio Toggle */}
                <div className="flex items-center justify-between bg-[#111827] p-2 rounded border border-gray-700">
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                        <Gamepad2 size={14} className="text-blue-400" />
                        <span>Capture Game Audio</span>
                    </div>
                    <button
                        onClick={() => handleChange('screenAudio', !config.screenAudio)}
                        className={`w-8 h-4 rounded-full relative transition-colors ${config.screenAudio ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${config.screenAudio ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>

                {/* Volumes */}
                <div className="space-y-4 pt-2 border-t border-gray-700">
                    {/* AI Voice Volume */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-300">
                            <div className="flex items-center gap-2">
                                <Volume2 size={12} className="text-blue-400" />
                                <span>AI Voice Volume</span>
                            </div>
                            <span className="font-mono text-[#ffd700]">{config.aiVolume}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="100"
                            value={config.aiVolume}
                            onChange={(e) => handleChange('aiVolume', parseInt(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    {/* Game Audio Volume */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-300">
                            <div className="flex items-center gap-2">
                                <Gamepad2 size={12} className="text-blue-400" />
                                <span>Game Audio Volume</span>
                            </div>
                            <span className="font-mono text-[#ffd700]">{config.systemVolume}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="100"
                            value={config.systemVolume}
                            onChange={(e) => handleChange('systemVolume', parseInt(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default MediaControlHub;
