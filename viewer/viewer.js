/**
 * Windows Screen Viewer - Frontend UI Controller & Event Binder
 */

import { ScreenViewerController } from './viewer-controller.js';

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const body = document.body;
  const viewerContainer = document.getElementById('viewerContainer');
  const videoElement = document.getElementById('screenVideo');
  const btnShareScreen = document.getElementById('btnShareScreen');
  const btnRetry = document.getElementById('btnRetry');
  const btnToggleFullscreen = document.getElementById('btnToggleFullscreen');
  const btnTogglePiP = document.getElementById('btnTogglePiP');
  const btnStopSharing = document.getElementById('btnStopSharing');
  const btnToggleEye = document.getElementById('btnToggleEye');
  const btnRevealEye = document.getElementById('btnRevealEye');
  const iconEyeOpen = document.getElementById('iconEyeOpen');
  const iconEyeClosed = document.getElementById('iconEyeClosed');
  const iconEnterFullscreen = document.getElementById('iconEnterFullscreen');
  const iconExitFullscreen = document.getElementById('iconExitFullscreen');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const hudResolutionText = document.getElementById('hudResolutionText');
  const srAnnouncer = document.getElementById('srAnnouncer');
  const localUrlDisplay = document.getElementById('localUrlDisplay');

  // Redirect to http://localhost:5173 for Gemini Live compatibility
  if (window.location.protocol === 'chrome-extension:') {
    window.location.replace('http://localhost:5173/viewer/viewer.html');
    return;
  }

  // If served over HTTP or Extension, update the display URL
  if (localUrlDisplay) {
    localUrlDisplay.textContent = window.location.href;
  }

  let idleTimer = null;
  const IDLE_TIMEOUT_MS = 5000; // 5 seconds inactivity timeout

  // Screen reader announcer helper
  function announce(message) {
    if (srAnnouncer) {
      srAnnouncer.textContent = '';
      setTimeout(() => {
        srAnnouncer.textContent = message;
      }, 50);
    }
  }

  // Handle user activity to show HUD and reset auto-hide timer
  function resetUserIdleTimer() {
    body.classList.remove('user-idle');
    clearTimeout(idleTimer);

    if (body.classList.contains('state-viewing')) {
      idleTimer = setTimeout(() => {
        body.classList.add('user-idle');
      }, IDLE_TIMEOUT_MS);
    }
  }

  // Toggle HUD minimized state via Eye button
  function toggleHudVisibility(forceState) {
    const shouldMinimize = forceState !== undefined ? forceState : !body.classList.contains('hud-minimized');
    if (shouldMinimize) {
      body.classList.add('hud-minimized');
      if (iconEyeOpen && iconEyeClosed) {
        iconEyeOpen.classList.add('hidden');
        iconEyeClosed.classList.remove('hidden');
      }
      announce('Controls hidden. Click eye icon to restore.');
    } else {
      body.classList.remove('hud-minimized');
      if (iconEyeOpen && iconEyeClosed) {
        iconEyeOpen.classList.remove('hidden');
        iconEyeClosed.classList.add('hidden');
      }
      announce('Controls restored.');
      resetUserIdleTimer();
    }
  }

  // Initialize Controller
  const controller = new ScreenViewerController({
    videoElement,
    containerElement: viewerContainer,
    onStateChange: (state, payload) => {
      // Update body state class
      body.classList.remove('state-idle', 'state-requesting', 'state-viewing', 'state-error');
      body.classList.add(`state-${state}`);

      if (state === 'viewing') {
        announce('Screen sharing started. Viewing live desktop.');
        resetUserIdleTimer();

        // Update resolution badge if available
        if (payload.streamDetails && payload.streamDetails.width && payload.streamDetails.height) {
          hudResolutionText.textContent = `${payload.streamDetails.width}x${payload.streamDetails.height}`;
        } else {
          hudResolutionText.textContent = 'Live';
        }

        // Focus toggle fullscreen button for immediate keyboard accessibility
        if (btnToggleFullscreen) {
          btnToggleFullscreen.focus();
        }
      } else if (state === 'idle') {
        announce('Screen sharing stopped.');
        body.classList.remove('user-idle', 'hud-minimized');
        clearTimeout(idleTimer);
        hudResolutionText.textContent = '';
        if (btnShareScreen) {
          btnShareScreen.focus();
        }
      } else if (state === 'error') {
        const err = payload.lastError || {};
        announce(`Screen sharing error: ${err.message || 'Unknown error'}`);
        body.classList.remove('user-idle', 'hud-minimized');
        clearTimeout(idleTimer);

        if (err.isCancellation) {
          errorTitle.textContent = 'Screen Selection Cancelled';
          errorMessage.textContent = 'You cancelled screen sharing. Click "Try Again" and make sure to select your Windows screen.';
        } else {
          errorTitle.textContent = 'Unable to Share Screen';
          errorMessage.textContent = err.message || 'An unexpected error occurred while starting screen capture.';
        }

        if (btnRetry) {
          btnRetry.focus();
        }
      }

      // Sync Fullscreen icon state
      const isFullscreen = payload.isFullscreen;
      if (iconEnterFullscreen && iconExitFullscreen) {
        if (isFullscreen) {
          iconEnterFullscreen.classList.add('hidden');
          iconExitFullscreen.classList.remove('hidden');
          btnToggleFullscreen.setAttribute('title', 'Exit Fullscreen (Key: F or Esc)');
        } else {
          iconEnterFullscreen.classList.remove('hidden');
          iconExitFullscreen.classList.add('hidden');
          btnToggleFullscreen.setAttribute('title', 'Enter Fullscreen (Key: F)');
        }
      }
    }
  });

  // Event Listeners for Actions
  if (btnShareScreen) {
    btnShareScreen.addEventListener('click', () => {
      controller.startSharing();
    });
  }

  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      controller.startSharing();
    });
  }

  if (btnStopSharing) {
    btnStopSharing.addEventListener('click', () => {
      controller.stopSharing();
    });
  }

  if (btnToggleFullscreen) {
    btnToggleFullscreen.addEventListener('click', () => {
      controller.toggleFullscreen();
    });
  }

  if (btnToggleEye) {
    btnToggleEye.addEventListener('click', () => {
      toggleHudVisibility(true);
    });
  }

  if (btnRevealEye) {
    btnRevealEye.addEventListener('click', () => {
      toggleHudVisibility(false);
    });
  }

  // Draggable HUD controls implementation
  const hudControls = document.getElementById('hudControls');
  const hudDragHandle = document.getElementById('hudDragHandle');
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  function onPointerDown(e) {
    // Only drag from handle or empty area, not on buttons
    if (e.target.closest('button')) return;

    isDragging = true;
    hudControls.classList.add('is-dragging');
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = hudControls.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    // Reset default CSS positioning
    hudControls.style.bottom = 'auto';
    hudControls.style.right = 'auto';
    hudControls.style.transform = 'none';
    hudControls.style.left = `${initialLeft}px`;
    hudControls.style.top = `${initialTop}px`;

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    const maxLeft = window.innerWidth - hudControls.offsetWidth - 8;
    const maxTop = window.innerHeight - hudControls.offsetHeight - 8;

    const newLeft = Math.max(8, Math.min(maxLeft, initialLeft + dx));
    const newTop = Math.max(8, Math.min(maxTop, initialTop + dy));

    hudControls.style.left = `${newLeft}px`;
    hudControls.style.top = `${newTop}px`;
    resetUserIdleTimer();
  }

  function onPointerUp() {
    isDragging = false;
    hudControls.classList.remove('is-dragging');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }

  if (hudDragHandle) {
    hudDragHandle.addEventListener('pointerdown', onPointerDown);
  }
  if (hudControls) {
    hudControls.addEventListener('pointerdown', onPointerDown);
  }

  // Mouse & touch activity tracking for HUD auto-hiding
  window.addEventListener('mousemove', resetUserIdleTimer);
  window.addEventListener('mousedown', resetUserIdleTimer);
  window.addEventListener('touchstart', resetUserIdleTimer);

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    const key = e.key.toLowerCase();

    if (body.classList.contains('state-viewing')) {
      // 'f' toggles fullscreen
      if (key === 'f') {
        e.preventDefault();
        controller.toggleFullscreen();
        resetUserIdleTimer();
      }
      // 's' stops sharing
      else if (key === 's') {
        e.preventDefault();
        controller.stopSharing();
      }
      // 'h' toggles controls visibility
      else if (key === 'h') {
        e.preventDefault();
        toggleHudVisibility();
      }
    } else if (body.classList.contains('state-idle')) {
      // Space on idle starts sharing
      if (key === ' ' && document.activeElement !== btnShareScreen) {
        e.preventDefault();
        controller.startSharing();
      }
    }
  });

  // Server heartbeat & auto-shutdown on tab close
  if (window.location.protocol.startsWith('http')) {
    // Send heartbeat every 2 seconds
    const heartbeatInterval = setInterval(() => {
      fetch('/api/heartbeat', { method: 'GET', cache: 'no-store' }).catch(() => {});
    }, 2000);

    // Initial heartbeat
    fetch('/api/heartbeat', { method: 'GET', cache: 'no-store' }).catch(() => {});

    // Notify server immediately on close/unload
    const handleUnload = () => {
      clearInterval(heartbeatInterval);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/disconnect');
      } else {
        fetch('/api/disconnect', { method: 'GET', keepalive: true }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
  }

  // Clean up on beforeunload
  window.addEventListener('beforeunload', () => {
    controller.destroy();
  });
});
