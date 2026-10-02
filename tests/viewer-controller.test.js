import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ScreenViewerController } from '../viewer/viewer-controller.js';

// Mock MediaStreamTrack
class MockMediaStreamTrack {
  constructor(kind = 'video', label = 'Windows Display 1') {
    this.kind = kind;
    this.label = label;
    this.readyState = 'live';
    this.stopped = false;
    this.listeners = new Map();
  }

  addEventListener(event, listener, options) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push({ listener, once: !!(options && options.once) });
  }

  removeEventListener(event, listener) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event).filter(item => item.listener !== listener);
    this.listeners.set(event, list);
  }

  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    for (const item of [...list]) {
      item.listener(event);
      if (item.once) {
        this.removeEventListener(event.type, item.listener);
      }
    }
  }

  stop() {
    this.stopped = true;
    this.readyState = 'ended';
  }

  getSettings() {
    return {
      width: 1920,
      height: 1080,
      frameRate: 60,
      displaySurface: 'monitor'
    };
  }
}

// Mock MediaStream
class MockMediaStream {
  constructor(tracks = [new MockMediaStreamTrack('video')]) {
    this._tracks = tracks;
  }

  getVideoTracks() {
    return this._tracks.filter(t => t.kind === 'video');
  }

  getAudioTracks() {
    return this._tracks.filter(t => t.kind === 'audio');
  }

  getTracks() {
    return [...this._tracks];
  }
}

// Mock VideoElement
class MockVideoElement {
  constructor() {
    this.srcObject = null;
    this.videoWidth = 1920;
    this.videoHeight = 1080;
    this.listeners = new Map();
    this.playCount = 0;
  }

  addEventListener(event, listener, options) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push({ listener, once: !!(options && options.once) });
  }

  removeEventListener(event, listener) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event).filter(item => item.listener !== listener);
    this.listeners.set(event, list);
  }

  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    for (const item of [...list]) {
      item.listener(event);
      if (item.once) {
        this.removeEventListener(event.type, item.listener);
      }
    }
  }

  play() {
    this.playCount++;
    return Promise.resolve();
  }
}

// Mock Document
class MockDocument {
  constructor() {
    this.fullscreenElement = null;
    this.listeners = new Map();
    this.documentElement = {
      requestFullscreen: async () => {
        this.fullscreenElement = this.documentElement;
        this.dispatchEvent({ type: 'fullscreenchange' });
      }
    };
  }

  addEventListener(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
  }

  removeEventListener(event, listener) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event).filter(l => l !== listener);
    this.listeners.set(event, list);
  }

  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    for (const l of list) {
      l(event);
    }
  }

  async exitFullscreen() {
    this.fullscreenElement = null;
    this.dispatchEvent({ type: 'fullscreenchange' });
  }
}

describe('ScreenViewerController Unit & Lifecycle Tests', () => {
  let mockVideo;
  let mockDoc;
  let mockMediaDevices;
  let lastCapturedOptions;

  beforeEach(() => {
    mockVideo = new MockVideoElement();
    mockDoc = new MockDocument();
    lastCapturedOptions = null;

    mockMediaDevices = {
      getDisplayMedia: async (options) => {
        lastCapturedOptions = options;
        return new MockMediaStream();
      }
    };
  });

  test('initial state is idle', () => {
    const controller = new ScreenViewerController({
      videoElement: mockVideo,
      documentRef: mockDoc,
      mediaDevices: mockMediaDevices
    });

    assert.strictEqual(controller.getState(), 'idle');
    assert.strictEqual(controller.currentStream, null);
    assert.strictEqual(controller.isFullscreen(), false);
  });

  test('startSharing requests getDisplayMedia with strict audio: false constraint (INV-01)', async () => {
    const stateHistory = [];
    const controller = new ScreenViewerController({
      videoElement: mockVideo,
      documentRef: mockDoc,
      mediaDevices: mockMediaDevices,
      onStateChange: (state) => stateHistory.push(state)
    });

    await controller.startSharing();

    assert.ok(lastCapturedOptions, 'getDisplayMedia must have been invoked');
    assert.strictEqual(lastCapturedOptions.audio, false, 'Audio must strictly be false (INV-01)');
    assert.deepStrictEqual(stateHistory, ['requesting', 'viewing']);
    assert.strictEqual(controller.getState(), 'viewing');
    assert.ok(mockVideo.srcObject instanceof MockMediaStream, 'Video srcObject must be assigned the stream');
    assert.strictEqual(mockVideo.playCount, 1, 'play() should be called on video element');
  });

  test('stopping stream cleans up all tracks and resets state to idle (INV-03)', async () => {
    const controller = new ScreenViewerController({
      videoElement: mockVideo,
      documentRef: mockDoc,
      mediaDevices: mockMediaDevices
    });

    await controller.startSharing();
    const activeStream = controller.currentStream;
    const track = activeStream.getVideoTracks()[0];

    assert.strictEqual(controller.getState(), 'viewing');
    assert.strictEqual(track.stopped, false);

    controller.stopSharing();

    assert.strictEqual(controller.getState(), 'idle');
    assert.strictEqual(controller.currentStream, null);
    assert.strictEqual(mockVideo.srcObject, null, 'video.srcObject must be cleared');
    assert.strictEqual(track.stopped, true, 'Track.stop() must be called to terminate hardware capture');
  });

  test('native browser stop sharing bar triggers track ended event and clean reset', async () => {
    const controller = new ScreenViewerController({
      videoElement: mockVideo,
      documentRef: mockDoc,
      mediaDevices: mockMediaDevices
    });

    await controller.startSharing();
    const track = controller.currentStream.getVideoTracks()[0];

    // Simulate user clicking "Stop Sharing" on Chrome native banner
    track.dispatchEvent({ type: 'ended' });

    assert.strictEqual(controller.getState(), 'idle');
    assert.strictEqual(controller.currentStream, null);
    assert.strictEqual(mockVideo.srcObject, null);
  });

  test('user cancellation is handled gracefully without unhandled exceptions', async () => {
    mockMediaDevices.getDisplayMedia = async () => {
      const cancelErr = new Error('Permission denied');
      cancelErr.name = 'NotAllowedError';
      throw cancelErr;
    };

    let reportedError = null;
    const controller = new ScreenViewerController({
      videoElement: mockVideo,
      documentRef: mockDoc,
      mediaDevices: mockMediaDevices,
      onStateChange: (state, payload) => {
        if (state === 'error') {
          reportedError = payload.lastError;
        }
      }
    });

    await controller.startSharing();

    assert.strictEqual(controller.getState(), 'error');
    assert.ok(reportedError, 'Error payload must be supplied');
    assert.strictEqual(reportedError.isCancellation, true);
    assert.strictEqual(reportedError.code, 'USER_CANCELLED');
    assert.strictEqual(mockVideo.srcObject, null);
  });

  test('fullscreen toggle correctly enters and exits fullscreen', async () => {
    const controller = new ScreenViewerController({
      videoElement: mockVideo,
      documentRef: mockDoc,
      mediaDevices: mockMediaDevices
    });

    assert.strictEqual(controller.isFullscreen(), false);

    await controller.toggleFullscreen();
    assert.strictEqual(controller.isFullscreen(), true);

    await controller.toggleFullscreen();
    assert.strictEqual(controller.isFullscreen(), false);
  });

  test('destroy removes listeners and terminates active streams', async () => {
    const controller = new ScreenViewerController({
      videoElement: mockVideo,
      documentRef: mockDoc,
      mediaDevices: mockMediaDevices
    });

    await controller.startSharing();
    const stream = controller.currentStream;
    const track = stream.getVideoTracks()[0];

    controller.destroy();

    assert.strictEqual(track.stopped, true);
    assert.strictEqual(controller.currentStream, null);
    assert.strictEqual(mockVideo.srcObject, null);
  });
});
