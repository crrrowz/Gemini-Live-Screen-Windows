import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { handleActionClick } from '../background/service-worker.js';

describe('Background Service Worker Tests', () => {
  let mockTabs = [];
  let tabCreateCalls = [];
  let tabUpdateCalls = [];
  let windowUpdateCalls = [];

  beforeEach(() => {
    mockTabs = [];
    tabCreateCalls = [];
    tabUpdateCalls = [];
    windowUpdateCalls = [];

    globalThis.chrome = {
      runtime: {
        getURL: (path) => `chrome-extension://mock-extension-id/${path}`,
        connectNative: () => ({
          onMessage: { addListener: () => {} },
          onDisconnect: { addListener: () => {} },
          disconnect: () => {}
        })
      },
      tabs: {
        query: async (queryInfo) => {
          if (queryInfo && queryInfo.url) {
            return mockTabs.filter(tab => tab.url === queryInfo.url);
          }
          return [...mockTabs];
        },
        create: async (createProperties) => {
          const newTab = { id: 101, windowId: 1, url: createProperties.url, active: true };
          tabCreateCalls.push(createProperties);
          mockTabs.push(newTab);
          return newTab;
        },
        update: async (tabId, updateProperties) => {
          tabUpdateCalls.push({ tabId, updateProperties });
          const tab = mockTabs.find(t => t.id === tabId);
          if (tab) Object.assign(tab, updateProperties);
          return tab;
        }
      },
      windows: {
        create: async (createProperties) => {
          const newWin = { id: 101, url: createProperties.url };
          tabCreateCalls.push(createProperties);
          return newWin;
        },
        update: async (windowId, updateProperties) => {
          windowUpdateCalls.push({ windowId, updateProperties });
          return { id: windowId, ...updateProperties };
        }
      },
      action: {
        onClicked: {
          addListener: () => {}
        }
      }
    };
  });

  test('creates new viewer tab when no viewer tab is currently open', async () => {
    const tab = await handleActionClick();

    assert.strictEqual(tabCreateCalls.length, 1);
    assert.ok(
      tabCreateCalls[0].url.includes('viewer.html'),
      'Should create tab with viewer.html URL'
    );
    assert.strictEqual(tab.id, 101);
  });

  test('focuses existing viewer tab instead of opening duplicate tabs', async () => {
    // Simulate an existing viewer tab
    mockTabs.push({
      id: 42,
      windowId: 7,
      url: 'http://localhost:5173/viewer/viewer.html',
      active: false
    });

    const tab = await handleActionClick();

    assert.strictEqual(tabCreateCalls.length, 0, 'Should not create a new tab');
    assert.strictEqual(tabUpdateCalls.length, 1, 'Should activate existing tab');
    assert.strictEqual(tabUpdateCalls[0].tabId, 42);
    assert.strictEqual(tabUpdateCalls[0].updateProperties.active, true);
    assert.strictEqual(windowUpdateCalls.length, 1, 'Should focus the window containing the tab');
    assert.strictEqual(windowUpdateCalls[0].windowId, 7);
    assert.strictEqual(windowUpdateCalls[0].updateProperties.focused, true);
    assert.strictEqual(tab.id, 42);
  });
});
