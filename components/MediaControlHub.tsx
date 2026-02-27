import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MediaConfig, ThemeConfig } from '../types';
import { Mic, Video, Monitor, Volume2, Settings2, Gamepad2 } from 'lucide-react';
import { SpeechAudioContext } from '../lib/utils/SpeechAudioContext';
import { getBgColor } from '../lib/utils/style-utils';
import { useTranslation } from 'react-i18next';

interface MediaControlHubProps {
    isOpen: boolean;
    config: MediaConfig;
    onConfigChange: (newConfig: MediaConfig) => void;
    onClose: () => void;
    themeConfig?: ThemeConfig;
    onToggleAudio?: (enabled: boolean) => void;
    onToggleVideo?: (enabled: boolean) => void;
    onToggleScreen?: (enabled: boolean) => void;
    isPortrait?: boolean;
    containerRef?: React.RefObject<HTMLDivElement>;
    triggerRef?: React.RefObject<HTMLButtonElement>;
}

interface DeviceInfo {
    deviceId: string;
    label: string;
}

const MediaControlHub: React.FC<MediaControlHubProps> = ({ isOpen, config, onConfigChange, onClose, themeConfig, onToggleAudio, onToggleVideo, onToggleScreen, isPortrait, containerRef, triggerRef }) => {
    const { t } = useTranslation();
    const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
    const [cameras, setCameras] = useState<DeviceInfo[]>([]);
    const [speakers, setSpeakers] = useState<DeviceInfo[]>([]);
    const panelRef = useRef<HTMLElement>(null);
    const [portraitPosition, setPortraitPosition] = useState({ top: 0, left: 0, width: 300 });

    // Sync volumes to SpeechAudioContext
    useEffect(() => {
        SpeechAudioContext.setVolume(config.aiVolume);
        SpeechAudioContext.setSystemVolume(config.systemVolume);
    }, [config.aiVolume, config.systemVolume]);

    // Sync output device to SpeechAudioContext
    useEffect(() => {
        if (config.audioOutputDevice) {
            SpeechAudioContext.setSinkId(config.audioOutputDevice);
        }
    }, [config.audioOutputDevice]);

    // Compute position for portrait mode portal
    useLayoutEffect(() => {
        if (!isOpen || !isPortrait || !containerRef?.current) return;

        const updatePosition = () => {
            const containerRect = containerRef.current!.getBoundingClientRect();
            const triggerRect = triggerRef?.current?.getBoundingClientRect();
            setPortraitPosition({
                top: triggerRect ? triggerRect.bottom + 8 : containerRect.top + 60,
                left: containerRect.left + 8,
                width: containerRect.width - 16,
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, isPortrait, containerRef, triggerRef]);

    // Enumerate real devices when the menu opens
    useEffect(() => {
        if (!isOpen) return;

        const enumerateDevices = async () => {
            try {
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

                const spks = devices
                    .filter(d => d.kind === 'audiooutput')
                    .map((d, i) => ({
                        deviceId: d.deviceId,
                        label: d.label || `Speaker ${i + 1}`
                    }));

                setMicrophones(mics);
                setCameras(cams);
                setSpeakers(spks);

                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                }
            } catch (err) {
                console.error('Failed to enumerate devices:', err);
            }
        };

        enumerateDevices();
        navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
        };
    }, [isOpen]);

    // Click outside to close
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (panelRef.current && !panelRef.current.contains(target) &&
                triggerRef?.current && !triggerRef.current.contains(target)) {
                onClose();
            }
        };

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, triggerRef]);

    if (!isOpen) return null;

    const handleChange = <K extends keyof MediaConfig>(key: K, value: MediaConfig[K]) => {
        onConfigChange({ ...config, [key]: value });
    };

    const menuContent = (
        <aside
            ref={panelRef}
            aria-label={t('mediaControl.mediaControls', 'Media Controls')}
            role="dialog"
            data-component="MediaControlHub"
            className={isPortrait
                ? 'fixed z-[9999] rpg-window shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 max-h-[60vh] overflow-y-auto'
                : 'absolute top-14 right-20 z-50 w-[300px] rpg-window shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200'
            }
            style={isPortrait ? {
                top: portraitPosition.top,
                left: portraitPosition.left,
                width: portraitPosition.width,
            } : undefined}
        >
            <header className="bg-blue-900 border-b-2 border-white p-2 flex items-center gap-2">
                <Settings2 className="text-[#ffd700]" size={16} />
                <h2 className="font-pixel text-[10px] text-white">{t('mediaControl.mediaHub', 'Media Hub')}</h2>
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
                            <span>{t('mediaControl.microphone', 'Microphone')}</span>
                        </div>
                        <select
                            id="microphone-select"
                            name="microphone"
                            aria-label={t('mediaControl.microphone', 'Microphone')}
                            className="w-full bg-[#162032] border border-gray-600 text-white text-xs rounded p-1.5 outline-none focus:border-blue-500"
                            value={config.microphoneId}
                            onChange={(e) => handleChange('microphoneId', e.target.value)}
                        >
                            {microphones.length === 0 ? (
                                <option value="default">{t('mediaControl.noMics', 'No microphones detected')}</option>
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
                            <span>{t('mediaControl.camera', 'Camera')}</span>
                        </div>
                        <select
                            id="camera-select"
                            name="camera"
                            aria-label={t('mediaControl.camera', 'Camera')}
                            className="w-full bg-[#162032] border border-gray-600 text-white text-xs rounded p-1.5 outline-none focus:border-blue-500"
                            value={config.cameraId}
                            onChange={(e) => handleChange('cameraId', e.target.value)}
                        >
                            {cameras.length === 0 ? (
                                <option value="default">{t('mediaControl.noCameras', 'No cameras detected')}</option>
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
                        onClick={() => {
                            handleChange('audioEnabled', !config.audioEnabled);
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded border border-gray-600 transition-colors ${config.audioEnabled ? 'bg-blue-900/50 border-blue-400' : 'bg-[#162032] text-gray-500'
                            }`}
                        title={config.audioEnabled ? t('mediaControl.micOn', 'Mute Microphone') : t('mediaControl.micOff', 'Unmute Microphone')}
                    >
                        <Mic size={16} />
                        <span className="text-[9px] mt-1 font-bold">MIC</span>
                    </button>
                    <button
                        onClick={() => {
                            handleChange('videoEnabled', !config.videoEnabled);
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded border border-gray-600 transition-colors ${config.videoEnabled ? 'bg-blue-900/50 border-blue-400' : 'bg-[#162032] text-gray-500'
                            }`}
                        title={config.videoEnabled ? t('mediaControl.camOn', 'Turn Off Camera') : t('mediaControl.camOff', 'Turn On Camera')}
                    >
                        <Video size={16} />
                        <span className="text-[9px] mt-1 font-bold">CAM</span>
                    </button>
                    <button
                        onClick={() => {
                            handleChange('screenShareEnabled', !config.screenShareEnabled);
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded border border-gray-600 transition-colors ${config.screenShareEnabled ? 'bg-blue-900/50 border-blue-400' : 'bg-[#162032] text-gray-500'
                            }`}
                        title={config.screenShareEnabled ? t('mediaControl.screenOn', 'Stop Screen Sharing') : t('mediaControl.screenOff', 'Share Screen')}
                    >
                        <Monitor size={16} />
                        <span className="text-[9px] mt-1 font-bold">SCREEN</span>
                    </button>
                </div>

                {/* Screen Audio Toggle */}
                <div className="flex items-center justify-between bg-[#111827] p-2 rounded border border-gray-700">
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                        <Gamepad2 size={14} className="text-blue-400" />
                        <span>{t('mediaControl.screenAudio', 'Share System Audio')}</span>
                    </div>
                    <button
                        onClick={() => handleChange('screenAudio', !config.screenAudio)}
                        className={`w-8 h-4 rounded-full relative transition-colors ${config.screenAudio ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${config.screenAudio ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>

                {/* Output Device */}
                <div className="space-y-1 pt-2 border-t border-gray-700">
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                        <Volume2 size={12} className="text-blue-400" />
                        <span>{t('mediaControl.outputDevice', 'Output Device')}</span>
                    </div>
                    <select
                        id="speaker-select"
                        name="speaker"
                        aria-label={t('mediaControl.outputDevice', 'Output Device')}
                        className="w-full bg-[#162032] border border-gray-600 text-white text-xs rounded p-1.5 outline-none focus:border-blue-500"
                        value={config.audioOutputDevice || 'default'}
                        onChange={(e) => handleChange('audioOutputDevice', e.target.value)}
                    >
                        {speakers.length === 0 ? (
                            <option value="default">Default Device</option>
                        ) : (
                            <>
                                <option value="default">Default Device</option>
                                {speakers.map(speaker => (
                                    <option key={speaker.deviceId} value={speaker.deviceId}>
                                        {speaker.label}
                                    </option>
                                ))}
                            </>
                        )}
                    </select>
                </div>

                {/* Volumes */}
                <div className="space-y-4 pt-2 border-t border-gray-700">
                    {/* AI Voice Volume */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-300">
                            <div className="flex items-center gap-2">
                                <Volume2 size={12} className="text-blue-400" />
                                <span>{t('mediaControl.volumeAi', 'AI Volume')}</span>
                            </div>
                            <span className="font-mono text-[#ffd700]">{config.aiVolume}%</span>
                        </div>
                        <input
                            id="ai-volume-slider"
                            name="aiVolume"
                            aria-label={t('mediaControl.volumeAi', 'AI Voice Volume')}
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
                                <span>{t('mediaControl.volumeSystem', 'System Volume')}</span>
                            </div>
                            <span className="font-mono text-[#ffd700]">{config.systemVolume}%</span>
                        </div>
                        <input
                            id="game-volume-slider"
                            name="gameVolume"
                            aria-label={t('mediaControl.volumeSystem', 'Game Audio Volume')}
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

    // In portrait mode, portal to body to escape overflow-hidden clipping
    if (isPortrait) {
        return createPortal(menuContent, document.body);
    }

    return menuContent;
};

export default MediaControlHub;
