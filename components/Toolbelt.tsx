import React from 'react';
import { Pen, Eraser, Pipette, Trash2 } from 'lucide-react';
import { ThemeConfig } from '../types';
import { getBgColor } from '../lib/utils/style-utils';

type DrawingTool = 'pen' | 'eraser';

interface ToolbeltProps {
    currentTool: DrawingTool;
    setTool: (tool: DrawingTool) => void;
    currentColor: string;
    setColor: (color: string) => void;
    currentBrushSize: number;
    setBrushSize: (size: number) => void;
    onClear: () => void;
    themeConfig: ThemeConfig;
    isPortrait?: boolean;
}

const colors = ['#ef4444', '#3b82f6', '#22c55e', '#ffd700', '#ffffff'];
const COLOR_NAMES: Record<string, string> = {
    '#ef4444': 'Red',
    '#3b82f6': 'Blue',
    '#22c55e': 'Green',
    '#ffd700': 'Gold',
    '#ffffff': 'White'
};

const Toolbelt: React.FC<ToolbeltProps> = ({
    currentTool, setTool, currentColor, setColor,
    currentBrushSize, setBrushSize, onClear, themeConfig, isPortrait
}) => {
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
            <div className="text-[8px] text-gray-500 font-pixel mr-2">TOOLS</div>

            <div className="flex gap-2 mr-6 border-r-2 border-gray-600 pr-6 items-center shrink-0">
                <button
                    onClick={() => setTool('pen')}
                    aria-label="Pen Tool"
                    title="Pen Tool"
                    className={`group relative size-8 rounded flex items-center justify-center transition-transform hover:scale-105 ${currentTool === 'pen' ? 'bg-[#2b6cee] border-2 border-[#ffd700]' : 'bg-[#1e293b] border-2 border-gray-600'}`}
                >
                    <Pen size={14} className={currentTool === 'pen' ? 'text-white' : 'text-gray-400'} />
                </button>
                <button
                    onClick={() => setTool('eraser')}
                    aria-label="Eraser Tool"
                    title="Eraser Tool"
                    className={`group relative size-8 rounded flex items-center justify-center transition-transform hover:scale-105 ${currentTool === 'eraser' ? 'bg-[#2b6cee] border-2 border-[#ffd700]' : 'bg-[#1e293b] border-2 border-gray-600'}`}
                >
                    <Eraser size={14} className={currentTool === 'eraser' ? 'text-white' : 'text-gray-400'} />
                </button>
                <button
                    onClick={onClear}
                    aria-label="Clear Canvas"
                    className="group relative size-8 bg-[#1e293b] border-2 border-gray-600 hover:border-red-500 rounded flex items-center justify-center hover:scale-105 transition-transform"
                    title="Clear Canvas"
                >
                    <Trash2 size={14} className="text-gray-400 group-hover:text-red-500" />
                </button>
            </div>

            {/* Conditionally render Size and Palette only in Landscape mode */}
            {!isPortrait && (
                <>
                    {/* Size selection */}
                    <div className="flex gap-3 items-center border-r-2 border-gray-600 pr-6 mr-6 shrink-0">
                        <span className="text-xs font-bold text-gray-400 tracking-widest hidden sm:block">SIZE</span>
                        <div className="flex gap-2 bg-gray-900/50 p-1.5 rounded-lg border border-gray-700">
                            {[2, 5, 10, 20].map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setBrushSize(size)}
                                    className={`relative rounded-md transition-all flex items-center justify-center p-2
                                        ${currentBrushSize === size
                                            ? 'bg-blue-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border border-blue-400'
                                            : 'hover:bg-gray-700 border border-transparent hover:border-gray-500'}`}
                                    title={`Brush Size ${size}`}
                                    aria-label={`Brush Size ${size}`}
                                >
                                    <div
                                        className="bg-white rounded-full shadow-sm"
                                        style={{ width: `${Math.max(4, size)}px`, height: `${Math.max(4, size)}px` }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Palette selection */}
                    <div className="flex gap-3 items-center shrink-0">
                        <span className="text-xs font-bold text-gray-400 tracking-widest hidden sm:block">PALETTE</span>
                        <div className="flex gap-2 items-center bg-gray-900/50 p-1.5 rounded-lg border border-gray-700">
                            {colors.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    className={`w-8 h-8 rounded-md transition-all border-2 
                                        ${currentColor === c
                                            ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10'
                                            : 'border-transparent hover:scale-105 hover:border-gray-400 hover:shadow-md'}`}
                                    style={{ backgroundColor: c }}
                                    title={COLOR_NAMES[c]}
                                    aria-label={`Select color ${COLOR_NAMES[c]}`}
                                />
                            ))}

                            <div className="w-[1px] h-6 bg-gray-600 mx-1"></div>

                            {/* Color picker input for custom colors */}
                            <label className="cursor-pointer group relative flex items-center justify-center w-8 h-8 rounded-md transition-all hover:bg-gray-700" title="Custom Color">
                                <input
                                    type="color"
                                    value={currentColor}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                    aria-label="Custom Color Picker"
                                />
                                <div
                                    className={`w-6 h-6 rounded-full border-2 border-dashed flex items-center justify-center
                                        ${colors.includes(currentColor)
                                            ? 'border-gray-400 group-hover:border-white'
                                            : 'border-white glow-pulse bg-gradient-to-br from-current to-transparent'}`}
                                    style={{
                                        background: colors.includes(currentColor) ? 'transparent' : currentColor,
                                        borderColor: colors.includes(currentColor) ? undefined : '#fff'
                                    }}
                                >
                                    {colors.includes(currentColor) && (
                                        <div className="w-1/2 h-1/2 rounded-full conic-gradient-colors" />
                                    )}
                                </div>
                            </label>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
};

export default Toolbelt;
