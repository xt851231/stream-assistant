# Implementation Plan: Retro Game Persona System

## Phase 1: Foundation & Persona System
- [ ] Task: Define Persona Types and React State Management
    - [ ] Write tests for persona state transitions in a new context provider
    - [ ] Implement `PersonaContext` and provider to manage active persona
- [ ] Task: Implement Persona-Based Prompting Logic
    - [ ] Write tests for prompt generation based on persona settings
    - [ ] Implement utility to generate system instructions for each persona (Immersion, Utility, Humor)
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Foundation & Persona System' (Protocol in workflow.md)

## Phase 2: Visual Perception & Dialogue Detection
- [ ] Task: Implement Basic Screen Capture Utility
    - [ ] Write tests for media stream capture and frame extraction
    - [ ] Implement utility to capture frames from a video element or screen stream
- [ ] Task: Integrate Dialogue Detection Trigger
    - [ ] Write tests for detecting "change" in dialogue regions (e.g., pixel delta or simple OCR)
    - [ ] Implement logic to trigger an AI event when new text is detected on-screen
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Visual Perception & Dialogue Detection' (Protocol in workflow.md)

## Phase 3: Integration & Voice Acting
- [ ] Task: Update Live API Context with Persona Data
    - [ ] Write tests for Live API payload generation including persona context
    - [ ] Integrate persona instructions into the `useLiveAPI` hook and `GeminiLiveAdapter`
- [ ] Task: Implement Voice Acting Behavior
    - [ ] Write tests for character-based voice selection (if supported by TTS factory)
    - [ ] Implement logic to automatically trigger "acting" when dialogue is detected visually
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Integration & Voice Acting' (Protocol in workflow.md)
