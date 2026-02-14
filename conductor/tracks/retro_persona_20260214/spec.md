# Specification: Retro Game Persona System

## Overview
This track introduces a specialized "Persona" system for the AI co-host, tailored for retro gaming. It enables the AI to switch between different modes (Immersion, Utility, Humor) and react to on-screen game dialogue using visual perception.

## Objectives
- Define a robust persona management system.
- Implement persona-specific prompting and voice behavior.
- Integrate visual triggers to detect in-game text for narration/acting.
- Allow real-time switching between personas via the UI.

## Functional Requirements
- **Persona Management:** 
    - Support for "Immersion", "Utility", and "Humor" modes.
    - Each persona has a unique system prompt and voice setting.
- **Visual Perception:**
    - Capture frames from the stream or a designated window.
    - Identify regions of interest (ROI) likely to contain dialogue.
    - Use visual cues or lightweight OCR to trigger AI responses.
- **Voice Acting Integration:**
    - AI acts out the dialogue identified by visual perception when in Immersion or Humor mode.
    - Utility mode provides straight translation/narration.

## Technical Requirements
- **Persona State:** Managed in the application context (React Context).
- **Visual Detection:** Basic integration with browser media capture APIs.
- **AI Orchestration:** Enhanced logic in `ModelClient.js` and adapters to incorporate persona context.

## User Interface
- New "Persona Selector" component in the `ConfigurationMenu`.
- Visual feedback indicating which persona is active.
