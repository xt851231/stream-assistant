## 2026-03-07 - Custom UI Toggle (Pill Switch) Accessibility
**Learning:** Custom 'pill switch' UI elements lack native semantics, causing screen readers to ignore their interactive state and making them difficult to use with keyboard navigation without proper focus indicators.
**Action:** Always implement ARIA `role="switch"`, dynamic `aria-checked` states, `aria-label` or `aria-labelledby` for context, and clear `focus-visible` styles on all custom switch components to ensure compliance with fundamental accessibility patterns.
