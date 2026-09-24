'use strict';
/*
 * P0/P1 Assistant memory, entity focus, router cache and envelope grounding.
 * Session memory must stay outside the persisted experiment snapshot.
 */
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/data-structures.js');
require('../../assets/js/experiment/domain-schema.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/experiment/design-model.js');
require('../../assets/js/data/analysis-summary.js');
require('../../assets/js/page-context.js');
require('../../assets/js/ai/assistant-core.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
}
function truthy(value, label) { if (!value) throw new Error(label || 'expected truthy value'); }

module.exports = function (t, LF) {
  function fake() {
    const exp = {
      id: 'exp_mem', meta: { name: 'Demo' },
      analysis: { summary: { measurementCount: 4, sampleCount: 2, experimentCount: 1, eligibleCount: 3, bestEfficiency: 21.37, bestSample: 'DEVICE A' } },
      analysisSummary: { advanced: { quality: { eligible: 3 }, pairedScans: { count: 3, absDeltaPce: { median: 0.42 } } }, findings: { open: 2 }, anomalies: [{ sample: 'DEVICE A' }] },
      sync: { revision: 0 },
      samples: [{ id: 's1', name: 'DEVICE A', rawName: 'Device_A', group: 'A', measurementIds: ['m1', 'm2'] }, { id: 's2', name: 'DEVICE B', group: 'B', measurementIds: ['m3'] }],
      experiments: [{ id: 'g1', name: 'A', sampleIds: ['s1'] }],
      measurements: [
        { id: 'm1', sample: 'DEVICE A', group: 'A', path: 'a/m1.txt', bestEff: 21, qualityStatus: 'valid', rankingEligible: true },
        { id: 'm2', sample: 'DEVICE A', group: 'A', path: 'a/m2.txt', bestEff: 20, qualityStatus: 'valid', rankingEligible: true },
        { id: 'm3', sample: 'DEVICE B', group: 'B', path: 'b/m3.txt', bestEff: 19, qualityStatus: 'valid', rankingEligible: true }
      ],
      findings: [{ id: 'f1', status: 'open', severity: 'warning', title: 'Naming', target: 'm1' }],
      design: { solutions: [], devices: [{ id: 'd1', name: 'Device A', sampleNames: ['DEVICE A'], solutionIds: [], stack: [], process: {} }] },
      derived: { chat: { conversation: [] } }
    };
    return exp;
  }
  function install(exp, route) {
    LF.State = { state: { experiment: exp, ui: { route: route || 'experiment-results', selectedMeasurementId: null, selectedDesignDeviceId: 'd1' } }, subscribe: function () { return function () {}; } };
    LF.AnalysisSummary.ensure = function () { return exp.analysisSummary; };
    LF.ExportProjections = { preparationContext: function () { return { nomad: { missing: [{ id: 'data.institution', label: 'Institution', required: true }] }, readypv: { missing: [{ id: 'contact.email', label: 'Contact email' }] }, allowed_fields: { nomad: ['data.institution'], readypv: ['contact.email'] } }; } };
  }

  t['session memory is module state and never part of the experiment snapshot'] = function () {
    const exp = fake(); install(exp);
    LF.AssistantCore.clearMemory();
    LF.AssistantCore.memory(exp);
    LF.AssistantCore.noteTurn({ focus: { kind: 'sample', id: 's1', label: 'DEVICE A' }, lastIntent: 'explain', lastTarget: 'results', lastFocusAt: '2026-01-01T00:00:00.000Z' });
    const snapshot = LF.AssistantCore.memorySnapshot();
    assert(snapshot.focus.label, 'DEVICE A', 'focus stored in session memory');
    assert(JSON.stringify(exp).indexOf('routeCache'), -1, 'memory is not written to the experiment');
    LF.AssistantCore.clearMemory();
    assert(LF.AssistantCore.memorySnapshot(), null, 'memory cleared');
  };

  t['entity focus resolves canonical identifiers without a language lexicon'] = function () {
    const exp = fake(); install(exp);
    ['Explain DEVICE A', 'Was ist mit DEVICE A?', '¿Y DEVICE A?', 'DEVICE A について'].forEach(function (question) {
      const focus = LF.AssistantCore.focusFor(exp, question, LF.AssistantCore.scope(exp));
      truthy(focus && focus.id === 's1', 'sample focus for: ' + question);
    });
  };

  t['focus preference and selection fallback stay deterministic'] = function () {
    const exp = fake(); install(exp, 'experiment-results');
    assert(LF.AssistantCore.focusFor(exp, 'compare Device A and Device B', LF.AssistantCore.scope(exp)).kind, 'sample', 'named entity wins');
    assert(LF.AssistantCore.focusFor(exp, 'what about it', LF.AssistantCore.scope(exp)).id, 'd1', 'short message falls back to page selection');
    const long = LF.AssistantCore.focusFor(exp, 'please explain the overall behaviour of this dataset in detail', LF.AssistantCore.scope(exp));
    assert(long, null, 'long generic question stays unbiased');
  };

  t['router cache is per page and never caches clarification'] = function () {
    const exp = fake(); install(exp, 'experiment-results');
    LF.AssistantCore.clearMemory(); LF.AssistantCore.memory(exp);
    LF.AssistantCore.rememberRoute('How many measurements?', LF.AssistantCore.scope(exp), { intent: 'count', target: 'measurements' });
    LF.AssistantCore.rememberRoute('Unclear', LF.AssistantCore.scope(exp), { intent: 'clarify', target: 'current' });
    assert(LF.AssistantCore.cachedRoute('How many measurements?', LF.AssistantCore.scope(exp)).intent, 'count', 'cached route reused');
    assert(LF.AssistantCore.cachedRoute('Unclear', LF.AssistantCore.scope(exp)), null, 'clarify is never cached');
    const other = { page: 'Design', view: '', selected: {} };
    assert(LF.AssistantCore.cachedRoute('How many measurements?', other), null, 'cache is page-scoped');
  };

  t['clarify is recovered only for an entity-free follow-up'] = function () {
    const exp = fake(); install(exp);
    LF.AssistantCore.clearMemory(); LF.AssistantCore.memory(exp);
    LF.AssistantCore.noteTurn({ lastIntent: 'explain', lastTarget: 'results' });
    const recovered = LF.AssistantCore.refineRoute({ intent: 'clarify' }, exp, 'and why?', LF.AssistantCore.scope(exp));
    assert(recovered.intent, 'explain', 'prior intent recovered');
    assert(recovered.followup, true, 'recovered route is a follow-up');
    const withEntity = LF.AssistantCore.refineRoute({ intent: 'clarify' }, exp, 'DEVICE B?', LF.AssistantCore.scope(exp));
    assert(withEntity.intent, 'clarify', 'a new entity keeps clarification');
  };

  t['fact sections follow intent before the open page'] = function () {
    const exp = fake(); install(exp, 'experiment-results');
    const exportPlan = LF.AssistantCore.planFromRoute(exp, 'what metadata is missing?', { intent: 'scientific', target: 'export', followup: false }, LF.AssistantCore.scope(exp));
    truthy(exportPlan.context.facts.export, 'export facts are included from the Results page');
    const reviewPlan = LF.AssistantCore.planFromRoute(exp, 'review DEVICE A', { intent: 'explain', target: 'review', followup: false }, LF.AssistantCore.scope(exp));
    truthy(reviewPlan.context.facts.open_findings, 'review facts follow the target');
    const designPlan = LF.AssistantCore.planFromRoute(exp, 'review design', { intent: 'design_review', target: 'design', followup: false }, LF.AssistantCore.scope(exp));
    truthy(designPlan.context.facts.design, 'design facts follow the intent');
  };

  t['flat digest stays small and carries the salient scalars'] = function () {
    const exp = fake(); install(exp);
    const plan = LF.AssistantCore.planFromRoute(exp, 'Explain DEVICE A', { intent: 'explain', target: 'results', followup: false }, LF.AssistantCore.scope(exp));
    const digest = plan.context.facts_digest;
    truthy(Array.isArray(digest) && digest.length > 0 && digest.length <= 14, 'bounded digest');
    const text = digest.join('\n');
    truthy(/measurements=4/.test(text), 'measurement count');
    truthy(/best_pce=21\.37/.test(text), 'best efficiency');
    truthy(/focus=sample:DEVICE A/.test(text), 'focus label');
    truthy(/page=Results/.test(text), 'page name');
  };

  t['envelope parsing tolerates markdown labels and rejects free prose'] = function () {
    const parsed = LF.AssistantCore.parseEnvelope('**ANSWER:** Device A is best.\n**BASIS:** facts.focus, facts.results.summary\n**UNKNOWN:** lifetime');
    assert(parsed.answer, 'Device A is best.', 'answer parsed');
    assert(parsed.basis, ['facts.focus', 'facts.results.summary'], 'basis parsed');
    assert(parsed.unknown, 'lifetime', 'unknown parsed');
    assert(LF.AssistantCore.parseEnvelope('Just a normal sentence without labels.'), null, 'prose without labels is not an envelope');
  };

  t['envelope grounding accepts supplied numbers and rejects invented ones'] = function () {
    const pack = { task: { intent: 'explain' }, scope: { page: 'Results' }, facts: { results: { summary: { measurementCount: 4, bestEfficiency: 21.37, bestSample: 'DEVICE A' } }, focus: { label: 'DEVICE A' } } };
    const good = LF.AssistantCore.validateEnvelope({ answer: 'DEVICE A is best with 21.4% across 4 measurements.', basis: ['facts.results.summary', 'facts.focus'] }, pack, 'Explain DEVICE A');
    truthy(good.ok, 'supplied numbers and rounded values are accepted');
    const badBasis = LF.AssistantCore.validateEnvelope({ answer: 'DEVICE A is best.', basis: ['facts.workspace.contacts'] }, pack, 'Explain');
    assert(badBasis.ok, false, 'unknown basis fails');
    assert(badBasis.unknownBasis, ['facts.workspace.contacts'], 'unknown basis reported');
    const badNumbers = LF.AssistantCore.validateEnvelope({ answer: 'Efficiency is 99.9% for 12 cells.', basis: ['facts.results.summary'] }, pack, 'Explain');
    assert(badNumbers.severe, true, 'fully unsupported numbers are severe');
  };
};
