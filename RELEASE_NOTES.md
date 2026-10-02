## 🚀 What's New in This Release

Production-grade release of **Gemini Live Screen for Windows** featuring official **Chrome Native Messaging** integration for 100% automated on-demand local streaming without manual terminal commands.

---

### ✨ Key Features & Highlights

- **Chrome Native Messaging Host**: Chrome automatically launches the local streaming companion server when you click the extension icon, and automatically terminates it when you close the tab.
- **Desktop Vision for Gemini Live**: Streams full Windows desktop into an accessible local HTTP tab (`http://localhost:5173/viewer/viewer.html`) so Gemini Live can inspect your desktop in real-time.
- **Hardware-Accelerated Zero-Lag Playback**: Direct `<video>` compositor rendering with native 60 FPS performance and zero transcoding delay.
- **Aspect-Ratio Preserved Letterboxing**: Pure black stage with `object-fit: contain` supporting 16:9, 16:10, 4:3, and 21:9 Ultrawide monitors without distortion.
- **Background Active Keep-Alive Engine**: Employs an inaudible real-time Web Audio oscillator loop to prevent Windows and Chrome from throttling or blacking out background streams.
- **Draggable & Auto-Dimming Floating HUD**: Minimalist overlay toolbar with smooth drag & drop anywhere on screen, instant Eye toggle (👁️), Fullscreen mode (`F`), and auto-dimming after 5 seconds of inactivity.
- **100% Private & Zero Recording**: Strictly enforces `audio: false` and zero data persistence. Video frames stay 100% local on your machine.

---

### 📦 Quick Setup & Installation

1. Download the release archive `gemini-live-screen-windows-${{ tag }}.zip` below and extract it to a permanent folder on your PC.
2. **One-Time Native Host Registration**:
   - Open the extracted folder.
   - Locate and double-click **`register_native_host.bat`** (located directly in the main folder alongside `manifest.json`).
   - A terminal window will open, register the companion host in Chrome, and display `[Success]`. Press any key to close it.
3. Open Google Chrome and navigate to `chrome://extensions/`.
4. Enable **Developer mode** using the toggle switch in the top-right corner.
5. Click **Load unpacked** (top-left) and select the extracted folder.
6. Pin the **Gemini Live Screen for Windows** icon to your Chrome extensions toolbar.

---

### 🎮 Daily Usage

- **Click the extension icon** in your toolbar: Chrome automatically spins up the companion server and opens `http://localhost:5173/viewer/viewer.html`.
- Click **Share Windows Screen** and select **Entire Screen**.
- Open **Gemini Live** to share the tab and collaborate.
- When you are done, simply **close the viewer tab** — Chrome will automatically shut down the companion server and free memory!
