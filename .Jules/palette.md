## 2024-05-22 - Icon-Only Button Accessibility
**Learning:** Icon-only buttons (like color swatches or tool icons) are invisible to screen readers without explicit `aria-label`s. Tooltips (`title`) help mouse users but aren't sufficient for accessibility.
**Action:** Always add `aria-label` to buttons that don't have visible text content. Use a helper map (like `COLOR_NAMES`) to generate human-readable labels for abstract values like hex codes.
