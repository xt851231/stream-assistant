# Stream Quest Dashboard

## Project Summary
Stream Quest Dashboard is a highly interactive, premium AI-powered dashboard designed for live streaming environments. It leverages the power of Gemini (both Live API and Flash models) to provide a multimodal experience where the AI can "see" the stream, "hear" the user, and interact via voice and text.

### Key Features
- **Multimodal AI Integration**: Support for Gemini Live (WebSocket) and Gemini Flash (REST) with real-time video/audio streaming.
- **Interactive Stage**: A 16:9 stage area with drawing tools (pen, eraser, color palette) that the AI can perceive.
- **Dynamic Media Routing**: Mutual exclusivity logic for video sources (Camera vs. Screen Share) ensuring the AI always looks at the active focus.
- **Premium Audio Engine**: Custom AudioWorklet-based ring buffer for smooth, low-latency audio playback even with rapid AI speech generation.
- **Rich UI**: Sleek, themeable interface with glassmorphism, micro-animations, and a responsive layout.

---

## File Structure
```text
stream-quest-dashboard/
├── components/          # React UI components (Stage, Chat, Config, etc.)
├── contexts/            # React Context Providers for global state
├── lib/                 # Core logic and shared utilities
│   ├── api/             # API clients and Adapters for Gemini
│   └── utils/           # Helper functions (media, audio, styles)
├── public/              # Static assets and production builds
│   └── audio-processors/# AudioWorklet scripts for PCM processing
├── tests/               # Unit and integration tests (using node:test)
├── App.tsx              # Main application entry point and layout
└── learn.md             # Developer journal and engineering decisions
```

---

## Brief File Descriptions

### Components
- **App.tsx**: The root component. Manages high-level layout and coordination between components.
- **Stage.tsx**: Handles the primary video/media display and the canvas drawing layer.
- **Toolbelt.tsx**: Provides UI for pen/eraser selection, brush size, and color picking.
- **ConfigurationMenu.tsx**: Comprehensive settings UI for API keys, model selection, thematic controls, and audio parameters.
- **MediaControlHub.tsx**: Floating control center for toggling camera, mic, and screen share.
- **ChatSidebar.tsx**: Displays the conversation history and handles text input.

### Contexts
- **LiveAPIContext.tsx**: The primary logic engine. Manages media streams, initializes model adapters, and handles the bridge between Browser APIs and Gemini.

### Lib / Utilities
- **media-utils.js**: Contains the core media classes: `VideoStreamer`, `ScreenCapture`, and `AudioPlayer`.
- **GeminiLiveAdapter.js**: Implementation for the WebSocket-based Gemini Live API.
- **GeminiFlashAdapter.js**: Implementation for the REST-based Gemini Flash API.
- **SpeechAudioContext.js**: A singleton for managing a unified `AudioContext` across the application.
- **playback.worklet.js**: AudioWorkletProcessor implementing a high-performance ring buffer for PCM audio.

---

## How to Start Project

### Prerequisites
- Node.js (v18+)
- A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open your browser to the URL shown in terminal (usually `http://localhost:3000`).
3. Click the **Settings** (gear) icon, enter your API Key, select a model, and click **Connect**.

---

## How to Test

The project uses the native `node:test` runner. To run tests with TypeScript support:

```bash
# Run all tests
npx tsx --test tests/*.test.js

# Run a specific test
npx tsx --test tests/gemini_live_adapter.test.js
```

---

## Developer Journal
Consult `learn.md` for a chronological log of engineering challenges, root cause analyses, and architectural decisions made during development.
