/*
 * Theme selection, persistence and document-level theme application.
 * Boundary: Theme is a UI preference and must not affect scientific behavior.
 */
(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const THEMES = ['instrument', 'light'];


  function normalize(theme) {
    return THEMES.includes(theme) ? theme : 'instrument';
  }


  function current() {
    const settings = LF.Storage && LF.Storage.getUiSettings ? LF.Storage.getUiSettings() : {};
    return normalize(settings.theme);
  }


  function apply(theme, persist) {
    const next = normalize(theme);
    document.documentElement.dataset.theme = next;

    document.documentElement.style.colorScheme = 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === 'light' ? '#f8faf9' : '#0b141d';
    if (persist !== false && LF.Storage && LF.Storage.saveUiSettings) {
      LF.Storage.saveUiSettings({theme:next});
    }
    syncControls(next);
    return next;
  }


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


  function toggle() {
    return apply(current() === 'light' ? 'instrument' : 'light');
  }


  window.addEventListener('storage', function (event) {
    if (!event.key || event.key.indexOf('ui') !== -1) apply(current(), false);
  });


  LF.Theme = {apply:apply, current:current, toggle:toggle, syncControls:syncControls, themes:THEMES.slice()};
}());
