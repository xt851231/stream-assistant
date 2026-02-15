# Task: Isolated Screen Audio & Playback Path [DONE]

## Objective
Capture game/system audio during screen sharing and route it to local playback (speakers/OBS) while keeping it isolated from the AI's input stream (Gemini Live API).

## Technical Requirements
- **Separation**: System audio from `getDisplayMedia` must NOT be sent to the `AudioWorklet` used for AI input.
- **Control**: User must be able to adjust Game Volume independently of AI Voice Volume.
- **Cleanup**: All audio nodes and tracks must be properly disposed of when screen sharing stops.

## Features & Test Cases

### 1. `SpeechAudioContext` Enhancement [DONE]
- **Input**: Call `SpeechAudioContext.getSystemGainNode()`.
- **Output**: Returns a `GainNode` connected to `audioContext.destination`.
- **Verification**: Multiple calls return the same singleton node; node exists and is initialized.

### 2. `ScreenCapture` Audio Integration [DONE]
- **Input**: `ScreenCapture.start({ audio: true })`.
- **Output**: `mediaStream` containing both a `video` track and an `audio` track.
- **Internal Verification**: The audio track is connected to `SpeechAudioContext.getSystemGainNode()`.
- **Verification**: `ScreenCapture.stop()` stops all tracks (video AND audio).

### 3. `LiveAPIContext` Management [DONE]
- **Input**: `toggleScreen(true, config, screenAudio)`.
- **Output**: UI shows `screenSharing: true`.
- **Verification**: If `ScreenCapture` fails to get audio (e.g. user doesn't check the box), it should fallback gracefully to video-only without crashing.

## Implementation Steps
1. [x] Create unit tests for `SpeechAudioContext` and `media-utils` logic (using mocks).
2. [x] Modify `SpeechAudioContext.js` to add `systemGainNode` and `setSystemVolume`.
3. [x] Update `ScreenCapture` in `media-utils.js` to request audio and handle routing.
4. [x] Update `LiveAPIContext.tsx` to handle the new audio track lifecycle.
5. [x] Add "Game Audio" volume slider and "Capture Screen Audio" toggle to `MediaControlHub.tsx`.
