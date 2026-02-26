## 2024-05-22 - Chat History Leakage in Logs
**Vulnerability:** The GeminiLiveAdapter was logging the full chat history, including potential sensitive user data, to the console during session initialization.
**Learning:** The need to debug the history injection logic led to logging the full payload without consideration for PII.
**Prevention:** Always use redaction helpers or log only metadata (like length) for large text payloads, especially those containing user input.
