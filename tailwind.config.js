/** @type {import('tailwindcss').Config} */
export default {
    darkMode: "class",
    content: [
        "./index.html",
        "./index.tsx",
        "./**/*.{js,ts,jsx,tsx}",
        "!./node_modules/**",
    ],
    theme: {
        extend: {
            colors: {
                "primary": "#2b6cee",
                "primary-dark": "#1a4a8d",
                "accent-gold": "#ffd700",
                "background-light": "#f6f6f8",
                "background-dark": "#101622",
                "rpg-slate": "#232f48",
            },
            fontFamily: {
                "display": ["Space Grotesk", "sans-serif"],
                "pixel": ['"Press Start 2P"', '"Ark Pixel"', '"DotGothic16"', "cursive"],
            },
            boxShadow: {
                "pixel": "4px 4px 0px 0px rgba(0,0,0,0.5)",
                "pixel-sm": "2px 2px 0px 0px rgba(0,0,0,0.5)",
            },
        },
    },
    plugins: [
        require("@tailwindcss/forms"),
        require("@tailwindcss/container-queries"),
    ],
};
