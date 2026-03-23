## 2024-03-14 - Pill Switch Accessibility Pattern
**Learning:** Custom UI toggles (e.g., pill switches) must implement fundamental screen reader and keyboard accessibility patterns. This design system standardizes on a gold/yellow color (`#ffd700`) for custom keyboard focus indicators.
**Action:** When creating or modifying pill switches, always include the ARIA `switch` role (`role="switch"`), `aria-checked` attributes, `aria-labelledby` or `aria-label` tags, and clear `focus-visible:ring` styles (e.g., `focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd700]`).
