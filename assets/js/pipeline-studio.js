(function () {
  "use strict";

  const Log = window.LabFlowLogger?.child("pipeline-studio") || {debug(){},info(){},warn(){},error(){},time(){return () => {};}};
  const asArray = (value) => Array.isArray(value) ? value : [];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    })[char]);
  }

  function stripQuotes(value) {
    const text = String(value || "").trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1);
    return text;
  }

  function splitYamlComment(line) {
    let single = false;
    let double = false;
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === "\\" && double && !escaped) { escaped = true; continue; }
      if (char === "'" && !double && !escaped) single = !single;
      if (char === '"' && !single && !escaped) double = !double;
      if (char === "#" && !single && !double) return [line.slice(0, index), line.slice(index)];
      escaped = false;
    }
    return [line, ""];
  }

  function highlightScalar(value) {
    const text = String(value || "");
    const trimmed = text.trim();
    const leading = text.slice(0, text.length - text.trimStart().length);
    const trailing = text.slice(text.trimEnd().length);
    if (!trimmed) return escapeHtml(text);
    let body = escapeHtml(trimmed);
    if (/^(?:true|false|null|yes|no)$/i.test(trimmed)) body = `<span class="syntax-literal">${body}</span>`;
    else if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(trimmed)) body = `<span class="syntax-number">${body}</span>`;
    else if (/^(?:".*"|'.*')$/.test(trimmed)) body = `<span class="syntax-string">${body}</span>`;
    else if (/^\[.*\]$|^\{.*\}$/.test(trimmed)) body = `<span class="syntax-string">${body}</span>`;
    return `${escapeHtml(leading)}${body}${escapeHtml(trailing)}`;
  }

  function highlightYamlLine(line) {
    const [source, comment] = splitYamlComment(line);
    const match = source.match(/^(\s*(?:-\s+)?)([A-Za-z0-9_.-]+)(\s*:\s*)(.*)$/);
    let html;
    if (match) {
      html = `${escapeHtml(match[1])}<span class="syntax-key">${escapeHtml(match[2])}</span><span class="syntax-punctuation">${escapeHtml(match[3])}</span>${highlightScalar(match[4])}`;
    } else if (/^\s*-\s+/.test(source)) {
      const listMatch = source.match(/^(\s*-\s+)(.*)$/);
      html = `<span class="syntax-punctuation">${escapeHtml(listMatch[1])}</span>${highlightScalar(listMatch[2])}`;
    } else html = highlightScalar(source);
    if (comment) html += `<span class="syntax-comment">${escapeHtml(comment)}</span>`;
    return html || " ";
  }

  function highlightJson(text) {
    const source = escapeHtml(text);
    return source.replace(/(&quot;(?:\\.|[^&])*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi, (match, string, colon, literal, number) => {
      if (string) return colon ? `<span class="syntax-key">${string}</span><span class="syntax-punctuation">${colon}</span>` : `<span class="syntax-string">${string}</span>`;
      if (literal) return `<span class="syntax-literal">${literal}</span>`;
      if (number) return `<span class="syntax-number">${number}</span>`;
      return match;
    });
  }

  function highlightSource(text, format) {
    if (format === "json") return highlightJson(text);
    return String(text || "").split("\n").map(highlightYamlLine).join("\n");
  }

  function yamlTopLevelValue(text, key) {
    const match = String(text || "").match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"));
    return match ? stripQuotes(match[1]) : "";
  }

  function yamlTopLevelKeys(text) {
    return [...String(text || "").matchAll(/^([A-Za-z_][A-Za-z0-9_-]*):(?:\s|$)/gm)].map((match) => match[1]);
  }

  function yamlStepDrafts(text) {
    const lines = String(text || "").split("\n");
    const steps = [];
    let inSteps = false;
    let current = null;
    for (const line of lines) {
      if (/^steps:\s*$/.test(line)) { inSteps = true; continue; }
      if (inSteps && /^[A-Za-z_][A-Za-z0-9_-]*:\s*/.test(line)) break;
      if (!inSteps) continue;
      const id = line.match(/^-\s+id:\s*(.+?)\s*$/);
      if (id) {
        current = {id: stripQuotes(id[1]), title:"", output:""};
        steps.push(current);
        continue;
      }
      if (!current) continue;
      const title = line.match(/^\s{2}title:\s*(.+?)\s*$/);
      const output = line.match(/^\s{2}output:\s*(.+?)\s*$/);
      if (title) current.title = stripQuotes(title[1]);
      if (output) current.output = stripQuotes(output[1]);
    }
    return steps;
  }

  function analyseDraft(text, document, pipeline) {
    const issues = [];
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const add = (severity, title, detail, line = null) => issues.push({severity, title, detail, line});
    lines.forEach((line, index) => {
      if (line.includes("\t")) add("error", "Tab indentation", "YAML drafts must use spaces rather than tab characters.", index + 1);
      const indent = line.match(/^ */)?.[0].length || 0;
      if (line.trim() && indent % 2) add("warning", "Uneven indentation", "Use the documented two-space indentation scale.", index + 1);
    });

    let metadata = {id:pipeline?.id || "—", name:pipeline?.name || "Untitled pipeline", version:pipeline?.version || "—", schema:pipeline?.schema_version || "Navigation manifest"};
    let steps = asArray(pipeline?.steps).map((item) => ({id:item.id, title:item.title, output:item.output}));
    let topKeys = [];

    if (document?.format === "json") {
      try {
        const parsed = JSON.parse(text);
        topKeys = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed) : [];
      } catch (error) {
        add("error", "Invalid JSON", error.message || "The draft is not valid JSON.");
      }
    } else {
      topKeys = yamlTopLevelKeys(text);
      if (document?.path === "pipeline.yaml") {
        metadata = {
          id: yamlTopLevelValue(text, "id"),
          name: yamlTopLevelValue(text, "name"),
          version: yamlTopLevelValue(text, "version"),
          schema: yamlTopLevelValue(text, "schema_version") || "Navigation manifest"
        };
        ["id", "name", "version", "description", "project_type", "steps"].forEach((key) => {
          if (!topKeys.includes(key)) add("error", `Missing ${key}`, `The pipeline entry contract requires a top-level “${key}” key.`);
        });
        steps = yamlStepDrafts(text);
        if (!steps.length) add("error", "No steps detected", "Define at least one ordered step under the top-level steps list.");
        const ids = steps.map((step) => step.id).filter(Boolean);
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        [...new Set(duplicates)].forEach((id) => add("error", "Duplicate step identifier", `The step id “${id}” occurs more than once.`));
        if (pipeline?.contract?.strict && !topKeys.includes("resource_refs")) add("warning", "No resource references", "A strict pipeline normally declares schemas, defaults, mappings and demonstration resources.");
      } else if (!topKeys.length && text.trim()) add("warning", "No top-level mapping keys", "This resource may be a list-only document; review its expected schema before replacing the source.");
    }

    if (!text.trim()) add("error", "Empty draft", "The selected source document cannot be empty.");
    const errors = issues.filter((item) => item.severity === "error").length;
    const warnings = issues.filter((item) => item.severity === "warning").length;
    return {
      issues,
      errors,
      warnings,
      status: errors ? "invalid" : warnings ? "warning" : "valid",
      metadata,
      steps,
      topKeys,
      lines: lines.length,
      characters: text.length
    };
  }

  function statusBadge(analysis) {
    if (analysis.status === "invalid") return `<span class="badge badge-danger">${analysis.errors} error${analysis.errors === 1 ? "" : "s"}</span>`;
    if (analysis.status === "warning") return `<span class="badge badge-warning">${analysis.warnings} warning${analysis.warnings === 1 ? "" : "s"}</span>`;
    return '<span class="badge badge-success">Draft valid</span>';
  }

  function previewMarkup({analysis, document, pipeline, icon, esc}) {
    const issueMarkup = analysis.issues.length ? analysis.issues.slice(0, 8).map((item) => `<article class="validation-issue issue-${item.severity}"><div class="issue-icon">${icon(item.severity === "error" ? "warning" : "info")}</div><div><div class="cluster"><strong>${esc(item.title)}</strong><span class="badge ${item.severity === "error" ? "badge-danger" : "badge-warning"}">${esc(item.severity)}</span></div><p>${esc(item.detail)}</p>${item.line ? `<small>Line ${item.line}</small>` : ""}</div></article>`).join("") : `<div class="notice notice-success"><div>${icon("check")}</div><div><strong>No local draft issues detected</strong><p>This lightweight browser validation does not replace the repository build and schema validation.</p></div></div>`;
    const stepTable = document.path === "pipeline.yaml" ? `<div class="table-wrap"><table class="table-dense"><thead><tr><th>Step</th><th>Expected output</th></tr></thead><tbody>${analysis.steps.map((step) => `<tr><td><strong>${esc(step.title || step.id || "Untitled step")}</strong><small class="block"><code>${esc(step.id || "missing-id")}</code></small></td><td>${esc(step.output || "Not declared")}</td></tr>`).join("") || '<tr><td colspan="2">No step preview available.</td></tr>'}</tbody></table></div>` : "";
    return `<div class="stack pipeline-studio-preview-content">
      <div class="entity-heading"><div class="cluster"><span class="badge badge-accent">${esc(pipeline.id)}</span>${statusBadge(analysis)}</div><strong class="entity-title">${esc(document.path === "pipeline.yaml" ? (analysis.metadata.name || "Untitled pipeline") : document.label)}</strong><p class="entity-description">${esc(document.path === "pipeline.yaml" ? (pipeline.description || "Pipeline contract draft") : `${document.group} resource · ${document.path}`)}</p></div>
      <div class="metadata-list"><div><span>Document</span><strong>${esc(document.path)}</strong></div><div><span>Format</span><strong>${esc(document.format.toUpperCase())}</strong></div><div><span>Lines</span><strong>${analysis.lines}</strong></div><div><span>Characters</span><strong>${analysis.characters}</strong></div>${document.path === "pipeline.yaml" ? `<div><span>Pipeline ID</span><strong>${esc(analysis.metadata.id || "Missing")}</strong></div><div><span>Version</span><strong>${esc(analysis.metadata.version || "Missing")}</strong></div><div><span>Schema</span><strong>${esc(analysis.metadata.schema || "Missing")}</strong></div><div><span>Steps</span><strong>${analysis.steps.length}</strong></div>` : `<div><span>Top-level keys</span><strong>${analysis.topKeys.length || "List resource"}</strong></div>`}</div>
      ${stepTable}
      <div class="validation-list">${issueMarkup}</div>
      <div class="notice"><div>${icon("lock")}</div><div><strong>Preview-only editor</strong><p>Edits remain in JavaScript memory. Download the draft and review it outside the POC before replacing repository files.</p></div></div>
    </div>`;
  }

  function render(options) {
    const {root, header, icon, esc = escapeHtml, toast, pipelines = {}, sources = {}, runtime, download} = options;
    if (!root) throw new TypeError("Pipeline Studio requires a root element.");
    const registry = Object.values(pipelines).filter((item) => item?.id && asArray(item.steps).length);
    if (!registry.length) {
      root.innerHTML = header("Pipeline Studio", "No local pipeline registry is available.") + '<div class="empty"><strong>No pipelines found</strong><p>Rebuild the checked-in pipeline bundle and reload this page.</p></div>';
      return;
    }

    const query = new URLSearchParams(location.search);
    let pipelineId = pipelines[query.get("pipeline")] ? query.get("pipeline") : registry[0].id;
    const draftStore = new Map();
    let documentPath = "";

    function studioRecord() {
      const record = sources[pipelineId];
      return record && asArray(record.documents).length ? record : {entry:"pipeline.yaml", editable:false, persistence:"unavailable", documents:[]};
    }

    function sourceDocument(path = documentPath) {
      const studio = studioRecord();
      return studio.documents.find((item) => item.path === path) || studio.documents[0] || null;
    }

    function draftKey(path) { return `${pipelineId}:${path}`; }
    function sourceText(document) {
      const key = draftKey(document.path);
      if (!draftStore.has(key)) draftStore.set(key, document.content || "");
      return draftStore.get(key);
    }
    function sourceOriginal(document) { return document.content || ""; }
    function isDirty(document) { return sourceText(document) !== sourceOriginal(document); }

    function groupedDocumentOptions(studio) {
      const groups = [...new Set(studio.documents.map((item) => item.group))];
      return groups.map((group) => `<optgroup label="${esc(group)}">${studio.documents.filter((item) => item.group === group).map((item) => `<option value="${esc(item.path)}" ${item.path === documentPath ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</optgroup>`).join("");
    }

    function outlineMarkup(studio) {
      const groups = [...new Set(studio.documents.map((item) => item.group))];
      return groups.map((group) => `<section class="pipeline-source-group"><h3>${esc(group)}</h3>${studio.documents.filter((item) => item.group === group).map((item) => `<button class="pipeline-source-item ${item.path === documentPath ? "active" : ""}" type="button" data-studio-document="${esc(item.path)}"><span>${icon(item.format === "json" ? "braces" : "code")}</span><span><strong>${esc(item.label)}</strong><small>${esc(item.path)}</small></span>${isDirty(item) ? '<i aria-label="Unsaved draft"></i>' : ""}</button>`).join("")}</section>`).join("");
    }

    function renderShell() {
      const pipeline = pipelines[pipelineId];
      const studio = studioRecord();
      if (!documentPath || !studio.documents.some((item) => item.path === documentPath)) documentPath = studio.entry || studio.documents[0]?.path || "";
      const document = sourceDocument();
      if (!document) {
        root.innerHTML = header("Pipeline Studio", "The selected pipeline does not expose a local editable source snapshot.", `<a class="btn" href="settings.html?tab=pipelines">${icon("arrow")} Back to Pipelines</a>`) + '<div class="empty"><strong>Source snapshot unavailable</strong><p>Rebuild the pipeline bundle to include Pipeline Studio documents.</p></div>';
        return;
      }
      const text = sourceText(document);
      const analysis = analyseDraft(text, document, pipeline);
      const strict = Boolean(pipeline.contract?.strict);
      const resolvedState = strict && runtime?.evaluateStep ? asArray(pipeline.steps).map((step) => runtime.evaluateStep(pipeline, step.id)) : [];
      const readyCount = resolvedState.filter((item) => item.ready).length;
      root.innerHTML = header("Pipeline Studio", "Inspect the bundled pipeline contract, edit a temporary local draft and review its structure without implying persistence or deployment.", `<a class="btn" href="settings.html?tab=pipelines">${icon("settings")} Pipeline settings</a><button class="btn" id="studio-download">${icon("download")} Download draft</button><button class="btn btn-primary" type="button" disabled title="Saving requires repository access and build validation">${icon("lock")} Save unavailable</button>`, {breadcrumbs:[{label:"Workspace",href:"index.html"},{label:"Settings",href:"settings.html?tab=pipelines"},{label:"Pipeline Studio"}]}) + `
        <section class="summary-strip" aria-label="Pipeline Studio summary"><div class="summary-item"><small>Pipeline</small><strong class="summary-value-text">${esc(pipeline.id.toUpperCase())}</strong><span>${esc(pipeline.name)}</span></div><div class="summary-item"><small>Sources</small><strong>${studio.documents.length}</strong><span>bundled local documents</span></div><div class="summary-item"><small>Contract</small><strong>${strict ? "Strict" : "Manifest"}</strong><span>${strict ? `${readyCount}/${pipeline.steps.length} gates ready` : "navigation definition"}</span></div><div class="summary-item"><small>Persistence</small><strong>Draft only</strong><span>reload restores checked-in source</span></div></section>
        <div class="toolbar pipeline-studio-toolbar" role="group" aria-label="Pipeline Studio controls"><div class="field pipeline-studio-select"><label for="studio-pipeline">Pipeline</label><select class="select" id="studio-pipeline">${registry.map((item) => `<option value="${esc(item.id)}" ${item.id === pipelineId ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></div><div class="field pipeline-studio-select pipeline-studio-document-select"><label for="studio-document">Source document</label><select class="select" id="studio-document">${groupedDocumentOptions(studio)}</select></div><span class="toolbar-spacer"></span><span id="studio-dirty-state" class="badge ${isDirty(document) ? "badge-warning" : "badge-success"}">${isDirty(document) ? "Unsaved local draft" : "Checked-in source"}</span><button class="btn" id="studio-reset" type="button" ${isDirty(document) ? "" : "disabled"}>${icon("trash")} Reset document</button></div>
        <div class="pipeline-studio-layout">
          <aside class="panel pipeline-studio-outline"><div class="panel-header"><div><h3 class="mb-0">Source outline</h3><small>Contract and referenced resources</small></div>${icon("hierarchy")}</div><div class="panel-body" id="studio-outline">${outlineMarkup(studio)}</div></aside>
          <section class="panel pipeline-studio-editor"><div class="panel-header"><div><h3 class="mb-0">${esc(document.label)}</h3><small><code>${esc(document.path)}</code> · ${esc(document.format.toUpperCase())}</small></div><div class="cluster">${statusBadge(analysis)}<span class="badge">Preview editor</span></div></div><div class="pipeline-editor-frame"><div class="code-editor syntax-enabled pipeline-code-editor"><pre class="editor-gutter" id="studio-gutter" aria-hidden="true"></pre><div class="editor-layer"><pre class="syntax-highlight" id="studio-highlight" aria-hidden="true"></pre><textarea id="studio-source" name="pipeline-source" aria-label="Editable pipeline source draft" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(text)}</textarea></div></div></div><div class="panel-footer pipeline-editor-status"><span id="studio-cursor">Line 1 · Column 1</span><span id="studio-source-stats">${analysis.lines} lines · ${analysis.characters} characters</span><span>Local memory only</span></div></section>
          <aside class="panel pipeline-studio-preview"><div class="panel-header"><div><h3 class="mb-0">Draft preview</h3><small>Structure, metadata and lightweight checks</small></div>${icon("eye")}</div><div class="panel-body" id="studio-preview">${previewMarkup({analysis, document, pipeline, icon, esc})}</div></aside>
        </div>`;
      bindStudio();
      updateEditorVisuals();
      Log.info("studio.render", {pipeline:pipeline.id, document:document.path, sources:studio.documents.length});
    }

    function currentContext() {
      const pipeline = pipelines[pipelineId];
      const document = sourceDocument();
      const text = document ? sourceText(document) : "";
      return {pipeline, document, text, analysis:document ? analyseDraft(text, document, pipeline) : null};
    }

    function updateEditorVisuals() {
      const textarea = document.getElementById("studio-source");
      const highlight = document.getElementById("studio-highlight");
      const gutter = document.getElementById("studio-gutter");
      if (!textarea || !highlight || !gutter) return;
      const context = currentContext();
      highlight.innerHTML = highlightSource(textarea.value, context.document.format) + (textarea.value.endsWith("\n") ? "\n " : "");
      gutter.textContent = textarea.value.split("\n").map((_, index) => index + 1).join("\n");
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
      gutter.scrollTop = textarea.scrollTop;
      const analysis = analyseDraft(textarea.value, context.document, context.pipeline);
      const preview = document.getElementById("studio-preview");
      if (preview) preview.innerHTML = previewMarkup({analysis, document:context.document, pipeline:context.pipeline, icon, esc});
      const stats = document.getElementById("studio-source-stats");
      if (stats) stats.textContent = `${analysis.lines} lines · ${analysis.characters} characters`;
      const dirty = isDirty(context.document);
      const dirtyState = document.getElementById("studio-dirty-state");
      if (dirtyState) { dirtyState.className = `badge ${dirty ? "badge-warning" : "badge-success"}`; dirtyState.textContent = dirty ? "Unsaved local draft" : "Checked-in source"; }
      const reset = document.getElementById("studio-reset");
      if (reset) reset.disabled = !dirty;
      const outline = document.getElementById("studio-outline");
      if (outline) outline.innerHTML = outlineMarkup(studioRecord());
      updateCursor();
    }

    function updateCursor() {
      const textarea = document.getElementById("studio-source");
      const cursor = document.getElementById("studio-cursor");
      if (!textarea || !cursor) return;
      const before = textarea.value.slice(0, textarea.selectionStart);
      const lines = before.split("\n");
      cursor.textContent = `Line ${lines.length} · Column ${(lines.at(-1) || "").length + 1}`;
    }

    function bindStudio() {
      const pipelineSelect = document.getElementById("studio-pipeline");
      const documentSelect = document.getElementById("studio-document");
      const textarea = document.getElementById("studio-source");
      const highlight = document.getElementById("studio-highlight");
      const gutter = document.getElementById("studio-gutter");
      pipelineSelect?.addEventListener("change", () => {
        pipelineId = pipelineSelect.value;
        documentPath = sources[pipelineId]?.entry || sources[pipelineId]?.documents?.[0]?.path || "";
        renderShell();
      });
      documentSelect?.addEventListener("change", () => { documentPath = documentSelect.value; renderShell(); });
      document.querySelectorAll("[data-studio-document]").forEach((button) => button.addEventListener("click", () => { documentPath = button.dataset.studioDocument; renderShell(); }));
      textarea?.addEventListener("input", () => {
        const context = currentContext();
        draftStore.set(draftKey(context.document.path), textarea.value);
        updateEditorVisuals();
      });
      textarea?.addEventListener("scroll", () => {
        if (highlight) { highlight.scrollTop = textarea.scrollTop; highlight.scrollLeft = textarea.scrollLeft; }
        if (gutter) gutter.scrollTop = textarea.scrollTop;
      });
      textarea?.addEventListener("keyup", updateCursor);
      textarea?.addEventListener("click", updateCursor);
      textarea?.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        event.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.setRangeText("  ", start, end, "end");
        textarea.dispatchEvent(new Event("input", {bubbles:true}));
      });
      document.getElementById("studio-reset")?.addEventListener("click", () => {
        const context = currentContext();
        draftStore.set(draftKey(context.document.path), sourceOriginal(context.document));
        renderShell();
        toast?.("Draft reset to the checked-in source.");
      });
      document.getElementById("studio-download")?.addEventListener("click", () => {
        const context = currentContext();
        const filename = `${context.pipeline.id}-${context.document.path.replaceAll("/", "-")}`;
        download?.(new Blob([context.text], {type:context.document.format === "json" ? "application/json" : "application/yaml"}), filename);
        toast?.("Local draft downloaded for external review.");
      });
    }

    documentPath = studioRecord().entry || studioRecord().documents[0]?.path || "";
    renderShell();
  }

  window.LabFlowPipelineStudio = {render};
})();
