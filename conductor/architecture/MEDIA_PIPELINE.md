# Media Pipeline Architecture & Flow

This document serves as the ground truth for how media frames and audio data flow through the dashboard to the LLM. 

## High-Level Flow

1. **Hardware Ingestion**: `VideoStreamer` (camera) and `ScreenCapture` (screen) use `navigator.mediaDevices` to get streams.
2. **Gating Logic**: Both extend `BaseVideoCapture`, which runs a `requestAnimationFrame` loop.
3. **Transmission Gate**:
   - `alwaysTransmit`: Continuous transmission (used in REST mode).
   - `transmitFrames`: Gated transmission (used in Live API mode with VAD).
4. **Adapter Delivery**: The capture classes call `this.client.sendImage()` or `this.client.setLatestImage()`.

## Voice Activity Detection (VAD) Sync

To save tokens and bandwidth in Live API mode, video frames are only sent when the user is speaking.

- **`isSpeakingRef`**: Located in `LiveAPIContext.tsx`. This is the single source of truth for conversational state.
- **Microphone Triggers**: When `AudioStreamer` detects speech, it updates `isSpeakingRef`.
- **Stream Wakeup**: The `AudioStreamer.onSpeechStatusChange` callback must apply this state to its `videoStreamerRef` and `screenCaptureRef`.

## Defensive Rules

### 1. Ref-First for Callbacks
React closures capture state at the time the callback is created. Because media streamers persist for long periods, **always use React Refs** for any logic inside `onSpeechStatusChange` or WebSocket handlers.

### 2. Parameter Discipline
All media toggle functions (`toggleAudio`, `toggleVideo`, `toggleScreen`) MUST accept the full `config: AppConfig`. Do not rely on context state within the async body as it may have changed.

### 3. Mutual Exclusivity
The Gemini API expects a single multimodal focus.
- When Screen Share is active, `videoStreamer.transmitFrames` MUST be `false`.
- The `media-utils.js` gating logic ensures that background streams do not call `setLatestImage`, preventing "Ghost Frames" from overwriting the intended focus.

## Debugging "LLM Can't See Me"
1. **Check the Console**: Look for `TypeError` in `toggleVideo`. If initialization fails, `transmitFrames` stays `false`.
2. **Check the Ref**: Verify `screenSharingRef.current` matches the actual UI state.
3. **Inspect the Client**: Verify `streamer.client` matches the current active `clientRef`.
