## 2024-03-15 - Custom Pill Switch Accessibility
**Learning:** Custom UI switches built with `button` elements and `div` sliders lack built-in screen reader announcements and focus indicators.
**Action:** Always apply `role="switch"`, `aria-checked`, `aria-labelledby`, and explicit focus styles (e.g., `focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd700]`) to custom pill switches so they mimic native checkbox/switch behavior for assistive technologies and keyboard users.
