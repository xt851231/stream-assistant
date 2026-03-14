// Cache to prevent redundant string replacements and hex parsing during frequent React renders
const hexToRgbCache = new Map<string, string>();

export const getBgColor = (baseColorHex: string, opacity: number): string => {
    let rgb = hexToRgbCache.get(baseColorHex);
    if (!rgb) {
        const hex = baseColorHex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        rgb = `${r}, ${g}, ${b}`;
        hexToRgbCache.set(baseColorHex, rgb);
    }
    return `rgba(${rgb}, ${opacity})`;
};
