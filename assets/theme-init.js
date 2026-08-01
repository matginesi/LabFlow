/**
 * LabFlow early appearance bootstrap
 * ==================================
 * Runs synchronously in <head> before CSS is painted so every page starts with
 * the same theme/palette and avoids a light-theme flash. This file contains no
 * scientific state and is safe to use on every static route.
 */
(() => {
  'use strict';
  const palettes = ['blue', 'red', 'green', 'violet'];
  try {
    const admin = JSON.parse(localStorage.getItem('labflow-admin-appearance') || '{}');
    const savedPalette = localStorage.getItem('labflow-palette');
    document.documentElement.dataset.theme = localStorage.getItem('labflow-theme') || 'light';
    document.documentElement.dataset.palette = admin.force_palette && palettes.includes(admin.default_palette)
      ? admin.default_palette
      : palettes.includes(savedPalette)
        ? savedPalette
        : palettes.includes(admin.default_palette)
          ? admin.default_palette
          : 'blue';
  } catch (_) {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dataset.palette = 'blue';
  }
})();
