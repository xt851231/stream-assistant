## 2025-05-23 - [Missing Security Headers in SPA]
**Vulnerability:** The application was missing critical security headers, specifically Content-Security-Policy (CSP), leaving it vulnerable to XSS and data exfiltration.
**Learning:** Even with modern frameworks like React/Vite, default templates often lack strict CSP. The absence of a server-side config means meta tags are the primary defense for SPAs.
**Prevention:** Always include a strict CSP meta tag in `index.html` for SPAs, explicitly whitelisting API endpoints (like Gemini) and preventing inline scripts where possible.
