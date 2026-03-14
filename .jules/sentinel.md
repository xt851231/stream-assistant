## 2024-05-24 - Exposing Prompt and History in WebSocket Payloads

**Vulnerability:** The `GeminiLiveAdapter` was echoing the full `systemInstruction` and user conversation history to `console.log` during WebSocket connections and context injection (`setHistory`).
**Learning:** Configurations sent to external APIs (like `connectConfig`) often wrap sensitive, proprietary system prompts alongside benign configurations (like model version). Blindly stringifying these objects for debugging inadvertently leaks IP and PII to the browser console.
**Prevention:** Destructure or clone configuration objects before logging, specifically overriding or omitting sensitive fields (e.g. `safeConfig.systemInstruction = '<redacted>'`) to maintain debuggability without compromising security.
