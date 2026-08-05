(function () {
  "use strict";

  const D = window.LabFlowData || {};
  const asArray = (value) => Array.isArray(value) ? value : [];
  const rawFoundation = D.aiFoundation && typeof D.aiFoundation === "object" ? D.aiFoundation : {};
  const F = {
    ...rawFoundation,
    readiness: {
      overall: Number(rawFoundation.readiness?.overall) || 0,
      status: rawFoundation.readiness?.status || "Not assessed",
      updated: rawFoundation.readiness?.updated || "—",
      metrics: asArray(rawFoundation.readiness?.metrics),
      blocking: asArray(rawFoundation.readiness?.blocking)
    },
    datasetSnapshots: asArray(rawFoundation.datasetSnapshots),
    models: asArray(rawFoundation.models),
    predictions: asArray(rawFoundation.predictions),
    trainingRuns: asArray(rawFoundation.trainingRuns),
    outputTypes: asArray(rawFoundation.outputTypes)
  };
  const A = window.LabFlowDataSource;
  const C = window.LabFlowConfig || {};
  const P = window.LabFlowPipelines;
  const R = window.LabFlowPipelineRuntime;
  const E = window.LabFlowExport;
  const S = window.LabFlowState;
  const T = window.LabFlowTheme;
  const DOCS = window.LabFlowDocs || [];
  const Log = window.LabFlowLogger?.child("app") || {debug(){},info(){},warn(){},error(){},time(){return () => {};}};

  function nestedValue(value, path, fallback = undefined) {
    const keys = Array.isArray(path) ? path : String(path || "").split(".").filter(Boolean);
    let current = value;
    for (const key of keys) {
      if (current == null || typeof current !== "object" || !(key in current)) return fallback;
      current = current[key];
    }
    return current == null ? fallback : current;
  }

  function pipelineResource(pipeline, group, key, fallback = {}) {
    return nestedValue(pipeline, ["resources", group, key], fallback);
  }

  function pipelineStep(pipeline, stepId) {
    return asArray(pipeline?.steps).find((item) => item.id === stepId) || null;
  }

  function pipelineSections(pipeline, stepId) {
    return asArray(pipelineStep(pipeline, stepId)?.sections);
  }

  function chosePipeline(pipeline = null) {
    return pipeline?.id === "chose" ? pipeline : (P?.chose || {});
  }

  function choseDemo(pipeline, key, fallback = {}) {
    return pipelineResource(chosePipeline(pipeline), "demo", key, fallback);
  }

  function choseMapping(pipeline, key, fallback = {}) {
    return pipelineResource(chosePipeline(pipeline), "mappings", key, fallback);
  }

  function normalizePipelineFinding(item) {
    const statusMap = {accepted:"accepted", needs_revision:"review", proposed:"action", rejected:"review"};
    return {
      score: Number(item?.score) || 0,
      title: item?.title || item?.statement || "Untitled finding",
      detail: item?.statement || item?.detail || "",
      evidence: item?.evidence_label || asArray(item?.evidence_refs).join(" · ") || "No evidence linked",
      status: statusMap[item?.review_status] || item?.status || "review",
      type: item?.type || "observation",
      id: item?.finding_id || item?.id || ""
    };
  }

  function hydrateChoseDemoFromContract() {
    R?.hydrateData(D, "chose");
    const pipeline = chosePipeline();
    Log.info("pipeline.contract-hydrated", {
      pipeline: pipeline.id,
      version: pipeline.version,
      measurements: asArray(D.demoDataset).length,
      findings: asArray(D.aiFindings).length,
      issues: asArray(D.validationIssues).length
    });
  }

  hydrateChoseDemoFromContract();

  const CHOSE_CONTRACT = chosePipeline();
  const CHOSE_DEMO_PROCESS = choseDemo(CHOSE_CONTRACT, "process", {});
  const CHOSE_DEMO_EXPERIMENT = choseDemo(CHOSE_CONTRACT, "experiment", {});
  const CHOSE_DEMO_RESULTS = choseDemo(CHOSE_CONTRACT, "results", {});
  const CHOSE_DEMO_REVIEW = choseDemo(CHOSE_CONTRACT, "review", {});
  const CHOSE_JV_MAPPING = choseMapping(CHOSE_CONTRACT, "jv", {});
  const CHOSE_NOMAD_MAPPING = choseMapping(CHOSE_CONTRACT, "nomad", {});
  const CHOSE_SOLUTION_TYPES = asArray(pipelineResource(CHOSE_CONTRACT, "defaults", "solution_types", {}).items);
  const CHOSE_OPERATION_TYPES = asArray(pipelineResource(CHOSE_CONTRACT, "defaults", "operation_types", {}).items);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);

  const yamlScalar = (value) => value === null ? "null" : typeof value === "string" ? JSON.stringify(value) : String(value);
  function yamlDocument(value, depth = 0) {
    const indent = "  ".repeat(depth);
    return Object.entries(value).flatMap(([key, item]) => {
      if (Array.isArray(item)) {
        if (!item.length) return `${indent}${key}: []`;
        return [`${indent}${key}:`, ...item.flatMap((entry) => {
          if (entry && typeof entry === "object") {
            const lines = yamlDocument(entry, depth + 2).split("\n");
            return [`${indent}  - ${lines[0].trimStart()}`, ...lines.slice(1)];
          }
          return `${indent}  - ${yamlScalar(entry)}`;
        })];
      }
      if (item && typeof item === "object") return [`${indent}${key}:`, yamlDocument(item, depth + 1)];
      return `${indent}${key}: ${yamlScalar(item)}`;
    }).join("\n");
  }

  const icons = window.LabFlowIcons || {};

  function icon(name, cls = "icon") {
    return `<svg class="${cls} icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
  }

  if (C.demo_user) Object.assign(D.user, {
    name: C.demo_user.name, role: C.demo_user.role, email: C.demo_user.email,
    organisation: C.demo_user.organisation, laboratory: C.demo_user.laboratory,
    workspace: C.demo_user.workspace,
    initials: String(C.demo_user.name || "LabFlow").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
  });

  const defaultSettings = {
    theme: C.appearance?.default_theme || "light",
    palette: C.appearance?.default_palette || "blue",
    density: C.appearance?.default_density || "compact",
    aiEnabled: C.ai?.enabled ?? true,
    knowledgeScope: C.knowledge?.default_scope || "approved",
    reportAuthor: C.reports?.author || D.user.name,
    reportLab: C.reports?.laboratory || D.user.laboratory,
    reportOrganisation: C.reports?.organisation || D.user.organisation,
    nomadUrl: "",
    nomadUsername: "",
    nomadApiKey: "",
    language: "en",
    units: "si",
    defaultExport: C.reports?.default_export || "bundle",
    adminTheme: "user",
    adminPalette: "blue",
    enabledPipelines: C.pipelines?.enabled || ["chose", "quick"],
    allowedExports: C.exports?.enabled || ["pdf", "docx", "xlsx", "latex", "bundle"],
    laboratoryName: D.user.laboratory
  };

  function getSettings() {
    const value = S.getSettings(defaultSettings);
    if (!["dark", "light"].includes(value.theme)) value.theme = defaultSettings.theme;
    if (!E.palettes[value.palette]) value.palette = defaultSettings.palette;
    if (!["compact", "comfortable"].includes(value.density)) value.density = defaultSettings.density;
    return value;
  }

  function saveSettings(settings) {
    S.saveSettings(settings);
  }

  function applySettings() {
    const settings = getSettings();
    T.apply(settings);
  }

  function normalizeUser(value = {}) {
    const name = String(value.name || "Researcher").trim() || "Researcher";
    return {
      ...D.user,
      ...value,
      name,
      initials: name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "LF"
    };
  }

  function currentUser() {
    const user = normalizeUser(S.getUser ? S.getUser(D.user) : D.user);
    Object.assign(D.user, user);
    return user;
  }

  function defaultWorkspaceUsers() {
    const user = currentUser();
    return [
      {...user, isCurrent: true, permission: "Owner", status: "active", access: "All projects", lastActivity: "Current session"},
      {id:"USR-CHOSE-018", name:"Data Steward", initials:"DS", email:"data.steward@lab.example", role:"Data Steward", organisation:user.organisation, laboratory:user.laboratory, workspace:user.workspace, permission:"Data steward", status:"invited", access:"Assigned projects", lastActivity:"Invitation pending"}
    ];
  }

  function workspaceUserDirectory() {
    const current = currentUser();
    const users = S.getUsers ? S.getUsers(defaultWorkspaceUsers()) : defaultWorkspaceUsers();
    const currentIndex = users.findIndex((item) => item.isCurrent || item.id === current.id);
    const currentEntry = {...current, isCurrent:true, permission:"Owner", status:"active", access:"All projects", lastActivity:"Current session"};
    if (currentIndex >= 0) users[currentIndex] = {...users[currentIndex], ...currentEntry};
    else users.unshift(currentEntry);
    return users;
  }

  function saveWorkspaceUserDirectory(users) {
    if (S.saveUsers) S.saveUsers(users);
  }

  function saveCurrentUser(value) {
    const user = normalizeUser(value);
    if (S.saveUser) S.saveUser(user);
    Object.assign(D.user, user);
    const users = workspaceUserDirectory();
    const index = users.findIndex((item) => item.isCurrent || item.id === user.id);
    if (index >= 0) users[index] = {...users[index], ...user, isCurrent:true, permission:"Owner", status:"active", access:"All projects", lastActivity:"Current session"};
    saveWorkspaceUserDirectory(users);
    return user;
  }

  const carriedSettingParams = {theme: "lf_theme", palette: "lf_palette", density: "lf_density"};

  function restoreCarriedSettings() {
    const url = new URL(location.href);
    const hasCarriedSettings = Object.values(carriedSettingParams).some((param) => url.searchParams.has(param));
    if (!hasCarriedSettings) return;
    const next = getSettings();
    const theme = url.searchParams.get(carriedSettingParams.theme);
    const palette = url.searchParams.get(carriedSettingParams.palette);
    const density = url.searchParams.get(carriedSettingParams.density);
    if (["light", "dark"].includes(theme)) next.theme = theme;
    if (E.palettes[palette]) next.palette = palette;
    if (["compact", "comfortable"].includes(density)) next.density = density;
    saveSettings(next);
    Log.debug("appearance.restored-from-navigation", { theme: next.theme, palette: next.palette, density: next.density });
  }

  function withCarriedSettings(href) {
    if (!href || href.startsWith("#") || /^(?:mailto:|tel:|javascript:)/i.test(href)) return href;
    const url = new URL(href, location.href);
    const sameLocalFileContext = location.protocol === "file:" && url.protocol === "file:";
    if (!sameLocalFileContext && url.origin !== location.origin) return href;
    const settings = getSettings();
    Object.entries(carriedSettingParams).forEach(([key, param]) => url.searchParams.set(param, settings[key]));
    if (sameLocalFileContext) return `${url.pathname.split("/").pop()}${url.search}${url.hash}`;
    return url.href;
  }

  function navigateWithSettings(href) {
    const target = withCarriedSettings(href);
    Log.info("navigation.request", { target: new URL(target, location.href).pathname.split("/").pop() });
    location.href = target;
  }

  function toast(message, type = "success") {
    let region = $(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.append(region);
    }
    const item = document.createElement("div");
    item.className = `toast toast-${type}`;
    item.textContent = message;
    region.append(item);
    Log.debug("toast.show", { type, message });
    setTimeout(() => item.remove(), 3200);
  }

  function pageMeta(page) {
    return ({
      workspace: ["Workspace", "Research projects and priorities"],
      project: ["Project", "Pipeline workspace"],
      cabinet: ["Lab Cabinet", "Reusable laboratory knowledge and resources"],
      knowledge: ["AI & Models", "Knowledge, datasets, models and reviewed scientific outputs"],
      robotics: ["Robotics", "Robot simulation, motion programs and experiment-linked execution"],
      tools: ["Tools", "Local document and data utilities"],
      settings: ["Settings", "Workspace users, appearance and integrations"],
      documentation: ["Documentation", "Product and technical guide"],
      "ui-kit": ["UI Kit", "Reusable interface system"]
    })[page] || ["LabFlow", "Research workspace"];
  }

  function hydrateShell(page) {
    const [title] = pageMeta(page);
    const user = currentUser();
    const content = $("#page-content");
    const width = ({workspace:"wide",project:"wide",cabinet:"wide",knowledge:"wide",robotics:"wide",tools:"wide",documentation:"wide","ui-kit":"wide"})[page] || "standard";
    content.className = `content page-width-${width}`;
    $("#topbar-page-title")?.replaceChildren(document.createTextNode(title));
    const mobileTitle = $(".mobile-brand-title");
    if (mobileTitle) mobileTitle.textContent = title;
    $$(".user-chip .avatar, .top-user .avatar").forEach((avatar) => { avatar.textContent = user.initials; });
    const userChip = $(".user-chip");
    if (userChip) userChip.querySelector("span:last-child").innerHTML = `<strong>${esc(user.name)}</strong><span>${esc(user.role)}</span>`;
    const topUser = $(".top-user-copy");
    if (topUser) topUser.innerHTML = `<strong>${esc(user.name)}</strong><span>${esc(user.workspace)}</span>`;
    if (page === "project") {
      const project = currentProject();
      const step = new URLSearchParams(location.search).get("step");
      const entry = $(".project-nav-entry");
      if (entry) {
        entry.href = `project.html?project=${encodeURIComponent(project.id)}${step ? `&step=${encodeURIComponent(step)}` : ""}`;
        entry.title = project.name;
        entry.querySelector("strong").textContent = project.name;
        entry.querySelector("small").textContent = project.id;
      }
    }
    const overlays = $("#global-overlays");
    if (overlays) overlays.replaceChildren();
    Log.debug("shell.hydrated", { page, width });
  }

  function globalSearchItems() {
    const items = [];
    const add = (category, title, detail, href, ico) => items.push({category, title, detail, href, ico});
    A.listProjects().forEach((project) => add("Projects", project.name, `${project.id} · ${P[project.pipeline].name}`, `project.html?project=${encodeURIComponent(project.id)}`, "home"));
    Object.values(P).forEach((pipeline) => {
      const projects = A.listProjects();
      const project = projects.find((item) => item.pipeline === pipeline.id) || projects[0];
      add("Pipelines", pipeline.name, `${pipeline.steps.length} steps · ${pipeline.status}`, `project.html?project=${encodeURIComponent(project.id)}`, "layers");
      pipeline.steps.forEach((step) => add("Steps", step.title, `${pipeline.name} · ${step.output}`, `project.html?project=${encodeURIComponent(project.id)}&step=${encodeURIComponent(step.id)}`, "arrow"));
    });
    A.listCabinet().forEach((item) => add("Lab Cabinet", item.name, `${item.id} · ${item.type}`, `cabinet.html?item=${encodeURIComponent(item.id)}`, "cabinet"));
    A.listKnowledge().forEach((item) => add("Knowledge", item.title, `${item.id} · ${item.status}`, `knowledge.html?q=${encodeURIComponent(item.title)}`, "book"));
    A.listDatasetSnapshots().forEach((item) => add("Datasets", item.name, `${item.id} · ${item.rows} rows · ${item.target}`, "knowledge.html?view=datasets", "database"));
    A.listModels().forEach((item) => add("Models", item.name, `${item.id} · ${item.task} · ${item.status}`, "knowledge.html?view=models", "chart"));
    A.listPredictions().forEach((item) => add("Predictions", `${item.sample} PCE prediction`, `${item.model} · ${item.status}`, "knowledge.html?view=predictions", "spark"));
    add("Platform capabilities", "Robotics", "Robot Arm 01 · simulation, poses and motion programs", "robotics.html", "robot");
    A.listTools().forEach((item) => add("Scientific tools", item.name, item.description, `tools.html?tool=${encodeURIComponent(item.id || "diagram")}`, item.icon));
    [["txt","TXT editor"],["markdown","Markdown editor"],["latex","LaTeX editor"],["yaml","YAML editor"],["json","JSON editor"],["spreadsheet","Excel workbook"],["docx","DOCX composer"]].forEach(([id, title]) => add("Generic tools", title, "Local temporary workspace", `tools.html?tool=${id}`, id === "spreadsheet" ? "table" : "edit"));
    A.listProjects().forEach((project) => add("Reports", `${project.name} report`, `${project.id} · PDF, DOCX and Excel`, `project.html?project=${encodeURIComponent(project.id)}&step=review&view=report`, "file"));
    DOCS.forEach((doc) => add("Documentation", doc.title, `${doc.status} · ${doc.updated}`, `documentation.html?doc=${encodeURIComponent(doc.id)}`, "book"));
    return items;
  }

  function marked(value, query) {
    const source = String(value);
    const index = source.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) return esc(source);
    return `${esc(source.slice(0, index))}<mark>${esc(source.slice(index, index + query.length))}</mark>${esc(source.slice(index + query.length))}`;
  }

  function bindGlobalSearch() {
    const root = $("#global-search");
    const input = $("#global-search-input");
    const results = $("#global-search-results");
    let items = null;
    const getItems = () => {
      if (!items) {
        items = globalSearchItems();
        Log.info("search.index-built", { items: items.length });
      }
      return items;
    };
    let active = -1;
    const close = (clear = false) => {
      results.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant");
      document.body.classList.remove("search-open"); active = -1; if (clear) input.value = "";
    };
    const select = (index) => {
      const options = $$('[role="option"]', results); active = Math.max(0, Math.min(index, options.length - 1));
      options.forEach((option, itemIndex) => option.classList.toggle("active", itemIndex === active));
      if (options[active]) { input.setAttribute("aria-activedescendant", options[active].id); options[active].scrollIntoView({block:"nearest"}); }
    };
    const render = () => {
      const query = input.value.trim(); active = -1;
      if (!query) { results.innerHTML = '<div class="global-search-empty"><strong>Search the local workspace</strong><span>Projects, pipelines, knowledge, tools, reports and documentation.</span></div>'; }
      else {
        const matches = getItems().filter((item) => `${item.title} ${item.detail} ${item.category}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
        if (!matches.length) results.innerHTML = `<div class="global-search-empty"><strong>No local result</strong><span>Try a project ID, material, pipeline step or document title.</span></div>`;
        else {
          const groups = matches.reduce((map, item) => { (map[item.category] ||= []).push(item); return map; }, {});
          let optionIndex = 0;
          results.innerHTML = Object.entries(groups).map(([category, group]) => `<section><h3>${esc(category)}</h3>${group.map((item) => `<a id="global-result-${optionIndex++}" role="option" href="${item.href}"><span class="object-icon">${icon(item.ico)}</span><span><strong>${marked(item.title, query)}</strong><small>${marked(item.detail, query)}</small></span>${icon("arrow")}</a>`).join("")}</section>`).join("");
        }
      }
      results.hidden = false; input.setAttribute("aria-expanded", "true");
    };
    input.addEventListener("focus", render);
    input.addEventListener("input", render);
    input.addEventListener("keydown", (event) => {
      const options = $$('[role="option"]', results);
      if (event.key === "ArrowDown" && options.length) { event.preventDefault(); select(active + 1); }
      if (event.key === "ArrowUp" && options.length) { event.preventDefault(); select(active < 0 ? options.length - 1 : active - 1); }
      if (event.key === "Enter" && active >= 0 && options[active]) { event.preventDefault(); options[active].click(); }
      if (event.key === "Escape") { event.preventDefault(); close(true); input.blur(); }
    });
    document.addEventListener("click", (event) => { if (!root.contains(event.target) && !event.target.closest('[data-action="search"]')) close(false); });
    document.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.body.classList.add("search-open"); input.focus(); } });
    return {open(){ document.body.classList.add("search-open"); input.focus(); render(); }, close};
  }

  function assistantDrawer(page) {
    const [title] = pageMeta(page);
    const messages = S.getAssistantMessages();
    return `<aside class="ai-assistant" aria-label="Lab Assistant">
      <div class="ai-assistant-header">
        <div class="row"><span class="object-icon">${icon("spark")}</span><div><strong>Lab Assistant</strong><small class="block">Ask · Inspect · Prepare · ${esc(title)}</small></div></div>
        <button class="btn btn-ghost icon-btn" data-action="assistant" aria-label="Close assistant">${icon("x")}</button>
      </div>
      <div class="ai-assistant-body" id="assistant-messages">
        <div class="notice notice-warning"><div>${icon("info")}</div><div><strong>Research support, not autonomous decisions</strong><p>This static version uses deterministic responses. Evidence, confidence and researcher approval remain visible.</p></div></div>
        <div class="ai-message"><strong>Contextual support</strong><p>I can answer from laboratory evidence, inspect quality and prepare a reviewed action. Open Knowledge for full scope, sources and evidence.</p><small>Local demonstration · Evidence required</small></div>
        ${messages.slice(-3).map((item) => `<div class="ai-message ${item.role === "user" ? "user" : ""}">${esc(item.text)}${item.role === "assistant" ? `<small class="block mt-1">${esc(item.meta || "Local deterministic rule")}</small>` : ""}</div>`).join("")}
        <div class="prompt-chips">${D.assistantPrompts.map((prompt) => `<button class="prompt-chip" data-prompt="${esc(prompt)}">${esc(prompt)}</button>`).join("")}</div>
      </div>
      <form class="ai-assistant-footer" id="assistant-form">
        <input class="input" id="assistant-input" name="assistant-question" autocomplete="off" aria-label="Ask LabFlow" placeholder="Ask, inspect or prepare…">
        <button class="btn btn-primary icon-btn" aria-label="Send question">${icon("arrow")}</button>
      </form>
    </aside>`;
  }

  function ensureAssistant() {
    const overlays = $("#global-overlays");
    if (overlays && !$(".ai-assistant", overlays)) overlays.innerHTML = assistantDrawer(document.body.dataset.page);
  }

  function bindShell() {
    const search = bindGlobalSearch();
    document.addEventListener("click", (event) => {
      const internalLink = event.target.closest("a[href]");
      if (internalLink && !internalLink.hasAttribute("download")) internalLink.setAttribute("href", withCarriedSettings(internalLink.getAttribute("href")));
      const action = event.target.closest("[data-action]");
      if (action) {
        if (action.dataset.action === "menu") document.body.classList.toggle("sidebar-open");
        if (action.dataset.action === "assistant") { ensureAssistant(); document.body.classList.toggle("ai-open"); }
        if (action.dataset.action === "search") search.open();
        if (action.dataset.action === "quick-theme") {
          const settings = getSettings();
          settings.theme = settings.theme === "dark" ? "light" : "dark";
          saveSettings(settings); applySettings();
          toast(`${settings.theme === "light" ? "Light content" : "Dark"} theme enabled. Navigation remains dark.`);
        }
        if (action.dataset.action === "profile") openProfile();
        if (action.dataset.action === "close-modal") closeModal();
      }
      const prompt = event.target.closest("[data-prompt]");
      if (prompt) askAssistant(prompt.dataset.prompt);
      const assistantSave = event.target.closest("[data-assistant-save]");
      if (assistantSave) toast(assistantSave.dataset.assistantSave === "report" ? "Assistant draft added temporarily. Reload removes it." : "Finding added temporarily. Reload removes it.");
      if (event.target.id === "modal") closeModal();
      if (event.target.closest(".sidebar-open .main")) document.body.classList.remove("sidebar-open");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
        document.body.classList.remove("sidebar-open", "ai-open");
        search.close(true);
      }
      if (event.key === "Tab" && !$("#modal")?.hidden) {
        const focusable = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', $("#modal"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    document.addEventListener("submit", (event) => {
      if (!event.target.matches("#assistant-form")) return;
      event.preventDefault();
      const input = $("#assistant-input");
      if (input?.value.trim()) askAssistant(input.value.trim());
      if (input) input.value = "";
    });
  }

  function askAssistant(question) {
    const messages = $("#assistant-messages");
    messages.insertAdjacentHTML("beforeend", `<div class="ai-message user">${esc(question)}</div>`);
    const q = question.toLowerCase();
    let answer = "I found three relevant evidence groups. Open the full Knowledge answer to review scope, sources and the proposed next action.";
    if (q.includes("missing") || q.includes("metadata") || q.includes("inspect")) answer = "EXP-067 has one device-count error, two metadata warnings and one ambiguous note. Deterministic validation blocks final NOMAD submission; the note remains an AI suggestion only.";
    else if (q.includes("s04") || q.includes("s08") || q.includes("compare")) answer = "S08 has the highest PCE (21.28%) and stability (95%), while S04 is close at 21.10% and 94%. Both use FA0.90MA0.10 and show the lowest hysteresis in the current set.";
    else if (q.includes("knowledge") || q.includes("sop")) answer = "The most relevant approved items are the precursor preparation SOP, the JV scan protocol and the recurring low-fill-factor research note. Their governance state remains visible in Knowledge.";
    else if (q.includes("report") || q.includes("conclusion")) answer = "Suggested conclusion: FA0.90MA0.10 is the leading candidate across efficiency, stability and hysteresis, but S06 should be investigated before exclusion and two process metadata gaps must be resolved.";
    else if (q.includes("summar")) answer = "The project compares mixed-cation formulations across 12 samples and 18 measurements. Current evidence favours FA0.90MA0.10; report preparation is 78% complete and awaits outlier and metadata review.";
    const sources = q.includes("knowledge") || q.includes("sop") ? D.knowledge.slice(0, 3) : D.knowledge.slice(0, 2);
    const confidence = q.includes("summar") || q.includes("compare") ? "High" : "Moderate";
    const messagesState = S.getAssistantMessages();
    messagesState.push({ role: "user", text: question }, { role: "assistant", text: answer, meta: `${confidence} confidence · ${sources.map((item) => item.id).join(", ")}` });
    S.saveAssistantMessages(messagesState);
    setTimeout(() => {
      messages.insertAdjacentHTML("beforeend", `<div class="ai-message">${esc(answer)}<small class="block mt-1">Local demonstration · ${confidence} confidence · Evidence: ${sources.map((item) => `<span>${esc(item.id)}</span>`).join(", ")}</small><div class="cluster mt-1"><a class="btn btn-sm btn-primary" href="knowledge.html?q=${encodeURIComponent(question)}">Open full answer</a><button class="btn btn-sm" data-assistant-save="report">Preview report action</button></div></div>`);
      messages.scrollTop = messages.scrollHeight;
    }, 180);
    messages.scrollTop = messages.scrollHeight;
  }

  function modal(html) {
    const root = $("#modal");
    Log.debug("modal.open", { trigger: document.activeElement?.id || document.activeElement?.dataset?.action || document.activeElement?.tagName });
    root._returnFocus = document.activeElement;
    root.innerHTML = html;
    root.hidden = false;
    setTimeout(() => root.querySelector("input, select, button")?.focus(), 0);
  }

  function closeModal() {
    const root = $("#modal");
    if (root && !root.hidden) {
      root.hidden = true;
      root.innerHTML = "";
      root._returnFocus?.focus?.();
      Log.debug("modal.close");
    }
  }

  function openProfile() {
    const u = currentUser();
    const members = workspaceUserDirectory();
    modal(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <div class="modal-header"><div><h2 id="profile-title" class="mb-0">Researcher profile</h2><small>Current workspace identity and session-only user directory</small></div><button class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">${icon("x")}</button></div>
      <div class="modal-body stack">
        <div class="profile-identity"><span class="avatar avatar-lg">${esc(u.initials)}</span><div><h3>${esc(u.name)}</h3><p class="mb-0">${esc(u.role)} · ${esc(u.organisation)}</p><small>${esc(u.email)}</small></div><span class="badge badge-success">Current user</span></div>
        <div class="grid grid-3"><div class="card kpi"><span class="kpi-label">Projects</span><strong class="kpi-value">${u.projects}</strong><span class="kpi-detail">in workspace</span></div><div class="card kpi"><span class="kpi-label">Workspace users</span><strong class="kpi-value">${members.length}</strong><span class="kpi-detail">${members.filter((item) => item.status === "active").length} active</span></div><div class="card kpi"><span class="kpi-label">Permission</span><strong class="kpi-value kpi-value-small">Owner</strong><span class="kpi-detail">demonstration policy</span></div></div>
        <div class="metadata-list"><div><span>Workspace</span><strong>${esc(u.workspace)}</strong></div><div><span>Laboratory</span><strong>${esc(u.laboratory)}</strong></div><div><span>Last access</span><strong>${esc(u.lastAccess)}</strong></div></div>
        <div class="notice"><div>${icon("lock")}</div><div><strong>Static user management</strong><p>Profiles, roles and access are session-only demonstrations. Authentication and server-side permission enforcement remain future backend responsibilities.</p></div></div>
      </div>
      <div class="modal-footer"><a class="btn" href="settings.html?tab=user">Edit profile</a><a class="btn btn-primary" href="settings.html?tab=users">Manage users</a></div>
    </div>`);
  }

  function header(title, description, actions = "", options = {}) {
    const page = document.body.dataset.page;
    const crumbs = options.breadcrumbs || (page === "workspace" ? [{label:"Workspace"}] : [{label:"Workspace",href:"index.html"},{label:title}]);
    const context = `<nav class="page-context" aria-label="Breadcrumb">${crumbs.map((crumb, index) => `${crumb.href ? `<a href="${crumb.href}">${crumb.label}</a>` : `<span aria-current="page">${crumb.label}</span>`}${index < crumbs.length - 1 ? '<span aria-hidden="true">/</span>' : ""}`).join("")}</nav>`;
    const pageActions = actions;
    return `${context}<header class="page-header"><div class="page-header-main"><div class="page-header-copy">${options.eyebrow ? `<span class="page-eyebrow">${options.eyebrow}</span>` : ""}<div class="page-title-line"><h1>${title}</h1>${options.status || ""}</div><p class="page-description">${description}</p></div>${pageActions ? `<div class="page-actions">${pageActions}</div>` : ""}</div></header>`;
  }

  function badgeStatus(status) {
    const map = {
      active: ["accent", "Active"], review: ["warning", "Needs review"], complete: ["success", "Completed"],
      draft: ["", "Draft"], reviewed: ["success", "Reviewed"], approved: ["success", "Approved"],
      working: ["accent", "Working"], accepted: ["success", "Researcher accepted"], action: ["danger", "Action required"],
      pending: ["warning", "Pending"], warning: ["warning", "Warning"], error: ["danger", "Error"]
    };
    const item = map[status] || ["", status];
    return `<span class="badge ${item[0] ? `badge-${item[0]}` : ""}">${esc(item[1])}</span>`;
  }

  function projectStore() {
    return S.getProjects(A.listProjects());
  }

  function saveProjects(projects) { S.saveProjects(projects); }

  function projectCard(project) {
    const pipeline = P[project.pipeline];
    const step = pipeline.steps.find((item) => item.id === project.currentStep) || pipeline.steps[0];
    const search = `${project.name} ${project.id} ${project.tags.join(" ")} ${project.status}`.toLowerCase();
    return `<article class="card interactive project-card" data-project-card data-status="${project.status}" data-progress="${project.progress}" data-updated="${esc(project.updated)}" data-name="${esc(project.name.toLowerCase())}" data-search="${esc(search)}">
      <div class="card-title"><div><div class="cluster mb-1">${badgeStatus(project.status)}<span class="badge">${esc(pipeline.name)}</span></div><h3>${esc(project.name)}</h3><p>${esc(project.objective)}</p></div>${project.transient ? '<span class="badge badge-accent">Current preview</span>' : `<a class="btn btn-ghost icon-btn" href="project.html?project=${encodeURIComponent(project.id)}" aria-label="Open project">${icon("arrow")}</a>`}</div>
      <div class="project-stage"><span><small>Current step</small><strong>${esc(step.short_title)}</strong></span><span><small>Next decision</small><strong>${esc(project.nextAction)}</strong></span></div>
      <div class="project-meta"><span>${esc(project.id)}</span><span>${project.samples} samples</span><span>${project.files} files</span><span>${project.collaborators} people</span><span>${esc(project.updated)}</span></div>
      <div class="project-footer"><div class="progress"><span style="width:${project.progress}%"></span></div><strong>${project.progress}%</strong></div>
    </article>`;
  }

  function projectTable(projects) {
    return `<div class="table-wrap project-table-wrap" hidden><table class="table-dense project-table"><thead><tr><th>Project</th><th>Pipeline</th><th>Status</th><th>Current Step</th><th>Progress</th><th>Last Activity</th><th><span class="sr-only">Open</span></th></tr></thead><tbody>${projects.map((project) => {
      const pipeline = P[project.pipeline];
      const step = pipeline.steps.find((item) => item.id === project.currentStep) || pipeline.steps[0];
      return `<tr data-project-row data-status="${project.status}" data-progress="${project.progress}" data-updated="${esc(project.updated)}" data-name="${esc(project.name.toLowerCase())}" data-search="${esc(`${project.name} ${project.id} ${pipeline.name} ${project.status}`.toLowerCase())}"><td><strong>${esc(project.name)}</strong><small class="block">${esc(project.id)}</small></td><td>${esc(pipeline.name)}</td><td>${badgeStatus(project.status)}</td><td>${esc(step.short_title)}</td><td><div class="metric-inline"><div class="progress"><span style="width:${project.progress}%"></span></div><strong>${project.progress}%</strong></div></td><td>${esc(project.updated)}</td><td>${project.transient ? '<span class="badge">Preview</span>' : `<a class="btn btn-sm" href="project.html?project=${encodeURIComponent(project.id)}">Open</a>`}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function renderWorkspace() {
    const readinessOverall = Number(F.readiness?.overall ?? 0);
    const projects = projectStore();
    const active = projects.filter((project) => project.status === "active").length;
    const complete = projects.filter((project) => project.status === "complete").length;
    const reviews = projects.filter((project) => project.status === "review").length;
    const actions = `<a class="btn" href="knowledge.html">${icon("spark")} AI & Models</a><button class="btn btn-primary" id="new-project">${icon("plus")} New project</button>`;
    const focusProject = projects.find((project) => project.id === "PRJ-2026-014") || projects[0];
    const focusPipeline = P[focusProject.pipeline];
    const focusIndex = Math.max(0, focusPipeline.steps.findIndex((step) => step.id === focusProject.currentStep));
    $("#page-content").innerHTML = header("Workspace", `Research control for ${esc(D.user.name)} · projects, evidence, quality and next decisions in one place.`, actions) + `
      <section class="summary-strip summary-strip-metrics" aria-label="Workspace summary">
        ${[["Projects", projects.length, `${active} active`], ["Research review", reviews, "projects need a decision"], ["Data health", "94%", "1 error · 2 warnings"], ["AI readiness", `${F.readiness.overall}%`, F.readiness.status]].map(([label, value, detail]) => `<div class="summary-item metric-summary"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`).join("")}
      </section>
      <section class="workspace-focus section" aria-label="Current research focus">
        <div class="workspace-focus-main"><div class="cluster"><span class="badge badge-accent">Current research focus</span>${badgeStatus(focusProject.status)}<span class="badge">${esc(focusProject.id)}</span></div><h2>${esc(focusProject.name)}</h2><p class="lead">${esc(focusProject.objective)}</p><div class="workspace-pipeline" aria-label="${esc(focusPipeline.name)} progress">${focusPipeline.steps.map((step, index) => `<a class="workspace-pipeline-step ${index < focusIndex ? "done" : index === focusIndex ? "active" : ""}" href="project.html?project=${encodeURIComponent(focusProject.id)}&step=${encodeURIComponent(step.id)}"><span>${index < focusIndex ? icon("check") : index + 1}</span><strong>${esc(step.short_title)}</strong><small>${index === focusIndex ? "Current step" : esc(step.output)}</small></a>`).join("")}</div><div class="hero-actions"><a class="btn btn-primary" href="project.html?project=${encodeURIComponent(focusProject.id)}&step=${encodeURIComponent(focusProject.currentStep)}">Continue current step</a><a class="btn" href="knowledge.html?q=Inspect%20EXP-067">Inspect evidence</a></div></div>
        <aside class="workspace-command-deck"><div><span class="knowledge-kind">Research commands</span><h3>Move from evidence to action</h3><p>Every command opens a scoped, local workspace.</p></div><a href="knowledge.html">${icon("spark")}<span><strong>AI & Models</strong><small>Knowledge, datasets and predictions</small></span>${icon("arrow")}</a><a href="tools.html?tool=diagram">${icon("diagram")}<span><strong>Diagram Studio</strong><small>Render workflows and evidence graphs</small></span>${icon("arrow")}</a><a href="project.html?project=${encodeURIComponent(focusProject.id)}&step=review&view=report">${icon("download")}<span><strong>Review exports</strong><small>PDF, DOCX, XLSX and package</small></span>${icon("arrow")}</a><a href="cabinet.html">${icon("cabinet")}<span><strong>Lab Cabinet</strong><small>Reusable scientific definitions</small></span>${icon("arrow")}</a></aside>
      </section>
      <section class="section" id="project-portfolio">
        <div class="section-heading"><div><h2>Project portfolio</h2><p>Compare workflow position, evidence volume and the next research decision.</p></div><span class="badge">${projects.length} projects</span></div>
        <div class="toolbar workspace-toolbar" aria-label="Project controls"><div class="search"><span>${icon("search")}</span><input class="input" id="project-search" name="project-search" autocomplete="off" placeholder="Search projects…" aria-label="Search projects"></div><select class="select" id="project-status" aria-label="Filter project status"><option value="all">All statuses</option><option value="active">Active</option><option value="review">Needs review</option><option value="complete">Completed</option><option value="draft">Draft</option></select><select class="select" id="project-sort" aria-label="Sort projects"><option value="updated">Last updated</option><option value="progress">Highest progress</option><option value="name">Project name</option></select><span class="toolbar-spacer"></span><div class="segmented" aria-label="Project view"><button class="active" id="project-cards" type="button" aria-pressed="true">Cards</button><button id="project-list" type="button" aria-pressed="false">Table</button></div></div>
        <div class="workspace-project-grid" id="project-grid">${projects.map(projectCard).join("")}</div>
        ${projectTable(projects)}
      </section>
      <section class="panel section workspace-ai-foundation"><div class="panel-header"><div><span class="page-eyebrow">Future-ready research foundation</span><h2 class="mb-0">Simple today. Ready for AI, ML and DL tomorrow.</h2><small>LabFlow prepares structured, traceable data without changing the researcher’s normal project workflow.</small></div><a class="btn btn-primary" href="knowledge.html?view=datasets">Inspect AI readiness</a></div><div class="panel-body"><div class="workspace-ai-readiness"><div class="readiness-ring readiness-ring-small" style="--readiness:${readinessOverall}"><strong>${readinessOverall}</strong><span>%</span></div><div class="workspace-ai-metrics">${F.readiness.metrics.slice(0,4).map((item) => `<span><small>${esc(item.label)}</small><strong>${item.value}%</strong><div class="progress"><span style="width:${item.value}%"></span></div></span>`).join("")}</div><div class="workspace-ai-path"><span><b>Knowledge</b> RAG, Graph RAG and evidence-led answers</span><span><b>Datasets</b> Snapshots, features, targets and quality</span><span><b>Models</b> Versions, runs, metrics and provenance</span><span><b>Predictions</b> Uncertainty, applicability and human review</span></div></div></div></section>
      <section class="section workspace-operations">
        <div class="panel"><div class="panel-header"><div><h3 class="mb-0">Next research actions</h3><small>Prioritised from project state</small></div>${icon("check")}</div><div class="panel-body stack">${projects.slice(0, 4).map((p) => `<a class="notice" href="project.html?project=${encodeURIComponent(p.id)}"><div>${icon(p.status === "review" ? "warning" : "arrow")}</div><div><strong>${esc(p.name)}</strong><p>${esc(p.nextAction)}</p></div></a>`).join("")}</div></div>
        <div class="panel"><div class="panel-header"><div><h3 class="mb-0">Project activity</h3><small>Included demonstration events</small></div>${icon("clock")}</div><div class="panel-body">${D.activity.map((a) => `<div class="timeline-item"><span class="timeline-time">${esc(a.time)}</span><span class="timeline-dot"></span><div><strong>${esc(a.text)}</strong><p>${esc(a.detail)}</p></div></div>`).join("")}</div></div>
        <div class="panel ai-panel"><div class="panel-header"><div><h3 class="mb-0">Assistant review queue</h3><small>Advisory findings requiring human control</small></div>${icon("spark")}</div><div class="panel-body">${D.aiFindings.slice(0, 3).map(aiFinding).join("")}<button class="btn btn-secondary w-full mt-2" data-action="assistant">Open evidence review</button></div></div>
      </section>
      <section class="section grid grid-2">
        <div class="panel"><div class="panel-header"><div><h3 class="mb-0">AI-ready knowledge</h3><small>Governed sources for RAG and evidence-led assistance</small></div><a class="btn btn-sm" href="knowledge.html">Open AI & Models</a></div><div class="panel-body stack">${D.knowledge.slice(0, 3).map(knowledgeCard).join("")}</div></div>
        <div class="panel"><div class="panel-header"><div><h3 class="mb-0">Local research tools</h3><small>Write, structure, visualise and publish</small></div><a class="btn btn-sm" href="tools.html">Open Tools</a></div><div class="panel-body workspace-tool-grid">${[["diagram","Diagram Studio","Evidence graphs","tools.html?tool=diagram"],["table","Spreadsheet","Multi-sheet data","tools.html?tool=spreadsheet"],["markdown","Markdown","Research notes","tools.html?tool=markdown"],["file","DOCX composer","Editable documents","tools.html?tool=docx"]].map(([ico,title,detail,href]) => `<a href="${href}"><span class="object-icon">${icon(ico)}</span><span><strong>${title}</strong><small>${detail}</small></span>${icon("arrow")}</a>`).join("")}</div></div>
      </section>`;

    $(".workspace-pipeline")?.setAttribute("role", "navigation");
    if (matchMedia("(max-width: 620px)").matches) requestAnimationFrame(() => $(".workspace-pipeline-step.active")?.scrollIntoView({block:"nearest",inline:"center"}));
    $("#new-project").onclick = openNewProject;
    const filter = () => {
      const query = $("#project-search").value.toLowerCase().trim();
      const status = $("#project-status").value;
      $$('[data-project-card], [data-project-row]').forEach((item) => {
        item.hidden = !item.dataset.search.includes(query) || (status !== "all" && item.dataset.status !== status);
      });
    };
    $("#project-search").addEventListener("input", filter);
    $("#project-status").addEventListener("change", filter);
    $("#project-sort").addEventListener("change", (event) => {
      const sort = event.target.value;
      const compare = (a, b) => sort === "name" ? a.dataset.name.localeCompare(b.dataset.name) : sort === "progress" ? Number(b.dataset.progress) - Number(a.dataset.progress) : 0;
      [$("#project-grid"), $(".project-table tbody")].forEach((root) => [...root.children].sort(compare).forEach((item) => root.append(item)));
    });
    const setView = (view) => {
      const cards = view === "cards";
      $("#project-grid").hidden = !cards;
      $(".project-table-wrap").hidden = cards;
      $("#project-cards").classList.toggle("active", cards);
      $("#project-list").classList.toggle("active", !cards);
      $("#project-cards").setAttribute("aria-pressed", cards);
      $("#project-list").setAttribute("aria-pressed", !cards);
    };
    $("#project-cards").onclick = () => setView("cards");
    $("#project-list").onclick = () => setView("table");
  }

  function openNewProject() {
    modal(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
      <div class="modal-header"><div><h2 id="new-project-title" class="mb-0">Create project</h2><small>Choose a reusable pipeline and define the research decision.</small></div><button class="btn btn-ghost icon-btn" data-action="close-modal">${icon("x")}</button></div>
      <form id="new-project-form"><div class="modal-body stack">
        <div class="field"><label for="project-name">Project name</label><input class="input" id="project-name" required placeholder="e.g. Encapsulation stability comparison"></div>
        <div class="field"><label for="project-objective">Research objective</label><textarea class="textarea" id="project-objective" required placeholder="What question or decision should the project support?"></textarea></div>
        <div class="field"><label for="project-pipeline">Pipeline</label><select class="select" id="project-pipeline">${Object.values(P).map((pipeline) => `<option value="${pipeline.id}">${esc(pipeline.name)} · ${pipeline.steps.length} steps</option>`).join("")}</select><span class="field-help">All steps remain revisitable and exports preserve the pipeline definition.</span></div>
      </div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary">Create project</button></div></form>
    </div>`);
    $("#new-project-form").onsubmit = (event) => {
      event.preventDefault();
      const projects = projectStore();
      const pipelineId = $("#project-pipeline").value;
      const pipeline = P[pipelineId];
      const id = `PRJ-2026-${String(projects.length + 20).padStart(3, "0")}`;
      projects.unshift({id, name: $("#project-name").value, pipeline: pipelineId, currentStep: pipeline.steps[0].id, progress: 8, status: "draft", updated: "Just now", owner: D.user.name, objective: $("#project-objective").value, tags: [pipeline.project_type], samples: 0, files: 0, solutions: 0, stacks: 0, measurements: 0, findings: 0, collaborators: 1, nextAction: `Complete ${pipeline.steps[0].title}`, transient: true});
      saveProjects(projects);
      closeModal();
      renderWorkspace();
      toast("Current Project preview added. Reload restores the included projects.");
    };
  }

  function currentProject() {
    const requested = new URLSearchParams(location.search).get("project");
    const projects = projectStore();
    const project = projects.find((item) => item.id === requested) || A.getProjectById(requested) || projects[0];
    return project;
  }

  function currentStep(project, pipeline) {
    const requested = new URLSearchParams(location.search).get("step");
    return pipeline.steps.find((step) => step.id === requested) || pipeline.steps.find((step) => step.id === project.currentStep) || pipeline.steps[0];
  }

  function stepState(index, currentIndex, project) {
    if (project.progress === 100 || index < currentIndex) return "done";
    return index === currentIndex ? "active" : "";
  }

  function projectPipelineNav(project, pipeline, step) {
    const currentIndex = pipeline.steps.findIndex((item) => item.id === step.id);
    return `<nav class="project-pipeline-nav" aria-label="Project pipeline">${pipeline.steps.map((item, index) => `<a class="step-link ${stepState(index, currentIndex, project)}" ${item.id === step.id ? 'aria-current="step"' : ""} href="project.html?project=${encodeURIComponent(project.id)}&step=${encodeURIComponent(item.id)}"><span class="step-index">${index < currentIndex || project.progress === 100 ? icon("check") : index + 1}</span><span class="step-copy"><strong>${esc(item.short_title)}</strong><span>${esc(item.output)}</span></span></a>`).join("")}</nav>`;
  }

  function stepGate(pipeline, step) {
    if (R?.evaluateStep) return R.evaluateStep(pipeline, step.id);
    const completion = step.completion || {};
    const errors = asArray(completion.rules).filter((item) => item.severity === "error").length;
    const warnings = asArray(completion.rules).filter((item) => item.severity === "warning").length;
    return {ready:errors === 0, status:errors ? "blocked" : warnings ? "warning" : "ready", errors, warnings, missing:[], rules:[]};
  }

  function stepTop(project, pipeline, step) {
    const currentIndex = pipeline.steps.findIndex((item) => item.id === step.id);
    const completion = step.completion || {};
    const gate = stepGate(pipeline, step);
    const gateLabel = gate.ready ? (gate.warnings ? `${gate.warnings} visible warning${gate.warnings === 1 ? "" : "s"}` : "Completion gate ready") : `${gate.errors} blocking issue${gate.errors === 1 ? "" : "s"}`;
    return `<header class="workflow-heading"><div><span class="page-eyebrow">Step ${currentIndex + 1} of ${pipeline.steps.length} · ${esc(step.output)}</span><h2>${esc(step.title)}</h2><p>${esc(step.description)}</p></div><div class="workflow-contract-summary" aria-label="Step contract"><span class="badge">${asArray(step.sections).length} sections</span><span class="badge">${asArray(completion.requires).length} required records</span><span class="badge ${gate.ready ? gate.warnings ? "badge-warning" : "badge-success" : "badge-error"}">${esc(gateLabel)}</span></div></header>`;
  }

  function projectStepFooter(project, pipeline, step) {
    const index = pipeline.steps.findIndex((item) => item.id === step.id);
    const previous = pipeline.steps[index - 1];
    const next = pipeline.steps[index + 1];
    const completion = step.completion || {};
    const completionLabel = completion.label || "Save step";
    const gate = stepGate(pipeline, step);
    const previousLink = previous ? `<a class="btn" href="project.html?project=${encodeURIComponent(project.id)}&step=${encodeURIComponent(previous.id)}">${icon("arrow")} Back to ${esc(previous.short_title)}</a>` : `<a class="btn" href="index.html#project-portfolio">${icon("home")} Workspace</a>`;
    const blockedLabel = `${gate.errors} blocker${gate.errors === 1 ? "" : "s"} to resolve`;
    const nextLink = next
      ? gate.ready
        ? `<a class="btn btn-primary" href="project.html?project=${encodeURIComponent(project.id)}&step=${encodeURIComponent(next.id)}">${esc(completionLabel)} · continue to ${esc(next.short_title)}</a>`
        : `<button class="btn btn-primary" disabled title="${esc(blockedLabel)}">${icon("warning")} ${esc(blockedLabel)}</button>`
      : gate.ready
        ? `<button class="btn btn-primary" data-export="bundle">${icon("download")} ${esc(completionLabel)}</button>`
        : `<button class="btn btn-primary" disabled title="${esc(blockedLabel)}">${icon("warning")} ${esc(blockedLabel)}</button>`;
    const gateCopy = gate.ready
      ? `${completion.mode || "draft"} gate · ${asArray(completion.expected_evidence).length} expected evidence items${gate.warnings ? ` · ${gate.warnings} warning${gate.warnings === 1 ? "" : "s"} remain visible` : ""}`
      : `${completion.mode || "draft"} gate · ${gate.errors} blocking issue${gate.errors === 1 ? "" : "s"} · navigation remains available for review`;
    return `<footer class="workflow-actions-footer"><div>${previousLink}</div><div class="workflow-gate-copy"><small>${esc(gateCopy)}</small><div class="cluster"><button class="btn" id="save-step">Save draft</button>${nextLink}</div></div></footer>`;
  }

  function renderProject() {
    const project = currentProject();
    const pipeline = P[project.pipeline];
    const step = currentStep(project, pipeline);
    const actions = `<label class="sr-only" for="project-switcher">Switch project</label><select class="select project-switcher" id="project-switcher" aria-label="Switch current project">${projectStore().map((item) => `<option value="${esc(item.id)}" ${item.id === project.id ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select>${pipeline.id === "chose" ? `<a class="btn btn-primary" href="project.html?project=${encodeURIComponent(project.id)}&step=experiment">${icon("plus")} New experiment</a>` : ""}`;
    const processVersion = pipeline.id === "chose" ? (choseDemo(pipeline, "process", {}).process?.name || pipeline.name) : pipeline.name;
    const projectExperiments = A.listExperiments(project.id);
    const activeExperiment = pipeline.id === "chose" ? (projectExperiments.at(-1)?.id || "No experiment") : "Review session";
    const pipelineGates = asArray(pipeline.steps).map((item) => stepGate(pipeline, item));
    const gateErrors = pipelineGates.reduce((sum, gate) => sum + Number(gate.errors || 0), 0);
    const gateWarnings = pipelineGates.reduce((sum, gate) => sum + Number(gate.warnings || 0), 0);
    const blockingIssues = gateErrors
      ? `${gateErrors} contract blocker${gateErrors === 1 ? "" : "s"}`
      : gateWarnings
        ? `${gateWarnings} visible warning${gateWarnings === 1 ? "" : "s"}`
        : "No blockers";
    $("#page-content").innerHTML = header(project.name, `${pipeline.name} · ${project.objective}`, actions, {eyebrow:"Project workflow",status:badgeStatus(project.status),breadcrumbs:[{label:"Workspace",href:"index.html"},{label:"Projects",href:"index.html#project-portfolio"},{label:esc(project.id)}]}) + `<section class="summary-strip summary-strip-project" aria-label="Project summary"><div class="summary-item"><small>Process version</small><strong>${esc(processVersion)}</strong><span class="summary-detail">Immutable experiment snapshots</span></div><div class="summary-item"><small>Active experiment</small><strong>${esc(activeExperiment)}</strong><span class="summary-detail">${project.samples} samples · ${project.measurements} measurements</span></div><div class="summary-item"><small>Completion</small><strong>${project.progress}%</strong><div class="progress" aria-label="Project progress ${project.progress}%"><span style="width:${project.progress}%"></span></div></div><div class="summary-item"><small>Blocking issues</small><strong>${esc(blockingIssues)}</strong><span class="summary-detail">Visible in Results and export</span></div></section><section class="project-workspace">${projectPipelineNav(project, pipeline, step)}${stepTop(project, pipeline, step)}<div id="step-view">${renderStepView(project, pipeline, step)}</div>${projectStepFooter(project, pipeline, step)}</section>`;
    if (matchMedia("(max-width: 760px)").matches) requestAnimationFrame(() => $(".project-pipeline-nav [aria-current=step]")?.scrollIntoView({block:"nearest",inline:"center"}));
    $("#save-step")?.addEventListener("click", () => toast("Draft applied in page memory. Reload restores the checked-in demonstration."));
    $("#project-switcher").onchange = (event) => navigateWithSettings(`project.html?project=${encodeURIComponent(event.target.value)}`);
    bindProjectInteractions(project, pipeline, step);
  }

  function renderRegisteredSection(component, context = {}) {
    const registry = {
      "chose.process.chemistry": ({pipeline}) => processChemistryView(pipeline),
      "chose.process.fabrication": ({pipeline}) => processFabricationView(pipeline),
      "chose.process.stack_review": ({pipeline}) => processStackView(pipeline),
      "chose.experiment.setup": ({project, pipeline}) => experimentSetupView(project, pipeline),
      "chose.experiment.execution": ({project, pipeline}) => experimentExecutionView(project, pipeline),
      "chose.experiment.summary": ({project, pipeline}) => experimentSummaryView(project, pipeline),
      "chose.results.files": ({project, pipeline}) => resultFilesView(project, pipeline),
      "chose.results.mapping": ({project, pipeline}) => resultMappingView(project, pipeline),
      "chose.results.quality": ({project, pipeline}) => resultQualityView(project, pipeline),
      "chose.review.overview": ({project, pipeline}) => analysisOverview(project, pipeline),
      "chose.review.compare": ({pipeline}) => comparisonView(pipeline),
      "chose.review.findings": ({pipeline}) => analysisFindings(pipeline),
      "chose.review.report_export": ({project, pipeline}) => reportAndExportView(project, pipeline)
    };
    const renderer = registry[component];
    if (!renderer) {
      Log.error("pipeline.component-missing", {component, pipeline: context.pipeline?.id, step: context.step?.id, section: context.section?.id});
      return `<div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Pipeline component is not registered</strong><p>${esc(component || "No component identifier")} cannot be rendered by this POC.</p></div></div>`;
    }
    return renderer(context);
  }

  function renderStepView(project, pipeline, step) {
    const views = {
      "chose-process": processStep,
      "chose-experiment": experimentStep,
      "chose-results": resultsStep,
      "chose-review": reviewStep,
      "quick-plan": quickPlan,
      "quick-data": quickData,
      "quick-report": quickReport,
      export: quickExportStep
    };
    return (views[step.view] || quickPlan)(project, pipeline, step);
  }

  const solutionDefinitions = asArray(CHOSE_DEMO_PROCESS.solution_definitions);
  const activeSolutionDefinition = solutionDefinitions[0] || {};
  const solutionComponents = asArray(activeSolutionDefinition.components);
  const stackLayers = asArray(CHOSE_DEMO_PROCESS.stack?.layers);

  function solutionReview(components = solutionComponents, definition = activeSolutionDefinition) {
    const solvents = components.filter((item) => item.phase === "solvent" || ["dmf", "dmso"].includes(item.tone));
    const solutes = components.filter((item) => !solvents.includes(item));
    const referenceVolume = definition.reference_volume ? `${definition.reference_volume.value} ${definition.reference_volume.unit}` : "2.00 mL";
    const concentration = definition.target_concentration ? `${definition.target_concentration.value} ${definition.target_concentration.unit}` : "1.25 mol/L";
    const checks = asArray(definition.checks).length ? asArray(definition.checks) : [
      {label:"Formula balanced", state:"valid"}, {label:"Units explicit", state:"valid"}, {label:"Handling metadata incomplete", state:"warning"}
    ];
    const aria = `${definition.name || "Solution"}: ${definition.solvent_ratio || "explicit solvent system"}`;
    return `<div class="solution-review" role="group" aria-label="${esc(aria)}">
      <div class="solution-composition"><div class="composition-heading"><div><small>Solvent system</small><strong>${esc(definition.solvent_ratio || solvents.map((item) => item.name).join(" : ") || "Not defined")}</strong></div>${badgeStatus(definition.status || "reviewed")}</div><div class="solution-key-facts" role="group" aria-label="Solution definition summary"><div><span>Reference volume</span><strong data-solution-volume>${esc(referenceVolume)}</strong></div><div><span>Concentration</span><strong data-solution-concentration>${esc(concentration)}</strong></div><div><span>State</span><strong>${esc(definition.state || "Reusable definition")}</strong></div></div><div class="solvent-meters" role="group" aria-label="Solvent composition">${solvents.map((item) => { const fill = Number.parseFloat(item.share) || 50; return `<div class="solvent-meter tone-${esc(item.tone || "interface")}"><span><b>${esc(item.name)}</b><small>${esc(item.role)}</small></span><strong>${esc(item.share)}</strong><div aria-hidden="true"><i style="--fill:${Math.max(0, Math.min(100, fill))}%"></i></div></div>`; }).join("")}</div><div class="solute-strip">${solutes.map((item) => `<span class="solute-${esc(item.tone || "interface")}"><b>${esc(item.name)}</b><small>${esc(item.share)}</small></span>`).join("")}</div></div>
      <div class="solution-technical table-wrap"><table class="table-dense"><thead><tr><th>Component</th><th>Function</th><th>Quantity</th><th>Composition</th></tr></thead><tbody>${components.map((item) => `<tr data-solution-component="${esc(item.tone)}"><td><i class="component-key tone-${esc(item.tone || "interface")}"></i><strong>${esc(item.name)}</strong></td><td>${esc(item.role)}</td><td data-component-amount>${esc(item.amount)}</td><td>${esc(item.share)}</td></tr>`).join("")}</tbody></table></div>
      <div class="validation-rail">${checks.map((item) => `<span class="${esc(item.state)}">${esc(item.label)}</span>`).join("")}</div>
    </div>`;
  }

  function stackReview(layers = stackLayers, selectable = true) {
    if (!asArray(layers).length) return `<div class="empty-state compact-empty">${icon("layers")}<strong>No stack layers declared</strong><p>Add fabrication producers or a stack definition to the CHOSE pipeline resources.</p></div>`;
    return `<div class="stack-review"><div class="stack-orientation"><span>Incident light</span><span>Device axis ↓</span></div><div class="stack-schematic">${[...layers].reverse().map((layer, reverseIndex) => { const index = layers.length - reverseIndex - 1; return `<button type="button" class="stack-band tone-${esc(layer.tone || "interface")}" data-stack-review-layer="${index}" ${selectable ? "" : "tabindex=\"-1\""}><span class="layer-order">${String(index + 1).padStart(2,"0")}</span><strong>${esc(layer.material)}</strong><span>${esc(layer.function)}</span><code>${esc(layer.thickness)}</code></button>`; }).join("")}</div><div class="stack-legend">${[["substrate","Substrate/contact"],["etl","Electron transport"],["absorber","Absorber"],["htl","Hole transport"],["contact","Metal contact"]].map(([tone,label]) => `<span><i class="tone-${tone}"></i>${label}</span>`).join("")}</div><div class="stack-layer-detail" id="stack-layer-detail"><small>Selected layer 01</small><strong>${esc(layers[0].material)}</strong><span>${esc(layers[0].function)} · ${esc(layers[0].process)} · ${esc(layers[0].thickness)}</span></div></div>`;
  }

  function bindStackReview(layers, root = document) {
    $$('[data-stack-review-layer]', root).forEach((button) => button.addEventListener("click", () => {
      $$('[data-stack-review-layer]', root).forEach((item) => item.classList.toggle("active", item === button));
      const index = Number(button.dataset.stackReviewLayer);
      const layer = layers[index];
      const detail = $("#stack-layer-detail", root);
      if (detail && layer) detail.innerHTML = `<small>Selected layer ${String(index + 1).padStart(2,"0")}</small><strong>${esc(layer.material)}</strong><span>${esc(layer.function)} · ${esc(layer.process)} · ${esc(layer.thickness)}</span>`;
    }));
  }

  function stackEditorRow(layer, index) {
    const field = (name, label, value) => `<label class="layer-field layer-field-${name}"><span>${label}</span><input class="input" data-layer-field="${name}" aria-label="Layer ${index + 1} ${name}" value="${esc(value)}"></label>`;
    return `<div class="layer" data-layer data-tone="${esc(layer.tone || "interface")}" draggable="true"><span class="layer-grip" title="Drag to reorder" aria-hidden="true">${icon("grip")}</span><span class="step-index">${String(index + 1).padStart(2,"0")}</span>${field("material","Material",layer.material)}${field("thickness","Thickness",layer.thickness)}${field("function","Function",layer.function)}${field("process","Process",layer.process)}<div class="layer-actions"><button class="btn btn-ghost icon-btn" data-layer-move="up" aria-label="Move layer up">${icon("chevron-up")}</button><button class="btn btn-ghost icon-btn" data-layer-move="down" aria-label="Move layer down">${icon("chevron-down")}</button><button class="btn btn-ghost icon-btn" data-layer-copy aria-label="Duplicate layer">${icon("copy")}</button><button class="btn btn-ghost icon-btn" data-layer-delete aria-label="Delete layer">${icon("trash")}</button></div></div>`;
  }

  function solutionComponentEditor(components = solutionComponents) {
    return `<div class="solution-component-editor" id="solution-component-editor"><div class="solution-component-head"><span></span><span>Component</span><span>Function</span><span>Quantity</span><span>Composition</span><span>Order</span></div>${components.map((item,index)=>`<article class="solution-component-row tone-${esc(item.tone)}" data-solution-row data-tone="${esc(item.tone)}" draggable="true"><span class="solution-grip" title="Drag to reorder">${icon("grip")}</span><label><span>Component</span><input class="input" data-solution-field="name" value="${esc(item.name)}"></label><label><span>Function</span><input class="input" data-solution-field="role" value="${esc(item.role)}"></label><label><span>Quantity</span><input class="input" data-solution-field="amount" value="${esc(item.amount)}"></label><label><span>Composition</span><input class="input" data-solution-field="share" value="${esc(item.share)}"></label><div class="solution-order-actions"><button class="btn btn-ghost icon-btn" data-solution-move="up" aria-label="Move component up">${icon("chevron-up")}</button><button class="btn btn-ghost icon-btn" data-solution-move="down" aria-label="Move component down">${icon("chevron-down")}</button><span class="badge">${String(index+1).padStart(2,"0")}</span></div></article>`).join("")}</div>`;
  }

  function processChemistryView(pipeline = CHOSE_CONTRACT) {
    const demo = choseDemo(pipeline, "process", CHOSE_DEMO_PROCESS);
    const definitions = asArray(demo.solution_definitions);
    const definition = definitions[0] || activeSolutionDefinition;
    const components = asArray(definition.components).length ? asArray(definition.components) : solutionComponents;
    const solutionTypes = asArray(pipelineResource(pipeline, "defaults", "solution_types", {}).items).length
      ? asArray(pipelineResource(pipeline, "defaults", "solution_types", {}).items)
      : CHOSE_SOLUTION_TYPES;
    const soluteMasses = components.filter((item) => item.phase !== "solvent").slice(0, 3);
    const referenceVolume = definition.reference_volume || {value:2, unit:"mL"};
    const concentration = definition.target_concentration || {value:1.25, unit:"mol/L"};
    const warningCount = asArray(definition.checks).filter((item) => item.state === "warning").length;
    return `<div class="stack"><div class="process-definition-strip" aria-label="Reusable solution definitions">${definitions.map((item, index) => `<button class="definition-card ${index === 0 ? "active" : ""}" type="button" data-definition-card><span class="object-icon">${icon("flask")}</span><span><small>${esc(item.id)}${item.version ? `/v${esc(item.version)}` : ""} · ${esc(item.type)}</small><strong>${esc(item.name)}</strong><em>${esc(item.summary || `${item.solvent_ratio || "Explicit composition"} · ${item.status || "draft"}`)}</em></span></button>`).join("")}<button class="definition-card definition-card-add" type="button" id="add-solution-definition">${icon("plus")}<span><strong>New definition</strong><em>Custom or commercial solution</em></span></button></div>
      <div class="scientific-builder-layout"><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Solution Definition</h3><small>Reusable recipe only · execution fields are forbidden by the pipeline contract</small></div><span class="badge badge-accent">${esc(definition.id || "SOL-NEW")}/v${esc(definition.version || 1)}</span></div><div class="panel-body form-grid">
        <div class="field wide"><label for="solution-recipe">Definition name</label><input class="input" id="solution-recipe" value="${esc(definition.name || "New solution definition")}"></div><div class="field"><label for="solution-type">Solution type</label><select class="select" id="solution-type">${solutionTypes.map((item) => `<option ${item.label === definition.type ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select></div>
        <div class="field"><label for="solution-volume">Reference volume</label><div class="input-group"><input class="input" id="solution-volume" type="number" min="0.1" value="${esc(referenceVolume.value)}"><span class="btn">${esc(referenceVolume.unit)}</span></div></div><div class="field"><label for="solution-molarity">Target concentration</label><div class="input-group"><input class="input" id="solution-molarity" type="number" min="0.05" step="0.05" value="${esc(concentration.value)}"><span class="btn">${esc(concentration.unit)}</span></div></div>
        <div class="field"><label for="solvent-ratio">Solvent ratio</label><input class="input" id="solvent-ratio" value="${esc(definition.solvent_ratio || "Explicit component quantities")}"></div><div class="field"><label for="solution-validation">Definition state</label><input class="input" id="solution-validation" value="${warningCount ? `${warningCount} contract warning${warningCount === 1 ? "" : "s"}` : "Ready for process versioning"}" readonly></div>
        <div class="field wide"><label for="preparation-handling">Handling during preparation</label><textarea class="textarea" id="preparation-handling">${esc(definition.preparation_handling || "")}</textarea></div><div class="field wide"><label for="before-use-handling">Handling before use</label><textarea class="textarea" id="before-use-handling">${esc(definition.before_use_handling || "")}</textarea></div>
        ${soluteMasses.map((item, index) => `<div class="field ${index === soluteMasses.length - 1 && soluteMasses.length % 2 ? "wide" : ""}"><label for="solute-mass-${index}">${esc(item.name)} reference quantity</label><input class="input" id="${item.tone === "fai" ? "fai-mass" : item.tone === "mai" ? "mai-mass" : item.tone === "pbi" ? "pbi-mass" : `solute-mass-${index}`}" value="${esc(item.amount)}" readonly></div>`).join("")}
      </div><div class="solution-components-block"><div class="section-heading compact-heading"><div><h4>Recipe components</h4><p>Solvents, solutes and stock-solution references come from the bundled pipeline definition.</p></div><span class="badge">Drag or use arrows</span></div>${solutionComponentEditor(components)}</div><div class="panel-footer action-footer"><small>Saving creates a reusable definition version; it never creates a prepared batch.</small><div class="cluster"><button class="btn" id="duplicate-solution">Duplicate definition</button><button class="btn" id="save-solution">Add temporary definition</button><button class="btn btn-primary" id="recalculate">Recalculate</button></div></div></section>
      <section class="panel"><div class="panel-header"><div><h3 class="mb-0">Solution Review</h3><small>Composition, scale formula, handling and YAML-defined checks</small></div><span class="badge ${warningCount ? "badge-warning" : "badge-success"}">${warningCount ? `${warningCount} warning${warningCount === 1 ? "" : "s"}` : "Ready"}</span></div><div class="panel-body" id="solution-review">${solutionReview(components, definition)}</div><div class="panel-footer"><div class="validation-rail">${asArray(definition.checks).map((item) => `<span class="${esc(item.state)}">${esc(item.label)}</span>`).join("")}</div></div></section></div></div>`;
  }

  function fabricationOperationsTable(pipeline = CHOSE_CONTRACT) {
    const demo = choseDemo(pipeline, "process", CHOSE_DEMO_PROCESS);
    const operations = asArray(demo.fabrication_operations);
    const operationTypes = asArray(pipelineResource(pipeline, "defaults", "operation_types", {}).items).length
      ? asArray(pipelineResource(pipeline, "defaults", "operation_types", {}).items)
      : CHOSE_OPERATION_TYPES;
    return `<div class="table-wrap"><table class="table-dense operation-table"><thead><tr><th>#</th><th>Operation</th><th>Material / solution</th><th>Planned parameters</th><th>Duration / target</th><th>Capability</th><th>Rule</th><th></th></tr></thead><tbody id="fabrication-operations">${operations.map((item, index) => `<tr data-operation-id="${esc(item.id)}"><td><span class="step-index">${String(index + 1).padStart(2,"0")}</span></td><td><select class="select" aria-label="Operation type">${operationTypes.map((type) => `<option ${type.id === item.type ? "selected" : ""} value="${esc(type.id)}">${esc(type.label)}</option>`).join("")}</select></td><td><input class="input" value="${esc(item.material === "none" ? "—" : item.material)}"></td><td><input class="input" value="${esc(item.planned)}"></td><td><input class="input" value="${esc(item.target)}"></td><td><input class="input" value="${esc(item.capability || "unassigned")}"></td><td><select class="select"><option ${item.required ? "selected" : ""}>Required</option><option ${!item.required ? "selected" : ""}>Optional</option></select></td><td><button class="btn btn-ghost icon-btn" data-remove-operation aria-label="Remove operation">${icon("trash")}</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  function processFabricationView(pipeline = CHOSE_CONTRACT) {
    const demo = choseDemo(pipeline, "process", CHOSE_DEMO_PROCESS);
    const substrate = demo.substrate || {};
    const dimensions = substrate.dimensions || {};
    const operations = asArray(demo.fabrication_operations);
    const stack = demo.stack || {};
    const checks = stepGate(pipeline, pipelineStep(pipeline, "process")).rules.map((item) => ({state:item.status === "pass" ? "success" : item.status, title:item.id, detail:item.detail}));
    const processBoundary = pipeline.data_boundaries?.process || {};
    const experimentBoundary = pipeline.data_boundaries?.experiment || {};
    const contractRows = [
      `Process owns ${asArray(processBoundary.owns).length} planned-data groups and forbids ${asArray(processBoundary.forbids).length} execution fields.`,
      `Every required operation records actual values and execution time in Experiment.`,
      `Experiment owns ${asArray(experimentBoundary.owns).length} execution-data groups, including batches, samples and deviations.`,
      `Deviations never overwrite the immutable process snapshot.`
    ];
    const quantity = (entry, fallbackValue, fallbackUnit) => entry || {value:fallbackValue, unit:fallbackUnit};
    const roughness = quantity(substrate.roughness_rms, 1, "nm");
    const length = quantity(dimensions.length, 2, "cm");
    const width = quantity(dimensions.width, 2, "cm");
    const thickness = quantity(dimensions.thickness, 1, "mm");
    return `<div class="stack"><div class="grid grid-2 process-substrate-grid"><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Substrate Definition</h3><small>Reusable geometry and surface properties from the process contract</small></div><span class="badge">${esc(substrate.id || "SUB-NEW")}/v${esc(substrate.version || 1)}</span></div><div class="panel-body form-grid"><div class="field"><label>Name</label><input class="input" value="${esc(substrate.name || "Substrate")}"></div><div class="field"><label>Material</label><select class="select">${[substrate.material, ...asArray(substrate.alternatives)].filter(Boolean).map((item, index) => `<option ${index === 0 ? "selected" : ""}>${esc(item)}</option>`).join("")}</select></div><div class="field"><label>Rigidity</label><select class="select">${asArray(substrate.rigidity_options).map((item) => `<option ${item === substrate.rigidity ? "selected" : ""}>${esc(item)}</option>`).join("")}</select></div><div class="field"><label>Surface roughness RMS</label><div class="input-group"><input class="input" type="number" value="${esc(roughness.value)}"><span class="btn">${esc(roughness.unit)}</span></div></div><div class="field"><label>Length</label><div class="input-group"><input class="input" type="number" value="${esc(length.value)}"><span class="btn">${esc(length.unit)}</span></div></div><div class="field"><label>Width</label><div class="input-group"><input class="input" type="number" value="${esc(width.value)}"><span class="btn">${esc(width.unit)}</span></div></div><div class="field wide"><label>Thickness</label><div class="input-group"><input class="input" type="number" value="${esc(thickness.value)}"><span class="btn">${esc(thickness.unit)}</span></div></div></div></section><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Process Contract</h3><small>Executable ownership boundaries loaded from pipeline.yaml</small></div>${icon("check")}</div><div class="panel-body check-list">${contractRows.map((row) => `<div class="check-row">${icon("check")}<span>${esc(row)}</span></div>`).join("")}</div></section></div>
      <section class="panel"><div class="panel-header"><div><h3 class="mb-0">Ordered Fabrication Operations</h3><small>Producer-before-consumer sequence used to generate the expected device stack</small></div><button class="btn btn-sm" id="add-operation">${icon("plus")} Add operation</button></div><div class="panel-body">${fabricationOperationsTable(pipeline)}</div><div class="panel-footer action-footer"><small>Process parameters are planned values. Actual values are captured only in Experiment.</small><span class="badge badge-success">${operations.filter((item) => item.required).length} required operations</span></div></section>
      <div class="grid grid-2"><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Generated Stack Preview</h3><small>Derived from operations that declare a produced layer</small></div><span class="badge badge-accent">${esc(stack.id || "STK-NEW")}/v${esc(stack.version || 1)}</span></div><div class="panel-body" id="fabrication-stack-review">${stackReview(asArray(stack.layers).length ? asArray(stack.layers) : stackLayers)}</div></section><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Process Validation</h3><small>Deterministic completion rules declared by pipeline.yaml</small></div>${icon("check")}</div><div class="panel-body stack">${checks.map((item) => `<div class="notice notice-${item.state === "warning" ? "warning" : "success"}"><div>${icon(item.state === "warning" ? "warning" : "check")}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div></div>`).join("")}</div></section></div></div>`;
  }

  function processStackView(pipeline = CHOSE_CONTRACT) {
    const stack = choseDemo(pipeline, "process", CHOSE_DEMO_PROCESS).stack || {};
    const layers = asArray(stack.layers).length ? asArray(stack.layers) : stackLayers;
    const completion = pipelineStep(pipeline, "process")?.completion || {};
    const producerRule = asArray(completion.rules).find((item) => item.id === "producer-before-consumer");
    return `<div class="scientific-builder-layout"><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Stack Definition</h3><small>Review or correct the stack generated by fabrication operations</small></div><button class="btn btn-sm" id="add-layer">${icon("plus")} Add layer</button></div><div class="panel-body"><div class="layer-columns" aria-hidden="true"><span></span><span>#</span><span>Material</span><span>Thickness</span><span>Function</span><span>Process</span><span>Actions</span></div><div class="layers" id="layer-editor">${layers.map(stackEditorRow).join("")}</div></div><div class="panel-footer action-footer"><small>${esc(producerRule ? "Manual corrections are checked by stack_layers_have_producing_operations." : "Manual corrections must remain consistent with fabrication operations.")}</small><div class="cluster"><button class="btn" id="save-stack-template">Add temporary template</button><button class="btn btn-primary" id="apply-stack-version">Apply process version</button></div></div></section><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Stack Review</h3><small>${esc(stack.architecture || "Device")} architecture with selectable layer details</small></div><span class="badge badge-success">Order valid</span></div><div class="panel-body" id="stack-review">${stackReview(layers)}</div><div class="panel-footer"><div class="validation-rail"><span class="valid">${esc(stack.architecture || "device")} order valid</span><span class="valid">All layers traceable</span><span class="warning">Equipment category review</span></div></div></section></div>`;
  }

  function sectionTabs(step, dataAttribute, activeId = null) {
    const sections = asArray(step?.sections);
    const selected = activeId || sections[0]?.id;
    return sections.map((section) => `<button class="tab ${section.id === selected ? "active" : ""}" data-${dataAttribute}="${esc(section.id)}" title="${esc(section.description || "")}">${esc(section.title)}</button>`).join("");
  }

  function processStep(project, pipeline = CHOSE_CONTRACT, step = pipelineStep(pipeline, "process")) {
    const sections = pipelineSections(pipeline, step?.id || "process");
    const first = sections[0] || {id:"chemistry"};
    return `<div class="panel contained-workspace"><div class="tabs pipeline-section-tabs" role="tablist" aria-label="Process sections">${sectionTabs(step, "process-tab", first.id)}</div><div class="panel-body" id="process-content">${renderRegisteredSection(first.component, {project, pipeline, step, section:first})}</div></div>`;
  }

  function experimentSetupView(project, pipeline = CHOSE_CONTRACT) {
    const demo = choseDemo(pipeline, "experiment", CHOSE_DEMO_EXPERIMENT);
    const experiment = demo.experiment || {};
    const snapshot = experiment.process_snapshot || {};
    const batches = asArray(demo.batches);
    const samples = asArray(demo.samples);
    return `<div class="stack"><section class="experiment-identity"><div><span class="page-eyebrow">Experiment instance</span><h3>${esc(experiment.name || "New experiment")}</h3><p>Concrete execution of an immutable process snapshot defined by the pipeline contract.</p></div><div class="experiment-id"><small>Experiment ID</small><strong>${esc(experiment.experiment_id || "EXP-NEW")}</strong>${badgeStatus(experiment.status || "draft")}</div></section><div class="snapshot-banner"><span class="object-icon">${icon("layers")}</span><div><small>Process snapshot</small><strong>${esc(snapshot.label || `${snapshot.process_id || "Process"}/v${snapshot.version || 1}`)}</strong><p>Snapshot identity: ${esc(snapshot.demo_hash || "immutable record hash pending")}. Later process edits do not mutate this experiment.</p></div><button class="btn btn-sm">View snapshot</button></div>
      <div class="grid grid-2"><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Experiment Metadata</h3><small>Execution identity and responsibility required by the experiment schema</small></div>${icon("edit")}</div><div class="panel-body form-grid"><div class="field wide"><label>Experiment name</label><input class="input" value="${esc(experiment.name || "")}"></div><div class="field"><label>Start date</label><input class="input" type="date" value="${esc(experiment.start_date || "")}"></div><div class="field"><label>Operator</label><select class="select">${asArray(experiment.operator_options).map((item) => `<option ${item === experiment.operator ? "selected" : ""}>${esc(item)}</option>`).join("")}</select></div><div class="field"><label>Environment</label><select class="select">${asArray(experiment.environment_options).map((item) => `<option ${item === experiment.environment?.atmosphere ? "selected" : ""}>${esc(item)}</option>`).join("")}</select></div><div class="field"><label>Experiment status</label><select class="select"><option ${experiment.status === "active" ? "selected" : ""}>In progress</option><option>Ready for results</option><option>Completed</option></select></div></div></section><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Selected Material Batches</h3><small>Actual preparations and lots owned by Experiment, never Process</small></div><button class="btn btn-sm">${icon("plus")} Select batch</button></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Batch</th><th>Definition</th><th>Prepared</th><th>Operator</th><th>QC</th></tr></thead><tbody>${batches.map((item) => `<tr><td><strong>${esc(item.id)}</strong></td><td>${esc(item.definition)}</td><td>${esc(item.prepared)}</td><td>${esc(item.operator)}</td><td>${badgeStatus(item.status || "draft")}</td></tr>`).join("")}</tbody></table></div></section></div>
      <section class="panel"><div class="panel-header"><div><h3 class="mb-0">Samples & Devices</h3><small>Stable instances generated for this experiment, not reusable definitions</small></div><button class="btn btn-sm" id="add-experiment-sample">${icon("plus")} Add sample</button></div><div class="table-wrap"><table class="table-dense sample-instance-table"><thead><tr><th>Sample</th><th>Substrate</th><th>Process variant</th><th>Precursor batch</th><th>Devices</th><th>Status</th><th></th></tr></thead><tbody id="experiment-samples">${samples.map((item) => `<tr><td><input class="input" value="${esc(item.id)}"></td><td><select class="select"><option>${esc(item.substrate)}</option></select></td><td><select class="select"><option>${esc(item.variant)}</option></select></td><td><select class="select"><option>${esc(item.precursor_batch)}</option>${batches.map((batch) => `<option>${esc(batch.id)}</option>`).join("")}</select></td><td><input class="input" type="number" value="${esc(item.devices)}"></td><td>${badgeStatus(item.status || "draft")}</td><td><button class="btn btn-ghost icon-btn" aria-label="Duplicate sample">${icon("copy")}</button></td></tr>`).join("")}</tbody></table></div></section></div>`;
  }

  function experimentExecutionView(project, pipeline = CHOSE_CONTRACT) {
    const demo = choseDemo(pipeline, "experiment", CHOSE_DEMO_EXPERIMENT);
    const experiment = demo.experiment || {};
    const rows = asArray(demo.execution_records);
    const deviations = asArray(demo.deviations);
    const completion = demo.completion || {};
    const deviation = deviations[0] || {};
    return `<div class="stack"><div class="notice"><div>${icon("info")}</div><div><strong>Planned values remain read-only</strong><p>Record actual values, equipment, execution time and deviations without changing ${esc(experiment.process_snapshot?.label || "the process snapshot")}.</p></div></div><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Execution Record</h3><small>Planned process versus what was actually performed</small></div><span class="badge ${deviations.length ? "badge-warning" : "badge-success"}">${deviations.length} deviation${deviations.length === 1 ? "" : "s"}</span></div><div class="table-wrap"><table class="table-dense execution-table"><thead><tr><th>#</th><th>Operation</th><th>Planned</th><th>Actual</th><th>Execution time</th><th>Equipment</th><th>Status</th></tr></thead><tbody>${rows.map((item, index) => `<tr data-operation-id="${esc(item.operation_id)}"><td><span class="step-index">${String(item.order || index + 1).padStart(2,"0")}</span></td><td><strong>${esc(item.operation)}</strong></td><td><code>${esc(item.planned)}</code></td><td><input class="input ${item.status === "deviation" ? "input-warning" : ""}" value="${esc(item.actual)}"></td><td><input class="input" value="${esc(item.execution_time)}"></td><td><select class="select"><option>${esc(item.equipment || "Unassigned")}</option></select></td><td>${badgeStatus(item.status === "deviation" ? "review" : "reviewed")}</td></tr>`).join("")}</tbody></table></div></section><div class="grid grid-2"><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Deviation Record</h3><small>Researcher-authored explanation and consequence</small></div>${icon("warning")}</div><div class="panel-body form-grid"><div class="field wide"><label>Deviation</label><textarea class="textarea">${esc(deviation.statement || "No deviation recorded.")}</textarea></div><div class="field"><label>Impact assessment</label><select class="select"><option>${esc(deviation.impact || "No impact")}</option><option>Requires repeat</option></select></div><div class="field"><label>Decision</label><select class="select"><option>${esc(deviation.decision || "Keep visible")}</option><option>Exclude after review</option></select></div></div></section><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Execution Completeness</h3><small>Required evidence for result upload</small></div>${icon("check")}</div><div class="panel-body stack"><div class="notice notice-success"><div>${icon("check")}</div><div><strong>${esc(completion.recorded_operations || rows.length)} of ${esc(completion.required_operations || rows.length)} operations recorded</strong><p>Actual values and execution time are present.</p></div></div>${asArray(completion.warnings).map((warning) => `<div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Visible completion warning</strong><p>${esc(warning)}</p></div></div>`).join("")}</div></section></div></div>`;
  }

  function experimentSummaryView(project, pipeline = CHOSE_CONTRACT) {
    const demo = choseDemo(pipeline, "experiment", CHOSE_DEMO_EXPERIMENT);
    const experiment = demo.experiment || {};
    const samples = asArray(demo.samples);
    const batches = asArray(demo.batches);
    const deviations = asArray(demo.deviations);
    const devices = samples.reduce((sum, item) => sum + Number(item.devices || 0), 0);
    const completion = demo.completion || {};
    return `<div class="stack"><div class="grid grid-4">${[["Process snapshot",experiment.process_snapshot?.label || "—","Immutable"],["Samples",samples.length,samples.map((item) => item.id).join("–")],["Devices",`${devices} declared`,"Measurement count reconciled in Results"],["Deviations",deviations.length,deviations[0]?.impact || "None"]].map(([a,b,c]) => `<div class="card kpi"><div class="kpi-label">${esc(a)}</div><div class="kpi-value kpi-value-medium">${esc(b)}</div><div class="kpi-detail">${esc(c)}</div></div>`).join("")}</div><div class="grid grid-2"><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Experiment Summary</h3><small>Records ready to accompany measurement files</small></div>${icon("file")}</div><div class="panel-body metadata-list"><div><span>Experiment</span><strong>${esc(experiment.experiment_id)} · ${esc(experiment.name)}</strong></div><div><span>Process</span><strong>${esc(experiment.process_snapshot?.label || "—")}</strong></div><div><span>Batches</span><strong>${esc(batches.map((item) => item.id).join(" · "))}</strong></div><div><span>Samples</span><strong>${esc(samples.map((item) => item.id).join(" · "))}</strong></div><div><span>Operator</span><strong>${esc(experiment.operator || "—")}</strong></div><div><span>Execution window</span><strong>${esc(experiment.execution_window || "—")}</strong></div></div></section><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Ready for Results?</h3><small>YAML-defined gate before files and measurements are attached</small></div>${icon("check")}</div><div class="panel-body stack"><div class="notice ${completion.ready_for_results ? "notice-success" : "notice-warning"}"><div>${icon(completion.ready_for_results ? "check" : "warning")}</div><div><strong>${completion.ready_for_results ? "Experiment structure is complete" : "Experiment requires completion"}</strong><p>Process, batches, samples, devices and execution records are evaluated against the pipeline contract.</p></div></div>${asArray(completion.warnings).map((warning) => `<div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Proceed with visible warning</strong><p>${esc(warning)}</p></div></div>`).join("")}<a class="btn btn-primary" href="project.html?project=${encodeURIComponent(project?.id || "PRJ-2026-014")}&step=results">Continue to Results</a></div></section></div></div>`;
  }

  function experimentStep(project, pipeline = CHOSE_CONTRACT, step = pipelineStep(pipeline, "experiment")) {
    const sections = pipelineSections(pipeline, step?.id || "experiment");
    const first = sections[0] || {id:"setup"};
    return `<div class="panel contained-workspace"><div class="tabs pipeline-section-tabs" role="tablist" aria-label="Experiment sections">${sectionTabs(step, "experiment-tab", first.id)}</div><div class="panel-body" id="experiment-content">${renderRegisteredSection(first.component, {project, pipeline, step, section:first})}</div></div>`;
  }

  function resultFilesView(project, pipeline = CHOSE_CONTRACT) {
    const demo = choseDemo(pipeline, "results", CHOSE_DEMO_RESULTS);
    const resultSet = demo.result_set || {};
    const files = asArray(demo.source_files);
    const accepted = asArray(choseMapping(pipeline, "jv", CHOSE_JV_MAPPING).accepted_sources);
    const linkedExperiments = new Set(files.map((item) => item.experiment_id).filter(Boolean));
    const unassigned = files.filter((item) => !item.experiment_id).length;
    return `<div class="stack"><div class="grid grid-3"><div class="card kpi"><div class="kpi-label">Result sets</div><div class="kpi-value">1</div><div class="kpi-detail">${esc(resultSet.result_set_id || "Draft result set")}</div></div><div class="card kpi"><div class="kpi-label">Source files</div><div class="kpi-value">${files.length}</div><div class="kpi-detail">${accepted.map((item) => item.toUpperCase()).join(", ")}</div></div><div class="card kpi"><div class="kpi-label">Unassigned files</div><div class="kpi-value">${unassigned}</div><div class="kpi-detail">${linkedExperiments.size} linked experiment${linkedExperiments.size === 1 ? "" : "s"}</div></div></div><div class="grid grid-2"><label class="dropzone" for="file-input">${icon("upload")}<h3 class="mt-1">Add result files</h3><p>Attach files to an experiment, then assign sample, device and measurement type. Files remain local.</p><span class="btn btn-primary">Choose files</span><input id="file-input" type="file" multiple accept="${accepted.map((item) => `.${item}`).join(",")}"></label><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Result Set Identity</h3><small>Files belong to a named result set, not directly to the project</small></div><span class="badge badge-accent">${esc(resultSet.result_set_id || "RST-NEW")}</span></div><div class="panel-body form-grid"><div class="field wide"><label>Result set name</label><input class="input" value="${esc(resultSet.name || "New result set")}"></div><div class="field"><label>Experiment</label><select class="select"><option>${esc(resultSet.experiment_id || "Select experiment")}</option>${[...linkedExperiments].filter((item) => item !== resultSet.experiment_id).map((item) => `<option>${esc(item)}</option>`).join("")}</select></div><div class="field"><label>Measurement type</label><select class="select"><option>${esc(resultSet.measurement_type || "Custom")}</option></select></div><div class="field"><label>Instrument</label><select class="select"><option>${esc(resultSet.instrument || "Unassigned")}</option></select></div><div class="field"><label>Acquired by</label><select class="select"><option>${esc(resultSet.acquired_by || "Unassigned")}</option></select></div></div></section></div><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Files & Provenance</h3><small>Source identity, experiment link, sample scope and parsing state</small></div><span class="badge">${files.length} source files</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>File</th><th>Experiment</th><th>Samples / devices</th><th>Type</th><th>Rows</th><th>Parsing</th><th>Quality</th></tr></thead><tbody id="ingest-files">${files.map((item) => `<tr><td>${esc(item.file_name)}</td><td>${esc(item.experiment_id || "Unassigned")}</td><td>${esc(item.sample_scope || "—")}</td><td>${esc(item.measurement_type || "—")}</td><td>${esc(item.rows || "—")}</td><td>${esc(item.parser || resultSet.parser_profile || "—")}</td><td>${item.quality_label ? `<span class="badge badge-warning">${esc(item.quality_label)}</span>` : badgeStatus(item.quality || "draft")}</td></tr>`).join("")}</tbody></table></div></section></div>`;
  }

  function resultMappingView(project, pipeline = CHOSE_CONTRACT) {
    const mapping = choseMapping(pipeline, "jv", CHOSE_JV_MAPPING);
    const fields = asArray(mapping.fields);
    const decisions = fields.filter((item) => item.decision !== "confirmed").length;
    const currentDensity = fields.find((item) => item.source === "Jsc") || fields[0] || {};
    return `<div class="stack"><div class="notice"><div>${icon("info")}</div><div><strong>Mapping creates derived normalized records</strong><p>Source files remain immutable. Every conversion is shown before researcher confirmation; silent conversion is ${mapping.allow_silent_conversion ? "allowed" : "forbidden"}.</p></div></div><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Field & Unit Mapping</h3><small>${esc(mapping.label || mapping.id || "Mapping profile")}</small></div><span class="badge ${decisions ? "badge-warning" : "badge-success"}">${decisions} decision${decisions === 1 ? "" : "s"}</span></div><div class="table-wrap"><table class="table-dense mapping-table"><thead><tr><th>Source column</th><th>Destination field</th><th>Source → target unit</th><th>Conversion</th><th>Confidence</th><th>Preview</th><th>Decision</th></tr></thead><tbody>${fields.map((row) => `<tr><td><code>${esc(row.source)}</code></td><td><select class="select"><option>${esc(row.target)}</option><option>Ignore column</option></select></td><td>${esc(row.source_unit)} → ${esc(row.target_unit)}</td><td>${esc(row.conversion === "multiply_10" ? "× 10" : row.conversion === "FWD_to_forward" ? "FWD → forward" : "None")}</td><td><span class="confidence-badge confidence-${Number(row.confidence) > 95 ? "high" : "medium"}">${esc(row.confidence)}%</span></td><td>${esc(row.preview)}</td><td><select class="select"><option>${row.decision === "confirmed" ? "Confirm" : "Review"}</option><option>Correct</option><option>Ignore</option></select></td></tr>`).join("")}</tbody></table></div><div class="panel-footer action-footer"><small>Required links: ${asArray(mapping.required_links).map(esc).join(" · ")}</small><div class="cluster"><button class="btn" id="save-mapping-preset">Save temporary preset</button><button class="btn btn-primary" id="preview-normalized">Preview normalized records</button></div></div></section><div class="grid grid-2"><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Normalized Preview</h3><small>Original and derived values stay distinguishable</small></div>${icon("table")}</div><div class="panel-body"><div class="metadata-list"><div><span>Source</span><strong>${esc(currentDensity.source)} = ${esc(currentDensity.preview)}</strong></div><div><span>Destination</span><strong>${esc(currentDensity.target)}</strong></div><div><span>Rule</span><strong>${esc(currentDensity.conversion || "none")}</strong></div><div><span>Evidence</span><strong>${esc(mapping.id || "mapping")} · source field ${esc(currentDensity.source)}</strong></div></div></div></section><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Mapping Gate</h3><small>Required identity and unit checks from the mapping contract</small></div>${icon("check")}</div><div class="panel-body stack"><div class="notice notice-success"><div>${icon("check")}</div><div><strong>Stable identity links are required</strong><p>${asArray(mapping.required_links).map(esc).join(" and ")} connect every normalized record.</p></div></div><div class="notice ${mapping.require_unit_confirmation ? "notice-warning" : "notice-success"}"><div>${icon(mapping.require_unit_confirmation ? "warning" : "check")}</div><div><strong>${mapping.require_unit_confirmation ? "Researcher unit confirmation required" : "Units can be accepted automatically"}</strong><p>Current-density conversion remains visible and reversible in the POC.</p></div></div></div></section></div></div>`;
  }

  function resultQualityView(project, pipeline = CHOSE_CONTRACT) {
    const measurements = asArray(choseDemo(pipeline, "results", CHOSE_DEMO_RESULTS).normalized_records);
    return `<div class="stack">${experimentInspector(pipeline)}<section class="panel"><div class="panel-header"><div><h3 class="mb-0">Validated Measurement Preview</h3><small>Result records linked to experiment, sample and source file</small></div><span class="badge badge-success">${measurements.length} samples</span></div><div class="panel-body"><div class="table-wrap">${datasetTable(measurements.length ? measurements : D.demoDataset)}</div></div></section></div>`;
  }

  function resultsStep(project, pipeline = CHOSE_CONTRACT, step = pipelineStep(pipeline, "results")) {
    const sections = pipelineSections(pipeline, step?.id || "results");
    const first = sections[0] || {id:"files"};
    return `<div class="panel contained-workspace"><div class="tabs pipeline-section-tabs" role="tablist" aria-label="Result sections">${sectionTabs(step, "results-tab", first.id)}</div><div class="panel-body" id="results-content">${renderRegisteredSection(first.component, {project, pipeline, step, section:first})}</div></div>`;
  }

  function exportPackagePanel(project, pipeline = CHOSE_CONTRACT) {
    const formats = asArray(pipeline.exports?.formats).filter((item) => item.enabled !== false);
    const nomad = pipeline.exports?.nomad || {};
    const nomadMapping = choseMapping(pipeline, "nomad", CHOSE_NOMAD_MAPPING);
    const issues = asArray(choseDemo(pipeline, "results", CHOSE_DEMO_RESULTS).quality_issues);
    const blocking = issues.filter((item) => item.severity === "error").length;
    const visible = issues.filter((item) => ["error","warning"].includes(item.severity)).length;
    const formatById = Object.fromEntries(formats.map((item) => [item.id, item]));
    const localButtons = ["yaml","jsonl","csv"].filter((id) => formatById[id]).map((id) => `<button class="btn" data-export="${esc(id)}">${esc(formatById[id].label)}</button>`).join("");
    return `<section class="section export-package-section"><div class="section-heading"><div><h2>Report & Export Package</h2><p>Reviewed outputs and structured records follow the YAML export contract and preserve open issues.</p></div><span class="badge ${visible ? "badge-warning" : "badge-success"}">${visible} visible issue${visible === 1 ? "" : "s"}</span></div><div class="grid grid-2"><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Portable Project Package</h3><small>Complete local handoff without remote submission</small></div>${icon("download")}</div><div class="panel-body stack">${formatById.bundle ? `<div class="export-card"><span class="object-icon">${icon("database")}</span><div><strong>${esc(formatById.bundle.label)}</strong><p class="mb-0">Process snapshots, experiments, result sets, measurements, report files and provenance.</p></div><button class="btn btn-sm btn-primary" data-export="bundle">Generate package</button></div>` : ""}${nomad.enabled ? `<div class="export-card"><span class="object-icon">${icon("external")}</span><div><strong>NOMAD-ready preview</strong><p class="mb-0">${esc(nomadMapping.label || nomad.mapping_profile)} · ${esc(nomad.mode)} · no automatic upload.</p></div><button class="btn btn-sm" data-export="nomad">Generate preview</button></div>` : ""}<div class="cluster">${localButtons}</div></div></section><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Export Readiness</h3><small>Deterministic blockers remain visible in every package</small></div>${icon("check")}</div><div class="panel-body stack"><div class="notice notice-success"><div>${icon("check")}</div><div><strong>Preview package can be generated</strong><p>${asArray(pipeline.exports?.require).length} contract requirements are included in the manifest.</p></div></div>${blocking ? `<div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Final submission requires review</strong><p>${blocking} blocking error${blocking === 1 ? " remains" : "s remain"}; all are preserved in the export.</p></div></div>` : ""}<div class="notice"><div>${icon("lock")}</div><div><strong>No automatic upload</strong><p>Remote submission is ${nomad.remote_submission ? "enabled" : "disabled"} by pipeline.yaml.</p></div></div></div></section></div></section>`;
  }

  function reportAndExportView(project, pipeline = CHOSE_CONTRACT) {
    return `<div class="stack">${analysisReport(project, pipeline)}${exportPackagePanel(project, pipeline)}</div>`;
  }

  function reviewStep(project, pipeline = CHOSE_CONTRACT, step = pipelineStep(pipeline, "review")) {
    const sections = pipelineSections(pipeline, step?.id || "review");
    const first = sections[0] || {id:"overview"};
    return `<div class="panel contained-workspace"><div class="tabs pipeline-section-tabs" role="tablist" aria-label="Review sections">${sectionTabs(step, "review-tab", first.id)}</div><div class="panel-body" id="review-content">${renderRegisteredSection(first.component, {project, pipeline, step, section:first})}</div></div>`;
  }

  function formatOverviewMetric(value, format) {
    if (format === "percent_2") return `${Number(value).toFixed(2)}%`;
    if (format === "percent_0") return `${Number(value).toFixed(0)}%`;
    if (format === "voltage_2") return `${Number(value).toFixed(2)} V`;
    return String(Math.round(Number(value) || 0));
  }

  function analysisOverview(project, pipeline = CHOSE_CONTRACT) {
    const data = asArray(choseDemo(pipeline, "results", CHOSE_DEMO_RESULTS).normalized_records);
    const review = choseDemo(pipeline, "review", CHOSE_DEMO_REVIEW);
    const definitions = asArray(review.overview?.metrics);
    const findings = asArray(review.findings);
    const cards = definitions.map((definition) => {
      if (definition.source === "findings") return [definition.label, findings.length, definition.detail || "review records"];
      const values = data.map((row) => Number(row[definition.field])).filter(Number.isFinite);
      let value = 0;
      let detail = definition.detail || "cohort";
      if (definition.aggregation === "max") {
        const best = data.reduce((current, row) => !current || Number(row[definition.field]) > Number(current[definition.field]) ? row : current, null);
        value = best ? Number(best[definition.field]) : 0;
        if (best && definition.detail_field) detail = best[definition.detail_field] || detail;
      } else if (definition.aggregation === "mean") value = values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
      else if (definition.aggregation === "count") value = values.length;
      return [definition.label, formatOverviewMetric(value, definition.format), detail];
    });
    const chartMetrics = asArray(review.overview?.chart_metrics);
    const firstMetric = chartMetrics[0] || {id:"pce",label:"PCE"};
    return `<div class="stack"><div class="grid grid-5">${cards.map(([a, b, c]) => `<div class="card kpi"><div class="kpi-label">${esc(a)}</div><div class="kpi-value">${esc(b)}</div><div class="kpi-detail">${esc(c)}</div></div>`).join("")}</div>
      <div class="grid grid-2"><div class="panel"><div class="panel-header"><div><h3 class="mb-0" data-chart-title>${esc(firstMetric.label)} by sample</h3><small>Interactive canvas · YAML-declared metrics</small></div><div class="segmented" aria-label="Chart metric">${chartMetrics.map((metric,index) => `<button class="${index === 0 ? "active" : ""}" data-chart-metric="${esc(metric.id)}">${esc(metric.label)}</button>`).join("")}</div></div><div class="panel-body"><canvas class="chart" id="analysis-chart" width="900" height="360"></canvas></div></div><div class="panel ai-panel"><div class="panel-header"><div><h3 class="mb-0">Evidence-linked summary</h3><small>Review records loaded from demo/review.yaml</small></div>${icon("spark")}</div><div class="panel-body">${D.aiFindings.slice(0, 4).map(aiFinding).join("")}</div></div></div>
      <div class="panel"><div class="panel-header"><div><h3 class="mb-0">Measurement dataset</h3><small>Normalized values loaded from demo/results.yaml</small></div><button class="btn btn-sm" data-export="csv">${icon("download")} CSV</button></div><div class="panel-body"><div class="table-wrap">${datasetTable(data.length ? data : D.demoDataset)}</div></div></div></div>`;
  }

  function analysisFindings(pipeline = CHOSE_CONTRACT) {
    const policy = pipeline.review_policy || {};
    const humanReview = asArray(policy.human_review_required);
    const allowedTypes = asArray(policy.finding_types);
    const policyRows = [
      `Allowed finding classes: ${allowedTypes.length ? allowedTypes.join(", ") : "explicit scientific classes"}.`,
      `Human review is required for: ${humanReview.length ? humanReview.join(", ") : "all advisory content"}.`,
      `Every finding records evidence, score, type and review status.`,
      `Irreversible AI actions are ${policy.irreversible_ai_actions ? "allowed" : "forbidden"}.`
    ];
    return `<div class="grid grid-2"><div class="stack">${D.aiFindings.map((finding) => `<div class="panel ai-panel"><div class="panel-body"><div class="cluster mb-1"><span class="badge">${esc(finding.type || "finding")}</span><span class="badge">${esc(finding.id || "YAML contract")}</span></div>${aiFinding(finding)}<div class="cluster mt-1"><button class="btn btn-sm ${finding.status === "accepted" ? "btn-primary" : ""}" data-finding-action="Accepted">Accept</button><button class="btn btn-sm ${finding.status === "review" ? "btn-primary" : ""}" data-finding-action="Needs revision">Needs revision</button><a class="btn btn-sm btn-ghost" href="knowledge.html?q=${encodeURIComponent(finding.title)}">Link evidence</a></div></div></div>`).join("")}</div><div class="stack"><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Assistant review policy</h3><small>Explicit boundaries loaded from pipeline.yaml</small></div>${icon("lock")}</div><div class="panel-body check-list">${policyRows.map((row) => `<div class="check-row">${icon("check")}<span>${esc(row)}</span></div>`).join("")}</div></div><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Knowledge context</h3><small>Items supporting this review</small></div><a class="btn btn-sm" href="knowledge.html">Open Knowledge</a></div><div class="panel-body stack">${D.knowledge.slice(0, 4).map(knowledgeCard).join("")}</div></div></div></div>`;
  }

  function experimentInspector(pipeline = CHOSE_CONTRACT) {
    const issueIcon = (severity) => severity === "error" || severity === "warning" ? "warning" : severity === "suggestion" ? "spark" : "info";
    const demo = choseDemo(pipeline, "results", CHOSE_DEMO_RESULTS);
    const issues = asArray(demo.quality_issues).length ? asArray(demo.quality_issues) : asArray(D.validationIssues);
    const experiment = choseDemo(pipeline, "experiment", CHOSE_DEMO_EXPERIMENT).experiment || {};
    const measurements = asArray(demo.normalized_records);
    const errors = issues.filter((item) => item.severity === "error").length;
    const warnings = issues.filter((item) => item.severity === "warning").length;
    const resultStep = pipelineStep(pipeline, "results");
    const required = asArray(resultStep?.completion?.requires).length;
    const checks = asArray(choseMapping(pipeline, "jv", CHOSE_JV_MAPPING).quality_checks).length;
    return `<div class="stack"><div class="grid grid-4">${[["Contract fields",required,`${asArray(resultStep?.completion?.rules).length} completion rules`],["Data quality",`${errors} error${errors === 1 ? "" : "s"}`,`${warnings} warnings`],["Measurements",measurements.length,"source-linked rows"],["NOMAD",errors ? "Blocked" : "Preview ready",`${checks} quality checks`]].map(([a,b,c]) => `<div class="card kpi"><div class="kpi-label">${esc(a)}</div><div class="kpi-value kpi-value-medium">${esc(b)}</div><div class="kpi-detail">${esc(c)}</div></div>`).join("")}</div><div class="panel"><div class="panel-header"><div><h3 class="mb-0">${esc(experiment.experiment_id || "Experiment")} quality review</h3><small>Deterministic validation first; ambiguous text interpreted separately</small></div><a class="btn btn-sm" href="knowledge.html?q=Inspect%20${encodeURIComponent(experiment.experiment_id || "experiment")}">Open in Knowledge</a></div><div class="panel-body validation-list">${issues.map((item) => `<article class="validation-issue issue-${esc(item.severity)}"><div class="issue-icon">${icon(issueIcon(item.severity))}</div><div><div class="cluster"><strong>${esc(item.title)}</strong><span class="badge">${esc(item.severity)}</span></div><p>${esc(item.detail)}</p><small>${esc(item.source)} · ${esc(item.evidence)}</small></div></article>`).join("")}</div></div><div class="interpretation-stack">${asArray(demo.interpretation).map((item) => `<div><span class="badge ${item.type === "observation" ? "badge-success" : item.type === "correlation" ? "badge-accent" : item.type === "hypothesis" ? "badge-warning" : ""}">${esc(item.label || item.type)}</span><p>${esc(item.statement)}</p></div>`).join("")}</div></div>`;
  }

  function comparisonView(pipeline = CHOSE_CONTRACT) {
    const comparison = choseDemo(pipeline, "review", CHOSE_DEMO_REVIEW).comparison || {};
    const rows = asArray(comparison.rows);
    const warning = comparison.warning || {};
    const outlier = comparison.outlier || {};
    return `<div class="stack"><div class="comparison-summary"><div><span>Included experiments</span><strong>${asArray(comparison.included_experiments).map(esc).join(" · ") || "—"}</strong></div><div><span>Selection criteria</span><strong>${esc(comparison.selection_criteria || "—")}</strong></div><div><span>Parameters</span><strong>${asArray(comparison.parameters).map(esc).join(" · ") || "—"}</strong></div><div><span>Measurements</span><strong>${asArray(comparison.measurements).map(esc).join(" · ") || "—"}</strong></div></div>${warning.title ? `<div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>${esc(warning.title)}</strong><p>${esc(warning.detail)}</p></div></div>` : ""}<div class="grid grid-2"><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Comparison table</h3><small>YAML-defined demonstration summary</small></div></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Experiment</th><th>n</th><th>Mean PCE</th><th>Median PCE</th><th>Range</th><th>Missing</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${esc(row.experiment)}</td><td>${esc(row.n)}</td><td>${esc(row.mean_pce)}</td><td>${esc(row.median_pce)}</td><td>${esc(row.range)}</td><td>${esc(row.missing)}</td></tr>`).join("")}</tbody></table></div></div><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Simple outlier review</h3><small>${esc(outlier.method || "Deterministic review") } · no automatic exclusion</small></div></div><div class="panel-body stack"><div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>${esc(outlier.title || "Review candidate")}</strong><p>${esc(outlier.detail || "No outlier statement is configured.")}</p></div></div><div class="cluster"><a class="btn" href="knowledge.html?q=${encodeURIComponent(`Review ${outlier.sample || "outlier"} evidence`)}">Open evidence</a></div></div></div></div></div>`;
  }

  function reportSectionCatalog(pipeline = CHOSE_CONTRACT) {
    return asArray(choseDemo(pipeline, "review", CHOSE_DEMO_REVIEW).report?.section_catalog).map((item) => [item.id, item.title, item.detail, item.enabled_by_default !== false]);
  }


  function reportDefaults(project, pipeline = CHOSE_CONTRACT) {
    const settings = getSettings();
    const review = choseDemo(pipeline, "review", CHOSE_DEMO_REVIEW);
    const defaults = review.report?.defaults || {};
    const sections = reportSectionCatalog(pipeline);
    return {
      title: project.name,
      subtitle: defaults.subtitle || "Scientific project report",
      reportType: defaults.report_type || "Scientific project report",
      reportCode: `${project.id}-R01`,
      keywords: defaults.keywords || "",
      author: settings.reportAuthor,
      laboratory: settings.reportLab,
      organisation: settings.reportOrganisation,
      reportDate: new Date().toISOString().slice(0, 10),
      executiveSummary: defaults.executive_summary || "",
      objectives: project.objective,
      methodology: defaults.methodology || "",
      resultsNarrative: defaults.results_narrative || "",
      discussion: defaults.discussion || "",
      conclusions: defaults.conclusions || review.review?.researcher_conclusion?.statement || "",
      limitations: defaults.limitations || "",
      customTitle: defaults.custom_title || "Additional researcher notes",
      customBody: "",
      approval: defaults.approval || review.review?.approval_state || "Pending researcher approval",
      chartMetric: defaults.chart_metric || "pce",
      includeFullTable: true,
      includeExperiments: true,
      includeEvidence: true,
      includeSourceAppendix: true,
      includeQualityReview: true,
      sections: sections.filter(([, , , enabled]) => enabled).map(([id]) => id)
    };
  }

  function reportState(project, pipeline = CHOSE_CONTRACT) {
    return S.getReport(project.id, reportDefaults(project, pipeline));
  }

  function reportReadiness(report) {
    const errors = [];
    const warnings = [];
    if (!String(report.title || "").trim()) errors.push("Report title is missing.");
    if (!String(report.author || "").trim()) errors.push("Author is missing.");
    if (!Array.isArray(report.sections) || !report.sections.length) errors.push("At least one report section is required.");
    if (report.sections?.includes("summary") && !String(report.executiveSummary || "").trim()) warnings.push("Executive summary is empty.");
    if (report.sections?.includes("custom") && !String(report.customBody || "").trim()) warnings.push("Custom author section is enabled but empty.");
    if (!String(report.approval || "").trim()) warnings.push("Approval state is empty.");
    return { errors, warnings, ready: errors.length === 0 };
  }

  function syncReportDraft(project, pipeline = CHOSE_CONTRACT, notify = false) {
    const state = reportState(project, pipeline);
    if (!$("#report-title")) return state;
    const value = (id, fallback) => $(id)?.value ?? fallback;
    const checked = (id, fallback) => $(id) ? $(id).checked : fallback;
    const updated = {
      ...state,
      title: value("#report-title", state.title),
      subtitle: value("#report-subtitle", state.subtitle),
      reportType: value("#report-type", state.reportType),
      reportCode: value("#report-code", state.reportCode),
      keywords: value("#report-keywords", state.keywords),
      author: value("#report-author", state.author),
      laboratory: value("#report-laboratory", state.laboratory),
      organisation: value("#report-organisation", state.organisation),
      reportDate: value("#report-date", state.reportDate),
      executiveSummary: value("#report-summary", state.executiveSummary),
      objectives: value("#report-objectives", state.objectives),
      methodology: value("#report-methodology", state.methodology),
      resultsNarrative: value("#report-results-narrative", state.resultsNarrative),
      discussion: value("#report-discussion", state.discussion),
      conclusions: value("#report-conclusions", state.conclusions),
      limitations: value("#report-limitations", state.limitations),
      customTitle: value("#report-custom-title", state.customTitle),
      customBody: value("#report-custom-body", state.customBody),
      approval: value("#report-approval", state.approval),
      chartMetric: value("#report-chart-metric", state.chartMetric),
      includeFullTable: checked("#report-full-table", state.includeFullTable),
      includeExperiments: checked("#report-experiments", state.includeExperiments),
      includeEvidence: checked("#report-evidence", state.includeEvidence),
      includeSourceAppendix: checked("#report-source-appendix", state.includeSourceAppendix),
      includeQualityReview: checked("#report-quality-review", state.includeQualityReview),
      sections: $$('[data-report-section]:checked').map((input) => input.dataset.reportSection)
    };
    S.saveReport(project.id, updated);
    Log.info("report.draft-applied", { projectId: project.id, sections: updated.sections.length, chartMetric: updated.chartMetric });
    const preview = $("#report-live-preview");
    if (preview) preview.innerHTML = reportPreview(project, pipeline);
    renderReportReadiness(updated);
    if (notify) toast("Report draft applied in memory. PDF and DOCX now use this exact report state.");
    return updated;
  }

  function renderReportReadiness(report) {
    const target = $("#report-readiness");
    if (!target) return;
    const check = reportReadiness(report);
    const messages = [...check.errors.map((text) => ["error", text]), ...check.warnings.map((text) => ["warning", text])];
    target.innerHTML = `<div class="report-readiness-head"><span><strong>${check.ready ? "Ready to export" : "Needs attention"}</strong><small>${check.errors.length} errors · ${check.warnings.length} warnings · ${report.sections.length} sections</small></span><span class="badge ${check.ready ? "badge-success" : "badge-warning"}">${check.ready ? "Ready" : "Review"}</span></div>${messages.length ? `<div class="report-readiness-list">${messages.map(([type, text]) => `<div class="notice notice-${type}"><div>${icon(type === "error" ? "warning" : "info")}</div><div><p>${esc(text)}</p></div></div>`).join("")}</div>` : `<p class="mb-0">Title, author and report structure are complete. Warnings do not block export.</p>`}`;
  }

  function reportEditorGroup(title, detail, content, open = false) {
    return `<details class="report-editor-group" ${open ? "open" : ""}><summary><span><strong>${title}</strong><small>${detail}</small></span>${icon("arrow")}</summary><div class="report-editor-group-body">${content}</div></details>`;
  }

  function analysisReport(project, pipeline = CHOSE_CONTRACT) {
    const report = reportState(project, pipeline);
    const reportContract = choseDemo(pipeline, "review", CHOSE_DEMO_REVIEW).report || {};
    const evidenceStatement = reportContract.evidence_statement || {};
    const boundaryStatement = reportContract.boundary_statement || {};
    const metadata = `<div class="form-grid"><div class="field wide"><label for="report-title">Report title</label><input class="input" id="report-title" value="${esc(report.title)}"></div><div class="field wide"><label for="report-subtitle">Subtitle</label><input class="input" id="report-subtitle" value="${esc(report.subtitle)}"></div><div class="field"><label for="report-type">Document type</label><select class="select" id="report-type"><option ${report.reportType === "Scientific project report" ? "selected" : ""}>Scientific project report</option><option ${report.reportType === "Experiment report" ? "selected" : ""}>Experiment report</option><option ${report.reportType === "Internal technical note" ? "selected" : ""}>Internal technical note</option></select></div><div class="field"><label for="report-code">Report code</label><input class="input" id="report-code" value="${esc(report.reportCode)}"></div><div class="field"><label for="report-author">Author</label><input class="input" id="report-author" value="${esc(report.author)}"></div><div class="field"><label for="report-date">Report date</label><input class="input" id="report-date" type="date" value="${esc(report.reportDate)}"></div><div class="field wide"><label for="report-laboratory">Laboratory</label><input class="input" id="report-laboratory" value="${esc(report.laboratory)}"></div><div class="field wide"><label for="report-organisation">Organisation</label><input class="input" id="report-organisation" value="${esc(report.organisation)}"></div><div class="field wide"><label for="report-keywords">Keywords</label><input class="input" id="report-keywords" value="${esc(report.keywords)}"></div><div class="field wide"><label for="report-approval">Approval / status</label><input class="input" id="report-approval" value="${esc(report.approval)}"></div></div>`;
    const textArea = (id, label, value, hint) => `<div class="field wide report-text-field"><div class="report-field-label"><label for="${id}">${label}</label><small>${hint}</small></div><textarea class="textarea report-editor-textarea" id="${id}" data-report-counter>${esc(value)}</textarea><div class="report-field-meta"><span data-counter-for="${id}">${String(value || "").length} characters</span></div></div>`;
    const narrative = `<div class="form-grid">${textArea("report-summary", "Executive summary", report.executiveSummary, "Decision-ready overview and principal result")}${textArea("report-objectives", "Objectives", report.objectives, "Research question, scope and intended decision")}${textArea("report-methodology", "Methodology", report.methodology, "Preparation, process, acquisition and analysis")}${textArea("report-results-narrative", "Results interpretation", report.resultsNarrative, "Researcher interpretation of the visible data")}${textArea("report-discussion", "Discussion", report.discussion, "Context, alternatives and scientific caveats")}${textArea("report-conclusions", "Conclusions", report.conclusions, "Final researcher-authored decision")}${textArea("report-limitations", "Limitations", report.limitations, "Dataset, method and inference boundaries")}</div>`;
    const dataOptions = `<div class="form-grid"><div class="field wide"><label for="report-chart-metric">Primary chart</label><select class="select" id="report-chart-metric"><option value="pce" ${report.chartMetric === "pce" ? "selected" : ""}>PCE by sample</option><option value="stability" ${report.chartMetric === "stability" ? "selected" : ""}>Stability by sample</option><option value="hysteresis" ${report.chartMetric === "hysteresis" ? "selected" : ""}>Hysteresis by sample</option></select></div></div><div class="report-option-grid"><label class="check-row"><input id="report-full-table" type="checkbox" ${report.includeFullTable ? "checked" : ""}><span><strong>Complete measurement table</strong><small class="block">All nine result fields and every included sample</small></span></label><label class="check-row"><input id="report-experiments" type="checkbox" ${report.includeExperiments ? "checked" : ""}><span><strong>Experiment coverage</strong><small class="block">Experiment IDs, samples, process and measurement count</small></span></label><label class="check-row"><input id="report-evidence" type="checkbox" ${report.includeEvidence ? "checked" : ""}><span><strong>Evidence details</strong><small class="block">Source references and review state for findings</small></span></label><label class="check-row"><input id="report-source-appendix" type="checkbox" ${report.includeSourceAppendix ? "checked" : ""}><span><strong>Source appendix</strong><small class="block">Files, identifiers and provenance summary</small></span></label><label class="check-row"><input id="report-quality-review" type="checkbox" ${report.includeQualityReview ? "checked" : ""}><span><strong>Data-quality review</strong><small class="block">Blocking issues and interpretation boundaries</small></span></label></div>`;
    const custom = `<div class="form-grid"><div class="field wide"><label for="report-custom-title">Custom section title</label><input class="input" id="report-custom-title" value="${esc(report.customTitle)}"></div>${textArea("report-custom-body", "Custom author text", report.customBody, "Optional notes, acknowledgements or project-specific discussion")}</div><div class="notice"><div>${icon("info")}</div><div><strong>Enable the Custom Author Section below</strong><p>This content enters the live preview, PDF and DOCX only when its section checkbox is enabled.</p></div></div>`;
    const structure = `<div class="report-section-list" aria-label="Included report sections">${reportSectionCatalog(pipeline).map(([id, title, detail], index) => `<label class="check-row report-section"><span class="drag-handle" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><input type="checkbox" data-report-section="${id}" ${report.sections.includes(id) ? "checked" : ""}><span><strong>${title}</strong><small class="block">${detail}</small></span></label>`).join("")}</div>`;
    return `<div class="report-composer-layout"><aside class="report-composer-editor"><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Report Composer</h3><small>Author-controlled content · live A4 preview · native local export</small></div>${icon("file")}</div><div class="panel-body report-editor-stack">${reportEditorGroup("Identity & publication", "Title, author, document type, code, keywords and approval", metadata, true)}${reportEditorGroup("Scientific narrative", "Summary, objectives, methods, interpretation and conclusions", narrative, true)}${reportEditorGroup("Data & visual content", "Choose chart, measurements, experiments, evidence and provenance", dataOptions, true)}${reportEditorGroup("Custom author section", "Add project-specific text without changing the standard structure", custom)}${reportEditorGroup("Included sections", "Control which scientific sections enter every output", structure, true)}<div class="report-editor-actions"><button class="btn btn-primary" id="save-report-draft">Apply report draft</button><span class="badge badge-success">Session draft</span></div></div></div><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Report readiness</h3><small>Structural checks before generating files</small></div>${icon("check")}</div><div class="panel-body" id="report-readiness"></div></div><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Output suite</h3><small>Native PDF, professional DOCX, analysis workbook and LaTeX package</small></div><span class="badge badge-accent">${esc(E.palettes[getSettings().palette].name)}</span></div><div class="panel-body stack">${reportExportCards(pipeline)}</div></div><div class="panel ai-panel"><div class="panel-header"><div><h3 class="mb-0">Evidence assistant</h3><small>Advisory wording remains separate from researcher text</small></div>${icon("spark")}</div><div class="panel-body stack"><div class="report-statement"><span class="badge badge-accent">${esc(evidenceStatement.label || "Measured statement")}</span><p><strong>${esc(evidenceStatement.statement || "No measured statement configured.")}</strong></p><div class="evidence-detail"><small>Evidence</small><p>${esc(evidenceStatement.evidence || "No evidence reference configured.")}</p></div></div><div class="report-statement"><span class="badge badge-warning">${esc(boundaryStatement.label || "Boundary")}</span><p>${esc(boundaryStatement.statement || "No interpretation boundary configured.")}</p></div></div></div></aside><section class="report-preview-workbench"><div class="report-preview-toolbar"><span><strong>Live report preview</strong><small>Preview and PDF use the same canonical report model, selections and author text</small></span><span class="badge">A4 · ${report.sections.length} sections</span></div><div class="report-preview report-preview-pages" id="report-live-preview">${reportPreview(project, pipeline)}</div></section></div>`;
  }

  function reportPreview(project, pipeline = CHOSE_CONTRACT) {
    if (typeof E.buildReportDocument !== "function") {
      Log.error("report.model-unavailable", { page: document.body.dataset.page, module: "assets/js/workbook.js" });
      return `<div class="notice notice-error"><div>${icon("warning")}</div><div><strong>Report preview unavailable</strong><p>The report module was not loaded. Reload the page or verify the local JavaScript files.</p></div></div>`;
    }
    const model = E.buildReportDocument(project, D.demoDataset, {
      pipeline,
      report: reportState(project, pipeline),
      findings: D.aiFindings,
      knowledge: D.knowledge,
      experiments: D.experiments
    });
    const {report, rows, best, experiments, metric, metricLabel, metricSuffix, minValue, metricRange, solutionDefinition, solutionMeta, solventComponents, stackLayers: modelStackLayers, stackMeta, qualityIssues, sourceEntries, provenanceManifest} = model;
    const sections = model.sectionSet;
    const mean = (key) => Number(model.mean[key] || 0).toFixed(2);
    const excluded = (name) => `<div class="report-excluded"><strong>${name} excluded by the author</strong><span>Enable the section in the Composer to include it in PDF and DOCX.</span></div>`;
    const summaryBody = sections.has("summary") ? `<p class="report-lead">${esc(report.executiveSummary)}</p><div class="report-objectives"><strong>Research objectives</strong><p>${esc(report.objectives)}</p></div><div class="report-kpis"><div class="report-kpi"><small>BEST PCE</small><strong>${Number(best.pce || 0).toFixed(2)}%</strong><span>${esc(best.sample || "—")}</span></div><div class="report-kpi"><small>MEAN PCE</small><strong>${mean("pce")}%</strong><span>${rows.length} samples</span></div><div class="report-kpi"><small>STABILITY</small><strong>${esc(best.stability || 0)}%</strong><span>best retained</span></div><div class="report-kpi"><small>MEAN VOC</small><strong>${mean("voc")} V</strong><span>cohort</span></div><div class="report-kpi"><small>OPEN ISSUES</small><strong>${model.openIssueCount}</strong><span>quality review</span></div></div>` : excluded("Executive Summary");
    const qualityReview = report.includeQualityReview && qualityIssues.length ? `<div class="report-quality-strip">${qualityIssues.slice(0,3).map((item) => `<span><b>${esc(String(item.severity || "information").toUpperCase())}</b> ${esc(item.title || item.detail || "Quality issue")}</span>`).join("")}</div>` : "";
    const solventTotal = solventComponents.reduce((sum, item) => sum + Number(String(item.share || "").match(/[\d.]+/)?.[0] || 0), 0) || 100;
    const composition = solventComponents.length ? `<div class="report-composition">${solventComponents.map((item) => {
      const share = Number(String(item.share || "").match(/[\d.]+/)?.[0] || 0);
      return `<span class="report-composition-${esc(item.tone || "component")}" style="flex:${share || 1}">${esc(item.name)} ${esc(item.share || "")}</span>`;
    }).join("")}</div>` : `<div class="report-composition"><span style="flex:${solventTotal}">${esc(solutionMeta.solventRatio)}</span></div>`;
    const methodsBody = sections.has("methods") ? `<p>${esc(report.methodology)}</p><div class="report-technical-grid"><section><h3>Solution Review · ${esc(solutionMeta.label)}</h3>${composition}<dl><div><dt>Recipe</dt><dd>${esc(solutionDefinition.name || "—")}</dd></div><div><dt>Volume</dt><dd>${esc(solutionMeta.volume)}</dd></div><div><dt>Concentration</dt><dd>${esc(solutionMeta.concentration)}</dd></div><div><dt>Status</dt><dd>${esc(solutionMeta.status)}</dd></div></dl></section><section><h3>Stack Review · ${esc(stackMeta.label)}</h3><div class="report-stack-mini">${modelStackLayers.map((layer) => `<span class="stack-tone-${esc(layer.tone || "layer")}">${esc(layer.material)} · ${esc(layer.thickness)}</span>`).join("")}</div><small>${esc(stackMeta.architecture)} reference architecture</small></section></div>${report.includeExperiments ? `<div class="report-experiment-grid">${experiments.map((experiment) => `<article><span>${esc(experiment.id)}</span><strong>${asArray(experiment.samples).map(esc).join(" · ")}</strong><small>${esc(experiment.process)} · ${esc(experiment.annealing?.value ?? "—")}${esc(experiment.annealing?.unit || " unit missing")} · ${esc(experiment.measurements || 0)} measurements</small></article>`).join("")}</div>` : ""}${qualityReview}` : excluded("Materials, Process & Experiments");
    const resultsBody = sections.has("results") ? `<div class="report-chart-card"><div><strong>${esc(metricLabel)} by sample</strong><small>Complete included cohort · deterministic snapshot</small></div><div class="report-chart-bars">${rows.map((row) => `<div><span>${esc(row.sample)}</span><i style="--bar:${(((Number(row[metric]) - minValue) / metricRange) * 100).toFixed(1)}%"></i><b>${Number(row[metric]).toFixed(model.metricDecimals)}${esc(metricSuffix)}</b></div>`).join("")}</div></div>${report.includeFullTable ? `<div class="table-wrap report-results-table">${datasetTable(rows)}</div>` : ""}<div class="report-interpretation"><strong>Researcher interpretation</strong><p>${esc(report.resultsNarrative)}</p></div>` : excluded("Results & Data");
    const findingsBody = sections.has("ai") ? `<div class="report-findings-grid">${model.findings.map((finding) => `<article><div><strong>${finding.score}</strong><span>${esc(finding.status)}</span></div><h3>${esc(finding.title)}</h3><p>${esc(finding.detail)}</p>${report.includeEvidence ? `<small>${esc(finding.evidence)} · ${esc(finding.type)}</small>` : ""}</article>`).join("")}</div>` : excluded("Evidence-Linked Findings");
    const decisionBody = sections.has("conclusions") ? `<div class="report-decision-grid report-decision-grid-three"><div><h3>Discussion</h3><p>${esc(report.discussion)}</p></div><div><h3>Conclusions</h3><p>${esc(report.conclusions)}</p></div><div><h3>Limitations</h3><p>${esc(report.limitations)}</p></div></div>` : excluded("Discussion, Conclusions & Limitations");
    const customBody = sections.has("custom") ? `<div class="report-custom-section"><h3>${esc(report.customTitle || "Custom author section")}</h3><p>${esc(report.customBody || "No custom text entered.")}</p></div>` : "";
    const sourceAppendix = report.includeSourceAppendix ? `<div class="report-source-appendix"><strong>Source appendix</strong><span>${sourceEntries.map((item) => esc(item.id)).join(" · ") || "No source records declared"}</span><span>${sourceEntries.map((item) => esc(item.detail)).join(" · ")}</span></div>` : "";
    const provenanceBody = sections.has("provenance") ? `<div class="report-provenance">${provenanceManifest.map((item) => `<span><b>${esc(String(item.class || "evidence").toUpperCase())}</b> ${esc(item.label || "—")}</span>`).join("")}</div>${sourceAppendix}<div class="report-approval"><span>Approval state</span><strong>${esc(report.approval)}</strong></div>` : excluded("Provenance & Approval");
    const cover = `<article class="report-page report-page-cover"><div class="report-cover report-cover-compact"><img class="report-brand" src="assets/brand/logo-horizontal-shell.svg" alt="LabFlow"><div class="report-cover-copy"><span class="badge report-cover-badge">${esc(report.reportType).toUpperCase()} · ${esc(report.reportCode)}</span><h1>${esc(report.title)}</h1><p>${esc(report.subtitle)}</p><small>${esc(report.laboratory)} · ${esc(report.author)}</small></div><div class="report-cover-status"><span>${esc(report.reportDate)}</span><strong>${esc(report.approval)}</strong></div></div><div class="report-keywords"><b>Keywords</b><span>${esc(report.keywords)}</span></div><section class="report-section-block report-summary"><div class="report-section-heading"><div><small>01 · EXECUTIVE SNAPSHOT</small><h2>Decision-ready project summary</h2></div><span>${esc(project.id)}</span></div>${summaryBody}</section><footer><span>${esc(report.organisation)} · ${esc(report.reportCode)}</span><b>01 / 04</b></footer></article>`;
    const methodsPage = `<article class="report-page"><header><span>LABFLOW · ${esc(report.reportCode)}</span><b>Materials, process and experiment coverage</b></header><section class="report-section-block"><div class="report-section-heading"><div><small>02 · MATERIALS & PROCESS</small><h2>Traceable preparation and device architecture</h2></div><span>${experiments.length} experiments</span></div>${methodsBody}</section><footer><span>${esc(report.author)} · ${esc(report.reportDate)} · ${esc(report.reportCode)}</span><b>02 / 04</b></footer></article>`;
    const resultsPage = `<article class="report-page"><header><span>LABFLOW · ${esc(report.reportCode)}</span><b>Complete results and measurement record</b></header><section class="report-section-block"><div class="report-section-heading"><div><small>03 · COMPLETE RESULTS</small><h2>Device performance and source-aligned data</h2></div><span>${rows.length} samples · 9 fields</span></div>${resultsBody}</section><footer><span>Researcher-reviewed data · ${esc(report.approval)}</span><b>03 / 04</b></footer></article>`;
    const reviewPage = `<article class="report-page"><header><span>LABFLOW · ${esc(report.reportCode)}</span><b>Findings, researcher decision and provenance</b></header><section class="report-section-block"><div class="report-section-heading"><div><small>04 · EVIDENCE-LINKED FINDINGS</small><h2>Advisory review with explicit boundaries</h2></div><span>${model.findings.length} findings</span></div>${findingsBody}</section><section class="report-section-block report-decision"><div class="report-section-heading"><div><small>05 · RESEARCHER DECISION</small><h2>Interpretation and scientific boundaries</h2></div><span>${esc(report.approval)}</span></div>${decisionBody}</section>${customBody ? `<section class="report-section-block"><div class="report-section-heading"><div><small>06 · CUSTOM AUTHOR SECTION</small><h2>${esc(report.customTitle)}</h2></div></div>${customBody}</section>` : ""}<section class="report-section-block"><div class="report-section-heading"><div><small>${customBody ? "07" : "06"} · PROVENANCE & APPROVAL</small><h2>Evidence classes and final state</h2></div></div>${provenanceBody}</section><footer><span>${esc(report.laboratory)} · ${esc(report.reportCode)}</span><b>04 / 04</b></footer></article>`;
    return cover + methodsPage + resultsPage + reviewPage;
  }

  function reportExportCards(pipeline = CHOSE_CONTRACT) {
    const detailByType = {
      pdf: "Professional vector PDF generated from the same canonical model used by the live Composer preview.",
      docx: "Branded editable Word report with author text, tables, findings and provenance.",
      xlsx: "Analysis workbook with raw data, calculations, findings, provenance and report metadata.",
      latex: "Compile-ready LaTeX report package generated from the reviewed report state."
    };
    const iconsByType = {xlsx:"table", latex:"code", pdf:"file", docx:"file"};
    return asArray(pipeline.exports?.formats)
      .filter((item) => item.enabled !== false && ["pdf","docx","xlsx","latex"].includes(item.id))
      .map((item) => `<div class="export-card"><span class="object-icon">${icon(iconsByType[item.id] || "file")}</span><div><strong>${esc(item.label)}</strong><p class="mb-0">${esc(detailByType[item.id] || "Generated from the canonical report model.")}</p></div><button class="btn btn-sm ${item.id === "pdf" ? "btn-primary" : ""}" data-export="${esc(item.id)}">${icon("download")} Generate</button></div>`).join("");
  }


  function quickExportStep(project) {
    return `<div class="stack">${exportPackagePanel(project)}</div>`;
  }

  function quickPlan() {
    return `<div class="grid grid-2"><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Measurement review plan</h3><small>A deliberately small reusable pipeline</small></div>${icon("edit")}</div><div class="panel-body form-grid"><div class="field wide"><label>Research question</label><textarea class="textarea">Does the treated reference film show a measurable absorption-edge shift compared with the untreated film?</textarea></div><div class="field"><label>Measurement type</label><select class="select"><option>UV–Vis spectrum</option><option>Photoluminescence</option><option>JV curve</option></select></div><div class="field"><label>Primary comparison</label><input class="input" value="Reference vs treated"></div><div class="field"><label>Expected evidence</label><input class="input" value="Peak position + integrated absorbance"></div><div class="field"><label>Decision threshold</label><input class="input" value="> 8 nm shift"></div></div></div><div class="stack"><div class="panel ai-panel"><div class="panel-header"><div><h3 class="mb-0">AI plan check</h3><small>Checks clarity and evidence expectations</small></div>${icon("spark")}</div><div class="panel-body"><div class="notice notice-success"><div>${icon("check")}</div><div><strong>Question is testable</strong><p>The comparison, metric and threshold are explicit.</p></div></div></div></div><div class="panel"><div class="panel-header"><h3 class="mb-0">Useful knowledge</h3></div><div class="panel-body stack">${D.knowledge.slice(4, 6).map(knowledgeCard).join("")}</div></div></div></div>`;
  }

  function quickData() {
    return `<div class="grid grid-2"><label class="dropzone" for="file-input">${icon("upload")}<h3 class="mt-1">Add a compact dataset</h3><p>Use a local CSV/TSV file or continue with the included UV–Vis example.</p><span class="btn btn-primary">Choose file</span><input id="file-input" type="file" accept=".csv,.tsv,.txt"></label><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Example sources</h3><small>Enough detail to discuss a realistic workflow</small></div></div><div class="panel-body"><div class="table-wrap"><table class="table-dense"><thead><tr><th>File</th><th>Sample</th><th>Points</th><th>Range</th><th>Status</th></tr></thead><tbody><tr><td>reference_uvvis.csv</td><td>REF-01</td><td>601</td><td>300–900 nm</td><td>${badgeStatus("reviewed")}</td></tr><tr><td>treated_uvvis.csv</td><td>TRT-01</td><td>601</td><td>300–900 nm</td><td>${badgeStatus("reviewed")}</td></tr><tr><td>dark_baseline.csv</td><td>BASE-03</td><td>601</td><td>300–900 nm</td><td>${badgeStatus("reviewed")}</td></tr></tbody></table></div></div></div></div>`;
  }

  function quickReport(project) {
    return `<div class="grid grid-2"><div class="stack"><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Review result</h3><small>Compact conclusion with retained evidence</small></div>${icon("chart")}</div><div class="panel-body"><div class="grid grid-3"><div class="card kpi"><div class="kpi-label">Edge shift</div><div class="kpi-value">+11 nm</div><div class="kpi-detail">above threshold</div></div><div class="card kpi"><div class="kpi-label">Peak change</div><div class="kpi-value">+6.2%</div><div class="kpi-detail">integrated area</div></div><div class="card kpi"><div class="kpi-label">Quality</div><div class="kpi-value">97%</div><div class="kpi-detail">baseline valid</div></div></div><textarea class="textarea mt-2">The treated film shows an 11 nm red shift relative to the reference, exceeding the predefined 8 nm decision threshold. The result is supported by the aligned spectra and baseline control.</textarea></div></div><div class="panel ai-panel"><div class="panel-header"><div><h3 class="mb-0">AI wording review</h3><small>Checks claims against available evidence</small></div>${icon("spark")}</div><div class="panel-body"><div class="notice notice-success"><div>${icon("check")}</div><div><strong>Claim strength is appropriate</strong><p>The text describes association and observed shift without inferring an unsupported mechanism.</p></div></div></div></div></div><div class="report-preview">${reportPreview(project)}</div></div>`;
  }

  function bindSolutionBuilder() {
    if (!$("#solution-component-editor")) return;
    const readComponents = () => $$('[data-solution-row]').map((row) => ({
      tone: row.dataset.tone,
      phase: solutionComponents.find((item) => item.tone === row.dataset.tone)?.phase || "solute",
      name: $('[data-solution-field="name"]', row).value,
      role: $('[data-solution-field="role"]', row).value,
      amount: $('[data-solution-field="amount"]', row).value,
      share: $('[data-solution-field="share"]', row).value
    }));
    const referenceVolume = Number(activeSolutionDefinition.reference_volume?.value || 1);
    const referenceConcentration = Number(activeSolutionDefinition.target_concentration?.value || 1);
    const volumeUnit = activeSolutionDefinition.reference_volume?.unit || "mL";
    const concentrationUnit = activeSolutionDefinition.target_concentration?.unit || "mol/L";
    const componentReference = new Map(solutionComponents.map((item) => {
      const match = String(item.amount || "").match(/^([0-9.]+)\s*(.*)$/);
      return [item.tone, {value:Number(match?.[1] || 0), unit:match?.[2] || "", phase:item.phase || "solute"}];
    }));
    const refreshSolution = () => {
      const review = $("#solution-review");
      if (!review) return;
      review.innerHTML = solutionReview(readComponents(), activeSolutionDefinition);
      $("[data-solution-concentration]", review).textContent = `${Number($("#solution-molarity")?.value || 0).toFixed(2)} ${concentrationUnit}`;
      $("[data-solution-volume]", review).textContent = `${Number($("#solution-volume")?.value || 0).toFixed(2)} ${volumeUnit}`;
    };
    const renumberComponents = () => {
      $$('[data-solution-row] .solution-order-actions .badge').forEach((badge,index)=>badge.textContent=String(index+1).padStart(2,"0"));
      refreshSolution();
    };
    const recalculate = () => {
      const volume = Number($("#solution-volume")?.value || 0);
      const concentration = Number($("#solution-molarity")?.value || 0);
      const scale = referenceVolume > 0 && referenceConcentration > 0 ? (volume / referenceVolume) * (concentration / referenceConcentration) : 1;
      componentReference.forEach((reference, tone) => {
        if (reference.phase === "solvent" || !reference.value) return;
        const value = `${(reference.value * scale).toFixed(1)}${reference.unit ? ` ${reference.unit}` : ""}`;
        const field = $(`[data-solution-row][data-tone="${tone}"] [data-solution-field="amount"]`);
        if (field) field.value = value;
        const summaryField = tone === "fai" ? $("#fai-mass") : tone === "mai" ? $("#mai-mass") : tone === "pbi" ? $("#pbi-mass") : null;
        if (summaryField) summaryField.value = value;
      });
      refreshSolution();
    };
    $("#recalculate")?.addEventListener("click", () => { recalculate(); toast("Reference quantities recalculated."); });
    $$("#solution-volume, #solution-molarity").forEach((control) => control.addEventListener("input", recalculate));
    $("#solution-component-editor")?.addEventListener("input", refreshSolution);
    $("#solution-component-editor")?.addEventListener("click", (event) => {
      const row=event.target.closest("[data-solution-row]"); if(!row) return;
      if(event.target.closest('[data-solution-move="up"]') && row.previousElementSibling?.matches('[data-solution-row]')) row.parentElement.insertBefore(row,row.previousElementSibling);
      if(event.target.closest('[data-solution-move="down"]') && row.nextElementSibling?.matches('[data-solution-row]')) row.parentElement.insertBefore(row.nextElementSibling,row);
      renumberComponents();
    });
    let draggedComponent=null;
    $("#solution-component-editor")?.addEventListener("dragstart",(event)=>{ const row=event.target.closest('[data-solution-row]'); if(!row)return; draggedComponent=row; row.classList.add('is-dragging'); event.dataTransfer.effectAllowed='move'; });
    $("#solution-component-editor")?.addEventListener("dragover",(event)=>{ if(!draggedComponent)return; event.preventDefault(); const target=event.target.closest('[data-solution-row]'); if(!target||target===draggedComponent)return; const rect=target.getBoundingClientRect(); target.parentElement.insertBefore(draggedComponent,event.clientY<rect.top+rect.height/2?target:target.nextElementSibling); });
    $("#solution-component-editor")?.addEventListener("dragend",()=>{ draggedComponent?.classList.remove('is-dragging'); draggedComponent=null; renumberComponents(); });
    $("#duplicate-solution")?.addEventListener("click", () => toast("Temporary definition duplicated. Reload removes it."));
    $("#save-solution")?.addEventListener("click", () => toast("Temporary reusable definition added. Reload removes it."));
    $("#add-solution-definition")?.addEventListener("click", () => toast("A blank temporary solution definition was created in page memory."));
    $$('[data-definition-card]').forEach((card) => card.addEventListener("click", () => {
      $$('[data-definition-card]').forEach((item) => item.classList.toggle("active", item === card));
      toast(`${card.querySelector("strong")?.textContent || "Definition"} selected.`);
    }));
  }

  function bindStackBuilder() {
    if (!$("#layer-editor") || !$("#stack-review")) return;
    const readLayers = () => $$('[data-layer]').map((layer) => ({
      tone: layer.dataset.tone || "interface",
      material: $('[data-layer-field="material"]', layer).value,
      thickness: $('[data-layer-field="thickness"]', layer).value,
      function: $('[data-layer-field="function"]', layer).value,
      process: $('[data-layer-field="process"]', layer).value
    }));
    const refresh = () => { const layers = readLayers(); $("#stack-review").innerHTML = stackReview(layers); bindStackReview(layers, $("#stack-review")); };
    const renumber = () => { $$('[data-layer] .step-index').forEach((number, index) => number.textContent = String(index + 1).padStart(2, "0")); refresh(); };
    bindStackReview(readLayers(), $("#stack-review"));
    $("#layer-editor")?.addEventListener("input", refresh);
    let draggedLayer = null;
    $("#layer-editor")?.addEventListener("dragstart", (event) => { const layer=event.target.closest("[data-layer]"); if(!layer)return; draggedLayer=layer; layer.classList.add("is-dragging"); event.dataTransfer.effectAllowed="move"; });
    $("#layer-editor")?.addEventListener("dragover", (event) => { if(!draggedLayer)return; event.preventDefault(); const target=event.target.closest("[data-layer]"); if(!target||target===draggedLayer)return; const rect=target.getBoundingClientRect(); target.parentElement.insertBefore(draggedLayer,event.clientY<rect.top+rect.height/2?target:target.nextElementSibling); });
    $("#layer-editor")?.addEventListener("dragend", () => { draggedLayer?.classList.remove("is-dragging"); draggedLayer=null; renumber(); });
    $("#layer-editor")?.addEventListener("click", (event) => {
      const layer = event.target.closest("[data-layer]");
      if (!layer) return;
      if (event.target.closest("[data-layer-delete]")) { if ($$('[data-layer]').length === 1) { toast("A stack requires at least one layer.", "error"); return; } layer.remove(); }
      if (event.target.closest("[data-layer-copy]")) layer.after(layer.cloneNode(true));
      if (event.target.closest('[data-layer-move="up"]') && layer.previousElementSibling) layer.parentElement.insertBefore(layer, layer.previousElementSibling);
      if (event.target.closest('[data-layer-move="down"]') && layer.nextElementSibling) layer.parentElement.insertBefore(layer.nextElementSibling, layer);
      renumber();
    });
    $("#add-layer")?.addEventListener("click", () => { $("#layer-editor").insertAdjacentHTML("beforeend", stackEditorRow({material:"New material", thickness:"100 nm", function:"Interface layer", process:"Process", tone:"interface"}, $$('[data-layer]').length)); renumber(); });
    $("#save-stack-template")?.addEventListener("click", () => toast("Temporary stack definition added. Reload removes it."));
    $("#apply-stack-version")?.addEventListener("click", () => toast("Process stack version applied in page memory."));
  }

  function sectionById(step, id) {
    return asArray(step?.sections).find((section) => section.id === id) || asArray(step?.sections)[0] || null;
  }

  function bindProcessTabs(project, pipeline, step) {
    const activate = (tab) => {
      $$('[data-process-tab]').forEach((item) => item.classList.toggle("active", item === tab));
      const section = sectionById(step, tab.dataset.processTab);
      if (!section) return;
      $("#process-content").innerHTML = renderRegisteredSection(section.component, {project, pipeline, step, section});
      if (section.component === "chose.process.chemistry") bindSolutionBuilder();
      if (section.component === "chose.process.fabrication") bindFabricationInteractions(pipeline);
      if (section.component === "chose.process.stack_review") bindStackBuilder();
    };
    $$('[data-process-tab]').forEach((tab) => tab.addEventListener("click", () => activate(tab)));
    const initial = $('[data-process-tab].active') || $('[data-process-tab]');
    if (initial?.dataset.processTab === "chemistry") bindSolutionBuilder();
  }

  function bindFabricationInteractions(pipeline = CHOSE_CONTRACT) {
    const layers = asArray(choseDemo(pipeline, "process", CHOSE_DEMO_PROCESS).stack?.layers).length
      ? asArray(choseDemo(pipeline, "process", CHOSE_DEMO_PROCESS).stack.layers)
      : stackLayers;
    bindStackReview(layers, $("#fabrication-stack-review") || document);
    $("#add-operation")?.addEventListener("click", () => {
      const body = $("#fabrication-operations");
      const index = body?.children.length || 0;
      const operationTypes = asArray(pipelineResource(pipeline, "defaults", "operation_types", {}).items);
      const typeOptions = (operationTypes.length ? operationTypes : [{id:"custom",label:"Custom operation"}]).map((item) => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join("");
      body?.insertAdjacentHTML("beforeend", `<tr data-operation-id="OP-${String(index + 1).padStart(2,"0")}"><td><span class="step-index">${String(index + 1).padStart(2,"0")}</span></td><td><select class="select">${typeOptions}</select></td><td><input class="input" value="—"></td><td><input class="input" value="Parameter"></td><td><input class="input" value="Duration"></td><td><input class="input" value="unassigned"></td><td><select class="select"><option>Required</option><option>Optional</option></select></td><td><button class="btn btn-ghost icon-btn" data-remove-operation aria-label="Remove operation">${icon("trash")}</button></td></tr>`);
      toast("Temporary fabrication operation added from the pipeline operation registry.");
    });
    $("#fabrication-operations")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-operation]");
      if (!button) return;
      button.closest("tr")?.remove();
      $$("#fabrication-operations .step-index").forEach((item,index) => item.textContent = String(index + 1).padStart(2,"0"));
    });
  }

  function bindExperimentTabs(project, pipeline, step) {
    const activate = (tab) => {
      $$('[data-experiment-tab]').forEach((item) => item.classList.toggle("active", item === tab));
      const section = sectionById(step, tab.dataset.experimentTab);
      if (!section) return;
      $("#experiment-content").innerHTML = renderRegisteredSection(section.component, {project, pipeline, step, section});
      bindExperimentLocalInteractions(pipeline);
    };
    $$('[data-experiment-tab]').forEach((tab) => tab.addEventListener("click", () => activate(tab)));
    bindExperimentLocalInteractions(pipeline);
  }

  function bindExperimentLocalInteractions(pipeline = CHOSE_CONTRACT) {
    $("#add-experiment-sample")?.addEventListener("click", () => {
      const body = $("#experiment-samples");
      const index = body?.children.length || 0;
      const processDemo = choseDemo(pipeline, "process", CHOSE_DEMO_PROCESS);
      const experimentDemo = choseDemo(pipeline, "experiment", CHOSE_DEMO_EXPERIMENT);
      const substrate = processDemo.substrate ? `${processDemo.substrate.id}/v${processDemo.substrate.version}` : "Unassigned substrate";
      const batch = asArray(experimentDemo.batches)[0]?.id || "Unassigned batch";
      body?.insertAdjacentHTML("beforeend", `<tr><td><input class="input" value="S${String(index + 6).padStart(2,"0")}"></td><td><select class="select"><option>${esc(substrate)}</option></select></td><td><select class="select"><option>Reference</option></select></td><td><select class="select"><option>${esc(batch)}</option></select></td><td><input class="input" type="number" value="6"></td><td>${badgeStatus("draft")}</td><td><button class="btn btn-ghost icon-btn" aria-label="Duplicate sample">${icon("copy")}</button></td></tr>`);
      toast("Temporary sample instance added.");
    });
  }

  function bindResultsTabs(project, pipeline, step) {
    const activate = (tab) => {
      $$('[data-results-tab]').forEach((item) => item.classList.toggle("active", item === tab));
      const section = sectionById(step, tab.dataset.resultsTab);
      if (!section) return;
      $("#results-content").innerHTML = renderRegisteredSection(section.component, {project, pipeline, step, section});
      bindIngest();
    };
    $$('[data-results-tab]').forEach((tab) => tab.addEventListener("click", () => activate(tab)));
    bindIngest();
  }

  function bindReviewTabs(project, pipeline, step) {
    const activate = (tab) => {
      $$('[data-review-tab]').forEach((item) => item.classList.toggle("active", item === tab));
      const section = sectionById(step, tab.dataset.reviewTab);
      if (!section) return;
      const content = $("#review-content");
      content.innerHTML = renderRegisteredSection(section.component, {project, pipeline, step, section});
      if (section.component === "chose.review.overview") bindAnalysisChartControls(pipeline);
      if (section.component === "chose.review.report_export") bindReportBuilder(project, pipeline);
      if (section.component === "chose.review.findings") $$('[data-finding-action]', content).forEach((button) => button.addEventListener("click", () => { const group = button.closest(".cluster"); group.querySelectorAll("button").forEach((item) => item.classList.remove("btn-primary")); button.classList.add("btn-primary"); toast(`${button.dataset.findingAction} recorded temporarily for this finding.`); }));
      $$('[data-export]', content).forEach((button) => button.addEventListener("click", () => runExport(button.dataset.export, project, pipeline, button)));
    };
    $$('[data-review-tab]').forEach((tab) => tab.addEventListener("click", () => activate(tab)));
    const requested = new URLSearchParams(location.search).get("view");
    const requestedTab = requested ? $(`[data-review-tab="${CSS.escape(requested)}"]`) : null;
    if (requestedTab) activate(requestedTab); else bindAnalysisChartControls(pipeline);
  }

  function bindProjectInteractions(project, pipeline, step) {
    if (step.view === "chose-process") bindProcessTabs(project, pipeline, step);
    if (step.view === "chose-experiment") bindExperimentTabs(project, pipeline, step);
    if (step.view === "chose-results") bindResultsTabs(project, pipeline, step);
    if (step.view === "chose-review") bindReviewTabs(project, pipeline, step);
    if (step.view === "quick-data") bindIngest();
    $$('.workflow-actions-footer [data-export]').forEach((button) => button.addEventListener("click", () => runExport(button.dataset.export, project, pipeline, button)));
  }

  function bindReportBuilder(project, pipeline = CHOSE_CONTRACT) {
    let previewTimer;
    const updateCounters = () => {
      $$('[data-report-counter]').forEach((control) => {
        const counter = $(`[data-counter-for="${control.id}"]`);
        if (counter) counter.textContent = `${control.value.length} characters`;
      });
    };
    const update = () => {
      updateCounters();
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => syncReportDraft(project, pipeline, false), 90);
    };
    $$("#analysis-content input, #analysis-content textarea, #analysis-content select").forEach((control) => {
      control.addEventListener("input", update);
      control.addEventListener("change", update);
    });
    $("#save-report-draft")?.addEventListener("click", () => syncReportDraft(project, pipeline, true));
    updateCounters();
    renderReportReadiness(reportState(project, pipeline));
  }

  function bindIngest() {
    $("#save-mapping-preset")?.addEventListener("click", () => toast("Mapping preset saved in memory for the CHOSE Keithley JV format."));
    $("#preview-normalized")?.addEventListener("click", () => {
      const target = $("#preview-normalized");
      target.closest(".panel")?.insertAdjacentHTML("afterend", `<div class="notice notice-success"><div>${icon("check")}</div><div><strong>Normalized preview ready</strong><p>6 columns mapped; Jsc converted from mA/cm² to A/m². No source value was overwritten.</p></div></div>`);
      target.disabled = true;
    });
    $("#file-input")?.addEventListener("change", async (event) => {
      const files = [...event.target.files];
      if (!files.length) return;
      const tbody = $("#ingest-files");
      for (const file of files) {
        let rows = "—";
        if (/\.(csv|tsv|txt)$/i.test(file.name)) {
          const text = await file.text();
          rows = Math.max(0, text.trim().split(/\r?\n/).length - 1);
        }
        tbody?.insertAdjacentHTML("afterbegin", `<tr><td>${esc(file.name)}</td><td>Local file</td><td>${rows}</td><td>Auto profile</td><td><span class="badge badge-warning">Review</span></td></tr>`);
      }
      toast(`${files.length} local file${files.length > 1 ? "s" : ""} profiled.`);
    });
  }

  function bindAnalysisChartControls(pipeline = CHOSE_CONTRACT) {
    $$('[data-chart-metric]').forEach((button) => button.addEventListener("click", () => {
      $$('[data-chart-metric]').forEach((item) => item.classList.toggle("active", item === button));
      $("[data-chart-title]").textContent = `${button.textContent} by sample`;
      drawChart(button.dataset.chartMetric, pipeline);
    }));
    const metrics = asArray(choseDemo(pipeline, "review", CHOSE_DEMO_REVIEW).overview?.chart_metrics);
    requestAnimationFrame(() => drawChart(metrics[0]?.id || "pce", pipeline));
  }

  function drawChart(metric = "pce", pipeline = CHOSE_CONTRACT) {
    const canvas = $("#analysis-chart");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || 700;
    const height = canvas.clientHeight || 260;
    canvas.width = width * ratio; canvas.height = height * ratio;
    context.scale(ratio, ratio);
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--accent").trim();
    const muted = styles.getPropertyValue("--subtle").trim();
    const line = styles.getPropertyValue("--line").trim();
    const text = styles.getPropertyValue("--text").trim();
    context.clearRect(0, 0, width, height);
    const pad = {left: 46, right: 18, top: 22, bottom: 34};
    const rows = asArray(choseDemo(pipeline, "results", CHOSE_DEMO_RESULTS).normalized_records);
    const metricRows = rows.map((row) => ({row, value:Number(row[metric])})).filter((item) => Number.isFinite(item.value));
    const values = metricRows.map((item) => item.value);
    if (!values.length) {
      context.fillStyle = text;
      context.fillText("No numeric records are available for this metric.", pad.left, pad.top + 20);
      return;
    }
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const min = rawMin === rawMax ? rawMin - 1 : rawMin * 0.94;
    const max = rawMin === rawMax ? rawMax + 1 : rawMax * 1.03;
    context.font = "10px system-ui";
    context.strokeStyle = line; context.fillStyle = muted; context.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + ((height - pad.top - pad.bottom) / 4) * i;
      context.beginPath(); context.moveTo(pad.left, y); context.lineTo(width - pad.right, y); context.stroke();
      const value = max - ((max - min) / 4) * i;
      context.fillText(value.toFixed(metric === "pce" ? 1 : 0), 7, y + 3);
    }
    const slot = (width - pad.left - pad.right) / values.length;
    values.forEach((value, index) => {
      const barHeight = ((value - min) / (max - min)) * (height - pad.top - pad.bottom);
      const x = pad.left + index * slot + slot * 0.18;
      const y = height - pad.bottom - barHeight;
      context.fillStyle = accent;
      context.fillRect(x, y, slot * 0.64, barHeight);
      context.fillStyle = text;
      context.fillText(metricRows[index]?.row?.sample || `#${index + 1}`, x + 2, height - 12);
    });
  }

  function datasetTable(dataset) {
    return `<table class="table-dense"><thead><tr><th>Sample</th><th>Formulation</th><th>Batch</th><th>Voc (V)</th><th>Jsc</th><th>FF (%)</th><th>PCE (%)</th><th>Stability</th><th>Hysteresis</th></tr></thead><tbody>${dataset.map((row) => `<tr><td><strong>${row.sample}</strong></td><td>${row.formulation}</td><td>${row.batch}</td><td>${row.voc.toFixed(2)}</td><td>${row.jsc.toFixed(1)}</td><td>${row.ff.toFixed(1)}</td><td><strong>${row.pce.toFixed(2)}</strong></td><td>${row.stability}%</td><td>${row.hysteresis.toFixed(1)}%</td></tr>`).join("")}</tbody></table>`;
  }

  function aiFinding(finding) {
    return `<div class="ai-finding"><div class="ai-score">${finding.score}</div><div><strong>${esc(finding.title)}</strong><p>${esc(finding.detail)}</p><small>${esc(finding.evidence)}</small></div>${badgeStatus(finding.status)}</div>`;
  }

  function knowledgeCard(item) {
    return `<article class="knowledge-card"><span class="knowledge-icon">${icon(item.type === "Equipment" ? "settings" : item.type === "Literature" ? "book" : "file")}</span><div><div class="cluster"><span class="badge">${esc(item.type)}</span>${badgeStatus(item.status)}</div><strong class="block mt-1">${esc(item.title)}</strong><p>${esc(item.summary)}</p><small>${esc(item.owner)} · ${esc(item.updated)}</small></div><a class="btn btn-ghost icon-btn" href="knowledge.html?q=${encodeURIComponent(item.title)}" aria-label="Open ${esc(item.title)}">${icon("arrow")}</a></article>`;
  }

  function toolCard(tool) {
    return `<article class="tool-card" data-tool-card><span class="object-icon">${icon(tool.icon)}</span><div><div class="cluster"><strong>${esc(tool.name)}</strong><span class="badge ${tool.state === "simulated" ? "badge-accent" : tool.state === "preview" ? "badge-warning" : "badge-success"}">${esc(tool.state)}</span></div><p>${esc(tool.description)}</p><small>${esc(tool.category)}</small></div></article>`;
  }

  async function runExport(type, project, pipeline, trigger = null) {
    if ($("#report-title")) syncReportDraft(project, pipeline, false);
    const settings = getSettings();
    const report = reportState(project, pipeline);
    const exportProject = { ...project, name: report.title, objective: report.executiveSummary };
    const reportUser = {...D.user, name: report.author || settings.reportAuthor, laboratory: report.laboratory || settings.reportLab, organisation: report.organisation || settings.reportOrganisation};
    const options = {
      palette: settings.palette,
      pipeline,
      user: reportUser,
      findings: D.aiFindings,
      knowledge: D.knowledge,
      experiments: D.experiments,
      report
    };
    const base = project.id.toLowerCase();
    const previous = trigger?.innerHTML;
    if (trigger) { trigger.disabled = true; trigger.textContent = "Generating…"; }
    const finishLog = Log.time("export.generate", { type, projectId: project.id, palette: settings.palette });
    Log.info("export.started", { type, projectId: project.id });
    try {
      if (type === "pdf") E.download(await E.reportPdf(exportProject, D.demoDataset, options), `${base}-scientific-report.pdf`);
      if (type === "docx") E.download(E.reportDocx(exportProject, D.demoDataset, options), `${base}-editable-report.docx`);
      if (type === "xlsx") E.download(E.reportXlsx(exportProject, D.demoDataset, options), `${base}-analysis-workbook.xlsx`);
      if (type === "latex") E.download(E.reportLatexBundle(exportProject, D.demoDataset, options), `${base}-latex-report.zip`);
      if (type === "yaml") E.download(new Blob([E.projectYaml(exportProject, pipeline)], {type: "text/yaml"}), `${base}-project.yaml`);
      if (type === "jsonl") E.download(new Blob([E.jsonl(exportProject, D.demoDataset)], {type: "application/x-ndjson"}), `${base}-measurements.jsonl`);
      if (type === "csv") E.download(new Blob([E.csv(D.demoDataset)], {type: "text/csv"}), `${base}-measurements.csv`);
      if (type === "bundle" || type === "nomad") E.download(await E.bundle(exportProject, pipeline, D.demoDataset, type === "nomad", options), `${base}-${type === "nomad" ? "nomad-preview" : "complete-project"}.zip`);
      finishLog({ status: "success" });
      toast(`${type.toUpperCase()} generated locally with the ${E.palettes[settings.palette].name} palette.`);
    } catch (error) {
      Log.error("export.failed", { type, projectId: project.id, error });
      finishLog({ status: "failed" });
      toast(`Could not generate ${type.toUpperCase()}.`, "error");
    } finally {
      if (trigger) { trigger.disabled = false; trigger.innerHTML = previous; }
    }
  }

  const cabinetTypeCatalog = {
    material: {label:"Materials", singular:"Material", icon:"database", description:"Raw and functional laboratory materials"},
    solvent: {label:"Solvents", singular:"Solvent", icon:"flask", description:"Traceable liquids and handling metadata"},
    solution: {label:"Solutions", singular:"Solution", icon:"flask", description:"Reusable recipes with explicit composition"},
    stack: {label:"Stacks", singular:"Stack", icon:"layers", description:"Ordered device and material architectures"},
    mapping: {label:"Mappings", singular:"Mapping", icon:"swap", description:"Import schemas and normalized fields"},
    analysis: {label:"Analyses", singular:"Analysis", icon:"chart", description:"Deterministic analysis recipes"}
  };

  function cabinetTypeInfo(type) {
    return cabinetTypeCatalog[type] || {label:String(type || "Resource"), singular:String(type || "Resource"), icon:"database", description:"Reusable laboratory definition"};
  }

  function cabinetVisual(item) {
    const parts = String(item.meta || "").split(/\s*[·,/]\s*/).filter(Boolean).slice(0,6);
    if (item.type === "stack") return `<div class="cabinet-visual cabinet-visual-stack" aria-hidden="true">${parts.map((part,index) => `<i style="height:${12 + index * 6}px;opacity:${(0.68 + index * 0.05).toFixed(2)}" title="${esc(part)}"></i>`).join("")}</div>`;
    if (item.type === "solution") return `<div class="cabinet-visual cabinet-visual-solution" aria-hidden="true"><i></i><i></i><i></i><span>${icon("flask")}</span></div>`;
    if (item.type === "mapping") return `<div class="cabinet-visual cabinet-visual-mapping" aria-hidden="true"><span>${parts.slice(0,3).map(() => "<i></i>").join("")}</span>${icon("arrow")}<span>${parts.slice(0,3).map(() => "<b></b>").join("")}</span></div>`;
    if (item.type === "analysis") return `<div class="cabinet-visual cabinet-visual-analysis" aria-hidden="true">${[42,68,54,86,72].map((height,index) => `<i style="--bar-height:${Math.max(20,Math.min(92,height + ((item.usage + index * 7) % 13) - 6))}%"></i>`).join("")}</div>`;
    return `<div class="cabinet-visual cabinet-visual-material" aria-hidden="true"><i></i><i></i><i></i><i></i><span>${icon(item.type === "solvent" ? "flask" : "database")}</span></div>`;
  }

  function cabinetCardMarkup(item, {demo = false} = {}) {
    const info = cabinetTypeInfo(item.type);
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const tag = "article";
    const attributes = demo ? "" : `tabindex="0" role="button" aria-pressed="false" data-object-card data-object-id="${esc(item.id)}" data-type="${esc(item.type)}" data-usage="${Number(item.usage) || 0}" data-name="${esc(String(item.name || "").toLowerCase())}" data-search="${esc(`${item.name || ""} ${item.subtitle || ""} ${item.meta || ""} ${tags.join(" ")}`.toLowerCase())}"`;
    return `<${tag} class="cabinet-resource-card" ${attributes} data-cabinet-type="${esc(item.type)}"><div class="cabinet-card-top"><span class="cabinet-type-icon">${icon(info.icon)}</span><span class="cabinet-id">${esc(item.id)}</span>${badgeStatus(item.status)}</div>${cabinetVisual(item)}<div class="cabinet-card-copy"><span class="cabinet-kind">${esc(info.singular || info.label)}</span><h3>${esc(item.name)}</h3><p>${esc(item.subtitle)}</p><small>${esc(item.meta)}</small></div><div class="cabinet-card-footer"><div class="cluster">${tags.slice(0,2).map((value) => `<span class="badge">${esc(value)}</span>`).join("")}</div><span>${Number(item.usage) || 0} uses</span></div></${tag}>`;
  }

  function cabinetInspectorMarkup(item, {compact = false} = {}) {
    if (!item) return `<div class="empty"><strong>No resource selected</strong><p>Choose a laboratory object to inspect its reusable definition.</p></div>`;
    const info = cabinetTypeInfo(item.type);
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const details = String(item.meta || "").split(/\s*·\s*/).filter(Boolean);
    return `<div class="cabinet-inspector-head" data-cabinet-type="${esc(item.type)}"><span class="cabinet-type-icon cabinet-type-icon-lg">${icon(info.icon)}</span><div><span class="page-eyebrow">${esc(info.singular || info.label)} · ${esc(item.id)}</span><h2>${esc(item.name)}</h2><p>${esc(item.subtitle)}</p></div>${badgeStatus(item.status)}</div>${cabinetVisual(item)}<div class="cabinet-inspector-facts"><div><span>Definition</span><strong>${esc(details[0] || item.meta || "Structured local object")}</strong></div><div><span>Usage</span><strong>${Number(item.usage) || 0} project snapshots</strong></div><div><span>Behaviour</span><strong>Copied as a traceable snapshot</strong></div>${details.slice(1,4).map((value) => `<div><span>Metadata</span><strong>${esc(value)}</strong></div>`).join("")}</div><div class="cluster cabinet-inspector-tags">${tags.map((value) => `<span class="badge badge-accent">${esc(value)}</span>`).join("")}</div>${compact ? "" : `<div class="cabinet-inspector-actions"><button class="btn btn-primary" type="button" data-cabinet-action="use">${icon("plus")} Use in project</button><button class="btn" type="button" data-cabinet-action="history">${icon("clock")} Inspect history</button></div><div class="notice"><div>${icon("link")}</div><div><strong>Traceability contract</strong><p>Projects receive a stable snapshot. Updating this reusable definition never silently rewrites existing experiments.</p></div></div>`}`;
  }

  function renderCabinet() {
    const cabinet = Array.isArray(D.cabinet) ? D.cabinet : [];
    $("#page-content").innerHTML = header("Lab Cabinet", "A visual, reusable library for materials, solutions, stacks, mappings and analysis recipes. Every use creates a traceable project snapshot.", `<a class="btn" href="knowledge.html">${icon("book")} Knowledge</a><button class="btn btn-primary" type="button" id="cabinet-create">${icon("plus")} New resource</button>`, {eyebrow:"Reusable laboratory definitions"}) + `
      <section class="summary-strip summary-strip-metrics" aria-label="Lab Cabinet summary">${[["Reusable objects",cabinet.length,"curated local definitions"],["Reviewed",cabinet.filter((item) => item.status === "reviewed").length,"ready for project snapshots"],["Resource families",new Set(cabinet.map((item) => item.type)).size,"materials through analyses"],["Total uses",cabinet.reduce((sum, item) => sum + (Number(item.usage) || 0), 0),"across demonstration projects"]].map(([label,value,detail]) => `<div class="summary-item metric-summary"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`).join("")}</section>
      <section class="section"><div class="section-heading"><div><h2>Browse reusable objects</h2><p>Filter by scientific role, inspect metadata and reuse a controlled definition without editing historical records.</p></div><a class="btn btn-sm" href="tools.html">${icon("grid")} Open generic tools</a></div><div id="cabinet-content">${cabinetObjects()}</div></section>`;
    bindCabinetContent();
    $("#cabinet-create")?.addEventListener("click", () => toast("Resource creation is a future backend action. This POC keeps the catalogue read-only."));
  }

  function cabinetObjects() {
    const cabinet = Array.isArray(D.cabinet) ? D.cabinet : [];
    const types = [...new Set(cabinet.map((item) => item.type))];
    const first = cabinet[0];
    const familyButtons = ["all", ...types].map((type) => {
      const items = type === "all" ? cabinet : cabinet.filter((item) => item.type === type);
      const info = type === "all" ? {label:"All resources",icon:"grid",description:"Complete reusable catalogue"} : cabinetTypeInfo(type);
      return `<button class="cabinet-family-card ${type === "all" ? "active" : ""}" type="button" data-cabinet-filter="${esc(type)}" aria-pressed="${type === "all" ? "true" : "false"}"><span>${icon(info.icon)}</span><strong>${esc(info.label)}</strong><small>${items.length} items · ${items.reduce((sum,item) => sum + (Number(item.usage) || 0),0)} uses</small></button>`;
    }).join("");
    return `<div class="cabinet-family-bar" role="group" aria-label="Filter Lab Cabinet by resource family">${familyButtons}</div><div class="cabinet-browser"><div class="cabinet-browser-main"><div class="toolbar cabinet-toolbar"><div class="search cabinet-search"><span>${icon("search")}</span><input class="input" id="cabinet-search" aria-label="Search Lab Cabinet" placeholder="Search name, metadata or tag…"></div><label class="cabinet-sort"><span class="sr-only">Sort resources</span><select class="select" id="cabinet-sort" aria-label="Sort resources"><option value="usage">Most used</option><option value="name">Name A–Z</option><option value="status">Reviewed first</option></select></label><div class="toolbar-spacer"></div><span class="badge" id="cabinet-result-count">${cabinet.length} resources</span></div><div class="cabinet-results-heading"><div><strong>Resource catalogue</strong><small>Click a card to inspect the reusable definition.</small></div><span class="cabinet-view-label">Grid + inspector</span></div><div class="cabinet-resource-grid" id="object-grid">${cabinet.map((item) => cabinetCardMarkup(item)).join("")}</div><div class="empty cabinet-empty" id="cabinet-empty" hidden><strong>No matching resources</strong><p>Change the family filter or search terms.</p></div></div><aside class="panel cabinet-inspector sticky" id="cabinet-inspector" data-cabinet-type="${esc(first?.type || "material")}" aria-live="polite">${cabinetInspectorMarkup(first)}</aside></div>`;
  }

  function bindCabinetContent() {
    const cabinet = Array.isArray(D.cabinet) ? D.cabinet : [];
    const byId = new Map(cabinet.map((item) => [item.id, item]));
    const grid = $("#object-grid");
    const inspector = $("#cabinet-inspector");
    const resultCount = $("#cabinet-result-count");
    const empty = $("#cabinet-empty");
    let activeType = "all";
    let selectedId = cabinet[0]?.id || null;

    const selectResource = (id) => {
      const item = byId.get(id);
      if (!item) return;
      selectedId = id;
      $$('[data-object-card]', grid).forEach((card) => {
        const active = card.dataset.objectId === id;
        card.classList.toggle("selected", active);
        card.setAttribute("aria-pressed", active ? "true" : "false");
      });
      inspector.dataset.cabinetType = item.type;
      inspector.innerHTML = cabinetInspectorMarkup(item);
      $$('[data-cabinet-action]', inspector).forEach((button) => button.addEventListener("click", () => toast(button.dataset.cabinetAction === "use" ? `${item.name} is ready to be copied into a project snapshot.` : `${item.name} has ${item.usage} demonstration uses; history remains read-only in this POC.`)));
    };

    const apply = () => {
      const query = $("#cabinet-search").value.trim().toLowerCase();
      const sort = $("#cabinet-sort").value;
      const cards = $$('[data-object-card]', grid);
      cards.sort((a,b) => sort === "name" ? a.dataset.name.localeCompare(b.dataset.name) : sort === "status" ? Number(b.querySelector(".badge-success") !== null) - Number(a.querySelector(".badge-success") !== null) : Number(b.dataset.usage) - Number(a.dataset.usage)).forEach((card) => grid.appendChild(card));
      const visible = cards.filter((card) => {
        const show = card.dataset.search.includes(query) && (activeType === "all" || card.dataset.type === activeType);
        card.hidden = !show;
        return show;
      });
      resultCount.textContent = `${visible.length} ${visible.length === 1 ? "resource" : "resources"}`;
      empty.hidden = visible.length > 0;
      if (!visible.length) {
        selectedId = null;
        inspector.removeAttribute("data-cabinet-type");
        inspector.innerHTML = cabinetInspectorMarkup(null);
      } else if (!visible.some((card) => card.dataset.objectId === selectedId)) {
        selectResource(visible[0].dataset.objectId);
      }
    };

    $$('[data-cabinet-filter]').forEach((button) => button.addEventListener("click", () => {
      activeType = button.dataset.cabinetFilter;
      $$('[data-cabinet-filter]').forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", active ? "true" : "false");
      });
      apply();
    }));
    $$('[data-object-card]', grid).forEach((card) => {
      card.addEventListener("click", () => selectResource(card.dataset.objectId));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectResource(card.dataset.objectId);
        }
      });
    });
    $("#cabinet-search").addEventListener("input", apply);
    $("#cabinet-sort").addEventListener("change", apply);
    if (selectedId) selectResource(selectedId);
    apply();
  }

  function userDirectoryMarkup() {
    const users = workspaceUserDirectory();
    const active = users.filter((item) => item.status === "active").length;
    const invited = users.filter((item) => item.status === "invited").length;
    const roles = new Set(users.map((item) => item.permission || item.role)).size;
    return `<section class="summary-strip" aria-label="User management summary"><div class="summary-item metric-summary"><span>Workspace users</span><strong>${users.length}</strong><small>session directory</small></div><div class="summary-item metric-summary"><span>Active</span><strong>${active}</strong><small>available users</small></div><div class="summary-item metric-summary"><span>Invited</span><strong>${invited}</strong><small>pending access</small></div><div class="summary-item metric-summary"><span>Roles</span><strong>${roles}</strong><small>demonstrated policies</small></div></section>
      <div class="grid grid-2 user-management-grid"><section class="panel wide"><div class="panel-header"><div><h3 class="mb-0">Workspace directory</h3><small>Manage illustrative users, roles and project access for this session</small></div><button class="btn btn-primary btn-sm" id="add-workspace-user">${icon("plus")} Add user</button></div><div class="table-wrap user-directory-table"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Project access</th><th>Last activity</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${users.map((item) => `<tr><td><div class="directory-user"><span class="avatar">${esc(item.initials || normalizeUser(item).initials)}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.email || "No email")}${item.isCurrent ? " · You" : ""}</small></span></div></td><td><span class="badge">${esc(item.permission || item.role)}</span></td><td><span class="badge ${item.status === "active" ? "badge-success" : "badge-warning"}">${esc(item.status === "active" ? "Active" : "Invited")}</span></td><td>${esc(item.access || "Assigned projects")}</td><td><small>${esc(item.lastActivity || "No activity")}</small></td><td><div class="cluster user-row-actions"><button class="btn btn-ghost icon-btn" data-user-edit="${esc(item.id)}" aria-label="Edit ${esc(item.name)}">${icon("edit")}</button>${item.isCurrent ? "" : `<button class="btn btn-ghost icon-btn" data-user-remove="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">${icon("trash")}</button>`}</div></td></tr>`).join("")}</tbody></table></div></section>
      <div class="stack"><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Role model</h3><small>Future backend permission vocabulary</small></div>${icon("user")}</div><div class="panel-body role-policy-list"><div><strong>Owner</strong><span>Workspace policy and all projects</span></div><div><strong>Research lead</strong><span>Projects, review and approval</span></div><div><strong>Researcher</strong><span>Create and edit assigned work</span></div><div><strong>Data steward</strong><span>Data quality, mappings and exports</span></div><div><strong>Viewer</strong><span>Read-only approved records</span></div></div></section><div class="notice notice-warning"><div>${icon("info")}</div><div><strong>POC boundary</strong><p>No account is created and no invitation is sent. Records reset on reload and demonstrate the intended user-management contract only.</p></div></div></div></div>`;
  }

  function renderUserDirectoryPane() {
    const root = $("#users-settings-content");
    if (!root) return;
    root.innerHTML = userDirectoryMarkup();
    bindUserDirectory();
  }

  function openUserEditor(userId = null) {
    const users = workspaceUserDirectory();
    const existing = userId ? users.find((item) => item.id === userId) : null;
    const user = existing || {id:`USR-DEMO-${Date.now().toString(36).toUpperCase()}`, name:"", email:"", permission:"Researcher", role:"Researcher", status:"invited", access:"Assigned projects", lastActivity:"Invitation pending"};
    modal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="user-editor-title" id="user-editor-form"><div class="modal-header"><div><h2 id="user-editor-title" class="mb-0">${existing ? "Edit user" : "Add workspace user"}</h2><small>Session-only directory record</small></div><button class="btn btn-ghost icon-btn" type="button" data-action="close-modal" aria-label="Close">${icon("x")}</button></div><div class="modal-body form-grid"><div class="field wide"><label for="managed-user-name">Display name</label><input class="input" id="managed-user-name" required value="${esc(user.name)}"></div><div class="field wide"><label for="managed-user-email">Email</label><input class="input" id="managed-user-email" type="email" required value="${esc(user.email)}"></div><div class="field"><label for="managed-user-role">Role</label><select class="select" id="managed-user-role">${["Owner","Research lead","Researcher","Data steward","Viewer"].map((role) => `<option ${String(user.permission).toLowerCase() === role.toLowerCase() ? "selected" : ""}>${role}</option>`).join("")}</select></div><div class="field"><label for="managed-user-status">Status</label><select class="select" id="managed-user-status"><option value="active" ${user.status === "active" ? "selected" : ""}>Active</option><option value="invited" ${user.status === "invited" ? "selected" : ""}>Invited</option></select></div><div class="field wide"><label for="managed-user-access">Project access</label><select class="select" id="managed-user-access"><option ${user.access === "All projects" ? "selected" : ""}>All projects</option><option ${user.access !== "All projects" ? "selected" : ""}>Assigned projects</option></select></div><div class="wide notice"><div>${icon("lock")}</div><div><strong>Demonstration only</strong><p>This does not create credentials or enforce permissions.</p></div></div></div><div class="modal-footer"><button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${existing ? "Save user" : "Add user"}</button></div></form>`);
    $("#user-editor-form").onsubmit = (event) => {
      event.preventDefault();
      const next = normalizeUser({...user, name:$("#managed-user-name").value.trim(), email:$("#managed-user-email").value.trim(), permission:$("#managed-user-role").value, role:$("#managed-user-role").value, status:$("#managed-user-status").value, access:$("#managed-user-access").value, lastActivity:$("#managed-user-status").value === "active" ? "Updated this session" : "Invitation pending"});
      const directory = workspaceUserDirectory();
      const index = directory.findIndex((item) => item.id === next.id);
      if (index >= 0) directory[index] = {...directory[index], ...next}; else directory.push(next);
      saveWorkspaceUserDirectory(directory);
      closeModal();
      renderUserDirectoryPane();
      toast(existing ? "User record updated for this session." : "User added to the session directory.");
    };
  }

  function bindUserDirectory() {
    $("#add-workspace-user")?.addEventListener("click", () => openUserEditor());
    $$('[data-user-edit]').forEach((button) => button.addEventListener("click", () => openUserEditor(button.dataset.userEdit)));
    $$('[data-user-remove]').forEach((button) => button.addEventListener("click", () => {
      const user = workspaceUserDirectory().find((item) => item.id === button.dataset.userRemove);
      if (!user) return;
      modal(`<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="remove-user-title"><div class="modal-header"><h2 id="remove-user-title" class="mb-0">Remove ${esc(user.name)}?</h2><button class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">${icon("x")}</button></div><div class="modal-body"><p>This removes only the temporary directory record. No account or project data is affected.</p></div><div class="modal-footer"><button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-danger" id="confirm-remove-user">Remove user</button></div></div>`);
      $("#confirm-remove-user").onclick = () => { saveWorkspaceUserDirectory(workspaceUserDirectory().filter((item) => item.id !== user.id)); closeModal(); renderUserDirectoryPane(); toast("User removed from the session directory."); };
    }));
  }

  function renderSettings() {
    const settings = getSettings();
    const user = currentUser();
    const nameParts = user.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ");
    const paletteOptions = Object.entries(E.palettes).map(([id, palette]) => `<label class="palette-option"><input type="radio" name="palette" value="${id}" ${settings.palette === id ? "checked" : ""}><span class="color-swatch" style="background:#${palette.hex}"></span><span><strong>${esc(palette.name)}</strong><small class="block">#${palette.hex}</small></span></label>`).join("");
    $("#page-content").innerHTML = header("Settings", "Manage the session profile and user directory, then inspect temporary appearance and integration settings.", `<button class="btn" id="download-settings">${icon("download")} Download settings.yaml</button><button class="btn btn-primary" id="save-settings">${icon("check")} Apply for this page</button>`) + `
      <div class="configuration-boundary"><div>${icon("file")}<span><strong>Declarative source: settings.yaml</strong><small>The checked-in generated bundle is loaded locally. Downloaded changes must be reviewed and manually replace the repository file.</small></span></div><div><span class="badge badge-success">Loaded</span><span class="badge">${esc(C.application?.deployment || "static")}</span><span class="badge">No browser memory</span></div></div>
      <div class="tabs settings-tabs" role="tablist" aria-label="Settings sections"><button class="tab active" role="tab" aria-selected="true" data-settings-tab="user">Profile & Preferences</button><button class="tab" role="tab" aria-selected="false" data-settings-tab="users">User Management</button><button class="tab" role="tab" aria-selected="false" data-settings-tab="admin">Administration</button></div>
      <div id="user-settings" class="settings-pane stack" role="tabpanel">
        <h2 class="sr-only">User settings</h2>
        <div class="grid grid-2"><div class="stack">
          <div class="panel"><div class="panel-header"><div><h3 class="mb-0">Researcher Profile</h3><small>Personal identity used in the shell and reports</small></div>${icon("user")}</div><div class="panel-body form-grid"><div class="field"><label for="first-name">First Name</label><input class="input" id="first-name" name="first-name" autocomplete="given-name" value="${esc(firstName)}"></div><div class="field"><label for="last-name">Last Name</label><input class="input" id="last-name" name="last-name" autocomplete="family-name" value="${esc(lastName)}"></div><div class="field"><label for="display-name">Display Name</label><input class="input" id="display-name" name="display-name" autocomplete="nickname" value="${esc(user.name)}"></div><div class="field"><label for="user-email">Email</label><input class="input" id="user-email" name="email" type="email" autocomplete="email" spellcheck="false" value="${esc(user.email)}"></div><div class="field"><label for="user-role">Role</label><input class="input" id="user-role" name="role" autocomplete="organization-title" value="${esc(user.role)}"></div><div class="field"><label for="user-workspace">Workspace</label><input class="input" id="user-workspace" name="workspace" value="${esc(user.workspace)}"></div><div class="field"><label for="user-org">Organisation</label><input class="input" id="user-org" name="organisation" autocomplete="organization" value="${esc(settings.reportOrganisation)}"></div><div class="field wide"><label for="report-lab">Laboratory</label><input class="input" id="report-lab" name="laboratory" value="${esc(settings.reportLab)}"></div></div></div>
          <div class="panel"><div class="panel-header"><div><h3 class="mb-0">Interface & Locale</h3><small>Topbar and sidebar stay dark while following theme and palette</small></div>${icon("grid")}</div><div class="panel-body stack"><div class="form-grid"><div class="field"><label for="theme">Content Theme</label><select class="select" id="theme" name="theme"><option value="light">Light Content</option><option value="dark">Dark Content</option></select></div><div class="field"><label for="density">Density</label><select class="select" id="density" name="density"><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></div><div class="field"><label for="language">Language</label><select class="select" id="language" name="language"><option value="en">English</option><option value="it">Italiano</option></select></div><div class="field"><label for="units">Preferred Units</label><select class="select" id="units" name="units"><option value="si">SI scientific</option><option value="lab">Laboratory practical</option></select></div></div><h4>Colour Palette</h4><div class="grid grid-4">${paletteOptions}</div></div></div>
          <div class="panel"><div class="panel-header"><div><h3 class="mb-0">Report Preferences</h3><small>Shared identity for PDF, DOCX, Excel and LaTeX</small></div>${icon("file")}</div><div class="panel-body form-grid"><div class="field"><label for="report-author">Report Author</label><input class="input" id="report-author" name="report-author" value="${esc(settings.reportAuthor)}"></div><div class="field"><label for="default-export">Default Export</label><select class="select" id="default-export" name="default-export"><option value="bundle">Complete Project ZIP</option><option value="pdf">Scientific PDF</option><option value="docx">Editable DOCX</option><option value="xlsx">Analysis Workbook</option><option value="latex">LaTeX Report Package</option></select></div><div class="wide notice notice-success"><div>${icon("check")}</div><div><strong>One report source</strong><p>All formats use the same approved findings, provenance, names and active palette.</p></div></div></div></div>
        </div><div class="stack">
          <div class="panel ai-panel"><div class="panel-header"><div><h3 class="mb-0">AI Assistant Preferences</h3><small>Local deterministic assistance only</small></div>${icon("spark")}</div><div class="panel-body stack"><label class="toggle"><input type="checkbox" id="ai-enabled" ${settings.aiEnabled ? "checked" : ""}><span class="toggle-track"></span><span>Show contextual AI assistance</span></label><div class="field"><label for="knowledge-scope">Default Knowledge Scope</label><select class="select" id="knowledge-scope"><option value="approved">Project + Approved Knowledge</option><option value="reviewed">Project + Approved/Reviewed</option><option value="all">All Records, Visibly Labelled</option></select></div><div class="notice notice-warning"><div>${icon("info")}</div><div><strong>Simulated, not connected</strong><p>Responses use fixed local rules and included records. No prompt or data leaves the browser.</p></div></div></div></div>
          <div class="panel"><div class="panel-header"><div><h3 class="mb-0">Personal NOMAD Configuration</h3><small>Demonstration fields kept only in page memory</small></div>${icon("external")}</div><div class="panel-body form-grid"><div class="field wide"><label for="nomad-url">Instance URL</label><input class="input" id="nomad-url" name="nomad-url" type="url" inputmode="url" autocomplete="off" value="${esc(settings.nomadUrl)}" placeholder="Demonstration URL only…"></div><div class="field"><label for="nomad-user">Account / Username</label><input class="input" id="nomad-user" name="nomad-user" autocomplete="off" spellcheck="false" value="${esc(settings.nomadUsername)}" placeholder="Demonstration account only…"></div><div class="field"><label for="nomad-key">API Key</label><div class="input-group"><input class="input" id="nomad-key" name="nomad-key" type="password" autocomplete="off" spellcheck="false" value="${esc(settings.nomadApiKey)}" placeholder="Never enter a real key…"><button class="btn" type="button" id="show-nomad-key" aria-label="Show API key">Show</button></div></div><div class="field wide"><div class="cluster"><button class="btn" type="button" id="test-nomad">Test Fields (Simulated)</button><span class="badge" id="nomad-state">Not tested</span></div></div><div class="wide notice notice-warning"><div>${icon("lock")}</div><div><strong>Demonstration only</strong><p>Values are neither persisted, transmitted nor included in exports. Reload clears them. Never enter a real credential.</p></div></div></div></div>
          <div class="panel"><div class="panel-header"><div><h3 class="mb-0">Temporary state</h3><small>Current changes exist only in JavaScript memory</small></div>${icon("trash")}</div><div class="panel-body row justify-between"><div><strong>Reset temporary state</strong><p class="mb-0">Restore included projects, reports and interface defaults now.</p></div><button class="btn btn-danger" id="reset-demo">Reset…</button></div></div>
        </div></div>
      </div>
      <div id="users-settings" class="settings-pane stack" role="tabpanel" hidden><h2 class="sr-only">User management</h2><div id="users-settings-content"></div></div>
      <div id="admin-settings" class="settings-pane stack" role="tabpanel" hidden>
        <h2 class="sr-only">Admin settings</h2>
        <div class="notice notice-warning"><div>${icon("info")}</div><div><strong>Demonstration administration</strong><p>These controls model global policy only. There is no authentication, permission enforcement or shared server configuration.</p></div></div>
        <div class="grid grid-2"><div class="panel"><div class="panel-header"><h3 class="mb-0">Branding & Interface Policy</h3>${icon("palette")}</div><div class="panel-body form-grid"><div class="field wide"><label for="admin-lab">Laboratory Name</label><input class="input" id="admin-lab" name="admin-lab" value="${esc(settings.laboratoryName)}"></div><div class="field"><label for="admin-theme">Forced Theme</label><select class="select" id="admin-theme"><option value="user">Allow User Choice</option><option value="dark">Force Dark</option><option value="light">Force Light Content</option></select></div><div class="field"><label for="admin-palette">Default Palette</label><select class="select" id="admin-palette">${Object.entries(E.palettes).map(([id, palette]) => `<option value="${id}">${esc(palette.name)}</option>`).join("")}</select></div><div class="field wide"><label for="admin-branding">Report Branding</label><input class="input" id="admin-branding" value="LabFlow · CHOSE Research Workspace"></div></div></div><div class="panel"><div class="panel-header"><h3 class="mb-0">Feature & Content Policy</h3>${icon("settings")}</div><div class="panel-body stack"><label class="check-row"><input type="checkbox" checked><span>Enable CHOSE Pipeline</span></label><label class="check-row"><input type="checkbox" checked><span>Enable Quick Measurement Review</span></label><label class="check-row"><input type="checkbox" checked><span>Enable AI-Assisted Findings (Simulated)</span></label><label class="check-row"><input type="checkbox" checked><span>Require Evidence for AI Findings</span></label><label class="check-row"><input type="checkbox" checked><span>Show Knowledge Base Working Notes</span></label></div></div><div class="panel"><div class="panel-header"><h3 class="mb-0">Report & Export Policy</h3>${icon("download")}</div><div class="panel-body stack"><label class="check-row"><input type="checkbox" checked><span>PDF (Native file from the current Report Composer state)</span></label><label class="check-row"><input type="checkbox" checked><span>DOCX (Editable Working Document)</span></label><label class="check-row"><input type="checkbox" checked><span>Excel (10-Sheet Workbook)</span></label><label class="check-row"><input type="checkbox" checked><span>LaTeX (Compile-Ready Report Package)</span></label><label class="check-row"><input type="checkbox" checked><span>Complete Project ZIP</span></label><label class="check-row"><input type="checkbox" checked><span>NOMAD-Ready Preview (No Upload)</span></label></div></div><div class="panel"><div class="panel-header"><h3 class="mb-0">Shared Configuration Boundary</h3>${icon("lock")}</div><div class="panel-body"><div class="check-list"><div class="check-row">${icon("check")}<span>Global settings remain illustrative.</span></div><div class="check-row">${icon("check")}<span>Personal settings remain separate from policy.</span></div><div class="check-row">${icon("check")}<span>No control implies real authorization.</span></div></div></div></div></div>
      </div>`;
    $("#theme").value = settings.theme;
    $("#density").value = settings.density;
    $("#knowledge-scope").value = settings.knowledgeScope;
    $("#language").value = settings.language;
    $("#units").value = settings.units;
    $("#default-export").value = settings.defaultExport;
    $("#admin-theme").value = settings.adminTheme;
    $("#admin-palette").value = settings.adminPalette;
    $("#save-settings").onclick = () => {
      const updated = {...settings, theme: $("#theme").value, density: $("#density").value, palette: $('input[name="palette"]:checked').value, language: $("#language").value, units: $("#units").value, defaultExport: $("#default-export").value, aiEnabled: $("#ai-enabled").checked, knowledgeScope: $("#knowledge-scope").value, reportAuthor: $("#report-author").value, reportLab: $("#report-lab").value, reportOrganisation: $("#user-org").value, nomadUrl: $("#nomad-url").value, nomadUsername: $("#nomad-user").value, nomadApiKey: $("#nomad-key").value, adminTheme: $("#admin-theme").value, adminPalette: $("#admin-palette").value, laboratoryName: $("#admin-lab").value};
      const profileName = $("#display-name").value.trim() || [$("#first-name").value.trim(), $("#last-name").value.trim()].filter(Boolean).join(" ") || user.name;
      const profile = saveCurrentUser({...user, name:profileName, email:$("#user-email").value.trim(), role:$("#user-role").value.trim(), workspace:$("#user-workspace").value.trim(), organisation:$("#user-org").value.trim(), laboratory:$("#report-lab").value.trim()});
      updated.reportAuthor = $("#report-author").value.trim() || profile.name;
      saveSettings(updated); applySettings(); hydrateShell("settings"); renderUserDirectoryPane(); toast("Profile and preferences applied for this session and carried to other pages.");
    };
    $("#download-settings").onclick = () => {
      const copy = JSON.parse(JSON.stringify(C));
      copy.appearance = {...copy.appearance, default_theme: $("#theme").value, default_palette: $('input[name="palette"]:checked').value, default_density: $("#density").value};
      copy.reports = {...copy.reports, author: $("#report-author").value, laboratory: $("#report-lab").value, organisation: $("#user-org").value, default_export: $("#default-export").value};
      copy.ai = {...copy.ai, enabled: $("#ai-enabled").checked}; copy.knowledge = {...copy.knowledge, default_scope: $("#knowledge-scope").value};
      const yaml = `# LabFlow configuration\n# Edit this file directly: YAML comments are supported.\n${yamlDocument(copy)}\n`;
      E.download(new Blob([yaml], {type:"application/yaml"}), "settings.yaml");
      toast("Configuration copy downloaded. Replace settings.yaml manually after review.");
    };
    const previewSetting = (key, value) => { const preview = getSettings(); preview[key] = value; saveSettings(preview); T.apply(preview); };
    $$('input[name="palette"]').forEach((input) => input.addEventListener("change", () => previewSetting("palette", input.value)));
    $("#theme").addEventListener("change", (event) => previewSetting("theme", event.target.value));
    $("#density").addEventListener("change", (event) => previewSetting("density", event.target.value));
    const activateSettingsTab = (name) => {
      const selected = ["user", "users", "admin"].includes(name) ? name : "user";
      $("#user-settings").hidden = selected !== "user";
      $("#users-settings").hidden = selected !== "users";
      $("#admin-settings").hidden = selected !== "admin";
      $$('[data-settings-tab]').forEach((item) => { const active = item.dataset.settingsTab === selected; item.classList.toggle("active", active); item.setAttribute("aria-selected", active); });
      if (selected === "users") renderUserDirectoryPane();
    };
    $$('[data-settings-tab]').forEach((tab) => tab.onclick = () => activateSettingsTab(tab.dataset.settingsTab));
    activateSettingsTab(new URLSearchParams(location.search).get("tab") || "user");
    $("#show-nomad-key").onclick = () => { const input = $("#nomad-key"); const showing = input.type === "text"; input.type = showing ? "password" : "text"; $("#show-nomad-key").textContent = showing ? "Show" : "Hide"; $("#show-nomad-key").setAttribute("aria-label", showing ? "Show API key" : "Hide API key"); };
    $("#test-nomad").onclick = () => { const complete = $("#nomad-url").value && $("#nomad-user").value && $("#nomad-key").value; $("#nomad-state").className = `badge ${complete ? "badge-success" : "badge-warning"}`; $("#nomad-state").textContent = complete ? "Simulated configuration valid" : "Complete URL, account and demo key"; toast("Simulation only: no NOMAD request was sent.", complete ? "success" : "error"); };
    $("#reset-demo").onclick = () => {
      modal(`<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-title"><div class="modal-header"><h2 id="reset-title" class="mb-0">Reset temporary state?</h2><button class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">${icon("x")}</button></div><div class="modal-body"><p>This clears temporary preferences, project edits, assistant messages and report drafts. Included demo files remain unchanged.</p></div><div class="modal-footer"><button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-danger" id="confirm-reset">Reset now</button></div></div>`);
      $("#confirm-reset").onclick = () => { S.reset(); T.apply(T.defaults); closeModal(); toast("Temporary state reset."); setTimeout(() => location.reload(), 250); };
    };
  }

  function renderDocumentationFallback() {
    $("#page-content").innerHTML = header("Documentation", "Curated product guidance is temporarily unavailable.") + `<div class="empty"><strong>Documentation bundle not loaded</strong><p>Documentation cannot be displayed in this copy. Reload the complete LabFlow package and try again.</p></div>`;
  }

  function markdownSlug(value) {
    return String(value || "")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*_~]/g, "")
      .normalize("NFKD").replace(/\p{Mark}/gu, "")
      .toLocaleLowerCase("en")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/(^-|-$)/g, "") || "section";
  }

  function normalizedLocalPath(currentPath, requestedPath) {
    const absolute = requestedPath.startsWith("/");
    const parts = absolute ? [] : String(currentPath || "").split("/").slice(0, -1);
    for (const part of requestedPath.replace(/^\/+/, "").split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (!parts.length) return "";
        parts.pop();
      } else parts.push(part);
    }
    return parts.join("/");
  }

  function markdownDestination(rawDestination, currentDoc, image = false) {
    const raw = String(rawDestination || "").trim().replace(/^<|>$/g, "");
    if (!raw || /^(?:javascript|data|vbscript):/i.test(raw)) return "";
    if (/^(?:https?:|mailto:)/i.test(raw)) return image ? "" : raw;
    const hashAt = raw.indexOf("#");
    const requestedPath = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
    const requestedHash = hashAt >= 0 ? raw.slice(hashAt + 1) : "";
    let decodedHash = requestedHash;
    try { decodedHash = decodeURIComponent(requestedHash); } catch {}
    const hash = requestedHash ? `#${encodeURIComponent(markdownSlug(decodedHash))}` : "";
    if (!requestedPath) return hash || "";
    const path = normalizedLocalPath(currentDoc.path, requestedPath.split(/[?#]/)[0]);
    if (!path) return "";
    if (/\.md$/i.test(path)) {
      const target = DOCS.find((doc) => doc.path.toLowerCase() === path.toLowerCase());
      return target ? `documentation.html?doc=${encodeURIComponent(target.id)}${hash}` : "";
    }
    return image && !/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(path) ? "" : `${path}${hash}`;
  }

  function inlineMarkdown(value, currentDoc) {
    const tokens = [];
    const token = (html) => { tokens.push(html); return `\uE000${tokens.length - 1}\uE001`; };
    let source = String(value || "")
      .replace(/`([^`\n]+)`/g, (_, code) => token(`<code>${esc(code)}</code>`))
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, destination) => {
        const src = markdownDestination(destination.replace(/\s+["'].*$/, ""), currentDoc, true);
        return token(src ? `<span class="doc-image doc-wide"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"><span class="doc-image-caption">${esc(alt)}</span></span>` : `<span class="doc-broken-media">Local image unavailable: ${esc(alt || "unnamed image")}</span>`);
      })
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, destination) => {
        const href = markdownDestination(destination.replace(/\s+["'].*$/, ""), currentDoc);
        const external = /^(?:https?:|mailto:)/i.test(href);
        return token(href ? `<a href="${esc(href)}"${external ? ' rel="noreferrer"' : ""}>${esc(label)}</a>` : `<span class="doc-broken-link">${esc(label)}</span>`);
      });
    source = esc(source)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
    return source.replace(/\uE000(\d+)\uE001/g, (_, index) => tokens[Number(index)] || "");
  }

  function markdownTableCells(line) {
    const value = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    const cells = [];
    let cell = "";
    let escapedPipe = false;
    for (const character of value) {
      if (character === "|" && !escapedPipe) { cells.push(cell.trim()); cell = ""; }
      else {
        if (character !== "\\" || escapedPipe) cell += character;
        escapedPipe = character === "\\" && !escapedPipe;
        if (character !== "\\") escapedPipe = false;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  function renderMarkdown(markdown, currentDoc) {
    const lines = String(markdown || "").replace(/\r/g, "").split("\n");
    const html = [];
    const headings = [];
    const usedSlugs = new Map();
    const warnings = [];
    const lists = [];
    let documentTitle = "";
    let paragraph = [];
    let inCode = false;
    let codeLanguage = "";
    let code = [];

    const uniqueSlug = (label) => {
      const base = markdownSlug(label);
      const count = usedSlugs.get(base) || 0;
      usedSlugs.set(base, count + 1);
      return count ? `${base}-${count + 1}` : base;
    };
    const flushParagraph = () => {
      if (!paragraph.length) return;
      html.push(`<p>${inlineMarkdown(paragraph.join(" "), currentDoc)}</p>`);
      paragraph = [];
    };
    const closeTopList = () => {
      const top = lists.pop();
      if (!top) return;
      if (top.itemOpen) html.push("</li>");
      html.push(`</${top.type}>`);
    };
    const closeLists = () => { while (lists.length) closeTopList(); };
    const flushCode = (incomplete = false) => {
      const source = code.join("\n");
      if (codeLanguage === "mermaid") {
        if (window.LabFlowDiagrams) html.push(`<figure class="doc-diagram doc-wide">${window.LabFlowDiagrams.render(source, {label:"Documentation flow diagram"})}<figcaption>Rendered locally from the documented graph definition.</figcaption></figure>`);
        else html.push(`<div class="doc-code-fallback doc-wide"><p>Diagram preview unavailable; source shown below.</p><pre><code>${esc(source)}</code></pre></div>`);
      } else html.push(`<pre class="doc-code doc-wide${incomplete ? " doc-code-incomplete" : ""}"><code${codeLanguage ? ` data-language="${esc(codeLanguage)}"` : ""}>${esc(source)}</code></pre>`);
      if (incomplete) warnings.push("Unclosed code fence rendered as source");
      code = [];
      codeLanguage = "";
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^\s*```/.test(line)) {
        flushParagraph(); closeLists();
        if (inCode) flushCode();
        else codeLanguage = line.trim().slice(3).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
        inCode = !inCode;
        continue;
      }
      if (inCode) { code.push(line); continue; }
      if (!line.trim()) { flushParagraph(); closeLists(); continue; }
      if (/^\s*!\[[^\]]*\]\([^)]+\)\s*$/.test(line)) {
        flushParagraph(); closeLists();
        html.push(inlineMarkdown(line.trim(), currentDoc));
        continue;
      }

      const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*$/);
      if (heading) {
        flushParagraph(); closeLists();
        const level = heading[1].length;
        const label = heading[2].trim();
        if (level === 1 && !documentTitle) { documentTitle = label; continue; }
        const id = uniqueSlug(label);
        headings.push({level, id, label: label.replace(/[`*_~]/g, "")});
        html.push(`<h${level} id="${id}">${inlineMarkdown(label, currentDoc)}</h${level}>`);
        continue;
      }

      const nextLine = lines[index + 1] || "";
      if (line.includes("|") && /^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)+\s*\|?\s*$/.test(nextLine)) {
        flushParagraph(); closeLists();
        const headers = markdownTableCells(line);
        const alignments = markdownTableCells(nextLine).map((cell) => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : "left");
        const rows = [];
        index += 2;
        while (index < lines.length && lines[index].trim() && lines[index].includes("|")) { rows.push(markdownTableCells(lines[index])); index += 1; }
        index -= 1;
        const tableLabel = headings.at(-1)?.label || documentTitle || "Documentation table";
        html.push(`<div class="doc-table-wrap doc-wide" role="region" aria-label="${esc(tableLabel)}" tabindex="0"><table><thead><tr>${headers.map((cell, cellIndex) => `<th scope="col" class="align-${alignments[cellIndex] || "left"}">${inlineMarkdown(cell, currentDoc)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, cellIndex) => `<td class="align-${alignments[cellIndex] || "left"}">${inlineMarkdown(row[cellIndex] || "", currentDoc)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }

      const listItem = line.match(/^(\s*)([-+*]|\d+[.)])\s+(.+)$/);
      if (listItem) {
        flushParagraph();
        const indent = listItem[1].replace(/\t/g, "    ").length;
        const type = /^\d/.test(listItem[2]) ? "ol" : "ul";
        while (lists.length && indent < lists.at(-1).indent) closeTopList();
        if (lists.length && indent === lists.at(-1).indent && type !== lists.at(-1).type) closeTopList();
        if (!lists.length || indent > lists.at(-1).indent) {
          html.push(`<${type}>`);
          lists.push({type, indent, itemOpen:false});
        } else if (lists.at(-1).itemOpen) html.push("</li>");
        html.push(`<li>${inlineMarkdown(listItem[3], currentDoc)}`);
        lists.at(-1).itemOpen = true;
        continue;
      }

      if (/^\s*>/.test(line)) {
        flushParagraph(); closeLists();
        const quote = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) { quote.push(lines[index].replace(/^\s*>\s?/, "")); index += 1; }
        index -= 1;
        html.push(`<blockquote><p>${inlineMarkdown(quote.join(" "), currentDoc)}</p></blockquote>`);
      } else if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushParagraph(); closeLists(); html.push("<hr>"); }
      else { closeLists(); paragraph.push(line.trim()); }
    }
    flushParagraph(); closeLists();
    if (inCode) flushCode(true);
    return {html:html.join(""), headings, documentTitle, warnings};
  }

  function renderDocumentation() {
    if (!DOCS.length) return renderDocumentationFallback();
    const requested = new URLSearchParams(location.search).get("doc");
    const selected = requested ? DOCS.find((doc) => doc.id === requested) : DOCS[0];
    if (!selected) {
      Log.warn("documentation.not-found", {documentId:requested});
      $("#page-content").innerHTML = header("Documentation", "Curated product guidance with local navigation and rendering.") + `<div class="empty"><strong>Document not found</strong><p>The selected guide is not included in this LabFlow package.</p><a class="btn btn-primary" href="documentation.html">Open documentation overview</a></div>`;
      return;
    }
    if (!String(selected.markdown || "").trim()) {
      Log.warn("documentation.empty", {documentId:selected.id});
      $("#page-content").innerHTML = header("Documentation", "Curated product guidance with local navigation and rendering.") + `<div class="empty"><strong>Empty document</strong><p>This guide does not contain readable content yet.</p><a class="btn" href="documentation.html">Back to documentation</a></div>`;
      return;
    }
    let rendered;
    try {
      rendered = renderMarkdown(selected.markdown, selected);
    } catch (error) {
      Log.error("documentation.render-failed", {documentId:selected.id, error});
      $("#page-content").innerHTML = header("Documentation", "Curated product guidance with local navigation and rendering.") + `<div class="empty"><strong>Document could not be rendered</strong><p>Reload the page or choose another included guide.</p><a class="btn" href="documentation.html">Back to documentation</a></div>`;
      return;
    }
    if (rendered.warnings.length) Log.warn("documentation.render-warnings", {documentId:selected.id, warnings:rendered.warnings});
    const currentIndex = DOCS.indexOf(selected);
    $("#page-content").innerHTML = header("Documentation", "Curated product guidance with search, table of contents and page navigation.") + `
      <div class="docs-layout${rendered.headings.length ? "" : " docs-layout-no-toc"}"><aside class="docs-nav panel" aria-label="Documentation pages"><div class="panel-body stack"><div class="search"><span>${icon("search")}</span><input class="input" id="docs-search" name="docs-search" autocomplete="off" placeholder="Search documentation…" aria-label="Search documentation"></div><nav id="docs-list" class="doc-nav-groups">${[...new Set(DOCS.map((doc) => doc.group || "Reference"))].map((group) => `<section class="doc-nav-group" data-doc-group><h3 class="doc-nav-group-title">${esc(group)}</h3>${DOCS.filter((doc) => (doc.group || "Reference") === group).map((doc) => `<a class="doc-nav-link ${doc.id === selected.id ? "active" : ""}" ${doc.id === selected.id ? 'aria-current="page"' : ""} href="documentation.html?doc=${encodeURIComponent(doc.id)}"><strong>${esc(doc.title)}</strong><small>${esc(doc.status)} · ${esc(doc.updated)}</small></a>`).join("")}</section>`).join("")}</nav></div></aside><article class="doc-article"><header class="doc-document-header"><span class="page-eyebrow">Current document</span><h2>${esc(rendered.documentTitle || selected.title)}</h2>${selected.description ? `<p>${esc(selected.description)}</p>` : ""}<div class="doc-meta"><span class="badge badge-success">${esc(selected.status)}</span><span>Last reviewed ${esc(selected.updated)}</span><span>Curated product reference</span></div></header><div class="doc-content">${rendered.html}</div><nav class="doc-pagination" aria-label="Documentation pagination">${currentIndex > 0 ? `<a class="btn" href="documentation.html?doc=${encodeURIComponent(DOCS[currentIndex - 1].id)}">← ${esc(DOCS[currentIndex - 1].title)}</a>` : "<span></span>"}${currentIndex < DOCS.length - 1 ? `<a class="btn" href="documentation.html?doc=${encodeURIComponent(DOCS[currentIndex + 1].id)}">${esc(DOCS[currentIndex + 1].title)} →</a>` : ""}</nav></article>${rendered.headings.length ? `<aside class="docs-toc panel" aria-label="On this page"><div class="panel-body"><h3>On this page</h3><nav>${rendered.headings.filter((item) => item.level <= 3).map((item) => `<a class="toc-level-${item.level}" href="#${item.id}">${esc(item.label)}</a>`).join("")}</nav></div></aside>` : ""}</div>`;
    $("#docs-search").addEventListener("input", (event) => { const query = event.target.value.trim().toLowerCase(); $$(".doc-nav-link").forEach((link) => { link.hidden = Boolean(query) && !link.textContent.toLowerCase().includes(query); }); $$('[data-doc-group]').forEach((group) => { group.hidden = [...group.querySelectorAll('.doc-nav-link')].every((link) => link.hidden); }); });
    if (location.hash) {
      let targetId = location.hash.slice(1);
      try { targetId = decodeURIComponent(targetId); } catch {}
      const revealAnchor = () => document.getElementById(targetId)?.scrollIntoView({block:"start"});
      requestAnimationFrame(() => requestAnimationFrame(revealAnchor));
      if (document.readyState !== "complete") window.addEventListener("load", () => setTimeout(revealAnchor, 0), {once:true});
    }
  }

  function renderUiKit() {
    Log.info("page.render", { page: "ui-kit" });
    const colors = ["--bg", "--surface", "--surface2", "--surface3", "--text", "--muted", "--line", "--accent", "--success", "--warning", "--danger", "--info"];
    const comparisonSource = F?.modelComparison || {};
    const modelComparisonItems = Array.isArray(comparisonSource)
      ? comparisonSource
      : (comparisonSource.labels || []).map((name, index) => ({
          name,
          r2: comparisonSource.r2?.[index] ?? 0,
          mae: comparisonSource.mae?.[index] ?? null,
          rmse: comparisonSource.rmse?.[index] ?? null
        }));
    const trainingRuns = Array.isArray(F?.trainingRuns) ? F.trainingRuns : [];
    const outputTypes = Array.isArray(F?.outputTypes) ? F.outputTypes : [];
    const readinessOverall = Number(F?.readiness?.overall ?? 0);
    $("#page-content").innerHTML = header("UI Kit", "The single source of truth for the compact application shell, components, scientific visuals, AI patterns and report identity.", `<a class="btn btn-primary" href="settings.html">Test themes</a>`) + `
      <section class="section"><div class="section-heading"><div><h2>Brand identity</h2><p>The flask, flowing path and process nodes combine laboratory science, experimental continuity and traceable data.</p></div><span class="badge badge-success">Local SVG</span></div><div class="panel"><div class="panel-body"><div class="brand-identity-preview"><div class="brand-lockup-preview"><img src="assets/brand/logo-horizontal.svg" alt="LabFlow — Manage experiments. Accelerate discovery."></div><div class="brand-asset-grid"><div class="card"><img src="assets/brand/logo-mark.svg" alt="LabFlow app mark"><strong>Application mark</strong><small>Sidebar, compact navigation and app surfaces</small></div><div class="card brand-asset-light"><img src="assets/brand/logo-symbol.svg" alt="LabFlow standalone symbol"><strong>Standalone symbol</strong><small>Light surfaces and identity documentation</small></div><div class="card brand-asset-light"><img src="assets/brand/logo-monochrome.svg" alt="LabFlow monochrome wordmark"><strong>Monochrome</strong><small>Print-safe and single-colour use</small></div></div></div></div></div></section>
      <section class="section page-composition-showcase"><div class="section-heading"><div><h2>Page Shell and Composition</h2><p>The checked-in application shell stays stable while every renderer follows one ordered page grammar.</p></div><span class="badge badge-success">Production standard</span></div><div class="panel composition-demo"><div class="panel-body"><nav class="page-context" aria-label="Example breadcrumb"><a href="#">Workspace</a><span>/</span><span>Project</span></nav><div class="composition-header"><div><span class="page-eyebrow">Object type</span><h3>Page title <span class="badge badge-accent">Status</span></h3><p>Description and current context.</p></div><div class="cluster"><button class="btn">Secondary</button><button class="btn btn-primary">Primary action</button></div></div><div class="summary-strip"><div class="summary-item"><small>Summary</small><strong>Essential state</strong></div><div class="summary-item"><small>Progress</small><strong>78%</strong></div><div class="summary-item"><small>Owner</small><strong>Matteo Ginesi</strong></div><div class="summary-item"><small>Evidence</small><strong>Reviewed</strong></div></div><div class="tabs"><button class="tab active">Overview</button><button class="tab">Evidence</button><button class="tab">History</button></div><div class="toolbar"><div class="search"><span>${icon("search")}</span><input class="input" aria-label="Example search" placeholder="Search this view…"></div><button class="btn">Filter</button><span class="toolbar-spacer"></span><span class="badge">12 items</span></div><div class="composition-content"><div class="panel"><div class="panel-body">Primary content</div></div><aside class="panel"><div class="panel-body">Secondary rail</div></aside></div></div></div><div class="grid grid-5 mt-2">${[["Index page","Header · summary · toolbar · collection"],["Detail page","Entity header · status · summary · sections"],["Workflow page","Project header · stepper · current step · controls"],["Analysis / Workbench","Header · scope · work area · evidence rail"],["Reference page","Header · navigation · reading or configuration surface"]].map(([name,flow]) => `<article class="card archetype-card"><span class="badge">Archetype</span><h3>${name}</h3><p>${flow}</p></article>`).join("")}</div><div class="grid grid-3 mt-2"><div class="card width-sample width-standard"><strong>Standard · 1320 px</strong><small>Settings and compact configuration surfaces</small></div><div class="card width-sample width-wide"><strong>Wide · 1600 px</strong><small>Workspace, Project, Lab Cabinet, AI & Models, Robotics, Tools, Documentation and UI Kit</small></div><div class="card width-sample width-reading"><strong>Reading measure · 72 ch</strong><small>Documentation prose stays readable inside the wide page shell</small></div></div><div class="grid grid-4 mt-2"><article class="card"><strong>Standard card</strong><p>Neutral border; ordinary content.</p></article><article class="card kpi"><span class="kpi-label">Metric card</span><strong class="kpi-value">21.28%</strong><span class="kpi-detail">Top accent only</span></article><article class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Status card</strong><p>Left accent communicates severity.</p></div></article><article class="card selected-card"><strong>Selected card</strong><p>Selection uses outline and surface, not severity color.</p></article></div></section>
      <section class="section"><div class="section-heading"><div><h2>Foundations</h2><p>Theme, palette, local-first Noto Sans typography, spacing and semantic status tokens.</p></div></div><div class="grid grid-4">${colors.map((token) => `<div class="card"><div class="color-swatch token-swatch mb-1" style="background:var(${token})"></div><code>${token}</code></div>`).join("")}</div><div class="panel mt-2"><div class="panel-body grid grid-3"><div><h1>Page title</h1><p>34px maximum, restrained hierarchy.</p></div><div><h2>Section title</h2><p>Compact grouping for technical content.</p></div><div><h3>Panel title</h3><p>Dense information without oversized cards.</p></div></div></div></section>
      <section class="section"><div class="section-heading"><div><h2>Shared Block Registry</h2><p>Only blocks used by the current product belong here; extend these before creating page-specific variants.</p></div></div><div class="panel"><div class="table-wrap"><table class="table-dense"><thead><tr><th>Block</th><th>Allowed Variants</th><th>Current Product Use</th></tr></thead><tbody><tr><td><code>page-header</code></td><td>Title, supporting copy, contextual actions</td><td>Every main workspace</td></tr><tr><td><code>panel / card</code></td><td>Default, KPI, AI context, interactive link</td><td>Workspace, project steps, Cabinet, Knowledge, Tools</td></tr><tr><td><code>toolbar</code></td><td>Search, filters, view controls, count</td><td>Workspace portfolio and Lab Cabinet</td></tr><tr><td><code>notice</code></td><td>Information, success, warning, error</td><td>Import, validation, assistant and export</td></tr><tr><td><code>project-pipeline-nav</code></td><td>Available, active, completed</td><td>Project pipeline and Workspace focus</td></tr><tr><td><code>cabinet-browser</code></td><td>Family filters, resource cards and sticky inspector</td><td>Lab Cabinet and reusable-object previews</td></tr><tr><td><code>scientific-builder-layout</code></td><td>Definition builder paired with technical review</td><td>CHOSE Process chemistry and stack review</td></tr><tr><td><code>validation-issue</code></td><td>Error, warning, information, suggestion</td><td>Experiment Inspector and Ask LabFlow</td></tr><tr><td><code>report-preview</code></td><td>Active palette and approved content</td><td>Review & Export and UI Kit</td></tr></tbody></table></div></div></section>
      <section class="section"><div class="section-heading"><div><h2>Lab Cabinet resource browser</h2><p>Reusable scientific objects use one visual card language, compact family navigation and a detail inspector with explicit snapshot behaviour.</p></div><a class="btn" href="cabinet.html">${icon("cabinet")} Open Lab Cabinet</a></div><div class="cabinet-ui-kit-demo"><div><div class="cabinet-family-bar cabinet-family-bar-demo"><button class="cabinet-family-card active" type="button"><span>${icon("grid")}</span><strong>All resources</strong><small>${D.cabinet.length} items</small></button>${["material","solution","stack","mapping","analysis"].map((type) => { const info=cabinetTypeInfo(type); const count=D.cabinet.filter((item)=>item.type===type).length; return `<button class="cabinet-family-card" type="button"><span>${icon(info.icon)}</span><strong>${esc(info.label)}</strong><small>${count} items</small></button>`; }).join("")}</div><div class="cabinet-demo-cards">${[D.cabinet.find((item)=>item.type==="solution"),D.cabinet.find((item)=>item.type==="stack"),D.cabinet.find((item)=>item.type==="analysis")].filter(Boolean).map((item)=>cabinetCardMarkup(item,{demo:true})).join("")}</div></div><aside class="panel cabinet-inspector cabinet-inspector-demo" data-cabinet-type="solution">${cabinetInspectorMarkup(D.cabinet.find((item)=>item.type==="solution") || D.cabinet[0],{compact:true})}</aside></div></section>
      <section class="section"><div class="section-heading"><div><h2>Actions and navigation</h2><p>Buttons, statuses, tabs, segmented controls, breadcrumbs and commands.</p></div></div><div class="grid grid-2"><div class="panel"><div class="panel-header"><h3 class="mb-0">Buttons and badges</h3></div><div class="panel-body cluster"><button class="btn btn-primary">Primary</button><button class="btn btn-secondary">AI / contextual</button><button class="btn">Secondary</button><button class="btn btn-ghost">Ghost</button><button class="btn btn-danger">Danger</button><button class="btn btn-sm">Small</button><span class="badge badge-accent">Active</span><span class="badge badge-success">Reviewed</span><span class="badge badge-warning">Review</span><span class="badge badge-danger">Issue</span></div></div><div class="panel"><div class="panel-header"><h3 class="mb-0">Tabs and commands</h3></div><div class="panel-body stack"><div class="tabs"><button class="tab active">Overview</button><button class="tab">Tools</button><button class="tab">Findings</button><button class="tab">Report</button></div><div class="command-bar">${icon("search")} Search or run a command </div><div class="segmented"><button class="active">Compact</button><button>Comfortable</button></div></div></div></div></section>
      <section class="section"><div class="section-heading"><div><h2>Forms and input</h2><p>Compact controls for structured scientific data.</p></div></div><div class="grid grid-2"><div class="panel"><div class="panel-header"><h3 class="mb-0">Form fields</h3></div><div class="panel-body form-grid"><div class="field"><label>Text field</label><input class="input" value="FA0.90MA0.10"></div><div class="field"><label>Select field</label><select class="select"><option>Reviewed recipe</option></select></div><div class="field"><label>Numeric + unit</label><div class="input-group"><input class="input" value="1.25"><span class="btn">mol/L</span></div></div><div class="field"><label>State</label><label class="toggle"><input type="checkbox" checked><span class="toggle-track"></span><span>Enabled</span></label></div><div class="field wide"><label>Researcher notes</label><textarea class="textarea">Evidence-linked interpretation remains editable.</textarea></div></div></div><div class="panel"><div class="panel-header"><h3 class="mb-0">Upload and search</h3></div><div class="panel-body stack"><div class="search"><span>${icon("search")}</span><input class="input" placeholder="Search project evidence"></div><div class="dropzone">${icon("upload")}<h3 class="mt-1">Drop local scientific files</h3><p>Source provenance is retained.</p><button class="btn btn-primary">Choose files</button></div></div></div></div></section>
      <section class="section"><div class="section-heading"><div><h2>Data display</h2><p>Panels, KPI cards, tables, timelines, progress and notices.</p></div></div><div class="grid grid-5">${[["Best PCE", "21.28%", "S08"], ["Samples", "12", "6 stacks"], ["Quality", "94%", "2 warnings"], ["Findings", "5", "2 in review"], ["Knowledge", "6", "linked records"]].map(([a,b,c]) => `<div class="card kpi"><div class="kpi-label">${a}</div><div class="kpi-value">${b}</div><div class="kpi-detail">${c}</div></div>`).join("")}</div><div class="grid grid-2 mt-2"><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Scientific table</h3><small>Dense, scrollable and unit-aware</small></div><button class="btn btn-sm">Export</button></div><div class="panel-body"><div class="table-wrap">${datasetTable(D.demoDataset.slice(0, 4))}</div></div></div><div class="panel"><div class="panel-header"><h3 class="mb-0">Feedback patterns</h3></div><div class="panel-body stack"><div class="notice"><div>${icon("info")}</div><div><strong>Information</strong><p>Explain system behaviour and provenance.</p></div></div><div class="notice notice-success"><div>${icon("check")}</div><div><strong>Validated</strong><p>Data mapping and units are complete.</p></div></div><div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Review required</strong><p>Make gaps visible without hiding useful work.</p></div></div></div></div></div></section>
      <section class="section"><div class="section-heading"><div><h2>Scientific components</h2><p>Shared, compact representations used by pipeline builders and reviews.</p></div></div><div class="grid grid-2"><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Stack schematic</h3><small>Layer order, role, thickness and selectable detail</small></div></div><div class="panel-body">${stackReview(stackLayers)}</div></div><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Solution composition</h3><small>Solvent, solutes, quantities and validation</small></div></div><div class="panel-body">${solutionReview()}</div></div></div><div class="grid grid-3 mt-2"><div class="panel"><div class="panel-header"><h3 class="mb-0">Project pipeline navigator</h3></div><div class="panel-body"><div class="project-pipeline-nav"><div class="step-link done"><span class="step-index">${icon("check")}</span><span class="step-copy"><strong>Process</strong><span>Versioned definition</span></span></div><div class="step-link active"><span class="step-index">2</span><span class="step-copy"><strong>Experiment</strong><span>Actual execution</span></span></div><div class="step-link"><span class="step-index">3</span><span class="step-copy"><strong>Results</strong><span>Files and mapping</span></span></div><div class="step-link"><span class="step-index">4</span><span class="step-copy"><strong>Review</strong><span>Report and export</span></span></div></div></div></div><div class="stack">${D.tools.slice(0, 2).map(toolCard).join("")}</div><article class="card object-card"><span class="object-icon">${icon("flask")}</span><div><span class="badge">solution</span><h3 class="mt-1">FA/MA reference</h3><p>Reusable Cabinet object with versioned metadata.</p></div></article></div></section>
      <section class="section"><div class="section-heading"><div><h2>Lab Assistant and Knowledge</h2><p>Production-used Ask, Inspect and Prepare patterns keep evidence, confidence and human control visible.</p></div></div><div class="grid grid-2"><div class="panel ai-panel"><div class="panel-header"><div><h3 class="mb-0">Contextual assistant panel</h3><small>Compact support inside a workflow</small></div>${icon("spark")}</div><div class="panel-body stack"><button class="btn btn-secondary">${icon("spark")} AI action button</button>${D.aiFindings.slice(0, 2).map(aiFinding).join("")}<div class="proposed-action-preview"><div><span class="badge badge-accent">Proposed action</span><h3>Create comparison</h3><p>3 experiments · PCE, Voc, Jsc and FF</p></div><div class="cluster"><button class="btn">Cancel</button><button class="btn btn-primary">Review</button></div></div></div></div><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Knowledge response and evidence</h3><small>Source card · confidence · limitation</small></div></div><div class="panel-body stack"><div class="ai-message"><strong>Lab Assistant response</strong><p>S08 has the highest measured PCE in the current cohort.</p><small>Structured query + deterministic aggregation</small></div><button class="evidence-item"><span class="evidence-type">Results</span><span><strong>batch_B03_forward.csv</strong><small>S08 · PCE · 21.28%</small></span><span class="confidence-badge confidence-high">High</span></button><div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Limitation</strong><p>The result does not establish causality.</p></div></div></div></div></div><div class="grid grid-2 mt-2"><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Validation and mapping patterns</h3><small>Error · warning · suggestion · confidence</small></div></div><div class="panel-body stack">${D.validationIssues.slice(0,3).map((item) => `<article class="validation-issue issue-${item.severity}"><div>${icon(item.severity === "suggestion" ? "spark" : "warning")}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div></article>`).join("")}<div class="table-wrap"><table class="table-dense"><thead><tr><th>Column</th><th>Destination</th><th>Confidence</th><th>Preview</th></tr></thead><tbody><tr><td>PCE</td><td>measurements.jv.efficiency</td><td><span class="confidence-badge confidence-high">99%</span></td><td>21.28%</td></tr></tbody></table></div></div></div><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Saved view and comparison summary</h3><small>Reusable, session-only patterns</small></div></div><div class="panel-body stack"><div class="saved-view-item"><button><strong>High-performing devices</strong><small>PCE &gt; 20%</small></button><span class="badge">4</span><button class="btn btn-ghost icon-btn" aria-label="Rename saved view">${icon("edit")}</button><button class="btn btn-ghost icon-btn" aria-label="Delete saved view">${icon("x")}</button></div><div class="comparison-summary"><div><span>Included</span><strong>3 experiments</strong></div><div><span>Metrics</span><strong>4</strong></div><div><span>Missing</span><strong>2 links</strong></div><div><span>Status</span><strong>Review</strong></div></div></div></div></div><div class="grid grid-3 mt-2"><div class="empty"><strong>Ask LabFlow</strong><p>Choose a scope or start with a suggested question.</p></div><div class="panel"><div class="panel-body"><div class="skeleton" aria-label="Assistant response loading"></div><small>AI loading state</small></div></div><div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Assistant unavailable</strong><p>Deterministic tools remain available; no data is lost.</p></div></div></div></section>
      <section class="section"><div class="section-heading"><div><h2>Local icon system</h2><p>A single checked-in stroke set is used for product controls; branding remains separate.</p></div><span class="badge badge-accent">Local · no CDN</span></div><div class="icon-library-grid">${["home","cabinet","book","brain","database","activity","chart","file","download","code","layers","flask","grip","chevron-up","chevron-down","settings"].map((name) => `<article><span>${icon(name, "icon icon-lg")}</span><code>${name}</code></article>`).join("")}</div></section>
      <section class="section"><div class="section-heading"><div><h2>AI & Models foundation</h2><p>One workspace presents Knowledge, Datasets, Models and Predictions while preserving distinct scientific record types.</p></div><a class="btn btn-primary" href="knowledge.html?view=datasets">Open AI & Models</a></div><div class="grid grid-4"><article class="card"><span class="knowledge-kind">Knowledge</span><h3>Evidence-led answers</h3><p>Scope, sources, relationships, tools and limitations stay visible.</p></article><article class="card"><span class="knowledge-kind">Datasets</span><h3>Immutable snapshots</h3><p>Features, targets, units, selection, exclusions and split policy.</p></article><article class="card"><span class="knowledge-kind">Models</span><h3>Training and evaluation</h3><p>Learning curves, residuals, confusion matrix, model cards, baselines and versioned runs.</p></article><article class="card"><span class="knowledge-kind">Predictions</span><h3>Reviewed outputs</h3><p>Prediction, uncertainty, applicability, observed value and review state.</p></article></div><div class="model-dashboard mt-2"><section class="panel model-dashboard-main"><div class="panel-header"><div><h3 class="mb-0">Model comparison pattern</h3><small>Comparable evaluation metrics and explicit baseline</small></div><span class="badge">Demonstration data</span></div><div class="panel-body model-bars">${modelComparisonItems.map((item) => `<div><span>${esc(item.name)}</span><div><i style="width:${Math.max(8, Number(item.r2 || 0) * 100)}%"></i></div><strong>R² ${Number(item.r2 || 0).toFixed(2)}</strong></div>`).join("")}</div></section><section class="panel"><div class="panel-header"><div><h3 class="mb-0">Training-run pattern</h3><small>Status, artifact and best metric</small></div>${icon("activity")}</div><div class="training-status-list">${trainingRuns.slice(0,4).map((run) => `<article><span class="run-status ${run.status === "completed" ? "is-complete" : "is-review"}">${icon(run.status === "completed" ? "check" : "warning")}</span><div><strong>${esc(run.id)}</strong><small>${esc(run.model)} · ${esc(run.dataset)}</small></div><span><b>${esc(run.bestMetric || "Review")}</b><small>${esc(run.artifact || run.status)}</small></span></article>`).join("")}</div></section></div><div class="ai-readiness-hero mt-2"><div><span class="page-eyebrow">AI readiness pattern</span><h2>${readinessOverall}% ready</h2><p>The score is always accompanied by its component checks and blocking issues.</p></div><div class="readiness-ring readiness-ring-small" style="--readiness:${F.readiness.overall}"><strong>${F.readiness.overall}</strong><span>%</span></div></div><div class="output-class-list mt-2">${outputTypes.map((item) => `<article><span class="output-type output-${esc(item.type)}">${esc(item.label)}</span><span><small>Initial state</small><strong>${esc(item.review)}</strong></span><span><small>Required evidence</small><strong>${esc(item.evidence)}</strong></span></article>`).join("")}</div></section>
      <section class="section"><div class="section-heading"><div><h2>Report system</h2><p>The canonical Report Composer drives native PDF, editable DOCX, analysis workbook and a compile-ready LaTeX package.</p></div><a class="btn btn-primary" href="project.html?project=${encodeURIComponent(D.projects[0].id)}&step=review&view=report">Open Report Composer</a></div><div class="report-preview">${reportPreview(D.projects[0])}</div></section>
      <section class="section"><div class="panel"><div class="panel-header"><div><h3 class="mb-0">Composition rule</h3><small>Pipeline pages combine approved components; local CSS is avoided</small></div></div><div class="panel-body"><pre>${esc(`Step page = project pipeline navigator
          + current-step heading
          + shared cards / panels / forms / tables
          + optional scientific visual
          + optional AI / knowledge pattern
          + no step-specific visual language`)}</pre></div></div></section>`;
    $("#page-content").insertAdjacentHTML("beforeend", `<section class="section"><div class="section-heading"><div><h2>Overlay, Feedback & Responsive States</h2><p>Production-used modal, drawer, toast, loading, empty and error patterns.</p></div></div><div class="grid grid-3"><div class="panel"><div class="panel-header"><h3 class="mb-0">Overlay Actions</h3></div><div class="panel-body stack"><button class="btn" id="ui-modal-demo">Open Accessible Modal</button><button class="btn" data-action="assistant">Open AI Drawer</button><button class="btn" id="ui-toast-demo">Show Status Toast</button><small>Modal traps focus, returns focus and closes with Escape. Drawer becomes full-width-safe on phones.</small></div></div><div class="panel"><div class="panel-header"><h3 class="mb-0">System States</h3></div><div class="panel-body stack"><div class="skeleton" aria-label="Loading content"></div><div class="empty"><strong>No Results</strong><p>Adjust filters or add a laboratory resource.</p></div><div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Retry Required</strong><p>Review the local file and try the import again.</p></div></div></div></div><div class="panel"><div class="panel-header"><h3 class="mb-0">Usage Contract</h3></div><div class="panel-body"><div class="metadata-list"><div><span>Desktop</span><strong>Dense multi-column composition</strong></div><div><span>Tablet</span><strong>Stack panels; drawer navigation</strong></div><div><span>Mobile</span><strong>Single column; scoped table/step scroll</strong></div><div><span>Keyboard</span><strong>Visible focus; semantic controls</strong></div><div><span>Motion</span><strong>Reduced-motion compliant</strong></div></div></div></div></div></section>`);
    $$('[data-export]').forEach((button) => button.addEventListener("click", () => runExport(button.dataset.export, D.projects[0], P.chose, button)));
    bindStackReview(stackLayers, $("#page-content"));
    $$(".tabs .tab", $("#page-content")).forEach((tab) => tab.addEventListener("click", () => {
      $$(".tab", tab.closest(".tabs")).forEach((item) => item.classList.toggle("active", item === tab));
    }));
    $$(".segmented button", $("#page-content")).forEach((button) => button.addEventListener("click", () => {
      $$("button", button.closest(".segmented")).forEach((item) => item.classList.toggle("active", item === button));
    }));
    $$("button", $("#page-content")).filter((button) => !button.id && !button.dataset.action && !button.dataset.export && !button.dataset.stackReviewLayer && !button.closest(".tabs, .segmented")).forEach((button) => button.addEventListener("click", () => toast("UI Kit example control activated.")));
    $("#ui-toast-demo").onclick = () => toast("UI Kit status message announced politely.");
    $("#ui-modal-demo").onclick = () => modal(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ui-modal-title"><div class="modal-header"><h2 id="ui-modal-title" class="mb-0">Confirmation Modal</h2><button class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">${icon("x")}</button></div><div class="modal-body"><p>Use for consequential actions. On mobile the dialog stays inside the viewport and contains overscroll.</p></div><div class="modal-footer"><button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="close-modal">Confirm Example</button></div></div>`);
  }

  function enhanceAccessibility() {
    $$(".toolbar, .segmented").forEach((group) => { if (group.hasAttribute("aria-label") && !group.hasAttribute("role")) group.setAttribute("role", "group"); });
    $$(".progress[aria-label]").forEach((progress) => {
      progress.setAttribute("role", "progressbar");
      const value = progress.getAttribute("aria-label").match(/(\d+)%/)?.[1];
      if (value) { progress.setAttribute("aria-valuemin", "0"); progress.setAttribute("aria-valuemax", "100"); progress.setAttribute("aria-valuenow", value); }
    });
    $$(".skeleton[aria-label]").forEach((item) => item.setAttribute("role", "status"));
    $$(".table-wrap, pre").forEach((region) => region.setAttribute("tabindex", "0"));
    $$("input, select, textarea").forEach((control, index) => {
      if (!control.name) control.name = control.id || `control-${index + 1}`;
      if (!control.hasAttribute("aria-label") && !control.labels?.length) {
        const label = control.closest(".field")?.querySelector("label")?.textContent.trim() || control.placeholder?.replace(/…$/, "") || control.id?.replace(/-/g, " ");
        if (label) control.setAttribute("aria-label", label);
      }
      if (!control.hasAttribute("autocomplete") && !["checkbox", "radio", "file"].includes(control.type)) control.setAttribute("autocomplete", "off");
    });
    $$(".icon-btn").forEach((button) => { if (!button.hasAttribute("aria-label")) button.setAttribute("aria-label", button.textContent.trim() || "Action"); });
    $$(".tabs").forEach((tabs) => { if (!tabs.hasAttribute("role")) tabs.setAttribute("role", "tablist"); });
    $$(".tab").forEach((tab) => { if (!tab.hasAttribute("role")) tab.setAttribute("role", "tab"); });
    $$("canvas").forEach((canvas) => { canvas.setAttribute("role", "img"); if (!canvas.hasAttribute("aria-label")) canvas.setAttribute("aria-label", "Scientific data chart"); });
  }

  function assertPageDependencies(page) {
    const requirements = {
      knowledge: [[window.LabFlowKnowledgePages, "renderBase", "assets/js/knowledge-pages.js"]],
      robotics: [[window.LabFlowRobotics, "renderBase", "assets/js/robotics.js"]],
      tools: [[window.LabFlowToolsPage, "render", "assets/js/tools-page.js"]],
      project: [[E, "buildReportDocument", "assets/js/workbook.js"]],
      "ui-kit": [[E, "buildReportDocument", "assets/js/workbook.js"]],
      documentation: [[window.LabFlowDiagrams, "render", "assets/js/diagrams.js"]]
    };
    (requirements[page] || []).forEach(([module, method, source]) => {
      if (!module || typeof module[method] !== "function") throw new TypeError(`${source} did not expose ${method}(). Check the page script order.`);
    });
  }

  function init() {
    const page = document.body.dataset.page;
    const finish = Log.time("page.init", { page });
    Log.info("page.init-start", { page, protocol: location.protocol });
    try {
      restoreCarriedSettings();
      applySettings();
      assertPageDependencies(page);
      hydrateShell(page);
      const renderers = {workspace: renderWorkspace, project: renderProject, cabinet: renderCabinet, knowledge: () => window.LabFlowKnowledgePages.renderBase({root: $("#page-content"), header, icon, esc, badgeStatus}), robotics: () => window.LabFlowRobotics.renderBase({root: $("#page-content"), header, icon, esc, toast}), tools: () => window.LabFlowToolsPage.render({root: $("#page-content"), header, icon, esc, toast, getSettings}), settings: renderSettings, documentation: renderDocumentation, "ui-kit": renderUiKit};
      const renderer = renderers[page] || renderWorkspace;
      renderer();
      bindShell();
      enhanceAccessibility();
      finish({ status: "ready" });
    } catch (error) {
      Log.error("page.init-failed", { page, error });
      const root = $("#page-content");
      if (root) root.innerHTML = `<div class="notice notice-error"><div>${icon("warning")}</div><div><strong>LabFlow could not render this page</strong><p>${esc(error?.message || "Check the JavaScript console for the structured LabFlow error entry.")}</p><small>Page: ${esc(page)} · the application shell remains available.</small></div></div>`;
      finish({ status: "failed" });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
