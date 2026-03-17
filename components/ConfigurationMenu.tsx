import React, { useState, useLayoutEffect, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AppConfig, ThemeConfig } from '../types';
import { MODEL_REGISTRY, PROVIDERS, FIELD_DEFINITIONS, PERSONAS, VOICES, getEffectiveSettings, saveModelConfig, loadModelConfig } from '../utils/model-registry';
import { getPersonaVoiceForModel, SUPPORTED_LANGUAGES } from '../constants';
import { Cpu, Activity, Save, Image, Settings, Sparkles, Brain, Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getBgColor } from '../lib/utils/style-utils';

interface ConfigurationMenuProps {
    isOpen: boolean;
    config: AppConfig;
    onConfigChange: (newConfig: AppConfig) => void;
    themeConfig?: ThemeConfig;
    onThemeConfigChange?: (newConfig: ThemeConfig) => void;
    onClose: () => void;
    triggerRef?: React.RefObject<HTMLButtonElement>;
    isPortrait?: boolean;
    containerRef?: React.RefObject<HTMLDivElement>;
}

const ConfigurationMenu: React.FC<ConfigurationMenuProps> = ({ isOpen, config, onConfigChange, themeConfig, onThemeConfigChange, onClose, triggerRef, isPortrait, containerRef }) => {
    const { t } = useTranslation();
    const currentModelId = config.provider && MODEL_REGISTRY[config.provider] ? config.provider : 'gemini-live';
    const currentModel = MODEL_REGISTRY[currentModelId];

    const [activeTab, setActiveTab] = useState<string>(currentModel.uiGroups[0]?.id || 'system');
    const [position, setPosition] = useState({ top: 0, right: 0, left: 0, width: 0 });
    const panelRef = useRef<HTMLElement>(null);
    const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        const updateVoices = () => {
            setBrowserVoices(window.speechSynthesis.getVoices());
        };
        updateVoices();
        window.speechSynthesis.onvoiceschanged = updateVoices;
        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, []);

    useEffect(() => {
        if (activeTab !== 'appearance' && !currentModel.uiGroups.find((g: any) => g.id === activeTab)) {
            setActiveTab(currentModel.uiGroups[0]?.id || 'system');
        }
    }, [currentModelId, activeTab, currentModel.uiGroups]);

    useLayoutEffect(() => {
        if (isOpen && triggerRef?.current) {
            const updatePosition = () => {
                const rect = triggerRef.current!.getBoundingClientRect();
                if (isPortrait && containerRef?.current) {
                    const containerRect = containerRef.current.getBoundingClientRect();
                    setPosition({
                        top: rect.bottom + 8,
                        right: 0,
                        left: containerRect.left + 8,
                        width: containerRect.width - 16,
                    });
                } else {
                    setPosition({
                        top: rect.bottom + 8,
                        right: window.innerWidth - rect.right,
                        left: 0,
                        width: 0,
                    });
                }
            };

            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);

            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            };
        }
    }, [isOpen, triggerRef, isPortrait, containerRef]);

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

    const handleChange = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
        const newConfig = { ...config, [key]: value };
        // App.tsx useEffect will save via saveModelConfig
        onConfigChange(newConfig);
    };

    const handlePersonaSelect = (personaId: string) => {
        const persona = PERSONAS.find(p => p.id === personaId);
        if (!persona) return;

        // Get voice defaults for this persona on the current model
        const voiceConfig = getPersonaVoiceForModel(persona, currentModelId);

        const nextConfig: AppConfig = {
            ...config,
            selectedPersonaId: persona.id,
            systemInstructions: persona.systemInstruction,
            // Apply per-model voice defaults from persona constant
            ...(voiceConfig.voice && { voice: voiceConfig.voice }),
            ...(voiceConfig.ttsEngine && { ttsEngine: voiceConfig.ttsEngine }),
            ...(voiceConfig.ttsVoice && { ttsVoice: voiceConfig.ttsVoice }),
        };

        onConfigChange(nextConfig);
    };

    const handleModelChange = (newModelKey: string) => {
        if (newModelKey === currentModelId) return;

        // Save current model's config before switching
        saveModelConfig(config);

        // Load the new model's config (returns defaults if no save exists)
        let nextConfig = loadModelConfig(newModelKey);

        // If this is the first time on this model (no saved config), apply field defaults
        const newModelDef = MODEL_REGISTRY[newModelKey];
        if (!localStorage.getItem(`config_${newModelKey}`)) {
            const defaults: any = {};
            newModelDef.uiGroups.forEach((group: any) => {
                if (group.sections) {
                    group.sections.forEach((section: any) => {
                        const effectiveSettings = getEffectiveSettings(newModelDef.requiresTTS ?? false, section.settings);
                        effectiveSettings.forEach((settingId: string) => {
                            if (settingId !== 'persona' && FIELD_DEFINITIONS[settingId]?.defaultValue !== undefined) {
                                defaults[settingId] = FIELD_DEFINITIONS[settingId].defaultValue;
                            }
                        });
                    });
                } else if (group.settings) {
                    const effectiveSettings = getEffectiveSettings(newModelDef.requiresTTS ?? false, group.settings);
                    effectiveSettings.forEach((settingId: string) => {
                        if (settingId !== 'persona' && FIELD_DEFINITIONS[settingId]?.defaultValue !== undefined) {
                            defaults[settingId] = FIELD_DEFINITIONS[settingId].defaultValue;
                        }
                    });
                }
            });

            nextConfig = {
                ...nextConfig,
                ...defaults,
                provider: newModelKey,
                modelId: newModelDef.modelId,
            };
        }

        nextConfig.provider = newModelKey;
        onConfigChange(nextConfig);
    };

    const renderIcon = (iconName: string, size: number = 14) => {
        switch (iconName) {
            case 'cpu': return <Cpu size={size} />;
            case 'mic': return <Mic size={size} />;
            case 'activity': return <Activity size={size} />;
            case 'brain': return <Brain size={size} />;
            case 'sparkles': return <Sparkles size={size} />;
            case 'settings': return <Settings size={size} />;
            default: return <Settings size={size} />;
        }
    };

    const tabs = [...currentModel.uiGroups, { id: 'appearance', label: t('appearance.title', 'Appearance'), icon: 'image' }];

    // Helper to render a list of settings
    const renderSettingsList = (settings: string[]) => {
        return settings.map(settingId => {
            if (settingId === 'persona') {
                return (
                    <section key={settingId} className="space-y-3 pt-2">
                        {/* Persona title is usually handled by section, but if standalone... */}
                        <div className="grid grid-cols-4 gap-2">
                            {PERSONAS.map((persona) => (
                                <button
                                    key={persona.id}
                                    onClick={() => handlePersonaSelect(persona.id)}
                                    className={`flex flex-col items-center p-2 rounded border-2 transition-all ${config.selectedPersonaId === persona.id
                                        ? 'bg-blue-900/50 border-[#ffd700] shadow-[0_0_10px_rgba(255,215,0,0.2)]'
                                        : 'bg-[#162032] border-gray-700 hover:border-gray-500'
                                        }`}
                                >
                                    <span className="text-2xl mb-1">{persona.emoji}</span>
                                    <span className="text-[10px] font-bold text-gray-300">{persona.name}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                );
            }

            const field = FIELD_DEFINITIONS[settingId];
            if (!field) return null;

            return (
                <div key={settingId} className="space-y-1">
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-gray-400 font-display uppercase tracking-wider">{t(`systemConfig.fields.${settingId}`, field.label)}</label>
                        {field.type === 'slider' && (
                            <span className="text-[#ffd700] font-mono text-xs">{config[settingId as keyof AppConfig]}</span>
                        )}
                    </div>

                    {field.type === 'select' ? (
                        <select
                            id={`config-select-${settingId}`}
                            name={settingId}
                            aria-label={field.label}
                            className="w-full bg-[#162032] border border-gray-600 text-white text-sm rounded p-2 focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
                            value={String(config[settingId as keyof AppConfig] || '')}
                            onChange={(e) => handleChange(settingId as keyof AppConfig, e.target.value)}
                        >
                            {settingId === 'ttsVoice' && config.ttsEngine === 'browser' ? (
                                browserVoices.map((v) => (
                                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                                ))
                            ) : field.options?.map((opt: any) => (
                                <option key={opt.value} value={opt.value}>{t(`systemConfig.options.${opt.value}`, opt.label)}</option>
                            ))}
                        </select>
                    ) : field.type === 'textarea' ? (
                        <textarea
                            id={`config-textarea-${settingId}`}
                            name={settingId}
                            aria-label={field.label}
                            rows={field.rows || 3}
                            className="w-full bg-[#162032] border border-gray-600 text-white text-xs rounded p-2 focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none resize-none font-mono"
                            value={String(config[settingId as keyof AppConfig] || '')}
                            onChange={(e) => handleChange(settingId as keyof AppConfig, e.target.value)}
                            placeholder={field.placeholder}
                        />
                    ) : field.type === 'checkbox' ? (
                        <div className="flex items-center justify-between bg-[#162032] p-2 rounded border border-gray-700">
                            <span className="text-xs text-gray-300">{t(`systemConfig.fields.${settingId}`, field.label)}</span>
                            <button
                                role="switch"
                                aria-checked={Boolean(config[settingId as keyof AppConfig])}
                                aria-label={t(`systemConfig.fields.${settingId}`, field.label)}
                                onClick={() => handleChange(settingId as keyof AppConfig, !config[settingId as keyof AppConfig])}
                                className={`w-8 h-4 rounded-full relative transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd700] ${config[settingId as keyof AppConfig] ? 'bg-green-500' : 'bg-gray-600'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${config[settingId as keyof AppConfig] ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    ) : field.type === 'slider' ? (
                        <input
                            id={`config-slider-${settingId}`}
                            name={settingId}
                            aria-label={field.label}
                            type="range"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={Number(config[settingId as keyof AppConfig]) || field.min}
                            onChange={(e) => handleChange(settingId as keyof AppConfig, parseFloat(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                        />
                    ) : (
                        <input
                            id={`config-input-${settingId}`}
                            name={settingId}
                            aria-label={field.label}
                            type={field.type}
                            className="w-full bg-[#162032] border border-gray-600 text-white text-sm rounded p-2 focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
                            value={String(config[settingId as keyof AppConfig] || '')}
                            onChange={(e) => handleChange(settingId as keyof AppConfig, e.target.value)}
                            placeholder={field.placeholder}
                        />
                    )}
                </div>
            );
        });
    };

    return createPortal(
        <aside
            ref={panelRef}
            aria-label="Configuration Menu"
            role="dialog"
            data-component="ConfigurationMenu"
            className={`fixed z-[9999] rpg-window shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 ${isPortrait ? '' : 'w-[480px]'}`}
            style={{
                top: position.top,
                ...(isPortrait ? { left: position.left, width: position.width } : { right: position.right }),
                backgroundColor: getBgColor('#0a0f16', themeConfig?.opacity?.configurationMenu ?? 0.95),
                backdropFilter: themeConfig?.backgroundImage ? `blur(${(themeConfig?.blur ?? 0) / 2}px)` : 'none'
            }}
        >
            <nav aria-label="Config Tabs" className="flex border-b-2 border-white bg-blue-900 scrollbar-hide overflow-x-auto">
                {tabs.map((tab: any) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 font-pixel text-[10px] transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-[#2b6cee] text-white'
                            : 'bg-[#1e3a8a] text-gray-400 hover:text-white'
                            }`}
                    >
                        {tab.id === 'appearance' ? <Image size={14} /> : renderIcon(tab.icon || 'settings')}
                        {tab.id === 'system' ? t('systemConfig.title', tab.label) : tab.label}
                    </button>
                ))}
            </nav>

            <div className={`p-4 bg-[#0a0f16] overflow-y-auto ${isPortrait ? 'max-h-[40vh]' : 'max-h-[60vh]'}`}>
                {activeTab !== 'appearance' && (
                    <div className="space-y-6">
                        {/* Global Provider Select - Visible on 'system' or first tab */}
                        {(activeTab === 'system' || activeTab === currentModel.uiGroups[0].id) && (
                            <section className="space-y-3 bg-[#111827] p-3 rounded-lg border border-gray-700">
                                <h3 className="text-[#ffd700] font-pixel text-[10px] uppercase mb-2 border-b border-gray-700 pb-1">
                                    {t('systemConfig.globalSettings', 'Global Settings')}
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400 font-display uppercase tracking-wider">{t('systemConfig.provider', 'Provider')}</label>
                                        <select
                                            id="global-provider-select"
                                            name="provider"
                                            aria-label="Provider"
                                            className="w-full bg-[#162032] border border-gray-600 text-white text-sm rounded p-2 focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
                                            value={currentModel.providerId}
                                            onChange={(e) => {
                                                const newProviderId = e.target.value;
                                                const firstModel = Object.values(MODEL_REGISTRY).find(m => m.providerId === newProviderId);
                                                if (firstModel) handleModelChange(firstModel.id);
                                            }}
                                        >
                                            {Object.values(PROVIDERS).map((p: any) => (
                                                <option key={p.id} value={p.id} disabled={p.disabled}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400 font-display uppercase tracking-wider">{t('systemConfig.modelMode', 'Model Mode')}</label>
                                        <select
                                            id="global-model-select"
                                            name="modelId"
                                            aria-label="Model Mode"
                                            className="w-full bg-[#162032] border border-gray-600 text-white text-sm rounded p-2 focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
                                            value={currentModelId}
                                            onChange={(e) => handleModelChange(e.target.value)}
                                        >
                                            {Object.values(MODEL_REGISTRY)
                                                .filter(m => m.providerId === currentModel.providerId)
                                                .map(m => (
                                                    <option key={m.id} value={m.id}>{m.label}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Render Sections or Flat Settings */}
                        {(() => {
                            const group = currentModel.uiGroups.find((g: any) => g.id === activeTab);
                            if (!group) return null;

                            if (group.sections) {
                                return group.sections.map((section: any, idx: number) => {
                                    const effectiveSettings = getEffectiveSettings(currentModel.requiresTTS ?? false, section.settings);
                                    return (
                                        <section key={idx} className="space-y-3">
                                            <h3 className="text-[#ffd700] font-pixel text-[10px] uppercase mb-2 border-b border-gray-700 pb-1">
                                                {t(`systemConfig.sections.${section.title}`, section.title)}
                                            </h3>
                                            {renderSettingsList(effectiveSettings)}
                                        </section>
                                    );
                                });
                            } else if (group.settings) {
                                const effectiveSettings = getEffectiveSettings(currentModel.requiresTTS ?? false, group.settings);
                                return renderSettingsList(effectiveSettings);
                            }
                            return null;
                        })()}
                    </div>
                )}

                {/* Appearance Tab (Legacy / Static) */}
                {activeTab === 'appearance' && (
                    <div className="space-y-6">
                        <section className="space-y-3">
                            <h3 className="text-[#ffd700] font-pixel text-[10px] uppercase mb-2 border-b border-gray-700 pb-1">
                                {t('appearance.language', 'Language')}
                            </h3>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 font-display uppercase tracking-wider">{t('appearance.language', 'Language')}</label>
                                <select
                                    id="appearance-language-select"
                                    name="language"
                                    aria-label="Language Select"
                                    className="w-full bg-[#162032] border border-gray-600 text-white text-sm rounded p-2 focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
                                    value={config.language || 'en'}
                                    onChange={(e) => handleChange('language', e.target.value)}
                                >
                                    {SUPPORTED_LANGUAGES.map((lang) => (
                                        <option key={lang.code} value={lang.code}>{lang.label}</option>
                                    ))}
                                </select>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h3 className="text-[#ffd700] font-pixel text-[10px] uppercase mb-2 border-b border-gray-700 pb-1">
                                {t('appearance.background', 'Background')}
                            </h3>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 font-display uppercase tracking-wider">{t('appearance.imageUrl', 'Image URL')}</label>
                                <input
                                    id="appearance-bg-image"
                                    name="backgroundImage"
                                    aria-label="Background Image URL"
                                    type="text"
                                    className="w-full bg-[#162032] border border-gray-600 text-white text-sm rounded p-2 focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
                                    placeholder="https://example.com/image.jpg"
                                    value={themeConfig?.backgroundImage ?? ''}
                                    onChange={(e) => onThemeConfigChange?.({ ...themeConfig!, backgroundImage: e.target.value })}
                                />
                                <p className="text-[10px] text-gray-500">{t('appearance.imageUrlHelper', 'Leave empty for default animated background')}</p>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-300">{t('appearance.backgroundBlur', 'Background Blur')}</span>
                                    <span className="text-[#ffd700] font-mono">{themeConfig?.blur}px</span>
                                </div>
                                <input
                                    id="appearance-bg-blur"
                                    name="blur"
                                    aria-label="Background Blur"
                                    type="range"
                                    min="0" max="20" step="1"
                                    value={themeConfig?.blur ?? 0}
                                    onChange={(e) => onThemeConfigChange?.({ ...themeConfig!, blur: parseInt(e.target.value) })}
                                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h3 className="text-[#ffd700] font-pixel text-[10px] uppercase mb-2 border-b border-gray-700 pb-1">
                                {t('appearance.startScreen', 'Start Screen')}
                            </h3>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 font-display uppercase tracking-wider">{t('appearance.assetUrl', 'Asset URL (Image/Video)')}</label>
                                <input
                                    id="appearance-asset-url"
                                    name="startScreenUrl"
                                    aria-label="Start Screen Asset URL"
                                    type="text"
                                    className="w-full bg-[#162032] border border-gray-600 text-white text-sm rounded p-2 focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
                                    placeholder="https://example.com/start.mp4"
                                    value={themeConfig?.userAssets?.startScreenUrl ?? ''}
                                    onChange={(e) => onThemeConfigChange?.({
                                        ...themeConfig!,
                                        userAssets: { ...themeConfig?.userAssets, startScreenUrl: e.target.value }
                                    })}
                                />
                            </div>
                            <div className="flex items-center justify-between bg-[#162032] p-2 rounded border border-gray-700">
                                <span className="text-xs text-gray-300">{t('appearance.enableAudio', 'Enable Audio (Video Only)')}</span>
                                <button
                                    role="switch"
                                    aria-checked={Boolean(themeConfig?.userAssets?.startScreenAudio)}
                                    aria-label={t('appearance.enableAudio', 'Enable Audio (Video Only)')}
                                    onClick={() => onThemeConfigChange?.({
                                        ...themeConfig!,
                                        userAssets: { ...themeConfig?.userAssets, startScreenAudio: !themeConfig?.userAssets?.startScreenAudio }
                                    })}
                                    className={`w-8 h-4 rounded-full relative transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd700] ${themeConfig?.userAssets?.startScreenAudio ? 'bg-green-500' : 'bg-gray-600'}`}
                                >
                                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${themeConfig?.userAssets?.startScreenAudio ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h3 className="text-[#ffd700] font-pixel text-[10px] uppercase mb-2 border-b border-gray-700 pb-1">
                                {t('appearance.elementOpacity', 'Element Opacity')}
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {Object.entries(themeConfig?.opacity || {}).map(([key, value]) => {
                                    // Filter out non-numeric if any
                                    if (typeof value !== 'number') return null;
                                    return (
                                        <div key={key}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                <span className="text-[#ffd700] font-mono">{value}</span>
                                            </div>
                                            <input
                                                id={`appearance-opacity-${key}`}
                                                name={key}
                                                aria-label={`${key.replace(/([A-Z])/g, ' $1').trim()} Opacity`}
                                                type="range"
                                                min="0" max="1" step="0.05"
                                                value={value}
                                                onChange={(e) => onThemeConfigChange?.({
                                                    ...themeConfig!,
                                                    opacity: { ...themeConfig!.opacity, [key]: parseFloat(e.target.value) }
                                                })}
                                                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                )}
            </div>

            <footer className="p-3 border-t-2 border-white bg-[#0a0f16] flex justify-end">
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 px-4 py-2 bg-green-700 border-2 border-white text-white font-pixel text-[10px] uppercase hover:bg-green-600 transition-colors shadow-pixel-sm active:translate-y-0.5 active:shadow-none"
                >
                    <Save size={14} />
                    {t('appearance.done', 'Done')}
                </button>
            </footer>
        </aside>,
        document.body
    );
};

export default ConfigurationMenu;