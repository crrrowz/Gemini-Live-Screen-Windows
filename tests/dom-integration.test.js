import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('DOM & CSS Layout Quality Tests', () => {
  test('viewer.html contains all required semantic containers and accessibility hooks', () => {
    const html = fs.readFileSync(path.resolve('viewer/viewer.html'), 'utf8');

    // Key elements must exist
    assert.ok(html.includes('id="viewerContainer"'), 'Must have #viewerContainer');
    assert.ok(html.includes('id="screenVideo"'), 'Must have #screenVideo');
    assert.ok(html.includes('id="heroCard"'), 'Must have #heroCard');
    assert.ok(html.includes('id="btnShareScreen"'), 'Must have #btnShareScreen');
    assert.ok(html.includes('id="errorCard"'), 'Must have #errorCard');
    assert.ok(html.includes('id="btnRetry"'), 'Must have #btnRetry');
    assert.ok(html.includes('id="hudControls"'), 'Must have #hudControls');
    assert.ok(html.includes('id="btnToggleFullscreen"'), 'Must have #btnToggleFullscreen');
    assert.ok(html.includes('id="btnStopSharing"'), 'Must have #btnStopSharing');
    assert.ok(html.includes('id="srAnnouncer"'), 'Must have #srAnnouncer for ARIA screen reader announcements');

    // Video tag attributes
    assert.ok(html.includes('autoplay'), 'video tag must have autoplay');
    assert.ok(html.includes('playsinline'), 'video tag must have playsinline');
    assert.ok(html.includes('muted'), 'video tag must have muted');
  });

  test('viewer.css enforces object-fit: contain and hardware acceleration (INV-04)', () => {
    const css = fs.readFileSync(path.resolve('viewer/viewer.css'), 'utf8');

    // Non-destructive aspect ratio invariant
    assert.ok(css.includes('object-fit: contain'), 'Must enforce object-fit: contain to preserve aspect ratio');
    assert.ok(css.includes('transform: translateZ(0)'), 'Must enable hardware-accelerated composition');
    assert.ok(css.includes('--bg-stage: #000000'), 'Must use pure black stage backdrop for letterboxing');
  });

  test('viewer.css implements auto-dimming HUD and minimized controls', () => {
    const css = fs.readFileSync(path.resolve('viewer/viewer.css'), 'utf8');

    assert.ok(css.includes('body.state-viewing.user-idle'), 'Must define user-idle style rules');
    assert.ok(css.includes('.hud-reveal-pill'), 'Must define floating reveal pill for minimized state');
  });
});
