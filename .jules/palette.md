## 2024-05-18 - Custom Switch Accessibility
**Learning:** Custom "pill-shaped" toggles built with `div`/`button` instead of native `<input type="checkbox">` lack default semantic meaning and focus styles. Screen readers will just announce them as "button" without context or state.
**Action:** When creating custom switches, always include `role="switch"`, `aria-checked`, a descriptive `aria-label`, and clear keyboard focus styles (e.g. `focus-visible:ring-2 focus-visible:ring-[#ffd700]`).
