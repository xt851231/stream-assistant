const rgbCache = new Map<string, string>();

export const getBgColor = (baseColorHex: string, opacity: number): string => {
    // ⚡ Bolt: Cache parsed RGB strings to prevent redundant hex parsing (parseInt, substring)
    // during frequent React component renders.
    let rgb = rgbCache.get(baseColorHex);
    if (!rgb) {
        const hex = baseColorHex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        rgb = `${r}, ${g}, ${b}`;
        rgbCache.set(baseColorHex, rgb);
    }
    return `rgba(${rgb}, ${opacity})`;
};
