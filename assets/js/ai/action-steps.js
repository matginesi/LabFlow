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

      const unknown = LF.DesignModel.missingDomains(exp, device);
      if (!unknown.length) {
        throw new Error(
          'This experiment already has solution chemistry, a complete device architecture and fabrication-process information.'
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
      /*
       * Device identity belongs to LabFlow. The model returns the scientific
       * proposal; this deterministic wrapper binds it to the selected device.
       */
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

      LF.DesignAnalysis.sanitizeProposal(proposal);
      const required = (scope.unknown_fields || []).map(function (field) {
        return String(field).toLowerCase();
      });
      const applicable = LF.DesignAnalysis.applicableFields(proposal, required);
      const missingRequired = required.filter(function (field) {
        return !applicable.includes(field);
      });

      if (missingRequired.length) {
        const labels = missingRequired.map(function (field) {
          if (field === 'solutions') {
            return 'solutions: return at least one qualitative formulation with non-empty solutes and/or solvents';
          }
          if (field === 'stack') return 'stack: return a coherent qualitative device stack';
          return 'process: return at least one qualitative coating/annealing/atmosphere/notes field';
        });
        const error = new Error(
          'Design inference did not cover every missing domain: ' + missingRequired.join(', ') + '.'
        );
        error.code = 'MODEL_OUTPUT_INVALID';
        error.isContract = true;
        error.validationErrors = labels;
        throw error;
      }

      proposal.status = 'suggested';
      proposal.validation = {
        targetDeviceId: String(scope.device_id || ''),
        manualVariant: !!scope.manual_variant,
        applicableFields: applicable,
        unresolvedCount: (proposal.unknowns || []).length
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
    'dataset.store-corrections': { domain: 'dataset', access: 'write' },
    'design.collect-selected': { domain: 'design', access: 'read' },
    'design.validate-coverage': { domain: 'design', access: 'read' },
    'design.store-proposal': { domain: 'design', access: 'write' },
    'results.store-interpretation': { domain: 'results', access: 'write' },
    'results.validate-comparison': { domain: 'results', access: 'read' },
    'results.store-comparison': { domain: 'results', access: 'write' }
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
