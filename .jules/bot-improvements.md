# Bot Improvements (Bolt & Palette)

*Date: 2026-03-01*

## Performance Annotations
*   **Base64 Optimizations**: Upgraded custom decoding logic in `base64ToUint8Array` to check for and utilize native implementations (`atob` and `Buffer.from`). This ensures high-throughput decoding essential for low-latency media streams.
*   **React Context Stability**: Applied `useCallback` to exposed utility functions (e.g., `addMessage`, `handleMessage`, `connect`, etc.) in `LiveAPIContext.tsx`. This stabilizes their memory references, thereby preventing cascading updates and unwanted re-renders in deeply nested child components on every state change. 

## Accessibility Annotations
*   **Aria Controls**: To align with WAI-ARIA best practices, implemented `aria-label`, `aria-pressed`, and `aria-expanded` attributes on core navigation controls within `App.tsx` (Portrait Toggle, Media Toggle, Config Toggle, Chat Toggle) to give screen readers proper context.
*   **Disabled States**: The "Send Message" control within `ChatSidebar.tsx` dynamically adopts a `disabled` attribute if its input payload is empty/whitespace-only, thus preventing void submissions and providing semantic hints to assistive technologies.
