## 2024-05-14 - Pill Switch Accessibility
**Learning:** Custom UI toggles (pill switches) built with div/button primitives lack inherent semantics and keyboard visibility. Users relying on screen readers or keyboard navigation cannot understand their state or interact with them efficiently.
**Action:** When implementing custom toggle switches, always include `role="switch"`, an accurate `aria-checked` attribute, a descriptive `aria-label`, and clear `focus-visible` styles (e.g., `focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd700] focus-visible:ring-offset-1`).
