import React, { useRef, useEffect, useState } from 'react';
import { Pen, Eraser, Pipette, Trash2, Maximize2 } from 'lucide-react';

interface StageProps {
    tool: 'pen' | 'eraser';
    color: string;
    brushSize: number;
    onClear: () => void;
    videoStream: MediaStream | null;
    onCanvasReady?: (canvas: HTMLCanvasElement) => void;
    style?: React.CSSProperties;
    themeConfig?: any; // Avoiding circular dependency for now, or use ThemeConfig
}

const Stage: React.FC<StageProps> = ({ tool, color, brushSize, onClear, videoStream, onCanvasReady, style, themeConfig }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);

    // Expose canvas to parent
    useEffect(() => {
        if (canvasRef.current && onCanvasReady) {
            onCanvasReady(canvasRef.current);
        }
    }, [onCanvasReady]);

    // Sync video stream
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream]);

    // Sync canvas size with ResizeObserver - Observe the ACTUAL 16:9 Stage
    useEffect(() => {
        const stage = stageRef.current;
        const canvas = canvasRef.current;
        if (!stage || !canvas) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // We observe the stage wrapper (16:9), so use its dimensions
                const { width, height } = entry.contentRect;

                // Only act if dimensions have actually changed to avoid loop/flicker
                // Note: We update canvas resolution (width/height attributes), not style.
                if (canvas.width !== width || canvas.height !== height) {

                    // Save current content
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    if (tempCtx) {
                        tempCtx.drawImage(canvas, 0, 0);
                    }

                    // Resize
                    canvas.width = width;
                    canvas.height = height;

                    // Restore content
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(tempCanvas, 0, 0);

                        // Restore context properties
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,0)' : (color || '#ffd700');
                        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
                        ctx.lineWidth = brushSize || 4;
                        contextRef.current = ctx;
                    }
                }
            }
        });

        resizeObserver.observe(stage);

        return () => {
            resizeObserver.disconnect();
        };
    }, [tool, color, brushSize]);

    useEffect(() => {
        if (contextRef.current) {
            contextRef.current.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,0)' : color;
            contextRef.current.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
            contextRef.current.lineWidth = brushSize;
        }
    }, [color, brushSize, tool]);

    const startDrawing = ({ nativeEvent }: React.MouseEvent) => {
        const { offsetX, offsetY } = nativeEvent;
        contextRef.current?.beginPath();
        contextRef.current?.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const draw = ({ nativeEvent }: React.MouseEvent) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = nativeEvent;
        contextRef.current?.lineTo(offsetX, offsetY);
        contextRef.current?.stroke();
    };

    const stopDrawing = () => {
        contextRef.current?.closePath();
        setIsDrawing(false);
    };

    useEffect(() => {
        const handleClear = () => {
            const canvas = canvasRef.current;
            if (canvas && contextRef.current) {
                contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
            }
        };
        document.addEventListener('STAGE_CLEAR', handleClear);
        return () => document.removeEventListener('STAGE_CLEAR', handleClear);
    }, []);

    return (
        <section
            aria-label="Main Stage"
            ref={containerRef}
            data-component="Stage"
            className="flex-1 relative flex flex-col justify-center items-center overflow-hidden mb-0 group transition-colors duration-500"
            style={style}
        >
            {/* 16:9 Stage Area Wrapper */}
            <div ref={stageRef} className="relative h-full aspect-video max-w-full rpg-window rpg-window-gold shadow-2xl overflow-hidden">
                {/* Decorative Corners */}
                <div className="absolute top-0 left-0 size-6 border-t-4 border-l-4 border-[#ffd700] z-20 pointer-events-none"></div>
                <div className="absolute top-0 right-0 size-6 border-t-4 border-r-4 border-[#ffd700] z-20 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 size-6 border-b-4 border-l-4 border-[#ffd700] z-20 pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 size-6 border-b-4 border-r-4 border-[#ffd700] z-20 pointer-events-none"></div>

                {/* Start Screen / User Asset Layer */}
                {/* Visible when NO video stream is active, but a URL is configured */}
                {!videoStream && themeConfig?.userAssets?.startScreenUrl && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                        {/* Determine if Video or Image based on extension (naive check) */}
                        {themeConfig.userAssets.startScreenUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                            <video
                                src={themeConfig.userAssets.startScreenUrl}
                                autoPlay
                                loop
                                playsInline
                                muted={true} // Start muted to satisfy autoplay policy
                                ref={(el) => {
                                    // Audio Handling Logic
                                    if (el && themeConfig.userAssets.startScreenAudio) {
                                        // On mount, try to unmute if allowed, or wait for interaction
                                        const playAudio = () => {
                                            el.muted = false;
                                            el.play().catch(e => console.log("Audio autoplay prevented", e));
                                            // Once handled, remove listener
                                            document.removeEventListener('click', playAudio);
                                            document.removeEventListener('keydown', playAudio);
                                        };

                                        // Try immediately
                                        el.muted = false;
                                        el.play().catch(() => {
                                            // If failed (likely), mute and listen for interaction
                                            el.muted = true;
                                            el.play();
                                            document.addEventListener('click', playAudio);
                                            document.addEventListener('keydown', playAudio);
                                        });
                                    } else if (el) {
                                        el.muted = true; // Always mute if disabled
                                    }
                                }}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <img
                                src={themeConfig.userAssets.startScreenUrl}
                                alt="Start Screen"
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>
                )}

                {/* Video Content */}
                <div className="absolute inset-0 bg-black flex items-center justify-center">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Drawing Layer */}
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className={`absolute inset-0 z-30 cursor-crosshair w-full h-full block ${tool === 'eraser' ? 'cursor-cell' : ''}`}
                />
            </div>
        </section>
    );
};

export default Stage;