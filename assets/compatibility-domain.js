(() => {
  'use strict';

  const processes = [
    {
      id: 'PROC-PSC-NIP', key: 'psc-nip', name: 'Perovskite solar cell fabrication — n-i-p', shortName: 'PSC fabrication · n-i-p',
      version: '2.0', status: 'Active', description: 'Prepare precursor solutions, fabricate n-i-p devices, characterise them and prepare traceable reports and NOMAD records.',
      experiments: 5, samples: 24, progress: 72, nomad: 92, updated: 'Today · 16:20',
      optionalProjects: ['PRJ-MCP-01'],
      phases: ['Solutions', 'Stacks & samples', 'Processing', 'Data', 'Analysis', 'Charts & report', 'Export', 'NOMAD'],
      resources: ['FA–Cs 1.2 M recipe', 'PSC n-i-p stack template', 'PSC n-i-p standard protocol v4.1', 'Spin Coater 01', 'Hot Plate 02'],
      measurements: ['J–V', 'EQE', 'XRD', 'AFM'],
      outputs: ['Prepared batches', 'Device samples', 'Raw and processed files', 'Validated results', 'Report', 'NOMAD package']
    },
    {
      id: 'PROC-FILM-SCREEN', key: 'film-screen', name: 'Perovskite thin-film screening', shortName: 'Thin-film screening',
      version: '1.3', status: 'Active', description: 'Screen solution, deposition and annealing conditions on film samples without requiring complete photovoltaic devices.',
      experiments: 3, samples: 18, progress: 54, nomad: 78, updated: 'Yesterday',
      optionalProjects: ['PRJ-MCP-01', 'PRJ-STB-02'],
      phases: ['Solutions', 'Substrate & film stacks', 'Processing', 'Data', 'Analysis', 'Charts & report', 'Export', 'NOMAD'],
      resources: ['Film screening stack', 'Spin coating protocol', 'Substrate cleaning protocol'],
      measurements: ['UV–Vis', 'PL', 'XRD', 'AFM'],
      outputs: ['Film samples', 'Spectra', 'Morphology images', 'Screening report']
    },
    {
      id: 'PROC-FLEX-PIN', key: 'flex-pin', name: 'Flexible photovoltaic pilot — p-i-n', shortName: 'Flexible pilot · p-i-n',
      version: '0.4', status: 'Draft', description: 'Low-temperature pilot process for flexible p-i-n devices with explicit substrate and thermal-budget constraints.',
      experiments: 1, samples: 6, progress: 28, nomad: 46, updated: '24 Jul 2026',
      optionalProjects: ['PRJ-FLX-03'],
      phases: ['Solutions', 'Flexible stacks', 'Low-temperature processing', 'Data', 'Analysis', 'Report', 'Export', 'NOMAD'],
      resources: ['PET/ITO substrate', 'Low-temperature transport layers', 'Flexible p-i-n draft protocol'],
      measurements: ['J–V', 'Bending test', 'Optical microscopy'],
      outputs: ['Flexible devices', 'Bending-cycle evidence', 'Pilot report']
    }
  ];

  const experiments = [
    { id: 'PSC-2026-041', name: 'Solvent and annealing comparison', process: 'psc-nip', project: 'Mixed-cation perovskite optimisation', projectOptional: true, status: 'In progress', progress: 75, next: 'Import one missing J–V file', updated: 'Today · 16:20', stacks: 2, samples: 6 },
    { id: 'PSC-2026-038', name: 'Spin-speed deposition window', process: 'psc-nip', project: 'Mixed-cation perovskite optimisation', projectOptional: true, status: 'Analysis', progress: 84, next: 'Review comparison chart', updated: '29 Jul 2026', stacks: 3, samples: 9 },
    { id: 'FILM-2026-019', name: 'DMF:DMSO ratio screening', process: 'film-screen', project: 'Mixed-cation perovskite optimisation', projectOptional: true, status: 'Processing', progress: 48, next: 'Record annealing deviations', updated: '28 Jul 2026', stacks: 4, samples: 12 },
    { id: 'FILM-2026-014', name: 'Precursor shelf-life check', process: 'film-screen', project: 'No project', projectOptional: false, status: 'Report', progress: 91, next: 'Approve conclusion', updated: '26 Jul 2026', stacks: 2, samples: 6 },
    { id: 'FLEX-2026-003', name: 'PET/ITO thermal-budget pilot', process: 'flex-pin', project: 'Flexible p-i-n pilot', projectOptional: true, status: 'Planning', progress: 22, next: 'Confirm stack materials', updated: '24 Jul 2026', stacks: 1, samples: 6 }
  ];

  function getCurrentProcess(userKey = 'default') {
    let key = processes[0].key;
    try { key = sessionStorage.getItem(`labflow-process-${userKey}`) || key; } catch (_) {}
    return processes.find(item => item.key === key) || processes[0];
  }

  function setCurrentProcess(key, userKey = 'default') {
    if (!processes.some(item => item.key === key)) return;
    try { sessionStorage.setItem(`labflow-process-${userKey}`, key); } catch (_) {}
  }

  window.LabFlowDomain = { processes, experiments, getCurrentProcess, setCurrentProcess };

  function activeUserKey() {
    try { return localStorage.getItem('labflow-user') || 'ew'; } catch (_) { return 'ew'; }
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  function renderProcesses() {
    const root = $('#processList');
    if (!root) return;
    const query = ($('#processSearch')?.value || '').trim().toLowerCase();
    const filtered = processes.filter(item => `${item.name} ${item.description} ${item.status} ${item.measurements.join(' ')}`.toLowerCase().includes(query));
    root.innerHTML = filtered.map((item, index) => `
      <article class="panel process-list-card" data-filter-item>
        <div class="process-card-main">
          <div class="process-card-heading"><span class="process-index">${String(index + 1).padStart(2, '0')}</span><div><span class="eyebrow mono">${escapeHtml(item.id)} · v${escapeHtml(item.version)}</span><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.description)}</p></div></div>
          <div class="process-phase-strip">${item.phases.map(phase => `<span>${escapeHtml(phase)}</span>`).join('<b>→</b>')}</div>
          <div class="process-card-meta"><span><strong>${item.experiments}</strong> experiments</span><span><strong>${item.samples}</strong> samples</span><span><strong>${item.measurements.length}</strong> expected measurements</span><span class="badge ${item.status === 'Active' ? 'success' : 'warning'}">${escapeHtml(item.status)}</span></div>
        </div>
        <aside class="process-card-actions"><span class="process-progress"><i style="--value:${item.progress}"></i><strong>${item.progress}%</strong><small>execution coverage</small></span><button class="button small" type="button" data-action="process-select" data-process="${escapeHtml(item.key)}">Set current</button><a class="button primary" href="pipeline.html?process=${encodeURIComponent(item.key)}">Open process</a></aside>
      </article>`).join('') || '<div class="useful-empty"><strong>No matching process</strong><small>Try a workflow, measurement or status.</small></div>';
  }

  function renderExperiments() {
    const root = $('#experimentDirectory');
    if (!root) return;
    const query = ($('#experimentSearch')?.value || '').trim().toLowerCase();
    const processKey = $('#experimentProcessFilter')?.value || 'all';
    const filtered = experiments.filter(item => (processKey === 'all' || item.process === processKey) && `${item.id} ${item.name} ${item.project} ${item.status} ${item.next}`.toLowerCase().includes(query));
    root.innerHTML = filtered.map(item => {
      const process = processes.find(candidate => candidate.key === item.process);
      return `<article class="panel experiment-directory-card" data-filter-item>
        <div class="experiment-directory-main"><span class="badge ${item.status === 'Planning' ? 'warning' : item.progress > 80 ? 'success' : 'info'}">${escapeHtml(item.status)}</span><span class="mono">${escapeHtml(item.id)}</span><h2>${escapeHtml(item.name)}</h2><p><strong>Process:</strong> ${escapeHtml(process?.name || item.process)}</p><p class="subtle"><strong>Optional project:</strong> ${escapeHtml(item.project)}</p><div class="experiment-directory-meta"><span>${item.stacks} stacks</span><span>${item.samples} samples</span><span>${escapeHtml(item.updated)}</span></div></div>
        <div class="experiment-directory-next"><small>Recommended next action</small><strong>${escapeHtml(item.next)}</strong><div class="linear-progress"><span style="width:${item.progress}%"></span></div><span>${item.progress}% complete</span><a class="button primary" href="experiment.html?experiment=${encodeURIComponent(item.id)}">Open experiment</a></div>
      </article>`;
    }).join('') || '<div class="useful-empty"><strong>No matching experiments</strong><small>Change the process filter or search terms.</small></div>';
  }

  function bindProcessPage() {
    if (document.body.dataset.page !== 'process') return;
    const key = new URLSearchParams(location.search).get('process') || getCurrentProcess(activeUserKey()).key;
    const process = processes.find(item => item.key === key) || processes[0];
    $$('[data-process-name]').forEach(node => node.textContent = process.name);
    $$('[data-process-short-name]').forEach(node => node.textContent = process.shortName);
    $$('[data-process-id]').forEach(node => node.textContent = process.id);
    $$('[data-process-version]').forEach(node => node.textContent = process.version);
    $$('[data-process-description]').forEach(node => node.textContent = process.description);
    $$('[data-start-process]').forEach(node => node.setAttribute('href', `experiments.html?process=${encodeURIComponent(process.key)}#new`));
    const phaseRoot = $('#processPhaseMap');
    if (phaseRoot) phaseRoot.innerHTML = process.phases.map((phase, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(phase)}</strong><small>${index < 2 ? 'Definition + concrete evidence' : index < 5 ? 'Experiment execution' : 'Review and interoperability'}</small></article>`).join('');
    const resourceRoot = $('#processDefaultResources');
    if (resourceRoot) resourceRoot.innerHTML = process.resources.map((resource, index) => `<li><span>${index + 1}</span><strong>${escapeHtml(resource)}</strong><small>${index === 2 ? 'Reusable protocol; actual values belong to runs' : 'Reusable default; experiment stores a snapshot'}</small></li>`).join('');
    const measurementRoot = $('#processMeasurements');
    if (measurementRoot) measurementRoot.innerHTML = process.measurements.map(item => `<span>${escapeHtml(item)}</span>`).join('');
    const outputRoot = $('#processOutputs');
    if (outputRoot) outputRoot.innerHTML = process.outputs.map(item => `<span>${escapeHtml(item)}</span>`).join('');
    const expRoot = $('#processExperiments');
    if (expRoot) expRoot.innerHTML = experiments.filter(item => item.process === process.key).map(item => `<a href="experiment.html?experiment=${encodeURIComponent(item.id)}"><span class="mono">${escapeHtml(item.id)}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.next)}</small></span><span class="badge info">${item.progress}%</span></a>`).join('');
  }

  let experimentCreateStep = 0;
  function renderExperimentCreateWizard() {
    const modal = $('#startExperimentModal');
    if (!modal) return;
    $$('[data-experiment-create-panel]', modal).forEach(panel => panel.hidden = Number(panel.dataset.experimentCreatePanel) !== experimentCreateStep);
    $$('[data-experiment-create-progress]', modal).forEach((item, index) => item.classList.toggle('active', index === experimentCreateStep));
    const prev = $('[data-action="experiment-create-prev"]', modal);
    const next = $('[data-action="experiment-create-next"]', modal);
    const create = $('[data-action="minimal-experiment-create"]', modal);
    if (prev) prev.hidden = experimentCreateStep === 0;
    if (next) next.hidden = experimentCreateStep === 2;
    if (create) create.hidden = experimentCreateStep !== 2;
    const processKey = $('input[name="experiment_process"]:checked', modal)?.value || processes[0].key;
    const process = processes.find(item => item.key === processKey) || processes[0];
    const summary = $('#experimentCreateSummary');
    if (summary) summary.innerHTML = `<span><small>Process</small><strong>${escapeHtml(process.name)}</strong></span><span><small>Experiment</small><strong>${escapeHtml($('#minimalExperimentName')?.value || 'Not named yet')}</strong></span><span><small>Starting point</small><strong>${escapeHtml($('input[name="experiment_start"]:checked', modal)?.dataset.label || 'Process defaults')}</strong></span>`;
  }

  function solventRows(root) { return $$('[data-solvent-row]', root); }
  function updateSolventBuilder(root = document) {
    const editor = $('[data-solvent-editor]', root) || (root.matches?.('[data-solvent-editor]') ? root : null);
    if (!editor) return;
    const totalVolume = Number($('[data-solution-total-volume]', editor)?.value || 5);
    const rows = solventRows(editor);
    const ratios = rows.map(row => Math.max(0, Number($('[data-solvent-ratio]', row)?.value || 0)));
    const total = ratios.reduce((sum, value) => sum + value, 0);
    rows.forEach((row, index) => {
      const ratio = ratios[index];
      const normalized = total > 0 ? ratio / total : 0;
      const volume = $('[data-solvent-volume]', row);
      if (volume) volume.textContent = `${(totalVolume * normalized).toFixed(2)} mL`;
      const band = $('[data-solvent-band]', row);
      if (band) band.style.setProperty('--ratio', `${Math.max(3, normalized * 100)}%`);
    });
    const status = $('[data-solvent-status]', editor);
    if (status) {
      status.className = `badge ${Math.abs(total - 100) < 0.01 ? 'success' : 'warning'}`;
      status.textContent = Math.abs(total - 100) < 0.01 ? '100% · valid mixture' : `${total.toFixed(1)}% · adjust ratios`;
    }
    const visual = $('[data-solvent-visual]', editor);
    if (visual) visual.innerHTML = rows.map((row, index) => {
      const name = $('[data-solvent-name]', row)?.value || `Solvent ${index + 1}`;
      const normalized = total > 0 ? ratios[index] / total * 100 : 0;
      return `<span style="--ratio:${Math.max(4, normalized)}%"><b>${escapeHtml(name)}</b><small>${normalized.toFixed(0)}% · ${(totalVolume * normalized / 100).toFixed(2)} mL</small></span>`;
    }).join('');
  }

  function addSolventRow(editor) {
    const list = $('[data-solvent-list]', editor);
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'solvent-component-row';
    row.dataset.solventRow = '';
    row.innerHTML = `<span class="solvent-swatch" data-solvent-band></span><label><small>Solvent</small><input class="input" data-solvent-name value="GBL"></label><label><small>Ratio % v/v</small><input class="input" type="number" min="0" max="100" step="1" data-solvent-ratio value="0"></label><span class="solvent-calculated" data-solvent-volume>0.00 mL</span><button class="icon-button small" type="button" data-action="solvent-remove" aria-label="Remove solvent">×</button>`;
    list.append(row);
    updateSolventBuilder(editor);
  }

  const stackBuilder = {
    selected: 3,
    layers: [
      { type: 'substrate', role: 'Substrate', material: 'Glass / ITO', thickness: '1.1 mm', source: 'SUB-ITO-025', method: 'Cleaning + UV-Ozone' },
      { type: 'transport', role: 'Electron transport layer', material: 'SnO₂', thickness: '30 nm', source: 'SOL-SNO2-014', method: 'Spin coating' },
      { type: 'absorber', role: 'Absorber', material: 'FA–Cs perovskite', thickness: '400 nm', source: 'SOL-081', method: 'Spin coating + annealing' },
      { type: 'transport', role: 'Hole transport layer', material: 'Spiro-OMeTAD', thickness: '180 nm', source: 'SOL-HTL-012', method: 'Spin coating' },
      { type: 'contact', role: 'Back contact', material: 'Au', thickness: '80 nm', source: 'MAT-AU-03', method: 'Thermal evaporation' }
    ]
  };

  function renderStackBuilder() {
    const root = $('#stackBuilder');
    if (!root) return;
    const ordered = [...stackBuilder.layers].reverse();
    root.innerHTML = `<div class="stack-builder-canvas"><div class="stack-builder-scale"><span>Top contact</span><span>Substrate</span></div><div class="stack-builder-layers">${ordered.map((layer, visualIndex) => {
      const index = stackBuilder.layers.length - visualIndex - 1;
      return `<button type="button" class="stack-builder-layer ${layer.type} ${index === stackBuilder.selected ? 'selected' : ''}" data-action="stack-select-layer" data-layer-index="${index}"><span>${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(layer.material)}</strong><small>${escapeHtml(layer.role)} · ${escapeHtml(layer.method)}</small></span><b>${escapeHtml(layer.thickness)}</b></button>`;
    }).join('')}</div></div>`;
    const layer = stackBuilder.layers[stackBuilder.selected] || stackBuilder.layers[0];
    const form = $('#stackLayerEditor');
    if (form && layer) {
      form.innerHTML = `<div class="panel-header"><div class="panel-title"><strong>Selected layer ${stackBuilder.selected + 1}</strong><small>Every layer links material, source and deposition evidence.</small></div><span class="badge info">${escapeHtml(layer.type)}</span></div><div class="panel-body form-grid compact-form"><div class="field"><label>Role</label><input class="input" data-stack-field="role" value="${escapeHtml(layer.role)}"></div><div class="field"><label>Material</label><input class="input" data-stack-field="material" value="${escapeHtml(layer.material)}"></div><div class="field"><label>Thickness</label><input class="input" data-stack-field="thickness" value="${escapeHtml(layer.thickness)}"></div><div class="field"><label>Definition / batch</label><input class="input mono" data-stack-field="source" value="${escapeHtml(layer.source)}"></div><div class="field span-2"><label>Deposition or creation method</label><input class="input" data-stack-field="method" value="${escapeHtml(layer.method)}"></div></div><div class="panel-footer stack-layer-actions"><button class="button small" type="button" data-action="stack-layer-down">Move toward substrate</button><button class="button small" type="button" data-action="stack-layer-up">Move toward top</button><button class="button small" type="button" data-action="stack-layer-duplicate">Duplicate</button><button class="button small danger" type="button" data-action="stack-layer-remove">Remove</button></div>`;
    }
    const count = $('#stackBuilderCount');
    if (count) count.textContent = `${stackBuilder.layers.length} ordered layers`;
  }

  function modifySelectedLayer(direction) {
    const index = stackBuilder.selected;
    const next = index + direction;
    if (next < 0 || next >= stackBuilder.layers.length) return;
    [stackBuilder.layers[index], stackBuilder.layers[next]] = [stackBuilder.layers[next], stackBuilder.layers[index]];
    stackBuilder.selected = next;
    renderStackBuilder();
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderProcesses();
    renderExperiments();
    bindProcessPage();
    const requestedProcess = new URLSearchParams(location.search).get('process') || getCurrentProcess(activeUserKey()).key;
    const requestedRadio = $(`input[name="experiment_process"][value="${CSS.escape(requestedProcess)}"]`);
    if (requestedRadio) requestedRadio.checked = true;
    renderExperimentCreateWizard();
    if (location.hash === '#new' && $('#startExperimentModal')) setTimeout(() => $('[data-action="experiment-wizard"]')?.click(), 0);
    $$('[data-solvent-editor]').forEach(editor => updateSolventBuilder(editor));
    renderStackBuilder();
  });

  document.addEventListener('input', event => {
    if (event.target.matches('#processSearch')) renderProcesses();
    if (event.target.matches('#experimentSearch,#experimentProcessFilter')) renderExperiments();
    if (event.target.matches('[data-solvent-ratio],[data-solvent-name],[data-solution-total-volume]')) updateSolventBuilder(event.target.closest('[data-solvent-editor]'));
    if (event.target.matches('#minimalExperimentName')) renderExperimentCreateWizard();
    if (event.target.matches('[data-stack-field]')) {
      const layer = stackBuilder.layers[stackBuilder.selected];
      if (layer) {
        layer[event.target.dataset.stackField] = event.target.value;
        const selected = $('[data-action="stack-select-layer"].selected');
        if (selected) {
          const strong = $('strong', selected);
          const small = $('small', selected);
          const thickness = $('b', selected);
          if (strong) strong.textContent = layer.material;
          if (small) small.textContent = `${layer.role} · ${layer.method}`;
          if (thickness) thickness.textContent = layer.thickness;
        }
      }
    }
  });

  document.addEventListener('change', event => {
    if (event.target.matches('#experimentProcessFilter')) renderExperiments();
    if (event.target.matches('input[name="experiment_process"],input[name="experiment_start"]')) renderExperimentCreateWizard();
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'experiment-wizard') { experimentCreateStep = 0; setTimeout(renderExperimentCreateWizard, 0); }
    if (action === 'experiment-create-prev') { experimentCreateStep = Math.max(0, experimentCreateStep - 1); renderExperimentCreateWizard(); }
    if (action === 'experiment-create-next') {
      if (experimentCreateStep === 1 && (!$('#minimalExperimentName')?.value.trim() || !$('#minimalExperimentObjective')?.value.trim())) return;
      experimentCreateStep = Math.min(2, experimentCreateStep + 1); renderExperimentCreateWizard();
    }
    if (action === 'solvent-add') addSolventRow(button.closest('[data-solvent-editor]'));
    if (action === 'solvent-remove') { const editor = button.closest('[data-solvent-editor]'); button.closest('[data-solvent-row]')?.remove(); updateSolventBuilder(editor); }
    if (action === 'stack-select-layer') { stackBuilder.selected = Number(button.dataset.layerIndex); renderStackBuilder(); }
    if (action === 'stack-add-layer') { const type = button.dataset.layerType || 'transport'; stackBuilder.layers.push({ type, role: type === 'contact' ? 'Contact' : 'Functional layer', material: 'New material', thickness: '—', source: 'Select resource', method: 'Select method' }); stackBuilder.selected = stackBuilder.layers.length - 1; renderStackBuilder(); }
    if (action === 'stack-layer-up') modifySelectedLayer(1);
    if (action === 'stack-layer-down') modifySelectedLayer(-1);
    if (action === 'stack-layer-duplicate') { stackBuilder.layers.splice(stackBuilder.selected + 1, 0, { ...stackBuilder.layers[stackBuilder.selected] }); stackBuilder.selected += 1; renderStackBuilder(); }
    if (action === 'stack-layer-remove' && stackBuilder.layers.length > 1) { stackBuilder.layers.splice(stackBuilder.selected, 1); stackBuilder.selected = Math.min(stackBuilder.selected, stackBuilder.layers.length - 1); renderStackBuilder(); }
  });
})();
