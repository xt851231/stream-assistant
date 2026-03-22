## 2024-05-18 - Prevent System Instruction Leakage in Connection Logs
**Vulnerability:** The full `systemInstruction` string was being logged to the console during connection setup (`connectConfig`) in `GeminiLiveAdapter`.
**Learning:** Configurations objects like `connectConfig` often contain sensitive instructions or parameters that should not be visible in client-side logs or browser consoles, even if the API Key is redacted.
**Prevention:** When logging complex configuration objects that contain sensitive fields (like `systemInstruction`), create a shallow or deep copy of the object and explicitly redact the sensitive fields (e.g., replacing with `<redacted length=N>`) prior to logging.
