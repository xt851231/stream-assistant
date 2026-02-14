# Task: Investigation of Ghost Configurations & Proactive Commentary

## Objective
Document current architectural gaps where UI settings and configuration flags are not functionally connected to the AI adapters, specifically preventing "Proactive Commentary" behavior.

## Findings: Dead/Unwired Configurations

### 1. Proactive Behavior (`proactiveAudio`)
- **Status:** **DEAD**.
- **Issue:** The `proactiveAudio` boolean exists in `AppConfig` and `DEFAULT_CONFIG` but is never referenced in `LiveAPIContext.tsx` or any `ModelAdapter`.
- **Requirement:** To enable a "Commentator" persona, this must be wired to a "nudge" mechanism (e.g., a timer or visual event trigger) that sends a `turnComplete` signal or a specific "speak now" prompt to the AI when the user is silent.

### 2. Emotional Response (`affectiveDialog`)
- **Status:** **DEAD**.
- **Issue:** Intended to enable emotional inflection in voice output. It is ignored by both the `GeminiLiveAdapter` and the `TTSFactory`.
- **Requirement:** Must be passed into the `speechConfig` of the Live API or used to append "emotion" tags to system instructions.

### 3. Model Generation Parameters
- **Fields:** `temperature`, `topP`, `topK`, `thinkingBudget`.
- **Status:** **DEAD**.
- **Issue:** The UI provides sliders for these, but the `GeminiLiveAdapter.js` and `GeminiFlashAdapter.js` use hardcoded values or omit these fields entirely from the connection config.
- **Requirement:** Adapters must be updated to pass these values into the model configuration during `connect()` and `updateConfig()`.

### 4. Transcription Toggles (`inputTranscription`, `outputTranscription`)
- **Status:** **HARD-WIRED (ON)**.
- **Issue:** In `GeminiLiveAdapter.js`, these are explicitly enabled (`{}`). The user's toggle in the UI has no effect on the actual API session.

---

## The "Proactive Commentary" Problem (Technical Root Cause)

Even with `enableVAD` turned off (continuous video streaming), the AI remains silent because:
1. **Turn-Taking Protocol:** The Gemini Live API follows a polite turn-taking model. Without a "Speech Ended" signal from the mic or an explicit "Nudge" from the client, it assumes the user is still "performing" or the session is idle.
2. **Visual Blindness Logic:** Current logic in `LiveAPIContext.tsx` couples video transmission to voice activity:
   ```javascript
   audioStreamerRef.current.onSpeechStatusChange = (isSpeaking) => {
       if (config.enableVAD) {
           screenCaptureRef.current.transmitFrames = isSpeaking;
       }
   };
   ```
   If the user isn't talking, and `enableVAD` is on, the AI is literally blind.

---

## Recommended Fixes for Handover

1. **Decouple Video:** Allow `transmitFrames` to be independent of `isSpeaking` if `proactiveAudio` is enabled.
2. **The "Nudge" Logic:** Implement a `useEffect` in `LiveAPIContext` that monitors `proactiveAudio`. If `true` and the user has been silent for $X$ seconds, send a lightweight "contextual nudge" or a `turnComplete` signal to force a reaction to the current video frames.
3. **Wire Generation Params:** Update `GeminiLiveAdapter.connect()` to actually use the `temperature` and `thinkingConfig` from the passed config object.
4. **Prompt Injection:** When `proactiveAudio` is active, the system instruction must be appended with: *"You are an active observer. Do not wait for user input to speak; provide live commentary on the visual stream during silences."*
