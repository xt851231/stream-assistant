## 2024-05-14 - Fix PII leakage in Live API setup logging
**Vulnerability:** The GeminiLiveAdapter was logging the entire `connectConfig` object, including the user's `systemInstruction`, potentially leaking PII or sensitive custom instructions to the console.
**Learning:** Configuration objects passed to third-party SDKs often contain a mix of safe metadata and sensitive user data (like instructions or keys). Deep logging of setup objects without redaction is a common source of data leakage.
**Prevention:** Always sanitize or selectively log configuration objects before passing them to `console.log` or logging services. Avoid raw `JSON.stringify` on objects containing user inputs.
