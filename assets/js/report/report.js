(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;
  const Log = LF.Logger.scope('report');

  function ensureReport(exp) {
    exp.report = exp.report || {};
    /* An intentionally emptied document is valid once it has an edit timestamp. */
    if (typeof exp.report.labMarkdown !== 'string' || (!exp.report.labMarkdown && !exp.report.labUpdatedAt)) exp.report.labMarkdown = exp.report.markdown || defaultMarkdown(exp);
    if (typeof exp.report.paperMarkdown !== 'string' || (!exp.report.paperMarkdown && !exp.report.paperUpdatedAt)) exp.report.paperMarkdown = defaultPaperMarkdown(exp);
    if (!exp.report.kind) exp.report.kind = 'lab';
    exp.report.markdown = exp.report.kind === 'paper' ? exp.report.paperMarkdown : exp.report.labMarkdown;
    if (!exp.report.title) exp.report.title = (exp.meta && exp.meta.name ? exp.meta.name : 'LabFlow experiment') + ' — Scientific report';
    if (!exp.report.labTitle) exp.report.labTitle = exp.report.title;
    if (!exp.report.paperTitle) exp.report.paperTitle = (exp.meta && exp.meta.name ? exp.meta.name : 'LabFlow experiment') + ' — Manuscript draft';
    exp.report.title = exp.report.kind === 'paper' ? exp.report.paperTitle : exp.report.labTitle;
    if (exp.report.author == null || !String(exp.report.author).trim()) { const profile=LF.Storage&&LF.Storage.getUserProfile?LF.Storage.getUserProfile():null; exp.report.author=profile&&profile.defaultAuthor?profile.defaultAuthor:''; }
    if (exp.report.lab == null) exp.report.lab = '';
    if (exp.report.project == null) exp.report.project = '';
    if (exp.report.includeCharts == null) exp.report.includeCharts = true;
    exp.report.figureSelection = Object.assign({
      pceDistribution: true,
      hysteresisDistribution: true,
      bestJvmCurve: true,
      efficiencyHysteresis: true,
      topEfficiency: true,
      groupComparison: true
    }, exp.report.figureSelection || {});
    if (exp.report.includeValidation == null) exp.report.includeValidation = true;
    /*
     * Do not refresh generated evidence here. This function is also used by
     * read paths (preview, word count and export); mutating Markdown there
     * would make the exported source differ from the visible editor. Design
     * and analysis dependency refreshes call the two sync functions explicitly.
     */
    return exp.report;
  }

  function designEvidenceMarkdown(exp) {
    const d = LF.Analysis.designOf(exp), lines = [];
    function label(x) { return x && x.status === 'user_confirmed' ? 'user-confirmed' : x && x.status === 'ai_inferred' ? 'AI-inferred' : 'unconfirmed'; }
    if ((d.solutions || []).length) {
      lines.push('### Solutions and formulations');
      (d.solutions || []).forEach(function (s) {
        const details=[s.role, s.solutes && ('solutes: '+s.solutes), s.solvents && ('solvents: '+s.solvents), s.concentration && ('composition: '+s.concentration), s.additives && ('additives: '+s.additives), s.preparation && ('preparation: '+s.preparation)].filter(Boolean).join('; ');
        lines.push('- **'+(s.name||'Unnamed solution')+'** — '+(details||'details not available')+'  ');
        lines.push('  Provenance: **'+label(s)+'**'+(s.evidence?' — '+s.evidence:'')+'.');
      });
    }
    if ((d.devices || []).length) {
      lines.push('', '### Device / sample variants');
      (d.devices || []).forEach(function (dev, di) {
        const solutions=(dev.solutionIds||[]).map(function(id){const s=(d.solutions||[]).find(function(x){return x.id===id;});return s&&s.name;}).filter(Boolean);
        lines.push('- **'+(dev.name||('Device '+(di+1)))+'** — samples: '+((dev.sampleNames||[]).join(', ')||'not assigned')+(dev.group?'; group: '+dev.group:'')+(solutions.length?'; solutions: '+solutions.join(', '):'')+'  ');
        lines.push('  Provenance: **'+label(dev)+'**'+(dev.evidence?' — '+dev.evidence:'')+'.');
        const dp=dev.process||{}, processBits=[['coating','coating/deposition'],['annealing','annealing'],['atmosphere','atmosphere'],['notes','notes']].filter(function(item){return String(dp[item[0]]||'').trim();}).map(function(item){return item[1]+': '+dp[item[0]];});
        if(processBits.length) lines.push('  Variant conditions: '+processBits.join('; ')+'.');
        if((dev.stack||[]).length){(dev.stack||[]).forEach(function(l,i){lines.push('  '+(i+1)+'. '+(l.role||'Layer')+' — '+([l.material,l.thickness,l.process].filter(Boolean).join(' · ')||'details unknown')+' ['+label(l)+']');});}
      });
    }
    if ((d.stack || []).length) {
      lines.push('', '### Device stack');
      (d.stack || []).forEach(function (l, i) {
        const detail=[l.material,l.thickness,l.process].filter(Boolean).join(' · ');
        lines.push((i+1)+'. **'+(l.role||l.layer||('Layer '+(i+1)))+'** — '+(detail||'material/process unknown')+'  ');
        lines.push('   Provenance: **'+label(l)+'**'+(l.evidence?' — '+l.evidence:'')+'.');
      });
    }
    if (d.process) {
      const pp=d.processProvenance||{};
      const process=[['coating','Coating/deposition'],['annealing','Annealing'],['atmosphere','Atmosphere'],['notes','Notes']].filter(function(item){return String(d.process[item[0]]||'').trim();}).map(function(item){
        const pv=pp[item[0]]||{}, status=pv.status==='user_confirmed'?'user-confirmed':pv.status==='ai_inferred'?'AI-inferred':'unconfirmed';
        return '- **'+item[1]+':** '+d.process[item[0]]+'  \n  Provenance: **'+status+'**'+(pv.evidence?' — '+pv.evidence:'')+'.';
      });
      if(process.length) lines.push('', '### Fabrication conditions', '', process.join('\n'));
    }
    return lines.length ? lines.join('\n') : 'No experimental-design details have been confirmed or inferred yet.';
  }

  function defaultMarkdown(exp) {
    const s = (LF.Analysis.analysisOf(exp) || {}).summary || {};
    return '# ' + ((exp.meta && exp.meta.name) || 'Experiment report') + '\n\n' +
      '## Purpose and scope\n\nThis laboratory report documents the photovoltaic experiment contained in `' + ((exp.meta && exp.meta.sourceName) || 'the imported dataset') + '`. It connects the experimental design, deterministic JV analysis, data-quality review and resulting scientific interpretation while preserving the uploaded archive as immutable source evidence.\n\n' +
      '## Experimental design\n\nDescribe the device variants, precursor formulations, solutes, solvents, additives and layer stack confirmed in the Design workspace. Distinguish values taken directly from source evidence from researcher-confirmed or AI-inferred values.\n\n' +
      '## Fabrication and measurement methods\n\nDocument deposition, annealing, atmosphere and measurement conditions in chronological order. Record missing parameters explicitly; do not replace them with assumed standard practice. Explain the FW/RV acquisition convention and the deterministic eligibility criteria used by LabFlow.\n\n' +
      '## Dataset and quality control\n\nThe current Working Copy contains **' + (s.sampleCount || 0) + ' samples** and **' + (s.measurementCount || 0) + ' measurements**. Of these, **' + (s.eligibleCount || 0) + '** are eligible for ranking after deterministic validation. There are **' + (s.findingCount || 0) + '** open findings. Summarize material corrections and exclusions here, including their evidence and effect on interpretation.\n\n' +
      '## Results\n\nThe best eligible device is **' + (s.bestSample || 'not yet established') + '** with a PCE of **' + C.fmt(s.bestEfficiency, 2) + '%**; the median best efficiency is **' + C.fmt(s.medianEfficiency, 2) + '%**. Present reference and non-reference performance separately, report variability alongside central values, and describe hysteresis using the paired FW/RV measurements.\n\n' +
      '## Discussion\n\nInterpret the observed ranking, group-level spread, reference behavior and hysteresis in relation to the confirmed design. Separate direct observations from mechanistic hypotheses. Address measurement exclusions, incomplete metadata and the limits these impose on causal conclusions.\n\n' +
      '## Conclusions\n\nState the principal result, the strength of the supporting evidence and the most important unresolved question. Keep conclusions proportional to the validated dataset.\n\n' +
      '## Data provenance and reuse\n\nThe original ZIP remains unchanged. This report is derived from the current LabFlow Working Copy; corrections are tracked as provenance patches and NOMAD readiness is evaluated independently in the export step.\n';
  }

  function defaultPaperMarkdown(exp) {
    return '# ' + ((exp.meta && exp.meta.name) || 'Experiment') + '\n\n' +
      '## Abstract\n\nWrite a self-contained account of the research question, experimental approach, principal quantitative result and main limitation. Avoid citations and claims that are not supported by the current experiment.\n\n' +
      '## Introduction\n\nDefine the material or device question addressed by the experiment and explain why the selected comparison is informative. Add literature context only after verified references are available.\n\n' +
      '## Experimental methods\n\nDescribe precursor preparation, deposition, annealing, atmosphere, device architecture and JV acquisition from the confirmed Design record. Identify missing information and distinguish evidence-backed values from inference.\n\n' +
      '## Results\n\nPresent deterministic JV outcomes with sample counts, reference and non-reference comparisons, variability, FW/RV pairing and hysteresis. Refer only to figures selected in Report Studio.\n\n' +
      '## Discussion\n\nRelate performance differences to confirmed experimental variables. Separate observation, interpretation and hypothesis, and discuss exclusions or incomplete metadata that limit generalization.\n\n' +
      '## Conclusions\n\nSummarize the result supported by the current measurements and identify the next experiment needed to resolve the principal uncertainty.\n\n' +
      '## Data availability and provenance\n\nState that the manuscript derives from the current LabFlow Working Copy, while the uploaded source archive remains byte-preserved. Record the status of correction provenance and NOMAD export readiness.\n';
  }

  function upsertDesignProvenance(markdown, exp) {
    const heading='## Experimental design provenance', block=heading+'\n\n'+designEvidenceMarkdown(exp), md=String(markdown||'').trimEnd();
    const re=/(^|\n)## Experimental design provenance\s*\n[\s\S]*?(?=\n## |\s*$)/;
    if(re.test(md))return md.replace(re,function(match,prefix){return (prefix||'')+block;})+'\n';
    return md+'\n\n'+block+'\n';
  }
  function syncDesignEvidence(exp) {
    const r=exp.report||{};if(!r.labMarkdown||!r.paperMarkdown)return r;
    r.labMarkdown=upsertDesignProvenance(r.labMarkdown,exp);
    r.paperMarkdown=upsertDesignProvenance(r.paperMarkdown,exp);
    r.markdown=r.kind==='paper'?r.paperMarkdown:r.labMarkdown;
    return r;
  }

  function analysisEvidenceMarkdown(exp) {
    const summary = (LF.Analysis.analysisOf(exp) || {}).summary || {};
    const factor = LF.Analysis.settingsOf(exp);
    return [
      '- Samples: **' + Number(summary.sampleCount || 0) + '**',
      '- Measurements: **' + Number(summary.measurementCount || 0) + '**',
      '- Ranking-eligible: **' + Number(summary.eligibleCount || 0) + '**',
      '- Best eligible efficiency: **' + C.fmt(summary.bestEfficiency, 2) + '%** (' + (summary.bestSample || '—') + ')',
      '- Open findings: **' + Number(summary.findingCount || 0) + '**',
      '- Applied working-state patches: **' + Number((exp.patches || []).length) + '**',
      '- Display mismatch factor: **' + C.fmt(factor, 3) + '**'
    ].join('\n');
  }

  function syncAnalysisEvidence(exp) {
    const r = exp.report || {};
    if (!r.labMarkdown || !r.paperMarkdown) return r;
    const heading = '## Current results provenance';
    const block = heading + '\n\n' + analysisEvidenceMarkdown(exp);
    const pattern = /(^|\n)## Current results provenance\s*\n[\s\S]*?(?=\n## |\s*$)/;
    function upsert(markdown) {
      const source = String(markdown || '').trimEnd();
      if (pattern.test(source)) return source.replace(pattern, function (match, prefix) { return (prefix || '') + block; }) + '\n';
      return source + '\n\n' + block + '\n';
    }
    r.labMarkdown = upsert(r.labMarkdown);
    r.paperMarkdown = upsert(r.paperMarkdown);
    r.markdown = r.kind === 'paper' ? r.paperMarkdown : r.labMarkdown;
    return r;
  }

  function activeMarkdown(exp) { const r=ensureReport(exp); return r.kind === 'paper' ? r.paperMarkdown : r.labMarkdown; }
  function setActiveMarkdown(exp, text) {
    const r=ensureReport(exp), value=String(text||''), now=new Date().toISOString();
    if(r.kind==='paper'){r.paperMarkdown=value;r.paperUpdatedAt=now;}else{r.labMarkdown=value;r.labUpdatedAt=now;}
    r.markdown=value;r.updatedAt=now;return value;
  }
  function setKind(exp, kind) { const r=ensureReport(exp); r.kind=kind==='paper'?'paper':'lab'; r.markdown=r.kind==='paper'?r.paperMarkdown:r.labMarkdown; r.title=r.kind==='paper'?r.paperTitle:r.labTitle; return r.kind; }
  function activeTitle(exp){ const r=ensureReport(exp); return r.kind==='paper'?r.paperTitle:r.labTitle; }
  function setActiveTitle(exp,title){ const r=ensureReport(exp),value=String(title||''); if(r.kind==='paper')r.paperTitle=value; else r.labTitle=value; r.title=value; r.updatedAt=new Date().toISOString(); return value; }

  /** Compact identity used by the editor, export controls and diagnostics. */
  function documentInfo(exp) {
    const r=ensureReport(exp), kind=r.kind==='paper'?'paper':'lab', markdown=activeMarkdown(exp), words=(markdown.trim().match(/\S+/g)||[]).length;
    return {kind:kind,label:kind==='paper'?'Scientific paper draft':'Laboratory report',shortLabel:kind==='paper'?'Paper':'Report',title:activeTitle(exp),markdown:markdown,words:words,chars:markdown.length,updatedAt:kind==='paper'?r.paperUpdatedAt:r.labUpdatedAt,suffix:kind==='paper'?'_paper_draft':'_lab_report'};
  }


  function latexEscape(s) {
    return String(s || '').replace(/\\/g, '\\textbackslash{}').replace(/([#$%&_{}])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}');
  }

  function toLatex(md) {
    let out = String(md || '');
    out = out.replace(/^# (.+)$/gm, function (_, t) { return '\\section*{' + latexEscape(t) + '}'; })
      .replace(/^## (.+)$/gm, function (_, t) { return '\\section{' + latexEscape(t) + '}'; })
      .replace(/^### (.+)$/gm, function (_, t) { return '\\subsection{' + latexEscape(t) + '}'; })
      .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
      .replace(/`([^`]+)`/g, '\\texttt{$1}');
    return '\\documentclass[11pt,a4paper]{article}\n\\usepackage[margin=24mm]{geometry}\n\\usepackage{booktabs}\n\\usepackage{graphicx}\n\\usepackage{xcolor}\n\\definecolor{labflow}{HTML}{1967D2}\n\\begin{document}\n' + out + '\n\\end{document}\n';
  }

  function values(exp, direction, key) {
    const factor = LF.Analysis.settingsOf(exp);
    return LF.Analysis.measurementsOf(exp).map(function (m) {
      const d = m[direction] || {};
      let v = Number(d[key]);
      if (!Number.isFinite(v)) return null;
      if (key === 'eff' || key === 'jsc') v /= factor;
      return v;
    }).filter(Number.isFinite);
  }

  function stats(arr) {
    const v = arr.map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!v.length) return { n: 0, min: null, q1: null, median: null, mean: null, q3: null, max: null, std: null };
    function q(p) { const i = (v.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); }
    const mean = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
    const variance = v.length > 1 ? v.reduce(function (sum, x) { return sum + Math.pow(x - mean, 2); }, 0) / (v.length - 1) : 0;
    return { n: v.length, min: v[0], q1: q(.25), median: q(.5), mean: mean, q3: q(.75), max: v[v.length - 1], std: Math.sqrt(variance) };
  }

  function makeHistogramDataUrl(arr, title, xLabel) {
    const data = arr.map(Number).filter(Number.isFinite);
    if (!data.length) return null;
    const c = document.createElement('canvas'); c.width = 920; c.height = 340;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    const min = Math.min.apply(null, data), max0 = Math.max.apply(null, data), max = max0 === min ? min + 1 : max0;
    const bins = 16, counts = new Array(bins).fill(0);
    data.forEach(function (v) { let i = Math.floor((v - min) / (max - min) * bins); if (i === bins) i--; counts[Math.max(0, i)]++; });
    const pad = { l: 60, r: 24, t: 42, b: 52 }, plotW = c.width - pad.l - pad.r, plotH = c.height - pad.t - pad.b, peak = Math.max.apply(null, counts) || 1;
    ctx.strokeStyle = '#d9e0e7'; ctx.fillStyle = '#62707d'; ctx.font = '12px sans-serif';
    for (let i = 0; i <= 4; i++) { const y = pad.t + i * plotH / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(c.width - pad.r, y); ctx.stroke(); }
    const bw = plotW / bins; counts.forEach(function (n, i) { const h = n / peak * (plotH - 4); ctx.fillStyle = '#1967d2'; ctx.fillRect(pad.l + i * bw + 1, pad.t + plotH - h, Math.max(2, bw - 2), h); });
    ctx.fillStyle = '#16202a'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(title, pad.l, 24);
    ctx.fillStyle = '#62707d'; ctx.font = '12px sans-serif'; ctx.fillText(xLabel, c.width / 2 - 35, c.height - 14); ctx.fillText(min.toFixed(1), pad.l, c.height - 30); ctx.fillText(max.toFixed(1), c.width - pad.r - 32, c.height - 30);
    return c.toDataURL('image/png');
  }

  function makeCurveDataUrl(exp) {
    const bestCompact = (LF.Analysis.analysisOf(exp) || {}).bestBySample[0];
    if (!bestCompact) return null;
    const m = LF.Analysis.measurementsOf(exp).find(function (x) { return x.id === bestCompact.id; });
    if (!m || !m.curve || (!(m.curve.fw || []).length && !(m.curve.rv || []).length)) return null;
    const factor = LF.Analysis.settingsOf(exp);
    const c = document.createElement('canvas'); c.width = 920; c.height = 420; const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    const all = [].concat((m.curve.fw || []).map(function (p) { return { x: p.x, y: p.y / factor }; }), (m.curve.rv || []).map(function (p) { return { x: p.x, y: p.y / factor }; }));
    if (!all.length) return null;
    let xmin = Math.min.apply(null, all.map(function (p) { return p.x; })), xmax = Math.max.apply(null, all.map(function (p) { return p.x; })), ymin = Math.min.apply(null, all.map(function (p) { return p.y; })), ymax = Math.max.apply(null, all.map(function (p) { return p.y; }));
    if (xmax === xmin) xmax = xmin + 1; if (ymax === ymin) ymax = ymin + 1;
    const pad = { l: 72, r: 32, t: 48, b: 56 }, W = c.width - pad.l - pad.r, H = c.height - pad.t - pad.b;
    const X = function (x) { return pad.l + (x - xmin) / (xmax - xmin) * W; }, Y = function (y) { return pad.t + H - (y - ymin) / (ymax - ymin) * H; };
    ctx.strokeStyle = '#d9e0e7'; for (let i = 0; i <= 5; i++) { const y = pad.t + i * H / 5; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(c.width - pad.r, y); ctx.stroke(); }
    function line(arr, color) { ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath(); arr.forEach(function (p, i) { const x = X(p.x), y = Y(p.y / factor); if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); }
    line(m.curve.fw || [], '#1967d2'); line(m.curve.rv || [], '#df3f3f');
    ctx.fillStyle = '#16202a'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('Best eligible JV curve — ' + m.sample, pad.l, 26);
    ctx.fillStyle = '#62707d'; ctx.font = '12px sans-serif'; ctx.fillText('Voltage (V)', c.width / 2 - 28, c.height - 16); ctx.save(); ctx.translate(18, c.height / 2 + 40); ctx.rotate(-Math.PI / 2); ctx.fillText('Current density (mA/cm²)', 0, 0); ctx.restore();
    ctx.fillStyle = '#1967d2'; ctx.fillRect(c.width - 190, 20, 18, 3); ctx.fillStyle = '#16202a'; ctx.fillText('Forward (FW)', c.width - 165, 25); ctx.fillStyle = '#df3f3f'; ctx.fillRect(c.width - 92, 20, 18, 3); ctx.fillStyle = '#16202a'; ctx.fillText('Reverse', c.width - 68, 25);
    return c.toDataURL('image/png');
  }


  function makeScatterDataUrl(points,title,xLabel,yLabel,threshold) {
    points=(points||[]).filter(function(p){return Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y));}).slice(0,400);
    if(!points.length)return null;
    const c=document.createElement('canvas');c.width=920;c.height=390;const ctx=c.getContext('2d');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);
    let xmin=Math.min.apply(null,points.map(function(p){return Number(p.x);})),xmax=Math.max.apply(null,points.map(function(p){return Number(p.x);})),ymin=Math.min(0,Math.min.apply(null,points.map(function(p){return Number(p.y);}))),ymax=Math.max.apply(null,points.map(function(p){return Number(p.y);}));
    if(xmax===xmin)xmax=xmin+1;if(ymax===ymin)ymax=ymin+1;
    const pad={l:72,r:36,t:50,b:58},W=c.width-pad.l-pad.r,H=c.height-pad.t-pad.b,X=function(v){return pad.l+(v-xmin)/(xmax-xmin)*W;},Y=function(v){return pad.t+H-(v-ymin)/(ymax-ymin)*H;};
    ctx.strokeStyle='#dce2e7';ctx.lineWidth=1;ctx.font='11px system-ui, sans-serif';ctx.fillStyle='#687681';
    for(let i=0;i<=5;i++){const y=pad.t+i*H/5;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(c.width-pad.r,y);ctx.stroke();const v=ymax-(ymax-ymin)*i/5;ctx.fillText(v.toFixed(1),18,y+4);}
    for(let i=0;i<=5;i++){const x=pad.l+i*W/5;ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,pad.t+H);ctx.stroke();const v=xmin+(xmax-xmin)*i/5;ctx.fillText(v.toFixed(1),x-10,c.height-34);}
    if(Number.isFinite(Number(threshold))&&Number(threshold)>=ymin&&Number(threshold)<=ymax){const yy=Y(Number(threshold));ctx.strokeStyle='#c58b2a';ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(c.width-pad.r,yy);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#94651f';ctx.fillText('warning '+Number(threshold).toFixed(1)+'%',pad.l+8,yy-7);}
    points.forEach(function(p){ctx.fillStyle=Math.abs(Number(p.y))>Number(threshold)?'#b8534d':'#3e729a';ctx.beginPath();ctx.arc(X(Number(p.x)),Y(Number(p.y)),3.2,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle='#1f2b34';ctx.font='600 17px system-ui, sans-serif';ctx.fillText(title,pad.l,28);
    ctx.fillStyle='#687681';ctx.font='12px system-ui, sans-serif';ctx.fillText(xLabel,c.width/2-34,c.height-13);ctx.save();ctx.translate(18,c.height/2+35);ctx.rotate(-Math.PI/2);ctx.fillText(yLabel,0,0);ctx.restore();
    return c.toDataURL('image/png');
  }

  function makeBarDataUrl(rows, title, valueLabel) {
    rows=(rows||[]).filter(function(r){return r&&Number.isFinite(Number(r.value));}).slice(0,12);
    if(!rows.length)return null;
    const c=document.createElement('canvas');c.width=920;c.height=Math.max(300,90+rows.length*34);const ctx=c.getContext('2d');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);
    const pad={l:190,r:70,t:54,b:44},W=c.width-pad.l-pad.r,H=c.height-pad.t-pad.b,max=Math.max.apply(null,rows.map(function(r){return Number(r.value);}).concat([1])),rowH=H/rows.length;
    ctx.fillStyle='#1f2b34';ctx.font='600 17px system-ui, sans-serif';ctx.fillText(title,pad.l,28);
    ctx.font='12px system-ui, sans-serif';
    rows.forEach(function(r,i){
      const y=pad.t+i*rowH,bh=Math.min(22,rowH-8),v=Number(r.value),w=W*(v/max);
      ctx.fillStyle='#5f6f7a';ctx.textAlign='right';ctx.fillText(String(r.label||'').slice(0,24),pad.l-12,y+bh*.78);
      ctx.fillStyle='#eef2f5';ctx.fillRect(pad.l,y,W,bh);
      ctx.fillStyle=i===0?'#315f8c':'#7899b3';ctx.fillRect(pad.l,y,w,bh);
      ctx.fillStyle='#273640';ctx.textAlign='left';ctx.fillText(v.toFixed(2)+(r.suffix||''),pad.l+w+8,y+bh*.78);
    });
    ctx.textAlign='left';ctx.fillStyle='#6b7882';ctx.fillText(valueLabel||'',pad.l,c.height-16);
    return c.toDataURL('image/png');
  }

  function designModel(exp) {
    const d = LF.Analysis.designOf(exp);
    const solutions = (d.solutions || []).map(function (s) {
      const comp = [s.solutes && ('Solutes: ' + s.solutes), s.solvents && ('Solvents: ' + s.solvents), s.concentration && ('Concentration: ' + s.concentration), s.additives && ('Additives: ' + s.additives)].filter(Boolean).join('; ');
      const provenance=s.status==='user_confirmed'?'User-confirmed':s.status==='ai_inferred'?'AI-inferred':'Unconfirmed'; return { name: s.name || 'Unnamed solution', composition: comp || 'Unknown', role: s.role || '', confidence: s.confidence == null ? (s.status || 'unknown') : String(s.confidence), evidence: '['+provenance+'] '+(s.evidence || s.source || 'No explicit evidence recorded'), provenance:provenance };
    });
    const stack = (d.stack || []).map(function (l, i) { const provenance=l.status==='user_confirmed'?'User-confirmed':l.status==='ai_inferred'?'AI-inferred':'Unconfirmed'; return { order: i + 1, layer: l.role || l.layer || 'Layer ' + (i + 1), material: l.material || 'Unknown', process: [l.thickness, l.process].filter(Boolean).join(' · '), confidence: l.confidence == null ? (l.status || 'unknown') : String(l.confidence), evidence: '['+provenance+'] '+(l.evidence || l.source || 'No explicit evidence recorded'), provenance:provenance }; });
    return { solutions: solutions, stack: stack, notes: (d.process && d.process.notes) || d.notes || '' };
  }

  function reportModel(exp) {
    ensureReport(exp);
    const measurements = LF.Analysis.measurementsOf(exp);
    const analysis = LF.Analysis.analysisOf(exp);
    const findings = LF.Analysis.findingsOf(exp);
    const samples = LF.Analysis.samplesOf(exp);
    const manifest = LF.Analysis.manifestOf(exp);
    const factor = LF.Analysis.settingsOf(exp);
    const top = (analysis.bestBySample || []).slice(0, 10).map(function (x) {
      const m = measurements.find(function (y) { return y.id === x.id; }) || {};
      return { cell: x.sample, effRV: m.rv && Number.isFinite(m.rv.eff) ? m.rv.eff / factor : null, effFW: m.fw && Number.isFinite(m.fw.eff) ? m.fw.eff / factor : null, hysteresis: m.hysteresis, vocRV: m.rv && m.rv.voc, jscRV: m.rv && Number.isFinite(m.rv.jsc) ? m.rv.jsc / factor : null, ffRV: m.rv && m.rv.ff };
    });
    const refs = (analysis.topRef || []).slice(0, 10).map(function (x) {
      const m = measurements.find(function (y) { return y.id === x.id; }) || {};
      return { cell: x.sample, effRV: m.rv && Number.isFinite(m.rv.eff) ? m.rv.eff / factor : null, effFW: m.fw && Number.isFinite(m.fw.eff) ? m.fw.eff / factor : null, hysteresis: m.hysteresis, vocRV: m.rv && m.rv.voc, jscRV: m.rv && Number.isFinite(m.rv.jsc) ? m.rv.jsc / factor : null, ffRV: m.rv && m.rv.ff };
    });
    const groupMap = {};
    measurements.filter(function (m) { return m.rankingEligible; }).forEach(function (m) { groupMap[m.group] = groupMap[m.group] || []; groupMap[m.group].push(m); });
    const groupStatistics = Object.keys(groupMap).map(function (name) {
      const g = groupMap[name], eff = g.map(function (m) { return m.rv && Number.isFinite(m.rv.eff) ? m.rv.eff / factor : (m.fw && Number.isFinite(m.fw.eff) ? m.fw.eff / factor : null); }).filter(Number.isFinite).sort(function (a, b) { return a - b; });
      const voc = g.map(function (m) { return (m.rv || m.fw || {}).voc; }).filter(Number.isFinite); const jsc = g.map(function (m) { const v = (m.rv || m.fw || {}).jsc; return Number.isFinite(v) ? v / factor : null; }).filter(Number.isFinite); const ff = g.map(function (m) { return (m.rv || m.fw || {}).ff; }).filter(Number.isFinite);
      function median(a) { if (!a.length) return null; const s = a.slice().sort(function (x, y) { return x - y; }), i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; }
      return { name: name, n: g.length, medianEff: median(eff), minEff: eff.length ? eff[0] : null, maxEff: eff.length ? eff[eff.length - 1] : null, medianVoc: median(voc), medianJsc: median(jsc), medianFF: median(ff) };
    }).sort(function (a, b) { return Number(b.medianEff || 0) - Number(a.medianEff || 0); });
    const pce = values(exp, 'rv', 'eff'); const hyst = measurements.map(function (m) { return Number.isFinite(m.hysteresis) ? Math.abs(m.hysteresis) * 100 : null; }).filter(Number.isFinite);
    const scatterPoints=measurements.filter(function(m){return m.rankingEligible&&Number.isFinite(Number(m.bestEff))&&Number.isFinite(Number(m.hysteresis));}).map(function(m){return{cell:m.sample,x:Number(m.bestEff),y:Number(m.hysteresis)*100};});
    const warningHysteresis=Number((((LF.PromptRegistry.effectiveRules() || {}).pair_checks || {}).hysteresis_abs_warning) || .30) * 100;
    const figures = [], figureSelection=ensureReport(exp).figureSelection||{};
    if (exp.report.includeCharts !== false) {
      if(figureSelection.pceDistribution!==false){const p1 = makeHistogramDataUrl(pce, 'PCE distribution', 'Efficiency (%)'); if (p1) figures.push({ key:'pceDistribution', caption: 'PCE distribution · eligible RV measurements', dataUrl: p1, widthPx: 620, heightPx: 230 });}
      if(figureSelection.hysteresisDistribution!==false){const p2 = makeHistogramDataUrl(hyst, 'Hysteresis distribution', '|ΔPCE| (%)'); if (p2) figures.push({ key:'hysteresisDistribution', caption: 'Absolute hysteresis distribution', dataUrl: p2, widthPx: 620, heightPx: 230 });}
      if(figureSelection.bestJvmCurve!==false){const p3 = makeCurveDataUrl(exp); if (p3) figures.push({ key:'bestJvmCurve', caption: 'Best eligible JV curve', dataUrl: p3, widthPx: 620, heightPx: 285 });}
      if(figureSelection.efficiencyHysteresis!==false){const ps=makeScatterDataUrl(scatterPoints,'Efficiency vs hysteresis','Best PCE (%)','Hysteresis (%)',warningHysteresis);if(ps)figures.push({key:'efficiencyHysteresis',caption:'Efficiency versus hysteresis for eligible measurements',dataUrl:ps,widthPx:620,heightPx:265});}
      if(figureSelection.topEfficiency!==false){const p4=makeBarDataUrl(top.slice(0,10).map(function(x){return{label:x.cell,value:x.effRV,suffix:'%'};}),'Top eligible efficiency','RV PCE (%)');if(p4)figures.push({key:'topEfficiency',caption:'Top eligible samples by RV PCE',dataUrl:p4,widthPx:620,heightPx:Math.max(230,90+Math.min(10,top.length)*24)});}
      if(figureSelection.groupComparison!==false){const p5=makeBarDataUrl(groupStatistics.slice(0,10).map(function(g){return{label:g.name||'Ungrouped',value:g.medianEff,suffix:'%'};}),'Group comparison','Median PCE (%)');if(p5)figures.push({key:'groupComparison',caption:'Group median efficiency comparison',dataUrl:p5,widthPx:620,heightPx:Math.max(230,90+Math.min(10,groupStatistics.length)*24)});}
    }
    const bestCompact=(analysis.bestBySample||[])[0],bestMeasurement=bestCompact&&measurements.find(function(m){return m.id===bestCompact.id;});
    const bestCurve=bestMeasurement&&bestMeasurement.curve?{
      sample:bestMeasurement.sample,
      fw:(bestMeasurement.curve.fw||[]).map(function(p){return{x:Number(p.x),y:Number(p.y)/factor};}).filter(function(p){return Number.isFinite(p.x)&&Number.isFinite(p.y);}),
      rv:(bestMeasurement.curve.rv||[]).map(function(p){return{x:Number(p.x),y:Number(p.y)/factor};}).filter(function(p){return Number.isFinite(p.x)&&Number.isFinite(p.y);})
    }:null;
    const severity = { WARNING: 0, ERROR: 0 }; (findings || []).filter(function (f) { return f.status !== 'resolved'; }).forEach(function (f) { if (f.severity === 'danger') severity.ERROR++; else if (f.severity === 'warning') severity.WARNING++; });
    const fileCounts = {}; (manifest || []).forEach(function (x) { if (!x.directory) fileCounts[x.type] = (fileCounts[x.type] || 0) + 1; });
    const sync=exp.sync||{},dirty=LF.State&&LF.State.isDirty?LF.State.isDirty():!!sync.dirty,openFindings=(findings||[]).filter(function(f){return f.status!=='resolved';}),unresolvedAI=exp.aiCorrectionPlan&&Array.isArray(exp.aiCorrectionPlan.unresolved)?exp.aiCorrectionPlan.unresolved:[],designMissing=[];(exp.design&&exp.design.devices||[]).forEach(function(dev){const sols=(exp.design.solutions||[]).filter(function(sol){return(dev.solutionIds||[]).includes(sol.id);});if(!sols.length)designMissing.push((dev.name||'experiment')+': formulation');if(!(dev.stack||[]).length)designMissing.push((dev.name||'experiment')+': stack');const pr=dev.process||{};['coating','annealing','atmosphere'].forEach(function(k){if(!String(pr[k]||'').trim())designMissing.push((dev.name||'experiment')+': '+k);});});const nomadMissing=exp.nomad&&exp.nomad.mappingPlan&&Array.isArray(exp.nomad.mappingPlan.missing)?exp.nomad.mappingPlan.missing:[];
    const document=documentInfo(exp);
    return {
      title: document.title, author: exp.report.author, lab: exp.report.lab, project: exp.report.project, generatedAt: new Date().toISOString(), sourceZip: exp.meta.sourceName || '—', analysisSource: 'LabFlow working interpretation; RAW archive immutable',
      dataState:{basis:(dirty||(exp.patches||[]).length)?'Modified Working Copy':'Original import interpretation',revision:Number(sync.revision||0),savedRevision:Number(sync.savedRevision||0),dirty:!!dirty,appliedChanges:(exp.patches||[]).length,rawImmutable:true},
      missingInformation:{openFindings:openFindings.length,unresolvedAI:unresolvedAI.length,designMissing:designMissing.slice(0,40),nomadMissing:nomadMissing.slice(0,40),total:openFindings.length+unresolvedAI.length+designMissing.length+nomadMissing.length},
      markdown: document.markdown, reportKind: document.kind, documentLabel:document.label, sourceWords:document.words, sourceChars:document.chars, contentUpdatedAt:document.updatedAt, metrics: { rawJV: fileCounts.jv || 0, analyzerEligible: ((analysis.summary || {})).eligibleCount || 0 }, validationCounts: severity,
      validationIssues: (findings || []).filter(function (f) { return f.status !== 'resolved'; }).slice(0, 60).map(function (f) { return { severity: f.severity, code: f.type, message: f.title + (f.detail ? ' — ' + f.detail : '') }; }),
      top10: top, topRef: refs, reconstruction: designModel(exp), figures: figures,
      statistics: { effRV: stats(values(exp, 'rv', 'eff')), effFW: stats(values(exp, 'fw', 'eff')), hysteresisAbsPct: stats(hyst), vocRV: stats(values(exp, 'rv', 'voc')), vocFW: stats(values(exp, 'fw', 'voc')), jscRV: stats(values(exp, 'rv', 'jsc')), jscFW: stats(values(exp, 'fw', 'jsc')), ffRV: stats(values(exp, 'rv', 'ff')), ffFW: stats(values(exp, 'fw', 'ff')) },
      experimentalEvidence: { source_archive: exp.meta.sourceName || '—', files: (manifest || []).filter(function (x) { return !x.directory; }).length, samples: samples.length, measurements: measurements.length, patches: (exp.patches || []).length, policy: 'prompts/policies/data-format-repair.md' },
      groupStatistics: groupStatistics,
      anomalies: measurements.filter(function (m) { return m.qualityStatus !== 'valid'; }).slice(0, 40).map(function (m) { return { cell: m.sample, file: m.file, issue: (m.flags || []).map(function (f) { return f.label || f; }).join(', ') || m.qualityStatus, effRV: m.rv && Number.isFinite(m.rv.eff) ? m.rv.eff / factor : null, effFW: m.fw && Number.isFinite(m.fw.eff) ? m.fw.eff / factor : null, hysteresisPct: Number.isFinite(m.hysteresis) ? m.hysteresis * 100 : null, jscRV: m.rv && Number.isFinite(m.rv.jsc) ? m.rv.jsc / factor : null, jscFW: m.fw && Number.isFinite(m.fw.jsc) ? m.fw.jsc / factor : null }; }),
      chartData: { efficiencies: pce, hysteresis:hyst, scatter: scatterPoints.map(function(p){return{cell:p.cell,eff:p.x,hysteresisPct:p.y};}), bestCurve:bestCurve, groupStatistics:groupStatistics, figureSelection:figureSelection, thresholds: { hysteresisPct: warningHysteresis } },
      includeCharts: exp.report.includeCharts !== false, includeValidation: exp.report.includeValidation !== false
    };
  }

  function exportMarkdown(exp) { const info=documentInfo(exp),filename=C.safeName(exp.meta.name)+info.suffix+'.md';Log.info('export.markdown',{experimentId:exp.id,document:info.label,chars:info.chars,words:info.words,updatedAt:info.updatedAt,filename:filename});C.downloadBlob(C.textBlob(info.markdown,'text/markdown;charset=utf-8'),filename);return{filename:filename,chars:info.chars,words:info.words,kind:info.kind}; }
  function exportLatex(exp) { const info=documentInfo(exp),tex=toLatex(info.markdown),filename=C.safeName(exp.meta.name)+info.suffix+'.tex';Log.info('export.latex',{experimentId:exp.id,document:info.label,sourceChars:info.chars,outputChars:tex.length,updatedAt:info.updatedAt,filename:filename});C.downloadBlob(C.textBlob(tex,'application/x-tex;charset=utf-8'),filename);return{filename:filename,chars:info.chars,words:info.words,kind:info.kind}; }

  async function exportDocx(exp,onProgress) {
    ensureReport(exp); if (!window.ReportExport) throw new Error('Local ReportExport library is unavailable.');
    const progress=typeof onProgress==='function'?onProgress:function(){};
    const info=documentInfo(exp),end=Log.timer('export.docx',{experimentId:exp.id,document:info.label,sourceChars:info.chars,sourceWords:info.words,updatedAt:info.updatedAt});progress({stage:'Building '+info.shortLabel.toLowerCase()+' model',progress:.12});const model=reportModel(exp);progress({stage:'Building editable DOCX',progress:.42});const blob=await window.ReportExport.buildDocx(model);progress({stage:'DOCX ready',progress:1});const filename=C.safeName(exp.meta.name)+info.suffix+'.docx';C.downloadBlob(blob,filename);end({filename:filename,bytes:blob.size,figures:model.figures.length,sourceChars:info.chars},'info');return blob;
  }

  function exportPdf(exp) {
    if (!window.ReportExport) throw new Error('Local ReportExport utility is not available.');
    const info=documentInfo(exp),end=Log.timer('export.pdf',{experimentId:exp.id,document:info.label,sourceChars:info.chars,sourceWords:info.words,updatedAt:info.updatedAt});const model=reportModel(exp),blob=window.ReportExport.buildPdf(model),filename=C.safeName(exp.meta.name)+info.suffix+'.pdf';C.downloadBlob(blob,filename);end({filename:filename,bytes:blob.size,figures:model.figures.length,sourceChars:info.chars},'info');return blob;
  }

  LF.Report = { ensureReport: ensureReport, defaultMarkdown: defaultMarkdown, defaultPaperMarkdown:defaultPaperMarkdown, designEvidenceMarkdown:designEvidenceMarkdown, analysisEvidenceMarkdown:analysisEvidenceMarkdown, syncDesignEvidence:syncDesignEvidence, syncAnalysisEvidence:syncAnalysisEvidence, activeMarkdown:activeMarkdown, setActiveMarkdown:setActiveMarkdown, setKind:setKind, activeTitle:activeTitle, setActiveTitle:setActiveTitle, documentInfo:documentInfo, toLatex: toLatex, reportModel: reportModel, exportMarkdown: exportMarkdown, exportLatex: exportLatex, exportDocx: exportDocx, exportPdf: exportPdf };
}());
