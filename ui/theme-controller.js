(function () {
  "use strict";

  const allowed = {
    theme: ["dark", "light"],
    palette: ["blue", "green", "violet", "red", "teal", "amber", "cyan", "rose"],
    density: ["compact", "comfortable"]
  };
  const defaults = { theme: "light", palette: "blue", density: "compact" };

  function normalize(name, value) {
    return allowed[name].includes(value) ? value : defaults[name];
  }

  window.LabFlowTheme = {
    allowed,
    defaults,
    apply(values = {}) {
      const root = document.documentElement;
      Object.keys(defaults).forEach((name) => {
        root.dataset[name] = normalize(name, values[name] || root.dataset[name]);
      });
      return this.current();
    },
    current() {
      const root = document.documentElement;
      return Object.fromEntries(Object.keys(defaults).map((name) => [name, normalize(name, root.dataset[name])]));
    }
  };

  // Apply carried appearance before the stylesheet is evaluated. This keeps
  // cross-page navigation on a single paint and avoids a light-theme flash.
  const query = new URLSearchParams(window.location.search);
  window.LabFlowTheme.apply({
    theme: query.get("lf_theme") || document.documentElement.dataset.theme,
    palette: query.get("lf_palette") || document.documentElement.dataset.palette,
    density: query.get("lf_density") || document.documentElement.dataset.density
  });
})();
