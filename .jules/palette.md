## 2024-03-06 - Accessible Pill Switches
**Learning:** Custom UI toggles (pill switches) built with `<button>` elements require explicit ARIA roles (`role="switch"`) and `aria-checked` attributes to properly announce their state to screen readers, along with clear `focus-visible` styles for keyboard navigation.
**Action:** Always include `role="switch"`, dynamic `aria-checked`, a descriptive `aria-label`, and `focus-visible:ring-2` styling on any custom toggle switches across the application.
