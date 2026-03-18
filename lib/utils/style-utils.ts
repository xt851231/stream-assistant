// Memoize parsed RGB strings to avoid redundant string replacements and hex parsing during frequent React component renders.
const hexToRgbCache = new Map<string, string>();

export const getBgColor = (baseColorHex: string, opacity: number): string => {
    let rgbString = hexToRgbCache.get(baseColorHex);

    if (!rgbString) {
        const hex = baseColorHex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        rgbString = `${r}, ${g}, ${b}`;
        hexToRgbCache.set(baseColorHex, rgbString);
    }

    return `rgba(${rgbString}, ${opacity})`;
};
