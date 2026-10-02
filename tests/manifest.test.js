import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Manifest V3 Compliance & Least Privilege Test', () => {
  const manifestPath = path.resolve('manifest.json');

  test('manifest.json exists and is valid JSON', () => {
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(content);
    assert.strictEqual(manifest.manifest_version, 3, 'Must be Manifest V3');
    assert.strictEqual(manifest.name, 'Gemini Live Screen for Windows');
    assert.ok(manifest.version, 'Must have a version');
  });

  test('manifest permissions specify desktopCapture for continuous OS stream', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.ok(Array.isArray(manifest.permissions), 'permissions must be an array');
    assert.ok(manifest.permissions.includes('desktopCapture'), 'permissions must include desktopCapture');
  });

  test('manifest specifies background service worker as module', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.ok(manifest.background, 'background field must be present');
    assert.strictEqual(manifest.background.service_worker, 'background/service-worker.js');
    assert.strictEqual(manifest.background.type, 'module');
    assert.ok(fs.existsSync(path.resolve(manifest.background.service_worker)), 'service worker file must exist');
  });

  test('manifest icon files exist across all required resolutions', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const iconResolutions = ['16', '32', '48', '128'];
    for (const res of iconResolutions) {
      assert.ok(manifest.icons && manifest.icons[res], `icons.${res} must be defined`);
      const iconPath = path.resolve(manifest.icons[res]);
      assert.ok(fs.existsSync(iconPath), `Icon file ${manifest.icons[res]} must exist`);
      const stat = fs.statSync(iconPath);
      assert.ok(stat.size > 50, `Icon file ${manifest.icons[res]} must not be empty`);
    }
  });

  test('viewer files exist and are referenced properly', () => {
    assert.ok(fs.existsSync(path.resolve('viewer/viewer.html')), 'viewer.html must exist');
    assert.ok(fs.existsSync(path.resolve('viewer/viewer.css')), 'viewer.css must exist');
    assert.ok(fs.existsSync(path.resolve('viewer/viewer.js')), 'viewer.js must exist');
    assert.ok(fs.existsSync(path.resolve('viewer/viewer-controller.js')), 'viewer-controller.js must exist');
  });
});
