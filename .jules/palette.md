## 2024-05-19 - Missing ARIA on Custom Switches
**Learning:** Custom UI toggles (pill switches) in this app often lack fundamental screen reader and keyboard accessibility patterns. Users relying on assistive tech cannot perceive the switch state or focus the element appropriately.
**Action:** When implementing or enhancing custom toggles, always ensure `role="switch"` and `aria-checked` are present for screen readers, and include `focus-visible` styles so keyboard users can navigate to and operate the controls.
