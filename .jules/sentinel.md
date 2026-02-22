## 2025-02-14 - Sensitive Transcription Leakage in Console Logs
**Vulnerability:** Full user input and model output transcriptions were being logged to the console in `GeminiLiveAdapter` and `GeminiFlashAdapter`.
**Learning:** Developers often add `console.log` for debugging during development and forget to remove or sanitize them before production. The complex object structure of `serverContent` made it easy to overlook that `inputTranscription` contained the full text.
**Prevention:** Implement strict linting rules against `console.log` in production code or use a dedicated logger that automatically sanitizes sensitive fields (PII, secrets, transcripts).
