/**
 * Windows Screen Viewer - Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 * - Listen for user interaction on the extension action icon.
 * - Open the dedicated viewer tab (viewer/viewer.html) or bring an existing viewer tab to focus.
 * - Maintain zero persistent background overhead and zero extraneous permissions.
 */

const LOCAL_HTTP_URL = 'http://localhost:5173/viewer/viewer.html';

/**
 * Handles extension icon click: always opens http://localhost:5173/viewer/viewer.html for Gemini Live.
 */
export async function handleActionClick() {
  const targetUrl = LOCAL_HTTP_URL;

  try {
    // Check if local HTTP viewer tab is already open in any window
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs ? tabs.find(t => t.url && t.url.startsWith('http://localhost:5173')) : null;

    if (existingTab) {
      if (existingTab.id !== undefined) {
        await chrome.tabs.update(existingTab.id, { active: true });
      }
      if (existingTab.windowId !== undefined) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
      return existingTab;
    }

    // Open standard tab at http://localhost:5173
    const newTab = await chrome.tabs.create({ url: targetUrl });
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
