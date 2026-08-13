(function () {
  'use strict';

  /**
   * Cross-route theme service. This module owns theme persistence and token
   * application only; component styling remains in shared CSS.
   */
  const LF = window.LabFlow = window.LabFlow || {};
  const THEMES = ['instrument', 'light'];

  /** Return a supported theme, preserving the established hybrid instrument theme by default. */
  function normalize(theme) {
    return THEMES.includes(theme) ? theme : 'instrument';
  }

  /** Return the normalized theme stored in local UI settings. */
  function current() {
    const settings = LF.Storage && LF.Storage.getUiSettings ? LF.Storage.getUiSettings() : {};
    return normalize(settings.theme);
  }

  /** Apply theme tokens to both the app and native browser controls. */
  function apply(theme, persist) {
    const next = normalize(theme);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'light' ? 'light' : 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === 'light' ? '#f7f9fc' : '#0b141d';
    if (persist !== false && LF.Storage && LF.Storage.saveUiSettings) {
      LF.Storage.saveUiSettings({theme:next});
    }
    syncControls(next);
    return next;
  }

  /** Synchronize every theme control currently mounted in the document. */
  function syncControls(theme) {
    document.querySelectorAll('[data-theme-choice]').forEach(function (button) {
      const selected = button.dataset.themeChoice === theme;
      button.classList.toggle('primary', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      const label = theme === 'light' ? 'Dark theme' : 'Light theme';
      const icon = theme === 'light' ? 'moon' : 'sun';
      button.classList.add('button-with-icon');
      button.innerHTML = (LF.Icons ? LF.Icons.icon(icon) : '') + '<span>' + label + '</span>';
      button.setAttribute('aria-label', label);
    });
  }

  /** Toggle between the two supported themes and persist the result. */
  function toggle() {
    return apply(current() === 'light' ? 'instrument' : 'light');
  }

  // Synchronize separate same-origin documents, including the embedded UI Kit.
  window.addEventListener('storage', function (event) {
    if (!event.key || event.key.indexOf('ui') !== -1) apply(current(), false);
  });

  // Export a copy of the theme inventory so callers cannot mutate the invariant.
  LF.Theme = {apply:apply, current:current, toggle:toggle, syncControls:syncControls, themes:THEMES.slice()};
}());
