## 2024-05-14 - Optimize Base64 Audio Decoding in GeminiFlashAdapter
**Learning:** Manual loops for base64 to byte array conversions (and vice-versa) within performance-critical adapters (like handling audio chunks) are inefficient. They allocate unnecessary memory and block the main thread more than native approaches.
**Action:** Utilize shared, optimized utility functions like `base64ToUint8Array` and `uint8ArrayToBase64` which leverage faster underlying APIs (like `Uint8Array.fromBase64`, Node Buffers, or optimized `atob`/`btoa` implementations).
