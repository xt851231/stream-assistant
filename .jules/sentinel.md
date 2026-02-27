## 2024-05-24 - History Logging Vulnerability
**Vulnerability:** Chat history containing sensitive user messages was being logged to the console during session initialization in `GeminiLiveAdapter`.
**Learning:** Debug logs often capture entire payload objects for convenience, but this can inadvertently expose PII or secrets when those payloads contain user data.
**Prevention:** Always sanitize or redact large data objects in logs, especially those containing user input or history. Use specific redaction markers like `<redacted length=N>` to maintain debuggability without leaking data.
