## 2024-05-24 - Fix sensitive data leak in console logs
**Vulnerability:** The GeminiLiveAdapter was logging the `connectConfig` object which contained the `systemInstruction` field in plaintext. The `systemInstruction` is considered sensitive data and should not be exposed in client-side console logs.
**Learning:** Configurations logging is helpful for debugging, but directly logging raw configuration objects can easily leak sensitive fields like prompts, API keys, or personal data.
**Prevention:** Always shallow or deep clone configuration objects prior to redaction before logging them, so that the redaction does not mutate the actively used configuration.
