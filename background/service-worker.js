/**
 * Windows Screen Viewer - Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 * - Listen for user interaction on the extension action icon.
 * - Open the dedicated viewer tab (viewer/viewer.html) or bring an existing viewer tab to focus.
 * - Maintain zero persistent background overhead and zero extraneous permissions.
 */

const VIEWER_PATH = 'viewer/viewer.html';
const LOCAL_HTTP_URL = 'http://localhost:5173/viewer/viewer.html';

/**
 * Dynamically determines whether the local HTTP companion server is running.
 * - If running (HTTP 200 on port 5173): returns http://localhost:5173 for Gemini Live.
 * - If offline: gracefully falls back to the native extension page with zero errors!
 */
export async function getPreferredViewerUrl() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 280);
    const res = await fetch('http://127.0.0.1:5173/viewer/viewer.html', {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return LOCAL_HTTP_URL;
  } catch {
    return chrome.runtime.getURL(VIEWER_PATH);
  }
}

/**
 * Handles extension icon click: opens the viewer tab with dynamic auto-detection.
 */
export async function handleActionClick() {
  const targetUrl = await getPreferredViewerUrl();
  const extensionUrl = chrome.runtime.getURL(VIEWER_PATH);

  try {
    // Check if viewer tab (either HTTP or Extension) is already open in any window
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs ? tabs.find(t => t.url && (t.url.startsWith('http://localhost:5173') || t.url === extensionUrl)) : null;

    if (existingTab) {
      if (existingTab.id !== undefined) {
        // Upgrade from extension to HTTP if server was started
        if (existingTab.url === extensionUrl && targetUrl === LOCAL_HTTP_URL) {
          await chrome.tabs.update(existingTab.id, { url: targetUrl, active: true });
        } else {
          await chrome.tabs.update(existingTab.id, { active: true });
        }
      }
      if (existingTab.windowId !== undefined) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
      return existingTab;
    }

    // Open as a standard tab
    const newTab = await chrome.tabs.create({ url: targetUrl });
    return newTab;
  } catch (err) {
    console.error('Error opening viewer tab:', err);
    return await chrome.tabs.create({ url: extensionUrl });
  }
}

// Listen for messages from viewer page to request desktop capture with native privileges
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'CHOOSE_DESKTOP_MEDIA') {
      if (chrome.desktopCapture && typeof chrome.desktopCapture.chooseDesktopMedia === 'function') {
        const sources = message.sources || ['screen', 'window'];
        const targetTab = sender && sender.tab ? sender.tab : undefined;
        try {
          const reqId = chrome.desktopCapture.chooseDesktopMedia(sources, targetTab, (streamId) => {
            if (!streamId) {
              sendResponse({ error: 'User cancelled desktop selection' });
            } else {
              sendResponse({ streamId });
            }
          });
          return true; // Keep response channel open for async callback
        } catch (e) {
          sendResponse({ error: e.message });
        }
      } else {
        sendResponse({ error: 'desktopCapture API not available' });
      }
    }
  });
}

// Register action listener if running in Chrome Extension environment
if (typeof chrome !== 'undefined' && chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(handleActionClick);
}
