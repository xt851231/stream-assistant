# Learnings

## [2026-02-24 17:15] Unified History Injection Across Model Protocols

**The Problem:**
1. Conversation history was lost when switching between models (Live vs. Flash) or when persona switches forced a session restart.
2. Different models have incompatible ways of handling history: Gemini Live requires discrete WebSocket "turns," while Gemini Flash (REST) requires a persistent context array in every request.
3. Injecting history must not trigger the model to respond immediately, or it would create a "double response" alongside the user's current input.

**Root Cause:**
1. The `ModelAdapter` interface lacked a standardized way to provide historical context to newly initialized adapters.
2. Previous attempts at history injection in the Live API were sometimes colliding with the connection setup phase or causing protocol violations by setting `turnComplete: true`.

**The Solution:**
1. **Standardized Interface:** Added `setHistory(messages)` to the `ModelAdapter` base class.
2. **Provider-Specific Implementation:**
   - **Gemini Live:** Maps history to an array of `turns` and sends them via `session.sendClientContent` with `turnComplete: false`.
   - **Gemini Flash:** Updates a local `this.history` buffer that is automatically prepended to all future REST requests.
3. **Optimized Timing (Live API):** History is injected **only after** the `setup_complete` message is received. This prevents race conditions during the initial WebSocket handshake.
4. **Resumption Guard:** If the session is resumed using a `sessionHandle`, manual history injection is skipped. The Gemini server naturally restores the full context when a handle is provided, and manual injection could cause conflicts or duplicates.
5. **Sender Labeling:** Prefixes history text with the original sender's name (e.g., `[Luna]: Hello`) to help the model distinguish between different personas and users in the conversation log.
6. **Context-Driven Sync:** Updated `LiveAPIContext.tsx` to automatically slice the last 100 messages from its central state and call `adapter.setHistory` inside the `setup_complete` event handler.

**Key Changes:**
- `lib/api/interfaces/ModelAdapter.js`: Added `setHistory` to the base class.
- `lib/api/adapters/GeminiLiveAdapter.js` & `GeminiFlashAdapter.js`: Implemented specialized history handlers with resumption guards.
- `contexts/LiveAPIContext.tsx`: Integrated history syncing into the `setup_complete` event handler.
- `conductor/architecture/HISTORY_INJECTION.md`: Created detailed documentation of the injection strategy.
- `tests/history_injection.test.js`: Verified timing, filtering, and resumption-skipping logic.

**Post-Implementation Finding (Live API `role: "model"` issue):**
1. While testing the above, the new persona still fails to acknowledge the injected history.
2. According to the [Gemini Live API documentation on incremental updates](https://ai.google.dev/gemini-api/docs/live-guide#send-text), `sendClientContent` natively supports `role: "model"` to establish session context.
3. Therefore, the failure is **not** due to an invalid role. The failure is likely caused by:
   - **Pending Context Buffer:** We send the history with `turnComplete: false`. The API might require this to be immediately closed by a `turnComplete: true` action before it registers the context to memory. Since our next input usually comes via Realtime Audio rather than a concluding text turn, the context buffer might be dropped.
   - **Strict Turn Alternation:** The API might enforce a strict `user` -> `model` -> `user` alternation. If our injected history array ends with a `user` message, and then the user speaks next, the API receives two consecutive `user` turns and might reset or ignore the history.
   - **Formatting Errors:** Subtle bugs in mapping React state into the exact `[{ role, parts: [{ text }] }]` shape required by the backend.

## [2026-02-24 16:25] Reverted History Injection Causing WebSocket Conflicts

**The Problem:**
1. Switching personas resulted in WebSocket conflicts and the connection entering a CLOSING or CLOSED state.
2. The manual injection of chat history for new connections was colliding with the connection setup lifecycle.

**Root Cause:**
1. Explicitly injecting chat history via `sendClientContent` upon opening a new session created race conditions with the server, leading to protocol violations and 1007/1000 errors.
2. The logic was unnecessary when `sessionResumption` is active, as the session handle inherently restores the context.

**The Solution:**
1. Reverted the history injection implementation in `LiveAPIContext.tsx` and `GeminiLiveAdapter.js`.
2. When the user stays on the same persona, the application successfully uses `sessionResumption.handle` to restore the conversation context natively.
3. When the user switches personas, the session handle is cleared, starting a fresh session without manual history injection, avoiding the conflicting state.
4. Added test cases to verify that `GeminiLiveAdapter` correctly parses the session handle but ignores explicit history sending.

**Key Changes:**
- `contexts/LiveAPIContext.tsx`: Removed `convertMessagesToHistory` and history prop from `ModelClient.createAdapter`.
- `lib/api/adapters/GeminiLiveAdapter.js`: Removed the `sendClientContent` block that injected history.
- `tests/session_resumption.test.js`: Added new test to verify `sessionResumption` behavior without history.

## [2026-02-24 13:10] Fixed Memory Loss and Voice Persistence on Persona Switch

**The Problem:**
1. Switching persona (e.g., from Luna to Felix) seemed to persist the voice from the previous persona. 
2. After switching persona, the new persona did not seem to remember the previous conversation context.
3. Live Assistant messages were occasionally getting cut short.

**Root Cause:**
1. **Config Ignored by Server:** We were passing `sessionResumption.handle` to the Live API connection config when switching personas. The Google GenAI backend assumes a session resumption restores the exact previous state, thus completely ignoring the new `systemInstruction` and `voice` configurations. This caused the old voice and persona to persist.
2. **Missing History Injection:** Because we must force a new session to apply the new persona config (by omitting the `sessionResumption.handle`), the new session starts with a blank context. The previous chat history was not being actively provided to the new connection.
3. **Turn Complete Event Order:** `GeminiLiveAdapter.js` emitted the `turn_complete` signal *before* the parsed incoming text chunks were completely forwarded to the application, causing `LiveAPIContext.tsx` to mark the message as finished prematurely. 

**The Solution:**
1. Updated `LiveAPIContext.tsx`'s `setConfig` logic to detect changes to `selectedPersonaId`. If changed, it actively nullifies `sessionHandleRef.current` to force a brand new session, allowing the Google GenAI backend to successfully process the new voice and system instructions.
2. Implemented `messagesRef` in `LiveAPIContext.tsx` to synchronously track the active chat history, formatted via `convertMessagesToHistory()`. This translated `history` array is passed to the Adapter on new connections.
3. Updated `GeminiLiveAdapter.js`'s `connect()` method to manually replay `this.config.history` via `session.sendClientContent()` immediately upon a successful connection to grant the new persona full context of the previous conversation.
4. Re-ordered the event emission in `GeminiLiveAdapter.js`'s message parser to ensure `turnComplete` always fires *after* all text/audio components have been queued.

**Key Changes:**
- `contexts/LiveAPIContext.tsx`: Added `messagesRef`, persona change detection, and history array translation.
- `lib/api/adapters/GeminiLiveAdapter.js`: Added history dispatch upon connection, and re-ordered the `turn_complete` emission.

## [2026-02-24 11:23] Fixed Media Stream Leaks and Audio Capture Latency

**The Problem:**
1. Screen share permissions and events seemed to trigger multiple times.
2. The Gemini Live API felt significantly slower to respond than in previous iterations.
3. Camera and Microphone streams remained active (e.g., webcam light staying on) even after clicking "Disconnect".

**Root Cause:**
1. The UI buttons in `MediaControlHub.tsx` were calling their corresponding configuration `handleChange()` methods and *also* firing direct `onToggle*` callbacks. Since `App.tsx` already responds to config changes by firing the toggle methods natively, the media streams were opened back-to-back, leaking concurrent streams that the application lost track of.
2. The `capture.worklet.js` processing buffer size had been increased to 4096 samples (256ms) in a previous optimization commit, creating an inherent delay. Additionally, the native Client-Side VAD threshold was raised to 0.05, clipping the first syllables of speech and giving the AI less context.

**The Solution:**
1. Removed the redundant `onToggle*` callbacks from `MediaControlHub.tsx`'s buttons, relying solely on the single-source-of-truth configuration propagation.
2. Reduced the `capture.worklet.js` buffer size to 1024 samples (64ms latency) and reset the VAD threshold back to 0.02 to capture the initial phonemes of speech instantly. Update unit tests to enforce the 1024 buffer size to prevent future regressions.

**Key Changes:**
- `components/MediaControlHub.tsx`: Removed redundant event handlers.
- `public/audio-processors/capture.worklet.js`: Reduced buffer size to 1024.
- `lib/utils/media-utils.js`: Reduced VAD threshold to 0.02 and updated padding chunk algorithms.
- `tests/capture_worklet_perf.test.js`: Added assertion to lock the buffer size to 1024.
## [2026-02-24 01:55] Security, Accessibility, and Performance Branch Merges

**The Problem:**
1. Configuration values read from `localStorage` were blindly parsed and merged into application state, posing a security risk from corrupted or poisoned data.
2. Form elements and buttons in the Toolbelt lacked `aria-label`s, breaking accessibility for screen readers.
3. The CSP (Content Security Policy) was missing, leaving the app open to potential XSS attacks.
4. Stage canvas resizing caused unnecessary memory allocation and GC pauses.
5. Adapter logic logged sensitive PII (transcriptions) to the console.

**Root Cause:**
1. Using raw `JSON.parse` coupled with `localStorage.getItem` directly in component state initialization.
2. Rapid iteration ignored screen reader attributes on `<button>` and `<input>` elements.
3. Initial vite configuration didn't include meta CSP headers.
4. `document.createElement('canvas')` was called inside `requestAnimationFrame` on every resize tick.
5. Debug logs from development remained active.

**The Solution:**
1. Created `utils/storage-utils.ts` with `safeJsonParse` and `validateAndMergeConfig` to strictly type-check and sanitize incoming `localStorage` payloads before applying them.
2. Refactored the `Toolbelt.tsx` elements to include precise `aria-label` tags, and added `COLOR_NAMES` mapping for screen readers.
3. Enforced a strict `<meta http-equiv="Content-Security-Policy">` in `index.html` and extracted inline scripts/styles into external files (`tailwind-config.js`, `importmap.json`, `index.css`).
4. Implemented object pooling in `Stage.tsx` by using a `tempCanvasRef.current` strictly during the resize observer phase to prevent loop allocation.
5. Replaced direct printing of transcript values with `length` redaction in `GeminiFlashAdapter.js` and `GeminiLiveAdapter.js`. Also scrubbed noisy debug output.

**Key Changes:**
- `utils/storage-utils.ts` & `App.tsx`: Added runtime config validation.
- `index.html` & `public/`: Added strict CSP and removed inline scripts.
- `components/Toolbelt.tsx`: Applied accessibility attributes and wrapped export in `React.memo` to improve performance.
- `components/Stage.tsx`: Optimized canvas pool.
- `lib/api/adapters/`: Scrubbed sensitive console logs and noisy debugging data.
## [2026-02-22 17:15] Fixed Camera/Mic Persisting After Disconnect

**The Problem:**
When the user clicked "Disconnect", the camera, microphone, and screen share elements remained active (e.g. webcam light stayed on).

**Root Cause:**
1. The `AudioWorkletNode.disconnect()` method in `media-utils.js` throws an error in Chrome if the node was never connected to an output destination (which it wasn't, as it just processes PCM data).
2. Because `audioStreamerRef.current.stop()` threw an unhandled exception, `LiveAPIContext.cleanupMedia()` crashed midway and never reached `videoStreamer.stop()`.
3. The `App.tsx` local state for `mediaConfig` held onto `videoEnabled: true`, so when a user reconnected, the UI toggles were out of sync.

**The Solution:**
1. Wrapped `this.audioWorklet.disconnect()` in a `try/catch` block within `AudioStreamer.stop()`.
2. Wrapped each individual streamer stop sequence in `cleanupMedia()` with robust `try/catch` blocks to ensure a failure in one doesn't crash the teardown of the others.
3. Updated `handleConnect` in `App.tsx` to explicitly reset local `mediaConfig` toggles to `false` when manually disconnecting.

**Key Changes:**
- `lib/utils/media-utils.js`: Hardened `AudioStreamer.stop()`.
- `contexts/LiveAPIContext.tsx`: Hardened `cleanupMedia()`.
- `App.tsx`: Added `setMediaConfig` state reset in `handleConnect()`.
- `tests/media_cleanup.test.js`: Added assertions to ensure `try/catch` wrappers exist around media stop commands.

**The Problem:**
1. The Chat Box completely took over the screen layout when Portrait Mode was toggled.
2. The browser consoles showed 50+ warnings regarding form fields missing `id`, `name`, and `<label>` attributes, causing autofill/accessibility issues.

**Root Cause:**
1. Portrait Layout Bug: The Chat sidebar container was being assigned both `h-full` and `h-[40%]` classes in portrait mode because I didn't completely remove `h-full` from the generic classlist.
2. Form Field Warnings: Various `<input>`, `<select>`, and `<textarea>` components in `ConfigurationMenu`, `MediaControlHub`, `App`, and `ChatSidebar` were created for visual purposes but skipped standard W3C form attributes.

**The Solution:**
1. Removed `h-full` from the root string in `App.tsx` and moved it appropriately to only render during landscape conditional checks.
2. Added `id`, `name`, and `aria-label` attributes to every identified `input`, `select`, and `textarea` element to appease the HTML accessibility warnings and screen readers.

**Key Changes:**
- `App.tsx`: Fixed portrait mode class logic. Added attributes to `gameTitle` input.
- `components/ChatSidebar.tsx`: Added form attributes to chat input.
- `components/MediaControlHub.tsx`: Added form attributes to device selectors and volume sliders.
- `components/ConfigurationMenu.tsx`: Systematically injected `id={settingId}`, `name={settingId}` and `aria-label` to all dynamically generated inputs, as well as static appearance sliders.

**The Problem:**
Automated bots (Bolt, Palette, Sentinel) had proposed branches for various architectural improvements. However, each branch contained lockfile changes that conflicted, making a direct git merge messy. 

**Root Cause:**
Independent automated systems generated branches simultaneously without awareness of each other, leading to overlapping lockfile states and `.jules` documentation tracking.

**The Solution:**
Manually ported the core logic from the six proposed branches into the main application to ensure a clean commit history and proper test coverage.

**Key Changes:**
1. **Performance (Bolt):** Applied `React.memo`, `useCallback`, and `useMemo` in `App.tsx` and `ChatSidebar.tsx` to prevent unnecessary re-renders during high-frequency state updates (like typing the game title).
2. **Performance (Bolt):** Optimized memory allocation in `Stage.tsx` by reusing an offscreen canvas (`tempCanvasRef`) during resize events.
3. **Accessibility (Palette):** Added `aria-label`, `title`, and `aria-pressed` attributes to all icon-only buttons in `Toolbelt.tsx` to support screen readers.
4. **Security (Sentinel):** Fixed sensitive data leakage by redacting actual text content from `console.log` statements in `BrowserTTSAdapter.js` (now logs text length instead). Added `tests/security_logging_redaction.test.js` to ensure TDD compliance.

## [2026-02-21 23:25] Systematized Media Pipeline Protections

**The Problem:**
Media-related bugs (stale closures, missing parameters, and stream desync) were repeating across multiple sessions.

**The Solution:**
Instead of ad-hoc fixes, I formalized the media architecture and defensive coding rules to prevent future regressions.

**Key Changes:**
- **`conductor/architecture/MEDIA_PIPELINE.md`**: Created a permanent reference for how frames flow.
- **`.agent/rules/project_rules.md`**: Added three mandatory "Defensive Rules":
  1. **Ref-First Callbacks**: Mandatory use of `useRef` for any state inside media event handlers.
  2. **Parameter Totality**: Toggle functions must accept full `config: AppConfig`.
  3. **Ghost Prevention**: Enforced nulling of refs in `cleanupMedia` to prevent background processing.

See the [MEDIA_PIPELINE.md](file:///home/xt851231/experiments/stream-quest-dashboard/conductor/architecture/MEDIA_PIPELINE.md) for full details.

## [2026-02-21 21:05] Fixed Missing Config & Uncaught Permission Errors

**The Problem:**
1. The LLM could not see the camera video (or drawings) because `toggleVideo` was throwing `TypeError: Cannot read properties of undefined (reading 'enableVAD')`. This aborted the stream setup before `alwaysTransmit` or `transmitFrames` could be enabled, meaning zero frames were ever sent to the LLM.
2. Clicking "Cancel" when asked for screen share or camera permissions resulted in an `Uncaught (in promise) NotAllowedError` because the `start` promises in `LiveAPIContext.tsx` were unhandled.

**Root Cause:**
1. In `App.tsx`, `MediaControlHub` invoked `toggleVideo(enabled)` without passing the required `camId` and `config` parameters, leaving `config` as `undefined`.
2. The `toggleAudio`, `toggleVideo`, and `toggleScreen` functions in `LiveAPIContext.tsx` lacked `try/catch` blocks around the asynchronous `start` calls.

**The Solution:**
1. Updated `App.tsx` to correctly pass `toggleVideo(enabled, 'default', config)`.
2. Wrapped the inner logic of `toggleAudio`, `toggleVideo`, and `toggleScreen` with `try/catch` blocks in `LiveAPIContext.tsx` to log errors gracefully and ensure context state reverts locally if start fail.

**Key Changes:**
- `App.tsx`: Fixed `onToggleVideo` prop.
- `contexts/LiveAPIContext.tsx`: Added `try/catch` handling for media toggles.
## [2026-02-21 20:48] Fixed Stale Closure: Camera Frames Sent Instead of Screen Share

**The Problem:**
When both screen share and camera were active with Client-Side VAD enabled (Live API mode), the LLM received camera frames instead of screen share frames during speech.

**Root Cause:**
The `onSpeechStatusChange` callback in `toggleAudio` captured the `screenSharing` React state variable in its closure. If audio was enabled first (when `screenSharing = false`), then screen share was enabled later, the callback still saw the stale `screenSharing = false`. This caused `videoStreamerRef.transmitFrames = isSpeaking && !false` (camera ON) and `screenCaptureRef.transmitFrames = isSpeaking && false` (screen OFF). Additionally, `setLatestImage()` in `BaseVideoCapture` was called unconditionally for both streams, so the camera's frame would overwrite the screen's frame even when the camera shouldn't be transmitting.

**The Solution:**
1. Added `screenSharingRef` (a React ref) that mirrors the `screenSharing` state but is always current. The `onSpeechStatusChange` callback now reads `screenSharingRef.current` instead of the closure-captured state.
2. Gated `setLatestImage()` behind the same `alwaysTransmit || transmitFrames` check as `sendImage()`, so only the active source's frame is stored.
3. Reset `screenSharingRef.current = false` in `cleanupMedia()`.

**Key Changes:**
- `contexts/LiveAPIContext.tsx`: Added `screenSharingRef`, updated VAD callback to use it, synced ref in `toggleScreen` and `cleanupMedia`.
- `lib/utils/media-utils.js`: Moved `setLatestImage()` inside the `alwaysTransmit || transmitFrames` guard.

## [2026-02-21 14:20] Per-Model Config Storage with Per-Model Persona Voice Defaults

**The Problem:**
Config was stored in a flat `app_config` key. Switching models lost API keys, personas, and voice settings. Each model should have independent config including its own API key.

**Root Cause:**
`handleModelChange` built defaults from `FIELD_DEFINITIONS` where `apiKey` has no `defaultValue` → set to `undefined`, overwriting the user's key. The monolithic config blob caused cross-contamination.

**The Solution:**
Per-model storage: `config_{provider}` stores the full `AppConfig` for each model. `app_config` stores only `{ provider }` for routing on reload. MediaConfig and ThemeConfig remain global.

Persona voiceDefaults are now per-model — `Persona.voice: string` → `Persona.voiceDefaults: Record<string, PersonaVoiceConfig>` — so different models can have different voice options.

**Key Changes:**
- `types.ts`: Added `PersonaVoiceConfig`, changed `Persona.voice` → `Persona.voiceDefaults`
- `constants.ts`: Updated all personas with `voiceDefaults` per provider, added `getPersonaVoiceForModel()`
- `utils/model-registry.ts`: Simplified `getStorageKey(provider)`, added `saveModelConfig()`/`loadModelConfig()`
- `App.tsx`: Uses `loadModelConfig`/`saveModelConfig`
- `components/ConfigurationMenu.tsx`: All handlers use per-model storage, persona selection uses `getPersonaVoiceForModel`
- `tests/config_storage.test.js`: 24 architecture + logic tests
- `tests/tts_config.test.js`: Fixed ESM resolution issue

## [2026-02-21 13:22] Cherry-Picked Accessibility, Security & Refactoring from Jules Branches

**The Problem:**
- All Toolbelt icon-only buttons (pen, eraser, clear, brush sizes, color swatches) lacked `aria-label` attributes, making them invisible to screen readers.
- `GeminiLiveAdapter`, `GeminiFlashAdapter`, and `GeminiTTSAdapter` were logging actual user transcription text and response content to the browser console — a privacy concern.
- `GeminiLiveAdapter.connect()` was a 100+ line monolithic method mixing config building, callbacks, and connection logic.

**Root Cause:**
- Accessibility labels were never added during initial development.
- Debug logging from development was left active with sensitive content (user speech, AI responses).
- The connect method grew organically without refactoring.

**The Solution:**
1. **Toolbelt A11y**: Added `aria-label` and `title` to all 6 button types. Created `COLOR_NAMES` map (`#ef4444` → `"Red"`) for human-readable color names.
2. **Sensitive Log Removal**: Removed 4 `console.log` calls that logged transcription text from `GeminiLiveAdapter`. Removed transcript logging from `GeminiFlashAdapter`. Replaced `text.substring()` logging with `text.length` in `GeminiTTSAdapter`.
3. **Connect Refactoring**: Extracted `_buildConnectConfig()` (config object) and `_getCallbacks()` (WebSocket handlers) from `connect()`. Also removed the noisy `'📨 RAW onmessage'` debug log.

**Key Changes:**
- `components/Toolbelt.tsx`: aria-label/title on all buttons, COLOR_NAMES map
- `lib/api/adapters/GeminiLiveAdapter.js`: Removed sensitive logs, extracted `_buildConnectConfig()` and `_getCallbacks()`
- `lib/api/adapters/GeminiFlashAdapter.js`: Removed transcript log, replaced substring log with length
- `lib/api/tts/adapters/GeminiTTSAdapter.js`: Replaced substring logs with length
- `tests/jules_branches_review.test.js`: 11 new tests

## [2026-02-21 11:12] Cherry-Picked Performance Optimizations from Jules Branch

**The Problem:**
- The `capture.worklet.js` was sending raw Float32 audio data to the main thread, requiring CPU-intensive PCM16 conversion and RMS calculation on the UI thread.
- `GeminiLiveAdapter.handleIncomingMessage()` had 6 active `console.log` calls on every incoming message/audio chunk, creating GC pressure during streaming.
- `Stage.tsx` ResizeObserver was torn down and recreated on every `tool`/`color`/`brushSize` prop change due to over-broad dependency array.

**Root Cause:**
- Audio processing (Float32→Int16 conversion + RMS) was architecturally misplaced — it ran on the main thread instead of the AudioWorklet thread.
- Debug logging was left active from development.
- React effect dependencies weren't optimized for the ResizeObserver pattern.

**The Solution:**
1. **Worklet-Side Processing**: Moved PCM16 conversion and RMS calculation into `capture.worklet.js`. Uses asymmetric scaling (`0x8000` for negative, `0x7FFF` for positive) for full Int16 range. Sends `ArrayBuffer` via `Transferable` for zero-copy transfer.
2. **Media-Utils Cleanup**: Removed `convertToPCM16()` method and main-thread RMS loop from `AudioStreamer`. Now consumes pre-processed `pcmBuffer` and `rms` from worklet messages.
3. **Console.log Cleanup**: Commented out 6 hot-path `console.log` calls in `GeminiLiveAdapter.handleIncomingMessage()`.
4. **Stage.tsx Refs**: Used `useRef` for `tool`, `color`, `brushSize` inside ResizeObserver callback, changed dependency array to `[]`.

**Key Changes:**
- `public/audio-processors/capture.worklet.js`: PCM16 conversion + RMS + Transferable buffer.
- `lib/utils/media-utils.js`: Removed `convertToPCM16()`, consume pre-processed worklet data.
- `lib/api/adapters/GeminiLiveAdapter.js`: Commented out 6 hot-path console.logs.
- `components/Stage.tsx`: useRef pattern for ResizeObserver props.
- `tests/capture_worklet_perf.test.js`: New test suite validating worklet optimization.



## [2026-02-21 01:58] Added Project Documentation (README.md)

**The Problem:**
- The project lacked comprehensive documentation regarding its architecture, file structure, and testing procedures.

**Root Cause:**
- Focus was primarily on engineering fixes and feature implementation.

**The Solution:**
- Created a `README.md` containing a project summary, detailed file structure, brief functional descriptions of key files, startup instructions, and testing guidelines using the native `node:test` runner.

**Key Changes:**
- `README.md`: Created new comprehensive documentation file.

## [2026-02-21 01:30] Fixed Live API Audio Playback Glitches & Queue Interruptions

**The Problem:**
- Audio playback sometimes broke, glitched, or jumped backward to previous sentences, even after the chunk ordering fix.

**Root Cause:**
- **Ring Buffer Overflow:** The `playback.worklet.js` used a bounded 5-second ring buffer. If chunks arrived faster than real-time playback (e.g., during long AI monologues), `writeIndex` could lap `readIndex`, overwriting unplayed audio and causing backward skips.
- **Precision Loss:** Continuously increasing JS numbers for `writeIndex` and `readIndex` over very long sessions could eventually hit precision limits.
- **Stale Queue:** When the AI was interrupted (user spoke), the Live API emitted an `interrupted` event and the worklet buffer was cleared, but the `_playQueue` promise chain in `AudioPlayer` kept processing previously queued chunks, playing old audio.

**The Solution:**
- In `playback.worklet.js`, added bounds checking: if `writeIndex` laps `readIndex`, the buffer drops the oldest unplayed data by fast-forwarding `readIndex`.
- Added periodic index wrapping (subtracting exact buffer multiples) to prevent precision loss.
- In `media-utils.js`, updated `AudioPlayer.interrupt()` to actively clear the `_playQueue` by resetting it to `Promise.resolve()`, instantly aborting pending chunks.

**Key Changes:**
- `public/audio-processors/playback.worklet.js`: Fixed ring buffer boundaries and index wrapping strategies.
- `lib/utils/media-utils.js`: Upgraded `interrupt()` to reset the promise queue.
## [2026-02-21 01:24] Fixed Live API Audio Chunk Playback Ordering

**The Problem:**
- In Live API mode, audio playback was out of order — sentences didn't align with the on-screen text transcription.

**Root Cause:**
- `AudioPlayer.play()` was `async` and contained `await SpeechAudioContext.resume()`.
- When multiple WebSocket audio chunks arrived rapidly, each triggered a separate `play()` call. The `await` yielded execution, allowing later chunks to resolve first and post to the AudioWorklet **before** earlier chunks.
- The ring buffer in the worklet faithfully plays in write order, so misordered `postMessage` calls = misordered audio.

**The Solution:**
- Made `play()` synchronous (non-async) and queue each chunk through a `_playQueue` promise chain.
- Each chunk's async processing (`_playChunk`) is serialized: chunk B can't post until chunk A finishes posting.

**Key Changes:**
- `lib/utils/media-utils.js`: Split `play()` into synchronous `play()` (queuer) and async `_playChunk()` (processor). Added `_playQueue` promise chain to `AudioPlayer` constructor.
## [2026-02-21 01:10] Fixed Stale VideoStreamer Client Reference After Reconnect

**The Problem:**
- After switching between Live API and REST modes (or disconnecting and reconnecting), the camera would stream locally but the model could not see the video frames.

**Root Cause:**
- `cleanupMedia()` called `.stop()` on all streamers but never nulled out the refs (`videoStreamerRef`, `screenCaptureRef`, `audioStreamerRef`).
- On reconnect, `connect()` created a new adapter (`clientRef.current`), but `toggleVideo` checked `if (!videoStreamerRef.current)` — the old stopped streamer was non-null, so no new one was created.
- The old streamer's `this.client` still pointed to the **previous session's adapter**. For REST mode, `setLatestImage()` was called on the dead old adapter instead of the new `GeminiFlashAdapter`, leaving `latestImage = null`.

**The Solution:**
1. Null out all streamer refs in `cleanupMedia()` so fresh instances are always created on reconnect.
2. Added `setClient(clientRef.current)` safety nets in `toggleVideo` and `toggleScreen` for cases where a streamer survives between sessions.

**Key Changes:**
- `contexts/LiveAPIContext.tsx`: Added ref nulling in `cleanupMedia()`, added `setClient()` calls in `toggleVideo` and `toggleScreen`.
## [2026-02-21 00:43] Fixed Background Video Frame Transmission

**The Problem:**
- When both a webcam and a screen share were active simultaneously, the AI was receiving video frames from both sources, or prioritizing the camera even if it was relegated to the small Picture-in-Picture (PiP) view.
- The intention was for the LLM to only "see" what is currently being broadcasted on the main Stage area.

**Root Cause:**
- `VideoStreamer` and `ScreenCapture` both extended `BaseVideoCapture` and ran independent capture intervals.
- In `LiveAPIContext.tsx`, when `toggleScreen` was activated, the `VideoStreamer` was left running in the background (to maintain the PiP UI), but its `transmitFrames` and `alwaysTransmit` flags were never toggled off.
- This meant that during active speech (VAD enabled) or continuously (VAD disabled), both streamers were fighting to send `sendImage` payloads to the Gemini API, causing context confusion.

**The Solution:**
- Updated the `LiveAPIContext.tsx` media toggles to enforce mutual exclusivity for frame transmission while allowing both streams to remain open for the UI.
- In `toggleAudio` (VAD handler), `videoStreamerRef.current.transmitFrames` now explicitly checks `!screenSharing` before allowing camera frames to send.
- In `toggleScreen(true)`, existing camera transmission is disabled (`alwaysTransmit = false`, `transmitFrames = false`).
- In `toggleScreen(false)`, camera transmission is restored based on current VAD settings and speech state.
- In `toggleVideo`, camera is only allowed to transmit if `!screenSharing`.

**Key Changes:**
- `contexts/LiveAPIContext.tsx`: Strengthened state machine logic in `toggleAudio`, `toggleVideo`, and `toggleScreen` to ensure only the main `videoStream` source sends image data to the adapters.
## [2026-02-21 00:40] Fixed Video Frame Transmission in Gemini Flash REST Mode

**The Problem:**
- When using the Gemini Flash (REST) model, the AI could not "see" the video frames (e.g., from a webcam or screen share). It responded as a text-only AI when asked about visual elements.
- The live API mode worked perfectly fine.

**Root Cause:**
- `GeminiFlashAdapter.js` had a stubbed `sendImage` method that simply logged a warning: `"GeminiFlashAdapter: sendImage received but ignored in real-time mode..."`.
- Since REST APIs don't hold a continuous real-time streaming connection for images, the incoming frames from the `VideoStreamer` were being discarded instead of saved.
- `GeminiFlashAdapter` had a `latestImage` property and a `setLatestImage` method, but they weren't wired to the `sendImage` adapter interface method.

**The Solution:**
- Updated the `sendImage` method in `GeminiFlashAdapter.js` to call `this.setLatestImage(base64Image)`. This accumulates the most recent frame.
- Updated `sendText` to fall back to `this.latestImage` if no explicit image is provided in the call.
- Now, when the user speaks (triggering `onSpeechEnd` and `sendAudioToFlash`) or types (triggering `sendText`), the accumulated `latestImage` is included in the REST API payload context, enabling multimodal vision.

**Key Changes:**
- `lib/api/adapters/GeminiFlashAdapter.js`: Rewired `sendImage` to store the frame, and made sure multimodal attachments use `latestImage` when appropriate.
## [2026-02-21 00:33] Fixed TTS base64ToUint8Array ReferenceError

**The Problem:**
- The model responded via Gemini Flash REST, but the audio output failed to play.
- An error was thrown: `ReferenceError: base64ToUint8Array is not defined at GeminiTTSAdapter.playAudio`.

**Root Cause:**
- The `GeminiTTSAdapter.js` was using `base64ToUint8Array` to decode incoming PCM audio from base64, but the utility function was never imported into the file. The function had been moved to `base64-utils.js` during recent pipeline optimizations.

**The Solution:**
- Imported `base64ToUint8Array` from `../../../utils/base64-utils.js` at the top of `GeminiTTSAdapter.js`.

**Key Changes:**
- `lib/api/tts/adapters/GeminiTTSAdapter.js`: Added import statement for `base64ToUint8Array`.
## [2026-02-20 14:15] TTS Configuration for Non-Live (REST) Models

**The Problem:**
- Non-live API models (like Gemini Flash 2.5 REST) lacked audio output customization.
- While these models can use TTS (Text-to-Speech) for responses, there was no UI to configure the TTS engine, voice, rate, or pitch.
- Browser-based TTS voices were not discoverable or selectable in the configuration menu.

**Root Cause:**
- The `AppConfig` and Model Registry only supported native voices for the Live API.
- `ConfigurationMenu` was not designed to dynamically fetch and display system-level resources like browser synthesis voices.
- TTS Adapters were instantiated with hardcoded defaults instead of taking advantage of the full user configuration.

**The Solution:**
1. **Dynamic Registry Update**: Enhanced the `MODEL_REGISTRY` for REST models to include a dedicated "TTS Configuration" section.
2. **State & Types Extension**: Added `ttsEngine`, `ttsVoice`, `ttsRate`, and `ttsPitch` to `AppConfig`.
3. **Browser Voice Integration**: Implemented a `useEffect` hook in `ConfigurationMenu.tsx` to enumerate `window.speechSynthesis` voices and provide them as options when the "Browser" engine is selected.
4. **Adapter Re-initialization**: Updated `GeminiFlashAdapter.updateConfig` to detect TTS configuration changes and hot-swap the TTS adapter mid-session.
5. **Enhanced TTS Adapters**: Updated `BrowserTTSAdapter` to apply `rate`, `pitch`, and `voice` configuration to `SpeechSynthesisUtterance` instances.

**Key Changes:**
- `types.ts` & `constants.ts`: Added new TTS configuration fields and defaults.
- `utils/model-registry.ts`: Defined TTS UI fields and added them to REST models.
- `components/ConfigurationMenu.tsx`: Added dynamic browser voice discovery and context-aware voice selection.
- `lib/api/adapters/GeminiFlashAdapter.js`: Implemented smart re-initialization of TTS on config change.
- `lib/api/tts/adapters/BrowserTTSAdapter.js`: Added support for rate, pitch, and configurable voice.
- `lib/api/tts/adapters/GeminiTTSAdapter.js`: Updated to respect user-selected voice.

## [2026-02-16 00:15] Isolated Screen Audio and Project Knowledge Codification

**The Problem:**
- Game/System audio during screen sharing played at full volume through the browser's default path, bypassing the dashboard's volume controls.
- Screen audio was not being captured or routed correctly for local playback (e.g., for streamers using OBS).
- Repetitive architectural mistakes (like missing state sync in `useMemo`) were slowing down development and requiring manual correction.

**Root Cause:**
- The `ScreenCapture` class explicitly disabled audio capture in `getDisplayMedia`.
- `SpeechAudioContext` only had a single gain node for AI voice, lacking a separate path for system sounds.
- Project-specific best practices were buried in the long `learn.md` file but not actively enforced by the editor's context.

**The Solution:**
1. **Audio Path Isolation**: Enhanced `SpeechAudioContext` with a dedicated `systemGainNode`. This allows independent volume control for "AI Voice" vs "Game Audio".
2. **Screen Capture Routing**: Updated `ScreenCapture` to request audio tracks and route them exclusively to the `systemGainNode` for local playback. Critically, this audio is kept isolated from the capture worklet to prevent the AI from hearing itself or the game (avoiding echo/confusion).
3. **Volume Split**: Refactored `MediaConfig` to separate `aiVolume` and `systemVolume`, enabling granular UI control.
4. **Knowledge Codification**: Created `.cursorrules` to distill critical project patterns (State Integrity, Media Path Isolation, Aspect Ratio Sensitivity) into a format the AI can actively use during development.

**Key Changes:**
- `lib/utils/media-utils.js`: Added audio support to `ScreenCapture` with isolated routing.
- `lib/utils/SpeechAudioContext.js`: Implemented `systemGainNode` and `setSystemVolume`.
- `types.ts` & `constants.ts`: Split `volume` into `aiVolume` and `systemVolume`.
- `.cursorrules`: New file with architectural and UI guidelines.
- `conductor/`: Updated track metadata and task documentation for audio isolation.


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

## [2026-02-15 01:44] Enabling Native Affective Dialog

**The Problem:**
The native `enableAffectiveDialog` field in `LiveConnectConfig` was rejected by the API with an "Unknown name" error. This was because the feature requires the `v1alpha` API version.

**The Solution:**
1. Kept the `gemini-2.5-flash-native-audio-preview-12-2025` model ID (correct for Live API).
2. Updated `GeminiLiveAdapter` to initialize the `GoogleGenAI` client with `{ httpOptions: { apiVersion: "v1alpha" } }`.
3. Added `enableAffectiveDialog: true` to the connection config.
4. Removed the manual system instruction fallback.

**Key Changes:**
- `lib/api/adapters/GeminiLiveAdapter.js`: Updated client initialization for `v1alpha` and added `enableAffectiveDialog`.
- `constants.ts`: Reverted model ID to `gemini-2.5-flash-native-audio-preview-12-2025`.

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

## [2026-02-15 00:55] Fixed Transcription, Deprecation Warning, and Proactive Audio Loop

**The Problem:**
- Proactive audio caused non-stop talking after being enabled.
- Transcription (input/output) did not appear in the chat.
- Console showed deprecation warning: `Setting LiveConnectConfig.generation_config is deprecated`.

**Root Cause:**
1. **Non-stop talking:** `isModelRespondingRef` didn't exist. The proactive nudge timer only checked `isSpeaking` (user mic), not model output state. After each model response, the next nudge fired immediately.
2. **Deprecation warning:** `temperature`, `topP`, `topK` were nested inside `generationConfig: {}`, but the SDK now expects them directly on `LiveConnectConfig`.
3. **Transcription:** Both `createAdapter()` call sites in `LiveAPIContext.tsx` (initial connect and setConfig reconnect) used a hand-picked config object that only included a subset of fields. `inputTranscription`, `outputTranscription`, `temperature`, `topP`, `topK`, `thinkingBudget`, and `affectiveDialog` were all missing — they arrived as `undefined` at the adapter, so the SDK never received transcription config in the setup message.

**The Solution:**
1. Added `isModelRespondingRef` to `LiveAPIContext.tsx` — set `true` on model content, cleared on `turn_complete`/`interrupted`. Proactive nudges are blocked while model is responding.
2. Flattened `generationConfig` fields directly onto `LiveConnectConfig` in `GeminiLiveAdapter.js`.
3. Added the missing config fields (`inputTranscription`, `outputTranscription`, `temperature`, `topP`, `topK`, `thinkingBudget`, `affectiveDialog`) to both `createAdapter()` call sites in `LiveAPIContext.tsx`.
4. Simplified `inputAudioTranscription` config to `{}` and added fallback transcription handlers + debug logging in the adapter.

**Key Changes:**
- `contexts/LiveAPIContext.tsx`: Added `isModelRespondingRef`, `turn_complete` handler, and added missing config fields to both `createAdapter()` calls (lines ~204 and ~466).
- `lib/api/adapters/GeminiLiveAdapter.js`: Flattened generation config, simplified transcription config, added fallback transcription handlers and debug logging.

## [2026-02-15 01:17] Proactive Response Appending to Previous Chat Entry

**The Problem:**
When proactive audio triggered a new model response, the response text appeared appended to the previous assistant message in chat instead of as a new, separate chat entry.

**Root Cause:**
The `turn_complete` handler in `LiveAPIContext.tsx` reset `isModelRespondingRef` and rescheduled the proactive timer, but **never marked the last message as `isFinished: true`**. The `addMessage()` function checks `lastMsg.type === type && !lastMsg.isFinished` — since the last assistant message was never marked finished, the next assistant response (from the proactive nudge) was appended to it.

**The Solution:**
In the `turn_complete` handler, use `setMessages` to mark the last message's `isFinished` flag as `true`. This causes `addMessage()` to create a new chat entry for subsequent assistant responses.

**Key Changes:**
- `contexts/LiveAPIContext.tsx`: Added `setMessages` update in `turn_complete` handler to set `isFinished: true` on the last message.

## [2026-02-15 17:42] Fixed Game Audio Volume Slider Not Working

**The Problem:**
The "Game Audio Volume" slider in the Media Hub had no audible effect on game audio during screen sharing.

**Root Cause:**
Game audio from screen share played through **two independent paths**:
1. The `<video>` element in `Stage.tsx` (NOT muted) — played audio directly at full volume, unaffected by any slider.
2. `SpeechAudioContext.systemGainNode` (in `media-utils.js`) — correctly controlled by the slider.

The `<video>` element's audio masked the gain node changes, making the slider appear broken.

**The Solution:**
Added `muted` attribute to the main `<video>` element in `Stage.tsx`. This ensures game audio only routes through the `SpeechAudioContext.systemGainNode` → `audioContext.destination` path, which the slider controls.

Also confirmed: game audio is **isolated from the LLM stream**. The `ScreenCapture` class only sends JPEG frames via `sendImage()`. Audio routes exclusively to local playback and is never connected to the mic capture worklet.

**Key Changes:**
- `components/Stage.tsx`: Added `muted` to the main `<video>` element (line ~197).
- `tests/game_audio_volume.test.js`: New test file verifying `SpeechAudioContext.setSystemVolume()` correctly updates the gain node.

## [2026-02-15 17:50] Fixed Screen Share Button Not Lighting Up & Camera PIP Not Showing

**The Problem:**
1. The screen share button in the toolbar didn't visually indicate it was active (no highlight).
2. When screen sharing was active, the camera stream didn't appear in the secondary screen (PIP) below the chat area.

**Root Cause:**
`screenSharing` was declared in the `LiveAPIContextType` interface and included in the `useMemo` dependency array, but was **missing from the actual `contextValue` object** in `LiveAPIContext.tsx`. This meant every consumer received `undefined` for `screenSharing`.

In `App.tsx`:
- Button highlight: `screenSharing ? 'bg-[#ffd700]' : 'bg-blue-900'` → always `bg-blue-900`
- Camera PIP: `videoStream={screenSharing ? cameraStream : null}` → always `null`

**The Solution:**
Added `screenSharing` to the `contextValue` object in the `useMemo` call (line ~569).

**Key Changes:**
- `contexts/LiveAPIContext.tsx`: Added `screenSharing` to `contextValue` object.

## [2026-02-15 18:03] Added Semantic Tags to App Containers & Fixed Chat-Feed Background

**The Problem:**
1. CSS selectors for key containers were extremely long (80+ chars) because most containers were generic `div` elements without IDs or semantic tags.
2. The `#chat-feed` section had its own opaque background that covered the parent sidebar's background (with its backdrop-filter blur effect).

**Root Cause:**
- Container elements in `App.tsx` lacked semantic HTML tags or IDs.
- `ChatSidebar.tsx` was an `<aside>` (same as its new parent wrapper), and `#chat-feed` had its own `backgroundColor` style.

**The Solution:**
1. **Semantic tags in `App.tsx`**: Added `id="viewport"` to root wrapper, `section#content-area` for main content, `nav[data-component=Toolbar]` for toolbar row, `#stage-area` for stage container, `aside#sidebar-panel` for sidebar wrapper.
2. **ChatSidebar.tsx**: Changed root from `<aside>` to `<section>` (now nested inside `<aside#sidebar-panel>`). Removed individual background from `#chat-feed` so the parent sidebar's background shows through.

**Key Changes:**
- `App.tsx`: Added semantic tags and IDs to 6 container elements.
- `components/ChatSidebar.tsx`: `aside` → `section`, removed `#chat-feed` background style.

## [2026-02-15 18:19] Real Device Enumeration & Click-Outside-to-Close Menus

**The Problem:**
1. The Media Hub showed hardcoded dummy devices ("Yeti Stereo Microphone", "Logitech Brio") instead of real system devices.
2. Neither the Media Hub nor Configuration Menu could be closed by clicking outside — only by pressing the toggle button again.

**Root Cause:**
- Device `<select>` elements had hardcoded `<option>` tags instead of using `navigator.mediaDevices.enumerateDevices()`.
- No click-outside event handler existed on either menu.

**The Solution:**
1. **Device enumeration:** Added `useEffect` that calls `enumerateDevices()` when the menu opens, filters by `audioinput`/`videoinput`, and sets state. Added `devicechange` event listener for hot-plug support. Requests `getUserMedia` first to get device labels.
2. **Click-outside close:** Both menus now attach a `mousedown` listener on `document` (deferred via `setTimeout(0)` to avoid closing on the same click). Uses `ref.contains(target)` to detect outside clicks.

**Key Changes:**
- `components/MediaControlHub.tsx`: Replaced dummy options with `enumerateDevices()`, added `devicechange` listener, added click-outside ref + handler.
- `components/ConfigurationMenu.tsx`: Added `panelRef`, click-outside handler (also excludes the trigger button from closing).


## [2026-02-20 13:20] Performance Pipeline Optimization and Canvas Coordinate Sync

**The Problem:**
- Audio playback had high overhead due to inefficient base64-to-Uint8Array conversion and repeated division in PCM conversion loops.
- Drawing on the right side of the Stage was misaligned because the `ResizeObserver` tracked the outer flex container instead of the 16:9 stage wrapper.
- High-frequency canvas updates sometimes lagged during intense streaming sessions.

**Root Cause:**
- Standard `atob` with string iteration is highly inefficient for large binary audio buffers.
- Canvas internal resolution was being set to the full window width, while the visual canvas was constrained by `aspect-video`, creating a coordinate mismatch.

**The Solution:**
1. **Low-Level Base64 Utility**: Implemented a lookup-table based `base64ToUint8Array` in `lib/utils/base64-utils.js`, skipping slow string manipulations.
2. **Loop Optimization**: Optimized `AudioPlayer.play()` to use a pre-calculated reciprocal constant (`1 / 32768`) for Float32 conversion, replacing division with faster multiplication.
3. **Stage Wrapper Sync**: Refactored `Stage.tsx` to ensure `ResizeObserver` monitors the specific `div.aspect-video` wrapper. This guarantees the canvas internal pixel grid always maps exactly 1:1 to the visual display.
4. **Validation**: Added `tests/base64-utils.test.js` to ensure the new binary utilities handle edge cases and padding correctly.

**Key Changes:**
- `lib/utils/base64-utils.js`: New high-performance binary utility.
- `lib/utils/media-utils.js`: Integrated `base64ToUint8Array` and multiplication-based PCM conversion.
- `tests/base64-utils.test.js`: Added comprehensive unit tests for binary utilities.

## [2026-02-20 14:15] Dynamic TTS Configuration Injection

**The Problem:**
- While the previous implementation allowed TTS Configuration for Non-Live (REST) Models, the UI settings were statically positioned under their own section.
- The user wanted these settings placed intimately connected to the "Persona" selection, and for it to generically apply to any future model (e.g. Ten Framework models) that requires an external TTS engine to emulate voice conversational flows.

**Root Cause:**
- The configuration structure in `model-registry.ts` hardcoded a 'TTS Configuration' section specifically for the `gemini-flash-rest` model.
- There was no programmatic way to insert fields based on the presence of another field (like `persona`) across arbitrary models.

**The Solution:**
1. **Model Registry Flag**: Introduced a `requiresTTS` boolean flag to the model definitions in `MODEL_REGISTRY` (set to `true` for REST models).
2. **Dynamic Injection Function**: Created `getEffectiveSettings(requiresTTS, settings)`, a helper function that intercepts the UI rendering pipeline. If a model `requiresTTS: true` and the section contains the `persona` field, it explicitly splices `ttsEngine`, `ttsVoice`, `ttsRate`, and `ttsPitch` directly beneath it.
3. **UI Pipeline Integration**: Modified `ConfigurationMenu.tsx` to wrap UI generation with `getEffectiveSettings`. Not only during render, but also during the `handleModelChange` cycle to ensure `ttsEngine` default values are extracted correctly when switching modes.

**Key Changes:**
- `utils/model-registry.ts`: Added `requiresTTS` flag and `getEffectiveSettings` helper. Removed static TTS block from `gemini-flash-rest`.
- `components/ConfigurationMenu.tsx`: Wired `getEffectiveSettings` into default generation and array rendering.
- `tests/tts_config.test.js`: Added NodeJS native test runner verifying the pure-function splicing logic.
- `contexts/LiveAPIContext.tsx`: ensure the 4 `tts*` fields are passed to `ModelClient.createAdapter` on initial connect and reconnect.

## [2026-02-20 15:00] Google Grounding Support in Gemini Flash REST

**The Problem:**
- The application provided a toggle for "Google Grounding", but it was only available in the UI group for the Gemini Live (WebSocket) model.
- The Gemini 2.5 Flash API (REST) inherently supports Google Search grounding, but this capability was not exposed to the user or implemented in the `GeminiFlashAdapter`.

**Root Cause:**
- `googleGrounding` was omitted from the `Features` section of the `gemini-flash-rest` model definition in the UI registry.
- `GeminiFlashAdapter.js` did not look for this configuration flag or inject the `googleSearch` tool array into the `generateContentStream` API calls.

**The Solution:**
1. **Model Registry Addition**: Added `googleGrounding` to the explicit `uiGroups` settings list for the `gemini-flash-rest` model. Unlike TTS which uses dynamic injection, this uses standard declarative configuration since it's an independent toggle.
2. **Context Passing**: Updated `ModelClient.createAdapter` invocations in `LiveAPIContext.tsx` to properly extract and forward `googleGrounding` from the `AppConfig` to the model adapter.
3. **Adapter Implementation**: Modified `GeminiFlashAdapter.js` to conditionally inject `tools: [{ googleSearch: {} }]` into the `generateContentStream` request payload if the user has grounding enabled.

**Key Changes:**
- `utils/model-registry.ts`: Added `googleGrounding` to `gemini-flash-rest`.
- `contexts/LiveAPIContext.tsx`: Passed `googleGrounding` down to the adapter.
- `lib/api/adapters/GeminiFlashAdapter.js`: Injected the SDK `googleSearch` tool config into the API requests.

## [2026-02-20 16:05] Decoupling Video Transmission from Client-Side VAD

**The Problem:**
- The user reported that enabling Client-Side VAD prevented the model from seeing video frames on the main screen, even when they started talking. 
- The intended behavior was to only transmit frames during active speech to save tokens, but if the camera was turned on *after* the microphone, it would permanently freeze.

**Root Cause:**
- The `LiveAPIContext.tsx` logic coupled video and screen-share frame transmission to the Voice Activity Detection state via a callback on the `AudioStreamer` (`onSpeechStatusChange`).
- This callback was *only* instantiated when `toggleAudio` was called and captured old closure references. 
- If a user enabled a Camera *after* the Microphone, or toggled them independently, the `videoStreamer` would initialize with `transmitFrames = false` and the audio callback would fail to find the new streamer reference to unfreeze it, resulting in the API never receiving a frame.

**The Solution:**
1. **Context-Level State Sync**: Introduced `isSpeakingRef` at the context level to serve as a single source of truth for the user's current VAD state.
2. **Robust Event Handlers**: Updated `toggleAudio` to write to `isSpeakingRef`, and then apply the updated state to any currently active `videoStreamerRef` or `screenCaptureRef`.
3. **Initialization Sync**: Updated `toggleVideo` and `toggleScreen` to read from `isSpeakingRef` during initialization hookup, ensuring that if they are turned on *while* the user is speaking, they immediately begin transmitting instead of waiting for a new speech boundary.

**Key Changes:**
- `contexts/LiveAPIContext.tsx`: Added `isSpeakingRef` and updated `toggleAudio`, `toggleVideo`, and `toggleScreen` for correct cross-stream synchronization.

## [2026-02-20 16:35] WebSocket Close 1007 — sendClientContent Conflicts with Server VAD

**The Problem:**
- After enabling the mic and speaking, the Gemini Live API WebSocket closed with code **1007** and reason `"Request contains an invalid argument."`.
- The error occurred immediately after an `inputTranscription` was received from the server.

**Root Cause:**
- The newly added `onSpeechEnd()` method in `GeminiLiveAdapter.js` sent `sendClientContent({ turnComplete: true })` when client-side VAD detected speech had ended.
- However, server-side automatic activity detection was **enabled** (`disabled: false`). The server already manages turn detection via its own VAD.
- Sending a manual `turnComplete` via `sendClientContent` while `sendRealtimeInput` audio is being streamed creates a **protocol conflict** — the API rejects it and closes the socket.
- Previously (before `onSpeechEnd()` existed), `media-utils.js` fell through to sending 20 silence audio chunks, which let server VAD naturally detect the turn end.

**The Solution:**
Removed the `onSpeechEnd()` method from `GeminiLiveAdapter.js`. This restores the silence-chunk fallback path in `media-utils.js`, which is compatible with server-side VAD.

**Key Changes:**
- `lib/api/adapters/GeminiLiveAdapter.js`: Removed `onSpeechEnd()` method (lines 263-273).

## [2026-02-20 16:45] High-Performance Base64 Utility & Pipeline Optimization (Jules)

**The Problem:**
- Audio processing and binary data transmission had measurable overhead due to suboptimal Base64 encoding/decoding.
- Previous implementation used manual string concatenation and `atob`/`btoa` without chunking, which could hit stack limits for large buffers (like video frames).

**Root Cause:**
- JavaScript's `btoa` and `atob` are legacy APIs not designed for high-throughput binary data.
- Manual bit-shifting loops for Base64 in JS are slower than native implementations (Node `Buffer` or browser `Uint8Array.toBase64`).

**The Solution:**
1. **Tiered Optimization**: Updated `uint8ArrayToBase64` to use a tiered approach:
   - `Uint8Array.toBase64()` (Future/Proposal support).
   - `Buffer.from().toString('base64')` (Fastest for Node.js).
   - Chunked `btoa(String.fromCharCode.apply())` for browser compatibility, avoiding stack overflows on large buffers.
2. **Memory Efficiency**: Switched from copying buffers to using `subarray()` views during chunking to minimize garbage collection pressure.

**Key Changes:**
- `lib/utils/base64-utils.js`: Replaced manual bit-shift loop with optimized tiered implementation.
- `tests/base64-utils.test.js`: Verified correctness with random 1MB buffers.

## [2026-02-20 16:50] Security Hardening: Removing Insecure Env Var Injection (Jules)

**The Problem:**
- The `vite.config.ts` was injecting `GEMINI_API_KEY` into the client-side bundle via `define: { 'process.env.API_KEY': ... }`.
- This exposed the API key to anyone viewing the source code of the deployed dashboard.

**Root Cause:**
- Early development used `process.env` shims in Vite for convenience.
- The transition to a more secure "Configuration Menu" approach rendered these hardcoded injections unnecessary and dangerous.

**The Solution:**
1. **Removed Injection**: Deleted the `define` block and `loadEnv` usage in `vite.config.ts`.
2. **Context-Driven Config**: Ensured the application relies exclusively on the user-provided API key from the `ConfigurationMenu` (stored in `localStorage` or session state), rather than bundled environment variables.

**Key Changes:**
- `vite.config.ts`: Removed `process.env.API_KEY` and `process.env.GEMINI_API_KEY` definitions.
- `README.md`: Updated instructions to emphasize manual key entry in the UI.


## [2026-02-21 02:15] Codified Recurring Patterns into Project Rules

**The Problem:**
- Several complex bugs (audio ordering, WebSocket 1007 errors, state sync loops) were appearing repeatedly in 'learn.md' but weren't being proactively prevented by the editor's context rules.

**Root Cause:**
- Critical architectural knowledge was documented as historical learnings but not as active development constraints.

**The Solution:**
- Scanned historical 'learn.md' entries for patterns and updated 'project_rules.md' with new sections on Audio Serialization, Protocol Conflict Avoidance, Model Response Guards, and Binary Performance.

**Key Changes:**
- '.agent/rules/project_rules.md': Added 9 new rules across State, Media, API, and Performance categories.

## [2026-02-21 19:45] Implemented Portrait Mode Layout

**The Problem:**
- The application was locked to a 16:9 landscape layout, making it suboptimal for portrait-first streaming platforms like TikTok.
- There was no way to toggle between portrait and landscape modes.

**Root Cause:**
- Outer containers and inner elements were hardcoded to `aspect-video` and specific horizontal/vertical alignments based on landscape requirements.

**The Solution:**
- Added a local `isPortrait` state to `App.tsx`, toggled by a new 'Smartphone' icon in the toolbar.
- The 'Camera' and 'Screen Share' quick toggles in the toolbar remain accessible in landscape mode, but are hidden when portrait mode is active to conserve horizontal space.
- Implemented dynamic layout logic:
  - When `isPortrait` is true, the main app container becomes `aspect-[9/16]` and uses a vertical column layout (`flex-col`).
  - The `Stage` strictly maintains a 16:9 inner ratio using `w-full` logic to prevent stretching out of bounds.
  - The `ChatSidebar` stretches horizontally (`w-full h-[40%]`) in portrait mode.
  - The `Toolbelt` hides its size/palette options when in portrait mode.

**Key Changes:**
- `App.tsx`: Added `isPortrait` state, dynamic layout classes, and modified toolbar layout to hide extra media buttons only when portrait mode is true.
- `components/Stage.tsx`: Accepted `isPortrait` prop and updated classes to `w-full` in portrait to preserve 16:9 without overflow.
- `components/Toolbelt.tsx`: Accepted `isPortrait` prop and conditionally hid wide UI elements.

## [2026-02-24 21:55] Fixed Live API History Injection Merging with Audio Input

**The Problem:**
1. When switching personas, the new persona received the injected conversation history but seemingly ignored it, failing to acknowledge past context or identity.

**Root Cause:**
1. History was injected as a single `user` turn via `session.sendClientContent({ turns: [...], turnComplete: false })`. 
2. Because the turn was left open (`turnComplete: false`), the model waited for the turn to complete. When the user subsequently spoke, the incoming realtime audio was appended to that same open `user` turn. 
3. The model processed the massive combined turn (History Text + Audio) and prioritized answering the immediate audio query, effectively burying the history as preamble text of the current question rather than recognizing it as past context.

**The Solution:**
1. Appended a dummy `model` turn (`{ role: "model", parts: [{ text: "Context acknowledged." }] }`) to the end of the history array sent to `sendClientContent`.
2. This dummy turn successfully "closes" the history context in the model memory, establishing it as the past interaction. 
3. When the user then speaks, the real-time audio creates a fresh, separate `user` turn, preventing context bleeding.

**Key Changes:**
- `lib/api/adapters/GeminiLiveAdapter.js`: Updated `setHistory` to append an acknowledged `model` turn.
- `tests/history_injection.test.js`: Updated tests to reflect the new injection structure.

## [2026-02-24 22:16] Refined History Injection with Active Greeting Prompt

**The Problem:**
1. The dummy `model` turn added previously correctly closed the history sequence, but the user still had to instigate the conversation.
2. We want the new persona to proactively greet the user and acknowledge the history immediately upon connection, creating a seamless handover experience.

**The Solution:**
1. Replaced the dummy `model` turn with a second `user` turn containing the text `"Greetings!"` and `turnComplete: true`.
2. This actively prompts the new persona to generate a response immediately (since the turn is complete). Because the first turn in the payload is the conversation history, the persona is fully aware of the context when generating the greeting.

**Key Changes:**
- `lib/api/adapters/GeminiLiveAdapter.js`: Updated `setHistory` to inject a secondary `"Greetings!"` user turn.
- `tests/history_injection.test.js`: Updated assertions to expect the new two-turn structure.

## [2026-02-25 23:25] Merged Feature: Live Session Management and History Injection

**The Problem:** 
1. Previous versions had issues with lost conversation context during model/persona switches.
2. WebSocket conflicts were common when attempting to resume or restart sessions with history.

**Root Cause:**
1. Timing issues in history injection (race conditions with `setup_complete`).
2. Inconsistent handling of `turnComplete` across different history injection strategies.

**The Solution:**
1. Merged `feat/live-session-management` branch into `main`.
2. Verified all 95 unit tests pass, ensuring no regressions in history injection, session resumption, or media pipeline stability.
3. Consolidated the "Greetings!" active prompt strategy for seamless persona transitions.

**Key Changes:**
- `lib/api/adapters/GeminiLiveAdapter.js` & `GeminiFlashAdapter.js`: Unified history protocols.
- `contexts/LiveAPIContext.tsx`: Hardened connection lifecycle and history sync.
- `tests/`: Integrated full suite of history and resumption tests.

