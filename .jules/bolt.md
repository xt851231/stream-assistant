## 2025-02-16 - useCallback Optimization
**Learning:** Functions exported via `LiveAPIContext.tsx` must be wrapped in `useCallback` to prevent cascading re-renders across memoized child components during frequent state updates (like messages).
**Action:** Identify missing `useCallback` implementations for methods exposed by context and implement them to stabilize reference identity.
