import React from 'react';
import { Pen, Eraser, Pipette, Trash2 } from 'lucide-react';
import { ThemeConfig } from '../types';
import { getBgColor } from '../lib/utils/style-utils';
import { useTranslation } from 'react-i18next';

interface ToolbeltProps {
    tool: 'pen' | 'eraser';
    setTool: (t: 'pen' | 'eraser') => void;
    color: string;
    setColor: (c: string) => void;
    brushSize: number;
    setBrushSize: (s: number) => void;
    onClear: () => void;
    themeConfig: ThemeConfig;
    isPortrait?: boolean;
}

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#ffd700', '#ffffff'];
const COLOR_NAMES: Record<string, string> = {
    '#ef4444': 'Red',
    '#3b82f6': 'Blue',
    '#22c55e': 'Green',
    '#ffd700': 'Gold',
    '#ffffff': 'White'
};
const SIZES = [2, 4, 8, 12];

const Toolbelt: React.FC<ToolbeltProps> = React.memo(({ tool, setTool, color, setColor, brushSize, setBrushSize, onClear, themeConfig, isPortrait }) => {
    const { t } = useTranslation();

    return (
        <section
            aria-label="Toolbelt"
            data-component="Toolbelt"
            className="mt-4 flex items-center gap-4 border-2 border-[#1e293b] p-3 rounded shadow-lg h-[62px] overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent transition-colors duration-300"
            style={{
                backgroundColor: getBgColor('#0f1520', themeConfig.opacity.toolbelt),
                backdropFilter: themeConfig.backgroundImage ? `blur(${themeConfig.blur / 2}px)` : 'none'
            }}
        >
            <div className="text-[8px] text-gray-500 font-pixel mr-2">{t('toolbelt.tools', 'TOOLS')}</div>

            <div className={`flex gap-2 items-center shrink-0 ${!isPortrait ? 'mr-6 border-r-2 border-gray-600 pr-6' : ''}`}>
                <button
                    onClick={() => setTool('pen')}
                    aria-label={t('toolbelt.pen', 'Pen Tool')}
                    title={t('toolbelt.pen', 'Pen Tool')}
                    aria-pressed={tool === 'pen'}
                    className={`group relative size-8 rounded flex items-center justify-center transition-transform hover:scale-105 ${tool === 'pen' ? 'bg-[#2b6cee] border-2 border-[#ffd700]' : 'bg-[#1e293b] border-2 border-gray-600'}`}
                >
                    <Pen size={14} className={tool === 'pen' ? 'text-white' : 'text-gray-400'} />
                </button>
                <button
                    onClick={() => setTool('eraser')}
                    aria-label={t('toolbelt.eraser', 'Eraser Tool')}
                    title={t('toolbelt.eraser', 'Eraser Tool')}
                    aria-pressed={tool === 'eraser'}
                    className={`group relative size-8 rounded flex items-center justify-center transition-transform hover:scale-105 ${tool === 'eraser' ? 'bg-[#2b6cee] border-2 border-[#ffd700]' : 'bg-[#1e293b] border-2 border-gray-600'}`}
                >
                    <Eraser size={14} className={tool === 'eraser' ? 'text-white' : 'text-gray-400'} />
                </button>
                <button
                    onClick={onClear}
                    aria-label={t('toolbelt.clear', 'Clear Canvas')}
                    className="group relative size-8 bg-[#1e293b] border-2 border-gray-600 hover:border-red-500 rounded flex items-center justify-center hover:scale-105 transition-transform"
                    title={t('toolbelt.clear', 'Clear Canvas')}
                >
                    <Trash2 size={14} className="text-gray-400 group-hover:text-red-500" />
                </button>
            </div>

            {/* Hide SIZE and PALETTE in portrait mode */}
            {!isPortrait && (
                <>
                    <div className="flex gap-3 items-center border-r-2 border-gray-600 pr-6 mr-6 shrink-0">
                        <div className="text-[8px] text-gray-500 font-pixel mr-1">{t('toolbelt.size', 'SIZE')}</div>
                        {SIZES.map(size => (
                            <button
                                key={size}
                                onClick={() => setBrushSize(size)}
                                aria-label={`${t('toolbelt.brushSize', 'Brush Size')} ${size}px`}
                                title={`${t('toolbelt.brushSize', 'Brush Size')} ${size}px`}
                                aria-pressed={brushSize === size}
                                className={`rounded-full bg-gray-400 hover:bg-white transition-all ${brushSize === size ? 'bg-white ring-2 ring-[#ffd700]' : ''}`}
                                style={{ width: Math.max(8, size * 1.5), height: Math.max(8, size * 1.5) }}
                            />
                        ))}
                    </div>

                    <div className="flex gap-3 items-center shrink-0">
                        <div className="text-[8px] text-gray-500 font-pixel mr-1">{t('toolbelt.palette', 'PALETTE')}</div>
                        {COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => { setColor(c); setTool('pen'); }}
                                aria-label={`${t('toolbelt.color', 'Select Color')} ${COLOR_NAMES[c] || c}`}
                                title={`${t('toolbelt.color', 'Select Color')} ${COLOR_NAMES[c] || c}`}
                                aria-pressed={color === c}
                                className={`size-6 rounded-full border-2 transition-transform hover:scale-110 shadow-sm ${color === c ? 'border-white scale-110 ring-2 ring-gray-400' : 'border-gray-600'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
});

export default Toolbelt;
