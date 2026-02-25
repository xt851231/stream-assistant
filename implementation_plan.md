# Audio Routing to Virtual Cable

The user reported an echo issue when capturing screen share audio while simultaneously playing game audio and AI voice through the default speakers. The proposed solution is to route the dashboard's audio output (AI voice and captured screen audio) to a Virtual Audio Cable. This way, the streaming software (like OBS) can capture the Virtual Cable as a separate audio source, preventing desktop audio feedback loops.

## Analysis
Currently, `SpeechAudioContext.js` creates an `AudioContext` and connects both `gainNode` (AI voice) and `systemGainNode` (Screen capture audio) directly to `this.audioContext.destination`, which is the system's default audio output device.

To route audio to a specific device (like a Virtual Cable), we can use the `AudioContext.setSinkId()` method introduced in modern browsers.

## Proposed Changes

### 1. Update Types and Constants
- Add `audioOutputDevice` field to `MediaConfig` in `types.ts`.
- Add a default value in `constants.ts`.

### 2. Audio Device Selection UI
- Update `components/MediaControlHub.tsx` to enumerate available audio output devices using `navigator.mediaDevices.enumerateDevices()`.
- Filter devices by `kind === 'audiooutput'`.
- Provide a dropdown to select the output device (e.g., "Default", "CABLE Input (VB-Audio)").
- Save the selected `deviceId` to the application configuration.

### 3. Update Audio Routing in `SpeechAudioContext`
- Modify `SpeechAudioContext.js` to accept an `audioOutputDevice` ID.
- Add a method `setSinkId(deviceId)` that calls `this.audioContext.setSinkId(deviceId)`.
- Ensure this is called when the context initializes or when the user changes the setting.
- Note: `setSinkId` might require user interaction or permissions in some browsers, but since they are already interacting with the dashboard, it should be fine.

### 4. Wire Configuration Changes
- In `App.tsx`, listen for changes to the `audioOutputDevice` configuration and call `SpeechAudioContext.setSinkId()` accordingly.

## Alternative Solution (WebRTC loopback)
If `setSinkId` is not supported or practical, an alternative is to not play the screen audio locally at all if we are just capturing it for the AI. However, currently, the system routes the screen audio to `systemGainNode` specifically for local playback (as noted in `MEDIA_PIPELINE.md`), because the user might want to hear it while streaming. 
The Virtual Cable approach via `setSinkId` is the most robust solution for streamers to separate audio tracks in OBS.

## Verification Plan
### Automated Tests
- Create a test `tests/audio_routing.test.js` to mock `AudioContext.setSinkId` and verify it is called when the configuration changes.
- Ensure all 95 existing tests continue to pass.

### Manual Testing
- User should be required to test the drop down list in the `MediaControlHub` to see if their Virtual Cable shows up, and choose it to verify if the sound successfully routes to it.
