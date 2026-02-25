## 2024-05-22 - Custom Toggle Switch Accessibility Pattern
**Learning:** The app uses custom-built toggle switches (div + button) that lack semantic roles (`switch`) and state (`aria-checked`), relying solely on visual cues.
**Action:** When encountering these components, apply `role="switch"` and `aria-checked` directly to the interactive element, and ensure keyboard focus visibility using `focus-visible` utilities.
