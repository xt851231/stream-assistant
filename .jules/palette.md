## 2024-03-22 - Add ARIA Switch Accessibility to Custom Toggles
**Learning:** Custom UI toggles (like the green pill switches) often lack fundamental screen reader and keyboard accessibility. A simple generic `<button>` without `role="switch"` or `aria-checked` leaves screen readers clueless.
**Action:** When building custom toggle switches, always include `role="switch"`, dynamically bind `aria-checked` to the state, provide an `aria-label`, and ensure clear focus indicators (e.g., `focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd700]`).
