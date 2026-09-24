'use strict';
/*
 * P2 golden matrix for the small-model Assistant: intent -> fact sections,
 * flat digest discipline, envelope grounding and token-free local answers.
 * It runs fully offline; no provider is contacted.
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
require('../../assets/js/ai/assistant.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
}
function truthy(value, label) { if (!value) throw new Error(label || 'expected truthy value'); }
function falsy(value, label) { if (value) throw new Error(label || 'expected falsy value'); }

module.exports = function (t, LF) {
  function fake() {
    return {
      id: 'exp_golden', meta: { name: 'Golden' },
      analysis: { summary: { measurementCount: 6, sampleCount: 3, experimentCount: 2, eligibleCount: 5, bestEfficiency: 22.5, bestSample: 'S1', bestExperiment: 'Control' } },
      analysisSummary: { advanced: { quality: { eligible: 5 }, pairedScans: { count: 4, absDeltaPce: { median: 0.5 } } }, findings: { open: 1 }, anomalies: [{ sample: 'S2' }] },
      sync: { revision: 0 },
      samples: [{ id: 's1', name: 'S1', group: 'Control', measurementIds: ['m1'] }, { id: 's2', name: 'S2', group: 'Test', measurementIds: ['m2'] }],
      experiments: [{ id: 'g1', name: 'Control' }],
      measurements: [{ id: 'm1', sample: 'S1', group: 'Control', path: 'c/m1.txt', bestEff: 22.5, qualityStatus: 'valid', rankingEligible: true }, { id: 'm2', sample: 'S2', group: 'Test', path: 't/m2.txt', bestEff: 18, qualityStatus: 'review', rankingEligible: false }],
      findings: [{ id: 'f1', status: 'open', severity: 'warning', title: 'Check S2', target: 'm2' }],
      design: { solutions: [{ id: 'sol1', name: 'Ink A', role: 'absorber', solutes: 'FAI', solvents: 'DMF', additives: '' }], devices: [{ id: 'd1', name: 'Device A', sampleNames: ['S1'], solutionIds: ['sol1'], stack: [{ role: 'ETL', material: 'SnO2', thickness: '30 nm' }], process: { coating: 'spin', annealing: '100C', atmosphere: 'air', notes: '' } }] },
      derived: { chat: { conversation: [] } }
    };
  }
  function install(exp, route) {
    LF.State = { state: { experiment: exp, ui: { route: route || 'experiment-results', selectedMeasurementId: null, selectedDesignDeviceId: 'd1' } }, subscribe: function () { return function () {}; } };
    LF.AnalysisSummary.ensure = function () { return exp.analysisSummary; };
    LF.DesignModel.missingDomains = function () { return ['process']; };
    LF.DesignModel.pendingDomains = function () { return ['process']; };
  }

  const matcher = /^(?:explain|compare|scientific|design_review|clarify)$/;

  t['golden: each interpretive intent receives only its own fact sections'] = function () {
    const exp = fake(); install(exp, 'experiment-results');
    const cases = [
      { question: 'Explain S1', route: { intent: 'explain', target: 'results' }, present: ['results', 'focus'], absent: ['design', 'export'] },
      { question: 'Review the design of Device A', route: { intent: 'design_review', target: 'design' }, present: ['design'], absent: ['export'] },
      { question: 'What is still missing for export?', route: { intent: 'scientific', target: 'export' }, present: ['export'], absent: ['design'] },
      { question: 'Review the open findings for S2', route: { intent: 'scientific', target: 'review' }, present: ['open_findings'], absent: ['export', 'design'] }
    ];
    cases.forEach(function (item) {
      truthy(matcher.test(item.route.intent), 'golden case uses an interpretive intent: ' + item.question);
      const plan = LF.AssistantCore.planFromRoute(exp, item.question, Object.assign({ followup: false }, item.route), LF.AssistantCore.scope(exp));
      assert(plan.mode, 'llm', item.question + ' -> provider answer');
      item.present.forEach(function (key) { truthy(plan.context.facts[key], item.question + ' must include facts.' + key); });
      item.absent.forEach(function (key) { falsy(plan.context.facts[key], item.question + ' must not include facts.' + key); });
      truthy(JSON.stringify(plan.context).length < 6000, item.question + ' context stays bounded');
      falsy(plan.context.experiment_brief, item.question + ' receives no broad brief');
    });
  };

  t['golden: control questions stay token-free and language agnostic'] = function () {
    const exp = fake(); install(exp, 'experiment-results');
    truthy(LF.Assistant.deterministicAnswer(exp, '/status'), 'explicit command is local');
    truthy(LF.Assistant.deterministicAnswer(exp, '/count measurements'), 'explicit count is local');
    ['What is the best PCE?', 'Was ist die beste Effizienz?', '¿Cuál es la mejor eficiencia?'].forEach(function (question) {
      assert(LF.Assistant.deterministicAnswer(exp, question), null, question + ' must route');
    });
  };

  t['golden: envelope grounding matrix'] = function () {
    const exp = fake(); install(exp, 'experiment-results');
    const plan = LF.AssistantCore.planFromRoute(exp, 'Explain S1', { intent: 'explain', target: 'results', followup: false }, LF.AssistantCore.scope(exp));
    const pack = plan.pack;
    const cases = [
      { text: 'ANSWER: S1 is best.\nBASIS: facts.results.summary, facts.focus', ok: true, label: 'grounded answer' },
      { text: 'ANSWER: S1 is best.\nBASIS: facts.workspace.contacts', ok: false, label: 'invented basis' },
      { text: 'ANSWER: The efficiency is 99.0% for 8 cells.\nBASIS: facts.results.summary', ok: false, label: 'invented numbers' },
      { text: 'ANSWER: The best eligible PCE is 22.5% for S1.', ok: true, label: 'supplied numbers without basis' }
    ];
    cases.forEach(function (item) {
      const envelope = LF.AssistantCore.parseEnvelope(item.text);
      truthy(envelope, item.label + ' parses');
      const result = LF.AssistantCore.validateEnvelope(envelope, pack, 'Explain S1');
      assert(result.ok, item.ok, item.label);
    });
  };

  t['golden: digest never exceeds the small-model line budget'] = function () {
    const exp = fake(); install(exp, 'experiment-results');
    const plan = LF.AssistantCore.planFromRoute(exp, 'Explain S1', { intent: 'explain', target: 'results', followup: false }, LF.AssistantCore.scope(exp));
    const digest = plan.context.facts_digest || [];
    truthy(digest.length <= 14, 'digest lines bounded');
    truthy(digest.join('\n').length <= 400, 'digest chars bounded');
    digest.forEach(function (line) { falsy(/[\r\n]/.test(line), 'digest lines are single-line'); });
  };
};
