# Support & Troubleshooting Guide

Welcome to the **Windows Screen Viewer** support guide.

---

## 🔍 Common Troubleshooting Scenarios

### 1. Screen Sharing Cancelled / Not Allowed (`USER_CANCELLED`)
- **Cause**: You clicked "Cancel" in the Chrome screen selection dialog, or permission was denied.
- **Solution**: Click "Try Again" or press `Space` and select your target monitor from the "Entire Screen" tab.

### 2. Video Freezes When Switching Applications
- **Cause**: Chrome window was minimized to the Windows taskbar via the `_` button, causing Windows DWM and Chromium to throttle GPU composition.
- **Solution**: 
  - **Do NOT click the OS minimize button (`_`)**.
  - Simply click on your target workspace (IDE, Terminal, etc.) and let Chrome sit behind your active window.
  - Alternatively, move the Chrome viewer window to a secondary Windows Virtual Desktop (`Win + Ctrl + D`).

### 3. Local Server Exited Automatically
- **Cause**: `server.js` includes an idle auto-shutdown timer (6 seconds) when no active viewer tab is connected.
- **Solution**: Run `npm start` again and keep the viewer tab open.

---

## 💬 Getting Help

- **Bug Reports**: If you encounter a bug, please search existing issues before submitting a new report. Provide steps to reproduce, OS version, and Chrome version.
- **Feature Requests**: Open an issue labeled `enhancement` with the proposed feature and use case.
- **Security Vulnerabilities**: Refer to [SECURITY.md](SECURITY.md) for private reporting procedures.
