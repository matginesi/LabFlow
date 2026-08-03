(function () {
  "use strict";

  const Log = window.LabFlowLogger?.child("state") || {debug(){},info(){},warn(){},error(){}};
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  let settings = {};
  let projects;
  let currentUser;
  let workspaceUsers;
  const reports = new Map();
  let assistantMessages = [];

  window.LabFlowState = {
    getSettings: (fallback = {}) => ({ ...clone(fallback), ...clone(settings) }),
    saveSettings(value) { settings = clone(value); Log.debug("settings.saved", { keys: Object.keys(value || {}) }); return true; },
    getUser(fallback = {}) {
      if (currentUser === undefined) currentUser = clone(fallback);
      return clone(currentUser);
    },
    saveUser(value) { currentUser = clone(value); Log.debug("user.saved", { id: value?.id, role: value?.role }); return true; },
    getUsers(fallback = []) {
      if (workspaceUsers === undefined) workspaceUsers = clone(fallback);
      return clone(workspaceUsers);
    },
    saveUsers(value) { workspaceUsers = clone(value); Log.debug("users.saved", { count: value?.length || 0 }); return true; },
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
      currentUser = undefined;
      workspaceUsers = undefined;
      reports.clear();
      assistantMessages = [];
      Log.info("state.reset");
    }
  };
})();
