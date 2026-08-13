(function () {
  'use strict';

  /**
   * Small vendored subset of Lucide Icons (ISC), kept as local path data so
   * icons work from file:// without a package manager, font, CDN or request.
   * Source and license: vendor/lucide/README.md and vendor/lucide/LICENSE.
   */
  const LF = window.LabFlow = window.LabFlow || {};
  const PATHS = {
    'flask-conical':'<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
    'settings-2':'<path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
    'scroll-text':'<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
    'panels-top-left':'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
    'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    'moon':'<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
    'message-square':'<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>',
    'upload':'<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    'x':'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'download':'<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    'search':'<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
    'check':'<path d="M20 6 9 17l-5-5"/>',
    'triangle-alert':'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'info':'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'file-text':'<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    'notebook-text':'<path d="M2 6h4M2 10h4M2 14h4M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9.5 8h5M9.5 12H16M9.5 16H14"/>',
    'chevron-right':'<path d="m9 18 6-6-6-6"/>',
    'arrow-up':'<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    'arrow-down':'<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    'trash-2':'<path d="M10 11v6M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
  };

  /** Return trusted inline SVG markup for one known local Lucide icon. */
  function icon(name, className) {
    if (!Object.prototype.hasOwnProperty.call(PATHS, name)) return '';
    const classes = 'icon' + (className ? ' ' + String(className).replace(/[^a-zA-Z0-9 _-]/g, '') : '');
    return '<svg class="' + classes + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + PATHS[name] + '</svg>';
  }

  /** Hydrate static data-icon placeholders without network access. */
  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (host) {
      const markup = icon(host.dataset.icon, host.dataset.iconClass || '');
      if (markup) host.innerHTML = markup;
    });
  }

  LF.Icons = {icon:icon, hydrate:hydrate, names:function(){return Object.keys(PATHS);}};
  document.addEventListener('DOMContentLoaded', function () { hydrate(document); });
}());
