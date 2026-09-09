(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const GUARDS = {};

  function ok() {
    return { ok: true };
  }

  function fail(message, details) {
    return {
      ok: false,
      message: String(message || 'Action guard failed.'),
      details: details || null
    };
  }

  function register(id, fn) {
    id = String(id || '').trim();
    if (!id || typeof fn !== 'function') throw new Error('Action guard id and function are required.');
    if (GUARDS[id]) throw new Error('Action guard already registered: ' + id);
    GUARDS[id] = fn;
    return id;
  }

  function review(exp) {
    const revision = Number(exp && exp.sync && exp.sync.revision || 0);
    if (exp && exp.datasetAnalysis && Number(exp.datasetAnalysis.sourceRevision) === revision) {
      return exp.datasetAnalysis;
    }
    if (LF.DatasetCorrections && LF.DatasetCorrections.analysis) {
      return LF.DatasetCorrections.analysis(exp, revision);
    }
    return null;
  }

  register('dataset.loaded', function (ctx) {
    return ctx.exp && ctx.exp.id && Array.isArray(ctx.exp.measurements) && ctx.exp.measurements.length
      ? ok()
      : fail('Upload an experiment ZIP before running this Action.');
  });

  register('review.ambiguities_available', function (ctx) {
    const analysis = review(ctx.exp);
    const count = (analysis && analysis.ambiguousFindings || []).length;
    return count
      ? ok()
      : fail('No active semantic ambiguity requires an AI suggestion.');
  });

  register('design.incomplete_target', function (ctx) {
    const deviceId = String(ctx.params && ctx.params.deviceId || '');
    const device = (ctx.exp && ctx.exp.design && ctx.exp.design.devices || []).find(function (candidate) {
      return String(candidate.id) === deviceId;
    });

    if (!device) return fail('Select one Design experiment first.');

    const missing = LF.DesignModel && LF.DesignModel.missingDomains
      ? LF.DesignModel.missingDomains(ctx.exp, device)
      : [];

    return missing.length
      ? ok()
      : fail('The selected experiment already has solution chemistry, a complete device architecture and fabrication-process information.');
  });

  register('results.available', function (ctx) {
    return ctx.exp && ctx.exp.analysis && ctx.exp.analysis.summary && (ctx.exp.measurements || []).length
      ? ok()
      : fail('Deterministic Results are not available for the current LabFlow Data.');
  });

  register('results.compare_groups', function (ctx) {
    const groups = (ctx.params && Array.isArray(ctx.params.groups) ? ctx.params.groups : [])
      .map(String)
      .filter(Boolean);

    if (groups.length < 2) return fail('Select at least two Results groups to compare.');

    const available = new Set((ctx.exp.measurements || []).map(function (measurement) {
      return String(measurement.group || '').trim() || 'Ungrouped';
    }));
    const valid = groups.filter(function (group) { return available.has(group); });

    return valid.length >= 2
      ? ok()
      : fail('At least two selected groups must contain measurements in the current Results set.');
  });

  register('assistant.question', function (ctx) {
    return String(ctx.userText || '').trim()
      ? ok()
      : fail('Ask a question before running the Assistant.');
  });

  function check(definition, ctx) {
    const ids = definition && definition.contract && Array.isArray(definition.contract.guards)
      ? definition.contract.guards
      : [];
    const failures = [];

    ids.forEach(function (id) {
      const guard = GUARDS[id];
      const result = guard ? guard(ctx) : fail('Unknown Action guard: ' + id);
      if (!result || result.ok !== true) {
        failures.push({
          id: id,
          message: result && result.message || ('Guard failed: ' + id),
          details: result && result.details || null
        });
      }
    });

    return failures;
  }

  LF.ActionGuards = {
    register: register,
    check: check,
    ids: function () { return Object.keys(GUARDS).sort(); },
    definition: function (id) { return GUARDS[id] || null; }
  };
}());
