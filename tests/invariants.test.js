import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Zero Recording, Zero Audio & Privacy Invariant Audits', () => {
  const codeFiles = [
    'background/service-worker.js',
    'viewer/viewer-controller.js',
    'viewer/viewer.js'
  ];

  test('no MediaRecorder API usage in any source file (INV-02)', () => {
    for (const relPath of codeFiles) {
      const fullPath = path.resolve(relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.strictEqual(
        content.includes('MediaRecorder'),
        false,
        `Found forbidden MediaRecorder reference in ${relPath}`
      );
    }
  });

  test('no audio capture or microphone permissions requested (INV-01)', () => {
    const controllerContent = fs.readFileSync(path.resolve('viewer/viewer-controller.js'), 'utf8');
    assert.ok(
      controllerContent.includes('audio: false'),
      'viewer-controller.js must explicitly specify audio: false'
    );
    assert.strictEqual(
      controllerContent.includes('audio: true'),
      false,
      'audio: true is strictly prohibited'
    );
  });

  test('no external network requests or analytics telemetry', () => {
    for (const relPath of codeFiles) {
      const fullPath = path.resolve(relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.strictEqual(content.includes('XMLHttpRequest'), false, `Found unexpected XMLHttpRequest in ${relPath}`);
      assert.strictEqual(content.includes('WebSocket'), false, `Found unexpected WebSocket in ${relPath}`);
      assert.strictEqual(content.includes('google-analytics'), false, `Found analytics reference in ${relPath}`);
      assert.strictEqual(content.includes('https://'), false, `Found unexpected remote HTTPS URL in ${relPath}`);
    }
  });

  test('no canvas frame grab / captureStream used for offscreen frame recording', () => {
    for (const relPath of codeFiles) {
      const fullPath = path.resolve(relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.strictEqual(content.includes('toDataURL'), false, `Found toDataURL in ${relPath}`);
      assert.strictEqual(content.includes('getImageData'), false, `Found getImageData in ${relPath}`);
      assert.strictEqual(content.includes('captureStream'), false, `Found captureStream in ${relPath}`);
    }
  });
});
