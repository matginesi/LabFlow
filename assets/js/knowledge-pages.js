(function () {
  "use strict";

  const D = window.LabFlowData;
  const Log = window.LabFlowLogger?.child("ai-models") || {debug(){},info(){},warn(){},error(){}};
  const F = D.aiFoundation;
  const sources = ["Experiments", "Processes", "Materials", "Results", "Documents and SOPs"];
  const savedViews = D.savedViews.map((item) => ({...item}));

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
    return `<div class="panel-header"><div><h3 class="mb-0">Evidence</h3><small>${response.evidence.length} sources · ${response.experiments.length} linked experiments</small></div><span class="badge badge-success">Traceable</span></div><div class="panel-body stack"><div class="evidence-list">${response.evidence.map((item) => evidenceMarkup(item, esc)).join("")}</div><div><h4 class="mb-1">Linked experiments</h4><div class="cluster">${response.experiments.map((id) => `<a class="badge badge-accent" href="project.html?project=PRJ-2026-014&step=analysis-report&experiment=${id}">${esc(id)}</a>`).join("")}</div></div><div class="notice"><div>${icon("lock")}</div><div><strong>Evidence remains read only</strong><p>Generated actions require review before changing any working data.</p></div></div></div>`;
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

  function readinessMarkup({icon, esc}) {
    const readiness = F.readiness;
    return `<div class="ai-readiness-hero"><div><span class="page-eyebrow">AI-ready data foundation</span><h2>${readiness.overall}% ready</h2><p>Readiness comes from structured records, normalized units, provenance and reviewed targets—not from an opaque score.</p><div class="cluster"><span class="badge badge-warning">${esc(readiness.status)}</span><span class="badge">Updated ${esc(readiness.updated)}</span></div></div><div class="readiness-ring" style="--readiness:${readiness.overall}" aria-label="AI readiness ${readiness.overall} percent"><strong>${readiness.overall}</strong><span>%</span></div></div><div class="readiness-metrics">${readiness.metrics.map((item) => `<article><div><strong>${esc(item.label)}</strong><span>${item.value}%</span></div><div class="progress"><span style="width:${item.value}%"></span></div><small>${esc(item.detail)}</small></article>`).join("")}</div><div class="notice notice-warning"><div>${icon("warning")}</div><div><strong>Readiness warnings remain explicit</strong><p>${readiness.blocking.map(esc).join(" · ")}</p></div></div>`;
  }

  function renderDatasets(root, {icon, esc}) {
    root.innerHTML = `<div class="ai-foundation-grid"><section class="panel"><div class="panel-header"><div><h2 class="mb-0">Dataset readiness</h2><small>Current project · deterministic checks</small></div><span class="badge badge-warning">Review required</span></div><div class="panel-body stack">${readinessMarkup({icon,esc})}</div></section><section class="panel"><div class="panel-header"><div><h2 class="mb-0">Dataset snapshots</h2><small>Immutable, versioned inputs for reproducible model runs</small></div><button class="btn btn-sm" data-demo-action="snapshot">${icon("plus")} Build snapshot</button></div><div class="panel-body dataset-snapshot-list">${F.datasetSnapshots.map((item) => `<article class="dataset-snapshot"><div class="card-title"><div><span class="knowledge-kind">${esc(item.id)} · v${esc(item.version)}</span><h3>${esc(item.name)}</h3></div><span class="badge ${item.status === "ready-with-warnings" ? "badge-warning" : ""}">${esc(item.status)}</span></div><div class="dataset-stats"><span><small>Rows</small><strong>${item.rows}</strong></span><span><small>Features</small><strong>${item.features}</strong></span><span><small>Target</small><strong>${esc(item.target)}</strong></span><span><small>Excluded</small><strong>${item.excluded}</strong></span></div><p>${esc(item.split)} · ${item.sourceExperiments.map(esc).join(" · ")}</p><div class="cluster"><button class="btn btn-sm" data-demo-action="inspect-snapshot">Inspect schema</button><button class="btn btn-sm btn-ghost" data-demo-action="export-snapshot">Export manifest</button></div></article>`).join("")}</div></section></div>
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">Feature and target schema</h2><small>Machine-readable fields remain understandable to researchers</small></div><span class="badge badge-accent">${F.featureSchema.length} fields</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Field</th><th>Role</th><th>Type</th><th>Unit</th><th>Source</th><th>Coverage</th></tr></thead><tbody>${F.featureSchema.map((item) => `<tr><td><strong>${esc(item.label)}</strong><small class="block"><code>${esc(item.name)}</code></small></td><td><span class="badge ${item.role === "target" ? "badge-accent" : ""}">${esc(item.role)}</span></td><td>${esc(item.type)}</td><td>${esc(item.unit)}</td><td>${esc(item.source)}</td><td><div class="metric-inline"><div class="progress"><span style="width:${item.coverage}%"></span></div><strong>${item.coverage}%</strong></div></td></tr>`).join("")}</tbody></table></div></section>
      <section class="grid grid-3 section">${[["Raw data","Original files and imported values remain immutable","file"],["Validated data","Units, identifiers and mappings are checked deterministically","check"],["Dataset snapshot","Selected rows, features, target and exclusions receive a stable version","database"]].map(([title,text,ico],index) => `<article class="panel ai-data-stage"><div class="panel-body"><span>${icon(ico)}</span><small>0${index+1}</small><h3>${title}</h3><p>${text}</p></div></article>`).join("")}</section>`;
    bindDemoActions(root, icon);
  }

  function chartPoints(values, width = 620, height = 210, padding = 28) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 0.0001);
    return values.map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return [x, y];
    });
  }

  function lineChart(series, labels, {title, yLabel = "", footer = ""} = {}) {
    const width = 620; const height = 220; const padding = 30;
    const all = series.flatMap((item) => item.values);
    const min = Math.min(...all); const max = Math.max(...all); const span = Math.max(max - min, 0.0001);
    const pointSet = (values) => values.map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return [x, y];
    });
    const grid = [0,.25,.5,.75,1].map((ratio) => { const y=padding+ratio*(height-padding*2); const value=(max-ratio*span).toFixed(max < 2 ? 2 : 1); return `<g><line x1="${padding}" y1="${y}" x2="${width-padding}" y2="${y}"/><text x="4" y="${y+3}">${value}</text></g>`; }).join("");
    const paths = series.map((item,index) => { const pts=pointSet(item.values); return `<polyline class="model-chart-series series-${index+1}" points="${pts.map((point)=>point.join(",")).join(" ")}"/>${pts.map(([x,y])=>`<circle class="model-chart-point series-${index+1}" cx="${x}" cy="${y}" r="2.6"/>`).join("")}`; }).join("");
    const ticks = labels.map((label,index)=>{ if(index % Math.max(1,Math.ceil(labels.length/6))!==0 && index!==labels.length-1) return ""; const x=padding+(index/Math.max(labels.length-1,1))*(width-padding*2); return `<text x="${x}" y="${height-7}" text-anchor="middle">${label}</text>`; }).join("");
    return `<figure class="model-chart"><figcaption><div><strong>${title}</strong><small>${yLabel}</small></div><div class="model-chart-legend">${series.map((item,index)=>`<span class="series-${index+1}"><i></i>${item.label}</span>`).join("")}</div></figcaption><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><g class="model-chart-grid">${grid}</g>${paths}<g class="model-chart-axis">${ticks}</g></svg>${footer ? `<small class="model-chart-footer">${footer}</small>` : ""}</figure>`;
  }

  function barChart(labels, values, {title, suffix = "", higherBetter = true} = {}) {
    const max=Math.max(...values,1);
    return `<figure class="model-chart model-bar-chart"><figcaption><div><strong>${title}</strong><small>${higherBetter ? "Higher is better" : "Lower is better"}</small></div></figcaption><div class="model-bars">${labels.map((label,index)=>`<div><span>${label}</span><div><i style="width:${Math.max(4,values[index]/max*100)}%"></i></div><strong>${values[index].toFixed(2)}${suffix}</strong></div>`).join("")}</div></figure>`;
  }

  function residualChart(rows) {
    const width=620,height=220,padding=30;
    const xs=rows.map((item)=>item.observed), residuals=rows.map((item)=>item.observed-item.predicted);
    const xmin=Math.min(...xs)-.3,xmax=Math.max(...xs)+.3,ymax=Math.max(1.5,...residuals.map(Math.abs));
    const x=(value)=>padding+(value-xmin)/(xmax-xmin)*(width-padding*2);
    const y=(value)=>height/2-value/ymax*(height/2-padding);
    return `<figure class="model-chart"><figcaption><div><strong>Residual review</strong><small>Observed PCE vs prediction residual</small></div><span class="badge badge-warning">S06 requires review</span></figcaption><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Residual plot"><line class="model-zero-line" x1="${padding}" y1="${height/2}" x2="${width-padding}" y2="${height/2}"/>${rows.map((item,index)=>`<g><circle class="model-residual-point ${Math.abs(residuals[index])>1 ? "is-warning" : ""}" cx="${x(item.observed)}" cy="${y(residuals[index])}" r="5"/><text x="${x(item.observed)}" y="${y(residuals[index])-9}" text-anchor="middle">${item.sample}</text></g>`).join("")}</svg><small class="model-chart-footer">Residuals remain linked to sample IDs; outliers are reviewed rather than silently removed.</small></figure>`;
  }

  function confusionMatrix(matrix) {
    const max=Math.max(...matrix.values.flat());
    return `<figure class="model-chart confusion-card"><figcaption><div><strong>Readiness classifier</strong><small>Confusion matrix · accuracy ${(matrix.accuracy*100).toFixed(0)}%</small></div></figcaption><div class="confusion-grid"><span></span>${matrix.labels.map((label)=>`<b>Predicted ${label}</b>`).join("")}${matrix.values.map((row,rowIndex)=>`<b>Actual ${matrix.labels[rowIndex]}</b>${row.map((value)=>`<span style="--heat:${value/max}"><strong>${value}</strong></span>`).join("")}`).join("")}</div></figure>`;
  }

  function renderModels(root, {icon, esc}) {
    const history=F.trainingHistory;
    const comparison=F.modelComparison;
    root.innerHTML = `<div class="notice notice-accent"><div>${icon("brain")}</div><div><strong>From baseline to reproducible ML/DL</strong><p>Every result is tied to a dataset snapshot, grouped validation, a training run, metrics and reviewable artifacts. Values below are demonstration data, not deployed scientific claims.</p></div></div>
      <section class="model-dashboard section"><article class="panel model-dashboard-main"><div class="panel-header"><div><h2 class="mb-0">Model performance overview</h2><small>Regression baselines compared on the same grouped dataset split</small></div><span class="badge badge-accent">${comparison.labels.length} models</span></div><div class="panel-body model-chart-grid">${barChart(comparison.labels,comparison.r2,{title:"Cross-validated R²"})}${barChart(comparison.labels,comparison.mae,{title:"Mean absolute error",suffix:" pp",higherBetter:false})}</div></article><article class="panel"><div class="panel-header"><div><h2 class="mb-0">Training status</h2><small>Latest reproducible runs</small></div>${icon("activity")}</div><div class="panel-body training-status-list">${F.trainingRuns.map((run)=>`<article><span class="run-status ${run.status === "completed" ? "is-complete" : "is-review"}">${icon(run.status === "completed" ? "check" : "warning")}</span><div><strong>${esc(run.id)}</strong><small>${esc(run.model)} · ${esc(run.duration)}</small></div><span><b>${esc(run.bestMetric)}</b><small>${esc(run.artifact)}</small></span></article>`).join("")}</div></article></section>
      <section class="grid grid-2 section"><article class="panel"><div class="panel-header"><div><h2 class="mb-0">Neural training curves</h2><small>${esc(history.model)} · ${history.epochs.at(-1)} epochs</small></div><span class="badge badge-warning">Prototype</span></div><div class="panel-body">${lineChart([{label:"Training loss",values:history.trainLoss},{label:"Validation loss",values:history.validationLoss}],history.epochs,{title:"Loss convergence",yLabel:"RMSE-like training objective",footer:"Validation loss stabilises after epoch 35; early stopping would retain the best checkpoint."})}</div></article><article class="panel"><div class="panel-header"><div><h2 class="mb-0">Validation progression</h2><small>Metric and learning-rate schedule</small></div>${icon("chart")}</div><div class="panel-body stack">${lineChart([{label:"Validation R²",values:history.validationR2}],history.epochs,{title:"Validation R² by epoch",yLabel:"Grouped validation"})}<div class="learning-rate-strip">${history.epochs.map((epoch,index)=>`<span><small>${epoch}</small><strong>${history.learningRate[index]}</strong></span>`).join("")}</div></div></article></section>
      <section class="grid grid-2 section"><article class="panel"><div class="panel-header"><div><h2 class="mb-0">Prediction diagnostics</h2><small>Sample-level errors stay visible</small></div>${icon("compare")}</div><div class="panel-body">${residualChart(F.residuals)}</div></article><article class="panel"><div class="panel-header"><div><h2 class="mb-0">Classification diagnostics</h2><small>Review labels and errors</small></div>${icon("grid")}</div><div class="panel-body">${confusionMatrix(F.confusionMatrix)}</div></article></section>
      <section class="model-registry section">${F.models.map((item) => `<article class="panel model-card"><div class="panel-header"><div><span class="knowledge-kind">${esc(item.id)} · v${esc(item.version)}</span><h2 class="mb-0">${esc(item.name)}</h2></div><span class="badge ${item.status === "evaluated" ? "badge-success" : "badge-warning"}">${esc(item.status)}</span></div><div class="panel-body stack"><div class="model-facts"><span><small>Task</small><strong>${esc(item.task)}</strong></span><span><small>Algorithm</small><strong>${esc(item.algorithm)}</strong></span><span><small>Dataset</small><strong>${esc(item.dataset)}</strong></span><span><small>Artifact</small><strong>${esc(item.size || "—")}</strong></span></div><p class="model-parameters"><strong>Configuration</strong><span>${esc(item.parameters || item.scope)}</span></p><div class="model-metrics">${Object.entries(item.metrics).map(([key,value]) => `<span><small>${esc(key)}</small><strong>${esc(value)}</strong></span>`).join("")}</div><div class="cluster"><button class="btn btn-sm" data-demo-action="model-card">${icon("file")} Model card</button><button class="btn btn-sm btn-ghost" data-demo-action="compare-model">${icon("compare")} Compare runs</button></div></div></article>`).join("")}</section>
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">Training runs</h2><small>Model definition, execution, artifact and evaluation remain separate</small></div><span class="badge">${F.trainingRuns.length} demonstration runs</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Run</th><th>Model</th><th>Dataset</th><th>Seed</th><th>Duration</th><th>Best metric</th><th>Artifact</th><th>Status</th></tr></thead><tbody>${F.trainingRuns.map((item) => `<tr><td><code>${esc(item.id)}</code><small class="block">${esc(item.created)}</small></td><td>${esc(item.model)}</td><td>${esc(item.dataset)}</td><td>${item.seed}</td><td>${esc(item.duration)}</td><td><strong>${esc(item.bestMetric)}</strong></td><td><code>${esc(item.artifact)}</code></td><td><span class="badge ${item.status === "completed" ? "badge-success" : "badge-warning"}">${esc(item.status)}</span></td></tr>`).join("")}</tbody></table></div></section>
      <section class="grid grid-3 section">${[["Grouped validation","Keep samples from the same experiment out of both train and test"],["Baseline comparison","Compare every model with a deterministic or statistical baseline"],["Applicability","Show missing inputs, domain coverage and uncertainty with every prediction"]].map(([title,text]) => `<div class="panel"><div class="panel-body"><div class="check-row">${icon("check")}<span><strong>${title}</strong><small>${text}</small></span></div></div></div>`).join("")}</section>`;
    bindDemoActions(root, icon);
  }

  function renderPredictions(root, {icon, esc}) {
    root.innerHTML = `<section class="panel"><div class="panel-header"><div><h2 class="mb-0">Prediction review</h2><small>Predictions never replace observations and always carry model and dataset provenance</small></div><span class="badge badge-accent">Demonstration only</span></div><div class="table-wrap"><table class="table-dense"><thead><tr><th>Sample</th><th>Prediction</th><th>Observed</th><th>Residual</th><th>Input coverage</th><th>Review</th></tr></thead><tbody>${F.predictions.map((item) => `<tr><td><button class="table-link" data-prediction="${esc(item.id)}">${esc(item.sample)}</button><small class="block"><code>${esc(item.id)}</code></small></td><td><strong>${item.predicted.toFixed(2)} ± ${item.uncertainty.toFixed(2)}%</strong></td><td>${item.observed.toFixed(2)}%</td><td>${(item.observed-item.predicted).toFixed(2)} pp</td><td>${item.coverage}%</td><td><span class="badge ${item.status === "reviewed" ? "badge-success" : "badge-warning"}">${esc(item.status)}</span></td></tr>`).join("")}</tbody></table></div></section><div class="grid grid-2 section"><section class="panel"><div class="panel-header"><div><h2 class="mb-0">Prediction provenance</h2><small id="prediction-subtitle">Select a sample to inspect the complete record</small></div>${icon("database")}</div><div class="panel-body" id="prediction-inspector">${predictionInspector(F.predictions[0], {icon,esc})}</div></section><section class="panel"><div class="panel-header"><div><h2 class="mb-0">Scientific output classes</h2><small>Measurement, calculation, prediction and interpretation stay distinct</small></div>${icon("layers")}</div><div class="panel-body output-class-list">${F.outputTypes.map((item) => `<article><span class="output-type output-${esc(item.type)}">${esc(item.label)}</span><span><small>Initial state</small><strong>${esc(item.review)}</strong></span><span><small>Required evidence</small><strong>${esc(item.evidence)}</strong></span></article>`).join("")}</div></section></div><div class="notice notice-warning section"><div>${icon("warning")}</div><div><strong>Never present a prediction as an experimental result</strong><p>Observed value, model output, uncertainty, applicability and human review state remain visible together.</p></div></div>`;
    root.querySelectorAll("[data-prediction]").forEach((button) => button.addEventListener("click", () => {
      const item = F.predictions.find((candidate) => candidate.id === button.dataset.prediction);
      root.querySelector("#prediction-inspector").innerHTML = predictionInspector(item,{icon,esc});
      root.querySelector("#prediction-subtitle").textContent = `${item.sample} · ${item.model}`;
    }));
  }

  function predictionInspector(item, {icon, esc}) {
    return `<div class="prediction-card"><div class="prediction-value"><small>Predicted PCE</small><strong>${item.predicted.toFixed(2)} ± ${item.uncertainty.toFixed(2)}%</strong><span>Observed: ${item.observed.toFixed(2)}%</span></div><dl><div><dt>Model version</dt><dd>${esc(item.model)}</dd></div><div><dt>Dataset snapshot</dt><dd>${esc(item.dataset)}</dd></div><div><dt>Input coverage</dt><dd>${item.coverage}%</dd></div><div><dt>Human review</dt><dd>${esc(item.status)}</dd></div></dl><div class="notice ${item.status === "reviewed" ? "notice-success" : "notice-warning"}"><div>${icon(item.status === "reviewed" ? "check" : "warning")}</div><div><strong>${item.status === "reviewed" ? "Reviewed prediction" : "Review required"}</strong><p>${esc(item.note)}</p></div></div></div>`;
  }

  function bindDemoActions(root, icon) {
    root.querySelectorAll("[data-demo-action]").forEach((button) => button.addEventListener("click", () => {
      const target = button.closest(".panel, article") || button.parentElement;
      if (target.querySelector(".demo-action-result")) return;
      target.insertAdjacentHTML("beforeend", `<div class="notice notice-success demo-action-result"><div>${icon("check")}</div><div><strong>Preview only</strong><p>This demonstrates the future contract. No dataset, model or file is created and reload restores the default state.</p></div></div>`);
    }));
  }

  function renderBase({root, header, icon, esc}) {
    Log.info("page.render", { page: "knowledge" });
    const query = new URLSearchParams(location.search);
    const requested = query.get("q");
    const initial = requested ? "knowledge" : ["knowledge","datasets","models","predictions"].includes(query.get("view")) ? query.get("view") : "knowledge";
    root.innerHTML = header("AI & Models", "One simple workspace for evidence-led knowledge, reproducible datasets, model history and reviewed predictions.", `<a class="btn" href="project.html?project=PRJ-2026-014&step=analysis-report">${icon("chart")} Open current project</a><button class="btn btn-primary" data-ai-open="datasets">${icon("database")} Inspect AI readiness</button>`, {eyebrow:"Knowledge and predictive foundation"}) + `<section class="ai-principles"><article><span>01</span><div><strong>Simple for the researcher</strong><p>AI capabilities stay contextual and use the same project, experiment and report flow.</p></div></article><article><span>02</span><div><strong>Ready by construction</strong><p>Stable identifiers, units, provenance and snapshots prepare data for RAG, ML and DL.</p></div></article><article><span>03</span><div><strong>Human controlled</strong><p>Predictions and suggestions remain separate from measurements and approved conclusions.</p></div></article></section><nav class="tabs ai-foundation-tabs" aria-label="AI and models sections">${[["knowledge","Knowledge Assistant","book"],["datasets","Datasets","database"],["models","Models","chart"],["predictions","Predictions","spark"]].map(([id,label,ico]) => `<button class="tab" type="button" data-ai-view="${id}">${icon(ico)} ${label}</button>`).join("")}</nav><div id="ai-foundation-content"></div>`;
    const content = root.querySelector("#ai-foundation-content");
    const renderers = {knowledge:() => renderKnowledge(content,requested,{icon,esc}),datasets:() => renderDatasets(content,{icon,esc}),models:() => renderModels(content,{icon,esc}),predictions:() => renderPredictions(content,{icon,esc})};
    function show(view) {
      Log.info("view.changed", { view });
      root.querySelectorAll("[data-ai-view]").forEach((button) => { const active=button.dataset.aiView===view; button.classList.toggle("active",active); button.setAttribute("aria-current",active?"page":"false"); });
      renderers[view]();
      const url = new URL(location.href);
      if (view !== "knowledge") url.searchParams.set("view",view); else url.searchParams.delete("view");
      if (view !== "knowledge") url.searchParams.delete("q");
      if (location.protocol !== "file:") history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
      else Log.debug("history.file-url-preserved", { view });
    }
    root.querySelectorAll("[data-ai-view]").forEach((button) => button.addEventListener("click", () => show(button.dataset.aiView)));
    root.querySelector("[data-ai-open]")?.addEventListener("click", (event) => show(event.currentTarget.dataset.aiOpen));
    show(initial);
  }

  window.LabFlowKnowledgePages = {renderBase};
})();
