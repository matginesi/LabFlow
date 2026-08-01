(() => {
  'use strict';
  const esc = value => LabFlowProjectStore.esc(value);

  function measurementType(dataset) {
    return dataset.measurementType || window.LabFlowMeasurements?.typeFromLegacy(dataset.measurement) || 'generic';
  }

  function quality() {
    const state = LabFlowProjectStore.read();
    const solutions = state.materials?.solutions || [];
    const stacks = state.fabrication?.stacks || [];
    const measurements = (state.data?.datasets || []).filter(item => item.kind === 'measurement' || item.measurementType || item.measurement);
    const typed = measurements.filter(item => measurementType(item) !== 'generic');
    const hasAtmosphere = stacks.some(stack => stack.atmosphere || stack.processes?.some(process => /atmosphere|nitrogen|n2|air|glovebox/i.test(`${process.name || ''} ${process.notes || ''}`)));
    const missingActiveArea = typed.filter(item => ['jv', 'dark_jv'].includes(measurementType(item)) && !item.conditions?.activeArea);
    const missingInstruments = typed.filter(item => ['ipce', 'uvvis'].includes(measurementType(item)) && !item.conditions?.instrument);
    const missingStabilityEnvironment = typed.filter(item => measurementType(item) === 'stability' && !item.conditions?.environment);
    const hasUnits = measurements.some(item => item.manual ? item.rows?.some(row => row[2]) : item.mapping?.some(map => map.unit));
    const hasProvenance = measurements.every(item => item.source || item.filename);
    const hasTargets = measurements.every(item => item.sample || item.target || item.stackId);
    const recommendations = [];
    if (stacks.length && !hasAtmosphere) recommendations.push({ step: 'stack', title: 'Add fabrication atmosphere', why: 'Improves reproducibility across stack variants.' });
    if (missingActiveArea.length) recommendations.push({ step: 'data', title: `Add active area to ${missingActiveArea.length} JV measurement${missingActiveArea.length > 1 ? 's' : ''}`, why: 'Improves device-to-device comparison and current-density provenance.' });
    if (missingInstruments.length) recommendations.push({ step: 'data', title: `Add instrument to ${missingInstruments.length} optical measurement${missingInstruments.length > 1 ? 's' : ''}`, why: 'Improves acquisition provenance.' });
    if (missingStabilityEnvironment.length) recommendations.push({ step: 'data', title: 'Add stability environment', why: 'Temperature, atmosphere and humidity make stability data more reproducible.' });
    const nomadChecks = [
      { label: 'Materials', ok: solutions.length > 0 },
      { label: 'Stack', ok: stacks.length > 0 },
      { label: 'Typed measurement', ok: typed.length > 0 },
      { label: 'Units', ok: hasUnits },
      { label: 'Targets & provenance', ok: hasTargets && hasProvenance }
    ];
    return { state, solutions, stacks, measurements, typed, recommendations, nomadChecks };
  }

  function render() {
    const root = document.querySelector('#projectInsights');
    if (!root) return;
    const q = quality();
    const core = q.solutions.length > 0 && q.stacks.length > 0;
    const analysis = q.typed.length > 0;
    const nomadReady = q.nomadChecks.filter(check => check.ok).length;
    const missingNomad = q.nomadChecks.find(check => !check.ok)?.label;
    root.innerHTML = `<section class="project-quality"><header><div><span class="eyebrow">Data quality</span><h2>Useful now, improvable later</h2></div><small>Scientific criteria · not form completion</small></header><div class="quality-grid"><article class="${core ? 'ready' : 'missing'}"><span>Core experiment</span><strong>${core ? 'Ready' : 'Needs core context'}</strong><small>${q.solutions.length} solution${q.solutions.length === 1 ? '' : 's'} · ${q.stacks.length} stack${q.stacks.length === 1 ? '' : 's'}</small></article><article class="${analysis ? 'ready' : 'missing'}"><span>Analysis readiness</span><strong>${analysis ? 'Ready' : 'Add a typed Measurement'}</strong><small>${q.typed.length} scientific measurement${q.typed.length === 1 ? '' : 's'}</small></article><article class="${q.recommendations.length ? 'recommend' : 'ready'}"><span>Reproducibility</span><strong>${q.recommendations.length ? `${q.recommendations.length} recommendation${q.recommendations.length > 1 ? 's' : ''}` : 'Good'}</strong><small>Recommended details never block progress</small></article><article class="${nomadReady === q.nomadChecks.length ? 'ready' : 'recommend'}"><span>NOMAD readiness</span><strong>${nomadReady}/${q.nomadChecks.length} core checks</strong><small>${esc(missingNomad ? `Next: ${missingNomad}` : 'Core mapping ready')}</small></article></div></section><aside class="improve-project"><header><span data-icon="spark"></span><div><strong>Improve this Project</strong><small>Ask when useful, not when the object is created.</small></div></header><div>${q.recommendations.length ? q.recommendations.slice(0,4).map(item => `<button type="button" data-action="pipeline-step" data-step="${item.step}"><span>+</span><strong>${esc(item.title)}</strong><small>${esc(item.why)}</small></button>`).join('') : '<div class="improve-empty"><strong>No important metadata gaps</strong><small>Continue the workflow; details can still be refined later.</small></div>'}</div></aside>`;
  }

  function chain() {
    const root = document.querySelector('#projectDataChain');
    if (!root) return;
    const q = quality();
    const analysisCount = q.state.analysis?.conclusions?.length || q.state.analysis?.comparisons?.length || 0;
    const states = [
      q.solutions.length > 0,
      q.stacks.length > 0,
      q.stacks.some(stack => (stack.processes || []).length > 0),
      q.stacks.some(stack => (stack.samples || []).length > 0),
      q.measurements.length > 0,
      analysisCount > 0,
      false,
      false
    ];
    const labels = ['Solution', 'Stack', 'Fabrication', 'Sample / Device', 'Measurement', 'Analysis', 'Report', 'NOMAD'];
    const firstMissing = Math.max(0, states.findIndex(done => !done));
    root.innerHTML = labels.map((label, index) => `<span class="${states[index] ? 'known' : index === firstMissing ? 'active' : ''}"><i>${index + 1}</i><b>${label}</b></span>`).join('<em>→</em>');
  }

  function feedback() {
    const fragment = document.querySelector('.pipeline-fragment');
    if (!fragment) return;
    fragment.querySelector('.step-feedback')?.remove();
    fragment.insertAdjacentHTML('beforeend', `<aside class="step-feedback"><div><strong>Was this step easy to complete?</strong><small>POC only · no telemetry or response is stored.</small></div><button type="button" data-step-feedback="yes">Yes</button><button type="button" data-step-feedback="no">No</button><details><summary>Optional detail</summary><label><input type="checkbox"> Too many fields</label><label><input type="checkbox"> Something missing</label><label><input type="checkbox"> Asked twice</label></details></aside>`);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-step-feedback]');
    if (!button) return;
    button.closest('.step-feedback').innerHTML = '<div><strong>Feedback acknowledged in this mockup</strong><small>No telemetry was recorded.</small></div>';
  });
  document.addEventListener('labflow:project-data', () => { render(); chain(); });
  document.addEventListener('labflow:pipeline-step', () => requestAnimationFrame(feedback));
  document.addEventListener('DOMContentLoaded', () => { render(); chain(); });
})();
