/**
 * Windows Screen Viewer - Core Stream & Lifecycle Controller
 *
 * Implements:
 * - Direct Desktop Media Capture (desktopCapture / chromeMediaSource)
 * - Fallback to getDisplayMedia
 * - AudioContext Realtime Oscillator Keep-Alive (prevents background black screen)
 * - Zero Audio Invariant (audio: false strictly enforced for recording/stream)
 * - Zero Recording Invariant (no recording engine, no network storage)
 * - Hermetic track cleanup and zombie stream prevention
 * - Fullscreen API orchestration and keyboard shortcuts
 */

export class ScreenViewerController {
  /**
   * @param {Object} options
   * @param {HTMLVideoElement} options.videoElement - Target video element for rendering
   * @param {HTMLElement} [options.containerElement] - Fullscreen container element (defaults to documentElement)
   * @param {Function} [options.onStateChange] - State change callback (state, payload)
   * @param {Object} [options.mediaDevices] - MediaDevices provider (defaults to navigator.mediaDevices)
   * @param {Document} [options.documentRef] - Document reference for DOM & Fullscreen APIs
   */
  constructor({
    videoElement,
    containerElement = null,
    onStateChange = null,
    mediaDevices = null,
    documentRef = null
  }) {
    this.videoElement = videoElement;
    this.containerElement = containerElement;
    this.onStateChange = onStateChange;
    this.mediaDevices = mediaDevices || (typeof navigator !== 'undefined' ? navigator.mediaDevices : null);
    this.document = documentRef || (typeof document !== 'undefined' ? document : null);

    this.state = 'idle';
    this.currentStream = null;
    this.streamDetails = {
      label: '',
      width: 0,
      height: 0,
      frameRate: 0,
      displaySurface: ''
    };
    this.lastError = null;
    this._bgAudioKeepAlive = null;

    // Bound listeners for cleanup
    this._boundTrackEnded = this._handleTrackEnded.bind(this);
    this._boundLoadedMetadata = this._handleLoadedMetadata.bind(this);
    this._boundFullscreenChange = this._handleFullscreenChange.bind(this);
    this._boundEnsurePlay = this._ensurePlayback.bind(this);

    if (this.document) {
      this.document.addEventListener('fullscreenchange', this._boundFullscreenChange);
      this.document.addEventListener('webkitfullscreenchange', this._boundFullscreenChange);
      this.document.addEventListener('visibilitychange', this._boundEnsurePlay);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this._boundEnsurePlay);
    }
  }

  /**
   * Current active state getter.
   */
  getState() {
    return this.state;
  }

  /**
   * Current active stream details.
   */
  getStreamDetails() {
    return { ...this.streamDetails };
  }

  /**
   * Internal state transition dispatcher.
   */
  _setState(newState, payload = {}) {
    this.state = newState;
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(newState, {
        state: newState,
        streamDetails: this.getStreamDetails(),
        lastError: this.lastError,
        isFullscreen: this.isFullscreen(),
        ...payload
      });
    }
  }

  /**
   * Initiates Windows Screen Sharing.
   * Prefers chrome.desktopCapture if available, falls back to getDisplayMedia.
   */
  async startSharing() {
    if (this.state === 'requesting' || this.state === 'viewing') {
      return;
    }

    this.lastError = null;
    this._setState('requesting');

    // 1. Direct Chrome Extension desktopCapture API (Scre.io Architecture)
    if (typeof chrome !== 'undefined' && chrome.desktopCapture && typeof chrome.desktopCapture.chooseDesktopMedia === 'function') {
      try {
        const streamId = await new Promise((resolve) => {
          chrome.desktopCapture.chooseDesktopMedia(['screen', 'window'], (id) => {
            resolve(id);
          });
        });

        if (streamId) {
          const constraints = {
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: streamId,
                maxWidth: 3840,
                maxHeight: 2160,
                maxFrameRate: 60
              }
            },
            audio: false
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          this._attachStream(stream);
          return;
        } else {
          this._handleError(new Error('User cancelled screen selection'), 'USER_CANCELLED');
          return;
        }
      } catch (directErr) {
        console.warn('Direct desktopCapture error, falling back:', directErr);
      }
    }

    // 2. Extension Message Bridge if desktopCapture is in background
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'CHOOSE_DESKTOP_MEDIA', sources: ['screen', 'window'] }, (res) => {
            resolve(res);
          });
        });

        if (response && response.streamId) {
          const constraints = {
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: response.streamId,
                maxWidth: 3840,
                maxHeight: 2160,
                maxFrameRate: 60
              }
            },
            audio: false
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          this._attachStream(stream);
          return;
        } else if (response && response.error && response.error.includes('cancelled')) {
          this._handleError(new Error('User cancelled screen selection'), 'USER_CANCELLED');
          return;
        }
      } catch (extErr) {
        console.warn('desktopCapture message bridge fallback to getDisplayMedia:', extErr);
      }
    }

    // 3. Standard Web getDisplayMedia
    if (!this.mediaDevices || typeof this.mediaDevices.getDisplayMedia !== 'function') {
      this._handleError(
        new Error('Screen capture API (getDisplayMedia) is not supported in this browser.'),
        'UNSUPPORTED_API'
      );
      return;
    }

    const displayMediaOptions = {
      video: {
        cursor: 'always',
        frameRate: { ideal: 60, max: 60 }
      },
      audio: false
    };

    try {
      let stream;
      try {
        stream = await this.mediaDevices.getDisplayMedia(displayMediaOptions);
      } catch (optErr) {
        if (optErr && optErr.name !== 'NotAllowedError' && optErr.name !== 'AbortError') {
          stream = await this.mediaDevices.getDisplayMedia({ video: true, audio: false });
        } else {
          throw optErr;
        }
      }
      this._attachStream(stream);
    } catch (err) {
      this._handleError(err);
    }
  }

  /**
   * Attaches and initializes captured MediaStream to the video element.
   * @param {MediaStream} stream
   */
  _attachStream(stream) {
    if (!stream || !stream.getVideoTracks || stream.getVideoTracks().length === 0) {
      this._handleError(new Error('No active video track received from screen capture.'), 'NO_VIDEO_TRACK');
      return;
    }

    // Stop any existing stream before attaching new one
    this._cleanupStream();

    this.currentStream = stream;
    const videoTrack = stream.getVideoTracks()[0];

    // Listen for user stopping screen share via Chrome system bar or browser UI
    videoTrack.addEventListener('ended', this._boundTrackEnded, { once: true });

    // Read track settings and capabilities
    const settings = typeof videoTrack.getSettings === 'function' ? videoTrack.getSettings() : {};
    this.streamDetails = {
      label: videoTrack.label || 'Windows Desktop',
      width: settings.width || 0,
      height: settings.height || 0,
      frameRate: settings.frameRate || 60,
      displaySurface: settings.displaySurface || 'monitor'
    };

    if (this.videoElement) {
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      this.videoElement.autoplay = true;

      this.videoElement.removeEventListener('loadedmetadata', this._boundLoadedMetadata);
      this.videoElement.addEventListener('loadedmetadata', this._boundLoadedMetadata, { once: true });
      this.videoElement.srcObject = stream;

      // Ensure playback starts smoothly
      const triggerPlay = () => {
        const playPromise = this.videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch((playErr) => {
            console.warn('Auto-playback warning:', playErr);
          });
        }
      };

      triggerPlay();
      this.videoElement.addEventListener('loadedmetadata', triggerPlay, { once: true });
    }

    // Start Silent Realtime Audio Keep-Alive (Prevents background black screen)
    this._startBackgroundKeepAlive();

    this._setState('viewing');
  }

  /**
   * Starts a silent high-priority Web Audio loop.
   * Keeps Chrome & Windows GPU Compositor awake when switching to other apps.
   */
  _startBackgroundKeepAlive() {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioCtx = new AudioContextClass();
      const gain = audioCtx.createGain();
      gain.gain.value = 0; // Pure silence (gain 0)
      gain.connect(audioCtx.destination);

      let stopped = false;
      const loop = () => {
        if (stopped || this.state !== 'viewing') return;
        try {
          const osc = audioCtx.createOscillator();
          osc.connect(gain);
          osc.onended = loop;
          osc.start(0);
          osc.stop(audioCtx.currentTime + 0.1);
        } catch {
          // Ignore
        }
      };

      loop();
      this._bgAudioKeepAlive = () => {
        stopped = true;
        try {
          audioCtx.close();
        } catch {
          // Ignore
        }
      };
    } catch (e) {
      console.warn('Background keep-alive init notice:', e);
    }
  }

  /**
   * Handles video metadata loaded event to update real stream dimensions.
   */
  _handleLoadedMetadata() {
    if (this.videoElement) {
      this.streamDetails.width = this.videoElement.videoWidth || this.streamDetails.width;
      this.streamDetails.height = this.videoElement.videoHeight || this.streamDetails.height;
      this._setState('viewing', { resolutionUpdated: true });
    }
  }

  /**
   * Handles track ended event (e.g. user clicked native Chrome 'Stop sharing' banner).
   */
  _handleTrackEnded() {
    this.stopSharing();
  }

  /**
   * Cleanly stops screen sharing, terminates all media tracks, and resets to idle state.
   */
  stopSharing() {
    this._cleanupStream();
    this.lastError = null;
    this._setState('idle');
  }

  /**
   * Hermetic track and resource cleanup (INV-03).
   */
  _cleanupStream() {
    if (this._bgAudioKeepAlive) {
      try {
        this._bgAudioKeepAlive();
      } catch {
        // Ignore
      }
      this._bgAudioKeepAlive = null;
    }

    if (this.currentStream) {
      try {
        const tracks = this.currentStream.getTracks ? this.currentStream.getTracks() : [];
        for (const track of tracks) {
          track.removeEventListener('ended', this._boundTrackEnded);
          if (typeof track.stop === 'function') {
            track.stop();
          }
        }
      } catch (e) {
        console.warn('Error during stream tracks cleanup:', e);
      }
      this.currentStream = null;
    }

    if (this.videoElement) {
      this.videoElement.removeEventListener('loadedmetadata', this._boundLoadedMetadata);
      this.videoElement.srcObject = null;
    }

    this.streamDetails = {
      label: '',
      width: 0,
      height: 0,
      frameRate: 0,
      displaySurface: ''
    };
  }

  /**
   * Error classification and mapping for user feedback.
   */
  _handleError(err, customCode = null) {
    this._cleanupStream();

    let code = customCode;
    let message = 'An error occurred while attempting to share your screen.';
    let isCancellation = false;

    if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError' || err.name === 'PermissionDeniedError' || err.message === 'User cancelled screen selection')) {
      isCancellation = true;
      code = 'USER_CANCELLED';
      message = 'Screen sharing was cancelled or permission was not granted.';
    } else if (err && err.name === 'NotFoundError') {
      code = 'NO_DEVICE';
      message = 'No display source was found to capture.';
    } else if (err && err.name === 'NotReadableError') {
      code = 'DEVICE_BUSY';
      message = 'Could not access the screen. The display device might be busy or restricted by Windows security.';
    } else if (err && err.name === 'SecurityError') {
      code = 'SECURITY_POLICY';
      message = 'Screen capture is blocked by browser or system security policy.';
    } else if (err && err.message) {
      message = err.message;
    }

    this.lastError = {
      code: code || 'UNKNOWN_ERROR',
      message,
      isCancellation,
      rawError: err
    };

    this._setState('error', { error: this.lastError });
  }

  /**
   * Fullscreen API toggle with standard and vendor prefixes.
   */
  async toggleFullscreen() {
    if (this.isFullscreen()) {
      await this.exitFullscreen();
    } else {
      await this.requestFullscreen();
    }
  }

  /**
   * Request browser fullscreen on container or document element.
   */
  async requestFullscreen() {
    const target = this.containerElement || (this.document ? this.document.documentElement : null);
    if (!target) return;

    try {
      if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
      } else if (target.mozRequestFullScreen) {
        await target.mozRequestFullScreen();
      } else if (target.msRequestFullscreen) {
        await target.msRequestFullscreen();
      }
    } catch (fsErr) {
      console.warn('Fullscreen request denied or not allowed:', fsErr);
    }
  }

  /**
   * Exit browser fullscreen.
   */
  async exitFullscreen() {
    if (!this.document) return;

    try {
      if (this.document.exitFullscreen) {
        await this.document.exitFullscreen();
      } else if (this.document.webkitExitFullscreen) {
        await this.document.webkitExitFullscreen();
      } else if (this.document.mozCancelFullScreen) {
        await this.document.mozCancelFullScreen();
      } else if (this.document.msExitFullscreen) {
        await this.document.msExitFullscreen();
      }
    } catch (fsErr) {
      console.warn('Exit fullscreen error:', fsErr);
    }
  }

  /**
   * Check if currently in fullscreen.
   */
  isFullscreen() {
    if (!this.document) return false;
    return !!(
      this.document.fullscreenElement ||
      this.document.webkitFullscreenElement ||
      this.document.mozFullScreenElement ||
      this.document.msFullscreenElement
    );
  }

  /**
   * Handles document fullscreen state change.
   */
  _handleFullscreenChange() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.state, {
        state: this.state,
        streamDetails: this.getStreamDetails(),
        lastError: this.lastError,
        isFullscreen: this.isFullscreen()
      });
    }
  }

  /**
   * Keep-alive playback handler for background tab & window switching.
   */
  _ensurePlayback() {
    if (this.state === 'viewing' && this.videoElement && this.currentStream) {
      if (this.videoElement.paused) {
        this.videoElement.play().catch(() => {});
      }
    }
  }

  /**
   * Comprehensive cleanup when closing or unmounting viewer.
   */
  destroy() {
    this._cleanupStream();
    if (this.document) {
      this.document.removeEventListener('fullscreenchange', this._boundFullscreenChange);
      this.document.removeEventListener('webkitfullscreenchange', this._boundFullscreenChange);
      this.document.removeEventListener('visibilitychange', this._boundEnsurePlay);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this._boundEnsurePlay);
    }
    this.onStateChange = null;
  }
}
