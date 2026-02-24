# History Injection Architecture

This document describes how conversation history is preserved and injected when switching between models (REST vs. Live) or when session restarts occur (e.g., during persona changes).

## Overview

The dashboard maintains a centralized message history in `LiveAPIContext.tsx`. When a model connection is established, this history is "injected" into the model's context to ensure continuity. The injection method varies by model protocol.

## Protocol-Specific Implementations

### 1. Gemini Live (WebSocket)
The Live API is a stateful, real-time protocol. History must be injected as discrete "turns" into the session's active context.

- **Mechanism:** `session.sendClientContent({ turns, turnComplete: false })`
- **Timing:** Triggered **only** after the `setup_complete` message is received from the server. This prevents race conditions during the initial handshake.
- **Resumption Guard:** If the session is resumed using a `sessionHandle`, manual history injection is **skipped**. The Gemini server naturally restores the full context when a handle is provided.
- **Message Formatting:**
    - Roles are mapped to `user` and `model`.
    - Content is prefixed with the sender's name: `[Luna]: Hello there!`
    - `turnComplete: false` ensures the model processes the history without generating an immediate response.

### 2. Gemini Flash (REST)
The Flash API is stateless. The entire conversation history must be included in every individual request.

- **Mechanism:** The `GeminiFlashAdapter` maintains an internal `this.history` array.
- **Update:** `setHistory(messages)` updates this internal array.
- **Request Cycle:** On every `generateContentStream` call, `this.history` is spread into the `contents` array.
- **Message Formatting:** Similar to Live, roles are mapped and sender names are prefixed to the text.

## Implementation Details

### ModelAdapter Base Class
All adapters inherit the `setHistory(messages)` method, providing a unified interface for the application context.

### LiveAPIContext Integration
The context manages the global `messages` state. It listens for the `setup_complete` event from the model adapter and then:
1. Slices the last 100 relevant messages.
2. Calls `adapter.setHistory(last100)`.

This ensures that whether the user is on REST or Live, the model always "remembers" the recent conversation.

## Persona Awareness
Because history turns are prefixed with `[SenderName]:`, the model can distinguish between different personas in the history. When a persona switch occurs (e.g., from Felix to Luna), the new persona sees the previous assistant messages as coming from the old persona, while its own system instructions define its current identity.
