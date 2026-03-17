const bgColorCache = new Map<string, string>();

/**
 * Parses a hex color to an RGB string prefix.
 * Cached to prevent redundant string replacements and hex parsing during frequent React component renders.
 */
export const getBgColor = (baseColorHex: string, opacity: number): string => {
    let rgbPrefix = bgColorCache.get(baseColorHex);

    if (!rgbPrefix) {
        const hex = baseColorHex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        rgbPrefix = `${r}, ${g}, ${b}`;
        bgColorCache.set(baseColorHex, rgbPrefix);
    }

    return `rgba(${rgbPrefix}, ${opacity})`;
};
