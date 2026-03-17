## 2026-03-17 - [Add Content Security Policy (CSP)]
**Vulnerability:** Missing security headers (CSP) allowing any external scripts or resources to load.
**Learning:** The application was missing defense-in-depth against Cross-Site Scripting (XSS) and external data injection attacks because there was no Content Security Policy defined in `index.html`.
**Prevention:** Always implement a strict Content Security Policy restricting `default-src`, `script-src`, `style-src`, and `connect-src` to trusted origins like `self`, Google Fonts, and the Gemini API endpoints.
