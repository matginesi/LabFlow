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

      const list = (ctx.exp.datasetAnalysis.ambiguousFindings || []).slice(0, 12);
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

    'results.store-interpretation': function (ctx) {
      const value = ctx.outputs.interpret || ctx.lastResult;
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

    'results.validate-comparison': function (ctx) {
      const value = ctx.candidate || ctx.outputs.compare || ctx.lastResult || {};
      const selection = resultsSelection(ctx);
      const expected = selection.groups || [];
      if (expected.length < 2) throw new Error('Select at least two Results groups to compare.');
      value.groups = expected.slice();
      if (value.status === 'compared' && !(value.contrasts || []).length && !(value.hypotheses || []).length) {
        value.status = 'insufficient_evidence';
      }
      return value;
    },

    'results.store-comparison': function (ctx) {
      const value = ctx.outputs.compare || ctx.lastResult;
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

    'export.validate-preparation': function (ctx) {
      const value = ctx.candidate || ctx.outputs.prepare || ctx.lastResult || {};
      const prep = LF.ExportProjections && LF.ExportProjections.preparationContext
        ? LF.ExportProjections.preparationContext(ctx.exp) : null;
      if (!prep) throw new Error('Export projections are unavailable.');
      const allowed = {
        nomad: new Set(prep.allowed_fields && prep.allowed_fields.nomad || []),
        readypv: new Set(prep.allowed_fields && prep.allowed_fields.readypv || [])
      };
      const caps = {
        experiment: 0.97, workspace: 0.93, process: 0.91,
        cabinet_reference: 0.88, knowledge_reference: 0.74, model_inference: 0.56
      };
      const seen = new Set();
      value.suggestions = (Array.isArray(value.suggestions) ? value.suggestions : []).filter(function (item) {
        if (!item || !allowed[item.projection] || !allowed[item.projection].has(String(item.field_id || ''))) return false;
        const key = item.projection + ':' + item.field_id;
        if (seen.has(key)) return false;
        const rendered = Array.isArray(item.value) ? item.value.join(' ').trim() : String(item.value == null ? '' : item.value).trim();
        if (!rendered) return false;
        seen.add(key);
        item.source_kind = Object.prototype.hasOwnProperty.call(caps, item.source_kind)
          ? item.source_kind : 'model_inference';
        const raw = Number(item.confidence);
        item.confidence = Math.max(0, Math.min(caps[item.source_kind], Number.isFinite(raw) ? raw : caps[item.source_kind]));
        item.reason = text(item.reason).slice(0, 260);
        item.evidence = (Array.isArray(item.evidence) ? item.evidence : []).map(text).filter(Boolean).slice(0, 5);
        return true;
      }).slice(0, 24);
      value.unresolved = (Array.isArray(value.unresolved) ? value.unresolved : []).filter(function (item) {
        if (!item || !allowed[item.projection] || !allowed[item.projection].has(String(item.field_id || ''))) return false;
        item.reason = text(item.reason).slice(0, 240);
        if (item.source_kind) {
          item.source_kind = Object.prototype.hasOwnProperty.call(caps, item.source_kind)
            ? item.source_kind : 'model_inference';
        }
        if (item.confidence != null) {
          const raw = Number(item.confidence);
          const cap = caps[item.source_kind || 'model_inference'];
          item.confidence = Math.max(0, Math.min(cap, Number.isFinite(raw) ? raw : cap));
        }
        item.evidence = (Array.isArray(item.evidence) ? item.evidence : []).map(text).filter(Boolean).slice(0, 5);
        return true;
      }).slice(0, 24);
      value.warnings = (Array.isArray(value.warnings) ? value.warnings : []).map(text).filter(Boolean).slice(0, 12);
      value.status = value.suggestions.length ? 'suggested' : 'limited';
      value.summary = text(value.summary).slice(0, 500) || (value.suggestions.length
        ? 'Prepared review-only export metadata suggestions.'
        : 'No evidence-backed export metadata suggestion could be prepared.');
      value.validation = {
        suggestions: value.suggestions.length,
        unresolved: value.unresolved.length,
        allowedNomad: allowed.nomad.size,
        allowedReadyPv: allowed.readypv.size
      };
      return value;
    },

    'export.store-preparation': function (ctx) {
      const value = ctx.outputs.prepare || ctx.lastResult;
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

      return {
        device_id: id,
        sample_names: (device.sampleNames || []).slice(),
        manual_variant: !(device.sampleNames || []).length,
        unknown_fields: unknown,
        current_design: compact(device),
        source_design: compact(exp.design && exp.design.evidenceSummary || {})
      };
    },

    'design.validate-coverage': function (ctx) {
      const proposal = LF.DesignModel.normalizeProposal(ctx.candidate || ctx.outputs.infer || ctx.lastResult || {});
      const scope = ctx.outputs.collect || {};
      const wanted = Array.from(new Set((scope.sample_names || []).map(String).filter(Boolean)));
      if (!String(scope.device_id || '')) throw new Error('The selected Design experiment is unavailable.');

      proposal.devices = proposal.devices.slice(0, 1);

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

      const required = Array.from(new Set((scope.unknown_fields || []).map(function (field) {
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
      const proposal = LF.DesignModel.normalizeProposal(ctx.outputs.infer || ctx.lastResult);
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
    'dataset.collect-ambiguities': { domain: 'dataset', access: 'read' },
    'dataset.store-corrections': { domain: 'dataset', access: 'write', writes: ['experiment.actionData.proposals.dataset.resolve-ambiguities'] },
    'export.validate-preparation': { domain: 'export', access: 'read' },
    'export.store-preparation': { domain: 'export', access: 'write', writes: ['experiment.actionData.proposals.export.prepare','experiment.actionData.status.export.prepare'] },
    'design.collect-selected': { domain: 'design', access: 'read' },
    'design.validate-coverage': { domain: 'design', access: 'read' },
    'design.store-proposal': { domain: 'design', access: 'write', writes: ['experiment.actionData.proposals.design.infer','experiment.actionData.status.design.infer'] },
    'results.store-interpretation': { domain: 'results', access: 'write', writes: ['experiment.actionData.annotations.results.interpret'] },
    'results.validate-comparison': { domain: 'results', access: 'read' },
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
