## 2025-05-18 - CSP Constraint with Import Maps
**Vulnerability:** Weak CSP `script-src` directive.
**Learning:** The application uses native ES Modules via `importmap` in `index.html`. Browsers require `importmap` to be inline script content and do not support the `src` attribute. This necessitates `script-src 'unsafe-inline'` in the Content Security Policy, which weakens XSS protection by allowing all inline scripts.
**Prevention:** To enable stricter CSP, the build process must calculate and inject the SHA-256 hash of the `importmap` content into the CSP header, or the application must move away from native `importmap` in production builds.
