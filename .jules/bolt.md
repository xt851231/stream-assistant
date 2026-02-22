## 2025-02-14 - Canvas Resize Allocation
**Learning:** Re-allocating DOM elements (like <canvas>) inside high-frequency loops (requestAnimationFrame) triggered by ResizeObserver causes significant GC pressure and jank.
**Action:** Always use a useRef to cache reusable DOM elements or large buffers for operations that run on every frame/resize event.
