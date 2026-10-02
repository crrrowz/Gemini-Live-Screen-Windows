# Changelog

All notable changes to **Windows Screen Viewer** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-02

### Added
- **Manifest V3 Chrome Extension**: Background service worker (`background/service-worker.js`) with single-tab deduplication and toolbar action handler.
- **Hardware-Accelerated Screen Viewer**: Stream controller (`viewer/viewer-controller.js`) and UI (`viewer/viewer.html`, `viewer/viewer.css`, `viewer/viewer.js`).
- **Silent Web Audio Keep-Alive**: Background oscillator loop preventing tab throttling during OS-level window switching.
- **Aspect-Ratio Preserved Display**: Hardware-accelerated letterboxing via `object-fit: contain` for multi-aspect displays (16:9, 16:10, 21:9, 4:3).
- **Auto-Hiding HUD**: 2.5s mouse inactivity detection with fade transitions and keyboard shortcut triggers (`F`, `S`, `Space`, `Esc`).
- **Zero-Dependency Local Server**: Companion Node.js server (`server.js`) with path-traversal protection and idle auto-shutdown.
- **Automated Verification Suite**: 5 test suites (`tests/`) covering 21 invariant, lifecycle, DOM, and manifest compliance assertions using `node:test`.

### Security
- Enforced strict `audio: false` and `systemAudio: 'exclude'` constraint (INV-01).
- Prohibited `MediaRecorder`, offscreen canvas extraction, and network telemetry (INV-02).
- Enforced hermetic stream teardown on track termination (INV-03).
