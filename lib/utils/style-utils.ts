// Cache for base color hex to its RGB string representation, avoiding repeated parsing.
// e.g. '#1e293b' -> '30, 41, 59'
const hexToRgbCache = new Map<string, string>();

export const getBgColor = (baseColorHex: string, opacity: number): string => {
    let rgbPrefix = hexToRgbCache.get(baseColorHex);
    if (!rgbPrefix) {
        const hex = baseColorHex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        rgbPrefix = `${r}, ${g}, ${b}`;
        hexToRgbCache.set(baseColorHex, rgbPrefix);
    }
    return `rgba(${rgbPrefix}, ${opacity})`;
};
