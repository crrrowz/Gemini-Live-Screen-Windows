## 🚀 What's New in This Release

Initial production-grade release of **Gemini Live Screen for Windows**, a dedicated Manifest V3 Chrome Extension and companion local viewer that streams your live Windows desktop directly into Chrome for **Google Gemini Live**, multimodal AI models, and real-time screen sharing with zero latency.

---

### ✨ Key Features & Highlights

- **Desktop Vision for Web AI**: Bridges full Windows desktop display into standard browser tab sharing for Google Gemini Live and web-based AI agents.
- **Hardware-Accelerated Zero-Lag Playback**: Direct `<video>` compositor rendering with native 60 FPS performance and zero transcoding delay.
- **Aspect-Ratio Preserved Letterboxing**: Pure black stage with `object-fit: contain` supporting 16:9, 16:10, 4:3, and 21:9 Ultrawide monitors without distortion.
- **Background Active Keep-Alive Engine**: Employs an inaudible real-time Web Audio oscillator loop to prevent Windows and Chrome from throttling or blacking out background streams.
- **Draggable & Auto-Dimming Floating HUD**: Minimalist overlay toolbar with smooth drag & drop anywhere on screen, instant Eye toggle (👁️), Fullscreen mode (`F`), and auto-dimming after 5 seconds of inactivity.
- **100% Private & Zero Recording**: Strictly enforces `audio: false` and zero data persistence. Video frames stay 100% local on your machine.
- **Auto-Shutdown Local Server**: Node.js server (`server.js`) on port `5173` that automatically starts on-demand and terminates cleanly when the viewer tab is closed.

---

### 📦 Installation & Setup

1. Download the distribution archive `gemini-live-screen-windows-${{ tag }}.zip` below and extract it.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** (top left) and select the extracted folder.
5. Click the extension icon to start streaming immediately!
