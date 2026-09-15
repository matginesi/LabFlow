/*
 * Render the in-application UI Kit reference and live component examples.
 * Boundary: Examples demonstrate shared primitives and must not become production feature logic.
 */
(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};


  function normalizeFilter(value) {
    return String(value || 'all').trim() || 'all';
  }


  function normalizeQuery(value) {
    return String(value || '').trim().toLowerCase();
  }

  function bindPatternBrowser() {
    const search = document.getElementById('uiKitSearch');
    const select = document.getElementById('uiKitFilterSelect');
    const count = document.getElementById('uiKitResultCount');
    const sections = Array.from(document.querySelectorAll('[data-ui-kit-group]'));
    const buttons = Array.from(document.querySelectorAll('[data-ui-kit-filter]'));
    let activeFilter = 'all';


    function syncControls() {
      buttons.forEach(function (button) {
        const selected = button.dataset.uiKitFilter === activeFilter;
        button.classList.toggle('primary', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      if (select) select.value = activeFilter;
    }


    function reportVisibleCount(visibleCount) {
      if (window.self === window.top) return;


      window.parent.postMessage({type:'labflow-ui-kit-count', count:visibleCount}, '*');
    }


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


    function setQuery(value) {
      if (search) search.value = String(value || '');
      apply();
    }


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


  function init() {


    if (window.self !== window.top) document.body.classList.add('is-embedded');

    LF.Theme.apply(LF.Theme.current(), false);
    LF.Core.bindFieldLabels(document);
    LF.UIKit = bindPatternBrowser();

    document.addEventListener('click', function (event) {
      if(window.self!==window.top){const appLink=event.target.closest('a[href="index.html"]');if(appLink){event.preventDefault();window.parent.postMessage({type:'labflow-ui-kit-route',route:'experiment-import'},'*');return;}}
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
