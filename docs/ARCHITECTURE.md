# System Architecture: Windows Screen Viewer

This document provides a technical specification of the architecture, stream lifecycles, background execution guarantees, and security invariants implemented in **Windows Screen Viewer**.

---

## 1. Problem Statement & Motivation

### The Operational Challenge
Modern Web-based Multimodal AI Agents (such as Google Gemini Live, Claude Artifacts/Web sessions, and browser-based coding assistants) are sandboxed within the browser environment. While they can easily share and inspect active browser tabs, they cannot natively monitor full Windows desktop applications (such as VS Code, IntelliJ, Terminal sessions, or CAD tools) continuously without encountering:
1. **Background Throttling**: Chrome deprioritizes hidden tabs and drops video rendering when another native OS application is focused.
2. **Infrastructure Overhead**: Cloud-based VDI or WebRTC relay servers incur latency, streaming bandwidth costs, and severe privacy/security risks.

### The Architectural Solution
Windows Screen Viewer converts the entire OS monitor stream into a direct, hardware-composed `<video>` feed inside an active Chrome tab:
- **Cost Reduction**: Zero server dependencies, zero SaaS subscriptions, 100% local processing.
- **Multimodal AI Enablement**: Grants browser-based AI vision tools continuous visibility into the entire operating system via simple tab sharing.
- **Zero-Throttling Guarantee**: Utilizes a silent Web Audio keep-alive oscillator that keeps the GPU compositor awake even when working outside Chrome.

---

## 2. System Overview

Windows Screen Viewer provides a low-latency, hardware-accelerated, zero-transcoding viewport for the Windows desktop inside Google Chrome. It operates both as a Manifest V3 Chrome Extension and as a standalone companion local web server.

```text
┌────────────────────────────────────────────────────────┐
│                   Chrome Browser                       │
│                                                        │
│  ┌────────────────────────┐   ┌─────────────────────┐  │
│  │ Background Worker      │   │ Viewer Page         │  │
│  │ (service-worker.js)    │   │ (viewer.html)       │  │
│  │ - Action click handler │   │ - ScreenViewer-     │  │
│  │ - Tab deduplication    │   │   Controller        │  │
│  │ - desktopCapture bridge│   │ - AudioContext      │  │
│  └───────────┬────────────┘   │   keep-alive        │  │
│              │                │ - HUD & Fullscreen  │  │
│              │ chrome.runtime │ └─────────┬─────────┘  │
│              │ message bridge │           │            │
│              └────────────────┼───────────┘            │
│                               ▼                        │
│                ┌───────────────────────────┐           │
│                │ Native Chrome MediaStream │           │
│                │ (<video> hardware compos.)│           │
│                └──────────────┬────────────┘           │
└───────────────────────────────┼────────────────────────┘
                                ▼
                 ┌───────────────────────────┐
                 │ Windows OS Desktop Stream │
                 │ (Direct GPU Capture)      │
                 └───────────────────────────┘
```

---

## 2. Core Architectural Components

### 2.1 Background Service Worker (`background/service-worker.js`)
- **Single-Instance Tab Manager**: When the user clicks the toolbar icon (`chrome.action.onClicked`), the worker searches for an existing viewer tab (extension URL or `http://localhost:5173/viewer/viewer.html`). If found, it focuses the tab and window; otherwise, it creates a new tab.
- **Desktop Capture Bridge**: Facilitates `chrome.desktopCapture.chooseDesktopMedia` calls when triggered from the viewer page, passing the native `streamId` back for continuous capture.

### 2.2 Viewer Controller (`viewer/viewer-controller.js`)
- **Stream Capture Orchestration**:
  1. Priority 1: Native extension `chrome.desktopCapture` API.
  2. Priority 2: Extension runtime message bridge for desktop capture.
  3. Priority 3: Standard Web `navigator.mediaDevices.getDisplayMedia`.
- **Hermetic Lifecycle Cleanup**: Listens to track lifecycle events (`track.onended`). When stream sharing is cancelled or ended, it automatically invokes `.stop()` on every `MediaStreamTrack`, releases DOM references, and resets state to `idle`.
- **Background Keep-Alive**: Initializes a silent `AudioContext` oscillator connected to a zero-gain node. This prevents the browser and OS compositor from sleeping or blacking out video frames when switching to other Windows applications.
- **Background Capture & Preventing Black Screen When Minimized**:
  - Direct window minimization via OS button (`_`) triggers Windows Desktop Window Manager (DWM) frame occlusion.
  - The controller relies on active background tab execution (layering or virtual desktop placement) rather than OS taskbar minimization to guarantee uninterrupted 60 FPS capture.
- **Fullscreen API**: Manages standard and vendor-prefixed Fullscreen API requests on the container element.

### 2.3 Viewer UI (`viewer/viewer.html`, `viewer/viewer.css`, `viewer/viewer.js`)
- **Responsive Letterboxing**: Implements `object-fit: contain` with hardware acceleration transforms (`translateZ(0)`), ensuring zero distortion across arbitrary multi-monitor aspect ratios (16:9, 16:10, 21:9, 4:3).
- **Auto-Hiding HUD**: Uses an inactivity timer (2.5 seconds) to dim and hide the overlay controls, restoring them immediately upon mouse movement or keypress.
- **Accessibility**: ARIA live regions (`aria-live="polite"`) broadcast stream status changes to assistive technologies.

### 2.4 Companion Local Server (`server.js`)
- **Zero-Dependency Static Server**: Built purely on Node.js built-in `http`, `fs`, and `path` modules.
- **Path Traversal Defense**: Sanitizes all request paths against directory traversal attacks.
- **Idle Auto-Shutdown**: Monitors client heartbeat pings (`/api/heartbeat`) and automatically exits the process if no clients are connected for >6 seconds.

---

## 3. Finite State Machine

```text
             ┌─────────────────────────┐
             │       IDLE STATE        │ ◄──────────────────────┐
             │ (Hero Card + Start CTA) │                        │
             └────────────┬────────────┘                        │
                          │ User clicks 'Share Screen'          │
                          ▼                                     │
             ┌─────────────────────────┐                        │
             │    REQUESTING STATE     │                        │
             │ (Browser Picker Active) │                        │
             └──────┬────────────┬─────┘                        │
User Cancels /      │            │ User selects screen          │ User clicks Stop /
Permission Denied   │            ▼                              │ Track onended /
                    │     ┌─────────────────────────┐           │ Stream Error
                    │     │      VIEWING STATE      │           │
                    │     │  (Live Screen Stream,   │───────────┘
                    │     │   Auto-hiding HUD,      │
                    │     │   Fullscreen mode)      │
                    │     └─────────────────────────┘
                    ▼
             ┌─────────────────────────┐
             │       ERROR STATE       │
             │ (Friendly Error Notice, │
             │  Guidance & Retry CTA)  │
             └────────────┬────────────┘
                          │ User clicks 'Try Again'
                          └──────────► [IDLE STATE]
```

### State Definitions:
- **`idle`**: No active capture stream. Video element cleared. Initial hero CTA displayed.
- **`requesting`**: Screen picker dialog presented to the user.
- **`viewing`**: Active `MediaStream` attached to video element. Auto-hiding HUD active, keep-alive oscillator running.
- **`error`**: Screen capture failed, cancelled, or rejected. Formatted error code and remediation message displayed.

---

## 4. Engineering Invariants & Security Boundaries

The system enforces five strict invariants:

| Invariant | Identifier | Enforcement Mechanism |
| :--- | :--- | :--- |
| **Zero Audio Capture** | `INV-01` | `audio: false` and `systemAudio: 'exclude'` explicitly passed in all stream constraint objects. Audited via `tests/invariants.test.js`. |
| **Zero Screen Recording** | `INV-02` | Prohibits `MediaRecorder`, canvas `getImageData`/`toDataURL`, or video file creation. Captured frames are rendered directly to `<video>` with zero buffer storage. |
| **Hermetic Lifecycle Cleanup** | `INV-03` | All `MediaStreamTrack` instances are cleanly terminated via `.stop()` upon track end or user stop. `video.srcObject` is cleared to prevent zombie hardware locks. |
| **Non-Destructive Aspect Ratio** | `INV-04` | CSS `object-fit: contain` maintains pixel aspect ratio on a pure black background canvas without stretching or clipping. |
| **Least Privilege & Local Execution** | `INV-05` | Zero external network calls (`fetch`, `XMLHttpRequest`, `WebSocket`), zero remote dependencies, and strict Manifest V3 isolation. |
