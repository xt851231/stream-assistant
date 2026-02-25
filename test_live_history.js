import { GoogleGenAI } from "@google/genai";

async function run() {
    console.log("Testing types...");
    // Let's just inspect the types exported by the module, or test the API response.
    // We don't have the API key, but we can verify if the SDK throws validation errors
    // when we pass role: "model" to sendClientContent.

    // Mock WebSocket to intercept what the SDK sends
    class MockWebSocket {
        constructor() { this.readyState = 1; }
        send(data) { console.log("Sent:", data); }
        close() { }
        addEventListener() { }
        removeEventListener() { }
    }

    // Overriding global WebSocket to capture the frames
    global.WebSocket = MockWebSocket;

    const ai = new GoogleGenAI({ apiKey: "dummy-key" });
    try {
        const session = await ai.live.connect({ model: "gemini-2.5-flash-native-audio-preview-12-2025" });
        session.sendClientContent({
            turns: [
                { role: "user", parts: [{ text: "Hello" }] },
                { role: "model", parts: [{ text: "Hi, I am model" }] }
            ],
            turnComplete: false
        });
        console.log("sendClientContent succeeded (no client-side validation error).");
    } catch (e) {
        console.error("SDK Error:", e.message);
    }
}
run();
