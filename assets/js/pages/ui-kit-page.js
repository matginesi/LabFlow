(function () {
  'use strict';

  /**
   * Standalone UI Kit page controller.
   *
   * This module owns only pattern search/filtering and standalone theme controls.
   * The application shell remains responsible for global navigation and forwards
   * filter state through postMessage while the catalog is hosted in its iframe.
   */
  const LF = window.LabFlow = window.LabFlow || {};

  /** Normalize a catalog family without assuming that every caller is valid. */
  function normalizeFilter(value) {
    return String(value || 'all').trim() || 'all';
  }

  /** Normalize search text once so matching remains case-insensitive. */
  function normalizeQuery(value) {
    return String(value || '').trim().toLowerCase();
  }

  /**
   * Bind the pattern catalog and return its small imperative API.
   * @returns {{apply:Function,setQuery:Function,setFilter:Function}}
   */
  function bindPatternBrowser() {
    const search = document.getElementById('uiKitSearch');
    const select = document.getElementById('uiKitFilterSelect');
    const count = document.getElementById('uiKitResultCount');
    const sections = Array.from(document.querySelectorAll('[data-ui-kit-group]'));
    const buttons = Array.from(document.querySelectorAll('[data-ui-kit-filter]'));
    let activeFilter = 'all';

    /** Keep every local representation of the active family in sync. */
    function syncControls() {
      buttons.forEach(function (button) {
        const selected = button.dataset.uiKitFilter === activeFilter;
        button.classList.toggle('primary', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      if (select) select.value = activeFilter;
    }

    /** Tell the host shell how many catalog groups remain visible. */
    function reportVisibleCount(visibleCount) {
      if (window.self === window.top) return;
      // `*` is required for direct file:// use, where the origin is opaque. The
      // message contains only an integer; incoming commands are limited to parent.
      window.parent.postMessage({type:'labflow-ui-kit-count', count:visibleCount}, '*');
    }

    /** Apply family and text filters without changing application routing. */
    function apply() {
      const query = normalizeQuery(search && search.value);
      let visibleCount = 0;

      sections.forEach(function (section) {
        const matchesFamily = activeFilter === 'all' || section.dataset.uiKitGroup === activeFilter;
        const matchesText = !query || section.textContent.toLowerCase().includes(query);
        section.hidden = !(matchesFamily && matchesText);
        if (!section.hidden) visibleCount += 1;
      });

      syncControls();
      if (count) count.textContent = visibleCount + ' pattern' + (visibleCount === 1 ? '' : 's');
      reportVisibleCount(visibleCount);
    }

    /** Set search text programmatically, then repaint the catalog. */
    function setQuery(value) {
      if (search) search.value = String(value || '');
      apply();
    }

    /** Set the active component family programmatically, then repaint. */
    function setFilter(value) {
      activeFilter = normalizeFilter(value);
      apply();
    }

    document.addEventListener('click', function (event) {
      const filterButton = event.target.closest('[data-ui-kit-filter]');
      if (!filterButton) return;
      setFilter(filterButton.dataset.uiKitFilter);
    });
    if (search) search.addEventListener('input', apply);
    if (select) {
      select.addEventListener('change', function () {
        setFilter(select.value);
      });
    }

    window.addEventListener('message', function (event) {
      if (window.self === window.top || event.source !== window.parent) return;
      if (!event.data || event.data.type !== 'labflow-ui-kit-filter') return;
      activeFilter = normalizeFilter(event.data.filter);
      if (search) search.value = String(event.data.query || '');
      apply();
    });

    apply();
    return {apply:apply, setQuery:setQuery, setFilter:setFilter};
  }

  /** Initialize the directly-openable page after all static markup is available. */
  function init() {
    // When embedded, the app already owns navigation and topbar. CSS uses this
    // state to hide only duplicate chrome, never the documented components.
    if (window.self !== window.top) document.body.classList.add('is-embedded');

    LF.Theme.apply(LF.Theme.current(), false);
    LF.Core.bindFieldLabels(document);
    LF.UIKit = bindPatternBrowser();

    document.addEventListener('click', function (event) {
      const toggle = event.target.closest('[data-theme-toggle]');
      if (toggle) {
        LF.Theme.toggle();
        return;
      }
      const choice = event.target.closest('[data-theme-choice]');
      if (choice) LF.Theme.apply(choice.dataset.themeChoice);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
}());
