# Task: Mid-Session Persona Updates (Gemini Flash & Live)

## Objective
Enable "hot-swapping" the AI persona mid-conversation without disconnecting or losing session state.

## Findings: Technical Feasibility

### 1. Gemini Flash (REST API)
- **Status:** Fully Supported.
- **Mechanism:** The REST adapter sends the `systemInstruction` with every request. 
- **Implementation:** Updating the local configuration in the `GeminiFlashAdapter` will take effect immediately on the next user interaction (speech end or text send).
- **Caveat:** None.

### 2. Gemini Live (WebSocket API)
- **Status:** Supported via Protocol, Experimental in SDK.
- **Mechanism:** The Multimodal Live protocol allows sending a `setup` message (or `session_update`) over the existing WebSocket to reconfigure the session.
- **SDK (@google/genai 1.41.0) Support:** 
    - The `Session` class does not expose a high-level `update()` method.
    - **Solution:** Send the `setup` message manually via the underlying WebSocket. The protocol schema for `LiveClientMessage` includes a `setup` field which can be sent even after the initial connection.
- **Implementation:**
    ```javascript
    // Inside GeminiLiveAdapter
    updateSystemInstructions(instructions) {
        const ws = this.session.conn?._ws;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                setup: {
                    systemInstruction: instructions,
                    // Optionally update voice/tools here too
                }
            }));
        }
    }
    ```

---

## Implementation Plan

### Step 1: Define Persona Architecture
- Create `types.ts` entry for `PersonaType` (Immersion, Utility, Humor).
- Define `PERSONA_DEFINITIONS` constant containing the system prompts for each.

### Step 2: Persona Context
- Implement `PersonaContext.tsx` to wrap the application.
- State: `activePersonaId`.
- Effect: When `activePersonaId` changes, call `adapter.setSystemInstructions()`.

### Step 3: Adapter Refactoring
- **Base `ModelAdapter`:** Add `setSystemInstructions(text)` (already exists, but needs standard usage).
- **`GeminiFlashAdapter`:** Ensure `config.systemInstruction` is used in every `generateContentStream` call.
- **`GeminiLiveAdapter`:** Implement the "Hot Update" via WebSocket `setup` message.

### Step 4: UI Trigger
- Update `ConfigurationMenu.tsx` to include a Persona Selector.
- On change, update the `PersonaContext`.

---

## Verification Plan

### Automated Tests
- [ ] **Flash Test:** Mock the `GoogleGenAI` client and verify that changing instructions results in the next `generateContentStream` call using the new string.
- [ ] **Live Test:** Mock the WebSocket `send` method and verify that changing instructions triggers a `setup` message with the correct payload.

### Manual Verification
1. Connect via Live API.
2. Ask "Who are you?" (Expect default persona response).
3. Switch Persona to "Humor" via UI.
4. Ask "Who are you?" (Expect funny/joking response).
5. Verify no reconnection occurred (WebSocket logs).
