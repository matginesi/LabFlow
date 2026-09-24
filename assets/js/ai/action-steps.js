/*
 * Deterministic read/write step implementations used by Action manifests.
 * Boundary: Write steps delegate to explicit owners; deterministic services stay outside model prompts.
 */
(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  if (!LF.Core) throw new Error('LabFlow.Core must be loaded before action-steps.js.');

  LF.Core.requireModules('ActionSteps', [
    'CanonicalStore',
    'DatasetCorrections',
    'DesignAnalysis',
    'DesignModel',
    'ActionData',
    'DataPipeline'
  ]);

  function compact(value) {
    return LF.CanonicalStore.compact(value, 420);
  }

  function norm(value) {
    const raw = value && typeof value === 'object' && !Array.isArray(value)
      ? (value.value != null ? value.value : (value.id || value.path || value.name || ''))
      : value;
    return String(raw == null ? '' : raw)
      .trim()
      .replace(/\\/g, '/')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function text(value){return String(value==null?'':value).trim();}

  function proposalReferenceFallback(ctx, proposal, targetProposal, required) {
    if (!LF.ContextBuilder) return [];
    const deviceId = String(ctx.params && ctx.params.deviceId || ctx.outputs.collect && ctx.outputs.collect.device_id || '');
    const refs = LF.ContextBuilder.designReferences
      ? (LF.ContextBuilder.designReferences(ctx.exp, deviceId, required) || {})
      : (LF.ContextBuilder.pack ? (LF.ContextBuilder.pack('design', { exp: ctx.exp, params: { deviceId: deviceId } }) || {}) : {});
    const cabinet = refs.cabinet || {}, knowledge = refs.knowledge || {};
    const filled = [];

    function cabinetCandidates(domain) {
      return cabinet.domain_candidates && Array.isArray(cabinet.domain_candidates[domain])
        ? cabinet.domain_candidates[domain] : [];
    }
    function knowledgeCandidates(domain) {
      const direct = knowledge.domain_candidates && Array.isArray(knowledge.domain_candidates[domain])
        ? knowledge.domain_candidates[domain] : [];
      const all = Array.isArray(knowledge.entries) ? knowledge.entries : [];
      const seen = new Set(), out = [];
      direct.concat(all).forEach(function (entry) {
        const id = String(entry && entry.id || '');
        if (!id || seen.has(id)) return;
        seen.add(id); out.push(entry);
      });
      return out;
    }
    function referenceConfidence(value, fallback) {
      const n = Number(value);
      return Number.isFinite(n) ? Math.max(0.45, Math.min(0.9, n)) : fallback;
    }
    function markSolution(source, provenance, evidence, confidence, reason) {
      const candidate = {
        name: text(source.name || source.title || 'Reference formulation'),
        role: text(source.role || 'absorber precursor'),
        solutes: text(source.solutes), solvents: text(source.solvents),
        concentration: '', additives: text(source.additives), preparation: text(source.preparation),
        evidence: evidence, confidence: confidence, provenance_kind: provenance,
        reason: reason
      };
      if (!candidate.solutes && !candidate.solvents) return false;
      proposal.solutions = [candidate];
      targetProposal.solution_names = [candidate.name];
      return true;
    }
    function markStack(layers, provenance, evidence, confidence, reason) {
      layers = (layers || []).filter(function (layer) { return text(layer && (layer.role || layer.material)); });
      if (layers.length < 3) return false;
      const normalized = layers.slice(0, 12).map(function (layer) {
        return { role: text(layer.role), material: text(layer.material), thickness: text(layer.thickness), process: text(layer.process), evidence: evidence, confidence: confidence, provenance_kind: provenance, reason: reason };
      });
      proposal.stack = normalized.slice();
      targetProposal.stack = normalized.slice();
      return true;
    }
    function markProcess(source, provenance, evidence, confidence, reason) {
      const candidate = { coating:text(source.coating), annealing:text(source.annealing), atmosphere:text(source.atmosphere), notes:text(source.notes), evidence:evidence, confidence:confidence, provenance_kind:provenance, reason:reason };
      if (![candidate.coating,candidate.annealing,candidate.atmosphere,candidate.notes].some(Boolean)) return false;
      proposal.process = candidate;
      targetProposal.process = Object.assign({}, candidate);
      return true;
    }

    required.forEach(function (domain) {
      if (domain === 'solutions') {
        const cab = cabinetCandidates('solutions').find(function (item) { return item && item.kind === 'solution' && (text(item.solutes) || text(item.solvents)); });
        if (cab && markSolution(cab, 'cabinet_reference', 'CABINET:' + cab.id, 0.86, 'Researcher-curated Cabinet formulation selected as the strongest available reusable reference.')) { filled.push(domain); return; }
        const kb = knowledgeCandidates('solutions');
        let best = kb.find(function (entry) { const h=entry&&entry.design_hint&&entry.design_hint.solution; return h&&text(h.solutes)&&text(h.solvents); });
        if (best) {
          const h=best.design_hint, conf=referenceConfidence(h.reference_confidence,0.72);
          if (markSolution(h.solution,'knowledge_reference','KB:'+best.id,conf,'Structured Knowledge Base formulation selected as a literature-backed review candidate.')) { filled.push(domain); return; }
        }
        const soluteEntry = kb.find(function (entry) { const h=entry&&entry.design_hint&&entry.design_hint.solution; return h&&text(h.solutes); });
        const solventEntry = kb.find(function (entry) { const h=entry&&entry.design_hint&&entry.design_hint.solution; return h&&text(h.solvents); });
        if (soluteEntry || solventEntry) {
          const sh=soluteEntry&&soluteEntry.design_hint&&soluteEntry.design_hint.solution||{}, vh=solventEntry&&solventEntry.design_hint&&solventEntry.design_hint.solution||{};
          const ids=[]; if(soluteEntry)ids.push(soluteEntry.id); if(solventEntry&&(!soluteEntry||solventEntry.id!==soluteEntry.id))ids.push(solventEntry.id);
          const src={name:text(sh.name||vh.name||'Reference absorber precursor'),role:text(sh.role||vh.role||'absorber precursor'),solutes:text(sh.solutes),solvents:text(vh.solvents),additives:text(sh.additives||vh.additives),preparation:text(sh.preparation||vh.preparation)};
          const conf=Math.min(0.72,Math.max(0.58,(soluteEntry&&Number(soluteEntry.design_hint.reference_confidence)||0.62),(solventEntry&&Number(solventEntry.design_hint.reference_confidence)||0.62)));
          if(markSolution(src,'knowledge_reference',ids.map(function(id){return 'KB:'+id;}).join('; '),conf,'Combined compatible structured Knowledge Base hints; exact recipe remains unknown.'))filled.push(domain);
        }
      } else if (domain === 'stack') {
        const cab = cabinetCandidates('stack').find(function (item) { return item && item.kind === 'stack' && Array.isArray(item.layers) && item.layers.length >= 3; });
        if (cab && markStack(cab.layers,'cabinet_reference','CABINET:'+cab.id,0.88,'Researcher-curated Cabinet stack selected as the strongest available reusable architecture.')) { filled.push(domain); return; }
        const kb = knowledgeCandidates('stack').find(function (entry) { const h=entry&&entry.design_hint; return h&&Array.isArray(h.stack)&&h.stack.length>=3; });
        if (kb) { const h=kb.design_hint, conf=referenceConfidence(h.reference_confidence,0.72); if(markStack(h.stack,'knowledge_reference','KB:'+kb.id,conf,'Structured Knowledge Base architecture selected as a literature-backed review candidate.'))filled.push(domain); }
      } else if (domain === 'process') {
        const cab = cabinetCandidates('process').find(function (item) { return item && item.kind === 'protocol' && [item.coating,item.annealing,item.atmosphere,item.notes].some(function(v){return text(v);}); });
        if (cab && markProcess(cab,'cabinet_reference','CABINET:'+cab.id,0.86,'Researcher-curated Cabinet protocol selected as the strongest available reusable process reference.')) { filled.push(domain); return; }
        const kb = knowledgeCandidates('process').find(function (entry) { const h=entry&&entry.design_hint&&entry.design_hint.process; return h&&[h.coating,h.annealing,h.atmosphere,h.notes].some(function(v){return text(v);}); });
        if (kb) { const h=kb.design_hint, conf=referenceConfidence(h.reference_confidence,0.66); if(markProcess(h.process,'knowledge_reference','KB:'+kb.id,conf,'Structured Knowledge Base process family selected as a literature-backed review candidate.'))filled.push(domain); }
      }
    });
    if (filled.length) {
      proposal.reference_fallback = { domains: filled.slice(), cabinet_available: (cabinet.items||[]).length, knowledge_available: (knowledge.entries||[]).length };
    }
    return filled;
  }

  function mergeDesignProposals(reference, inferred) {
    const base=LF.DesignModel.normalizeProposal(reference||{}),ai=LF.DesignModel.normalizeProposal(inferred||{});
    base.solutions=Array.isArray(base.solutions)?base.solutions:[];
    base.stack=Array.isArray(base.stack)?base.stack:[];
    base.devices=Array.isArray(base.devices)?base.devices:[];
    ai.solutions=Array.isArray(ai.solutions)?ai.solutions:[];
    ai.stack=Array.isArray(ai.stack)?ai.stack:[];
    ai.devices=Array.isArray(ai.devices)?ai.devices:[];
    if(!base.solutions.length)base.solutions=ai.solutions.slice();
    if(!base.stack.length)base.stack=ai.stack.slice();
    if(!base.devices.length)base.devices=ai.devices.slice();
    else if(ai.devices[0]){
      const bd=base.devices[0],ad=ai.devices[0];
      if(!(bd.sample_names||[]).length)bd.sample_names=(ad.sample_names||[]).slice();
      if(!(bd.solution_names||[]).length)bd.solution_names=(ad.solution_names||[]).slice();
      if(!(bd.stack||[]).length)bd.stack=(ad.stack||[]).slice();
      const bdp=bd.process||{},adp=ad.process||{};
      ['coating','annealing','atmosphere','notes','evidence','reason','provenance_kind'].forEach(function(key){
        if(!text(bdp[key])&&text(adp[key]))bdp[key]=adp[key];
      });
      if(bdp.confidence==null&&adp.confidence!=null)bdp.confidence=adp.confidence;
      bd.process=bdp;
      if(!text(bd.name)&&text(ad.name))bd.name=ad.name;
    }
    const bp=base.process||{},ap=ai.process||{};
    ['coating','annealing','atmosphere','notes','evidence','reason','provenance_kind'].forEach(function(key){if(!text(bp[key])&&text(ap[key]))bp[key]=ap[key];});
    if(bp.confidence==null&&ap.confidence!=null)bp.confidence=ap.confidence;
    base.process=bp;
    base.unresolved_domains=Array.from(new Set((ai.unresolved_domains||[]).filter(function(domain){
      if(domain==='solutions')return !(base.solutions||[]).length;
      if(domain==='stack')return !(base.stack||[]).length;
      if(domain==='process')return ![base.process.coating,base.process.annealing,base.process.atmosphere,base.process.notes].some(function(v){return text(v);});
      return false;
    })));
    base.unknowns=Array.from(new Set((base.unknowns||[]).concat(ai.unknowns||[]))).slice(0,10);
    base.summary=text(base.summary)||text(ai.summary)||'Review-only Design candidate.';
    base.status='suggested';
    return base;
  }

  function pipelineRefresh(exp, reason) {
    const pipeline = LF.DataPipeline.refresh(exp, { reason: reason || 'action' });
    return {
      analysis: exp.analysis,
      dataset: exp.datasetAnalysis,
      design: exp.designAnalysis,
      pipeline: pipeline,
      status: pipeline && pipeline.status || '',
      validation: pipeline && pipeline.validation || null
    };
  }

  function confidencePct(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.round(Math.max(0, Math.min(1, number)) * 100) + '%'
      : '—';
  }

  function mdList(items, render) {
    return (items || []).length
      ? (items || []).map(function (item) { return '- ' + render(item); }).join('\n')
      : '- None';
  }

  function resultsInterpretationMarkdown(value) {
    const lines = [
      '### Summary',
      String(value.summary || '').trim() || 'No summary returned.',
      '',
      '### Evidence-backed observations',
      mdList(value.observations, function (item) {
        return String(item.statement || '') +
          ' *(confidence ' + confidencePct(item.confidence) +
          (item.evidence && item.evidence.length ? ' · evidence: ' + item.evidence.join('; ') : '') + ')*';
      }),
      '',
      '### Hypotheses',
      mdList(value.hypotheses, function (item) {
        return String(item.statement || '') +
          ' *(confidence ' + confidencePct(item.confidence) +
          (item.basis && item.basis.length ? ' · basis: ' + item.basis.join('; ') : '') + ')*';
      }),
      '',
      '### Limitations',
      mdList(value.limitations, String),
      '',
      '### Next checks',
      mdList(value.next_checks, String)
    ];
    return lines.join('\n');
  }

  function resultsSelection(ctx) {
    const params = ctx && ctx.params || {};
    return {
      groups: (Array.isArray(params.groups) ? params.groups : []).map(String).filter(Boolean),
      metric: String(params.metric || 'eff'),
      direction: String(params.direction || 'both'),
      eligibleOnly: params.eligibleOnly !== false
    };
  }

  function resultsSelectionKey(selection) {
    return JSON.stringify({
      groups: (selection.groups || []).slice().sort(),
      metric: selection.metric,
      direction: selection.direction,
      eligibleOnly: !!selection.eligibleOnly
    });
  }

  function resultsComparisonMarkdown(value, selection) {
    const lines = [
      '### ' + (value.status === 'insufficient_evidence' ? 'Comparison limited' : 'Comparison summary'),
      String(value.summary || '').trim() || 'No summary returned.',
      '',
      '**Selection:** ' + (selection.groups || []).join(' vs ') + ' · ' + selection.metric + ' · ' +
        selection.direction + (selection.eligibleOnly ? ' · eligible only' : ''),
      '',
      '### Supported contrasts',
      mdList(value.contrasts, function (item) {
        return String(item.statement || '') +
          ' *(confidence ' + confidencePct(item.confidence) +
          (item.evidence && item.evidence.length ? ' · evidence: ' + item.evidence.join('; ') : '') + ')*';
      }),
      '',
      '### Hypotheses',
      mdList(value.hypotheses, function (item) {
        return String(item.statement || '') +
          ' *(confidence ' + confidencePct(item.confidence) +
          (item.basis && item.basis.length ? ' · basis: ' + item.basis.join('; ') : '') + ')*';
      }),
      '',
      '### Limitations',
      mdList(value.limitations, String),
      '',
      '### Next checks',
      mdList(value.next_checks, String)
    ];
    return lines.join('\n');
  }

  const steps = {
    'dataset.collect-ambiguities': function (ctx) {
      const current = Number(ctx.exp.sync && ctx.exp.sync.revision || 0);
      const analysis = ctx.exp.datasetAnalysis;
      if (!analysis || Number(analysis.sourceRevision) !== current) {
        pipelineRefresh(ctx.exp, 'dataset.resolve-ambiguities');
      }

      const list = (ctx.exp.datasetAnalysis.ambiguousFindings || []).slice(0, 6);
      if (!list.length) throw new Error('No semantic ambiguity requires AI resolution.');

      return {
        finding_ids: list.map(function (finding) { return finding.id; }),
        scheduled: list.length,
        remaining: Math.max(0, (ctx.exp.datasetAnalysis.ambiguousFindings || []).length - list.length)
      };
    },

    'dataset.store-corrections': function (ctx) {
      const value = ctx.lastResult;
      if (!value || typeof value !== 'object') {
        throw new Error('Ambiguity resolution returned no structured result.');
      }

      const current = Number(ctx.exp.sync && ctx.exp.sync.revision || 0);
      if (!ctx.exp.datasetAnalysis || Number(ctx.exp.datasetAnalysis.sourceRevision) !== current) {
        pipelineRefresh(ctx.exp, 'dataset.resolve-ambiguities.store');
      }

      const open = ctx.exp.datasetAnalysis.ambiguousFindings || [];
      const byId = new Map(open.map(function (finding) {
        return [String(finding.id || ''), finding];
      }));
      const incoming = Array.isArray(value.proposals) ? value.proposals : [];
      const valid = [];
      const unresolved = Array.isArray(value.unresolved) ? value.unresolved.slice() : [];
      const allowed = new Set([
        'sample_mapping',
        'group_mapping',
        'reference_classification',
        'field_mapping',
        'unit_mapping',
        'metadata_value'
      ]);
      const usedFindings = new Set();

      function reject(proposal, reason) {
        unresolved.push({
          target: String(proposal && proposal.target || proposal && proposal.finding_id || 'unknown'),
          reason: reason,
          evidence: (proposal && proposal.evidence || []).slice(0, 3)
        });
      }

      incoming.forEach(function (candidate) {
        const proposal = candidate && typeof candidate === 'object' ? candidate : {};
        let finding = byId.get(String(proposal.finding_id || ''));

        if (!finding) {
          const target = norm(proposal.target);
          const matches = open.filter(function (item) {
            return [target, norm(proposal.before)].filter(Boolean).some(function (wanted) {
              return [norm(item.id), norm(item.target), norm(item.measurementId)].includes(wanted);
            });
          });
          if (matches.length === 1) {
            finding = matches[0];
            proposal.finding_id = finding.id;
          }
        }

        if (!finding) {
          reject(proposal, 'Proposal does not map to exactly one currently open deterministic ambiguity.');
          return;
        }
        if (usedFindings.has(String(finding.id || ''))) {
          reject(proposal, 'More than one AI proposal targeted the same deterministic ambiguity.');
          return;
        }
        if (!allowed.has(String(proposal.patch_type || ''))) {
          reject(proposal, 'Patch type is not permitted for AI semantic ambiguity repair.');
          return;
        }

        const needsMeasurement = /^(sample_mapping|group_mapping|reference_classification|metadata_value)$/
          .test(String(proposal.patch_type || ''));
        proposal.target = String(
          needsMeasurement && finding.measurementId
            ? finding.measurementId
            : (proposal.target || finding.target || finding.measurementId || '')
        );
        proposal.before = proposal.before == null ? (finding.target || '') : proposal.before;
        proposal.requires_human_review = true;
        proposal.decision = 'pending';
        proposal.applied = false;
        delete proposal.applyError;

        if (needsMeasurement && !LF.DatasetCorrections.proposalMeasurements(ctx.exp, proposal).length) {
          reject(proposal, 'No canonical measurement target can be resolved for this proposal.');
          return;
        }

        usedFindings.add(String(finding.id || ''));
        valid.push(proposal);
      });

      value.proposals = valid;
      value.unresolved = unresolved;
      value.sourceRevision = ctx.sourceRevision;
      value.generatedAt = new Date().toISOString();
      value.validation = {
        received: incoming.length,
        applicable: valid.length,
        rejected: incoming.length - valid.length
      };
      LF.ActionData.setProposal(ctx.exp, 'dataset.resolve-ambiguities', '', value);

      return {
        stored: true,
        proposals: valid.length,
        rejected: incoming.length - valid.length,
        unresolved: unresolved.length
      };
    },

    'results.build-interpretation': function (ctx) {
      const bundle=LF.AnalysisSummary&&LF.AnalysisSummary.ensure?LF.AnalysisSummary.ensure(ctx.exp):null;
      const analysis=ctx.exp.analysis||{},summary=analysis.summary||{},advanced=bundle&&bundle.advanced||{};
      const observations=[],limitations=[],next=[];
      function obs(statement,evidence,confidence){if(statement)observations.push({statement:statement,evidence:evidence||[],confidence:confidence==null?0.98:confidence});}
      const total=Number(summary.measurementCount||advanced.quality&&advanced.quality.active||0),eligible=Number(summary.eligibleCount||advanced.quality&&advanced.quality.eligible||0);
      if(total)obs(eligible+' of '+total+' active measurements are ranking eligible ('+Math.round(eligible/total*100)+'%).',['analysis.summary.eligibleCount','analysis.summary.measurementCount']);
      const best=analysis.bestBySample&&analysis.bestBySample[0];
      if(best&&Number.isFinite(Number(best.bestEff)))obs('Best eligible sample is '+best.sample+' at '+Number(best.bestEff).toFixed(2)+'% PCE.',['analysis.bestBySample[0]']);
      const ref=analysis.topRef&&analysis.topRef[0],non=analysis.topNonRef&&analysis.topNonRef[0];
      if(ref&&non&&Number.isFinite(Number(ref.bestEff))&&Number.isFinite(Number(non.bestEff)))obs('Best non-reference PCE differs from best reference by '+(Number(non.bestEff)-Number(ref.bestEff)).toFixed(2)+' percentage points.',['analysis.topNonRef[0]','analysis.topRef[0]']);
      const paired=advanced.pairedScans;
      if(paired&&paired.count)obs(paired.count+' measurements contain paired FW/RV scans; median |ΔPCE| is '+Number(paired.absDeltaPce&&paired.absDeltaPce.median||0).toFixed(2)+' percentage points.',['analysisSummary.advanced.pairedScans']);
      if(advanced.quality&&advanced.quality.blocked)next.push('Review '+advanced.quality.blocked+' blocked measurement'+(advanced.quality.blocked===1?'':'s')+' before relying on rankings.');
      if((ctx.exp.findings||[]).some(function(f){return f.status!=='resolved';}))next.push('Review open deterministic findings before drawing stronger conclusions.');
      limitations.push('This interpretation is deterministic and descriptive; it does not establish causality or statistical significance.');
      if(total<3)limitations.push('The dataset is small; aggregate comparisons are limited.');
      return{status:observations.length?'interpreted':'limited',summary:observations.length?'Calculated Results summary from the current LabFlow analysis.':'Insufficient calculated Results for a useful interpretation.',observations:observations.slice(0,8),hypotheses:[],limitations:limitations,next_checks:next.slice(0,8)};
    },

    'results.build-comparison': function (ctx) {
      const selection=resultsSelection(ctx);
      if(selection.groups.length<2)throw new Error('Select at least two Results groups to compare.');
      const pack=LF.ContextBuilder&&LF.ContextBuilder.pack?LF.ContextBuilder.pack('results_compare',{exp:ctx.exp,params:selection}):null;
      const groups=pack&&pack.groups||[],contrasts=[],limitations=['Descriptive comparison only; no causal inference or significance test is performed.'];
      function center(g){const vals=[];if(selection.direction!=='rv'&&g.fw&&Number.isFinite(Number(g.fw.median)))vals.push(Number(g.fw.median));if(selection.direction!=='fw'&&g.rv&&Number.isFinite(Number(g.rv.median)))vals.push(Number(g.rv.median));return vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:null;}
      const ranked=groups.map(function(g){return{name:g.name,value:center(g),n:Number(g.measurements)||0};}).filter(function(g){return Number.isFinite(g.value);}).sort(function(a,b){return b.value-a.value;});
      if(ranked.length>=2){const best=ranked[0];ranked.slice(1).forEach(function(g){contrasts.push({statement:best.name+' is '+(best.value-g.value).toFixed(3)+' '+selection.metric+' units above '+g.name+' for the selected scan summary.',evidence:['results_compare.groups:'+best.name,'results_compare.groups:'+g.name],confidence:0.99});});}
      if(groups.some(function(g){return Number(g.measurements||0)<2;}))limitations.push('At least one selected group has fewer than two measurements.');
      const status=contrasts.length?'compared':'insufficient_evidence';
      return{status:status,groups:selection.groups.slice(),summary:status==='compared'?'Calculated comparison of the selected groups.':'Not enough finite selected-group statistics for a comparison.',contrasts:contrasts.slice(0,10),hypotheses:[],limitations:limitations,next_checks:status==='compared'?[]:['Add or select groups with finite measurements for the chosen metric and scan.']};
    },

    'export.build-preparation': function (ctx) {
      const prep=LF.ExportProjections&&LF.ExportProjections.preparationContext?LF.ExportProjections.preparationContext(ctx.exp):null;
      if(!prep)throw new Error('Export projections are unavailable.');
      const nomad=LF.ExportProjections.nomad(ctx.exp),readypv=LF.ExportProjections.readyPv(ctx.exp),values={nomad:{},readypv:{}};
      ;(nomad.fields||[]).forEach(function(f){values.nomad[f.id]=f.value;});
      ;(readypv.fields||[]).forEach(function(f){values.readypv[f.id]=f.value;});
      const aliases={
        'nomad:data.institution':['readypv','contact.institution'],
        'readypv:contact.institution':['nomad','data.institution']
      },suggestions=[],unresolved=[];
      ['nomad','readypv'].forEach(function(projection){(prep[projection]&&prep[projection].missing||[]).forEach(function(field){
        const alias=aliases[projection+':'+field.id],v=alias&&values[alias[0]]&&values[alias[0]][alias[1]],rendered=Array.isArray(v)?v.join(' ').trim():text(v);
        if(rendered)suggestions.push({projection:projection,field_id:field.id,value:v,source_kind:'workspace',confidence:0.93,reason:'Reused an equivalent populated projection field.',evidence:[alias[0]+':'+alias[1]]});
        else unresolved.push({projection:projection,field_id:field.id,reason:'No explicit current LabFlow value or conservative equivalent field is available.'});
      });});
      return{status:suggestions.length?'suggested':'limited',summary:suggestions.length?'Prepared deterministic export-only suggestions from existing LabFlow values.':'Missing export metadata remains for human completion; LabFlow did not invent values.',suggestions:suggestions.slice(0,24),unresolved:unresolved.slice(0,24),warnings:[]};
    },

    'results.store-interpretation': function (ctx) {
      const value = ctx.outputs.build || ctx.outputs.interpret || ctx.lastResult;
      if (!value || typeof value !== 'object') throw new Error('The Results interpretation is empty.');
      const markdown = resultsInterpretationMarkdown(value);
      LF.ActionData.setAnnotation(ctx.exp, 'results.interpret', {
        data: value,
        markdown: markdown,
        generatedAt: new Date().toISOString(),
        sourceRevision: ctx.sourceRevision
      });
      return {
        stored: true,
        observations: (value.observations || []).length,
        hypotheses: (value.hypotheses || []).length,
        status: value.status || 'interpreted'
      };
    },

    'results.store-comparison': function (ctx) {
      const value = ctx.outputs.build || ctx.outputs.compare || ctx.lastResult;
      if (!value || typeof value !== 'object') throw new Error('The Results comparison is empty.');
      const selection = resultsSelection(ctx);
      const markdown = resultsComparisonMarkdown(value, selection);
      LF.ActionData.setAnnotation(ctx.exp, 'results.compare', {
        data: value,
        markdown: markdown,
        selection: selection,
        selectionKey: resultsSelectionKey(selection),
        generatedAt: new Date().toISOString(),
        sourceRevision: ctx.sourceRevision
      });
      return {
        stored: true,
        groups: (value.groups || []).length,
        contrasts: (value.contrasts || []).length,
        status: value.status || 'compared'
      };
    },

    'export.store-preparation': function (ctx) {
      const value = ctx.outputs.build || ctx.outputs.prepare || ctx.lastResult;
      if (!value || typeof value !== 'object') throw new Error('The export preparation proposal is empty.');
      value.sourceRevision = ctx.sourceRevision;
      value.generatedAt = new Date().toISOString();
      value.applied = false;
      LF.ActionData.setProposal(ctx.exp, 'export.prepare', '', value);
      LF.ActionData.setStatus(ctx.exp, 'export.prepare', '', {
        state: value.suggestions && value.suggestions.length ? 'suggested' : 'limited',
        updatedAt: value.generatedAt,
        message: value.summary || ''
      });
      return {
        stored: true,
        status: value.status,
        suggestions: (value.suggestions || []).length,
        unresolved: (value.unresolved || []).length
      };
    },

    'design.collect-selected': function (ctx) {
      const exp = ctx.exp;
      const current = Number(exp.sync && exp.sync.revision || 0);
      if (!exp.designAnalysis || Number(exp.designAnalysis.sourceRevision) !== current) {
        exp.designAnalysis = LF.DesignAnalysis.build(exp, current);
      }

      const id = String(ctx.params && ctx.params.deviceId || '');
      const device = (exp.design && exp.design.devices || []).find(function (item) {
        return String(item.id) === id;
      });
      if (!device) throw new Error('Select one experiment first.');

      const unknown = LF.DesignModel.pendingDomains ? LF.DesignModel.pendingDomains(exp, device) : LF.DesignModel.missingDomains(exp, device);
      if (!unknown.length) {
        throw new Error(
          'This experiment has no pending Design domains. Any remaining unknowns have already been explicitly reviewed.'
        );
      }

      const scope={device_id:id,sample_names:(device.sampleNames||[]).slice(),manual_variant:!(device.sampleNames||[]).length,unknown_fields:unknown,current_design:compact(device),source_design:compact(exp.design&&exp.design.evidenceSummary||{})};
      const reference=LF.DesignModel.normalizeProposal({status:'suggested',summary:'',solutions:[],stack:[],process:{},unresolved_domains:[],unknowns:[]});
      reference.devices=[{name:text(device.name),sample_names:scope.sample_names.slice(),solution_names:[],process:{},stack:[],provenance_kind:'knowledge_reference',confidence:null,reason:''}];
      const fake=Object.assign({},ctx,{outputs:{collect:scope}}),filled=proposalReferenceFallback(fake,reference,reference.devices[0],unknown);
      const applicable=LF.DesignAnalysis.applicableFields(reference,unknown);
      const unresolved=unknown.filter(function(domain){return !applicable.includes(domain);});
      reference.unresolved_domains=[];
      reference.summary=filled.length?'Review-only Design candidate resolved from Lab Cabinet / Knowledge Base references.':'No deterministic Design reference covered the requested domains.';
      scope.reference_proposal=reference;scope.reference_filled=filled;scope.unresolved_fields=unresolved;
      scope.ai_work=unresolved.length?[{label:'Unresolved Design',required_domains:unresolved.slice()}]:[];
      return scope;
    },

    'design.validate-coverage': function (ctx) {
      const proposal = LF.DesignModel.normalizeProposal(ctx.candidate || ctx.outputs.infer || ctx.lastResult || {});
      const scope = ctx.outputs.collect || {};
      const wanted = Array.from(new Set((scope.sample_names || []).map(String).filter(Boolean)));
      if (!String(scope.device_id || '')) throw new Error('The selected Design experiment is unavailable.');

      proposal.devices = (proposal.devices || []).slice(0, 1);

      if (!proposal.devices[0]) {
        proposal.devices = [{
          name: '',
          sample_names: [],
          solution_names: [],
          process: {},
          stack: [],
          provenance_kind: 'model_inference',
          confidence: null,
          reason: ''
        }];
      }

      const targetProposal = proposal.devices[0];
      targetProposal.sample_names = wanted.slice();
      if ((proposal.stack || []).length && !(targetProposal.stack || []).length) {
        targetProposal.stack = proposal.stack.slice();
      }

      const topProcess = proposal.process || {};
      targetProposal.process = targetProposal.process || {};
      ['coating', 'annealing', 'atmosphere', 'notes', 'evidence', 'reason', 'provenance_kind']
        .forEach(function (key) {
          const current = String(targetProposal.process[key] == null ? '' : targetProposal.process[key]).trim();
          const incoming = String(topProcess[key] == null ? '' : topProcess[key]).trim();
          if (!current && incoming) targetProposal.process[key] = topProcess[key];
        });
      if (targetProposal.process.confidence == null && topProcess.confidence != null) {
        targetProposal.process.confidence = topProcess.confidence;
      }

      if ((proposal.solutions || []).length && !(targetProposal.solution_names || []).length) {
        targetProposal.solution_names = (proposal.solutions || [])
          .map(function (solution) { return solution.name; })
          .filter(Boolean);
      }

      const requiredSource=ctx.workItem&&Array.isArray(ctx.workItem.required_domains)?ctx.workItem.required_domains:(scope.unknown_fields||[]);
      const required = Array.from(new Set(requiredSource.map(function (field) {
        return String(field).toLowerCase();
      }).filter(function(field){return ['solutions','stack','process'].includes(field);})));
      let applicable = LF.DesignAnalysis.applicableFields(proposal, required);
      const missingForFallback = required.filter(function(field){return !applicable.includes(field);});
      const referenceFilled = proposalReferenceFallback(ctx, proposal, targetProposal, missingForFallback);
      if(referenceFilled.length) applicable = LF.DesignAnalysis.applicableFields(proposal, required);
      const declaredUnresolved = Array.from(new Set((proposal.unresolved_domains || []).map(function(field){
        return String(field || '').toLowerCase();
      }).filter(function(field){return required.includes(field)&&!applicable.includes(field);})));

      /*
       * Coverage is fail-safe rather than fail-open. A valid structured model response may still
       * forget to mirror an omitted domain into unresolved_domains, especially on small local
       * models. LabFlow owns the deterministic scope, so any required domain that is neither
       * scientifically useful nor explicitly unresolved is conservatively downgraded to an
       * unresolved known-unknown instead of failing the whole Action or encouraging fabrication.
       * Incomplete candidates for that domain are removed so they cannot be applied accidentally.
       */
      const autoUnresolved = required.filter(function (field) {
        return !applicable.includes(field) && !declaredUnresolved.includes(field);
      });
      autoUnresolved.forEach(function(field){
        if(field==='solutions'){
          proposal.solutions=[];
          targetProposal.solution_names=[];
        }else if(field==='stack'){
          proposal.stack=[];
          targetProposal.stack=[];
        }else if(field==='process'){
          proposal.process={coating:'',annealing:'',atmosphere:'',notes:'',evidence:'',confidence:null,provenance_kind:'model_inference',reason:''};
          targetProposal.process={coating:'',annealing:'',atmosphere:'',notes:'',evidence:'',confidence:null,provenance_kind:'model_inference',reason:''};
        }
      });

      const unresolvedDomains = Array.from(new Set(declaredUnresolved.concat(autoUnresolved)));
      proposal.unresolved_domains = unresolvedDomains;
      if(referenceFilled.length){
        const labels=[];
        const kinds=[];
        (proposal.solutions||[]).forEach(function(x){if(x&&x.provenance_kind)kinds.push(x.provenance_kind);});
        (targetProposal.stack||[]).forEach(function(x){if(x&&x.provenance_kind)kinds.push(x.provenance_kind);});
        if(targetProposal.process&&targetProposal.process.provenance_kind)kinds.push(targetProposal.process.provenance_kind);
        if(kinds.includes('cabinet_reference'))labels.push('Lab Cabinet');
        if(kinds.includes('knowledge_reference'))labels.push('Knowledge Base');
        if(kinds.includes('model_inference'))labels.push('model inference');
        proposal.summary='Review-only Design candidate assembled from '+(labels.length?labels.join(' + '):'available references')+'.';
      }
      proposal.unknowns = Array.isArray(proposal.unknowns) ? proposal.unknowns.slice(0, 10) : [];
      unresolvedDomains.forEach(function(field){
        const already=proposal.unknowns.some(function(text){return String(text||'').toLowerCase().includes(field);});
        if(already)return;
        if(proposal.unknowns.length>=10)return;
        if(autoUnresolved.includes(field)){
          proposal.unknowns.push('Unresolved '+field+': LabFlow received no sufficiently complete review candidate for this required domain and conservatively marked it unresolved.');
        }else{
          proposal.unknowns.push('Unresolved '+field+': no sufficiently supported proposal was established from the supplied experiment, Cabinet or Knowledge Base context.');
        }
      });

      LF.DesignAnalysis.sanitizeProposal(proposal);
      proposal.status = 'suggested';
      proposal.validation = {
        targetDeviceId: String(scope.device_id || ''),
        manualVariant: !!scope.manual_variant,
        applicableFields: applicable,
        unresolvedDomains: unresolvedDomains.slice(),
        autoUnresolvedDomains: autoUnresolved.slice(),
        referenceFallbackDomains: referenceFilled.slice(),
        unresolvedCount: unresolvedDomains.length
      };
      return proposal;
    },

    'design.store-proposal': function (ctx) {
      const inferred=Array.isArray(ctx.outputs.infer)?ctx.outputs.infer[0]:(ctx.outputs.infer||null);
      const reference=ctx.outputs.collect&&ctx.outputs.collect.reference_proposal||null;
      const proposal=mergeDesignProposals(reference,inferred||{});
      const deviceId = String(
        ctx.params && ctx.params.deviceId ||
        ctx.outputs.collect && ctx.outputs.collect.device_id ||
        ''
      );

      (proposal.solutions || []).concat(proposal.devices || []).forEach(function (item) {
        item.decision = 'pending';
        item.applied = false;
      });
      proposal.sourceRevision = ctx.sourceRevision;
      proposal.targetDeviceId = deviceId;
      proposal.generatedAt = new Date().toISOString();
      proposal.cabinetMatches = LF.Cabinet && LF.Cabinet.matchProposal
        ? LF.Cabinet.matchProposal(proposal)
        : [];

      if (LF.ContextBuilder && LF.ContextBuilder.pack) {
        const pack = LF.ContextBuilder.pack('design', { exp: ctx.exp, params: { deviceId: deviceId } });
        if (pack && pack.design_evidence_summary) proposal.contextBasis = pack.design_evidence_summary;
      }

      proposal.applicationSummary = LF.DesignAnalysis.summarizeProposal(proposal);
      if (deviceId) {
        LF.ActionData.setProposal(ctx.exp, 'design.infer', deviceId, proposal);
        LF.ActionData.setStatus(ctx.exp, 'design.infer', deviceId, {
          state: 'suggested',
          updatedAt: proposal.generatedAt,
          message: ''
        });
      }

      return {
        stored: true,
        status: proposal.status,
        targetDeviceId: deviceId,
        devices: proposal.devices.length,
        solutions: proposal.solutions.length,
        unresolvedCount: (proposal.unknowns || []).length
      };
    }
  };

  LF.ActionSteps = steps;

  const actionStepTools = {
    'results.build-interpretation': { domain: 'results', access: 'read' },
    'results.build-comparison': { domain: 'results', access: 'read' },
    'export.build-preparation': { domain: 'export', access: 'read' },
    'dataset.collect-ambiguities': { domain: 'dataset', access: 'read' },
    'dataset.store-corrections': { domain: 'dataset', access: 'write', writes: ['experiment.actionData.proposals.dataset.resolve-ambiguities'] },
    'export.store-preparation': { domain: 'export', access: 'write', writes: ['experiment.actionData.proposals.export.prepare','experiment.actionData.status.export.prepare'] },
    'design.collect-selected': { domain: 'design', access: 'read' },
    'design.validate-coverage': { domain: 'design', access: 'read' },
    'design.store-proposal': { domain: 'design', access: 'write', writes: ['experiment.actionData.proposals.design.infer','experiment.actionData.status.design.infer'] },
    'results.store-interpretation': { domain: 'results', access: 'write', writes: ['experiment.actionData.annotations.results.interpret'] },
    'results.store-comparison': { domain: 'results', access: 'write', writes: ['experiment.actionData.annotations.results.compare'] }
  };
  LF.ActionStepTools = actionStepTools;

  if (LF.ToolRegistry && LF.ToolRegistry.registerActionStep) {
    Object.keys(actionStepTools).forEach(function (id) {
      if (!LF.ToolRegistry.definition(id)) {
        LF.ToolRegistry.registerActionStep(id, actionStepTools[id]);
      }
    });
  }

  LF.ActionStepRegistry = {
    ids: function () { return Object.keys(steps); },
    has: function (id) { return typeof steps[id] === 'function'; },
    register: function (id, fn, meta) {
      if (!id || typeof fn !== 'function') throw new Error('Action step id and function are required.');
      if (steps[id]) throw new Error('Action step already registered: ' + id);
      steps[id] = fn;
      if (LF.ToolRegistry && LF.ToolRegistry.registerActionStep) {
        LF.ToolRegistry.registerActionStep(id, meta || {});
      }
      return id;
    }
  };
}());
