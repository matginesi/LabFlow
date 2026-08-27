(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;
  const Log = LF.Logger.scope('report');

  function ensureReport(exp) {
    exp.report = exp.report || {};
    /* Report and Paper intentionally start empty. Drafting is an explicit researcher action. */
    if (typeof exp.report.labMarkdown !== 'string') exp.report.labMarkdown = (typeof exp.report.markdown === 'string' && exp.report.kind !== 'paper') ? exp.report.markdown : '';
    if (typeof exp.report.paperMarkdown !== 'string') exp.report.paperMarkdown = (typeof exp.report.markdown === 'string' && exp.report.kind === 'paper') ? exp.report.markdown : '';
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
    const defaultFigures={
      pceDistribution:true,
      hysteresisDistribution:true,
      bestJvmCurve:true,
      efficiencyHysteresis:true,
      topEfficiency:true,
      groupComparison:true
    };
    /* Figure choices are document-owned. Older saved experiments had one shared
       figureSelection; migrate it once to both documents so no choice is lost. */
    const legacyFigures=exp.report.figureSelection&&typeof exp.report.figureSelection==='object'?exp.report.figureSelection:null;
    exp.report.figureSelections=exp.report.figureSelections&&typeof exp.report.figureSelections==='object'?exp.report.figureSelections:{};
    exp.report.figureSelections.lab=Object.assign({},defaultFigures,legacyFigures||{},exp.report.figureSelections.lab||{});
    exp.report.figureSelections.paper=Object.assign({},defaultFigures,legacyFigures||{},exp.report.figureSelections.paper||{});
    exp.report.figureSelection=exp.report.figureSelections[exp.report.kind]; /* compatibility alias */
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

  function activeMarkdown(exp) { const r=ensureReport(exp); return r.kind === 'paper' ? r.paperMarkdown : r.labMarkdown; }
  function recordDocumentEdit(exp,kind,before,after,source,now){
    if(before===after)return;
    exp.documentEdits=Array.isArray(exp.documentEdits)?exp.documentEdits:[];
    const src=source==='ai'?'ai':source==='system'?'system':'user',last=exp.documentEdits[exp.documentEdits.length-1],ts=Date.parse(now),lastTs=last?Date.parse(last.updatedAt||last.createdAt||''):NaN;
    if(last&&last.kind===kind&&last.source===src&&Number.isFinite(lastTs)&&Number.isFinite(ts)&&ts-lastTs<300000){last.after=after;last.updatedAt=now;last.afterWords=(after.trim().match(/\S+/g)||[]).length;return;}
    exp.documentEdits.push({id:C.uid?C.uid('docedit'):'docedit_'+Date.now(),kind:kind,source:src,before:before,after:after,createdAt:now,updatedAt:now,beforeWords:(before.trim().match(/\S+/g)||[]).length,afterWords:(after.trim().match(/\S+/g)||[]).length});
    if(exp.documentEdits.length>80)exp.documentEdits=exp.documentEdits.slice(-80);
  }
  function setActiveMarkdown(exp, text, source) {
    const r=ensureReport(exp), value=String(text||''), kind=r.kind==='paper'?'paper':'lab', before=kind==='paper'?r.paperMarkdown:r.labMarkdown, now=new Date().toISOString();
    if(before===value)return value;
    if(kind==='paper'){r.paperMarkdown=value;r.paperUpdatedAt=now;}else{r.labMarkdown=value;r.labUpdatedAt=now;}
    r.markdown=value;r.updatedAt=now;recordDocumentEdit(exp,kind,String(before||''),value,source||'user',now);return value;
  }
  function setKind(exp, kind) { const r=ensureReport(exp); r.kind=kind==='paper'?'paper':'lab'; r.markdown=r.kind==='paper'?r.paperMarkdown:r.labMarkdown; r.title=r.kind==='paper'?r.paperTitle:r.labTitle; r.figureSelection=r.figureSelections[r.kind]; return r.kind; }
  function figureSelection(exp,kind){const r=ensureReport(exp),k=kind==='paper'?'paper':kind==='lab'?'lab':r.kind;return r.figureSelections[k];}
  function setFigure(exp,key,enabled,kind){const r=ensureReport(exp),k=kind==='paper'?'paper':kind==='lab'?'lab':r.kind,sel=r.figureSelections[k];sel[String(key||'')]=!!enabled;if(k===r.kind)r.figureSelection=sel;r.updatedAt=new Date().toISOString();return sel;}
  function figuresEnabled(exp,kind){const sel=figureSelection(exp,kind);return Object.keys(sel).some(function(k){return sel[k]!==false;});}
  function activeTitle(exp){ const r=ensureReport(exp); return r.kind==='paper'?r.paperTitle:r.labTitle; }
  function setActiveTitle(exp,title){ const r=ensureReport(exp),value=String(title||''); if(r.kind==='paper')r.paperTitle=value; else r.labTitle=value; r.title=value; r.updatedAt=new Date().toISOString(); return value; }

  /** Compact identity used by the editor, export controls and diagnostics. */
  function documentInfo(exp) {
    const r=ensureReport(exp), kind=r.kind==='paper'?'paper':'lab', markdown=activeMarkdown(exp), words=(markdown.trim().match(/\S+/g)||[]).length;
    return {kind:kind,label:kind==='paper'?'Scientific paper draft':'Laboratory report',shortLabel:kind==='paper'?'Paper':'Report',title:activeTitle(exp),markdown:markdown,words:words,chars:markdown.length,updatedAt:kind==='paper'?r.paperUpdatedAt:r.labUpdatedAt,suffix:kind==='paper'?'_paper_draft':'_lab_report'};
  }


  function latexEscape(s) {
    return String(s||'').replace(/\\/g,'\\textbackslash{}').replace(/([#$%&_{}])/g,'\\$1').replace(/~/g,'\\textasciitilde{}').replace(/\^/g,'\\textasciicircum{}');
  }
  function latexInline(text){
    const src=String(text||''),re=/(\$[^$\n]+\$|\\\([^\n]*?\\\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]*\))/g;let out='',last=0,m;
    while((m=re.exec(src))){if(m.index>last)out+=latexEscape(src.slice(last,m.index));const t=m[0];if(t[0]==='$'||t.startsWith('\\('))out+=t;else if(t.startsWith('**'))out+='\\textbf{'+latexInline(t.slice(2,-2))+'}';else if(t.startsWith('`'))out+='\\texttt{'+latexEscape(t.slice(1,-1))+'}';else if(t.startsWith('*'))out+='\\emph{'+latexInline(t.slice(1,-1))+'}';else{const mm=t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);out+=mm?'\\href{'+latexEscape(mm[2])+'}{'+latexInline(mm[1])+'}':latexEscape(t);}last=m.index+t.length;}
    if(last<src.length)out+=latexEscape(src.slice(last));return out;
  }
  function toLatex(md) {
    const lines=String(md||'').replace(/\r\n/g,'\n').split('\n'),out=[];let list=null;
    function closeList(){if(list){out.push('\\end{'+list+'}');list=null;}}
    for(let i=0;i<lines.length;){const line=lines[i];
      const same=line.match(/^\s*\$\$([\s\S]*?)\$\$\s*$/);if(same){closeList();out.push('\\['+same[1].trim()+'\\]');i++;continue;}
      if(/^\s*\$\$\s*$/.test(line)){closeList();const eq=[];i++;while(i<lines.length&&!/^\s*\$\$\s*$/.test(lines[i])){eq.push(lines[i]);i++;}if(i<lines.length)i++;out.push('\\[\n'+eq.join('\n').trim()+'\n\\]');continue;}
      const bracket=line.match(/^\s*\\\[([\s\S]*?)\\\]\s*$/);if(bracket){closeList();out.push('\\['+bracket[1].trim()+'\\]');i++;continue;}
      if(/^\s*\\\[\s*$/.test(line)){closeList();const eq=[];i++;while(i<lines.length&&!/^\s*\\\]\s*$/.test(lines[i])){eq.push(lines[i]);i++;}if(i<lines.length)i++;out.push('\\[\n'+eq.join('\n').trim()+'\n\\]');continue;}
      const h=line.match(/^(#{1,4})\s+(.+)$/);if(h){closeList();const cmd=h[1].length===1?'section*':h[1].length===2?'section':h[1].length===3?'subsection':'subsubsection';out.push('\\'+cmd+'{'+latexInline(h[2])+'}');i++;continue;}
      const ul=line.match(/^\s*[-*]\s+(.+)$/),ol=line.match(/^\s*\d+[.)]\s+(.+)$/);if(ul||ol){const wanted=ul?'itemize':'enumerate';if(list!==wanted){closeList();list=wanted;out.push('\\begin{'+list+'}');}out.push('\\item '+latexInline((ul||ol)[1]));i++;continue;}
      closeList();if(!line.trim()){out.push('');i++;continue;}if(/^>\s?/.test(line)){out.push('\\begin{quote}'+latexInline(line.replace(/^>\s?/,''))+'\\end{quote}');i++;continue;}out.push(latexInline(line));i++;
    }
    closeList();
    return '\\documentclass[11pt,a4paper]{article}\n\\usepackage[margin=24mm]{geometry}\n\\usepackage{booktabs}\n\\usepackage{graphicx}\n\\usepackage{xcolor}\n\\usepackage{hyperref}\n\\definecolor{labflow}{HTML}{1967D2}\n\\begin{document}\n'+out.join('\n')+'\n\\end{document}\n';
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

  function makeMeasurementCurveDataUrl(exp,m,title) {
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
    ctx.fillStyle = '#16202a'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(title || ('JV curve — ' + (m.sample || m.id || 'measurement')), pad.l, 26);
    ctx.fillStyle = '#62707d'; ctx.font = '12px sans-serif'; ctx.fillText('Voltage (V)', c.width / 2 - 28, c.height - 16); ctx.save(); ctx.translate(18, c.height / 2 + 40); ctx.rotate(-Math.PI / 2); ctx.fillText('Current density (mA/cm²)', 0, 0); ctx.restore();
    ctx.fillStyle = '#1967d2'; ctx.fillRect(c.width - 190, 20, 18, 3); ctx.fillStyle = '#16202a'; ctx.fillText('Forward (FW)', c.width - 165, 25); ctx.fillStyle = '#df3f3f'; ctx.fillRect(c.width - 92, 20, 18, 3); ctx.fillStyle = '#16202a'; ctx.fillText('Reverse', c.width - 68, 25);
    return c.toDataURL('image/png');
  }
  function makeCurveDataUrl(exp) {
    const bestCompact = (LF.Analysis.analysisOf(exp) || {}).bestBySample[0];
    if (!bestCompact) return null;
    const m = LF.Analysis.measurementsOf(exp).find(function (x) { return x.id === bestCompact.id; });
    return makeMeasurementCurveDataUrl(exp,m,m ? ('Best eligible JV curve — '+(m.sample||m.id)) : 'Best eligible JV curve');
  }
  function makeOverlayCurveDataUrl(exp,measurements,title) {
    const rows=(measurements||[]).filter(function(m){return m&&m.curve&&((m.curve.fw||[]).length||(m.curve.rv||[]).length);}).slice(0,24);
    if(!rows.length)return null;
    const factor=LF.Analysis.settingsOf(exp),all=[];
    rows.forEach(function(m){[].concat(m.curve.fw||[],m.curve.rv||[]).forEach(function(p){if(Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y)))all.push({x:Number(p.x),y:Number(p.y)/factor});});});
    if(!all.length)return null;
    const c=document.createElement('canvas');c.width=920;c.height=430;const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);
    let xmin=Math.min.apply(null,all.map(function(p){return p.x;})),xmax=Math.max.apply(null,all.map(function(p){return p.x;})),ymin=Math.min.apply(null,all.map(function(p){return p.y;})),ymax=Math.max.apply(null,all.map(function(p){return p.y;}));if(xmax===xmin)xmax=xmin+1;if(ymax===ymin)ymax=ymin+1;
    const pad={l:72,r:32,t:48,b:56},W=c.width-pad.l-pad.r,H=c.height-pad.t-pad.b,X=function(x){return pad.l+(x-xmin)/(xmax-xmin)*W;},Y=function(y){return pad.t+H-(y-ymin)/(ymax-ymin)*H;};
    ctx.strokeStyle='#d9e0e7';for(let i=0;i<=5;i++){const y=pad.t+i*H/5;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(c.width-pad.r,y);ctx.stroke();}
    const palette=['#1967d2','#df3f3f','#2a8c6f','#8c63b8','#c58b2a','#4f7f9c','#a35b82','#63763c'];
    rows.forEach(function(m,i){const arr=(m.curve.rv&&m.curve.rv.length)?m.curve.rv:(m.curve.fw||[]);ctx.strokeStyle=palette[i%palette.length];ctx.globalAlpha=.72;ctx.lineWidth=1.6;ctx.beginPath();arr.forEach(function(p,j){const x=X(Number(p.x)),y=Y(Number(p.y)/factor);if(!j)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();});ctx.globalAlpha=1;
    ctx.fillStyle='#16202a';ctx.font='bold 16px sans-serif';ctx.fillText(title||'JV overlay',pad.l,26);ctx.fillStyle='#62707d';ctx.font='12px sans-serif';ctx.fillText('Voltage (V)',c.width/2-28,c.height-16);ctx.save();ctx.translate(18,c.height/2+40);ctx.rotate(-Math.PI/2);ctx.fillText('Current density (mA/cm²)',0,0);ctx.restore();ctx.fillText(rows.length+' curves',c.width-90,26);
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

  function figureSelectionForModel(exp){return Object.assign({},figureSelection(exp));}

  function reportModelData(exp) {
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
    const fallbackGroupStatistics = Object.keys(groupMap).map(function (name) {
      const g = groupMap[name], eff = g.map(function (m) { return m.rv && Number.isFinite(m.rv.eff) ? m.rv.eff / factor : (m.fw && Number.isFinite(m.fw.eff) ? m.fw.eff / factor : null); }).filter(Number.isFinite).sort(function (a, b) { return a - b; });
      const voc = g.map(function (m) { return (m.rv || m.fw || {}).voc; }).filter(Number.isFinite); const jsc = g.map(function (m) { const v = (m.rv || m.fw || {}).jsc; return Number.isFinite(v) ? v / factor : null; }).filter(Number.isFinite); const ff = g.map(function (m) { return (m.rv || m.fw || {}).ff; }).filter(Number.isFinite);
      function median(a) { if (!a.length) return null; const s = a.slice().sort(function (x, y) { return x - y; }), i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; }
      return { name: name, n: g.length, medianEff: median(eff), minEff: eff.length ? eff[0] : null, maxEff: eff.length ? eff[eff.length - 1] : null, medianVoc: median(voc), medianJsc: median(jsc), medianFF: median(ff) };
    }).sort(function (a, b) { return Number(b.medianEff || 0) - Number(a.medianEff || 0); });
    const pce = values(exp, 'rv', 'eff'); const hyst = measurements.map(function (m) { return Number.isFinite(m.hysteresis) ? Math.abs(m.hysteresis) * 100 : null; }).filter(Number.isFinite);
    const scatterPoints = measurements.filter(function (m) { return m.rankingEligible && Number.isFinite(Number(m.bestEff)) && Number.isFinite(Number(m.hysteresis)); }).map(function (m) { return { cell: m.sample, x: Number(m.bestEff), y: Number(m.hysteresis) * 100 }; });
    const bundle = (LF.AnalysisSummary && LF.AnalysisSummary.fresh(exp)) ? LF.AnalysisSummary.ensure(exp) : null;
    function emptyStats() { return { n: 0, min: null, q1: null, median: null, mean: null, q3: null, max: null, std: null }; }
    function fieldStats(s) { return s ? { n: s.n, min: s.min, q1: s.q1, median: s.median, mean: s.mean, q3: s.q3, max: s.max, std: s.std } : emptyStats(); }
    function medianOf(v) { const a = v.filter(Number.isFinite).sort(function (x, y) { return x - y; }); if (!a.length) return null; const i = Math.floor(a.length / 2); return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2; }
    function perGroupMedian(key) {
      const map = {};
      measurements.filter(function (m) { return m.rankingEligible; }).forEach(function (m) {
        const v = Number((m.rv || m.fw || {})[key]); if (!Number.isFinite(v)) return;
        const g = m.group || 'ungrouped'; (map[g] = map[g] || []).push(key === 'jsc' ? v / factor : v);
      });
      const out = {}; Object.keys(map).forEach(function (g) { out[g] = medianOf(map[g]); }); return out;
    }
    const statistics = bundle ? {
      effRV: fieldStats(bundle.metrics.eff.rv), effFW: fieldStats(bundle.metrics.eff.fw), hysteresisAbsPct: fieldStats(bundle.hysteresisAbsPct),
      vocRV: fieldStats(bundle.metrics.voc.rv), vocFW: fieldStats(bundle.metrics.voc.fw), jscRV: fieldStats(bundle.metrics.jsc.rv), jscFW: fieldStats(bundle.metrics.jsc.fw),
      ffRV: fieldStats(bundle.metrics.ff.rv), ffFW: fieldStats(bundle.metrics.ff.fw)
    } : { effRV: stats(values(exp, 'rv', 'eff')), effFW: stats(values(exp, 'fw', 'eff')), hysteresisAbsPct: stats(hyst), vocRV: stats(values(exp, 'rv', 'voc')), vocFW: stats(values(exp, 'fw', 'voc')), jscRV: stats(values(exp, 'rv', 'jsc')), jscFW: stats(values(exp, 'fw', 'jsc')), ffRV: stats(values(exp, 'rv', 'ff')), ffFW: stats(values(exp, 'fw', 'ff')) };
    const groupStatistics = bundle ? (function () {
      const voc = perGroupMedian('voc'), jsc = perGroupMedian('jsc'), ff = perGroupMedian('ff');
      return bundle.groupStatistics.map(function (g) {
        const s = (g.scans && (g.scans.rv || g.scans.fw)) || null;
        return { name: g.name, n: g.n, scans: g.scans || null, medianEff: s ? s.median : null, minEff: s ? s.min : null, maxEff: s ? s.max : null, medianVoc: voc[g.name] != null ? voc[g.name] : null, medianJsc: jsc[g.name] != null ? jsc[g.name] : null, medianFF: ff[g.name] != null ? ff[g.name] : null };
      }).sort(function (a, b) { return Number(b.medianEff || 0) - Number(a.medianEff || 0); });
    })() : fallbackGroupStatistics;
    const warningHysteresis=Number((((LF.PromptRegistry.effectiveRules() || {}).pair_checks || {}).hysteresis_abs_warning) || .30) * 100;
    const figureSelection=figureSelectionForModel(exp);
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
      top10: top, topRef: refs, reconstruction: designModel(exp),
      statistics: statistics,
      experimentalEvidence: { source_archive: exp.meta.sourceName || '—', files: (manifest || []).filter(function (x) { return !x.directory; }).length, samples: samples.length, measurements: measurements.length, patches: (exp.patches || []).length, policy: 'prompts/policies/data-format-repair.md' },
      groupStatistics: groupStatistics,
      anomalies: measurements.filter(function (m) { return m.qualityStatus !== 'valid'; }).slice(0, 40).map(function (m) { return { cell: m.sample, file: m.file, issue: (m.flags || []).map(function (f) { return f.label || f; }).join(', ') || m.qualityStatus, effRV: m.rv && Number.isFinite(m.rv.eff) ? m.rv.eff / factor : null, effFW: m.fw && Number.isFinite(m.fw.eff) ? m.fw.eff / factor : null, hysteresisPct: Number.isFinite(m.hysteresis) ? m.hysteresis * 100 : null, jscRV: m.rv && Number.isFinite(m.rv.jsc) ? m.rv.jsc / factor : null, jscFW: m.fw && Number.isFinite(m.fw.jsc) ? m.fw.jsc / factor : null }; }),
      chartData: bundle ? Object.assign({}, bundle.chartData, { groupStatistics: groupStatistics, figureSelection: figureSelection }) : { efficiencies: pce, hysteresis: hyst, scatter: scatterPoints.map(function (p) { return { cell: p.cell, eff: p.x, hysteresisPct: p.y }; }), bestCurve: bestCurve, groupStatistics: groupStatistics, figureSelection: figureSelection, thresholds: { hysteresisPct: warningHysteresis } },
      includeCharts: figuresEnabled(exp), includeValidation: exp.report.includeValidation !== false
    };
  }

  const figureCache = (window.LF_reportFigureCache = window.LF_reportFigureCache || {});
  const figureCatalogCache = (window.LF_reportFigureCatalogCache = window.LF_reportFigureCatalogCache || {});
  const figureRasterCache = (window.LF_reportFigureRasterCache = window.LF_reportFigureRasterCache || {});
  function figureFingerprint(exp, sel, includeCharts) { return String(exp.id) + ':' + Number(exp.sync && exp.sync.revision) + ':' + (sel ? JSON.stringify(sel) : '') + ':' + String(!!includeCharts); }
  function figureCatalogFingerprint(exp){return String(exp.id)+':'+Number(exp.sync&&exp.sync.revision)+':catalog';}
  function figureDefaultSelected(fig){return !fig||fig.defaultSelected!==false;}
  function figureSelected(exp,key,kind,fig){const sel=figureSelection(exp,kind);return Object.prototype.hasOwnProperty.call(sel,key)?sel[key]!==false:figureDefaultSelected(fig);}
  function materializeFigure(exp,fig){
    if(!fig)return null;const key=figureCatalogFingerprint(exp)+':'+fig.key;if(figureRasterCache[key])return figureRasterCache[key];
    let dataUrl='';try{dataUrl=typeof fig.render==='function'?fig.render():fig.dataUrl||'';}catch(err){if(Log)Log.warn('figure.render-failed',{key:fig.key,error:err});}
    if(!dataUrl)return null;const out=Object.assign({},fig,{dataUrl:dataUrl});delete out.render;figureRasterCache[key]=out;return out;
  }
  function allFigureCatalog(exp){
    const cacheKey=figureCatalogFingerprint(exp);if(figureCatalogCache[cacheKey])return figureCatalogCache[cacheKey];
    const model=reportModelData(exp),chart=model.chartData||{},figures=[];
    function add(fig){if(fig)figures.push(fig);}
    add({key:'pceDistribution',group:'Overview',label:'PCE distribution',caption:'PCE distribution · eligible RV measurements',widthPx:620,heightPx:230,defaultSelected:true,render:function(){return makeHistogramDataUrl(chart.efficiencies,'PCE distribution','Efficiency (%)');}});
    add({key:'hysteresisDistribution',group:'Overview',label:'Hysteresis distribution',caption:'Absolute hysteresis distribution',widthPx:620,heightPx:230,defaultSelected:true,render:function(){return makeHistogramDataUrl(chart.hysteresis,'Hysteresis distribution','|ΔPCE| (%)');}});
    add({key:'bestJvmCurve',group:'Overview',label:'Best JV curve',caption:'Best eligible JV curve',widthPx:620,heightPx:285,defaultSelected:true,render:function(){return makeCurveDataUrl(exp);}});
    add({key:'efficiencyHysteresis',group:'Overview',label:'PCE vs hysteresis',caption:'Efficiency versus hysteresis for eligible measurements',widthPx:620,heightPx:265,defaultSelected:true,render:function(){return makeScatterDataUrl((chart.scatter||[]).map(function(p){return{cell:p.cell,x:p.eff!=null?p.eff:p.x,y:p.hysteresisPct!=null?p.hysteresisPct:p.y};}),'Efficiency vs hysteresis','Best PCE (%)','Hysteresis (%)',chart.thresholds&&chart.thresholds.hysteresisPct);}});
    add({key:'topEfficiency',group:'Overview',label:'Top efficiency',caption:'Top eligible samples by RV PCE',widthPx:620,heightPx:Math.max(230,90+Math.min(10,model.top10.length)*24),defaultSelected:true,render:function(){return makeBarDataUrl(model.top10.slice(0,10).map(function(x){return{label:x.cell,value:x.effRV,suffix:'%'};}),'Top eligible efficiency','RV PCE (%)');}});
    add({key:'groupComparison',group:'Overview',label:'Group comparison',caption:'Group median efficiency comparison',widthPx:620,heightPx:Math.max(230,90+Math.min(12,model.groupStatistics.length)*24),defaultSelected:true,render:function(){return makeBarDataUrl(model.groupStatistics.slice(0,12).map(function(g){return{label:g.name||'Ungrouped',value:g.medianEff,suffix:'%'};}),'Group comparison','Median PCE (%)');}});
    const measurements=LF.Analysis.measurementsOf(exp).filter(function(m){return m&&m.curve&&((m.curve.fw||[]).length||(m.curve.rv||[]).length);});
    const groups={};measurements.forEach(function(m){const g=String(m.group||'Ungrouped');(groups[g]=groups[g]||[]).push(m);});
    Object.keys(groups).sort().forEach(function(group){const rows=groups[group];if(rows.length<2)return;add({key:'groupOverlay:'+group,group:'Group overlays',label:group+' overlay',caption:'JV overlay · '+group+' · '+rows.length+' curves',widthPx:620,heightPx:285,defaultSelected:false,search:[group,'overlay','JV'].join(' '),render:function(){return makeOverlayCurveDataUrl(exp,rows,'JV overlay — '+group);}});});
    measurements.forEach(function(m){const label=String(m.sample||m.id||'Measurement'),meta=[m.group,m.file].filter(Boolean).join(' · '),key='jv:'+String(m.id);add({key:key,group:'Individual JV curves',label:label,caption:'JV curve · '+label+(meta?' · '+meta:''),widthPx:620,heightPx:285,defaultSelected:false,search:[label,m.group,m.file,m.id,'JV'].filter(Boolean).join(' '),render:function(){return makeMeasurementCurveDataUrl(exp,m,'JV curve — '+label);}});});
    figureCatalogCache[cacheKey]=figures;return figures;
  }

  /* Preview/export only rasterize selected figures. The picker may request the
     full catalog to preview every available dataset-specific figure. */
  function reportFigurePreviews(exp) {
    const r=ensureReport(exp),sel=figureSelection(exp),includeCharts=figuresEnabled(exp),key=figureFingerprint(exp,sel,includeCharts);if(figureCache[key])return figureCache[key];
    const figures=includeCharts?allFigureCatalog(exp).filter(function(fig){return figureSelected(exp,fig.key,r.kind,fig);}).map(function(fig){return materializeFigure(exp,fig);}).filter(Boolean):[];figureCache[key]=figures;return figures;
  }
  function reportFigureChoices(exp){ensureReport(exp);return allFigureCatalog(exp).map(function(fig){const out=Object.assign({},fig);delete out.render;delete out.dataUrl;return out;});}
  function reportFigureByKey(exp,key){ensureReport(exp);const fig=allFigureCatalog(exp).find(function(item){return String(item.key)===String(key);});return fig?materializeFigure(exp,fig):null;}
  function reportFigureCatalog(exp){ensureReport(exp);return allFigureCatalog(exp).map(function(fig){return materializeFigure(exp,fig)||Object.assign({},fig,{dataUrl:''});});}

  function reportContextData(exp) {
    const m=reportModelData(exp);
    return {
      dataState:m.dataState, missingInformation:m.missingInformation, metrics:m.metrics,
      validationCounts:m.validationCounts, validationIssues:(m.validationIssues||[]).slice(0,40),
      top10:(m.top10||[]).slice(0,10), topRef:(m.topRef||[]).slice(0,10),
      statistics:m.statistics, groupStatistics:(m.groupStatistics||[]).slice(0,16),
      anomalies:(m.anomalies||[]).slice(0,24), experimentalEvidence:m.experimentalEvidence,
      reconstruction:m.reconstruction
    };
  }

  function reportModel(exp) {
    const model = reportModelData(exp);
    model.figures = reportFigurePreviews(exp);
    return model;
  }

  function exportMarkdown(exp) { const info=documentInfo(exp),filename=C.safeName(exp.meta.name)+info.suffix+'.md';Log.info('export.markdown',{experimentId:exp.id,document:info.label,chars:info.chars,words:info.words,updatedAt:info.updatedAt,filename:filename});C.downloadBlob(C.textBlob(info.markdown,'text/markdown;charset=utf-8'),filename);return{filename:filename,chars:info.chars,words:info.words,kind:info.kind}; }
  function exportLatex(exp) { const info=documentInfo(exp),tex=toLatex(info.markdown),filename=C.safeName(exp.meta.name)+info.suffix+'.tex';Log.info('export.latex',{experimentId:exp.id,document:info.label,sourceChars:info.chars,outputChars:tex.length,updatedAt:info.updatedAt,filename:filename});C.downloadBlob(C.textBlob(tex,'application/x-tex;charset=utf-8'),filename);return{filename:filename,chars:info.chars,words:info.words,kind:info.kind}; }

  async function exportDocx(exp,onProgress) {
    ensureReport(exp); if (!window.ReportExport) throw new Error('Local ReportExport library is unavailable.');
    const progress=typeof onProgress==='function'?onProgress:function(){},info=documentInfo(exp),end=Log.timer('export.docx',{experimentId:exp.id,document:info.label,sourceChars:info.chars,sourceWords:info.words,updatedAt:info.updatedAt});
    progress({stage:'Building '+info.shortLabel.toLowerCase()+' model',progress:.10});const model=reportModel(exp);progress({stage:'Rendering LaTeX equations',progress:.28});model.mathImages=LF.Math&&LF.Math.renderDisplayEquations?await LF.Math.renderDisplayEquations(info.markdown):[];progress({stage:'Building editable DOCX',progress:.48});const blob=await window.ReportExport.buildDocx(model);progress({stage:'DOCX ready',progress:1});const filename=C.safeName(exp.meta.name)+info.suffix+'.docx';C.downloadBlob(blob,filename);end({filename:filename,bytes:blob.size,figures:model.figures.length,equations:model.mathImages.length,sourceChars:info.chars},'info');return blob;
  }

  async function exportPdf(exp,onProgress) {
    if (!window.ReportExport) throw new Error('Local ReportExport utility is not available.');
    const progress=typeof onProgress==='function'?onProgress:function(){},info=documentInfo(exp),end=Log.timer('export.pdf',{experimentId:exp.id,document:info.label,sourceChars:info.chars,sourceWords:info.words,updatedAt:info.updatedAt});progress({stage:'Building '+info.shortLabel.toLowerCase()+' model',progress:.10});const model=reportModel(exp);progress({stage:'Rendering LaTeX equations',progress:.30});model.mathImages=LF.Math&&LF.Math.renderDisplayEquations?await LF.Math.renderDisplayEquations(info.markdown):[];progress({stage:'Rendering PDF',progress:.55});const blob=window.ReportExport.buildPdfAsync?await window.ReportExport.buildPdfAsync(model,function(x){progress({stage:x.stage||'Rendering PDF',progress:.55+Number(x.progress||0)*.4});}):window.ReportExport.buildPdf(model),filename=C.safeName(exp.meta.name)+info.suffix+'.pdf';C.downloadBlob(blob,filename);progress({stage:'PDF ready',progress:1});end({filename:filename,bytes:blob.size,figures:model.figures.length,equations:model.mathImages.length,sourceChars:info.chars},'info');return blob;
  }

  LF.Report = { ensureReport: ensureReport, designEvidenceMarkdown:designEvidenceMarkdown, syncDesignEvidence:syncDesignEvidence, activeMarkdown:activeMarkdown, setActiveMarkdown:setActiveMarkdown, setKind:setKind, figureSelection:figureSelection, setFigure:setFigure, figureSelected:figureSelected, figuresEnabled:figuresEnabled, activeTitle:activeTitle, setActiveTitle:setActiveTitle, documentInfo:documentInfo, toLatex: toLatex, reportModel: reportModel, reportContextData:reportContextData, reportFigurePreviews: reportFigurePreviews, reportFigureChoices:reportFigureChoices, reportFigureByKey:reportFigureByKey, reportFigureCatalog:reportFigureCatalog, exportMarkdown: exportMarkdown, exportLatex: exportLatex, exportDocx: exportDocx, exportPdf: exportPdf };
}());
