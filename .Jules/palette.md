## 2025-05-19 - Accessibility of Icon-Only Buttons
**Learning:** Icon-only buttons (like 'Close' or 'Send') are often overlooked in accessibility passes because they lack visible text. Adding `aria-label` is critical for screen reader users to understand the button's purpose.
**Action:** Always verify that buttons without text children have a descriptive `aria-label` or `aria-labelledby` attribute.

## 2025-05-19 - Form Submission State Feedback
**Learning:** Users can be confused by a form that does nothing when submitted empty. Disabling the submit button when the input is invalid (e.g., empty) and providing visual cues (opacity, cursor change) improves usability by preventing errors before they happen.
**Action:** Implement disabled states for form submission buttons based on input validation, ensuring clear visual feedback.
