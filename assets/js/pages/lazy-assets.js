/*
 * Load optional local assets needed only by specific routes or features.
 * Boundary: Optional assets may fail gracefully; required architecture modules are not lazy fallbacks.
 */
(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};
  const pending = Object.create(null);
  const errors = Object.create(null);

  function scriptUrl(path) {
    const build = String(window.LABFLOW_BUILD || '').trim();
    return path + (build ? '?v=' + encodeURIComponent(build) : '');
  }

  function load(name, path, ready) {
    if (ready()) return Promise.resolve(true);
    if (pending[name]) return pending[name];
    errors[name] = null;
    pending[name] = new Promise(function (resolve, reject) {
      const node = document.createElement('script');
      node.src = scriptUrl(path);
      node.async = true;
      node.dataset.labflowLazyAsset = name;
      node.onload = function () {
        if (!ready()) {
          const err = new Error('Loaded ' + path + ' but the expected LabFlow asset did not register.');
          errors[name] = err;
          reject(err);
          return;
        }
        resolve(true);
      };
      node.onerror = function () {
        const err = new Error('Could not load ' + path + '.');
        errors[name] = err;
        reject(err);
      };
      document.head.appendChild(node);
    }).finally(function () {
      delete pending[name];
    });
    return pending[name];
  }

  function ensureDocs() {
    return load('docs', 'assets/js/pages/docs-bundle.js', function () {
      return !!(LF.DocsBundle && Array.isArray(LF.DocsBundle.documents));
    });
  }

  function ensureUiKit() {
    return load('ui-kit', 'assets/js/pages/ui-kit-inline.js', function () {
      return !!(LF.UIKitInline && typeof LF.UIKitInline.render === 'function');
    });
  }

  function status(name) {
    const ready = name === 'docs'
      ? !!(LF.DocsBundle && Array.isArray(LF.DocsBundle.documents))
      : name === 'ui-kit'
        ? !!(LF.UIKitInline && typeof LF.UIKitInline.render === 'function')
        : false;
    return { ready: ready, loading: !!pending[name], error: errors[name] || null };
  }

  LF.LazyAssets = { ensureDocs: ensureDocs, ensureUiKit: ensureUiKit, status: status };
}());
