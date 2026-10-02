# Security Policy

## Supported Versions

Security updates are provided for the latest release:

| Version | Supported          |
| :------ | :----------------- |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Security Model & Privacy Guarantees

Windows Screen Viewer is designed with a defense-in-depth security posture:

1. **Zero External Network Egress**: The application does not contain remote network requests (`fetch`, `XMLHttpRequest`, `WebSocket`, or third-party SDKs). All video stream processing is local to your browser tab.
2. **Zero Screen Persistence**: Screen frames are rendered directly to a `<video>` DOM element via native browser composition. No frames are captured to canvas, recorded to disk, or buffered in memory.
3. **Zero Audio Capture**: Microphone and system audio streams are strictly excluded (`audio: false`).
4. **Least Privilege Manifest**: Extension permissions are restricted to `desktopCapture` for OS screen stream acquisition, with no access to browsing history, cookies, or web content.

---

## Reporting a Vulnerability

If you discover a security vulnerability or potential privacy leak in this project:

1. **Do not create a public GitHub issue.**
2. Send a detailed report to the maintainers or open a [Private Security Advisory](https://github.com/maintainers/openclaw/security/advisories/new).
3. Include:
   - Description of the vulnerability.
   - Steps to reproduce / Proof of Concept (PoC).
   - Affected components and browser versions.
4. Maintainers will acknowledge receipt within 48 hours and coordinate a fix and advisory.
