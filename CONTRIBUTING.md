# Contributing to Windows Screen Viewer

Thank you for your interest in contributing to **Windows Screen Viewer**!

This project is built on strict engineering invariants prioritizing privacy, performance, zero data retention, and zero external dependencies.

---

## 1. Development Setup

### Prerequisites
- **Node.js**: Version 18.0.0 or higher (uses native test runner `node:test`).
- **Google Chrome**: Version 116+ (supports Manifest V3 module service workers).

### Getting Started
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/<your-username>/openclaw.git
   cd openclaw
   ```
2. Verify existing tests pass:
   ```bash
   npm test
   ```
3. Verify syntax and linting:
   ```bash
   npm run lint
   ```

---

## 2. Coding Standards & Invariants

All contributions must preserve the core system invariants:

- **Zero External Dependencies**: Do not add runtime dependencies to `package.json`. The project uses native Web APIs and Node.js built-ins.
- **`INV-01` (Zero Audio)**: Never request or attach audio tracks (`audio: false`).
- **`INV-02` (Zero Recording)**: Never introduce `MediaRecorder`, offscreen frame captures, or local stream buffering.
- **`INV-03` (Hermetic Lifecycle)**: Ensure every stream track is explicitly stopped (`track.stop()`) during teardown.
- **`INV-04` (Aspect-Ratio Integrity)**: Preserve `object-fit: contain` rendering for multi-display compatibility.
- **`INV-05` (Least Privilege & Zero Telemetry)**: No remote network calls, tracking scripts, or analytics.

---

## 3. Testing Your Changes

Before submitting a Pull Request, run the automated verification suite:

```bash
# Run unit, lifecycle, and invariant tests
npm test

# Run syntax analysis
npm run lint
```

If adding new features or changing controller logic:
- Add unit tests in `tests/`.
- Ensure all 5 test suites pass without warnings.

---

## 4. Pull Request Guidelines

1. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "feat(viewer): improve aspect ratio scaling on ultra-wide monitors"
   ```
3. Push to your fork and submit a Pull Request.
4. Ensure your PR description includes:
   - Summary of changes.
   - Verification steps taken.
   - Confirmation that all automated tests pass.
