# Learnings

## [2026-02-11 00:40] Extended Theme System and UI Refinements

**The Problem:** 
- The theme system lacked granular control for several UI components (Media Hub, Chat Messages, Stage, etc.).
- The Configuration Menu was being clipped by parent containers with `overflow-hidden`.
- Users couldn't independently style sidebar parts (Header vs Feed vs Input).

**Root Cause:**
- Initial implementation focused on major layout blocks only.
- `ConfigurationMenu` was nested inside the Toolbar, which was inside a clipped Workspace container.
- `ChatSidebar` styles were applied to the wrapper, affecting all children inheritedly.

**The Solution:**
- Extended `ThemeConfig` with 8+ new opacity properties.
- Relocated `ConfigurationMenu` to the root DOM level in `App.tsx` and increased z-index.
- Refactored `ChatSidebar.tsx` to use local `getBgColor` and apply independent opacities to Header, Feed, and Input sections.
- Applied semantic HTML tags (`<section id="chat-feed">`) for better clarity/accessibility.

**Key Changes:**
- `types.ts` & `constants.ts`: Added new opacity fields (`mainStage`, `chatFeed`, `sidebarHeader`, `sidebarInput`, etc.) and defaults.
- `App.tsx`: Moved `ConfigurationMenu`, fixed a syntax error, and passed `mainStage` opacity to `Stage`.
- `ChatSidebar.tsx`: Applied semantic tags and granular `sidebarHeader`, `chatFeed`, and `sidebarInput` opacities.
- `ConfigurationMenu.tsx`: Added new sliders to the Appearance tab and moved it out of the clipped toolbar.
- `Stage.tsx`: Added `style` prop support for dynamic background opacity.

## [2026-02-10 13:50] Fixed Chat Input Layout Overflow

**The Problem**: The "Send" button in the chat interface would disappear or be pushed out of view when the browser window was resized to a narrow width (e.g., < 600px). The input field was not shrinking correctly, causing the flex container to overflow.

**Root Cause**: The text input element within the flex container did not have a `min-width` set. By default, flex items cannot shrink below the size of their content (or a default intrinsic size). This prevented the input from shrinking enough to accommodate the fixed-width "Send" button in the available space.

**The Solution**: Added `min-w-0` (Tailwind class for `min-width: 0px`) to the input element. This overrides the default automatic minimum size, allowing the input to shrink below its content size and fit within the flexible container, ensuring the "Send" button remains visible.

**Key Changes**:
- Modified `stream-quest-dashboard/components/ChatSidebar.tsx`: Added `min-w-0` to the input element's class list.

## [2026-02-10 14:05] Fixed Toolbelt Icon Overflow

**The Problem**: The "Toolbelt" component's icons and controls would overflow the container on narrow screens. This was because the container had a fixed height and `flex-nowrap` behavior, causing content to spill out or be cut off without any way to access it.

**Root Cause**: The layout used `flex-nowrap` with a fixed width content structure inside a responsive container. When the container shrank, the content remained fixed width and overflowed.

**The Solution**: Enabled horizontal scrolling by adding `overflow-x-auto`. Also added `shrink-0` to the child flex items to prevent them from being compressed before the scroll behavior takes over. This keeps the UI compact (fixed height) but fully accessible via scrolling.

**Key Changes**:
- Modified `stream-quest-dashboard/components/Toolbelt.tsx`: Added `overflow-x-auto` to the container and `shrink-0` to child groups.

## [2026-02-10 17:35] Enforced 16:9 Aspect Ratio Globally

**The Problem**: The application needed to maintain a strict 16:9 aspect ratio for streaming purposes and future desktop packaging. The previous layout was responsive but would stretch to arbitrary ratios (e.g., ultrawide or mobile portrait), which is undesirable for a consistent broadcast layout. The "Stage" area also needed to be strictly 16:9 to ensure game capture consistency.

**Root Cause**: The root container was set to `100vw` / `100vh` without aspect ratio constraints. The Stage component was `flex-1`, filling whatever space was left.

**The Solution**:
1.  **Global Lock**: Wrapped the entire application in a centered container with `aspect-video` (16:9) and `max-w-[177.78vh]`. This creates a letterbox/pillarbox effect on non-16:9 screens, ensuring the app always presents a standard broadcast frame.
2.  **Stage Lock**: Wrapped the inner content of the Stage component (video and canvas) in a responsive container with `aspect-video` and `h-full`. This ensures the game content itself is always 16:9, regardless of the dashboard's internal layout balance.

**Key Changes**:
- Modified `stream-quest-dashboard/App.tsx`: Added a global 16:9 wrapper.
- Modified `stream-quest-dashboard/components/Stage.tsx`: Added an inner 16:9 wrapper for the video/canvas content.

## [2026-02-10 18:15] Implemented Retro Grid Background

**The Problem**: The user wanted to improve the aesthetic of the black bars that appear around the 16:9 dashboard on wider/taller screens. The request was for a "retro gaming" feel with minimal changes.

**Root Cause**: The outer container was a simple `bg-black` div.

**The Solution**:
1.  **Retro Grid**: Replaced the black background with a CSS-only `linear-gradient` grid pattern that fades out radially (vignette).
2.  **Ambient Glow**: Added a blurred, pulsing blue element behind the main dashboard to give it depth and separation from the background.
3.  **CRT Scanlines**: Added a subtle scanline overlay using repeating linear gradients to simulate an old monitor texture.

**Key Changes**:
- Modified `stream-quest-dashboard/App.tsx`: Replaced the outer container's background and added overlay divs for the effects.

## [2026-02-10 18:25] Fixed Retro Dashboard Layout & Visibility

**The Problem**: After adding the retro background effects, the main dashboard container was slightly too tall (`max-h-screen`), causing the title bar to be cut off at the top. Additionally, the retro grid and scanline effects were too subtle to be easily seen.

**Root Cause**: `max-h-screen` on the App component caused it to fill the entire viewport height, pushing content off-screen when combined with flex alignment or borders. The opacity values for the background effects were also set too low (0.2 / 0.03).

**The Solution**:
1.  **Layout Fix**: Reduced the dashboard's max-height to `max-h-[96vh]` to ensure a small buffer around the edges, keeping the entire UI (including the title bar) visible.
2.  **Visibility Boost**: Increased the grid opacity to 0.4 and the scanline opacity to 0.08 to make the retro aesthetic more pronounced.

**Key Changes**:
- Modified `stream-quest-dashboard/App.tsx`: Updated CSS classes for height constraints and effect opacities.

## [2026-02-10 18:35] Aligned Chat Input Height

**The Problem**: The user requested that the chat input container in the sidebar have the exact same height and visual vertical alignment as the "Toolbelt" component (62px), rather than its previous default height.

**Root Cause**: The chat input container was using padding (`p-3`) and default block sizing, whereas the Toolbelt had a fixed height (`h-[62px]`).

**The Solution**:
1.  **Height Constraint**: Applied `h-[62px]` directly to the chat input container.
2.  **Vertical Centering**: Changed the container to `flex items-center` to ensure the input field and button remain centered within the new fixed height.
3.  **Visual Parity**: This ensures that when the sidebar and toolbelt are side-by-side, their control surfaces align perfectly.

**Key Changes**:
- Modified `stream-quest-dashboard/components/ChatSidebar.tsx`: Updated the input container's class to include fixed height and flex alignment.

## [2026-02-10 18:40] Aligned Chat Input Position & Height

**The Problem**: The user requested that the chat input container in the sidebar have the exact same height (`62px`) and vertical position as the "Toolbelt" component relative to the bottom of the screen.

**Root Cause**:
1.  **Height**: Chat input was using default block sizing vs the Toolbelt's fixed `62px`.
2.  **Position**: The Toolbelt was inside a container with `p-4` padding, effectively lifting it 1rem off the bottom. The Chat input was flush against the bottom of the sidebar.

**The Solution**:
1.  **Height**: Applied `h-[62px]` to the chat input container.
2.  **Position**: Added `mb-4` (margin-bottom) and `mx-4` (horizontal margin) to lift the container and detach it from the edges, matching the "floating" placement of the Toolbelt.
3.  **Styling**: Added `border-2` and `rounded-lg` to complete the floating UI look.

**Key Changes**:
- Modified `stream-quest-dashboard/components/ChatSidebar.tsx`: Converted the input container from a docked footer to a floating box element.

## [2026-02-10 18:50] Fixed Canvas Coordinate Mismatch

**The Problem**: The user reported being unable to draw on the right side of the screen. The drawing strokes would stop or become misaligned past a certain point.

**Root Cause**: The `ResizeObserver` in `Stage.tsx` was observing the outer flex container instead of the inner 16:9 stage wrapper. This caused the canvas internal resolution to match the full window width, while the visual canvas was constrained to a 16:9 aspect ratio by CSS. This mismatch meant the coordinate system for drawing events (based on visual size) didn't map correctly to the internal canvas pixels on the right side.

**The Solution**:
1.  **Ref Targeting**: Added a `ref` specifically to the 16:9 stage wrapper (`div.aspect-video`).
2.  **Observer Update**: Updated the `ResizeObserver` to track this new ref. This ensures the canvas internal resolution (`width`/`height` attributes) always matches exactly what the user sees on screen.

**Key Changes**:
- Modified `stream-quest-dashboard/components/Stage.tsx`: Changed resizing logic to bind to the 16:9 container.

## [2026-02-10 19:07] Improved Semantic Structure with HTML5 Tags

**The Problem**: The user found it difficult to refer to major UI containers because they were all generic `div` elements with Tailwind utility classes. This made debugging and communication harder.

**The Solution**: Replaced major container `div`s with semantic HTML5 elements:
- **`Stage.tsx`**: `div` -> `<section aria-label="Main Stage">`
- **`ChatSidebar.tsx`**:
    - Header -> `<header>`
    - Input Container -> `<footer>`
- **`Toolbelt.tsx`**: `div` -> `<section aria-label="Toolbelt">`
- **`ConfigurationMenu.tsx`**:
    - Main Container -> `<aside aria-label="Configuration Menu">`
    - Tabs -> `<nav aria-label="Config Tabs">`
    - Action Bar -> `<footer>`
- **`MediaControlHub.tsx`**:
    - Main Container -> `<aside aria-label="Media Controls">`
    - Header -> `<header>`

**Key Changes**:
- Modified `Stage.tsx`, `ChatSidebar.tsx`, `Toolbelt.tsx`, `ConfigurationMenu.tsx`, `MediaControlHub.tsx` to use semantic HTML. No visual changes were made as Tailwind classes were preserved.

## [2026-02-14 11:25] Fixed Dependency Resolution and Environment Cleanup

**The Problem:**
- The application failed to build (`npm run build`) and had issues starting with `npm run dev` after being copied from another folder.
- Specifically, the build failed with a "Rollup failed to resolve import '@google/genai'" error.
- The project contained broken symlinks and unnecessary Windows metadata files (`:Zone.Identifier`).

**Root Cause:**
- **Dependency Mismatch:** The `package.json` had been modified to include `@google/generative-ai` but the codebase (specifically `GeminiLiveAdapter.js` and `GeminiFlashAdapter.js`) was written using the newer `@google/genai` SDK.
- **Portability Issues:** Copying the project folder preserved a broken symlink `src -> ../src` which pointed to a non-existent parent directory.
- **Artifact Clutter:** Windows NTFS "Alternative Data Streams" (Zone.Identifier files) were present throughout the project after the copy operation.

**The Solution:**
1.  **Fixed Dependencies:** Updated `package.json` to use `"@google/genai": "^1.38.0"` instead of `@google/generative-ai`.
2.  **Environment Sync:** Performed a fresh `npm install` to ensure the correct SDK was available in `node_modules`.
3.  **Cleanup:** Removed the broken `src` symlink and all `:Zone.Identifier` files.
4.  **Style Integrity:** Created an empty `index.css` to satisfy the `<link>` reference in `index.html` and prevent 404 errors.

**Key Changes:**
- `package.json`: Replaced `@google/generative-ai` with `@google/genai`.
- `index.css`: Created new file in root.
- File System: Deleted `src` symlink and all `*:Zone.Identifier` files.

## [2026-02-14 01:25] Refactored Configuration Menu to Registry-Based System

**The Problem**: 
- The configuration menu was hardcoded in `ConfigurationMenu.tsx`, making it difficult to support different models with different settings (e.g., VAD for Live vs. Thinking for Flash).
- The codebase had dependencies on parent folders (`../../`), making the dashboard component difficult to portability.
- Adding new providers or models required modifying multiple files and manual UI updates.

**Root Cause**: 
- Configuration logic and UI rendering were tightly coupled in `ConfigurationMenu.tsx`.
- State management was local to the component and reset on unmount/refresh.

**The Solution**: 
1.  **Model Registry**: Created `utils/model-registry.ts` to define providers, models, and their specific settings schema (UI groups, sections, fields).
2.  **Data-Driven UI**: Completely rewrote `ConfigurationMenu.tsx` to dynamically render tabs, sections, and inputs based on the selected model's registry definition.
3.  **Persistence**: Implemented `localStorage` saving with model-specific keys (e.g., `config_gemini-live`), ensuring settings are remembered per model.
4.  **Consolidation**: Grouped VAD, Behavior, and Connection settings into a single "System" tab with clear subsections to reduce clutter.
5.  **Isolation**: Moved `model-registry.ts` into the local `utils` folder and verified no external dependencies exist, making the dashboard self-contained.

**Key Changes**:
- Created `stream-quest-dashboard/utils/model-registry.ts`.
- Refactored `stream-quest-dashboard/components/ConfigurationMenu.tsx`.
- Updated `types.ts` and `constants.ts` to support new fields (`topP`, `topK`, `thinkingBudget`, `enableVAD`).

## [2026-02-14 01:40] Fixed Gemini Live Connection After Registry Refactor

**The Problem**: 
- After the Configuration Menu refactoring to use a Model Registry, Gemini Live mode stopped connecting. Clicking "GO LIVE" would attempt a Flash (REST) connection instead of a WebSocket connection.

**Root Cause**: 
- `LiveAPIContext.tsx` line 129 had a hardcoded check: `config.provider === 'gemini-live-websocket'`.
- After the refactor, `config.provider` now stores the registry key `'gemini-live'` instead of `'gemini-live-websocket'`.
- This caused the condition to always be `false`, creating a `'flash'` adapter instead of a `'live'` adapter.

**The Solution**: 
- Imported `MODEL_REGISTRY` into `LiveAPIContext.tsx`.
- Replaced the hardcoded string check with a registry lookup: `MODEL_REGISTRY[config.provider]?.protocol === 'websocket' ? 'live' : 'flash'`.
- This approach is future-proof: adding new models only requires updating `model-registry.ts`.

**Key Changes**:
- Modified `stream-quest-dashboard/contexts/LiveAPIContext.tsx`: Added `MODEL_REGISTRY` import, replaced hardcoded provider check with registry protocol lookup.

## [2026-02-14 18:00] Fixed Mid-Session Persona/Voice Updates for Gemini Live API

**The Problem:**
- Switching personas mid-session caused the WebSocket to close with `Invalid JSON payload received. Unknown name "speechConfig" at 'setup'` and later `Request contains an invalid argument`.
- The `useEffect` in `App.tsx` fired on every connection, causing infinite reconnect loops.

**Root Cause:**
- The Gemini Live API **only accepts the `setup` message as the first message** in a session. Sending a raw `setup` message mid-session is rejected by the server.
- The `useEffect` watching `config.systemInstructions` and `config.voice` had no guard against firing on initial connection or after a reconnect.

**The Solution:**
1. **Reconnect approach**: Changed `GeminiLiveAdapter.updateConfig()` to disconnect and reconnect with the new config, instead of sending a raw WebSocket `setup` message.
2. **Ref guard**: Added a `prevConfigRef` in `App.tsx` that tracks previous `systemInstructions` and `voice` values. The `useEffect` now only fires `setLiveConfig` when these values actually change (not on initial mount or reconnect).
3. **Property mapping**: Added `systemInstructions` → `systemInstruction` mapping in both adapters' `updateConfig` methods, since `AppConfig` uses plural but the API expects singular.

**Key Changes:**
- `lib/api/adapters/GeminiLiveAdapter.js`: Replaced raw WebSocket `setup` with disconnect+reconnect in `updateConfig()`.
- `lib/api/adapters/GeminiFlashAdapter.js`: Added `systemInstructions` → `systemInstruction` mapping.
- `App.tsx`: Added `prevConfigRef` guard to prevent infinite reconnect loops.
- `components/ConfigurationMenu.tsx`: Added `handlePersonaSelect()` to update `selectedPersonaId`, `systemInstructions`, and `voice` atomically.
- `tests/mid_session_updates.test.js`: Rewritten to verify disconnect+reconnect behavior.
- `tests/mid_session_updates_flash.test.js`: Rewritten with dependency injection (no `mock.module`), added TTS recreation test.

## [2026-02-14 18:15] Decoupled Media Streams from Model Connection Lifecycle

**The Problem:**
- When switching personas on the Live API, the disconnect+reconnect killed all media streams (mic, camera, screen share), forcing users to manually re-enable them.

**Root Cause:**
- The `on('close')` handler in `LiveAPIContext.tsx` called `cleanupMedia()`, stopping all media streams.
- Media streamers (`AudioStreamer`, `VideoStreamer`, `ScreenCapture`) held a fixed reference to the adapter (`this.client`) set in the constructor with no way to swap it.

**The Solution:**
1. **`setClient(newClient)`**: Added to `AudioStreamer` and `BaseVideoCapture` to swap the adapter reference without stopping streams.
2. **Removed `cleanupMedia()` from `on('close')`**: Media streams now persist independently. Only user-initiated `disconnect()` stops them.
3. **`setConfig()` with reconnect**: In `LiveAPIContext.tsx`, `setConfig` now handles the full reconnect lifecycle for Live API: disconnect adapter → create new adapter → connect → re-attach all active streamers via `setClient()`.

**Key Changes:**
- `lib/utils/media-utils.js`: Added `setClient()` to `AudioStreamer` and `BaseVideoCapture`.
- `contexts/LiveAPIContext.tsx`: Removed `cleanupMedia()` from close handler, added `latestConfigRef`, reimplemented `setConfig` with reconnect logic.
- `lib/api/adapters/GeminiLiveAdapter.js`: Simplified `updateConfig()` to only merge config (reconnect handled by context).
- `tests/mid_session_updates.test.js`: Added `setClient` tests and updated adapter tests.

## [2026-02-14 19:10] Persona Identity, Context Sync, and Menu Refinement

**The Problem:**
- Connection messages were generic ("Connected and ready!") and then used incorrect persona names (e.g., "Felix is online" after switching to Kai).
- Chat sender names were confusing: user voice inputs appeared as "System", and assistant responses were hardcoded as "Gemini".
- The configuration menu lumped all VAD settings together, though some are specific to Gemini Live's server-side logic.
- Duplicate logs for "Speech volume set to 100%" cluttered the console on every reload.

**Root Cause:**
- `App.tsx` was only passing `systemInstructions` and `voice` to the context during updates, leaving the `selectedPersonaId` stale.
- `LiveAPIContext.tsx` didn't have logic to map assistant type to the active persona name or map `user-transcript` to "You".
- `ChatMessage.tsx` hardcoded the Bot icon for all assistant messages.
- React StrictMode in development mode mounts components twice, triggering double calls to `SpeechAudioContext.setVolume`.

**The Solution:**
1. **Context Sync Fix**: Updated `App.tsx` `useEffect` to watch and pass `selectedPersonaId` to `setLiveConfig`.
2. **Dynamic Identity**: 
   - Updated `LiveAPIContext.addMessage` to resolve persona names and map `user-transcript` -> "You".
   - Customized connection message: `${PersonaName} is online`.
3. **Persona-Specific Icons**: Updated `ChatMessage.tsx` to lookup and display a persona's emoji/icon instead of a generic bot.
4. **Improved Menu Organization**: Split VAD settings in `model-registry.ts` into "Client VAD" (Common) and "Server VAD" (Live specific).
5. **Log Debouncing**: Modified `SpeechAudioContext.setVolume` to only log when the volume value actually changes.

**Key Changes:**
- `App.tsx`: Added `selectedPersonaId` to config sync logic.
- `contexts/LiveAPIContext.tsx`: Updated `addMessage` and `setup_complete` handlers.
- `components/ChatMessage.tsx`: Added persona lookup for icon rendering.
- `utils/model-registry.ts`: Reorganized `uiGroups` to separate Client/Server VAD.
- `lib/utils/SpeechAudioContext.js`: Added check to prevent duplicate logging.
