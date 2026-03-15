## 2025-01-20 - Redaction of Sensitive Configurations and Payloads
**Vulnerability:** GeminiLiveAdapter exposed sensitive configuration (systemInstruction), user history payloads, and transcription events in console logs.
**Learning:** Hardcoded string redactions like '<redacted>' don't provide context to debugging, but logging full strings exposes PII/sensitive data. The adapter also dynamically logs connection configs on setup which inherently includes system prompts.
**Prevention:** Always sanitize deeply nested objects before using `JSON.stringify` on connection configs, and standardise logging on a `<redacted length=N>` format to safely provide metadata without leaking raw values.
