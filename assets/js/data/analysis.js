(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;
  const Log = LF.Logger.scope('analysis');
  const activeAnalyses = new WeakSet();

  function rules() { return (LF.PromptRegistry && LF.PromptRegistry.effectiveRules && LF.PromptRegistry.effectiveRules()) || {}; }

  /* All scientific collections live on the one canonical ExperimentData. */
  function listOf(exp, key) {
    return Array.isArray(exp && exp[key]) ? exp[key] : [];
  }
  function measurementsOf(exp) { return listOf(exp, 'measurements'); }
  function samplesOf(exp) { return listOf(exp, 'samples'); }
  function findingsOf(exp) { return listOf(exp, 'findings'); }
  function manifestOf(exp) { return listOf(exp, 'manifest'); }
  function analysisOf(exp) {
    return (exp && exp.analysis) || { summary: {}, bestBySample: [], topNonRef: [], topRef: [] };
  }
  function settingsOf(exp) {
    const s = (exp && exp.analysisSettings) || {};
    return Number(s.mismatchFactor) > 0 ? Number(s.mismatchFactor) : 1;
  }
  function designOf(exp) {
    return (exp && exp.design) || { status: 'unknown', solutions: [], process: {}, stack: [], notes: '' };
  }

  function hysteresis(m) {
    if (!m || !m.rv || !m.fw || !Number.isFinite(m.rv.eff) || !Number.isFinite(m.fw.eff) || m.rv.eff === 0) return null;
    return (m.rv.eff - m.fw.eff) / m.rv.eff;
  }
  function diffPct(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const max = Math.max(Math.abs(a), Math.abs(b));
    return max ? Math.abs(a - b) / max * 100 : 0;
  }
  function bestEff(m) {
    const v = [];
    if (m.fw && Number.isFinite(m.fw.eff)) v.push(m.fw.eff);
    if (m.rv && Number.isFinite(m.rv.eff)) v.push(m.rv.eff);
    return v.length ? Math.max.apply(null, v) : null;
  }
  function inRange(value, rule) {
    if (!Number.isFinite(value) || !rule) return true;
    if (Number.isFinite(rule.min) && value < rule.min) return false;
    if (Number.isFinite(rule.max) && value > rule.max) return false;
    return true;
  }

  function deriveMeasurement(m, factor) {
    const end=Log.timer('measurement.derive',{id:m.id,file:m.file,sample:m.sample,factor:factor});
    const r = rules();
    const ranges = r.metric_ranges || {};
    const pairs = r.pair_checks || {};
    factor = Number(factor) > 0 ? Number(factor) : 1;
    m.hysteresis = hysteresis(m);
    m.rawBestEff = bestEff(m);
    m.bestEff = Number.isFinite(m.rawBestEff) ? m.rawBestEff / factor : null;
    m.jscDiffPct = m.fw && m.rv ? diffPct(m.fw.jsc, m.rv.jsc) : null;
    m.effDiffPct = m.fw && m.rv ? diffPct(m.fw.eff, m.rv.eff) : null;
    m.flags = [];
    m.blockingFlags = [];
    m.qualityEvidence = [];

    function addFlag(label, severity, evidence) {
      const item={label:label,severity:severity||'warning',evidence:evidence||''};
      m.flags.push(item);
      if (item.severity === 'danger') m.blockingFlags.push(item);
      if (evidence) m.qualityEvidence.push(evidence);
    }

    if (m.hysteresis != null && Number.isFinite(Number(pairs.hysteresis_abs_warning)) && Math.abs(m.hysteresis) > Number(pairs.hysteresis_abs_warning)) addFlag('High hysteresis','warning','|hysteresis| = '+C.fmt(Math.abs(m.hysteresis),4));
    if (m.jscDiffPct != null && Number.isFinite(Number(pairs.jsc_difference_percent_warning)) && m.jscDiffPct > Number(pairs.jsc_difference_percent_warning)) addFlag('Jsc mismatch','warning','FW/RV Jsc difference = '+C.fmt(m.jscDiffPct,1)+'%');
    if (m.effDiffPct != null && Number.isFinite(Number(pairs.efficiency_difference_percent_warning)) && m.effDiffPct > Number(pairs.efficiency_difference_percent_warning)) addFlag('Efficiency mismatch','warning','FW/RV efficiency difference = '+C.fmt(m.effDiffPct,1)+'%');

    ['fw','rv'].forEach(function (d) {
      const x = m[d]; if (!x) return;
      const prefix=d.toUpperCase()+' ';
      if (ranges.ff && x.ff != null && !inRange(x.ff,ranges.ff)) addFlag(prefix+'FF range',ranges.ff.severity||'warning',prefix+'FF = '+x.ff);
      if (ranges.efficiency && x.eff != null && !inRange(x.eff,ranges.efficiency)) addFlag(prefix+'efficiency range',ranges.efficiency.severity||'warning',prefix+'efficiency = '+x.eff+'%');
      if (ranges.voc && x.voc != null && !inRange(x.voc,ranges.voc)) addFlag(prefix+'Voc range',ranges.voc.severity||'warning',prefix+'Voc = '+x.voc+' V');
      const jRule=ranges.jsc_abs;
      if (jRule && x.jsc != null && Number.isFinite(Number(jRule.max)) && Math.abs(x.jsc)>Number(jRule.max)) addFlag(prefix+'Jsc range',jRule.severity||'warning',prefix+'|Jsc| = '+Math.abs(x.jsc)+' mA/cm²');
      ['voc','jsc','ff','eff'].forEach(function(k){ if (x[k] != null && !Number.isFinite(x[k])) addFlag(prefix+k+' invalid','danger','Non-finite '+k+' value'); });
    });

    const ranking=(r.ranking||{});
    const policyReady = !!(r.metric_ranges && r.pair_checks && r.ranking);
    if (!policyReady) addFlag('Validation policy unavailable','danger','Required validation/ranking rules are missing from policy.data-format-repair Markdown.');
    const dangerBlocks = ranking.exclude_danger_findings === true && m.blockingFlags.length>0;
    const finiteRequired = ranking.require_finite_efficiency === true;
    m.rankingEligible = policyReady && !m.excluded && !dangerBlocks && (!finiteRequired || Number.isFinite(m.bestEff));
    m.qualityStatus = m.blockingFlags.length ? 'blocked' : m.flags.length ? 'review' : 'valid';
    end({qualityStatus:m.qualityStatus,rankingEligible:m.rankingEligible,bestEff:m.bestEff,hysteresis:m.hysteresis,flags:m.flags.map(function(f){return f.label;}),recoveries:(m.recoveries||[]).length});
    return m;
  }

  function findingKey(f){return [f.type,f.target,f.title].join('|');}
  function syncMetricFindings(exp) {
    const findings=findingsOf(exp);
    const keep=findings.filter(function(f){return f.source!=='analysis-quality';});
    const seen=new Set(keep.map(findingKey));
    measurementsOf(exp).forEach(function(m){
      (m.flags||[]).forEach(function(flag){
        const f={id:C.uid('finding'),severity:flag.severity,type:'measurement-quality',title:flag.label,detail:flag.evidence||'Measurement requires review.',target:m.file,evidence:[flag.evidence].filter(Boolean),status:'open',source:'analysis-quality',measurementId:m.id};
        const k=findingKey(f); if(!seen.has(k)){keep.push(f);seen.add(k);}
      });
    });
    exp.findings=keep;
  }

  function summarizeAnalysis(exp, end) {
    syncMetricFindings(exp);
    const measurements=measurementsOf(exp), samples=samplesOf(exp), findings=findingsOf(exp);
    const eligible = measurements.filter(function (m) { return m.rankingEligible; });
    const bySample = new Map();
    eligible.forEach(function (m) {
      const current = bySample.get(m.sample);
      if (!current || m.bestEff > current.bestEff) bySample.set(m.sample, m);
    });
    const bestBySample = Array.from(bySample.values()).sort(function (a,b) { return b.bestEff - a.bestEff; });
    const topRef = bestBySample.filter(function (m) { return m.isRef; }).slice(0,10);
    const topNonRef = bestBySample.filter(function (m) { return !m.isRef; }).slice(0,10);
    const effs = eligible.map(function (m) { return m.bestEff; }).filter(Number.isFinite).sort(function(a,b){return a-b;});
    const mean = effs.length ? effs.reduce(function(a,b){return a+b;},0)/effs.length : null;
    const median = effs.length ? (effs.length % 2 ? effs[(effs.length-1)/2] : (effs[effs.length/2-1]+effs[effs.length/2])/2) : null;
    const completePairs=measurements.filter(function(m){return !!m.fw&&!!m.rv;}).length;
    const withCurves=measurements.filter(function(m){return (m.curve&&m.curve.fw&&m.curve.fw.length)||(m.curve&&m.curve.rv&&m.curve.rv.length);}).length;
    const validCount=measurements.filter(function(m){return m.qualityStatus==='valid';}).length;
    const reviewCount=measurements.filter(function(m){return m.qualityStatus==='review';}).length;
    const blockedCount=measurements.filter(function(m){return m.qualityStatus==='blocked';}).length;
    const openFindings=findings.filter(function(f){return f.status !== 'resolved';});
    const previousAI = exp.analysis && exp.analysis.aiInterpretation;
    exp.analysis = {
      summary: {
        measurementCount: measurements.length,
        eligibleCount: eligible.length,
        sampleCount: samples.length,
        completePairs: completePairs,
        curveCount: withCurves,
        validCount:validCount,
        reviewCount:reviewCount,
        blockedCount:blockedCount,
        findingCount: openFindings.length,
        namingFindingCount:openFindings.filter(function(f){return f.type==='naming';}).length,
        missingFindingCount:openFindings.filter(function(f){return /missing|direction-pair/.test(f.type);}).length,
        patchCount:(exp.patches||[]).length,
        completeness: measurements.length ? completePairs/measurements.length*100 : 0,
        bestEfficiency: bestBySample[0] ? bestBySample[0].bestEff : null,
        bestSample: bestBySample[0] ? bestBySample[0].sample : '',
        meanEfficiency: mean,
        medianEfficiency: median
      },
      bestBySample: bestBySample.map(compact), topNonRef: topNonRef.map(compact), topRef: topRef.map(compact)
    };
    if (previousAI) exp.analysis.aiInterpretation = previousAI;
    if(end)end({summary:exp.analysis.summary,topRef:exp.analysis.topRef.length,topNonRef:exp.analysis.topNonRef.length,findingsAfter:findings.length},'info');
    return exp.analysis;
  }

  function analyze(exp) {
    if(!exp||typeof exp!=='object')throw new Error('Experiment analysis requires one experiment object.');
    if(activeAnalyses.has(exp)){Log.warn('experiment.analyze.reentry-blocked',{experimentId:exp.id||'',revision:exp.sync&&exp.sync.revision||0});return analysisOf(exp);}
    activeAnalyses.add(exp);
    const measurements=measurementsOf(exp), samples=samplesOf(exp);
    const end=Log.timer('experiment.analyze',{experimentId:exp&&exp.id,measurements:measurements.length,samples:samples.length,findingsBefore:(exp&&exp.findings?exp.findings.length:0)});
    try{
      const factor = settingsOf(exp);
      exp.analysisSettings = exp.analysisSettings || { mismatchFactor: factor };
      measurements.forEach(function(m){ deriveMeasurement(m, factor); });
      return summarizeAnalysis(exp,end);
    }finally{activeAnalyses.delete(exp);}
  }



  function compact(m) {
    return { id:m.id, file:m.file, sample:m.sample, group:m.group, isRef:m.isRef, bestEff:m.bestEff, hysteresis:m.hysteresis, qualityStatus:m.qualityStatus, flags:(m.flags||[]).map(function(f){return f.label;}) };
  }

  function toCSV(exp) {
    const measurements=measurementsOf(exp);
    Log.debug('csv.export.prepare',{experimentId:exp&&exp.id,measurements:measurements.length});
    const factor = settingsOf(exp);
    const h = ['file','sample','group','reference','quality','ranking_eligible','voc_fw','jsc_fw','ff_fw','eff_fw','voc_rv','jsc_rv','ff_rv','eff_rv','hysteresis','mismatch_factor','flags'];
    const rows = measurements.map(function (m) {
      return [m.file,m.sample,m.group,m.isRef,m.qualityStatus,m.rankingEligible,(m.fw||{}).voc,Number.isFinite((m.fw||{}).jsc)?(m.fw||{}).jsc/factor:'',(m.fw||{}).ff,Number.isFinite((m.fw||{}).eff)?(m.fw||{}).eff/factor:'',(m.rv||{}).voc,Number.isFinite((m.rv||{}).jsc)?(m.rv||{}).jsc/factor:'',(m.rv||{}).ff,Number.isFinite((m.rv||{}).eff)?(m.rv||{}).eff/factor:'',m.hysteresis,factor,(m.flags||[]).map(function(f){return f.label;}).join('; ')].map(C.csvEscape).join(',');
    });
    return h.join(',') + '\n' + rows.join('\n');
  }

  LF.Analysis = { analyze, deriveMeasurement, hysteresis, toCSV, rules, measurementsOf, samplesOf, findingsOf, manifestOf, analysisOf, settingsOf, designOf };
}());
