## 2025-03-10 - Custom UI Pill Switch Accessibility
**Learning:** Custom UI toggle buttons (pill switches) in ConfigurationMenu and MediaControlHub were lacking essential accessibility attributes, preventing screen readers from identifying them as interactive toggle switches.
**Action:** When creating custom pill switches, always include `role="switch"`, `aria-checked`, a descriptive `aria-label`, and `focus-visible` styles to ensure keyboard navigation and screen reader support.
