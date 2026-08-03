(function () {
  "use strict";
  const E = window.LabFlowExport;
  const Log = window.LabFlowLogger?.child("tools") || {debug(){},info(){},warn(){},error(){}};
  const textState = {
    txt:{name:"notes.txt",content:"Experiment notes\n\nRecord observations here. Nothing is retained after reload."},
    markdown:{name:"research-note.md",content:"# Research note\n\n## Observation\n\nThe leading sample remains **S08**.\n\n- Review process metadata\n- Link the JV protocol"},
    latex:{name:"research-note.tex",content:"\\documentclass{article}\n\\title{Perovskite experiment note}\n\\author{Matteo Ginesi}\n\n\\begin{document}\n\\maketitle\n\n\\section{Observation}\nSample \\textbf{S08} remains the leading device.\n\n\\subsection{Result}\n\\[\\eta = 21.28\\,\\%\\]\n\n\\begin{itemize}\n  \\item Review process metadata\n  \\item Link the JV protocol\n\\end{itemize}\n\\end{document}\n"},
    yaml:{name:"metadata.yaml",content:"project: PRJ-2026-014\nstatus: review\nmeasurements:\n  - type: JV\n    unit: percent\n"},
    json:{name:"measurement.json",content:'{\n  "sample": "S08",\n  "pce": 21.28,\n  "reviewed": true\n}\n'}
  };
  let workbook = [
    {name:"Samples",rows:[["Sample","PCE (%)","Status"],["S04","21.10","Review"],["S08","21.28","Lead"]]},
    {name:"Metadata",rows:[["Field","Value"],["Project","PRJ-2026-014"],["Method","JV summary"]]}
  ];
  let activeSheet = 0;
  const docxState = {title:"Laboratory working note",subtitle:"Evidence-linked draft",body:"# Objective\nDocument the current comparison without changing source data.\n\n## Findings\nS08 leads the included demonstration dataset.\n\n## Next action\nReview missing process metadata."};
  const diagramState = {name:"evidence-flow.svg",content:"flowchart TD\n  A[Research question] --> B[Evidence route]\n  B --> C{Review required}\n  C --> D[Approved finding]\n  D --> E[Report and export]"};

  function downloadText(content, name, type) {
    E.download(new Blob([content], {type}), name);
  }

  function markdown(value, esc) {
    return esc(value).split(/\r?\n/).map((line) => {
      if (/^###\s/.test(line)) return `<h3>${line.slice(4)}</h3>`;
      if (/^##\s/.test(line)) return `<h2>${line.slice(3)}</h2>`;
      if (/^#\s/.test(line)) return `<h1>${line.slice(2)}</h1>`;
      if (/^-\s/.test(line)) return `<div class="markdown-list">• ${line.slice(2)}</div>`;
      const inline = line.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>");
      return line ? `<p>${inline}</p>` : "";
    }).join("");
  }

  function latex(value, esc) {
    const inline = (line) => esc(line).replace(/\\textbf\{([^{}]+)\}/g,"<strong>$1</strong>").replace(/\\(?:textit|emph)\{([^{}]+)\}/g,"<em>$1</em>");
    let inList = false;
    return value.split(/\r?\n/).flatMap((raw) => {
      const line = raw.trim(); const output = [];
      if (!line || /^%(?!%)/.test(line) || /^\\(?:documentclass|usepackage|begin\{document\}|end\{document\})/.test(line)) return [];
      const title = line.match(/^\\title\{(.+)\}$/); if (title) return `<h1>${inline(title[1])}</h1>`;
      const author = line.match(/^\\author\{(.+)\}$/); if (author) return `<p class="latex-author">${inline(author[1])}</p>`;
      if (line === "\\maketitle") return [];
      const section = line.match(/^\\section\{(.+)\}$/); if (section) return `<h2>${inline(section[1])}</h2>`;
      const subsection = line.match(/^\\subsection\{(.+)\}$/); if (subsection) return `<h3>${inline(subsection[1])}</h3>`;
      if (line === "\\begin{itemize}") { inList = true; return '<div class="latex-list">'; }
      if (line === "\\end{itemize}") { inList = false; return "</div>"; }
      const item = line.match(/^\\item\s+(.+)$/); if (item) return `<div>• ${inline(item[1])}</div>`;
      const equation = line.match(/^\\\[(.*)\\\]$/); if (equation) return `<div class="latex-equation">${esc(equation[1])}</div>`;
      output.push(`<p${inList ? ' class="latex-list-copy"' : ""}>${inline(line)}</p>`); return output;
    }).join("");
  }

  function yamlCheck(value) {
    const lines = value.split(/\r?\n/); const issues = [];
    lines.forEach((line,index) => {
      if (line.includes("\t")) issues.push(`Line ${index + 1}: replace tabs with spaces`);
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("-") && !trimmed.includes(":")) issues.push(`Line ${index + 1}: expected a key/value separator`);
      if ((line.match(/^ */)?.[0].length || 0) % 2) issues.push(`Line ${index + 1}: use two-space indentation`);
    });
    return issues;
  }

  function latexCheck(value) {
    let depth = 0;
    for (const char of value.replace(/\\[{}]/g,"")) { if (char === "{") depth += 1; if (char === "}") depth -= 1; if (depth < 0) return "Closing brace without a matching opening brace"; }
    if (depth) return `${depth} unclosed brace${depth === 1 ? "" : "s"}`;
    const environments = [];
    for (const match of value.matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
      if (match[1] === "begin") environments.push(match[2]);
      else if (environments.pop() !== match[2]) return `Environment ${match[2]} closes out of order`;
    }
    return environments.length ? `Environment ${environments.at(-1)} is not closed` : "";
  }

  function editorStage(type, ctx) {
    const {icon,esc} = ctx; const state = textState[type];
    const labels = {txt:["Plain text","Distraction-free notes"],markdown:["Markdown","Write and preview"],latex:["LaTeX","Scientific source and preview"],yaml:["YAML","Metadata-aware text"],json:["JSON","Format and validate"]};
    return `<section class="tool-stage"><div class="tool-stage-head"><div><span class="knowledge-kind">${labels[type][0]}</span><h2>${labels[type][1]}</h2></div><div class="cluster"><label class="btn btn-sm" for="tool-file-input">${icon("upload")} Open local file</label><input class="sr-only" id="tool-file-input" type="file" accept=".${type === "markdown" ? "md" : type === "latex" ? "tex" : type},text/plain"><button class="btn btn-primary btn-sm" id="tool-download">${icon("download")} Download</button></div></div>
      <div class="tool-document-bar"><input class="input" id="tool-filename" value="${esc(state.name)}" aria-label="File name"><span id="tool-stats">0 words · 0 characters</span><span class="toolbar-spacer"></span>${type === "json" ? '<button class="btn btn-sm" id="json-format">Format</button><button class="btn btn-sm" id="json-minify">Minify</button>' : ""}${["yaml","json","latex"].includes(type) ? '<button class="btn btn-sm" id="tool-validate">Validate</button>' : ""}</div>
      <div class="editor-split ${type === "txt" || type === "yaml" || type === "json" ? "single" : ""}"><div class="code-editor"><span class="editor-gutter" id="editor-gutter"></span><textarea id="tool-editor" spellcheck="false" aria-label="${labels[type][0]} editor">${esc(state.content)}</textarea></div>${type === "markdown" ? `<article class="markdown-preview" id="markdown-preview">${markdown(state.content,esc)}</article>` : type === "latex" ? `<article class="markdown-preview latex-preview" id="latex-preview" aria-label="LaTeX structural preview">${latex(state.content,esc)}</article>` : ""}</div>
      <div class="tool-status" id="tool-status" role="status"><span class="status-dot"></span><span>Ready · content exists only on this page</span></div></section>`;
  }

  function spreadsheetStage(ctx) {
    const {icon,esc} = ctx; const current = workbook[activeSheet];
    const rows = Array.from({length:Math.max(10,current.rows.length)},(_,r) => Array.from({length:Math.max(7,...current.rows.map(row=>row.length))},(_,c) => current.rows[r]?.[c] ?? ""));
    return `<section class="tool-stage"><div class="tool-stage-head"><div><span class="knowledge-kind">Workbook</span><h2>Spreadsheet with sheets</h2></div><div class="cluster"><button class="btn btn-sm" id="sheet-add">${icon("plus")} Add sheet</button><button class="btn btn-primary btn-sm" id="xlsx-download">${icon("download")} Download XLSX</button></div></div>
      <div class="tool-document-bar"><label for="sheet-name">Sheet name</label><input class="input" id="sheet-name" value="${esc(current.name)}"><span class="toolbar-spacer"></span><button class="btn btn-sm btn-danger" id="sheet-delete" ${workbook.length === 1 ? "disabled" : ""}>Delete sheet</button></div>
      <div class="sheet-wrap"><table class="sheet-grid"><thead><tr><th></th>${rows[0].map((_,index) => `<th>${String.fromCharCode(65+index)}</th>`).join("")}</tr></thead><tbody>${rows.map((values,rowIndex) => `<tr><th>${rowIndex+1}</th>${values.map((value,colIndex) => `<td><input value="${esc(value)}" data-cell-row="${rowIndex}" data-cell-col="${colIndex}" aria-label="Cell ${String.fromCharCode(65+colIndex)}${rowIndex+1}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <div class="sheet-tabs" role="tablist">${workbook.map((sheet,index) => `<button type="button" role="tab" aria-selected="${index===activeSheet}" class="${index===activeSheet?"active":""}" data-sheet-index="${index}">${esc(sheet.name)}</button>`).join("")}</div><div class="tool-status" role="status"><span class="status-dot"></span><span>${workbook.length} sheets · editable cells · local XLSX export</span></div></section>`;
  }

  function docxStage(ctx) {
    const {icon,esc} = ctx;
    return `<section class="tool-stage"><div class="tool-stage-head"><div><span class="knowledge-kind">Word document</span><h2>Editable DOCX composer</h2></div><button class="btn btn-primary btn-sm" id="docx-download">${icon("download")} Download DOCX</button></div><div class="docx-workbench"><div class="docx-fields"><div class="field"><label for="docx-title">Title</label><input class="input" id="docx-title" value="${esc(docxState.title)}"></div><div class="field"><label for="docx-subtitle">Subtitle</label><input class="input" id="docx-subtitle" value="${esc(docxState.subtitle)}"></div><div class="field"><label for="docx-body">Document body</label><textarea class="textarea docx-editor" id="docx-body">${esc(docxState.body)}</textarea><small>Use # and ## for Word heading styles.</small></div></div><article class="docx-paper" id="docx-preview"><small>LABFLOW WORKING DOCUMENT</small><h1>${esc(docxState.title)}</h1><p class="lead">${esc(docxState.subtitle)}</p>${markdown(docxState.body,esc)}</article></div><div class="tool-status" role="status"><span class="status-dot"></span><span>Native editable Word package · no screenshot conversion</span></div></section>`;
  }

  function diagramStage(ctx) {
    const {icon,esc} = ctx;
    return `<section class="tool-stage"><div class="tool-stage-head"><div><span class="knowledge-kind">Diagram Studio</span><h2>Local graphs and workflow diagrams</h2></div><div class="cluster"><button class="btn btn-sm" id="diagram-example">Load evidence example</button><button class="btn btn-primary btn-sm" id="diagram-download">${icon("download")} Download SVG</button></div></div><div class="tool-document-bar"><input class="input" id="diagram-filename" value="${esc(diagramState.name)}" aria-label="Diagram file name"><span>Flowchart subset · TD or LR · boxes, rounded nodes and decisions</span></div><div class="diagram-workbench"><div class="diagram-source"><label for="diagram-editor">Graph definition</label><textarea id="diagram-editor" spellcheck="false" aria-label="Diagram source">${esc(diagramState.content)}</textarea></div><div class="diagram-preview" id="diagram-preview" tabindex="0" aria-label="Scrollable diagram preview" aria-live="polite"></div></div><div class="tool-status" id="diagram-status" role="status"><span class="status-dot"></span><span>Rendered entirely in this page · no external graph service</span></div></section>`;
  }

  function bindText(type, stage, ctx) {
    const {toast,esc} = ctx; const state = textState[type]; const editor = stage.querySelector("#tool-editor");
    const refresh = () => {
      state.content = editor.value; state.name = stage.querySelector("#tool-filename").value || state.name;
      const words = editor.value.trim() ? editor.value.trim().split(/\s+/).length : 0;
      stage.querySelector("#tool-stats").textContent = `${words} words · ${editor.value.length} characters`;
      stage.querySelector("#editor-gutter").textContent = Array.from({length:editor.value.split("\n").length},(_,index)=>index+1).join("\n");
      if (type === "markdown") stage.querySelector("#markdown-preview").innerHTML = markdown(editor.value,esc);
      if (type === "latex") stage.querySelector("#latex-preview").innerHTML = latex(editor.value,esc);
    };
    editor.addEventListener("input",refresh); stage.querySelector("#tool-filename").addEventListener("input",refresh); refresh();
    stage.querySelector("#tool-file-input").addEventListener("change", async (event) => { const file=event.target.files[0]; if(!file)return; editor.value=await file.text(); stage.querySelector("#tool-filename").value=file.name; refresh(); toast(`${file.name} opened in page memory.`); });
    stage.querySelector("#tool-download").addEventListener("click", () => downloadText(editor.value,state.name,{txt:"text/plain",markdown:"text/markdown",latex:"application/x-tex",yaml:"text/yaml",json:"application/json"}[type]));
    stage.querySelector("#json-format")?.addEventListener("click", () => { try{editor.value=JSON.stringify(JSON.parse(editor.value),null,2)+"\n";refresh();toast("JSON formatted.");}catch(error){toast(`Invalid JSON: ${error.message}`,"error");} });
    stage.querySelector("#json-minify")?.addEventListener("click", () => { try{editor.value=JSON.stringify(JSON.parse(editor.value));refresh();toast("JSON minified.");}catch(error){toast(`Invalid JSON: ${error.message}`,"error");} });
    stage.querySelector("#tool-validate")?.addEventListener("click", () => { if(type==="json"){try{JSON.parse(editor.value);toast("Valid JSON.");}catch(error){toast(`Invalid JSON: ${error.message}`,"error");}}else if(type==="latex"){const issue=latexCheck(editor.value);toast(issue||"LaTeX structure check passed.",issue?"error":"success");}else{const issues=yamlCheck(editor.value);toast(issues.length?issues[0]:"YAML structure check passed.",issues.length?"error":"success");} });
  }

  function bindSpreadsheet(stage, rerender, ctx) {
    stage.querySelectorAll("[data-cell-row]").forEach((input) => input.addEventListener("input", () => {
      const row=Number(input.dataset.cellRow),col=Number(input.dataset.cellCol); const rows=workbook[activeSheet].rows;
      while(rows.length<=row)rows.push([]); while(rows[row].length<=col)rows[row].push(""); rows[row][col]=input.value;
    }));
    stage.querySelector("#sheet-name").addEventListener("input",event=>{workbook[activeSheet].name=event.target.value||`Sheet ${activeSheet+1}`;});
    stage.querySelectorAll("[data-sheet-index]").forEach(button=>button.addEventListener("click",()=>{activeSheet=Number(button.dataset.sheetIndex);rerender("spreadsheet");}));
    stage.querySelector("#sheet-add").addEventListener("click",()=>{workbook.push({name:`Sheet ${workbook.length+1}`,rows:[[""]]});activeSheet=workbook.length-1;rerender("spreadsheet");});
    stage.querySelector("#sheet-delete").addEventListener("click",()=>{if(workbook.length===1)return;workbook.splice(activeSheet,1);activeSheet=Math.max(0,activeSheet-1);rerender("spreadsheet");});
    stage.querySelector("#xlsx-download").addEventListener("click",()=>{E.download(E.genericWorkbook(workbook,ctx.getSettings().palette),"labflow-workbook.xlsx");ctx.toast(`XLSX generated with ${workbook.length} sheets.`);});
  }

  function bindDocx(stage, ctx) {
    const refresh=()=>{docxState.title=stage.querySelector("#docx-title").value;docxState.subtitle=stage.querySelector("#docx-subtitle").value;docxState.body=stage.querySelector("#docx-body").value;stage.querySelector("#docx-preview").innerHTML=`<small>LABFLOW WORKING DOCUMENT</small><h1>${ctx.esc(docxState.title)}</h1><p class="lead">${ctx.esc(docxState.subtitle)}</p>${markdown(docxState.body,ctx.esc)}`;};
    stage.querySelectorAll("input,textarea").forEach(control=>control.addEventListener("input",refresh));
    stage.querySelector("#docx-download").addEventListener("click",()=>{E.download(E.genericDocx(docxState,ctx.getSettings().palette),"labflow-working-document.docx");ctx.toast("Editable DOCX generated locally.");});
  }

  function bindDiagram(stage, ctx) {
    const editor = stage.querySelector("#diagram-editor");
    const preview = stage.querySelector("#diagram-preview");
    preview.setAttribute("role", "region");
    const refresh = () => {
      diagramState.content = editor.value;
      diagramState.name = stage.querySelector("#diagram-filename").value || "labflow-diagram.svg";
      preview.innerHTML = window.LabFlowDiagrams.render(diagramState.content, {label:"Research workflow diagram"});
    };
    editor.addEventListener("input", refresh);
    stage.querySelector("#diagram-filename").addEventListener("input", refresh);
    stage.querySelector("#diagram-example").addEventListener("click", () => {
      editor.value = "flowchart TD\n  A[Raw measurement] --> B[Deterministic check]\n  B --> C{Evidence complete}\n  C --> D[Researcher statement]\n  D --> E[AI suggestion]\n  E --> F[Human review]";
      refresh();
      ctx.toast("Evidence-flow example loaded.");
    });
    stage.querySelector("#diagram-download").addEventListener("click", () => {
      const svg = preview.querySelector("svg");
      if (!svg) return ctx.toast("Fix the diagram definition before downloading.", "error");
      const exported = svg.cloneNode(true);
      const theme = getComputedStyle(document.documentElement);
      const color = (token) => theme.getPropertyValue(token).trim();
      exported.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      exported.querySelectorAll(".diagram-node-shape").forEach((shape) => { shape.setAttribute("fill", color("--surface")); shape.setAttribute("stroke", color("--accent")); shape.setAttribute("stroke-width", "1.5"); });
      exported.querySelectorAll(".diagram-node text").forEach((text) => { text.setAttribute("fill", color("--text")); text.setAttribute("font-family", "system-ui, sans-serif"); text.setAttribute("font-size", "12"); text.setAttribute("font-weight", "650"); });
      exported.querySelectorAll(".diagram-edge").forEach((edge) => { edge.setAttribute("fill", "none"); edge.setAttribute("stroke", color("--muted")); edge.setAttribute("stroke-width", "1.6"); });
      exported.querySelectorAll(".diagram-arrow").forEach((arrow) => arrow.setAttribute("fill", color("--muted")));
      const source = `<?xml version="1.0" encoding="UTF-8"?>\n${exported.outerHTML}`;
      downloadText(source, diagramState.name.endsWith(".svg") ? diagramState.name : `${diagramState.name}.svg`, "image/svg+xml");
      ctx.toast("Editable SVG diagram generated locally.");
    });
    refresh();
  }

  function render(ctx) {
    const {root,header,icon} = ctx;
    Log.info("page.render", { page: "tools" });
    const tools=[
      ["txt","TXT editor","Plain notes","text","Write"],["markdown","Markdown","Live preview","markdown","Write"],["latex","LaTeX","Scientific source","formula","Write"],
      ["yaml","YAML","Metadata check","hierarchy","Structure"],["json","JSON","Format & validate","braces","Structure"],["spreadsheet","Spreadsheet","Workbook sheets","table","Structure"],
      ["diagram","Diagrams","Graphs and workflows","diagram","Visualise"],["docx","DOCX","Editable document","file","Publish"]
    ];
    const groups = [...new Set(tools.map((tool) => tool[4]))];
    root.innerHTML=header("Tools","Create, inspect and publish common research artifacts locally. Every workspace is functional and resets when the page reloads.",`<a class="btn btn-primary" href="tools.html?tool=diagram">${icon("diagram")} Open Diagram Studio</a><span class="badge badge-success">No upload · no persistence</span>`)+`<section class="summary-strip summary-strip-three capability-strip" aria-label="Tool capabilities"><div class="summary-item">${icon("edit")}<span><strong>Write</strong><small>Text, Markdown and scientific source</small></span></div><div class="summary-item">${icon("hierarchy")}<span><strong>Structure</strong><small>Validate metadata and tabular data</small></span></div><div class="summary-item">${icon("diagram")}<span><strong>Visualise and publish</strong><small>Render SVG diagrams and editable documents</small></span></div></section><h2 class="sr-only">Local research tools</h2><div class="tools-layout"><aside class="panel tools-rail" aria-label="Tool selection"><div class="panel-header"><div><h3 class="mb-0">Research workbench</h3><small>Eight focused local tools</small></div></div><nav aria-label="Available tools">${groups.map((group) => `<span class="tool-group-label">${group}</span>${tools.filter((tool) => tool[4] === group).map(([id,name,detail,ico],index)=>`<button type="button" class="tool-switch ${id === "txt" ? "active" : ""}" data-tool-switch="${id}"><span class="object-icon">${icon(ico)}</span><span><strong>${name}</strong><small>${detail}</small></span>${icon("arrow")}</button>`).join("")}`).join("")}</nav><div class="tools-privacy"><strong>Page memory only</strong><p>Files stay on your device. Reload clears every edit and returns the checked-in examples.</p></div></aside><div id="tool-workspace"></div></div>`;
    const requested=new URLSearchParams(location.search).get("tool");
    const reloaded=performance.getEntriesByType?.("navigation")?.[0]?.type==="reload";
    let active=!reloaded&&tools.some(([id])=>id===requested)?requested:"txt";
    const rerender=(type)=>{active=type;Log.info("tool.changed", { tool: type });root.querySelectorAll("[data-tool-switch]").forEach(button=>button.classList.toggle("active",button.dataset.toolSwitch===type));const workspace=root.querySelector("#tool-workspace");workspace.innerHTML=type==="spreadsheet"?spreadsheetStage(ctx):type==="docx"?docxStage(ctx):type==="diagram"?diagramStage(ctx):editorStage(type,ctx);const stage=workspace.firstElementChild;if(type==="spreadsheet")bindSpreadsheet(stage,rerender,ctx);else if(type==="docx")bindDocx(stage,ctx);else if(type==="diagram")bindDiagram(stage,ctx);else bindText(type,stage,ctx);};
    root.querySelectorAll("[data-tool-switch]").forEach(button=>button.addEventListener("click",()=>rerender(button.dataset.toolSwitch)));rerender(active);
  }

  window.LabFlowToolsPage={render};
})();
