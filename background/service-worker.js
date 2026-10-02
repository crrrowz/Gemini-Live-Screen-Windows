/**
 * Gemini Live Screen for Windows - Background Service Worker (Manifest V3)
 *
 * Implements:
 * - Native Messaging Companion Host integration (auto-launch & auto-terminate on-demand)
 * - Dynamic tab lifecycle management
 * - Desktop capture messaging bridge
 */

const VIEWER_PATH = 'viewer/viewer.html';
const LOCAL_HTTP_URL = 'http://localhost:5173/viewer/viewer.html';
const NATIVE_HOST_NAME = 'com.gemini.live.screen.host';

let nativePort = null;
let activeViewerTabIds = new Set();

/**
 * Connects to Native Messaging Companion Host.
 * Starts local HTTP server on-demand and keeps it alive while tabs are open.
 */
function ensureNativeCompanionRunning() {
  if (nativePort) return nativePort;

  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    nativePort.onMessage.addListener((msg) => {
      console.log('[Native Host Message]:', msg);
    });
    nativePort.onDisconnect.addListener(() => {
      console.log('[Native Host Disconnected]:', chrome.runtime.lastError?.message);
      nativePort = null;
    });
  } catch (err) {
    console.warn('Native messaging not configured, falling back:', err);
    nativePort = null;
  }
  return nativePort;
}

/**
 * Automatically disconnects native host (which shuts down server) when all viewer tabs are closed.
 */
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((closedTabId) => {
    activeViewerTabIds.delete(closedTabId);
    if (activeViewerTabIds.size === 0 && nativePort) {
      console.log('[Service Worker] All viewer tabs closed. Disconnecting native host...');
      try {
        nativePort.disconnect();
      } catch {
        // Ignore
      }
      nativePort = null;
    }
  });
}

/**
 * Dynamically resolves target URL:
 * - Connects to Native Companion Host.
 * - Polls for server readiness and opens http://localhost:5173 for Gemini Live.
 */
export async function getTargetViewerUrl() {
  ensureNativeCompanionRunning();

  // Poll server readiness for up to 1000ms
  for (let i = 0; i < 5; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 200);
      await fetch('http://127.0.0.1:5173/viewer/viewer.html', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return LOCAL_HTTP_URL;
    } catch {
      await new Promise(r => setTimeout(r, 150));
    }
  }
  return LOCAL_HTTP_URL;
}

/**
 * Handles extension icon click: locates existing viewer tab or creates a new one.
 */
export async function handleActionClick() {
  const targetUrl = await getTargetViewerUrl();

  try {
    // Check if viewer tab is already open in any window
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs ? tabs.find(t => t.url && t.url.startsWith('http://localhost:5173')) : null;

    if (existingTab) {
      if (existingTab.id !== undefined) {
        activeViewerTabIds.add(existingTab.id);
        await chrome.tabs.update(existingTab.id, { active: true });
      }
      if (existingTab.windowId !== undefined) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
      return existingTab;
    }

    // Open standard tab
    const newTab = await chrome.tabs.create({ url: targetUrl });
    if (newTab && newTab.id !== undefined) {
      activeViewerTabIds.add(newTab.id);
    }
    return newTab;
  } catch (err) {
    console.error('Error opening viewer tab:', err);
    return await chrome.tabs.create({ url: targetUrl });
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
