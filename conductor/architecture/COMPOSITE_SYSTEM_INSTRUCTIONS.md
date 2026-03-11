# Composite System Instructions Architecture

This document describes the architectural approach for combining user-configurable persona instructions with model-specific behavioral constraints to achieve more natural, conversational AI responses.

## Overview

To simplify the user interface while maintaining high-quality responses across different model architectures (WebSocket vs. REST), system instructions are treated as a **composition**. 

The final instruction sent to an AI model is constructed dynamically by the application:
`Final Instruction = Persona (from UI/Storage) + Model-Specific Rule (Hardcoded in Registry)`

## Objective

1. **Centralized Behavior Control:** Allow the developer to tune model behavior (e.g., response length, formatting) without requiring the user to manually edit their persona instructions.
2. **Conversational Optimization:** Fix common issues like AI responses being too long or ending with unnatural "engagement questions" by enforcing strict model-level rules.
3. **Consistency:** Ensure that switching from a persona like "Felix" to "Luna" preserves the model's behavioral constraints (like "be brief for voice").

## Model-Specific Instructions (Registry-Level)

The `MODEL_REGISTRY` in `utils/model-registry.ts` will house the "hidden" model-level instructions:

### 1. Gemini Live (WebSocket)
Optimized for low-latency, real-time voice sessions.
- **Instruction:** "You are engaged in a live voice conversation. Keep responses brief and natural."

### 2. Gemini Flash (REST)
Used in text or audio-to-audio REST modes where responses can often become too descriptive or robotic.
- **Instruction:** "You are engaged in a spoken conversation. Keep your responses extremely concise, Speak naturally and casually, without using markdown, lists, or long explanations. Do not force the conversation forward by ending every response with a question; let the conversation breathe sometimes"

### 3. Qwen Omni (WebSocket)
Enforces oral conversation patterns for the Qwen engine.
- **Instruction:** "You are a participant in a live voice dialogue. Your responses must be brief, conversational, and read well when spoken aloud. Limit yourself to a single short paragraph. Do not use formatting like bullet points. Do not end every turn with a question—only but try keep conversation flow."

## Implementation Pattern

### 1. Registry Update
Add a `modelInstruction` field to each entry in the `MODEL_REGISTRY` constant.

### 2. Adapter Integration
Each API adapter (`GeminiLiveAdapter`, `GeminiFlashAdapter`, `QwenOmniAdapter`) will be responsible for the composition logic during the connection or request phase:

```javascript
// Example Composition Logic
const personaInstruction = this.config.systemInstructions || "You are a helpful assistant.";
const modelDef = MODEL_REGISTRY[this.config.provider];
const modelInstruction = modelDef?.modelInstruction || "";

const finalInstruction = [personaInstruction, modelInstruction]
    .filter(Boolean)
    .join('\n\n');
```

## Benefits
- **Zero UI Bloat:** No new settings are exposed to the user.
- **Instant Global Tuning:** Updating a model instruction in the registry affects all users immediately without migrating local storage.
- **Persona Preservation:** Users can focus on "Who" the AI is, while the system handles "How" the AI communicates.
