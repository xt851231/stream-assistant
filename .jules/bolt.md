## 2024-05-23 - Base64 Decoding Optimization
**Learning:** Manual JavaScript implementation of Base64 decoding (bitwise operations) is significantly slower than native APIs (`atob` in browser, `Buffer` in Node.js).
**Action:** When working with binary data (especially audio/video chunks), always prioritize native APIs (`Uint8Array.fromBase64`, `Buffer.from`, `atob`) and use feature detection to handle cross-platform compatibility. safely access `globalThis.Buffer` to avoid ReferenceErrors in strict mode browsers.
