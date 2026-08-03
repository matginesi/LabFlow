(function () {
  "use strict";

  const D = window.LabFlowData;
  const sources = ["Experiments", "Processes", "Materials", "Results", "Documents and SOPs"];
  const savedViews = D.savedViews.map((item) => ({...item}));

  const evidence = {
    sop: {id:"KB-SOP-014", type:"SOP", title:"Perovskite precursor preparation", detail:"Section 4.2 · approved v4.2", confidence:"High"},
    process: {id:"PROC-CHOSE-V2", type:"Process", title:"CHOSE Standard", detail:"Version 2 · annealing step", confidence:"High"},
    experiments: {id:"EXP-041-067", type:"Experiments", title:"EXP-041, EXP-052 and EXP-067", detail:"8 samples · 18 declared measurements", confidence:"High"},
    measurements: {id:"JV-B03", type:"Results", title:"JV measurement cohort", detail:"24 imported rows · PCE, Voc, Jsc and FF", confidence:"High"},
    note: {id:"KB-NOTE-032", type:"Research note", title:"Recurring low-fill-factor signatures", detail:"Working note · researcher review required", confidence:"Medium"},
    solution: {id:"SOL-011", type:"Material / solution", title:"FA/MA 1.25 M reference", detail:"DMF:DMSO 4:1 · linked batches B01–B06", confidence:"High"}
  };

  const responses = {
    analytical: {
      capability:"Ask · Compare", route:"Structured query + deterministic aggregation; interpretation added after calculation",
      question:"Compare the experiments that use DMSO.",
      answer:"All three project experiments use the DMF:DMSO solvent system. EXP-052 has the strongest measured cohort: median PCE 20.50%, range 19.90–21.10%. EXP-067 includes the best device, S08 at 21.28%, but has three comparability issues that must remain visible.",
      evidence:[evidence.experiments,evidence.measurements,evidence.solution], experiments:["EXP-041","EXP-052","EXP-067"],
      rows:[["EXP-041","3","19.15–20.16%","100 °C","Comparable"],["EXP-052","2","19.90–21.10%","105 °C","Comparable"],["EXP-067","3","17.36–21.28%","100 (unit missing)","Review"]],
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

  function savedViewMarkup(item, esc) {
    return `<div class="saved-view-item" data-saved-view="${esc(item.id)}"><button type="button" data-open-view="${esc(item.id)}"><strong>${esc(item.name)}</strong><small>${esc(item.criteria)}</small></button><span class="badge">${item.count}</span><button class="btn btn-ghost icon-btn" type="button" data-rename-view="${esc(item.id)}" aria-label="Rename ${esc(item.name)}">✎</button><button class="btn btn-ghost icon-btn" type="button" data-delete-view="${esc(item.id)}" aria-label="Delete ${esc(item.name)}">×</button></div>`;
  }

  function classify(question) {
    const value = question.toLowerCase();
    if (/inspect|missing|quality|nomad|ready|issue|anomal/.test(value)) return responses.inspect;
    if (/stack|contain|connect|linked|sn[o₂o2]/.test(value)) return responses.relationship;
    if (/compare|pce|result|experiment|dmso|above|greater/.test(value)) return responses.analytical;
    return responses.knowledge;
  }

  function renderBase({root, header, icon, esc}) {
    let activeResponse = responses.analytical;
    const activeSources = new Set(sources);
    root.innerHTML = header("Ask LabFlow", "Ask laboratory questions, inspect data quality and prepare traceable work from one evidence-led assistant.", `<button class="btn" data-knowledge-capability="inspect">${icon("check")} Inspect EXP-067</button><a class="btn btn-primary" href="project.html?project=PRJ-2026-014&step=ingest">${icon("upload")} Prepare import</a>`) + `
      <section class="summary-strip summary-strip-three capability-strip" aria-label="Lab Assistant capabilities">${[["Ask","Find answers across laboratory knowledge and data","search"],["Inspect","Check quality, consistency and provenance","check"],["Prepare","Preview imports, comparisons, reports and exports","file"]].map(([title,text,ico]) => `<div class="summary-item">${icon(ico)}<span><strong>${title}</strong><small>${text}</small></span></div>`).join("")}</section>
      <div class="knowledge-workspace">
        <aside class="panel knowledge-controls"><div class="panel-header"><div><h3 class="mb-0">Search scope</h3><small>Choose context, not retrieval technology</small></div></div><div class="panel-body stack"><div class="field"><label for="knowledge-scope">Search in</label><select class="select" id="knowledge-scope"><option>Current experiment</option><option>Current project</option><option selected>Current workspace</option><option>All accessible data</option></select></div><fieldset class="source-toggles"><legend>Sources</legend>${sources.map((source) => `<label class="check-row"><input type="checkbox" value="${esc(source)}" checked><span>${esc(source)}</span></label>`).join("")}</fieldset><div class="notice"><div>${icon("info")}</div><div><strong>Automatic routing</strong><p>LabFlow selects documents, structured data, relationships or deterministic analyses internally.</p></div></div></div><div class="panel-header saved-header"><div><h3 class="mb-0">Saved views</h3><small>Session only · reset on reload</small></div></div><div class="saved-view-list" id="saved-view-list">${savedViews.map((item) => savedViewMarkup(item, esc)).join("")}</div></aside>
        <main class="panel knowledge-conversation"><div class="panel-header"><div><h3 class="mb-0">Conversation</h3><small id="knowledge-route">${esc(activeResponse.route)}</small></div><span class="badge badge-success">No automatic writes</span></div><div class="panel-body" id="knowledge-answer">${answerMarkup(activeResponse,{icon,esc})}</div><form class="knowledge-composer" id="knowledge-form"><div class="prompt-chips">${["How is the standard solution prepared?","Which stacks contain SnO₂?","Compare experiments using DMSO","Inspect EXP-067 for NOMAD"].map((prompt) => `<button type="button" class="prompt-chip" data-knowledge-prompt="${esc(prompt)}">${esc(prompt)}</button>`).join("")}</div><div class="input-group"><textarea class="textarea" id="knowledge-question" rows="2" placeholder="Ask about SOPs, processes, experiments, results or relationships…"></textarea><button class="btn btn-primary" type="submit">${icon("spark")} Ask LabFlow</button></div><small id="source-summary">Current workspace · ${sources.length} source types enabled</small></form></main>
        <aside class="panel knowledge-evidence" id="knowledge-evidence" aria-label="Evidence panel">${evidencePanel(activeResponse,{icon,esc})}</aside>
      </div>
      <section class="panel section" id="quality-section"><div class="panel-header"><div><h2 class="mb-0">Experiment Inspector · EXP-067</h2><small>Deterministic checks are separated from interpretation of ambiguous text</small></div><div class="cluster"><span class="badge badge-danger">1 error</span><span class="badge badge-warning">2 warnings</span><span class="badge">1 suggestion</span></div></div><div class="panel-body"><div class="validation-list">${D.validationIssues.map((item) => issueMarkup(item,icon,esc)).join("")}</div><div class="proposed-action-inline"><div><span class="badge badge-accent">Prepare</span><strong>NOMAD readiness: preview allowed, submission blocked</strong><small>Resolve DQ-001, DQ-002 and DQ-003 before final submission.</small></div><a class="btn" href="project.html?project=PRJ-2026-014&step=export">Review export</a></div></div></section>
      <section class="panel section"><div class="panel-header"><div><h2 class="mb-0">Cross-experiment comparison</h2><small>Selection criteria and comparability remain explicit</small></div><button class="btn btn-sm" data-proposed-action="comparison">Review comparison</button></div><div class="panel-body comparison-summary"><div><span>Included</span><strong>EXP-041 · EXP-052 · EXP-067</strong></div><div><span>Metrics</span><strong>PCE · Voc · Jsc · FF</strong></div><div><span>Selection</span><strong>Uses DMSO · current project</strong></div><div><span>Comparability</span><strong class="text-warning">Limited by 3 metadata issues</strong></div></div></section>`;

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
      root.querySelector("[data-confirm-preview]").onclick = (event) => { event.target.closest(".proposed-action-preview").innerHTML = `<div class="notice notice-success"><div>${icon("check")}</div><div><strong>Preview confirmed</strong><p>The demonstration is in memory only and reload will restore defaults.</p></div></div>`; };
    }
    function renderSavedViews() {
      root.querySelector("#saved-view-list").innerHTML = savedViews.length ? savedViews.map((item) => savedViewMarkup(item,esc)).join("") : `<div class="empty"><strong>No saved views</strong><p>Save a useful query to reopen it during this session.</p></div>`;
      root.querySelectorAll("[data-open-view]").forEach((button) => button.onclick = () => setResponse(classify(savedViews.find((item) => item.id === button.dataset.openView).name)));
      root.querySelectorAll("[data-delete-view]").forEach((button) => button.onclick = () => { savedViews.splice(savedViews.findIndex((item) => item.id === button.dataset.deleteView),1); renderSavedViews(); });
      root.querySelectorAll("[data-rename-view]").forEach((button) => button.onclick = () => { const item=savedViews.find((view)=>view.id===button.dataset.renameView); item.name=`${item.name} · edited`; renderSavedViews(); });
    }
    root.querySelector("#knowledge-form").addEventListener("submit", (event) => { event.preventDefault(); const question=root.querySelector("#knowledge-question").value.trim(); if (question) setResponse(classify(question),question); });
    root.querySelectorAll("[data-knowledge-prompt]").forEach((button) => button.onclick = () => { root.querySelector("#knowledge-question").value=button.dataset.knowledgePrompt; setResponse(classify(button.dataset.knowledgePrompt),button.dataset.knowledgePrompt); });
    root.querySelector("[data-knowledge-capability]")?.addEventListener("click", () => { setResponse(responses.inspect); root.querySelector("#quality-section").scrollIntoView({behavior:"smooth",block:"start"}); });
    root.querySelectorAll(".source-toggles input").forEach((input) => input.addEventListener("change", () => { input.checked ? activeSources.add(input.value) : activeSources.delete(input.value); root.querySelector("#source-summary").textContent=`${root.querySelector("#knowledge-scope").value} · ${activeSources.size} source types enabled`; }));
    renderSavedViews();
    bindDynamic();
    const requested = new URLSearchParams(location.search).get("q");
    if (requested) { root.querySelector("#knowledge-question").value=requested; setResponse(classify(requested),requested); }
  }

  window.LabFlowKnowledgePages = {renderBase};
})();
