(function () {
  "use strict";

  const Log = window.LabFlowLogger?.child("state") || {debug(){},info(){},warn(){},error(){}};
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  let settings = {};
  let projects;
  const reports = new Map();
  let assistantMessages = [];

  window.LabFlowState = {
    getSettings: (fallback = {}) => ({ ...clone(fallback), ...clone(settings) }),
    saveSettings(value) { settings = clone(value); Log.debug("settings.saved", { keys: Object.keys(value || {}) }); return true; },
    getProjects(fallback) {
      if (projects === undefined) projects = clone(fallback);
      return clone(projects);
    },
    saveProjects(value) { projects = clone(value); Log.debug("projects.saved", { count: value?.length || 0 }); return true; },
    getReport(projectId, fallback = {}) {
      return { ...clone(fallback), ...clone(reports.get(projectId) || {}) };
    },
    saveReport(projectId, value) { reports.set(projectId, clone(value)); Log.debug("report.saved", { projectId, sections: value?.sections?.length || 0 }); return true; },
    getAssistantMessages: () => clone(assistantMessages),
    saveAssistantMessages(value) { assistantMessages = clone(value.slice(-20)); Log.debug("assistant.saved", { count: assistantMessages.length }); return true; },
    reset() {
      settings = {};
      projects = undefined;
      reports.clear();
      assistantMessages = [];
      Log.info("state.reset");
    }
  };
})();
