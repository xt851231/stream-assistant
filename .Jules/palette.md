## 2025-02-13 - Semantic Custom Toggles
**Learning:** The application uses custom-styled buttons to mimic "toggle switches" (e.g., "Capture Game Audio"). These were implemented as standard buttons, which confuses screen readers about the expected interaction model (button vs. switch).
**Action:** For UI elements that visually resemble and behave like on/off switches, explicitly use `role="switch"` and `aria-checked` instead of `aria-pressed` to match user expectations.
