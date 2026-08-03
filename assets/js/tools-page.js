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
  const DIAGRAM_TEMPLATES = {
    evidence:{name:"Evidence review",file:"evidence-review.svg",content:"flowchart TD\n  A[Research question] --> B[Evidence route]\n  B --> C{Review required}\n  C -->|approved| D[Approved finding]\n  C -.->|missing evidence| E[Return to records]\n  D ==> F[[Report and export]]"},
    experiment:{name:"Experiment workflow",file:"experiment-workflow.svg",content:"flowchart LR\n  A([Prepare materials]) --> B[Run process] --> C[Collect measurements]\n  C --> D{Quality passed}\n  D -->|yes| E[[Analysis and report]]\n  D -.->|no| F[Review protocol]\n  F --> B"},
    dataset:{name:"Dataset lifecycle",file:"dataset-lifecycle.svg",content:"flowchart LR\n  A[Collect assets] --> B[Validate provenance] --> C{Labels complete}\n  C -->|yes| D[[Freeze dataset snapshot]]\n  C -.->|no| E([Annotation queue])\n  E --> C\n  D ==> F((Model run))"},
    decision:{name:"Decision branch",file:"decision-branch.svg",content:"flowchart TD\n  A[Incoming result] --> B{Within expected range}\n  B -->|yes| C([Accept for review])\n  B -.->|no| D[Inspect raw evidence]\n  D --> E{Instrument issue}\n  E -->|yes| F[Repeat measurement]\n  E -->|no| G[[Document scientific exception]]"}
  };
  const diagramState = {name:DIAGRAM_TEMPLATES.evidence.file,content:DIAGRAM_TEMPLATES.evidence.content,zoom:1,fit:true};

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

  function readBraced(source, start) {
    if (source[start] !== "{") return null;
    let depth = 0;
    for (let index = start; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (!depth) return {value:source.slice(start + 1,index),end:index + 1};
    }
    return null;
  }

  function renderMath(source, esc) {
    const symbols = {
      alpha:"α",beta:"β",gamma:"γ",delta:"δ",epsilon:"ε",varepsilon:"ε",zeta:"ζ",eta:"η",theta:"θ",vartheta:"ϑ",iota:"ι",kappa:"κ",lambda:"λ",mu:"μ",nu:"ν",xi:"ξ",pi:"π",rho:"ρ",sigma:"σ",tau:"τ",upsilon:"υ",phi:"φ",varphi:"ϕ",chi:"χ",psi:"ψ",omega:"ω",
      Gamma:"Γ",Delta:"Δ",Theta:"Θ",Lambda:"Λ",Xi:"Ξ",Pi:"Π",Sigma:"Σ",Phi:"Φ",Psi:"Ψ",Omega:"Ω",
      times:"×",cdot:"·",pm:"±",mp:"∓",le:"≤",leq:"≤",ge:"≥",geq:"≥",neq:"≠",approx:"≈",sim:"∼",propto:"∝",infty:"∞",partial:"∂",nabla:"∇",sum:"∑",prod:"∏",int:"∫",rightarrow:"→",leftarrow:"←",leftrightarrow:"↔",Rightarrow:"⇒",Leftarrow:"⇐",degree:"°"
    };
    const spacing = new Set([",",";",":","!","quad","qquad"]);
    let html = "";
    let index = 0;
    while (index < source.length) {
      const char = source[index];
      if (char === "\\") {
        let end = index + 1;
        if (/[A-Za-z]/.test(source[end] || "")) while (/[A-Za-z]/.test(source[end] || "")) end += 1;
        else end += 1;
        const command = source.slice(index + 1,end);
        if (["frac","dfrac","tfrac"].includes(command)) {
          const numerator = readBraced(source,end);
          const denominator = numerator && readBraced(source,numerator.end);
          if (numerator && denominator) {
            html += `<span class="math-fraction"><span>${renderMath(numerator.value,esc)}</span><span>${renderMath(denominator.value,esc)}</span></span>`;
            index = denominator.end;
            continue;
          }
        }
        if (command === "sqrt") {
          const radicand = readBraced(source,end);
          if (radicand) {
            html += `<span class="math-root"><span class="math-root-sign">√</span><span class="math-radicand">${renderMath(radicand.value,esc)}</span></span>`;
            index = radicand.end;
            continue;
          }
        }
        if (["mathrm","textrm","text","operatorname"].includes(command)) {
          const group = readBraced(source,end);
          if (group) {
            html += `<span class="math-roman">${esc(group.value)}</span>`;
            index = group.end;
            continue;
          }
        }
        if (["mathbf","boldsymbol"].includes(command)) {
          const group = readBraced(source,end);
          if (group) {
            html += `<strong>${renderMath(group.value,esc)}</strong>`;
            index = group.end;
            continue;
          }
        }
        if (spacing.has(command)) html += command === "quad" ? " " : command === "qquad" ? "  " : " ";
        else if (symbols[command]) html += symbols[command];
        else if (["%","_","#","&","{","}","$"].includes(command)) html += esc(command);
        else html += `<span class="math-unknown" title="Unsupported command">${esc(`\\${command}`)}</span>`;
        index = end;
        continue;
      }
      if (char === "^" || char === "_") {
        const tag = char === "^" ? "sup" : "sub";
        const group = readBraced(source,index + 1);
        if (group) {
          html += `<${tag}>${renderMath(group.value,esc)}</${tag}>`;
          index = group.end;
          continue;
        }
        if (source[index + 1]) {
          html += `<${tag}>${esc(source[index + 1])}</${tag}>`;
          index += 2;
          continue;
        }
      }
      if (char === "{") {
        const group = readBraced(source,index);
        if (group) {
          html += renderMath(group.value,esc);
          index = group.end;
          continue;
        }
      }
      html += esc(char);
      index += 1;
    }
    return html;
  }

  function renderLatexInline(source, esc) {
    let html = "";
    let index = 0;
    while (index < source.length) {
      if (source.startsWith("\\(",index)) {
        const end = source.indexOf("\\)",index + 2);
        if (end >= 0) {
          const formula = source.slice(index + 2,end);
          html += `<span class="latex-inline-equation" role="math" aria-label="${esc(formula)}">${renderMath(formula,esc)}</span>`;
          index = end + 2;
          continue;
        }
      }
      if (source[index] === "$" && source[index - 1] !== "\\") {
        const end = source.indexOf("$",index + 1);
        if (end >= 0) {
          const formula = source.slice(index + 1,end);
          html += `<span class="latex-inline-equation" role="math" aria-label="${esc(formula)}">${renderMath(formula,esc)}</span>`;
          index = end + 1;
          continue;
        }
      }
      if (source[index] === "\\") {
        const formatting = source.slice(index).match(/^\\(textbf|textit|emph|texttt)\{/);
        if (formatting) {
          const start = index + formatting[0].length - 1;
          const group = readBraced(source,start);
          if (group) {
            const tag = formatting[1] === "textbf" ? "strong" : formatting[1] === "texttt" ? "code" : "em";
            html += `<${tag}>${renderLatexInline(group.value,esc)}</${tag}>`;
            index = group.end;
            continue;
          }
        }
        const escaped = source.slice(index).match(/^\\([%&#_$])/);
        if (escaped) {
          html += esc(escaped[1]);
          index += escaped[0].length;
          continue;
        }
      }
      html += esc(source[index]);
      index += 1;
    }
    return html;
  }

  function formulaBlock(formula, esc) {
    return `<div class="latex-equation" role="math" aria-label="${esc(formula.trim())}">${renderMath(formula.trim(),esc)}</div>`;
  }

  function latex(value, esc) {
    const lines = value.split(/\r?\n/);
    const output = [];
    let inList = false;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line || /^%(?!%)/.test(line) || /^\\(?:documentclass|usepackage|begin\{document\}|end\{document\})/.test(line)) continue;
      if (line.startsWith("\\[") || line.startsWith("$$") || /^\\begin\{(?:equation\*?|displaymath)\}/.test(line)) {
        const buffer = [];
        const sameLine = line.match(/^\\\[(.*)\\\]$/) || line.match(/^\$\$(.*)\$\$$/);
        if (sameLine) {
          output.push(formulaBlock(sameLine[1],esc));
          continue;
        }
        const closes = line.startsWith("\\[") ? (candidate) => candidate.includes("\\]") : line === "$$" ? (candidate) => candidate.includes("$$") : (candidate) => /^\\end\{(?:equation\*?|displaymath)\}/.test(candidate.trim());
        const initial = line.startsWith("\\[") ? line.slice(2) : /^\\begin/.test(line) || line === "$$" ? "" : line;
        if (initial) buffer.push(initial);
        while (++index < lines.length) {
          const candidate = lines[index];
          if (closes(candidate)) {
            buffer.push(candidate.replace(/\\\]|\$\$|\\end\{(?:equation\*?|displaymath)\}/g, ""));
            break;
          }
          buffer.push(candidate);
        }
        output.push(formulaBlock(buffer.join(" "),esc));
        continue;
      }
      const title = line.match(/^\\title\{(.+)\}$/); if (title) { output.push(`<h1>${renderLatexInline(title[1],esc)}</h1>`); continue; }
      const author = line.match(/^\\author\{(.+)\}$/); if (author) { output.push(`<p class="latex-author">${renderLatexInline(author[1],esc)}</p>`); continue; }
      if (line === "\\maketitle") continue;
      const section = line.match(/^\\section\{(.+)\}$/); if (section) { output.push(`<h2>${renderLatexInline(section[1],esc)}</h2>`); continue; }
      const subsection = line.match(/^\\subsection\{(.+)\}$/); if (subsection) { output.push(`<h3>${renderLatexInline(subsection[1],esc)}</h3>`); continue; }
      if (line === "\\begin{itemize}") { inList = true; output.push('<div class="latex-list">'); continue; }
      if (line === "\\end{itemize}") { inList = false; output.push("</div>"); continue; }
      const item = line.match(/^\\item\s+(.+)$/); if (item) { output.push(`<div>• ${renderLatexInline(item[1],esc)}</div>`); continue; }
      output.push(`<p${inList ? ' class="latex-list-copy"' : ""}>${renderLatexInline(line,esc)}</p>`);
    }
    return output.join("");
  }

  function highlightSyntax(value, type, esc) {
    let source = value;
    const tokens = [];
    const take = (pattern, className) => {
      source = source.replace(pattern,(match) => {
        const token = String.fromCodePoint(0xE000 + tokens.length);
        tokens.push({token,html:`<span class="syntax-${className}">${esc(match)}</span>`});
        return token;
      });
    };
    const commonNumbers = /\b-?(?:0x[\da-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/gi;
    if (type === "json") {
      take(/"(?:\\.|[^"\\])*"(?=\s*:)/g,"key");
      take(/"(?:\\.|[^"\\])*"/g,"string");
      take(/\b(?:true|false|null)\b/g,"literal");
      take(commonNumbers,"number");
    } else if (type === "yaml") {
      take(/#[^\n]*/g,"comment");
      take(/'(?:''|[^'])*'|"(?:\\.|[^"\\])*"/g,"string");
      take(/(?:^|\n)[ \t]*(?:-[ \t]+)?[A-Za-z_][\w.-]*(?=[ \t]*:)/g,"key");
      take(/\b(?:true|false|null|yes|no|on|off)\b/gi,"literal");
      take(/(?:^|[ \t])(?:&|\*)[A-Za-z_][\w.-]*/gm,"keyword");
      take(commonNumbers,"number");
    } else if (type === "latex") {
      take(/%[^\n]*/g,"comment");
      take(/\\(?:begin|end)\{[^}]+\}/g,"keyword");
      take(/\\[A-Za-z@]+|\\./g,"command");
      take(/\$\$?|\\\[|\\\]|\\\(|\\\)/g,"operator");
      take(/[{}\[\]]/g,"punctuation");
      take(commonNumbers,"number");
    } else if (type === "markdown") {
      take(/```[\s\S]*?```/g,"code");
      take(/`[^`\n]+`/g,"code");
      take(/^#{1,6}[^\n]*/gm,"heading");
      take(/^\s*(?:[-*+] |\d+\. )/gm,"keyword");
      take(/^>[^\n]*/gm,"comment");
      take(/!?(?:\[[^\]]+\])\([^\)]+\)/g,"link");
      take(/\*\*[^*\n]+\*\*|__[^_\n]+__/g,"strong");
      take(/\*[^*\n]+\*|_[^_\n]+_/g,"emphasis");
    } else if (type === "diagram") {
      take(/%%[^\n]*/g,"comment");
      take(/\b(?:flowchart|graph|subgraph|end|TD|TB|BT|LR|RL)\b/g,"keyword");
      take(/-->|---|-\.->|==>/g,"operator");
      take(/\|[^|\n]+\|/g,"string");
      take(/\b[A-Za-z][\w-]*(?=\s*[\[({])/g,"key");
      take(/[\[\]{}()]/g,"punctuation");
      take(/"(?:\\.|[^"\\])*"/g,"string");
    }
    let html = esc(source);
    tokens.forEach(({token,html:replacement}) => { html = html.split(token).join(replacement); });
    return `${html}${value.endsWith("\n") ? " " : "\n"}`;
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
      <div class="editor-split ${type === "txt" || type === "yaml" || type === "json" ? "single" : ""}"><div class="code-editor ${type === "txt" ? "" : "syntax-enabled"}"><span class="editor-gutter" id="editor-gutter"></span><div class="editor-layer">${type === "txt" ? "" : `<pre class="syntax-highlight" id="editor-highlight" aria-hidden="true">${highlightSyntax(state.content,type,esc)}</pre>`}<textarea id="tool-editor" spellcheck="false" aria-label="${labels[type][0]} editor">${esc(state.content)}</textarea></div></div>${type === "markdown" ? `<article class="markdown-preview" id="markdown-preview">${markdown(state.content,esc)}</article>` : type === "latex" ? `<article class="markdown-preview latex-preview" id="latex-preview" aria-label="LaTeX rendered preview">${latex(state.content,esc)}</article>` : ""}</div>
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
    const templateOptions = Object.entries(DIAGRAM_TEMPLATES).map(([id,item]) => `<option value="${id}">${esc(item.name)}</option>`).join("");
    return `<section class="tool-stage diagram-studio"><div class="tool-stage-head"><div><span class="knowledge-kind">Diagram Studio</span><h2>Research workflows and evidence graphs</h2></div><div class="cluster"><label class="sr-only" for="diagram-template">Diagram template</label><select class="select select-sm" id="diagram-template"><option value="">Choose template…</option>${templateOptions}</select><button class="btn btn-sm" id="diagram-validate">${icon("check")} Validate</button><button class="btn btn-primary btn-sm" id="diagram-download">${icon("download")} Download SVG</button></div></div>
      <div class="tool-document-bar diagram-document-bar"><input class="input" id="diagram-filename" value="${esc(diagramState.name)}" aria-label="Diagram file name"><div class="segmented diagram-direction" aria-label="Diagram direction"><button type="button" data-diagram-direction="TD">Top to bottom</button><button type="button" data-diagram-direction="LR">Left to right</button></div><span class="toolbar-spacer"></span><span class="diagram-stat" id="diagram-node-count">0 nodes</span><span class="diagram-stat" id="diagram-edge-count">0 relations</span></div>
      <div class="diagram-workbench">
        <section class="diagram-pane diagram-source" aria-label="Diagram source editor"><div class="diagram-pane-head"><div><strong>Graph definition</strong><small>Local flowchart syntax with live validation</small></div><details class="diagram-help"><summary>Syntax</summary><div><code>A[Box]</code><code>B(Rounded)</code><code>C{Decision}</code><code>D[[Process]]</code><code>E((Milestone))</code><code>A --&gt;|label| B</code><code>A -.-&gt; B</code><code>A ==&gt; B</code></div></details></div><div class="diagram-editor-shell"><span class="diagram-gutter" id="diagram-gutter" aria-hidden="true"></span><div class="diagram-editor-layer syntax-enabled"><pre class="syntax-highlight" id="diagram-highlight" aria-hidden="true">${highlightSyntax(diagramState.content,"diagram",esc)}</pre><textarea id="diagram-editor" spellcheck="false" aria-label="Diagram source">${esc(diagramState.content)}</textarea></div></div></section>
        <section class="diagram-pane diagram-preview-pane" aria-label="Diagram preview"><div class="diagram-pane-head"><div><strong>SVG preview</strong><small id="diagram-preview-meta">Live local rendering</small></div><div class="cluster diagram-zoom-controls"><button class="btn btn-ghost icon-btn" id="diagram-zoom-out" type="button" aria-label="Zoom out">−</button><button class="btn btn-sm" id="diagram-fit" type="button">Fit</button><span id="diagram-zoom-label" aria-live="polite">100%</span><button class="btn btn-ghost icon-btn" id="diagram-zoom-in" type="button" aria-label="Zoom in">+</button></div></div><div class="diagram-preview diagram-fit" id="diagram-preview" tabindex="0" aria-label="Scrollable diagram preview" aria-live="polite"><div class="diagram-canvas" id="diagram-canvas"></div></div></section>
      </div><div class="tool-status" id="diagram-status" role="status"><span class="status-dot"></span><span>Ready · rendered entirely in this page</span></div></section>`;
  }

  function bindText(type, stage, ctx) {
    const {toast,esc} = ctx; const state = textState[type]; const editor = stage.querySelector("#tool-editor");
    const refresh = () => {
      state.content = editor.value; state.name = stage.querySelector("#tool-filename").value || state.name;
      const words = editor.value.trim() ? editor.value.trim().split(/\s+/).length : 0;
      stage.querySelector("#tool-stats").textContent = `${words} words · ${editor.value.length} characters`;
      stage.querySelector("#editor-gutter").textContent = Array.from({length:editor.value.split("\n").length},(_,index)=>index+1).join("\n");
      const highlighter = stage.querySelector("#editor-highlight");
      if (highlighter) highlighter.innerHTML = highlightSyntax(editor.value,type,esc);
      if (type === "markdown") stage.querySelector("#markdown-preview").innerHTML = markdown(editor.value,esc);
      if (type === "latex") stage.querySelector("#latex-preview").innerHTML = latex(editor.value,esc);
    };
    const syncEditorScroll = () => {
      const highlighter = stage.querySelector("#editor-highlight");
      if (highlighter) { highlighter.scrollTop = editor.scrollTop; highlighter.scrollLeft = editor.scrollLeft; }
      stage.querySelector("#editor-gutter").style.transform = `translateY(${-editor.scrollTop}px)`;
    };
    editor.addEventListener("input",refresh); editor.addEventListener("scroll",syncEditorScroll); stage.querySelector("#tool-filename").addEventListener("input",refresh); refresh(); syncEditorScroll();
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
    const canvas = stage.querySelector("#diagram-canvas");
    const highlighter = stage.querySelector("#diagram-highlight");
    const gutter = stage.querySelector("#diagram-gutter");
    const status = stage.querySelector("#diagram-status");
    const zoomLabel = stage.querySelector("#diagram-zoom-label");
    preview.setAttribute("role", "region");

    const setDirection = (direction) => {
      const lines = editor.value.split(/\r?\n/);
      if (/^(?:flowchart|graph)\s+(?:TD|TB|BT|LR|RL)$/i.test(lines[0] || "")) lines[0] = `flowchart ${direction}`;
      else lines.unshift(`flowchart ${direction}`);
      editor.value = lines.join("\n");
      refresh();
    };

    const applyZoom = () => {
      const svg = canvas.querySelector("svg");
      zoomLabel.textContent = `${Math.round(diagramState.zoom * 100)}%`;
      preview.classList.toggle("diagram-fit",diagramState.fit);
      if (!svg) return;
      if (diagramState.fit) {
        svg.style.width = "100%";
        svg.style.minWidth = "0";
      } else {
        svg.style.width = `${Math.round(diagramState.zoom * 100)}%`;
        svg.style.minWidth = diagramState.zoom >= 1 ? "520px" : "0";
      }
    };

    const updateStatus = (message,type = "success") => {
      status.classList.toggle("tool-status-error",type === "error");
      status.querySelector(".status-dot").classList.toggle("status-dot-error",type === "error");
      status.querySelector("span:last-child").textContent = message;
    };

    const refresh = () => {
      diagramState.content = editor.value;
      diagramState.name = stage.querySelector("#diagram-filename").value || "labflow-diagram.svg";
      highlighter.innerHTML = highlightSyntax(editor.value,"diagram",ctx.esc);
      gutter.textContent = Array.from({length:Math.max(1,editor.value.split("\n").length)},(_,index) => index + 1).join("\n");
      try {
        const graph = window.LabFlowDiagrams.parse(diagramState.content);
        canvas.innerHTML = window.LabFlowDiagrams.render(diagramState.content,{label:"Research workflow diagram"});
        stage.querySelector("#diagram-node-count").textContent = `${graph.nodes.length} node${graph.nodes.length === 1 ? "" : "s"}`;
        stage.querySelector("#diagram-edge-count").textContent = `${graph.edges.length} relation${graph.edges.length === 1 ? "" : "s"}`;
        stage.querySelector("#diagram-preview-meta").textContent = `${graph.direction} · ${graph.nodes.length} nodes · ${graph.edges.length} relations`;
        stage.querySelectorAll("[data-diagram-direction]").forEach((button) => {
          const active = button.dataset.diagramDirection === (graph.direction === "BT" ? "TD" : graph.direction === "RL" ? "LR" : graph.direction);
          button.classList.toggle("active",active);
          button.setAttribute("aria-pressed",String(active));
        });
        updateStatus(graph.warnings.length ? graph.warnings[0] : "Valid diagram · live SVG preview · no external graph service",graph.warnings.length ? "warning" : "success");
      } catch (error) {
        canvas.innerHTML = window.LabFlowDiagrams.render(diagramState.content,{label:"Research workflow diagram"});
        stage.querySelector("#diagram-preview-meta").textContent = "Definition requires review";
        stage.querySelector("#diagram-node-count").textContent = "— nodes";
        stage.querySelector("#diagram-edge-count").textContent = "— relations";
        updateStatus(error.message,"error");
      }
      applyZoom();
    };

    const syncEditorScroll = () => {
      highlighter.scrollTop = editor.scrollTop;
      highlighter.scrollLeft = editor.scrollLeft;
      gutter.style.transform = `translateY(${-editor.scrollTop}px)`;
    };

    editor.addEventListener("input",refresh);
    editor.addEventListener("scroll",syncEditorScroll);
    editor.addEventListener("keydown",(event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.setRangeText("  ",start,end,"end");
        refresh();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        refresh();
        ctx.toast("Diagram preview refreshed.");
      }
    });
    stage.querySelector("#diagram-filename").addEventListener("input",refresh);
    stage.querySelectorAll("[data-diagram-direction]").forEach((button) => button.addEventListener("click",() => setDirection(button.dataset.diagramDirection)));
    stage.querySelector("#diagram-template").addEventListener("change",(event) => {
      const template = DIAGRAM_TEMPLATES[event.target.value];
      if (!template) return;
      editor.value = template.content;
      stage.querySelector("#diagram-filename").value = template.file;
      diagramState.fit = true;
      diagramState.zoom = 1;
      refresh();
      ctx.toast(`${template.name} template loaded.`);
      event.target.value = "";
    });
    stage.querySelector("#diagram-validate").addEventListener("click",() => {
      try {
        const graph = window.LabFlowDiagrams.parse(editor.value);
        ctx.toast(`Valid diagram: ${graph.nodes.length} nodes and ${graph.edges.length} relations.`,"success");
      } catch (error) { ctx.toast(error.message,"error"); }
    });
    stage.querySelector("#diagram-zoom-out").addEventListener("click",() => { diagramState.fit = false; diagramState.zoom = Math.max(.6,diagramState.zoom - .15); applyZoom(); });
    stage.querySelector("#diagram-zoom-in").addEventListener("click",() => { diagramState.fit = false; diagramState.zoom = Math.min(1.9,diagramState.zoom + .15); applyZoom(); });
    stage.querySelector("#diagram-fit").addEventListener("click",() => { diagramState.fit = true; diagramState.zoom = 1; applyZoom(); preview.scrollTo({top:0,left:0,behavior:"smooth"}); });
    stage.querySelector("#diagram-download").addEventListener("click",() => {
      const svg = canvas.querySelector("svg");
      if (!svg) return ctx.toast("Fix the diagram definition before downloading.","error");
      const exported = svg.cloneNode(true);
      const theme = getComputedStyle(document.documentElement);
      const color = (token) => theme.getPropertyValue(token).trim();
      exported.removeAttribute("style");
      exported.setAttribute("xmlns","http://www.w3.org/2000/svg");
      exported.setAttribute("width",exported.viewBox.baseVal?.width || 1200);
      exported.setAttribute("height",exported.viewBox.baseVal?.height || 800);
      exported.querySelectorAll(".diagram-node-shape").forEach((shape) => { shape.setAttribute("fill",color("--surface")); shape.setAttribute("stroke",color("--accent")); shape.setAttribute("stroke-width","1.6"); });
      exported.querySelectorAll(".diagram-node-shape-secondary").forEach((shape) => { shape.setAttribute("fill","none"); shape.setAttribute("stroke",color("--accent")); shape.setAttribute("stroke-width","1"); });
      exported.querySelectorAll(".diagram-node text,.diagram-edge-label text").forEach((text) => { text.setAttribute("fill",color("--text")); text.setAttribute("font-family","system-ui, sans-serif"); text.setAttribute("font-size",text.closest(".diagram-edge-label") ? "10" : "12"); text.setAttribute("font-weight",text.closest(".diagram-edge-label") ? "600" : "650"); });
      exported.querySelectorAll(".diagram-edge").forEach((edge) => { edge.setAttribute("fill","none"); edge.setAttribute("stroke",color("--muted")); edge.setAttribute("stroke-width",edge.classList.contains("diagram-edge-strong") ? "2.6" : "1.7"); if (edge.classList.contains("diagram-edge-dashed")) edge.setAttribute("stroke-dasharray","6 5"); });
      exported.querySelectorAll(".diagram-edge-label rect").forEach((rect) => { rect.setAttribute("fill",color("--surface")); rect.setAttribute("stroke",color("--line")); });
      exported.querySelectorAll(".diagram-arrow").forEach((arrow) => arrow.setAttribute("fill",color("--muted")));
      const source = `<?xml version="1.0" encoding="UTF-8"?>\n${exported.outerHTML}`;
      downloadText(source,diagramState.name.endsWith(".svg") ? diagramState.name : `${diagramState.name}.svg`,"image/svg+xml");
      ctx.toast("Editable SVG diagram generated locally.");
    });
    refresh();
    syncEditorScroll();
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
