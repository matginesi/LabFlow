(() => {
  'use strict';

  const init = root => {
    if (!root || root.dataset.measurementInit === '1') return;
    root.dataset.measurementInit = '1';
    const S = LabFlowProjectStore, M = LabFlowMeasurements, esc = S.esc;
    let state = S.get('data', { datasets: [] }), draft = null, preferredType = 'auto';
    const form = root.querySelector('[data-data-editor]');
    const stacks = S.get('fabrication', { stacks: [] }).stacks || [];

    const typeOptions = () => [M.types.jv, M.types.dark_jv, M.types.ipce, M.types.uvvis, M.types.stability, M.types.generic]
      .map(type => `<option value="${type.id}">${esc(type.label)}</option>`).join('');
    form.measurementType.innerHTML = typeOptions();

    const stackLabel = id => stacks.find(stack => stack.id === id)?.name || 'Project';
    const targetLabel = dataset => dataset.sample || dataset.target || stackLabel(dataset.stackId);
    const dataType = dataset => M.typeFor(dataset);
    const parseState = dataset => dataset.parseState || dataset.source?.status || (dataset.binary ? 'Metadata only' : 'Parsed');

    function normaliseDataset(dataset) {
      const copy = structuredClone(dataset || {});
      copy.kind = copy.kind || 'measurement';
      copy.measurementType = copy.measurementType || M.typeFromLegacy(copy.measurement);
      copy.measurement = M.types[copy.measurementType]?.label || copy.measurement || 'Other / Generic';
      copy.conditions = copy.conditions || {};
      copy.provenance = copy.provenance || {};
      copy.mapping = copy.mapping || [];
      copy.rows = copy.rows || [];
      copy.columns = copy.columns || [];
      return copy;
    }

    function stackOptions(selected = '') {
      return `<option value="">Entire Project</option>${stacks.map(stack => `<option value="${esc(stack.id)}" ${stack.id === selected ? 'selected' : ''}>${esc(stack.name)} · ${esc(stack.condition || 'Stack')}</option>`).join('')}`;
    }

    function sampleOptions(stackId, selected = '') {
      const stack = stacks.find(item => item.id === stackId);
      const samples = stack?.samples || [];
      return `<option value="">${stackId ? 'Stack-level measurement' : 'Project-level evidence'}</option>${samples.map(sample => `<option value="${esc(sample)}" ${sample === selected ? 'selected' : ''}>${esc(sample)}</option>`).join('')}`;
    }

    function axisMap(dataset) {
      const explicitX = dataset.mapping?.findIndex(item => item.meaning === 'x');
      const explicitY = dataset.mapping?.findIndex(item => item.meaning === 'signal');
      if (explicitX >= 0 && explicitY >= 0) return { x: explicitX, y: explicitY };
      return M.mapping(dataset.measurementType, dataset.columns);
    }

    function series(dataset) {
      return M.series(dataset.measurementType, dataset.columns, dataset.rows, axisMap(dataset));
    }

    function chartMarkup(dataset) {
      const type = dataType(dataset), points = series(dataset);
      if (points.length < 2) return '';
      const W = 720, H = 260, p = { l: 54, r: 18, t: 24, b: 40 };
      const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
      const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
      const xr = xmax - xmin || 1, yr = ymax - ymin || 1;
      const coords = points.map(([x, y]) => `${p.l + (x - xmin) / xr * (W - p.l - p.r)},${p.t + (ymax - y) / yr * (H - p.t - p.b)}`).join(' ');
      return `<div class="measurement-chart step-measurement-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(type.label)} preview"><line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}"/><line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}"/><polyline points="${coords}"/><text x="${W/2}" y="${H-9}" text-anchor="middle">${esc(type.units?.x || 'x')}</text><text x="15" y="${H/2}" transform="rotate(-90 15 ${H/2})" text-anchor="middle">${esc(type.units?.y || 'signal')}</text></svg></div>`;
    }

    function metricsMarkup(dataset) {
      const points = series(dataset), metrics = M.summary(dataset.measurementType, points);
      dataset.derivedMetrics = metrics;
      if (dataset.manual) {
        const manual = dataset.rows.map(row => ({ label: row[0], value: row[1], unit: row[2], source: 'user' })).filter(item => item.label && item.value !== '');
        return manual.length ? `<div class="derived-metrics">${manual.slice(0,8).map(item => `<span><small>${esc(item.label)}</small><strong>${esc(item.value)} ${esc(item.unit || '')}</strong><i>${esc(item.source)}</i></span>`).join('')}</div>` : '';
      }
      return metrics.length ? `<div class="derived-metrics">${metrics.map(metric => `<span><small>${esc(metric.label)}</small><strong>${esc(metric.value)} ${esc(metric.unit)}</strong><i>${esc(metric.source)}</i></span>`).join('')}</div>` : '';
    }

    function render() {
      const list = root.querySelector('[data-data-list]');
      list.innerHTML = state.datasets.map(raw => {
        const dataset = normaliseDataset(raw), type = dataType(dataset), target = targetLabel(dataset), status = parseState(dataset);
        const metrics = dataset.manual
          ? dataset.rows.slice(0,3).map(row => `${esc(row[0])}: ${esc(row[1])} ${esc(row[2] || '')}`).join(' · ')
          : (dataset.derivedMetrics || []).slice(0,3).map(metric => `${esc(metric.label)} ${esc(metric.value)} ${esc(metric.unit)}`).join(' · ');
        return `<article class="panel record-card measurement-record-card"><header><span class="measurement-type-mark ${esc(type.id)}">${esc(type.short)}</span><span class="badge ${dataset.status === 'Structured' ? 'success' : 'warning'}">${esc(dataset.status || 'Needs review')}</span></header><h4>${esc(type.label)} · ${esc(target || 'Project')}</h4><strong>${esc(dataset.filename || 'Manual entry')}</strong><small>${esc(status)} · ${dataset.rows.length} ${dataset.manual ? 'values' : 'rows'} · ${esc(stackLabel(dataset.stackId))}</small>${metrics ? `<p>${metrics}</p>` : ''}<footer><button class="button small" type="button" data-edit-dataset="${dataset.id}">Review</button><button class="button small danger" type="button" data-remove-dataset="${dataset.id}">Remove</button></footer></article>`;
      }).join('');
      root.querySelector('[data-data-empty]').hidden = state.datasets.length > 0;
    }

    const metricRow = (row = {}) => `<div class="metric-editor"><input class="input" placeholder="Metric / value name" value="${esc(row.metric || '')}" data-k="metric"><input class="input" type="number" step="any" placeholder="Value" value="${esc(row.value ?? '')}" data-k="value"><input class="input" placeholder="Unit" value="${esc(row.unit || '')}" data-k="unit"><button class="icon-button small" type="button" data-remove-metric aria-label="Remove value">×</button></div>`;

    function renderRecommended(typeId) {
      const type = M.types[typeId] || M.types.generic;
      const recommendations = new Set((type.recommended || []).map(item => item.id));
      form.querySelectorAll('[data-condition-field]').forEach(field => {
        const id = field.dataset.conditionField;
        field.hidden = !recommendations.has(id) && !['instrument'].includes(id);
        field.classList.toggle('recommended-field', recommendations.has(id));
      });
      const details = root.querySelector('[data-measurement-recommended]');
      const summary = details?.querySelector('summary span');
      if (summary) summary.textContent = recommendations.size ? `${recommendations.size} useful detail${recommendations.size > 1 ? 's' : ''} · optional` : 'Optional metadata';
    }

    function renderMapping() {
      const mappingRoot = root.querySelector('[data-column-mapping]');
      if (draft.manual || !draft.columns.length) { mappingRoot.innerHTML = ''; return; }
      const suggested = axisMap(draft);
      mappingRoot.innerHTML = `<header class="subtool-head"><div><strong>Column mapping</strong><small>LabFlow suggests x/signal roles; the researcher can correct them.</small></div><span class="badge info">Deterministic</span></header><div class="mapping-table">${draft.columns.map((column, index) => {
        const role = draft.mapping?.[index]?.meaning || (index === suggested.x ? 'x' : index === suggested.y ? 'signal' : 'field');
        const unit = draft.mapping?.[index]?.unit || (index === suggested.x ? dataType(draft).units?.x || '' : index === suggested.y ? dataType(draft).units?.y || '' : '');
        return `<div class="mapping-row"><strong>${esc(column || `Column ${index + 1}`)}</strong><select class="input" data-map="${index}" data-k="meaning"><option value="field" ${role === 'field' ? 'selected' : ''}>Available field</option><option value="x" ${role === 'x' ? 'selected' : ''}>x axis</option><option value="signal" ${role === 'signal' ? 'selected' : ''}>Signal</option></select><input class="input" placeholder="Unit" value="${esc(unit)}" data-map="${index}" data-k="unit"></div>`;
      }).join('')}</div>`;
    }

    function renderPreview() {
      const preview = root.querySelector('[data-data-preview]'), type = dataType(draft);
      if (draft.binary || !draft.rows.length) {
        preview.innerHTML = `<div class="useful-empty"><strong>${draft.binary ? 'Source recognised, scientific payload not parsed' : 'Add measured values below.'}</strong><small>${draft.binary ? 'The POC keeps metadata only. It never simulates values it did not parse.' : 'Manual values remain only for this session.'}</small></div>`;
        return;
      }
      const chart = chartMarkup(draft), metrics = metricsMarkup(draft);
      preview.innerHTML = `<section class="measurement-summary step-measurement-summary"><header><div><span class="eyebrow">Scientific preview</span><h3>${esc(type.label)} · ${esc(form.sample.value || stackLabel(form.stackId.value))}</h3></div><span>${draft.rows.length} ${draft.manual ? 'values' : 'points'}</span></header>${chart}${metrics}<details class="measurement-table"><summary>Inspect source values <span>${draft.rows.length} rows · ${draft.columns.length} columns</span></summary><div class="table-wrap"><table class="data-table"><thead><tr>${draft.columns.map(column => `<th>${esc(column)}</th>`).join('')}</tr></thead><tbody>${draft.rows.slice(0,8).map(row => `<tr>${draft.columns.map((_, index) => `<td>${esc(row[index] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details></section>`;
    }

    function renderDetection() {
      const box = root.querySelector('[data-measurement-detection]'), type = dataType(draft), detection = draft.detection;
      if (!detection) {
        box.innerHTML = `<span class="measurement-type-mark ${esc(type.id)}">${esc(type.short)}</span><div><strong>${esc(type.label)} measurement</strong><small>${draft.manual ? 'Manual scientific entry' : 'Measurement type selected by the researcher'}</small></div><span class="badge">${esc(draft.parseState || 'Manual')}</span>`;
        return;
      }
      box.innerHTML = `<span class="measurement-type-mark ${esc(type.id)}">${esc(type.short)}</span><div><strong>${esc(type.label)} suggested</strong><small>${esc(detection.confidence)} confidence · ${esc((detection.reasons || []).join(' + '))}</small></div><span class="badge success">Rule-based detection</span>`;
    }

    function open(dataset, manual = false) {
      draft = normaliseDataset(dataset || {
        id: null, kind: 'measurement', filename: manual ? 'Manual entry' : null, fileType: manual ? 'manual' : '', importedAt: new Date().toISOString(),
        columns: manual ? ['Metric', 'Value', 'Unit'] : [], rows: [], mapping: [], measurementType: preferredType === 'auto' ? 'jv' : preferredType,
        stackId: stacks[0]?.id || '', sample: stacks[0]?.samples?.[0] || '', status: 'Structured', parseState: manual ? 'Parsed' : 'Needs review', manual,
        conditions: {}, provenance: { measurementType: 'user', target: 'inherited', data: manual ? 'user' : 'imported' }
      });
      form.hidden = false;
      form.measurementType.value = draft.measurementType;
      form.stackId.innerHTML = stackOptions(draft.stackId);
      form.stackId.value = draft.stackId || '';
      form.sample.innerHTML = sampleOptions(form.stackId.value, draft.sample || draft.target || '');
      form.sample.value = draft.sample || draft.target || '';
      form.status.value = draft.status || 'Structured';
      ['activeArea', 'instrument', 'illumination', 'environment', 'protocol'].forEach(name => { form[name].value = draft.conditions?.[name] || ''; });
      root.querySelector('[data-data-title]').textContent = draft.filename || 'Manual entry';
      root.querySelector('[data-manual-rows]').hidden = !draft.manual;
      root.querySelector('[data-metric-list]').innerHTML = draft.manual ? draft.rows.map(row => metricRow({ metric: row[0], value: row[1], unit: row[2] })).join('') : '';
      renderRecommended(draft.measurementType); renderDetection(); renderMapping(); renderPreview();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function selectedType() {
      return root.querySelector('input[name="step_measurement_type"]:checked')?.value || 'auto';
    }

    root.onclick = event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.matches('[data-data-manual]')) open(null, true);
      if (button.matches('[data-data-close]')) form.hidden = true;
      if (button.dataset.editDataset) open(state.datasets.find(dataset => dataset.id === button.dataset.editDataset));
      if (button.dataset.removeDataset) { state.datasets = state.datasets.filter(dataset => dataset.id !== button.dataset.removeDataset); S.set('data', state); render(); }
      if (button.matches('[data-add-metric]')) root.querySelector('[data-metric-list]').insertAdjacentHTML('beforeend', metricRow());
      if (button.matches('[data-remove-metric]')) button.closest('.metric-editor')?.remove();
    };

    root.querySelector('[data-measurement-selector]').onchange = event => {
      preferredType = event.target.value;
      root.querySelectorAll('[data-measurement-selector] label').forEach(label => label.classList.toggle('active', label.contains(event.target)));
    };

    root.querySelector('[data-data-file]').onchange = event => {
      const file = event.target.files[0]; if (!file) return;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const textTypes = ['csv','tsv','txt','dat','asc','json','jsonl','ndjson','xml','yaml','yml','xy'];
      const base = { id: null, kind: 'measurement', filename: file.name, fileType: ext || file.type, importedAt: new Date().toISOString(), stackId: stacks[0]?.id || '', sample: stacks[0]?.samples?.[0] || '', status: 'Needs review', manual: false, size: file.size, mime: file.type || 'unknown', conditions: {}, provenance: { data: 'imported', target: 'inherited' } };
      if (!textTypes.includes(ext)) {
        const chosen = selectedType() === 'auto' ? 'generic' : selectedType();
        open({ ...base, measurementType: chosen, measurement: M.types[chosen]?.label, binary: true, parseState: ['jdx','dx','xrdml'].includes(ext) ? 'Structure inspected' : 'Metadata only', columns: [], rows: [], mapping: [] });
        event.target.value = ''; return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = S.parseText(file.name, String(reader.result || ''));
          const detection = M.detect({ columns: parsed.columns, filename: file.name });
          const chosen = selectedType() === 'auto' ? detection.type.id : selectedType();
          const suggested = M.mapping(chosen, parsed.columns);
          open({ ...base, measurementType: chosen, measurement: M.types[chosen]?.label, detection, parseState: 'Parsed', columns: parsed.columns, rows: parsed.rows, mapping: parsed.columns.map((column, index) => ({ column, meaning: index === suggested.x ? 'x' : index === suggested.y ? 'signal' : 'field', unit: index === suggested.x ? M.types[chosen]?.units?.x || '' : index === suggested.y ? M.types[chosen]?.units?.y || '' : '' })) });
        } catch (error) {
          open({ ...base, measurementType: 'generic', measurement: 'Other / Generic', binary: true, parseState: 'Raw evidence / Unsupported', columns: [], rows: [], mapping: [], error: error.message });
        }
      };
      reader.readAsText(file); event.target.value = '';
    };

    form.stackId.onchange = () => {
      form.sample.innerHTML = sampleOptions(form.stackId.value, '');
      form.sample.value = '';
      renderPreview();
    };
    form.sample.onchange = renderPreview;
    form.measurementType.onchange = () => {
      draft.measurementType = form.measurementType.value;
      draft.measurement = M.types[draft.measurementType]?.label || 'Other / Generic';
      const suggested = M.mapping(draft.measurementType, draft.columns);
      draft.mapping = draft.columns.map((column, index) => ({ column, meaning: index === suggested.x ? 'x' : index === suggested.y ? 'signal' : 'field', unit: index === suggested.x ? M.types[draft.measurementType]?.units?.x || '' : index === suggested.y ? M.types[draft.measurementType]?.units?.y || '' : '' }));
      renderRecommended(draft.measurementType); renderDetection(); renderMapping(); renderPreview();
    };

    root.querySelector('[data-column-mapping]').onchange = event => {
      if (!draft || !event.target.dataset.map) return;
      const index = Number(event.target.dataset.map), key = event.target.dataset.k;
      draft.mapping[index] = draft.mapping[index] || { column: draft.columns[index] };
      draft.mapping[index][key] = event.target.value;
      if (key === 'meaning' && ['x','signal'].includes(event.target.value)) {
        draft.mapping.forEach((item, i) => { if (i !== index && item.meaning === event.target.value) item.meaning = 'field'; });
        renderMapping();
      }
      renderPreview();
    };

    form.onsubmit = event => {
      event.preventDefault();
      if (draft.manual) {
        draft.rows = [...form.querySelectorAll('.metric-editor')].map(row => [row.querySelector('[data-k="metric"]').value.trim(), row.querySelector('[data-k="value"]').value, row.querySelector('[data-k="unit"]').value.trim()]).filter(row => row[0]);
      } else {
        draft.mapping = draft.columns.map((column, index) => ({
          column,
          meaning: form.querySelector(`[data-map="${index}"][data-k="meaning"]`)?.value || draft.mapping?.[index]?.meaning || 'field',
          unit: form.querySelector(`[data-map="${index}"][data-k="unit"]`)?.value || draft.mapping?.[index]?.unit || ''
        }));
      }
      const type = M.types[form.measurementType.value] || M.types.generic;
      Object.assign(draft, {
        id: draft.id || S.uid('measurement'), kind: 'measurement', measurementType: type.id, measurement: type.label,
        stackId: form.stackId.value, sample: form.sample.value, target: form.sample.value || form.stackId.value || 'project', status: form.status.value,
        conditions: { activeArea: form.activeArea.value.trim(), instrument: form.instrument.value.trim(), illumination: form.illumination.value.trim(), environment: form.environment.value.trim(), protocol: form.protocol.value.trim() },
        source: draft.source || { name: draft.filename || 'Manual entry', format: draft.fileType || 'manual', parser: draft.manual ? 'Manual entry' : 'Local parser', status: draft.parseState || 'Parsed' },
        provenance: { ...(draft.provenance || {}), measurementType: draft.detection ? 'inferred + confirmed' : 'user', target: 'inherited', data: draft.manual ? 'user' : 'imported', derivedMetrics: 'calculated' },
        savedAt: new Date().toISOString()
      });
      draft.derivedMetrics = draft.manual ? [] : M.summary(type.id, series(draft));
      const index = state.datasets.findIndex(dataset => dataset.id === draft.id);
      if (index < 0) state.datasets.push(structuredClone(draft)); else state.datasets[index] = structuredClone(draft);
      S.set('data', state); form.hidden = true; render();
    };

    render();
  };

  document.addEventListener('labflow:pipeline-step', event => {
    if (event.detail.pipelineId === 'chose' && event.detail.id === 'data') requestAnimationFrame(() => init(document.getElementById('dataTool')));
  });
})();
