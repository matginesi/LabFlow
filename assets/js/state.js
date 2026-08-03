(function () {
  "use strict";

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  let settings = {};
  let projects;
  const reports = new Map();
  let assistantMessages = [];

  window.LabFlowState = {
    getSettings: (fallback = {}) => ({ ...clone(fallback), ...clone(settings) }),
    saveSettings(value) { settings = clone(value); return true; },
    getProjects(fallback) {
      if (projects === undefined) projects = clone(fallback);
      return clone(projects);
    },
    saveProjects(value) { projects = clone(value); return true; },
    getReport(projectId, fallback = {}) {
      return { ...clone(fallback), ...clone(reports.get(projectId) || {}) };
    },
    saveReport(projectId, value) { reports.set(projectId, clone(value)); return true; },
    getAssistantMessages: () => clone(assistantMessages),
    saveAssistantMessages(value) { assistantMessages = clone(value.slice(-20)); return true; },
    reset() {
      settings = {};
      projects = undefined;
      reports.clear();
      assistantMessages = [];
    }
  };
})();
