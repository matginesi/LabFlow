(() => {
  'use strict';

  const families = {
    tabular: ['csv','tsv','txt','dat','asc'], structured: ['json','jsonl','ndjson','xml','yaml','yml'], spectra: ['xy','jdx','dx','xrdml'],
    spreadsheet: ['xls','xlsx','ods'], container: ['h5','hdf5','nc','netcdf','cdf','parquet'], instrument: ['spc','spe','raw'],
    document: ['pdf'], image: ['png','jpg','jpeg','tif','tiff','bmp','webp'], archive: ['zip','tar','gz']
  };
  const labels = { tabular:'Tabular text', structured:'Structured text', spectra:'Scientific text', spreadsheet:'Spreadsheet', container:'Scientific container', instrument:'Instrument format', document:'Document evidence', image:'Image evidence', archive:'Archive', unknown:'Unknown file' };
  const parsed = new Set([...families.tabular, ...families.structured, 'xy']);
  const inspected = new Set(['jdx','dx','xrdml', ...families.spreadsheet, ...families.container, ...families.archive]);
  const familyOf = ext => Object.entries(families).find(([, extensions]) => extensions.includes(ext))?.[0] || 'unknown';
  const statusOf = ext => parsed.has(ext) ? 'Parsed' : inspected.has(ext) ? 'Structure inspected' : families.image.includes(ext) || families.document.includes(ext) || families.instrument.includes(ext) ? 'Metadata only' : 'Raw evidence / Unsupported';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const size = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;

  let items = [], selected = 0, manualType = 'auto';
  const inspect = file => { const ext = (file.name.split('.').pop() || '').toLowerCase(), family = familyOf(ext); return { file, ext, family, status: statusOf(ext), mime: file.type || 'Not provided', data: null, detection: null, confirmed: false, manualMapping: null, manualUnits: {}, attached: false }; };
  const currentType = item => manualType !== 'auto' ? LabFlowMeasurements.types[manualType] : (item.detection?.type || LabFlowMeasurements.types.generic);
  const progress = stage => document.querySelectorAll('.import-flow-steps span').forEach((node,index) => { node.classList.toggle('active', index === stage); node.classList.toggle('complete', index < stage); });

  function projectTargets() {
    const stacks = window.LabFlowProjectStore?.get('fabrication', { stacks: [] }).stacks || [];
    const out = [{ value: 'project', label: 'Entire Project', stackId: '', sample: '' }];
    stacks.forEach(stack => {
      out.push({ value: `stack:${stack.id}`, label: `${stack.name} · whole stack`, stackId: stack.id, sample: '' });
      (stack.samples || []).forEach(sample => out.push({ value: `sample:${stack.id}:${sample}`, label: `${sample} · ${stack.name}`, stackId: stack.id, sample }));
    });
    return out;
  }

  function populateTargets() {
    const select = document.querySelector('#measurementTarget'); if (!select) return;
    const previous = select.value;
    select.innerHTML = projectTargets().map(target => `<option value="${esc(target.value)}">${esc(target.label)}</option>`).join('');
    select.value = [...select.options].some(option => option.value === previous) ? previous : select.options[0]?.value || 'project';
  }

  function targetInfo() {
    const value = document.querySelector('#measurementTarget')?.value || 'project';
    return projectTargets().find(target => target.value === value) || projectTargets()[0];
  }

  function conditionValue(id) {
    const map = { activeArea:'measurementActiveArea', instrument:'measurementInstrument', illumination:'measurementIllumination', environment:'measurementEnvironment', protocol:'measurementProtocol' };
    return document.querySelector(`#${map[id]}`)?.value.trim() || '';
  }

  function updateRecommended(type) {
    const wanted = new Set((type.recommended || []).map(item => item.id));
    document.querySelectorAll('[data-import-condition]').forEach(field => {
      const id = field.dataset.importCondition;
      field.hidden = !wanted.has(id) && id !== 'instrument';
      field.classList.toggle('recommended-field', wanted.has(id));
    });
    const summary = document.querySelector('#measurementRecommendedDetails summary span');
    if (summary) summary.textContent = wanted.size ? `${wanted.size} useful detail${wanted.size > 1 ? 's' : ''} · optional` : 'Optional metadata';
  }

  function effectiveMap(item, type) {
    if (item.manualMapping) return item.manualMapping;
    return LabFlowMeasurements.mapping(type.id, item.data?.columns || []);
  }

  function renderManifest() {
    const root = document.querySelector('#workspaceImportManifest'); if (!root) return;
    const target = targetInfo();
    root.innerHTML = items.map((item,index) => {
      const type = currentType(item);
      return `<button class="ingest-manifest-row ${index === selected ? 'active' : ''}" type="button" data-ingest-file="${index}"><span class="ingest-file-index">${String(index+1).padStart(2,'0')}</span><span><strong>${esc(type.short)} · ${esc(item.file.name)}</strong><small>${esc(labels[item.family])} · ${size(item.file.size)} · source file</small></span><span class="badge ${item.status === 'Parsed' ? 'success' : item.status === 'Structure inspected' ? 'info' : 'warning'}">${esc(item.attached ? 'Attached' : item.status)}</span><span class="ingest-target">${esc(target.label)}</span></button>`;
    }).join('');
  }

  function chart(type, points) {
    if (points.length < 2) return '';
    const W=720,H=250,p={l:52,r:18,t:22,b:38},xs=points.map(x=>x[0]),ys=points.map(x=>x[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),xr=xmax-xmin||1,yr=ymax-ymin||1;
    const coords=points.map(([x,y])=>`${p.l+(x-xmin)/xr*(W-p.l-p.r)},${p.t+(ymax-y)/yr*(H-p.t-p.b)}`).join(' ');
    return `<div class="measurement-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(type.label)} measurement preview"><line x1="${p.l}" y1="${H-p.b}" x2="${W-p.r}" y2="${H-p.b}"/><line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${H-p.b}"/><polyline points="${coords}"/><text x="${W/2}" y="${H-8}" text-anchor="middle">${esc(type.units?.x||'')}</text><text x="14" y="${H/2}" transform="rotate(-90 14 ${H/2})" text-anchor="middle">${esc(type.units?.y||'')}</text><text x="${p.l}" y="15">${esc(type.preview === 'timeline' ? 'Evolution over time' : type.preview === 'spectrum' ? 'Wavelength response' : 'Current–voltage curve')}</text></svg></div>`;
  }

  function provenance(item,type) {
    const target = targetInfo();
    return `<div class="measurement-provenance"><span><b>Measurement type</b>${esc(type.label)} <i>${manualType === 'auto' ? (item.confirmed ? 'inferred + confirmed' : 'inferred') : 'user'}</i></span><span><b>Source file</b>${esc(item.file.name)} <i>imported</i></span><span><b>Target</b>${esc(target.label)} <i>inherited</i></span><span><b>Parser</b>${esc(labels[item.family])} <i>${esc(item.status.toLowerCase())}</i></span></div>`;
  }

  function recommendation(type) {
    const missing = (type.recommended || []).find(item => !conditionValue(item.id));
    if (!missing) return '';
    return `<aside class="contextual-request"><span class="request-mark">+</span><div><strong>${esc(missing.label)} is missing</strong><p>${esc(missing.why)}</p></div><button class="button small" type="button" data-focus-recommended="${esc(missing.id)}">Add</button><button class="button small" type="button" data-continue-anyway>Continue anyway</button></aside>`;
  }

  async function prepare(item) {
    if (item.status !== 'Parsed') return;
    try {
      const text = await item.file.text();
      item.data = LabFlowProjectStore.parseText(item.file.name, text);
      item.detection = LabFlowMeasurements.detect({ columns: item.data.columns, filename: item.file.name });
    } catch (error) {
      item.status = 'Raw evidence / Unsupported'; item.error = error.message;
    }
  }

  function mappingEditor(item, type, map) {
    const columns = item.data?.columns || [];
    return `<details class="measurement-table ingest-mapping-editor"><summary>Review mapping <span>Correct deterministic suggestions when needed</span></summary><div class="mapping-table">${columns.map((column,index) => {
      const role = index === map.x ? 'x' : index === map.y ? 'signal' : 'field';
      const unit = item.manualUnits?.[index] ?? (index === map.x ? type.units?.x || '' : index === map.y ? type.units?.y || '' : '');
      return `<div class="mapping-row"><strong>${esc(column || `Column ${index+1}`)}</strong><select class="input" data-ingest-map-role="${index}"><option value="field" ${role==='field'?'selected':''}>Available field</option><option value="x" ${role==='x'?'selected':''}>x axis</option><option value="signal" ${role==='signal'?'selected':''}>Signal</option></select><input class="input" data-ingest-map-unit="${index}" value="${esc(unit)}" placeholder="Unit"></div>`;
    }).join('')}</div></details>`;
  }

  function renderPreview() {
    const root = document.querySelector('#workspaceImportPreview'), item = items[selected];
    if (!root || !item) return;
    const type = currentType(item); updateRecommended(type);
    if (item.status !== 'Parsed' || !item.data) {
      progress(1);
      root.innerHTML = `<div class="data-preview-head"><div><strong>${esc(item.file.name)}</strong><small>${size(item.file.size)} · ${esc(item.mime)}</small></div><span class="badge ${item.status === 'Structure inspected' ? 'info' : 'warning'}">${esc(item.status)}</span></div>${provenance(item,type)}<div class="alert info"><span aria-hidden="true">i</span><div><strong>No simulated parsing</strong><small>${item.status === 'Structure inspected' ? 'The container, archive or scientific format is recognised, but its scientific payload is not parsed by this POC.' : 'The source can remain linked as raw evidence; no scientific values were inferred.'}</small></div></div>`;
      return;
    }
    const {columns,rows} = item.data, detection = item.detection || LabFlowMeasurements.detect({columns,filename:item.file.name}), map = effectiveMap(item,type), points = LabFlowMeasurements.series(type.id,columns,rows,map), metrics = LabFlowMeasurements.summary(type.id,points), meaningful = type.id !== 'generic' && map.x >= 0 && map.y >= 0;
    progress(meaningful ? 2 : 1);
    root.innerHTML = `<div class="measurement-detection ${meaningful?'detected':'generic'}"><div><span class="eyebrow">${manualType === 'auto' ? 'Detected as' : 'Selected as'}</span><strong>${esc(type.label)} measurement</strong><small>${manualType === 'auto' ? `Confidence: ${esc(detection.confidence)} · deterministic filename/header rules` : 'Manual choice · verify the mapping below'}</small></div><span class="badge ${meaningful?'success':'warning'}">${meaningful?'Scientific meaning found':'Generic evidence'}</span>${manualType === 'auto' && meaningful && !item.confirmed ? '<button class="button small primary" type="button" data-confirm-measurement>Confirm</button>' : ''}<button class="button small" type="button" data-change-measurement>Change</button></div>
      <section class="measurement-summary"><header><div><span class="eyebrow">Measurement summary</span><h3>${esc(type.short)} · ${esc(targetInfo().label)}</h3></div><span>${rows.length} points</span></header>${provenance(item,type)}${meaningful?chart(type,points):''}${metrics.length?`<div class="derived-metrics">${metrics.map(metric=>`<span><small>${esc(metric.label)}</small><strong>${esc(metric.value)} ${esc(metric.unit)}</strong><i>${esc(metric.source)}</i></span>`).join('')}</div>`:''}</section>
      ${meaningful ? recommendation(type) : ''}${mappingEditor(item,type,map)}<details class="measurement-table"><summary>Inspect imported data <span>${rows.length} rows · ${columns.length} columns</span></summary><div class="ingest-inference-strip">${columns.map((column,index)=>`<span class="${index===map.x||index===map.y?'mapped':''}"><b>${esc(column||`Column ${index+1}`)}</b>${index===map.x?'x axis':index===map.y?'signal':'available'}</span>`).join('')}</div><div class="table-wrap"><table class="data-table"><thead><tr>${columns.map(column=>`<th>${esc(column)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,8).map(row=>`<tr>${columns.map((_,index)=>`<td>${esc(row[index]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>
      <div class="ingest-validation-grid"><article class="done"><strong>Source parsed</strong><small>${esc(labels[item.family])}</small></article><article class="${meaningful?'done':''}"><strong>Meaning detected</strong><small>${meaningful?esc(type.label):'Map manually'}</small></article><article class="done"><strong>Context linked</strong><small>${esc(targetInfo().label)}</small></article><article><strong>Recommended</strong><small>May be completed later</small></article></div><div class="row wrap"><button class="button primary" type="button" data-attach-measurement ${meaningful&&!item.attached?'':'disabled'}>${item.attached?'Attached for this session':'Attach measurement'}</button><span class="ready-note"><b>${item.attached?'Measurement attached':'Ready to continue'}</b> · recommended details do not block attachment</span></div>`;
  }

  async function handleFiles(files) {
    items = [...files].map(inspect); if (!items.length) return;
    selected = 0; await Promise.all(items.map(prepare)); renderManifest(); renderPreview();
  }

  function attach() {
    const item = items[selected], type = currentType(item); if (!item?.data) return;
    const S = LabFlowProjectStore, state = S.get('data',{datasets:[]}), target = targetInfo(), map = effectiveMap(item,type), points = LabFlowMeasurements.series(type.id,item.data.columns,item.data.rows,map);
    const units = { ...(item.manualUnits || {}) };
    document.querySelectorAll('[data-ingest-map-unit]').forEach(input => units[Number(input.dataset.ingestMapUnit)] = input.value.trim());
    const measurement = {
      id:S.uid('measurement'), kind:'measurement', measurementType:type.id, measurement:type.label, target:target.sample || target.stackId || 'project', sample:target.sample, stackId:target.stackId,
      filename:item.file.name, source:{name:item.file.name,format:item.ext,parser:labels[item.family],status:item.status}, columns:item.data.columns, rows:item.data.rows,
      mapping:item.data.columns.map((column,index)=>({column,meaning:index===map.x?'x':index===map.y?'signal':'field',unit:units[index] || (index===map.x?type.units?.x||'':index===map.y?type.units?.y||'':'' )})),
      conditions:{activeArea:conditionValue('activeArea'),instrument:conditionValue('instrument'),illumination:conditionValue('illumination'),environment:conditionValue('environment'),protocol:conditionValue('protocol')},
      provenance:{measurementType:manualType==='auto'?'inferred + confirmed':'user',data:'imported',target:'inherited',derivedMetrics:'calculated'}, derivedMetrics:LabFlowMeasurements.summary(type.id,points), status:'Structured', parseState:item.status, importedAt:new Date().toISOString()
    };
    state.datasets = state.datasets || []; state.datasets.push(measurement); S.set('data',state); item.attached = true; item.confirmed = true; progress(5); renderManifest(); renderPreview();
  }

  document.addEventListener('change', event => {
    if (event.target.id === 'workspaceImportFile') { event.stopImmediatePropagation(); handleFiles(event.target.files); }
    if (event.target.name === 'measurement_type') { manualType = event.target.value; items.forEach(item => { item.manualMapping = null; }); document.querySelectorAll('.measurement-selector label').forEach(label => label.classList.toggle('active',label.contains(event.target))); renderManifest(); if (items.length) renderPreview(); else updateRecommended(LabFlowMeasurements.types[manualType] || LabFlowMeasurements.types.generic); }
    if (event.target.id === 'measurementTarget' && items.length) { renderManifest(); renderPreview(); }
    if (event.target.matches('[data-ingest-map-role]')) {
      const item=items[selected], index=Number(event.target.dataset.ingestMapRole), role=event.target.value, type=currentType(item), base=effectiveMap(item,type);
      item.manualMapping = { ...base };
      if (role === 'x') item.manualMapping.x = index;
      else if (role === 'signal') item.manualMapping.y = index;
      else { if (item.manualMapping.x === index) item.manualMapping.x = -1; if (item.manualMapping.y === index) item.manualMapping.y = -1; }
      renderPreview(); progress(3);
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target.matches('[data-ingest-map-unit]') && items.length) {
      const item = items[selected];
      item.manualUnits = item.manualUnits || {};
      item.manualUnits[Number(event.target.dataset.ingestMapUnit)] = event.target.value;
      return;
    }
    if (event.target.matches('#measurementActiveArea,#measurementInstrument,#measurementIllumination,#measurementEnvironment,#measurementProtocol') && items.length) renderPreview();
  });

  document.addEventListener('click', event => {
    const fileButton = event.target.closest('[data-ingest-file]');
    if (fileButton) { selected = Number(fileButton.dataset.ingestFile); renderManifest(); renderPreview(); }
    if (event.target.closest('[data-confirm-measurement]')) { items[selected].confirmed = true; renderPreview(); }
    if (event.target.closest('[data-change-measurement]')) document.querySelector('#measurementSelector')?.scrollIntoView({behavior:'smooth'});
    const focus = event.target.closest('[data-focus-recommended]');
    if (focus) {
      document.querySelector('#measurementRecommendedDetails').open = true;
      const ids={activeArea:'measurementActiveArea',instrument:'measurementInstrument',illumination:'measurementIllumination',environment:'measurementEnvironment',protocol:'measurementProtocol'};
      document.querySelector(`#${ids[focus.dataset.focusRecommended]}`)?.focus();
    }
    if (event.target.closest('[data-continue-anyway]')) event.target.closest('.contextual-request')?.remove();
    if (event.target.closest('[data-attach-measurement]')) attach();
  });

  document.addEventListener('DOMContentLoaded', () => {
    populateTargets(); updateRecommended(LabFlowMeasurements.types.auto);
    const drop = document.querySelector('.data-import-target'); if (!drop) return;
    ['dragenter','dragover'].forEach(type => drop.addEventListener(type,event => { event.preventDefault(); drop.classList.add('dragging'); }));
    ['dragleave','drop'].forEach(type => drop.addEventListener(type,event => { event.preventDefault(); drop.classList.remove('dragging'); }));
    drop.addEventListener('drop',event => handleFiles(event.dataTransfer.files));
  });
})();
