(function () {
  "use strict";

  if (!window.LabFlowLogger) {
    const startedAt = performance.now();
    const levels = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
    const query = new URLSearchParams(window.location.search);
    let minimumLevel = query.get("lf_debug") === "1" ? "debug" : "info";
    const entries = [];
    const maximumEntries = 400;
    const sensitiveKey = /(api[-_]?key|authorization|credential|password|secret|token|cookie|session|nomad[-_]?key)/i;

    function sanitize(value, depth = 0, seen = new WeakSet()) {
      if (value == null || typeof value === "number" || typeof value === "boolean") return value;
      if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
      if (value instanceof Error) return { name: value.name, message: value.message, stack: String(value.stack || "").split("\n").slice(0, 12).join("\n") };
      if (typeof value !== "object") return String(value);
      if (depth >= 4) return "[depth-limit]";
      if (seen.has(value)) return "[circular]";
      seen.add(value);
      if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitize(item, depth + 1, seen));
      const output = {};
      Object.entries(value).slice(0, 50).forEach(([key, item]) => {
        output[key] = sensitiveKey.test(key) ? "[redacted]" : sanitize(item, depth + 1, seen);
      });
      return output;
    }

    function write(level, scope, event, context) {
      if (levels[level] < levels[minimumLevel]) return;
      const entry = {
        timestamp: new Date().toISOString(),
        elapsedMs: Math.round((performance.now() - startedAt) * 10) / 10,
        level,
        scope: scope || "app",
        event: String(event || "event"),
        page: document.body?.dataset?.page || null,
        path: window.location.pathname.split("/").pop() || "index.html",
        context: sanitize(context)
      };
      entries.push(entry);
      if (entries.length > maximumEntries) entries.splice(0, entries.length - maximumEntries);
      const method = level === "debug" ? "debug" : level === "warn" ? "warn" : level === "error" ? "error" : "info";
      const prefix = `[LabFlow][${level.toUpperCase()}][${entry.scope}] ${entry.event}`;
      if (entry.context === undefined) console[method](prefix);
      else console[method](prefix, entry.context);
    }

    function child(scope) {
      return Object.freeze({
        debug: (event, context) => write("debug", scope, event, context),
        info: (event, context) => write("info", scope, event, context),
        warn: (event, context) => write("warn", scope, event, context),
        error: (event, context) => write("error", scope, event, context),
        time(label, context) {
          const start = performance.now();
          return (result) => write("info", scope, `${label}.complete`, { ...sanitize(context), durationMs: Math.round((performance.now() - start) * 10) / 10, result: sanitize(result) });
        }
      });
    }

    const logger = Object.freeze({
      levels,
      child,
      debug: (event, context) => write("debug", "app", event, context),
      info: (event, context) => write("info", "app", event, context),
      warn: (event, context) => write("warn", "app", event, context),
      error: (event, context) => write("error", "app", event, context),
      setLevel(level) { if (levels[level]) minimumLevel = level; return minimumLevel; },
      getLevel: () => minimumLevel,
      snapshot: () => entries.map((entry) => ({ ...entry })),
      clear: () => { entries.length = 0; },
      sanitize
    });

    window.LabFlowLogger = logger;
    window.LabFlowLog = logger;

    window.addEventListener("error", (event) => {
      if (event.target && event.target !== window) {
        const rawSource = event.target.src || event.target.href || "unknown";
        logger.error("resource.load.failed", { tag: event.target.tagName, source: String(rawSource).split(/[?#]/)[0].split("/").pop() || "unknown" });
        return;
      }
      logger.error("javascript.uncaught", { message: event.message, source: event.filename?.split("/").pop(), line: event.lineno, column: event.colno, error: event.error });
    }, true);

    window.addEventListener("unhandledrejection", (event) => {
      logger.error("promise.unhandled", { reason: event.reason instanceof Error ? event.reason : String(event.reason) });
    });

    document.addEventListener("DOMContentLoaded", () => logger.info("lifecycle.dom-ready", { readyState: document.readyState }));
    window.addEventListener("load", () => {
      const navigation = performance.getEntriesByType?.("navigation")?.[0];
      logger.info("lifecycle.window-load", navigation ? {
        type: navigation.type,
        domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
        loadMs: Math.round(navigation.loadEventEnd),
        transferredBytes: navigation.transferSize || 0
      } : { readyState: document.readyState });
    }, { once: true });

    logger.info("logger.ready", { level: minimumLevel, persistent: false, remote: false });
  }
})();

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
      const current = this.current();
      window.LabFlowLogger?.child("theme").debug("appearance.applied", current);
      return current;
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
