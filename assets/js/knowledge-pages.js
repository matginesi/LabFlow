(function () {
  "use strict";

  const D = window.LabFlowData || {};
  const Log = window.LabFlowLogger?.child("ai-models") || {debug(){},info(){},warn(){},error(){}};
  const list = (value) => Array.isArray(value) ? value : [];
  const rawFoundation = D.aiFoundation && typeof D.aiFoundation === "object" ? D.aiFoundation : {};
  const rawComparison = rawFoundation.modelComparison;
  const normalizedComparison = Array.isArray(rawComparison)
    ? {
        labels: rawComparison.map((item) => item.name || item.label || "Model"),
        r2: rawComparison.map((item) => Number(item.r2) || 0),
        mae: rawComparison.map((item) => Number(item.mae) || 0),
        rmse: rawComparison.map((item) => Number(item.rmse) || 0)
      }
    : {
        labels: list(rawComparison?.labels),
        r2: list(rawComparison?.r2),
        mae: list(rawComparison?.mae),
        rmse: list(rawComparison?.rmse)
      };
  const F = {
    ...rawFoundation,
    readiness: {
      overall: Number(rawFoundation.readiness?.overall) || 0,
      status: rawFoundation.readiness?.status || "Not assessed",
      updated: rawFoundation.readiness?.updated || "—",
      metrics: list(rawFoundation.readiness?.metrics),
      blocking: list(rawFoundation.readiness?.blocking)
    },
    ragEvaluation: list(rawFoundation.ragEvaluation),
    activeDataset: rawFoundation.activeDataset && typeof rawFoundation.activeDataset === "object" ? rawFoundation.activeDataset : {},
    datasetLifecycle: list(rawFoundation.datasetLifecycle),
    modalities: list(rawFoundation.modalities),
    qualityChecks: list(rawFoundation.qualityChecks),
    datasetRows: list(rawFoundation.datasetRows),
    labelQueue: list(rawFoundation.labelQueue),
    datasetSnapshots: list(rawFoundation.datasetSnapshots),
    featureSchema: list(rawFoundation.featureSchema),
    trainingRuns: list(rawFoundation.trainingRuns),
    models: list(rawFoundation.models),
    predictions: list(rawFoundation.predictions),
    visionSamples: list(rawFoundation.visionSamples),
    visionMetrics: rawFoundation.visionMetrics && typeof rawFoundation.visionMetrics === "object" ? rawFoundation.visionMetrics : {metrics:[],classes:[]},
    stabilityForecast: rawFoundation.stabilityForecast && typeof rawFoundation.stabilityForecast === "object" ? rawFoundation.stabilityForecast : {times:[],observed:[],forecast:[],lower:[],upper:[]},
    experimentCandidates: list(rawFoundation.experimentCandidates),
    processSignals: list(rawFoundation.processSignals),
    useCases: list(rawFoundation.useCases),
    outputTypes: list(rawFoundation.outputTypes),
    residuals: list(rawFoundation.residuals),
    confusionMatrix: rawFoundation.confusionMatrix && typeof rawFoundation.confusionMatrix === "object" ? rawFoundation.confusionMatrix : {labels:[],values:[]},
    modelComparison: normalizedComparison,
    trainingHistory: rawFoundation.trainingHistory && typeof rawFoundation.trainingHistory === "object" ? rawFoundation.trainingHistory : {model:"No training run",metricLabel:"Validation metric",epochs:[],trainLoss:[],validationLoss:[],validationMetric:[],learningRate:[]}
  };
  const sources = ["Experiments", "Processes", "Materials", "Results", "Documents and SOPs"];
  const savedViews = list(D.savedViews).map((item) => ({...item}));

  const evidence = {
    sop: {id:"KB-SOP-014", type:"SOP", title:"Perovskite precursor preparation", detail:"Section 4.2 · approved v4.2", confidence:"High"},
    process: {id:"PROC-CHOSE-V2", type:"Process", title:"CHOSE Standard", detail:"Version 2 · annealing step", confidence:"High"},
    experiments: {id:"EXP-041-067", type:"Experiments", title:"EXP-041, EXP-052 and EXP-067", detail:"8 samples · 18 declared measurements", confidence:"High"},
    measurements: {id:"JV-B03", type:"Results", title:"JV measurement cohort", detail:"24 imported rows · PCE, Voc, Jsc and FF", confidence:"High"},
    solution: {id:"SOL-011", type:"Material / solution", title:"FA/MA 1.25 M reference", detail:"DMF:DMSO 4:1 · linked batches B01–B06", confidence:"High"}
  };

  const responses = {
    analytical: {
      capability:"Ask · Compare", route:"Structured query + deterministic aggregation; interpretation added after calculation",
      question:"Compare the experiments that use DMSO.",
      answer:"All three project experiments use the DMF:DMSO solvent system. EXP-052 has the strongest measured cohort: median PCE 20.50%, range 19.90–21.10%. EXP-067 includes the best device, S08 at 21.28%, but has three comparability issues that must remain visible.",
      evidence:[evidence.experiments,evidence.measurements,evidence.solution], experiments:["EXP-041","EXP-052","EXP-067"],
      rows:[["EXP-041","3","18.94–20.16%","100 °C","Comparable"],["EXP-052","2","19.90–21.10%","105 °C","Comparable"],["EXP-067","3","17.36–21.28%","100 (unit missing)","Review"]],
      limitation:"The demonstration cohort is small and EXP-067 has missing provenance. The comparison does not establish causality."
    },
    knowledge: {
      capability:"Ask · Explain", route:"Governed document and process retrieval",
      question:"How is the standard precursor solution prepared?",
      answer:"The approved reference uses DMF:DMSO 4:1 at 1.25 mol/L. Preparation requires glovebox conditions, filtration and a traceable batch label. The source controls the exact sequence; LabFlow does not infer an unspecified handling time.",
      evidence:[evidence.sop,evidence.process,evidence.solution], experiments:["EXP-041","EXP-052"],
      limitation:"The controlled SOP must be opened and verified before laboratory execution."
    },
    relationship: {
      capability:"Ask · Trace relationships", route:"Explicit relationship traversal across project entities",
      question:"Which stacks contain SnO₂ and are linked to the best results?",
      answer:"STK-003/v2 contains a 32 nm SnO₂ electron-transport layer. It is instantiated by EXP-041, EXP-052 and EXP-067 and is linked to S04 and S08, the two highest-PCE samples in the current dataset.",
      evidence:[evidence.experiments,evidence.measurements,{id:"STK-003/V2",type:"Stack",title:"n-i-p reference device",detail:"Glass/FTO/SnO₂/Perovskite/Spiro/Au",confidence:"High"}], experiments:["EXP-041","EXP-052","EXP-067"],
      diagram:"flowchart LR\n  A[STK-003/v2] --> B[EXP-041]\n  A --> C[EXP-052]\n  A --> D[EXP-067]\n  D --> E[S08 · 21.28%]",
      limitation:"The link shows use and provenance; it does not show that SnO₂ caused the measured performance."
    },
    inspect: {
      capability:"Inspect · Data quality", route:"Deterministic validation + AI interpretation only for ambiguous text",
      question:"Inspect EXP-067 and check its export readiness.",
      answer:"EXP-067 has one blocking error, two warnings and one suggestion. Its NOMAD preview can be prepared with the issues attached, but final submission should remain blocked until device count, annealing unit and solution provenance are resolved.",
      evidence:[evidence.experiments,evidence.measurements,{id:"KB-GUIDE-008",type:"Guide",title:"NOMAD metadata mapping guide",detail:"Required identifiers, units and provenance",confidence:"High"}], experiments:["EXP-067"],
      limitation:"The ambiguous fabrication note is interpreted as a suggestion only; no missing value is invented."
    }
  };

  function issueMarkup(item, icon, esc) {
    const iconName = item.severity === "error" || item.severity === "warning" ? "warning" : item.severity === "suggestion" ? "spark" : "info";
    return `<article class="validation-issue issue-${esc(item.severity)}"><div class="issue-icon">${icon(iconName)}</div><div><div class="cluster"><strong>${esc(item.title)}</strong><span class="badge">${esc(item.severity)}</span></div><p>${esc(item.detail)}</p><small>${esc(item.source)} · ${esc(item.evidence)}</small></div></article>`;
  }

  function evidenceMarkup(item, esc) {
    return `<button class="evidence-item" type="button" data-evidence-id="${esc(item.id)}"><span class="evidence-type">${esc(item.type)}</span><span><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span><span class="confidence-badge confidence-${item.confidence.toLowerCase()}">${esc(item.confidence)}</span></button>`;
  }

  function answerMarkup(response, {icon, esc}) {
    const table = response.rows ? `<div class="table-wrap"><table class="table-dense"><thead><tr><th>Experiment</th><th>Samples</th><th>PCE range</th><th>Annealing</th><th>Comparability</th></tr></thead><tbody>${response.rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "";
    const classification = response === responses.inspect ? `<div class="interpretation-stack"><div><span class="badge badge-success">Observed data</span><p>S06 has the lowest PCE (17.36%) and EXP-067 contains 24 imported measurements.</p></div><div><span class="badge badge-accent">Correlation</span><p>The lower-performing batch also has incomplete process metadata.</p></div><div><span class="badge badge-warning">Hypothesis</span><p>Process variation may have contributed; the available data do not demonstrate this.</p></div><div><span class="badge">Suggestion</span><p>Resolve provenance, then repeat the comparison.</p></div></div>` : "";
    const diagram = response.diagram && window.LabFlowDiagrams ? `<figure class="doc-diagram">${window.LabFlowDiagrams.render(response.diagram, {label:"Stack to experiment evidence graph"})}<figcaption>Explicit entity relationships; no causal claim is implied.</figcaption></figure>` : "";
    return `<article class="knowledge-response"><div class="response-meta"><span class="badge badge-accent">${esc(response.capability)}</span><span class="badge badge-success">Local demonstration</span></div><div class="conversation-turn user-turn"><span class="avatar">MG</span><div><small>Matteo Ginesi · Researcher</small><p>${esc(response.question)}</p></div></div><div class="conversation-turn assistant-turn"><span class="assistant-mark">${icon("spark")}</span><div><small>Lab Assistant</small><p class="lead">${esc(response.answer)}</p><div class="route-note">${icon("info")}<span><strong>How this was answered</strong>${esc(response.route)}</span></div>${table}${diagram}${classification}<div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Limitation</strong><p>${esc(response.limitation)}</p></div></div></div></div><div class="response-actions"><button class="btn btn-sm" data-proposed-action="comparison">${icon("compare")} Create comparison</button><button class="btn btn-sm" data-proposed-action="inspect">${icon("check")} Inspect data quality</button><button class="btn btn-sm" data-proposed-action="report">${icon("file")} Add to report</button><button class="btn btn-sm" data-proposed-action="export">${icon("download")} Export evidence</button><button class="btn btn-sm btn-ghost" id="save-current-query">${icon("plus")} Save search</button></div></article>`;
  }

  function evidencePanel(response, {icon, esc}) {
    return `<div class="panel-header"><div><h3 class="mb-0">Evidence</h3><small>${response.evidence.length} sources · ${response.experiments.length} linked experiments</small></div><span class="badge badge-success">Traceable</span></div><div class="panel-body stack"><div class="evidence-list">${response.evidence.map((item) => evidenceMarkup(item, esc)).join("")}</div><div><h4 class="mb-1">Linked experiments</h4><div class="cluster">${response.experiments.map((id) => `<a class="badge badge-accent" href="project.html?project=PRJ-2026-014&step=review&view=findings&experiment=${id}">${esc(id)}</a>`).join("")}</div></div><div class="notice"><div>${icon("lock")}</div><div><strong>Evidence remains read only</strong><p>Generated actions require review before changing any working data.</p></div></div></div>`;
  }

  function savedViewMarkup(item, esc, icon) {
    return `<div class="saved-view-item" data-saved-view="${esc(item.id)}"><button type="button" data-open-view="${esc(item.id)}"><strong>${esc(item.name)}</strong><small>${esc(item.criteria)}</small></button><span class="badge">${item.count}</span><button class="btn btn-ghost icon-btn" type="button" data-rename-view="${esc(item.id)}" aria-label="Rename ${esc(item.name)}">${icon("edit")}</button><button class="btn btn-ghost icon-btn" type="button" data-delete-view="${esc(item.id)}" aria-label="Delete ${esc(item.name)}">${icon("x")}</button></div>`;
  }

  function classify(question) {
    const value = question.toLowerCase();
    if (/inspect|missing|quality|nomad|ready|issue|anomal/.test(value)) return responses.inspect;
    if (/stack|contain|connect|linked|sn[o₂o2]/.test(value)) return responses.relationship;
    if (/compare|pce|result|experiment|dmso|above|greater/.test(value)) return responses.analytical;
    return responses.knowledge;
  }

  function renderKnowledge(root, requested, {icon, esc}) {
    let activeResponse = requested ? {...classify(requested), question:requested} : responses.analytical;
    const activeSources = new Set(sources);
    root.innerHTML = `<section class="summary-strip summary-strip-three capability-strip" aria-label="Lab Assistant capabilities">${[["Ask","Find answers across laboratory knowledge and data","search"],["Inspect","Check quality, consistency and provenance","check"],["Prepare","Preview imports, comparisons, reports and exports","file"]].map(([title,text,ico]) => `<div class="summary-item">${icon(ico)}<span><strong>${title}</strong><small>${text}</small></span></div>`).join("")}</section>
      <div class="knowledge-workspace">
        <aside class="panel knowledge-controls"><div class="panel-header"><div><h3 class="mb-0">Search scope</h3><small>Choose context, not retrieval technology</small></div></div><div class="panel-body stack"><div class="field"><label for="knowledge-scope">Search in</label><select class="select" id="knowledge-scope"><option>Current experiment</option><option>Current project</option><option selected>Current workspace</option><option>All accessible data</option></select></div><fieldset class="source-toggles"><legend>Sources</legend>${sources.map((source) => `<label class="check-row"><input type="checkbox" value="${esc(source)}" checked><span>${esc(source)}</span></label>`).join("")}</fieldset><div class="notice"><div>${icon("info")}</div><div><strong>Automatic routing</strong><p>LabFlow selects documents, structured data, relationships or deterministic analyses internally.</p></div></div></div><div class="panel-header saved-header"><div><h3 class="mb-0">Saved views</h3><small>Session only · reset on reload</small></div></div><div class="saved-view-list" id="saved-view-list">${savedViews.map((item) => savedViewMarkup(item, esc, icon)).join("")}</div></aside>
        <main class="panel knowledge-conversation"><div class="panel-header"><div><h3 class="mb-0">Conversation</h3><small id="knowledge-route">${esc(activeResponse.route)}</small></div><span class="badge badge-success">No automatic writes</span></div><div class="panel-body" id="knowledge-answer">${answerMarkup(activeResponse,{icon,esc})}</div><form class="knowledge-composer" id="knowledge-form"><div class="prompt-chips">${["How is the standard solution prepared?","Which stacks contain SnO₂?","Compare experiments using DMSO","Inspect EXP-067 for NOMAD"].map((prompt) => `<button type="button" class="prompt-chip" data-knowledge-prompt="${esc(prompt)}">${esc(prompt)}</button>`).join("")}</div><div class="input-group"><textarea class="textarea" id="knowledge-question" rows="2" placeholder="Ask about SOPs, processes, experiments, results or relationships…">${requested ? esc(requested) : ""}</textarea><button class="btn btn-primary" type="submit">${icon("spark")} Ask LabFlow</button></div><small id="source-summary">Current workspace · ${sources.length} source types enabled</small></form></main>
        <aside class="panel knowledge-evidence" id="knowledge-evidence" aria-label="Evidence panel">${evidencePanel(activeResponse,{icon,esc})}</aside>
      </div>
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">RAG evaluation set</h2><small>Expected sources and unsupported-claim checks make retrieval quality measurable</small></div><span class="badge badge-accent">${F.ragEvaluation.length} evaluation questions</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Question</th><th>Expected evidence</th><th>Expected behaviour</th><th>Status</th></tr></thead><tbody>${F.ragEvaluation.map((item) => `<tr><td>${esc(item.question)}</td><td><code>${esc(item.expectedSource)}</code></td><td>${esc(item.expected)}</td><td><span class="badge ${item.status === "pass" ? "badge-success" : "badge-warning"}">${esc(item.status)}</span></td></tr>`).join("")}</tbody></table></div></section>
      <section class="panel section" id="quality-section"><div class="panel-header"><div><h2 class="mb-0">Experiment Inspector · EXP-067</h2><small>Deterministic checks are separated from interpretation of ambiguous text</small></div><div class="cluster"><span class="badge badge-danger">1 error</span><span class="badge badge-warning">2 warnings</span><span class="badge">1 suggestion</span></div></div><div class="panel-body"><div class="validation-list">${D.validationIssues.map((item) => issueMarkup(item,icon,esc)).join("")}</div></div></section>`;

    function bindDynamic() {
      root.querySelectorAll("[data-evidence-id]").forEach((button) => button.onclick = () => {
        const item = activeResponse.evidence.find((candidate) => candidate.id === button.dataset.evidenceId);
        button.insertAdjacentHTML("afterend", `<div class="evidence-detail"><strong>${esc(item.title)}</strong><p>${esc(item.detail)}. This local demonstration opens the cited record in place.</p></div>`);
        button.disabled = true;
      });
      root.querySelectorAll("[data-proposed-action]").forEach((button) => button.onclick = () => showPreview(button.dataset.proposedAction));
      root.querySelector("#save-current-query")?.addEventListener("click", () => {
        const id = `session-${savedViews.length + 1}`;
        savedViews.push({id,name:activeResponse.question,criteria:`${root.querySelector("#knowledge-scope").value} · ${activeSources.size} source types`,count:activeResponse.experiments.length});
        renderSavedViews();
      });
    }
    function setResponse(response, question) {
      activeResponse = {...response, question: question || response.question};
      root.querySelector("#knowledge-answer").innerHTML = answerMarkup(activeResponse,{icon,esc});
      root.querySelector("#knowledge-evidence").innerHTML = evidencePanel(activeResponse,{icon,esc});
      root.querySelector("#knowledge-route").textContent = activeResponse.route;
      bindDynamic();
    }
    function showPreview(kind) {
      const content = {
        comparison:["Create comparison","3 experiments · 3 process variants","PCE, Voc, Jsc and FF · issues retained"],
        inspect:["Run data-quality inspection","EXP-041, EXP-052 and EXP-067","Deterministic checks first; ambiguous notes labelled separately"],
        report:["Add findings to report","1 evidence-linked comparison section","Every statement carries source, metric and value"],
        export:["Export evidence bundle","3 experiments · 3 source records","Local preview only · no transmission"]
      }[kind];
      root.querySelector("#knowledge-answer").insertAdjacentHTML("afterbegin", `<div class="proposed-action-preview"><div><span class="badge badge-accent">Proposed action</span><h3>${content[0]}</h3><p>${content[1]}</p><small>${content[2]}</small></div><div class="cluster"><button class="btn" type="button" data-cancel-preview>Cancel</button><button class="btn btn-primary" type="button" data-confirm-preview>Review ${kind}</button></div></div>`);
      root.querySelector("[data-cancel-preview]").onclick = (event) => event.target.closest(".proposed-action-preview").remove();
      root.querySelector("[data-confirm-preview]").onclick = (event) => { event.target.closest(".proposed-action-preview").innerHTML = `<div class="notice notice-success"><div>${icon("check")}</div><div><strong>Preview confirmed</strong><p>The demonstration is in memory only and reload restores defaults.</p></div></div>`; };
    }
    function renderSavedViews() {
      root.querySelector("#saved-view-list").innerHTML = savedViews.length ? savedViews.map((item) => savedViewMarkup(item,esc,icon)).join("") : `<div class="empty"><strong>No saved views</strong><p>Save a useful query to reopen it during this session.</p></div>`;
      root.querySelectorAll("[data-open-view]").forEach((button) => button.onclick = () => setResponse(classify(savedViews.find((item) => item.id === button.dataset.openView).name)));
      root.querySelectorAll("[data-delete-view]").forEach((button) => button.onclick = () => { savedViews.splice(savedViews.findIndex((item) => item.id === button.dataset.deleteView),1); renderSavedViews(); });
      root.querySelectorAll("[data-rename-view]").forEach((button) => button.onclick = () => { const item=savedViews.find((view)=>view.id===button.dataset.renameView); item.name=`${item.name} · edited`; renderSavedViews(); });
    }
    root.querySelector("#knowledge-form").addEventListener("submit", (event) => { event.preventDefault(); const question=root.querySelector("#knowledge-question").value.trim(); if (question) setResponse(classify(question),question); });
    root.querySelectorAll("[data-knowledge-prompt]").forEach((button) => button.onclick = () => { root.querySelector("#knowledge-question").value=button.dataset.knowledgePrompt; setResponse(classify(button.dataset.knowledgePrompt),button.dataset.knowledgePrompt); });
    root.querySelectorAll(".source-toggles input").forEach((input) => input.addEventListener("change", () => { input.checked ? activeSources.add(input.value) : activeSources.delete(input.value); root.querySelector("#source-summary").textContent=`${root.querySelector("#knowledge-scope").value} · ${activeSources.size} source types enabled`; }));
    renderSavedViews();
    bindDynamic();
  }

  function badgeClass(status) {
    const value = String(status || "").toLowerCase();
    if (["pass", "ready", "reviewed", "complete", "completed", "evaluated", "candidate"].some((item) => value.includes(item))) return "badge-success";
    if (["warning", "review", "draft", "building", "annotation", "active", "waiting", "prototype", "needs-review", "medium", "high"].some((item) => value.includes(item))) return "badge-warning";
    if (["queued", "simulation", "holdout"].some((item) => value.includes(item))) return "badge-accent";
    if (["low"].some((item) => value.includes(item))) return "badge-success";
    return "";
  }

  function statusBadge(status, esc) {
    return `<span class="badge ${badgeClass(status)}">${esc(status || "—")}</span>`;
  }

  function metricStrip(items, esc) {
    return `<section class="summary-strip" aria-label="Section summary">${items.map(([label, value, detail]) => `<div class="summary-item metric-summary"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`).join("")}</section>`;
  }

  function progressItem(label, value, detail, esc) {
    const numeric = Math.max(0, Math.min(100, Number(value) || 0));
    return `<article class="ai-progress-row"><div><strong>${esc(label)}</strong><span>${numeric}%</span></div><div class="progress"><span style="width:${numeric}%"></span></div><small>${esc(detail)}</small></article>`;
  }

  function tableEmpty(columns, message, esc) {
    return `<tr><td colspan="${columns}"><div class="empty"><strong>No demonstration records</strong><p>${esc(message)}</p></div></td></tr>`;
  }

  function chartSvg(series, labels = []) {
    const width = 720;
    const height = 250;
    const pad = {left:42,right:18,top:18,bottom:32};
    const all = series.flatMap((item) => item.values.filter((value) => Number.isFinite(value)));
    const minimum = all.length ? Math.min(...all) : 0;
    const maximum = all.length ? Math.max(...all) : 1;
    const range = maximum - minimum || 1;
    const count = Math.max(2, ...series.map((item) => item.values.length));
    const x = (index) => pad.left + (index / (count - 1)) * (width - pad.left - pad.right);
    const y = (value) => pad.top + ((maximum - value) / range) * (height - pad.top - pad.bottom);
    const grid = [0,1,2,3,4].map((step) => {
      const yy = pad.top + (step / 4) * (height - pad.top - pad.bottom);
      const value = maximum - (step / 4) * range;
      return `<line x1="${pad.left}" y1="${yy}" x2="${width-pad.right}" y2="${yy}" class="ai-chart-grid"/><text x="${pad.left-8}" y="${yy+3}" text-anchor="end">${Number(value).toFixed(range < 2 ? 2 : 1)}</text>`;
    }).join("");
    const xLabels = labels.length ? labels : Array.from({length:count}, (_, index) => String(index + 1));
    const ticks = xLabels.map((label, index) => `<text x="${x(index)}" y="${height-10}" text-anchor="middle">${String(label)}</text>`).join("");
    const lines = series.map((item, seriesIndex) => {
      const points = item.values.map((value, index) => Number.isFinite(value) ? `${x(index)},${y(value)}` : null).filter(Boolean).join(" ");
      return `<polyline points="${points}" class="ai-chart-line series-${seriesIndex+1}"/>${item.values.map((value,index) => Number.isFinite(value) ? `<circle cx="${x(index)}" cy="${y(value)}" r="3" class="ai-chart-point series-${seriesIndex+1}"/>` : "").join("")}`;
    }).join("");
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Demonstration metric chart">${grid}${ticks}${lines}</svg>`;
  }

  function chartPanel(title, subtitle, series, labels, esc) {
    return `<section class="panel"><div class="panel-header"><div><h3 class="mb-0">${esc(title)}</h3><small>${esc(subtitle)}</small></div><span class="badge">Demonstration data</span></div><div class="panel-body"><div class="ai-chart">${chartSvg(series, labels)}</div><div class="ai-chart-legend">${series.map((item,index) => `<span><i class="series-${index+1}"></i>${esc(item.label)}</span>`).join("")}</div></div></section>`;
  }

  function visionPreview(kind) {
    const common = `<rect width="240" height="132" class="ai-vision-base"/><path d="M0 33H240M0 66H240M0 99H240M60 0V132M120 0V132M180 0V132" class="ai-vision-grid"/>`;
    const drawings = {
      streak:`<path d="M18 26 C72 35 121 28 220 42" class="ai-vision-signal"/><path d="M20 82 C86 67 140 88 222 74" class="ai-vision-signal muted"/>`,
      pl:`<ellipse cx="118" cy="66" rx="82" ry="43" class="ai-vision-fill"/><ellipse cx="168" cy="76" rx="28" ry="18" class="ai-vision-mask"/>`,
      module:`<rect x="18" y="18" width="204" height="96" class="ai-vision-frame"/><path d="M67 18V114M116 18V114M165 18V114" class="ai-vision-grid strong"/><rect x="112" y="18" width="9" height="96" class="ai-vision-mask"/>`,
      edge:`<path d="M20 26H220V105H20Z" class="ai-vision-frame"/><path d="M20 28 C38 42 28 61 43 77 C55 90 42 105 62 109" class="ai-vision-signal"/>`,
      pinhole:`${[42,74,108,145,176,202].map((cx,index)=>`<circle cx="${cx}" cy="${40+(index%3)*24}" r="${5+(index%2)*2}" class="ai-vision-mask"/>`).join("")}`,
      crack:`<path d="M28 28 67 54 89 47 121 81 149 73 211 110" class="ai-vision-signal"/>`
    };
    return `<svg viewBox="0 0 240 132" aria-hidden="true">${common}${drawings[kind] || drawings.streak}</svg>`;
  }

  function renderDatasets(root, {icon, esc}) {
    const active = F.activeDataset;
    root.innerHTML = `${metricStrip([
      ["Dataset records", active.records || 0, `${active.experiments || 0} experiments`],
      ["Measurements", active.measurements || 0, "electrical and spectral"],
      ["Scientific images", active.images || 0, `${F.visionMetrics.reviewed || 0} reviewed`],
      ["Readiness", `${active.readiness || F.readiness.overall}%`, F.readiness.status]
    ], esc)}
      <section class="grid grid-2 section">
        <article class="panel"><div class="panel-header"><div><span class="page-eyebrow">${esc(active.id || "DATASET")}</span><h2 class="mb-0">${esc(active.name || "Active laboratory dataset")}</h2><small>${esc(active.purpose || "Structured records collected from ordinary laboratory work")}</small></div>${statusBadge(active.status,esc)}</div><div class="panel-body stack"><div class="metadata-list"><div><span>Version</span><strong>${esc(active.version || "—")}</strong></div><div><span>Owner</span><strong>${esc(active.owner || "—")}</strong></div><div><span>Features</span><strong>${esc(active.features || 0)}</strong></div><div><span>Targets</span><strong>${esc(active.targets || 0)}</strong></div><div><span>Size</span><strong>${esc(active.size || "—")}</strong></div><div><span>Split policy</span><strong>${esc(active.split || "—")}</strong></div></div><div class="cluster"><button class="btn" data-demo-action="manifest">${icon("file")} Inspect manifest</button><button class="btn btn-primary" data-demo-action="snapshot">${icon("database")} Prepare snapshot</button></div></div></article>
        <article class="panel"><div class="panel-header"><div><h2 class="mb-0">Dataset readiness</h2><small>Visible checks, not a model-generated score</small></div><span class="badge badge-warning">${F.readiness.overall}%</span></div><div class="panel-body stack">${F.readiness.metrics.map((item)=>progressItem(item.label,item.value,item.detail,esc)).join("")}<div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Blocking work</strong><p>${F.readiness.blocking.map(esc).join(" · ")}</p></div></div></div></article>
      </section>
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">Collection and snapshot pipeline</h2><small>The same page language used by project steps and validation views</small></div><button class="btn btn-sm" data-demo-action="pipeline">${icon("play")} Continue build</button></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Stage</th><th>Assets / state</th><th>Purpose</th><th>Status</th></tr></thead><tbody>${F.datasetLifecycle.map((item,index)=>`<tr><td><strong>${String(index+1).padStart(2,"0")} · ${esc(item.label)}</strong></td><td>${esc(item.count)}</td><td>${esc(item.detail)}</td><td>${statusBadge(item.status,esc)}</td></tr>`).join("") || tableEmpty(4,"No lifecycle stages are defined.",esc)}</tbody></table></div></section>
      <section class="grid grid-2 section">
        <article class="panel"><div class="panel-header"><div><h2 class="mb-0">Data coverage</h2><small>Modalities collected for current and future models</small></div><span class="badge">${F.modalities.length} modalities</span></div><div class="panel-body stack">${F.modalities.map((item)=>`<article class="validation-issue issue-information"><div class="issue-icon">${icon(item.icon)}</div><div><div class="cluster"><strong>${esc(item.label)}</strong><span class="badge">${item.count} items</span></div><p>${esc(item.detail)}</p><div class="metric-inline"><div class="progress"><span style="width:${item.coverage}%"></span></div><strong>${item.coverage}%</strong></div></div></article>`).join("")}</div></article>
        <article class="panel"><div class="panel-header"><div><h2 class="mb-0">Quality gates</h2><small>Records remain reviewable before entering a snapshot</small></div><span class="badge">${F.qualityChecks.length} checks</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Check</th><th>Passed</th><th>Issue</th><th>Status</th></tr></thead><tbody>${F.qualityChecks.map((item)=>`<tr><td><strong>${esc(item.label)}</strong></td><td>${item.passed} / ${item.total}</td><td>${esc(item.detail)}</td><td>${statusBadge(item.status,esc)}</td></tr>`).join("")}</tbody></table></div></article>
      </section>
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">Dataset browser</h2><small>Preview the cohort being assembled across projects and modalities</small></div><span class="badge badge-accent" id="dataset-visible-count">${F.datasetRows.length} visible rows</span></div><div class="toolbar"><div class="segmented" role="group" aria-label="Filter dataset rows"><button class="active" type="button" data-row-filter="all">All</button><button type="button" data-row-filter="train">Train</button><button type="button" data-row-filter="validation">Validation</button><button type="button" data-row-filter="test">Test</button><button type="button" data-row-filter="review">Review</button></div><span class="toolbar-spacer"></span><button class="btn btn-sm" data-demo-action="export-dataset">${icon("download")} Export snapshot</button></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Sample</th><th>Experiment / batch</th><th>Modalities</th><th>Target / label</th><th>Split</th><th>Quality</th></tr></thead><tbody>${F.datasetRows.map((item)=>`<tr data-dataset-row data-split="${esc(item.split)}" data-quality="${esc(item.quality)}"><td><strong>${esc(item.sample)}</strong></td><td><code>${esc(item.experiment)}</code><small class="block">${esc(item.batch)}</small></td><td>${item.modalities.map((value)=>`<span class="badge">${esc(value)}</span>`).join(" ")}</td><td>${esc(item.target)}</td><td><span class="badge badge-accent">${esc(item.split)}</span></td><td>${statusBadge(item.quality,esc)}</td></tr>`).join("") || tableEmpty(6,"No rows are available in the demonstration cohort.",esc)}</tbody></table></div></section>
      <section class="grid grid-2 section">
        <article class="panel"><div class="panel-header"><div><h2 class="mb-0">Annotation and target queue</h2><small>Labels remain human-reviewed scientific records</small></div><button class="btn btn-sm" data-demo-action="annotation">${icon("edit")} Open labeling</button></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Record</th><th>Type</th><th>Label / target</th><th>Reviewer</th><th>Status</th></tr></thead><tbody>${F.labelQueue.map((item)=>`<tr><td><strong>${esc(item.sample)}</strong><small class="block"><code>${esc(item.id)}</code></small></td><td>${esc(item.type)}</td><td>${esc(item.label)}</td><td>${esc(item.reviewer)}</td><td>${statusBadge(item.status,esc)}</td></tr>`).join("")}</tbody></table></div></article>
        <article class="panel"><div class="panel-header"><div><h2 class="mb-0">Snapshot registry</h2><small>Immutable versions, targets and leakage-safe split policies</small></div><span class="badge">${F.datasetSnapshots.length} snapshots</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Snapshot</th><th>Rows</th><th>Target</th><th>Split</th><th>Status</th></tr></thead><tbody>${F.datasetSnapshots.map((item)=>`<tr><td><strong>${esc(item.name)}</strong><small class="block"><code>${esc(item.id)} · v${esc(item.version)}</code></small></td><td>${item.rows}</td><td>${esc(item.target)}</td><td>${esc(item.split)}</td><td>${statusBadge(item.status,esc)}</td></tr>`).join("")}</tbody></table></div></article>
      </section>
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">Feature, target and grouping schema</h2><small>Every field retains role, unit, source and coverage</small></div><span class="badge badge-accent">${F.featureSchema.length} fields shown</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Field</th><th>Role</th><th>Type</th><th>Unit</th><th>Source</th><th>Coverage</th></tr></thead><tbody>${F.featureSchema.map((item)=>`<tr><td><strong>${esc(item.label)}</strong><small class="block"><code>${esc(item.name)}</code></small></td><td>${esc(item.role)}</td><td>${esc(item.type)}</td><td>${esc(item.unit)}</td><td>${esc(item.source)}</td><td><div class="metric-inline"><div class="progress"><span style="width:${item.coverage}%"></span></div><strong>${item.coverage}%</strong></div></td></tr>`).join("")}</tbody></table></div></section>`;

    const applyFilter = (filter) => {
      let visible = 0;
      root.querySelectorAll("[data-dataset-row]").forEach((row) => {
        const show = filter === "all" || row.dataset.split === filter || (filter === "review" && ["review","warning"].includes(row.dataset.quality));
        row.hidden = !show;
        if (show) visible += 1;
      });
      root.querySelector("#dataset-visible-count").textContent = `${visible} visible rows`;
      root.querySelectorAll("[data-row-filter]").forEach((button)=>button.classList.toggle("active",button.dataset.rowFilter===filter));
    };
    root.querySelectorAll("[data-row-filter]").forEach((button)=>button.addEventListener("click",()=>applyFilter(button.dataset.rowFilter)));
    bindDemoActions(root, icon);
  }

  function renderModels(root, {icon, esc}) {
    const history = F.trainingHistory;
    const best = F.models.reduce((current,item)=>!current || Number(item.score)>Number(current.score) ? item : current,null);
    const comparisonRows = normalizedComparison.labels.map((label,index)=>({label,r2:Number(normalizedComparison.r2[index] || 0),mae:Number(normalizedComparison.mae[index] || 0),rmse:Number(normalizedComparison.rmse[index] || 0)}));
    root.innerHTML = `${metricStrip([
      ["Registered models", F.models.length, `${F.models.filter((item)=>item.family==="Deep learning").length} deep-learning`],
      ["Training runs", F.trainingRuns.length, `${F.trainingRuns.filter((item)=>item.status==="completed").length} completed`],
      ["Best evaluated score", best ? String(best.score) : "—", best ? best.name : "No evaluated model"],
      ["Current snapshot", "DS-PCE-001", "grouped validation"]
    ],esc)}
      <section class="grid grid-2 section">
        <article class="panel"><div class="panel-header"><div><h2 class="mb-0">Model comparison</h2><small>Baselines remain visible beside the preferred candidate</small></div><span class="badge">Regression</span></div><div class="panel-body stack">${comparisonRows.map((item,index)=>`<article class="ai-comparison-row"><div><strong>${esc(item.label)}</strong><small>MAE ${item.mae.toFixed(2)} pp · RMSE ${item.rmse.toFixed(2)} pp</small></div><div class="progress"><span style="width:${Math.max(4,item.r2*100)}%"></span></div><strong>R² ${item.r2.toFixed(2)}</strong>${index===comparisonRows.length-1?'<span class="badge badge-success">Best</span>':""}</article>`).join("")}</div></article>
        <article class="panel"><div class="panel-header"><div><h2 class="mb-0">Run status</h2><small>Versioned execution, artifact and evaluation state</small></div><button class="btn btn-sm" data-demo-action="training">${icon("play")} Queue run</button></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Run</th><th>Model / dataset</th><th>Metric</th><th>Stage</th><th>Status</th></tr></thead><tbody>${F.trainingRuns.map((run)=>`<tr><td><code>${esc(run.id)}</code><small class="block">${esc(run.created)}</small></td><td>${esc(run.model)}<small class="block">${esc(run.dataset)}</small></td><td><strong>${esc(run.bestMetric)}</strong></td><td>${esc(run.stage)}</td><td>${statusBadge(run.status,esc)}</td></tr>`).join("")}</tbody></table></div></article>
      </section>
      <section class="grid grid-2 section">${chartPanel("Training and validation loss",`${history.model} · grouped demonstration run`,[{label:"Training loss",values:history.trainLoss},{label:"Validation loss",values:history.validationLoss}],history.epochs,esc)}${chartPanel(history.metricLabel || "Validation metric","The metric is shown separately from loss",[{label:history.metricLabel || "Validation",values:history.validationMetric}],history.epochs,esc)}</section>
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">Model registry</h2><small>Task, algorithm, snapshot, metrics and scope stay inspectable</small></div><span class="badge badge-accent">POC registry</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Model</th><th>Family / task</th><th>Algorithm</th><th>Dataset</th><th>Primary metrics</th><th>Status</th></tr></thead><tbody>${F.models.map((item)=>`<tr><td><strong>${esc(item.name)}</strong><small class="block"><code>${esc(item.id)} · v${esc(item.version)}</code></small></td><td>${esc(item.family)}<small class="block">${esc(item.task)}</small></td><td>${esc(item.algorithm)}<small class="block">${esc(item.scope)}</small></td><td><code>${esc(item.dataset)}</code></td><td>${Object.entries(item.metrics || {}).slice(0,3).map(([key,value])=>`<span class="badge">${esc(key)} ${esc(value)}</span>`).join(" ")}</td><td>${statusBadge(item.status,esc)}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="grid grid-2 section">
        <article class="panel"><div class="panel-header"><div><h2 class="mb-0">Validation policy</h2><small>Scientific controls shared by all model families</small></div>${icon("check")}</div><div class="panel-body validation-list">${[
          ["Grouped split","Experiment, batch and acquisition session never cross train/test boundaries","information"],
          ["Baseline required","Every candidate is compared with a simple deterministic or statistical baseline","information"],
          ["Uncertainty visible","Predictions retain intervals, applicability and missing-input warnings","warning"],
          ["Human approval","Models never write conclusions or exclude records automatically","suggestion"]
        ].map(([title,detail,severity])=>`<article class="validation-issue issue-${severity}"><div class="issue-icon">${icon(severity==="warning"?"warning":severity==="suggestion"?"user":"check")}</div><div><strong>${title}</strong><p>${detail}</p></div></article>`).join("")}</div></article>
        <article class="panel"><div class="panel-header"><div><h2 class="mb-0">Learning-rate history</h2><small>Hyperparameters remain part of the run record</small></div><span class="badge">${history.epochs.length} checkpoints</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Epoch</th><th>Learning rate</th><th>Train loss</th><th>Validation loss</th><th>${esc(history.metricLabel || "Metric")}</th></tr></thead><tbody>${history.epochs.map((epoch,index)=>`<tr><td>${epoch}</td><td><code>${Number(history.learningRate[index] || 0).toExponential(1)}</code></td><td>${Number(history.trainLoss[index] || 0).toFixed(3)}</td><td>${Number(history.validationLoss[index] || 0).toFixed(3)}</td><td>${Number(history.validationMetric[index] || 0).toFixed(3)}</td></tr>`).join("")}</tbody></table></div></article>
      </section>`;
    bindDemoActions(root,icon);
  }

  function visionInspector(item, {icon, esc}) {
    if (!item) return `<div class="empty"><strong>No image selected</strong><p>Select a record from the review table.</p></div>`;
    return `<div class="grid grid-2 ai-vision-inspector"><div class="ai-vision-large">${visionPreview(item.kind)}</div><div class="stack"><div><span class="page-eyebrow">${esc(item.id)}</span><h3>${esc(item.sample)} · ${esc(item.label)}</h3><p>${esc(item.detail)}</p></div><div class="metadata-list"><div><span>Modality</span><strong>${esc(item.modality)}</strong></div><div><span>Model score</span><strong>${Math.round(Number(item.score || 0)*100)}%</strong></div><div><span>Review state</span><strong>${esc(item.status)}</strong></div><div><span>Output class</span><strong>Prediction / annotation proposal</strong></div></div><div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Human review retained</strong><p>The preview is not a measured defect map and cannot replace the source image or approved annotation.</p></div></div></div></div>`;
  }

  function renderVision(root, {icon, esc}) {
    const reviewed = Number(F.visionMetrics.reviewed || 0);
    const total = Number(F.visionMetrics.total || 0);
    const coverage = total ? Math.round(reviewed/total*100) : 0;
    const first = F.visionSamples[0];
    root.innerHTML = `${metricStrip([
      ["Images", total || F.visionSamples.length, "optical, PL, EL and microscopy"],
      ["Reviewed labels", reviewed, `${coverage}% coverage`],
      ["Open review", Math.max(0,total-reviewed), "queued or incomplete"],
      ["Best Dice", F.visionMetrics.metrics?.find((item)=>item.label==="Dice")?.value || "—", "segmentation baseline"]
    ],esc)}
      <section class="grid grid-2 section">
        <article class="panel"><div class="panel-header"><div><h2 class="mb-0">Vision dataset status</h2><small>Annotation, class balance and review readiness</small></div><span class="badge badge-warning">${coverage}% reviewed</span></div><div class="panel-body stack"><div class="metadata-list">${(F.visionMetrics.metrics || []).map((item)=>`<div><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`).join("")}</div><div>${progressItem("Reviewed annotations",coverage,`${reviewed} of ${total} images`,esc)}</div></div></article>
        <article class="panel"><div class="panel-header"><div><h2 class="mb-0">Class balance</h2><small>Distribution used to plan sampling and augmentation</small></div><span class="badge">${F.visionMetrics.classes?.length || 0} classes</span></div><div class="panel-body stack">${(F.visionMetrics.classes || []).map((item)=>progressItem(item.label,total?Math.round(item.count/total*100):0,`${item.count} images`,esc)).join("")}</div></article>
      </section>
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">Image review queue</h2><small>One shared table pattern for classification, segmentation and annotation review</small></div><button class="btn btn-sm" data-demo-action="annotation">${icon("edit")} Open annotation</button></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Preview</th><th>Record</th><th>Modality</th><th>Proposed label</th><th>Score</th><th>Status</th></tr></thead><tbody>${F.visionSamples.map((item,index)=>`<tr class="ai-selectable-row ${index===0?"active":""}" data-vision="${esc(item.id)}"><td><button class="ai-vision-thumb" type="button" aria-label="Inspect ${esc(item.id)}">${visionPreview(item.kind)}</button></td><td><strong>${esc(item.sample)}</strong><small class="block"><code>${esc(item.id)}</code></small></td><td>${esc(item.modality)}</td><td>${esc(item.label)}<small class="block">${esc(item.detail)}</small></td><td>${Math.round(Number(item.score || 0)*100)}%</td><td>${statusBadge(item.status,esc)}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">Selected image</h2><small id="vision-selection-title">${first ? `${esc(first.sample)} · ${esc(first.modality)}` : "No selection"}</small></div><span class="badge badge-accent">Scientific Vision POC</span></div><div class="panel-body" id="vision-inspector">${visionInspector(first,{icon,esc})}</div></section>
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">Vision data contract</h2><small>What LabFlow must collect before training or inference</small></div>${icon("eye")}</div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Record</th><th>Required data</th><th>Quality control</th><th>Output</th></tr></thead><tbody>${[
        ["Source image","Original file, modality, calibration, acquisition session","Checksum, dimensions, exposure and instrument linkage","Immutable raw asset"],
        ["Annotation","Class, polygon/mask, reviewer and timestamp","Inter-review agreement and unresolved regions","Versioned human label"],
        ["Training sample","Group, split, transformations and exclusions","No session or sample leakage","Snapshot membership"],
        ["Model output","Class/mask, score, model and dataset versions","Applicability and review state","Prediction kept separate from observation"]
      ].map((row)=>`<tr>${row.map((cell)=>`<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
    root.querySelectorAll("[data-vision]").forEach((row)=>row.addEventListener("click",()=>{
      const item = F.visionSamples.find((candidate)=>candidate.id===row.dataset.vision);
      root.querySelectorAll("[data-vision]").forEach((candidate)=>candidate.classList.toggle("active",candidate===row));
      root.querySelector("#vision-inspector").innerHTML = visionInspector(item,{icon,esc});
      root.querySelector("#vision-selection-title").textContent = `${item.sample} · ${item.modality}`;
    }));
    bindDemoActions(root,icon);
  }

  function forecastChart(data, esc) {
    return chartPanel("Stability trajectory",`${data.sample || "Sample"} · observed and forecast normalized performance`,[
      {label:"Observed",values:(data.observed || []).map((value)=>value===null?NaN:Number(value))},
      {label:"Forecast",values:(data.forecast || []).map(Number)}
    ],(data.times || []).map((time)=>`${time} h`),esc);
  }

  function candidateDetail(item, {icon, esc}) {
    if (!item) return `<div class="empty"><strong>No candidate selected</strong><p>Select an experiment candidate from the ranking table.</p></div>`;
    return `<div class="stack"><div class="cluster"><span class="badge badge-accent">Rank #${item.rank}</span><span class="badge ${item.risk==="Low"?"badge-success":item.risk==="High"?"badge-warning":""}">${esc(item.risk)} risk</span></div><div><h3>${esc(item.id)} · ${esc(item.objective)}</h3><p>${esc(item.reason)}</p></div><div class="metadata-list"><div><span>Blade speed</span><strong>${esc(item.speed)}</strong></div><div><span>Annealing</span><strong>${esc(item.temperature)}</strong></div><div><span>Concentration</span><strong>${esc(item.concentration)}</strong></div><div><span>Acquisition score</span><strong>${Math.round(item.score*100)}%</strong></div></div><div class="notice"><div>${icon("info")}</div><div><strong>Recommendation, not instruction</strong><p>Feasibility constraints and researcher approval remain required before creating an experiment.</p></div></div></div>`;
  }

  function renderApplications(root, {icon, esc}) {
    const first = F.experimentCandidates[0];
    root.innerHTML = `${metricStrip(F.processSignals.map((item)=>[item.label,item.value,`${item.trend} · ${item.detail}`]),esc)}
      <section class="section"><div class="section-heading"><div><h2>Scientific AI use cases</h2><p>Each use case is presented with the same panel, badge, notice and table vocabulary used elsewhere in LabFlow.</p></div></div><div class="grid grid-3">${F.useCases.map((item)=>`<article class="panel"><div class="panel-header"><div class="cluster"><span class="object-icon">${icon(item.icon)}</span><div><h3 class="mb-0">${esc(item.title)}</h3><small>${esc(item.stage)}</small></div></div>${statusBadge(item.stage,esc)}</div><div class="panel-body"><p>${esc(item.description)}</p><button class="btn btn-sm" data-demo-action="use-case">Inspect requirements</button></div></article>`).join("")}</div></section>
      <section class="grid grid-2 section"><div>${forecastChart(F.stabilityForecast,esc)}</div><article class="panel"><div class="panel-header"><div><h2 class="mb-0">Stability input contract</h2><small>Minimum records for a credible T80/T90 POC</small></div>${icon("activity")}</div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Input group</th><th>Required content</th></tr></thead><tbody>${[
        ["Device and stack","Architecture, materials, lots and encapsulation"],
        ["Initial state","PCE, Voc, Jsc, FF, PL and EQE descriptors"],
        ["Stress protocol","ISOS mode, light, temperature, humidity and atmosphere"],
        ["Time series","Timestamped performance and environmental measurements"],
        ["Outcome","T80/T90, censoring state and reviewed failure mechanism"]
      ].map(([a,b])=>`<tr><td><strong>${a}</strong></td><td>${b}</td></tr>`).join("")}</tbody></table></div></article></section>
      <section class="grid grid-2 section"><article class="panel"><div class="panel-header"><div><h2 class="mb-0">Next-experiment ranking</h2><small>Bayesian optimization shown as an offline, reviewable simulation</small></div><span class="badge badge-accent">POC only</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Rank</th><th>Candidate</th><th>Speed</th><th>Annealing</th><th>Score</th><th>Risk</th></tr></thead><tbody>${F.experimentCandidates.map((item,index)=>`<tr data-candidate="${esc(item.id)}" class="ai-selectable-row ${index===0?"active":""}"><td>#${item.rank}</td><td><button class="table-link" type="button">${esc(item.id)}</button><small class="block">${esc(item.objective)}</small></td><td>${esc(item.speed)}</td><td>${esc(item.temperature)}</td><td>${Math.round(item.score*100)}%</td><td>${statusBadge(item.risk,esc)}</td></tr>`).join("")}</tbody></table></div></article><article class="panel"><div class="panel-header"><div><h2 class="mb-0">Selected candidate</h2><small>Parameters, rationale and limitations</small></div>${icon("flask")}</div><div class="panel-body" id="candidate-inspector">${candidateDetail(first,{icon,esc})}</div></article></section>
      <section class="grid grid-3 section">${[
        ["Quality before prediction","Invalid measurements and missing provenance are resolved before modeling","warning"],
        ["Grouped validation","Samples, batches and sessions remain together across splits","lock"],
        ["Researcher decision","Models rank, estimate and explain; researchers approve","user"]
      ].map(([title,detail,ico])=>`<article class="panel"><div class="panel-body"><div class="check-row">${icon(ico)}<span><strong>${title}</strong><small>${detail}</small></span></div></div></article>`).join("")}</section>`;
    root.querySelectorAll("[data-candidate]").forEach((row)=>row.addEventListener("click",()=>{
      const item = F.experimentCandidates.find((candidate)=>candidate.id===row.dataset.candidate);
      root.querySelectorAll("[data-candidate]").forEach((candidate)=>candidate.classList.toggle("active",candidate===row));
      root.querySelector("#candidate-inspector").innerHTML = candidateDetail(item,{icon,esc});
    }));
    bindDemoActions(root,icon);
  }

  function predictionInspector(item, {icon, esc}) {
    if (!item) return `<div class="empty"><strong>No prediction selected</strong><p>Select a row from the review queue.</p></div>`;
    const unit = item.unit || "%";
    const predicted = Number(item.predicted || 0);
    const observed = Number(item.observed || 0);
    const digits = unit === "h" ? 0 : 2;
    return `<div class="stack"><div class="summary-strip summary-strip-three"><div class="summary-item"><span>Predicted</span><strong>${predicted.toFixed(digits)} ${esc(unit)}</strong><small>± ${Number(item.uncertainty || 0).toFixed(digits)} ${esc(unit)}</small></div><div class="summary-item"><span>Observed</span><strong>${observed.toFixed(digits)} ${esc(unit)}</strong><small>reviewed value</small></div><div class="summary-item"><span>Residual</span><strong>${(observed-predicted).toFixed(digits)} ${esc(unit)}</strong><small>${item.coverage}% input coverage</small></div></div><div class="metadata-list"><div><span>Prediction ID</span><strong>${esc(item.id)}</strong></div><div><span>Model</span><strong>${esc(item.model)}</strong></div><div><span>Dataset</span><strong>${esc(item.dataset)}</strong></div><div><span>Output type</span><strong>${esc(item.kind)}</strong></div><div><span>Human review</span><strong>${esc(item.status)}</strong></div></div><div class="notice ${item.status==="reviewed"?"notice-success":"notice-warning"}"><div>${icon(item.status==="reviewed"?"check":"warning")}</div><div><strong>${item.status==="reviewed"?"Reviewed prediction":"Review required"}</strong><p>${esc(item.note)}</p></div></div></div>`;
  }

  function renderPredictions(root, {icon, esc}) {
    const first = F.predictions[0];
    root.innerHTML = `${metricStrip([
      ["Predictions",F.predictions.length,"reviewable outputs"],
      ["Reviewed",F.predictions.filter((item)=>item.status==="reviewed").length,"accepted for comparison"],
      ["Needs review",F.predictions.filter((item)=>item.status!=="reviewed").length,"not scientific conclusions"],
      ["Output types",new Set(F.predictions.map((item)=>item.kind)).size,"performance, stability and vision"]
    ],esc)}
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">Prediction review queue</h2><small>Measured values, model outputs and uncertainty remain visible together</small></div><span class="badge badge-accent">Demonstration only</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Sample</th><th>Use case</th><th>Prediction</th><th>Observed</th><th>Residual</th><th>Coverage</th><th>Review</th></tr></thead><tbody>${F.predictions.map((item,index)=>{const digits=item.unit==="h"?0:2;return `<tr data-prediction="${esc(item.id)}" class="ai-selectable-row ${index===0?"active":""}"><td><button class="table-link" type="button">${esc(item.sample)}</button><small class="block"><code>${esc(item.id)}</code></small></td><td>${esc(item.kind)}</td><td><strong>${Number(item.predicted).toFixed(digits)} ± ${Number(item.uncertainty).toFixed(digits)} ${esc(item.unit)}</strong></td><td>${Number(item.observed).toFixed(digits)} ${esc(item.unit)}</td><td>${(Number(item.observed)-Number(item.predicted)).toFixed(digits)} ${esc(item.unit)}</td><td>${item.coverage}%</td><td>${statusBadge(item.status,esc)}</td></tr>`}).join("")}</tbody></table></div></section>
      <section class="grid grid-2 section"><article class="panel"><div class="panel-header"><div><h2 class="mb-0">Selected prediction</h2><small id="prediction-subtitle">${first ? `${esc(first.sample)} · ${esc(first.model)}` : "No selection"}</small></div>${icon("database")}</div><div class="panel-body" id="prediction-inspector">${predictionInspector(first,{icon,esc})}</div></article><article class="panel"><div class="panel-header"><div><h2 class="mb-0">Scientific output classes</h2><small>Storage and review states remain distinct</small></div>${icon("layers")}</div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Output</th><th>Initial state</th><th>Required evidence</th></tr></thead><tbody>${F.outputTypes.map((item)=>`<tr><td><span class="output-type output-${esc(item.type)}">${esc(item.label)}</span></td><td>${esc(item.review)}</td><td>${esc(item.evidence)}</td></tr>`).join("")}</tbody></table></div></article></section>
      <div class="notice notice-warning section"><div>${icon("warning")}</div><div><strong>Predictions never become experimental results</strong><p>Model, dataset snapshot, uncertainty, applicability and human review remain attached to every output.</p></div></div>`;
    root.querySelectorAll("[data-prediction]").forEach((row)=>row.addEventListener("click",()=>{
      const item=F.predictions.find((candidate)=>candidate.id===row.dataset.prediction);
      root.querySelectorAll("[data-prediction]").forEach((candidate)=>candidate.classList.toggle("active",candidate===row));
      root.querySelector("#prediction-inspector").innerHTML=predictionInspector(item,{icon,esc});
      root.querySelector("#prediction-subtitle").textContent=`${item.sample} · ${item.model}`;
    }));
  }

  function bindDemoActions(root, icon) {
    root.querySelectorAll("[data-demo-action]").forEach((button) => button.addEventListener("click", () => {
      const target = button.closest(".panel, article") || button.parentElement;
      if (target.querySelector(".demo-action-result")) return;
      target.insertAdjacentHTML("beforeend", `<div class="notice notice-success demo-action-result"><div>${icon("check")}</div><div><strong>POC interaction</strong><p>This control demonstrates the future workflow. Nothing is persisted and reloading restores the checked-in state.</p></div></div>`);
    }));
  }

  function renderBase({root, header, icon, esc}) {
    Log.info("page.render", {page:"knowledge"});
    const query = new URLSearchParams(location.search);
    const requested = query.get("q");
    const available = ["knowledge","datasets","models","vision","applications","predictions"];
    const initial = requested ? "knowledge" : available.includes(query.get("view")) ? query.get("view") : "datasets";
    root.innerHTML = header(
      "AI & Models",
      "Knowledge assistance, dataset construction, ML/DL evaluation, scientific vision and reviewed predictions in one coherent LabFlow workspace.",
      `<a class="btn" href="project.html?project=PRJ-2026-014&step=review">${icon("chart")} Open current project</a><button class="btn btn-primary" data-ai-open="datasets">${icon("database")} Dataset Studio</button>`,
      {eyebrow:"Laboratory AI and data operations"}
    ) + `${metricStrip([
      ["Collect","Normal laboratory work","projects, experiments, files and images"],
      ["Validate","Scientific quality first","units, provenance, leakage and labels"],
      ["Review","Human-controlled outputs","models advise; researchers decide"]
    ],esc)}<nav class="tabs ai-foundation-tabs" aria-label="AI and models sections">${[
      ["knowledge","Knowledge","book"],
      ["datasets","Data & datasets","database"],
      ["models","ML / training","chart"],
      ["vision","Vision","eye"],
      ["applications","Scientific AI","flask"],
      ["predictions","Predictions","spark"]
    ].map(([id,label,ico])=>`<button class="tab" type="button" data-ai-view="${id}">${icon(ico)} ${label}</button>`).join("")}</nav><div id="ai-foundation-content"></div>`;
    const content = root.querySelector("#ai-foundation-content");
    const renderers = {
      knowledge:()=>renderKnowledge(content,requested,{icon,esc}),
      datasets:()=>renderDatasets(content,{icon,esc}),
      models:()=>renderModels(content,{icon,esc}),
      vision:()=>renderVision(content,{icon,esc}),
      applications:()=>renderApplications(content,{icon,esc}),
      predictions:()=>renderPredictions(content,{icon,esc})
    };
    function show(view) {
      const resolved = renderers[view] ? view : "datasets";
      root.querySelectorAll("[data-ai-view]").forEach((button)=>{
        const active=button.dataset.aiView===resolved;
        button.classList.toggle("active",active);
        button.setAttribute("aria-current",active?"page":"false");
      });
      renderers[resolved]();
      const url = new URL(location.href);
      if (resolved !== "datasets") url.searchParams.set("view",resolved); else url.searchParams.delete("view");
      if (resolved !== "knowledge") url.searchParams.delete("q");
      if (["http:","https:"].includes(location.protocol)) history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
      Log.info("view.changed",{view:resolved});
    }
    root.querySelectorAll("[data-ai-view]").forEach((button)=>button.addEventListener("click",()=>show(button.dataset.aiView)));
    root.querySelector("[data-ai-open]")?.addEventListener("click",(event)=>show(event.currentTarget.dataset.aiOpen));
    show(initial);
  }

  window.LabFlowKnowledgePages = {renderBase};
})();
