# Palette's Journal

Use this file to document critical UX and accessibility learnings.
Format: `## YYYY-MM-DD - [Title]
**Learning:** [UX/a11y insight]
**Action:** [How to apply next time]`

## 2025-05-18 - Abstract Controls and Screen Readers
**Learning:** Icon-only buttons for colors and sizes are completely invisible to screen readers without explicit labels. A "Red" button is just "button" to a blind user.
**Action:** Always map abstract values (hex codes, sizes) to human-readable names and use them in `aria-label`.
