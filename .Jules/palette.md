## 2025-05-18 - Toggle Button Accessibility
**Learning:** Many custom toggle buttons in the UI lacked `aria-pressed`, `aria-checked`, and `role="switch"`, making them confusing for screen reader users who couldn't determine their state or function.
**Action:** When creating custom interactive components like toggles, always ensure they have appropriate ARIA roles and state attributes to communicate their behavior to assistive technologies.
