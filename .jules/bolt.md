
## 2024-05-24 - Portal Components Hook Thrashing
**Learning:** Portal components in this app execute their hooks and renders before the early `if (!isOpen) return null;` condition is met. This means frequent root-level updates (like streaming transcriptions arriving rapidly) cause massive overhead and listener thrashing in these closed portal components unless they are strictly memoized via `React.memo` and passed stable prop references (like `useCallback`).
**Action:** When creating or modifying heavy components that can be hidden (especially portals or modals), always wrap them in `React.memo` and ensure parent callbacks are stabilized with `useCallback` to prevent continuous background re-rendering.
