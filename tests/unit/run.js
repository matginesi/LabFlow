'use strict';
global.window = globalThis; // classic IIFEs attach window.LabFlow
const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');
const root = path.resolve(__dirname, '..', '..');
// Minimal in-memory storage so browser modules can load under Node.
global.localStorage = (function () {
  let store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
    clear: function () { store = {}; },
    key: function (i) { return Object.keys(store)[i] || null; },
    get length() { return Object.keys(store).length; }
  };
})();
global.LabFlow = globalThis.LabFlow = globalThis.LabFlow || {};
global.LabFlow.Core = global.LabFlow.Core || {
  uid: (function () {
    let n = 0;
    return function (prefix) { return (prefix || 'x') + '_' + (++n); };
  })(),
  escapeHtml: function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },
  safeJson: function (value, space) {
    return JSON.stringify(value, function (key, v) {
      if (v instanceof ArrayBuffer) return undefined;
      if (ArrayBuffer.isView(v)) return Array.from(v);
      return v;
    }, space == null ? 2 : space);
  }
};
// JSZip is vendored for the browser; when runnable under Node it is exported as a module.
try {
  global.window.JSZip = global.window.JSZip || require(path.join(root, 'vendor', 'jszip', 'jszip.min.js'));
} catch (_err) {
  global.window.JSZip = global.window.JSZip || null;
}

/** Run suites serially so Promise-returning tests cannot finish after success. */
async function main() {
  let files = process.argv.slice(2);
  if (!files.length) {
    files = fs.readdirSync(__dirname).filter(function (name) { return /-test\.js$/.test(name); }).sort().map(function (name) { return path.relative(process.cwd(), path.join(__dirname, name)); });
  }
  /* Every suite mutates the classic-script namespace by design. Run multiple
     requested files in isolated Node processes so one suite cannot leak its
     stubs into the next suite. */
  if (files.length > 1) {
    let failedSuites = 0;
    files.forEach(function (file) {
      const child = childProcess.spawnSync(process.execPath, [__filename, file], { cwd: process.cwd(), encoding: 'utf8' });
      process.stdout.write(child.stdout || '');
      process.stderr.write(child.stderr || '');
      if (child.status !== 0) failedSuites++;
    });
    process.exitCode = failedSuites ? 1 : 0;
    return;
  }
  let passed = 0, failed = 0;
  for (const f of files) {
    const suite = {};
    const mod = require(path.resolve(process.cwd(), f));
    mod(suite, global.LabFlow, { root: root });
    for (const name of Object.keys(suite)) {
      try {
        await Promise.resolve(suite[name]());
        passed++;
        process.stdout.write('  ok  ' + path.basename(f) + ' > ' + name + '\n');
      } catch (err) {
        failed++;
        process.stdout.write('FAIL  ' + path.basename(f) + ' > ' + name + '\n      ' + String(err && err.message || err) + '\n');
      }
    }
  }
  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exitCode = failed ? 1 : 0;
}

main().catch(function (error) {
  process.stderr.write(String(error && error.stack || error) + '\n');
  process.exitCode = 1;
});
