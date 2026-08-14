(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {}, C = LF.Core, A = LF.Analysis;

  function num(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }

  function stats(values) {
    const a = values.map(num).filter(function (n) { return n !== null; });
    if (!a.length) return null;
    a.sort(function (x, y) { return x - y; });
    function q(p) { const pos = (a.length - 1) * p, b = Math.floor(pos), r = pos - b; return a[b + 1] !== undefined ? a[b] + r * (a[b + 1] - a[b]) : a[b]; }
    const sum = a.reduce(function (s, v) { return s + v; }, 0), mean = sum / a.length;
    const variance = a.length > 1 ? a.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / (a.length - 1) : 0;
    return { n: a.length, min: a[0], q1: q(0.25), median: q(0.5), mean: mean, q3: q(0.75), max: a[a.length - 1], std: Math.sqrt(variance) };
  }

  function dirValues(ms, dir, key, factor) {
    return ms.map(function (m) {
      const x = m[dir]; if (!x) return null;
      const v = Number(x[key]); if (!Number.isFinite(v)) return null;
      return (key === 'eff' || key === 'jsc') ? v / factor : v;
    });
  }
  function dirStats(ms, dir, key, factor) { return stats(dirValues(ms, dir, key, factor)); }
  function metricField(ms, key, factor) { return { fw: dirStats(ms, 'fw', key, factor), rv: dirStats(ms, 'rv', key, factor) }; }

  function hysteresisPct(ms) {
    return stats(ms.map(function (m) { const h = num(m.hysteresis); return h === null ? null : h * 100; }));
  }

  function dataState(exp) {
    const sync = exp.sync || {};
    return { basis: (exp.patches || []).length ? 'Modified Working Copy' : 'Original import interpretation', revision: Number(sync.revision) || 0, savedRevision: Number(sync.savedRevision) || 0, dirty: !!sync.dirty, appliedChanges: (exp.patches || []).length };
  }

  function chartDataOf(exp) {
    const ms = A.measurementsOf(exp), factor = A.settingsOf(exp), best = (A.analysisOf(exp).bestBySample || [])[0], bestM = best && ms.find(function (m) { return m.id === best.id; });
    const eligible = ms.filter(function (m) { return m.rankingEligible; });
    const rules = (LF.PromptRegistry && LF.PromptRegistry.effectiveRules) ? LF.PromptRegistry.effectiveRules() : {};
    const warningHysteresis = Number((((rules || {}).pair_checks || {}).hysteresis_abs_warning) || 0.30) * 100;
    function factorY(p) { return { x: Number(p.x), y: Number(p.y) / factor }; }
    return {
      efficiencies: ms.map(function (m) { const v = m.rv && m.rv.eff, n = num(v); return n === null ? null : n / factor; }).filter(function (n) { return n !== null; }),
      hysteresis: ms.map(function (m) { const h = num(m.hysteresis); return h === null ? null : Math.abs(h) * 100; }).filter(function (n) { return n !== null; }),
      scatter: eligible.filter(function (m) { return num(m.bestEff) !== null && num(m.hysteresis) !== null; }).map(function (m) { return { cell: m.sample, eff: num(m.bestEff), hysteresisPct: (num(m.hysteresis) || 0) * 100 }; }),
      bestCurve: bestM ? { sample: bestM.sample, fw: (bestM.curve && bestM.curve.fw || []).map(factorY), rv: (bestM.curve && bestM.curve.rv || []).map(factorY) } : null,
      thresholds: { hysteresisPct: warningHysteresis },
      figureSelection: (LF.Report&&LF.Report.figureSelection?LF.Report.figureSelection(exp):(exp.report && exp.report.figureSelection)) || {}
    };
  }

  function groupStatisticsOf(exp) {
    const ms = A.measurementsOf(exp), factor = A.settingsOf(exp), map = {};
    /* Same eligible scope and group naming the Results Compare view uses, so the
       bundle is a valid single source for the per-scan statistics table. */
    ms.forEach(function (m) {
      if (!m.rankingEligible) return;
      const key = String(m.group || '').trim() || 'Ungrouped';
      map[key] = map[key] || { name: key, valsFW: [], valsRV: [] };
      const fw = m.fw && num(m.fw.eff), rv = m.rv && num(m.rv.eff);
      if (fw !== null) map[key].valsFW.push(fw / factor);
      if (rv !== null) map[key].valsRV.push(rv / factor);
    });
    return Object.keys(map).sort().map(function (k) {
      const g = map[k];
      return { name: k, n: Math.max(g.valsFW.length, g.valsRV.length), scans: { fw: stats(g.valsFW), rv: stats(g.valsRV) } };
    });
  }

  function anomaliesOf(exp) {
    return A.measurementsOf(exp).filter(function (m) { return m.qualityStatus !== 'valid' || (m.flags || []).length; }).slice(0, 24).map(function (m) {
      return { sample: m.sample, file: m.file, note: (m.flags || []).map(function (f) { return f.label || f; }).join(', ') || m.qualityStatus };
    });
  }

  function findingsOf(exp) {
    const all = exp.findings || [], open = all.filter(function (f) { return f.status !== 'resolved'; });
    const bySeverity = { info: 0, warning: 0, danger: 0 };
    open.forEach(function (f) { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; });
    return { open: open.length, total: all.length, resolved: all.length - open.length, bySeverity: bySeverity };
  }

  function topOf(exp, key) { return ((A.analysisOf(exp)[key]) || []).slice(0, 10); }

  function collect(exp) {
    const ms = A.measurementsOf(exp), factor = A.settingsOf(exp);
    return {
      version: 1, generatedAt: new Date().toISOString(),
      sourceRevision: Number(exp.sync && exp.sync.revision) || 0,
      dataState: dataState(exp),
      metrics: { eff: metricField(ms, 'eff', factor), voc: metricField(ms, 'voc', factor), jsc: metricField(ms, 'jsc', factor), ff: metricField(ms, 'ff', factor) },
      hysteresisAbsPct: hysteresisPct(ms),
      groupStatistics: groupStatisticsOf(exp),
      chartData: chartDataOf(exp),
      topNonRef: topOf(exp, 'topNonRef'), topRef: topOf(exp, 'topRef'), bestBySample: topOf(exp, 'bestBySample'),
      anomalies: anomaliesOf(exp),
      findings: findingsOf(exp)
    };
  }

  function fresh(exp) {
    const b = exp.analysisSummary;
    return !!b && Number(b.sourceRevision) === Number(exp.sync && exp.sync.revision) && !!(exp.analysis && exp.analysis.summary);
  }

  function ensure(exp) { return fresh(exp) ? exp.analysisSummary : collect(exp); }

  function designCoverage(exp) {
    const d=exp.design||{},devices=d.devices||[],solutions=d.solutions||[];
    const fields={stack:0,solutions:0,coating:0,annealing:0,atmosphere:0};
    devices.forEach(function(dev){if((dev.stack||[]).length)fields.stack++;if((dev.solutionIds||[]).length)fields.solutions++;const p=dev.process||{};['coating','annealing','atmosphere'].forEach(function(k){if(String(p[k]||'').trim())fields[k]++;});});
    return {devices:devices.length,solutions:solutions.length,known:fields,missing_device_fields:devices.reduce(function(n,dev){const p=dev.process||{};return n+((dev.stack||[]).length?0:1)+((dev.solutionIds||[]).length?0:1)+(String(p.coating||'').trim()?0:1)+(String(p.annealing||'').trim()?0:1)+(String(p.atmosphere||'').trim()?0:1);},0)};
  }
  function fileProfile(exp){const counts={};(exp.files||[]).forEach(function(f){const k=String(f.family||f.type||f.extension||'unknown');counts[k]=(counts[k]||0)+1;});return Object.keys(counts).sort().map(function(k){return{family:k,count:counts[k]};});}
  function fnv1a(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return('00000000'+(h>>>0).toString(16)).slice(-8);}
  function scientificSignature(exp){
    const payload={
      files:(exp.files||[]).map(function(f){return[f.id||'',f.family||f.type||'',f.canonicalPath||f.path||'',f.canonicalName||f.name||''];}),
      measurements:(exp.measurements||[]).map(function(m){return[m.id||'',m.sample||'',m.group||'',!!m.isRef,!!m.excluded,m.qualityStatus||'',m.bestEff,m.hysteresis,m.fw||null,m.rv||null];}),
      samples:(exp.samples||[]).map(function(s){return[s.id||'',s.name||'',s.group||'',!!s.isRef,(s.measurementIds||[]).slice()];}),
      design:{devices:(exp.design&&exp.design.devices||[]),solutions:(exp.design&&exp.design.solutions||[])},
      findings:(exp.findings||[]).map(function(f){return[f.id||'',f.type||'',f.status||'',f.severity||'',f.target||'',f.measurementId||'',f.title||'',f.detail||''];}),
      analysisSettings:exp.analysisSettings||{}
    };
    return 'sci-'+fnv1a(JSON.stringify(payload));
  }
  function deterministicBrief(exp){
    const bundle=ensure(exp),summary=(A.analysisOf(exp)||{}).summary||{},groups=bundle.groupStatistics||[],topRef=bundle.topRef||[],topNonRef=bundle.topNonRef||[],open=(exp.findings||[]).filter(function(f){return f.status!=='resolved';});
    return {
      source_revision:Number(exp.sync&&exp.sync.revision)||0,
      scope:{samples:Number(summary.sampleCount||0),measurements:Number(summary.measurementCount||0),eligible:Number(summary.eligibleCount||0),files:(exp.files||[]).length,file_families:fileProfile(exp)},
      performance:{best_sample:summary.bestSample||'',best_efficiency:summary.bestEfficiency,mean_efficiency:summary.meanEfficiency,median_efficiency:summary.medianEfficiency,top_reference:topRef.slice(0,5),top_non_reference:topNonRef.slice(0,5)},
      comparisons:groups.slice(0,16),
      quality:{valid:Number(summary.validCount||0),review:Number(summary.reviewCount||0),blocked:Number(summary.blockedCount||0),open_findings:open.length,anomalies:(bundle.anomalies||[]).slice(0,12)},
      design:designCoverage(exp),
      unresolved:open.slice(0,16).map(function(f){return{id:f.id||'',type:f.type||'',severity:f.severity||'info',title:f.title||'',target:f.target||'',detail:String(f.detail||'').slice(0,360)};})
    };
  }
  function briefFresh(exp){return !!(exp.experimentBrief&&String(exp.experimentBrief.inputSignature||'')===scientificSignature(exp));}
  function brief(exp){
    const rev=Number(exp.sync&&exp.sync.revision)||0,signature=scientificSignature(exp),prev=exp.experimentBrief||{},det=deterministicBrief(exp),ai=prev.ai&&String(prev.ai.inputSignature||prev.inputSignature||'')===signature?prev.ai:null;
    exp.experimentBrief={version:2,generatedAt:new Date().toISOString(),sourceRevision:rev,inputSignature:signature,deterministic:det,ai:ai};
    if(ai){ai.sourceRevision=rev;ai.inputSignature=signature;}
    return exp.experimentBrief;
  }
  function ensureBrief(exp){return briefFresh(exp)?exp.experimentBrief:brief(exp);}

  LF.AnalysisSummary = { stats: stats, collect: collect, fresh: fresh, ensure: ensure };
  LF.ExperimentBrief = { collect:brief, ensure:ensureBrief, fresh:briefFresh, deterministic:deterministicBrief, signature:scientificSignature };
}());
