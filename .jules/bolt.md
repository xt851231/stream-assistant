## 2024-05-18 - Caching Parsed Hex Strings in Utility Functions
**Learning:** Frequent React component re-renders (like `ChatMessage`) can cause significant overhead when utility functions perform redundant string manipulations and hex parsing on the same inputs repeatedly.
**Action:** Use a `Map` cache in frequently called styling utilities (e.g., `getBgColor`) to store parsed results (like RGB strings) and avoid recalculating them on every render.
