# Stream Quest Dashboard

## Project Summary
Stream Quest Dashboard is a highly interactive, premium AI-powered dashboard designed for live streaming environments. It provides a multimodal experience where the AI can "see" the stream, "hear" the user, and interact via voice and text.

The dashboard supports multiple AI models including **Google Gemini** (Live and Flash) and **Alibaba Qwen Omni**, allowing for low-latency, real-time voice conversations with localized support.

### Key Features
- **Multimodal AI Integration**: 
    - **Gemini Live (WebSocket)**: Low-latency voice-to-voice with native audio support.
    - **Gemini Flash (REST)**: Fast multimodal reasoning with image and text support.
    - **Qwen Omni (WebSocket)**: Efficient, conversational real-time AI from Alibaba.
- **Interactive Stage**: A 16:9 stage area with canvas drawing tools (pen, eraser, color palette) that the AI can perceive via periodic snapshots.
- **Dynamic Media Routing**: Automatically handles video source switching between Camera and Screen Share, ensuring the AI focuses on the active media.
- **Persona System**: Switch between different AI personalities (Felix, Luna, Kai, Pixel) with customized system instructions and model-specific voice defaults.
- **Premium Audio Engine**: High-performance AudioWorklet-based ring buffer for smooth, low-latency audio playback.
- **Multilingual Support**: Supports English, Simplified Chinese, Traditional Chinese, and Japanese.
- **Rich UI**: Modern, themeable interface with glassmorphism, micro-animations, and a highly configurable settings menu.

---

## Technical Architecture

### Core Technologies
- **Frontend**: React 19, TypeScript, Lucide Icons.
- **Styling**: Vanilla CSS with Tailwind CSS (for layout utilities) and PostCSS.
- **Build Tool**: Vite 6 (running on port 3000).
- **Internationalization**: i18next with browser language detection.
- **API Communication**: WebSockets for real-time models, REST for stateless models.

---

## File Structure
```text
stream-quest-dashboard/
├── components/          # React UI components (Stage, Chat, Config, Toolbelt, etc.)
├── contexts/            # React Context Providers (LiveAPIContext handles core AI/Media logic)
├── lib/                 # Core engine logic
│   ├── api/             # Model clients and adapters (GeminiLive, GeminiFlash, QwenOmni)
│   └── utils/           # Media handling (VideoStreamer, ScreenCapture, AudioPlayer)
├── public/              # Static assets, fonts, and AudioWorklet processors
├── src/                 # Localization (i18n.ts)
├── utils/               # Model Registry and centralized configuration logic
├── constants.ts         # Personas, voices, and default application settings
├── types.ts             # Global TypeScript interface definitions
├── App.tsx              # Main application entry point and layout
└── learn.md             # Engineering journal and architectural decisions
```

---

## Customizing AI Behavior

### Where to Change Prompts

The system combines two types of instructions to form the final AI prompt:

1.  **Model-Specific Base Instructions**:
    - **Purpose**: Controls the *technical behavior* of the model (e.g., "Keep responses brief", "Don't use markdown").
    - **Location**: `utils/model-registry.ts` inside the `MODEL_REGISTRY` object (look for the `modelInstruction` field for each model).
    
2.  **Persona-Based Character Instructions**:
    - **Purpose**: Defines the *personality and tone* of the AI (e.g., "You are a wise sage", "You use cyberpunk slang").
    - **Location**: `constants.ts` inside the `PERSONAS` array.
    - **Note**: These can also be overridden in real-time via the **System Instructions** text area in the UI's **Settings > Behavior** section.

### Voice Configuration
Voices are mapped per persona and per model in `constants.ts`. If you add a new model or voice, ensure the mapping in `PERSONAS` is updated to maintain consistent character voices across different providers.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- API Keys:
    - [Google AI Studio](https://aistudio.google.com/) for Gemini models.
    - Alibaba Cloud for Qwen models.

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
2. The application will be available at `http://localhost:3000`.
3. Open **Settings** (gear icon) to configure your API keys and select your preferred model.

---

## Testing
The project uses the native `node:test` runner with `tsx` for TypeScript support.

```bash
# Run all tests
npm test

# Run a specific test
npx tsx --test tests/gemini_live_adapter.test.js
```

---

## Developer Documentation
- **Architecture & Decisions**: Check `learn.md` for detailed notes on the implementation of the audio engine, media routing, and adapter patterns.
- **Adding a Model**: Register the new model in `utils/model-registry.ts` and implement a corresponding adapter in `lib/api/adapters/`.
